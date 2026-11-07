// Pruebas de las funciones de páginas contra una copia local de la landing ya
// marcada, con GitHub simulado en memoria.
//
// Uso:  node test/pages.js /ruta/a/la/landing

const assert = require('assert');
const { install } = require('./mock-github');

const repoDir = process.argv[2];
if (!repoDir) { console.error('Uso: node test/pages.js /ruta/a/la/landing'); process.exit(1); }

const { files, original, stats } = install(repoDir);
process.env.GITHUB_TOKEN = 'token-de-prueba';
process.env.ADMIN_PASSWORD = 'clave-de-prueba';

const call = async (fn, { method = 'GET', query, body, password = 'clave-de-prueba' } = {}) => {
  const res = await require(`../netlify/functions/${fn}.js`).handler({
    httpMethod: method, headers: { 'x-admin-password': password },
    queryStringParameters: query, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.statusCode, data: res.body && res.body.startsWith('{') ? JSON.parse(res.body) : res.body };
};
const get = async (block) => (await call('get-page', { query: { block } })).data;
const save = (block, values, lists) => call('save-page', { method: 'POST', body: { block, values, lists } });

let passed = 0;
const ok = (c, label) => { assert.ok(c, label); passed++; console.log('  ✓ ' + label); };
const homeOrig = original.get('index.html');

(async () => {
  console.log('Menú y autenticación');
  const menu = await call('list-pages');
  const pages = menu.data.menu.flatMap((g) => g.items).filter((i) => i.type === 'page');
  ok(pages.length === 8, 'el menú trae las 8 páginas editables');
  ok((await call('get-page', { query: { block: 'home' }, password: 'mala' })).status === 401, 'sin contraseña correcta → 401');
  ok((await call('get-page', { query: { block: 'nada' } })).status === 404, 'página desconocida → 404');

  console.log('Todas las páginas: leer y guardar sin cambios no toca nada');
  for (const p of pages) {
    const d = await get(p.key);
    ok(d.fields.length > 0 && Object.keys(d.values).length === d.fields.length, `${p.key}: lee ${d.fields.length} campos`);
    const before = stats.commits;
    const r = await save(p.key, d.values, Object.fromEntries(Object.entries(d.lists).map(([k, v]) => [k, v.items])));
    ok(r.status === 200 && r.data.unchanged === true && stats.commits === before, `${p.key}: guardar sin cambios no hace commit`);
  }

  console.log('Inicio: editar un texto cambia solo ese texto');
  const home = await get('home');
  ok(home.values.t03 === 'Pausas guiadas para volver a conectar con quienes más amas.', 'lee el título principal');
  let r = await save('home', { t03: 'Pausas guiadas & "reales" para conectar' });
  ok(r.status === 200 && r.data.changed.join() === 't03', 'guarda y reporta solo t03');
  const h1 = files.get('index.html');
  ok(h1 === homeOrig.replace('Pausas guiadas para volver a conectar con quienes más amas.', 'Pausas guiadas &amp; "reales" para conectar'), 'el HTML cambia únicamente en ese texto (escapado)');
  ok((await get('home')).values.t03 === 'Pausas guiadas & "reales" para conectar', 'se vuelve a leer igual');
  files.set('index.html', homeOrig);

  console.log('Inicio: precios y renglones con <br>');
  ok(home.modes.t30 === 'lines' && home.values.t30.split('\n').length === 3, 'lee "qué incluye" como 3 renglones');
  r = await save('home', { t30: '– Sesión de 1 hora.\n– Selección de 20 retratos digitales.\n– 1 impresión de 32cmx32cm enmarcada.', t31: 'Inversión — $5,200' });
  const h2 = files.get('index.html');
  ok(h2.includes('– Sesión de 1 hora.<br>\n              – Selección de 20 retratos digitales.<br>\n              – 1 impresión de 32cmx32cm enmarcada.\n            </p>'), 'conserva la sangría original entre renglones');
  ok(h2.includes('<p class="investment" data-t="home.t31">Inversión — $5,200</p>'), 'cambia el precio');
  ok(h2.includes('Inversión — $7,300') && h2.includes('Inversión — $12,000'), 'los otros precios no se tocan');
  files.set('index.html', homeOrig);

  console.log('Imágenes');
  r = await save('home', { i3_src: 'https://res.cloudinary.com/dlu6jpw54/image/upload/v1700000000/nueva_foto.jpg', i3_alt: 'Familia nueva' });
  ok(files.get('index.html').includes('src="https://res.cloudinary.com/dlu6jpw54/image/upload/f_auto,q_auto,w_600/v1700000000/nueva_foto.jpg"'), 'una URL limpia de Cloudinary recupera su versión reducida (w_600)');
  ok((await get('home')).values.i3_src === 'https://res.cloudinary.com/dlu6jpw54/image/upload/v1700000000/nueva_foto.jpg', 'el panel vuelve a ver la URL limpia');
  files.set('index.html', homeOrig);
  r = await save('home', { i2_src: 'https://res.cloudinary.com/dlu6jpw54/image/upload/v1700000000/hero_nuevo.jpg' });
  const hero = /<img[^>]*data-srcset-widths[^>]*>/.exec(files.get('index.html'))[0];
  ok(hero.includes('src="https://res.cloudinary.com/dlu6jpw54/image/upload/f_auto,q_auto,w_1400/v1700000000/hero_nuevo.jpg"'), 'el hero conserva w_1400');
  ok(/srcset="\n\s+https:\/\/res\.cloudinary\.com\/dlu6jpw54\/image\/upload\/f_auto,q_auto,w_800\/v1700000000\/hero_nuevo\.jpg 800w,\n\s+https:\/\/res\.cloudinary\.com\/dlu6jpw54\/image\/upload\/f_auto,q_auto,w_1400\/v1700000000\/hero_nuevo\.jpg 1400w"/.test(hero), 'el srcset del hero se regenera con el mismo formato');
  files.set('index.html', homeOrig);
  ok((await save('home', { i3_src: 'javascript:alert(1)' })).status === 400, 'rechaza una imagen que no sea https');

  console.log('Google y redes');
  r = await save('home', { seoDesc: 'Nueva descripción para Google.', ogImage: 'https://res.cloudinary.com/dlu6jpw54/image/upload/v1/og_nueva.jpg' });
  const h3 = files.get('index.html');
  ok(h3.includes('<meta name="description" content="Nueva descripción para Google."'), 'cambia la descripción');
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(h3)[1]);
  ok(ld.description === 'Nueva descripción para Google.' && ld.image.endsWith('og_nueva.jpg') && ld.name === 'Hora Azul Fotografía' && ld.telephone === '+525551376253', 'el marcado estructurado (JSON-LD) sigue la descripción y la imagen, sin perder el resto');
  ok(h3.includes('<meta property="og:image" data-ta="content:home.ogImage" content="https://res.cloudinary.com/dlu6jpw54/image/upload/v1/og_nueva.jpg"') && h3.includes('<meta name="twitter:image" data-ta="content:home.ogImage" content="https://res.cloudinary.com/dlu6jpw54/image/upload/v1/og_nueva.jpg"'), 'og:image y twitter:image cambian juntas');
  files.set('index.html', homeOrig);

  console.log('Enlaces');
  ok((await save('home', { h47: 'javascript:alert(1)' })).status === 400, 'rechaza enlaces con javascript:');
  ok((await save('home', { h47: 'ftp://x' })).status === 400, 'rechaza esquemas raros');
  r = await save('home', { h47: 'https://wa.me/525500000000?text=Hola%20Andrea' });
  ok(r.status === 200 && files.get('index.html').includes('href="https://wa.me/525500000000?text=Hola%20Andrea"'), 'acepta un link de WhatsApp nuevo');
  files.set('index.html', homeOrig);

  console.log('Carruseles');
  const gal = home.lists.gallery.items;
  ok(gal.length === 18 && home.lists.testimonials.items.length === 9, 'lee las 18 fotos y los 9 testimonios');
  ok(gal[0].src === 'https://res.cloudinary.com/dlu6jpw54/image/upload/v1777603953/1_expx4q.jpg' && gal[0].alt.startsWith('Pareja abrazada'), 'cada foto trae URL limpia y texto alternativo');
  const reordered = [gal[1], gal[0], ...gal.slice(2, 17), { src: 'https://res.cloudinary.com/dlu6jpw54/image/upload/v1800000000/foto_nueva.jpg', alt: 'Foto <nueva> & "bonita"' }];
  r = await save('home', {}, { gallery: reordered });
  const h4 = files.get('index.html');
  ok(r.status === 200 && (h4.match(/class="carousel-photo"/g) || []).length === 18, 'reordena, quita una y agrega otra: siguen 18');
  ok(h4.includes('src="https://res.cloudinary.com/dlu6jpw54/image/upload/f_auto,q_auto,w_700/v1800000000/foto_nueva.jpg" alt="Foto &lt;nueva&gt; &amp; &quot;bonita&quot;" loading="lazy" role="listitem">'), 'la foto nueva usa w_700 y escapa el texto alternativo');
  ok(h4.indexOf('5f6d219a') < h4.indexOf('1_expx4q'), 'el nuevo orden se respeta');
  ok(/<div class="carousel" id="gallery-carousel" data-list="gallery" role="list">\n {10}<img/.test(h4) && /<\/div>\n {8}<\/div>\n {8}<button class="carousel-arrow next"/.test(h4.replace(/(foto_nueva[^\n]*)\n/, '$1\n')), 'conserva la sangría del contenedor');
  ok(h4.slice(0, h4.indexOf('data-list="gallery"')) === homeOrig.slice(0, homeOrig.indexOf('data-list="gallery"')), 'nada antes del carrusel cambia');
  const tail = (s) => s.slice(s.indexOf('<button class="carousel-arrow next" type="button" aria-label="Fotos siguientes"'));
  ok(tail(h4) === tail(homeOrig), 'nada después del carrusel cambia');
  const reread = (await get('home')).lists.gallery.items;
  ok(reread.length === 18 && reread[17].alt === 'Foto <nueva> & "bonita"', 'se vuelve a leer idéntico');
  files.set('index.html', homeOrig);
  const t = home.lists.testimonials.items;
  r = await save('home', {}, { testimonials: t.slice(0, 3) });
  ok((files.get('index.html').match(/class="testimonial-slide"/g) || []).length === 3, 'se pueden quitar testimonios');
  files.set('index.html', homeOrig);
  ok((await save('home', {}, { gallery: [] })).status === 400, 'no deja vaciar un carrusel');
  ok((await save('home', {}, { gallery: [{ src: 'http://x.com/a.jpg', alt: '' }] })).status === 400, 'rechaza fotos que no sean https');
  ok((await save('home', {}, { portada: [] })).status === 400, 'lista desconocida → error');

  console.log('Campos con formato');
  const { sanitizeHtml } = require('../netlify/functions/lib/pages');
  ok(sanitizeHtml('Hola <script>alert(1)</script> <b onclick="x()">tú</b> <a href="javascript:x()">mal</a> <a href="https://a.com" target="_blank">bien</a> & más<br/>fin') ===
    'Hola &lt;script&gt;alert(1)&lt;/script&gt; <b>tú</b> <a>mal</a> <a href="https://a.com">bien</a> &amp; más<br>fin', 'el HTML permitido se limpia: sin scripts, sin eventos, sin links peligrosos');

  console.log('Protecciones');
  ok((await save('home', { campoInventado: 'x' })).status === 400, 'campos desconocidos → error');
  ok((await save('home', { t03: 123 })).status === 400, 'valores que no son texto → error');

  console.log('Otras páginas');
  const pv = await get('privacidad');
  r = await save('privacidad', { t01: 'Aviso de privacidad' });
  ok(r.status === 200 && files.get('privacy.html') === original.get('privacy.html').replace('>Privacidad</h1>', '>Aviso de privacidad</h1>'), 'privacidad: cambia solo el título');
  files.set('privacy.html', original.get('privacy.html'));
  const bi = await get('blogIndex');
  r = await save('blogIndex', { t02: 'Texto nuevo del listado' });
  const bix = files.get('blog/index.html');
  ok(r.status === 200 && bix.includes('Texto nuevo del listado') && (bix.match(/<article class="post-card">/g) || []).length === 3, 'blog: cambia el texto y las 3 tarjetas siguen intactas');
  const list = await call('list-posts');
  ok(list.data.posts.length === 3, 'el listado de artículos sigue funcionando con la página marcada');
  files.set('blog/index.html', original.get('blog/index.html'));

  console.log('Resto del sitio');
  ok([...original.keys()].every((k) => files.get(k) === original.get(k)), 'tras las pruebas, todos los archivos vuelven a su estado original');

  console.log(`\n${passed} comprobaciones pasaron.`);
})().catch((e) => { console.error('\n✗ FALLÓ:', e.message); process.exit(1); });
