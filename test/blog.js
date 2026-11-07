// Prueba de punta a punta SIN tocar GitHub de verdad: simula la API de GitHub en
// memoria usando una copia local del repo `landing`, y ejecuta las funciones
// del panel contra ella.
//
// Uso:  node test/blog.js /ruta/al/repo/landing

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const repoDir = process.argv[2];
if (!repoDir) { console.error('Uso: node test/blog.js /ruta/al/repo/landing'); process.exit(1); }

const { install } = require('./mock-github');
const { files, original } = install(repoDir);

process.env.GITHUB_TOKEN = 'token-de-prueba';
process.env.ADMIN_PASSWORD = 'clave-de-prueba';

const call = async (fn, { method = 'GET', query, body, password = 'clave-de-prueba' } = {}) => {
  const res = await require(`../netlify/functions/${fn}.js`).handler({
    httpMethod: method,
    headers: { 'x-admin-password': password },
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.statusCode, data: res.body && res.body.startsWith('{') ? JSON.parse(res.body) : res.body };
};

let passed = 0;
const ok = (cond, label) => { assert.ok(cond, label); passed++; console.log('  ✓ ' + label); };

(async () => {
  console.log('Autenticación');
  ok((await call('list-posts', { password: 'mala' })).status === 401, 'contraseña incorrecta → 401');
  ok((await call('list-posts', { password: '' })).status === 401, 'sin contraseña → 401');

  console.log('Lectura');
  const list = await call('list-posts');
  ok(list.status === 200 && list.data.posts.length === 3, 'list-posts devuelve los 3 artículos existentes');
  const slugs = list.data.posts.map((x) => x.slug);
  ok(slugs.includes('que-ropa-usar-en-una-sesion-de-fotos-familiar'), 'reconoce el slug de cada artículo');
  ok(list.data.posts.every((x) => x.title && x.excerpt && /^https:\/\/res\.cloudinary\.com\/.+\/upload\/v\d+\//.test(x.coverImageUrl)), 'cada tarjeta trae título, resumen y portada limpia (sin f_auto,q_auto,w_600)');

  console.log('Ida y vuelta de los artículos que ya tienes (editar sin cambiar nada)');
  for (const slug of slugs) {
    const g = await call('get-post', { query: { slug } });
    ok(g.status === 200 && g.data.title && g.data.category && g.data.date && g.data.bodyHtml && g.data.ctaText && g.data.waMessage, `get-post lee ${slug}`);
    const before = files.get(`blog/${slug}.html`);
    const beforeIndex = files.get('blog/index.html');
    const r = await call('save-post', { method: 'POST', body: { ...g.data, isEdit: true } });
    ok(r.status === 200, `save-post (edición) responde 200 para ${slug}`);
    const after = files.get(`blog/${slug}.html`);
    const bodyOf = (h) => h.replace(/\s+/g, ' ').match(/post-meta">.*?<\/p>(.*?)<div class="post-cta">/)[1].trim();
    ok(bodyOf(before) === bodyOf(after), `el cuerpo de ${slug} queda idéntico`);
    ok(/<p class="breadcrumb">.*<\/p>/.exec(before)[0] === /<p class="breadcrumb">.*<\/p>/.exec(after)[0], `el breadcrumb de ${slug} queda idéntico`);
    ok(/<div class="post-cta">[\s\S]*?<\/div>/.exec(before)[0] === /<div class="post-cta">[\s\S]*?<\/div>/.exec(after)[0], `el bloque de WhatsApp de ${slug} queda idéntico, ícono incluido`);
    ok(files.get('blog/index.html') === beforeIndex, `la tarjeta de ${slug} se reemplaza en su lugar, sin mover ni cambiar nada`);
  }
  const sm = files.get('sitemap.xml');
  ok((sm.match(/<url>/g) || []).length === (original.get('sitemap.xml').match(/<url>/g) || []).length, 'editar no duplica entradas del sitemap');

  console.log('Artículo nuevo');
  const nuevo = {
    slug: 'prueba-de-articulo-nuevo', title: 'Prueba de artículo "nuevo" & más', category: 'Preparación',
    date: '2026-10-29', metaDescription: 'Descripción de prueba para el artículo nuevo.',
    coverImageUrl: 'https://res.cloudinary.com/dlu6jpw54/image/upload/v1777602313/8_w4eqm7.jpg',
    coverImageAlt: 'Familia en el parque', excerpt: 'Resumen de prueba del artículo.',
    bodyHtml: '<h2>Un subtítulo</h2>\n\n<p>Un párrafo con <strong>negrita</strong> y un <a href="/blog/">link</a>.</p>',
    ctaText: '', waMessage: '', isEdit: false,
  };
  const created = await call('save-post', { method: 'POST', body: nuevo });
  ok(created.status === 200 && created.data.url === 'https://horaazulfotografia.netlify.app/blog/prueba-de-articulo-nuevo.html', 'publica y devuelve la URL pública');
  const html = files.get('blog/prueba-de-articulo-nuevo.html');
  ok(html && html.includes('<title>Prueba de artículo "nuevo" &amp; más | Hora Azul</title>'), 'el título se escapa bien');
  ok(html.includes('<script src="/assets/tracking.js" defer></script>') && html.includes('data-page-blog-post'), 'trae tracking.js y el atributo que dispara VerBlog');
  ok(/"datePublished": "2026-10-29"/.test(html) && /"dateModified"/.test(html), 'trae JSON-LD con fechas');
  const idx = files.get('blog/index.html');
  ok(idx.indexOf('prueba-de-articulo-nuevo') < idx.indexOf('cuanto-cuesta'), 'la tarjeta nueva queda al principio del listado');
  ok(idx.includes('f_auto,q_auto,w_600/v1777602313/8_w4eqm7.jpg'), 'la tarjeta usa la imagen reducida de Cloudinary');
  const sm2 = files.get('sitemap.xml');
  ok(sm2.includes('/blog/prueba-de-articulo-nuevo.html</loc>'), 'se agrega al sitemap');
  const reread = await call('get-post', { query: { slug: 'prueba-de-articulo-nuevo' } });
  ok(reread.data.title === nuevo.title && reread.data.bodyHtml === nuevo.bodyHtml && reread.data.category === 'Preparación', 'se vuelve a leer idéntico (título con comillas y &, cuerpo, categoría)');

  console.log('Protecciones');
  ok((await call('save-post', { method: 'POST', body: nuevo })).status === 409, 'no deja pisar un artículo existente al publicar uno nuevo');
  ok((await call('save-post', { method: 'POST', body: { ...nuevo, slug: 'index' } })).status === 400, 'no deja usar "index" como slug (pisaría blog/index.html)');
  ok((await call('save-post', { method: 'POST', body: { ...nuevo, slug: '../x' } })).status === 400, 'no deja slugs con rutas');
  ok((await call('save-post', { method: 'POST', body: { ...nuevo, slug: 'otro', title: '' } })).status === 400, 'pide los campos obligatorios');
  ok((await call('delete-post', { method: 'POST', body: { slug: 'index' } })).status === 400, 'no deja despublicar "index"');
  ok((await call('save-post', { method: 'POST', body: { ...nuevo, slug: 'no-existe', isEdit: true } })).status === 404, 'editar algo que no existe → 404');

  console.log('Despublicar');
  const del = await call('delete-post', { method: 'POST', body: { slug: 'prueba-de-articulo-nuevo' } });
  ok(del.status === 200 && !files.has('blog/prueba-de-articulo-nuevo.html'), 'borra el archivo del artículo');
  ok(files.get('blog/index.html') === original.get('blog/index.html'), 'blog/index.html vuelve a quedar exactamente como estaba');
  const stripLastmod = (x) => x.replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  ok(stripLastmod(files.get('sitemap.xml')) === stripLastmod(original.get('sitemap.xml')), 'sitemap.xml vuelve a quedar como estaba (salvo fechas)');

  const untouched = [...original.keys()].filter((k) => !k.startsWith('blog/') && k !== 'sitemap.xml');
  ok(untouched.every((k) => files.get(k) === original.get(k)), `el resto de tu sitio (${untouched.length} archivos) no se toca`);

  console.log(`\n${passed} comprobaciones pasaron.`);
})().catch((e) => { console.error('\n✗ FALLÓ:', e.message); process.exit(1); });
