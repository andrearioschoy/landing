// Lectura y escritura de los textos, enlaces, imágenes y listas de las páginas.
//
// Cada página lleva marcas (data-t / data-tx / data-ta) puestas con
// tools/marcar-pagina.js. Este archivo lee esos valores para mostrarlos en el
// panel y, al guardar, reescribe SOLO lo que cambió: el resto del HTML queda
// byte por byte igual. Si no cambias nada, no se hace ningún commit.

const { scan, getAttr, applyBindings, extractBindings, escText, unescText } = require('./bindings');
const { splitCloudinary, stripTransform, withTransform, escAttr } = require('./templates');
const DATA = require('./page-blocks.json');

const BLOCKS = {};
DATA.blocks.forEach((b) => { BLOCKS[b.key] = b; });

const isRaw = (f) => !!(f && (f.rich || f.lineBreaks));
const rawSet = (block) => new Set(block.fields.filter(isRaw).map((f) => `${block.bind}.${f.key}`));

const SAFE_LINK = /^(https?:\/\/|\/|#|tel:|mailto:)/i;
const SAFE_IMG = /^(https:\/\/|\/)/i;

// ───────────────────────── Listas (carruseles) ─────────────────────────
// Un carrusel es un contenedor con data-list="nombre" cuyos hijos se repiten.
const LISTS = {
  gallery: {
    label: 'Portafolio · fotos del carrusel',
    help: 'Cada foto del carrusel de "Momentos que sí se quedan". Arrastra con las flechas para cambiar el orden.',
    transform: 'f_auto,q_auto,w_700',
    re: /<img class="carousel-photo" src="([^"]*)" alt="([^"]*)"[^>]*>/g,
    render: (src, alt) => `<img class="carousel-photo" src="${escAttr(src)}" alt="${escAttr(alt)}" loading="lazy" role="listitem">`,
    max: 60,
  },
  testimonials: {
    label: 'Testimonios · capturas de reseñas',
    help: 'Cada captura de reseña del carrusel de testimonios.',
    transform: 'f_auto,q_auto,w_600',
    re: /<div class="testimonial-slide"[^>]*><img src="([^"]*)" alt="([^"]*)"[^>]*><\/div>/g,
    render: (src, alt) => `<div class="testimonial-slide" role="listitem"><img src="${escAttr(src)}" alt="${escAttr(alt)}" loading="lazy"></div>`,
    max: 60,
  },
};

function findList(html, key) {
  const el = scan(html).find((e) => getAttr(e.attrs, 'data-list') === key && e.closeStart >= 0);
  return el || null;
}

function readList(html, key) {
  const def = LISTS[key];
  const el = findList(html, key);
  if (!def || !el) return null;
  const inner = html.slice(el.openEnd, el.closeStart);
  const re = new RegExp(def.re.source, 'g');
  const items = [];
  let m;
  while ((m = re.exec(inner))) items.push({ src: unescText(m[1]), alt: unescText(m[2]) });
  return { el, inner, items };
}

function cleanListItems(def, items) {
  if (!Array.isArray(items)) throw new Error('La lista de fotos no tiene el formato correcto');
  if (items.length < 1) throw new Error(`"${def.label}" necesita al menos una foto`);
  if (items.length > def.max) throw new Error(`"${def.label}" admite hasta ${def.max} fotos`);
  return items.map((it, i) => {
    const src = String((it && it.src) || '').trim();
    const alt = String((it && it.alt) || '').replace(/\s+/g, ' ').trim();
    if (!SAFE_IMG.test(src)) throw new Error(`${def.label}, foto ${i + 1}: la dirección de la imagen tiene que empezar con https://`);
    const c = splitCloudinary(src);
    return { src: c && c.transforms.length === 0 ? withTransform(src, def.transform) : src, alt };
  });
}

function applyList(html, key, items) {
  const def = LISTS[key];
  const cur = readList(html, key);
  if (!def || !cur) throw new Error(`No se encontró la lista "${key}" en la página`);
  const next = cleanListItems(def, items);
  const same = next.length === cur.items.length && next.every((n, i) => n.src === cur.items[i].src && n.alt === cur.items[i].alt);
  if (same) return html;
  const lead = (cur.inner.match(/^\s*/) || [''])[0];
  const trail = (cur.inner.match(/\s*$/) || [''])[0];
  const inner = lead + next.map((n) => def.render(n.src, n.alt)).join(lead) + trail;
  return html.slice(0, cur.el.openEnd) + inner + html.slice(cur.el.closeStart);
}

// ───────────────────────── Campos con formato ─────────────────────────

function rawMode(raw) {
  const tags = String(raw).match(/<\/?[a-zA-Z][^>]*>/g) || [];
  return tags.every((t) => /^<br\s*\/?>$/i.test(t)) ? 'lines' : 'html';
}
const toLines = (raw) => String(raw).split(/<br\s*\/?>/i).map((s) => unescText(s).replace(/\s+/g, ' ').trim());
const splitLines = (v) => String(v).replace(/\s+$/, '').split(/\r?\n/).map((s) => s.replace(/\s+/g, ' ').trim());
const sameArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Reconstruye los renglones respetando la sangría original del HTML.
function rebuildLines(origRaw, lines) {
  const lead = (origRaw.match(/^\s*/) || [''])[0];
  const trail = (origRaw.match(/\s*$/) || [''])[0];
  const indent = lead.includes('\n') ? lead.slice(lead.lastIndexOf('\n')) : '';
  return lead + lines.map(escText).join('<br>' + indent) + trail;
}

// Para campos con enlaces o negritas: solo se permiten estas etiquetas.
const ALLOWED_TAGS = new Set(['br', 'strong', 'b', 'em', 'i', 'mark', 'a']);
function sanitizeHtml(html) {
  const out = [];
  let last = 0;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  const text = (s) => s.replace(/<|>/g, (c) => (c === '<' ? '&lt;' : '&gt;')).replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
  let m;
  while ((m = re.exec(html))) {
    out.push(text(html.slice(last, m.index)));
    last = m.index + m[0].length;
    const tag = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) { out.push(text(m[0])); continue; }
    if (m[1]) { out.push(tag === 'br' ? '' : `</${tag}>`); continue; }
    if (tag === 'a') {
      const href = getAttr(m[3], 'href');
      out.push(href && SAFE_LINK.test(href.trim()) ? `<a href="${escAttr(href.trim())}">` : '<a>');
    } else out.push(tag === 'br' ? '<br>' : `<${tag}>`);
  }
  out.push(text(html.slice(last)));
  return out.join('');
}

// ───────────────────────── Imágenes de Cloudinary ─────────────────────────
// En el panel se ve la URL limpia; al guardar se vuelve a poner la versión
// reducida que ya usaba esa imagen (f_auto,q_auto,w_600…).
function keepTransform(newUrl, currentUrl) {
  const n = splitCloudinary(newUrl);
  const c = splitCloudinary(currentUrl);
  if (n && n.transforms.length === 0 && c && c.transforms.length) return withTransform(newUrl, c.transforms.join('/'));
  return newUrl;
}

// El hero tiene srcset: se regenera solo desde la imagen principal.
function syncSrcset(html) {
  return html.replace(/<img\b[^>]*\bdata-srcset-widths="[^"]*"[^>]*>/g, (tag) => {
    const src = getAttr(tag, 'src');
    const srcset = getAttr(tag, 'srcset');
    const c = splitCloudinary(src);
    if (!src || !srcset || !c) return tag;
    const T = c.transforms.join('/');
    const next = srcset.replace(/(\S+)(\s+)(\d+)w/g, (all, u, ws, w) => {
      const t = /w_\d+/.test(T) ? T.replace(/w_\d+/, 'w_' + w) : (T ? T + ',' : '') + 'w_' + w;
      return c.prefix + t + '/' + c.rest + ws + w + 'w';
    });
    return next === srcset ? tag : tag.replace(srcset, next);
  });
}

// El marcado estructurado de la Home sigue lo que editas (descripción e imagen).
function syncJsonLd(html, block, update) {
  const spec = block.jsonld;
  if (!spec) return html;
  const touchedDesc = spec.descriptionFrom && update[spec.descriptionFrom] !== undefined;
  const touchedImg = spec.imageFrom && update[spec.imageFrom] !== undefined;
  if (!touchedDesc && !touchedImg) return html;
  let done = false;
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (all, body) => {
    if (done || !body.includes('"ProfessionalService"')) return all;
    done = true;
    const o = JSON.parse(body);
    if (touchedDesc) o.description = update[spec.descriptionFrom];
    if (touchedImg) o.image = update[spec.imageFrom];
    return '<script type="application/ld+json">\n' + JSON.stringify(o, null, 2).replace(/</g, '\\u003c') + '\n</script>';
  });
}

// ───────────────────────── Leer ─────────────────────────

function getBlock(key) {
  const b = BLOCKS[key];
  if (!b) throw new Error('Página desconocida');
  return b;
}

// Contenido interno de los campos con formato, sin recortar espacios (la sangría
// original se reutiliza al reescribir).
function rawInners(html, block) {
  const out = {};
  const prefix = block.bind + '.';
  const want = new Set(block.fields.filter(isRaw).map((f) => f.key));
  scan(html).forEach((el) => {
    const t = getAttr(el.attrs, 'data-t');
    if (t && t.startsWith(prefix) && el.closeStart >= 0 && want.has(t.slice(prefix.length))) {
      out[t.slice(prefix.length)] = html.slice(el.openEnd, el.closeStart);
    }
  });
  return out;
}

function readPage(html, block) {
  const found = extractBindings(html, rawSet(block))[block.bind] || {};
  const values = {};
  const modes = {};
  block.fields.forEach((f) => {
    let v = found[f.key] !== undefined ? found[f.key] : '';
    if (isRaw(f)) {
      modes[f.key] = rawMode(v);
      v = modes[f.key] === 'lines' ? toLines(v).join('\n') : String(v).trim();
    } else if (f.image) {
      v = stripTransform(v);
    }
    values[f.key] = v;
  });
  const lists = {};
  (block.lists || []).forEach((k) => {
    const l = readList(html, k);
    if (l) lists[k] = { label: LISTS[k].label, help: LISTS[k].help, items: l.items.map((i) => ({ src: stripTransform(i.src), alt: i.alt })) };
  });
  return { values, modes, lists };
}

// ───────────────────────── Guardar ─────────────────────────

function savePage(html, block, input) {
  const found = extractBindings(html, rawSet(block))[block.bind] || {};
  Object.assign(found, rawInners(html, block));
  const update = {};
  const known = new Set(block.fields.map((f) => f.key));
  Object.keys(input.values || {}).forEach((k) => { if (!known.has(k)) throw new Error(`Campo desconocido: ${k}`); });

  block.fields.forEach((f) => {
    if (!input.values || !(f.key in input.values)) return;
    const v = input.values[f.key];
    if (typeof v !== 'string') throw new Error(`El campo "${f.label}" no tiene el formato correcto`);
    const cur = found[f.key] !== undefined ? found[f.key] : '';

    if (isRaw(f)) {
      if (rawMode(cur) === 'lines') {
        const next = splitLines(v);
        if (sameArr(next, toLines(cur))) return;
        update[f.key] = rebuildLines(cur, next);
      } else {
        if (v.trim() === String(cur).trim()) return;
        const lead = (cur.match(/^\s*/) || [''])[0];
        const trail = (cur.match(/\s*$/) || [''])[0];
        update[f.key] = lead + sanitizeHtml(v.trim()) + trail;
      }
    } else if (f.image) {
      const t = v.trim();
      if (!SAFE_IMG.test(t)) throw new Error(`"${f.label}": la dirección de la imagen tiene que empezar con https://`);
      const next = keepTransform(t, cur);
      if (next !== cur) update[f.key] = next;
    } else if (f.link) {
      const t = v.trim();
      if (!SAFE_LINK.test(t)) throw new Error(`"${f.label}": la dirección tiene que empezar con https://, tel:, mailto: o #`);
      if (t !== cur) update[f.key] = t;
    } else {
      const t = v.replace(/\s*\r?\n\s*/g, ' ').trim();
      if (t !== String(cur).trim()) update[f.key] = t;
    }
  });

  let out = Object.keys(update).length ? applyBindings(html, block.bind, update, block.fields) : html;
  Object.keys(input.lists || {}).forEach((k) => {
    if (!(block.lists || []).includes(k)) throw new Error(`Lista desconocida: ${k}`);
    out = applyList(out, k, input.lists[k]);
  });
  if (Object.keys(update).length) {
    out = syncSrcset(out);
    out = syncJsonLd(out, block, update);
  }
  return { html: out, changed: Object.keys(update), htmlChanged: out !== html };
}

function menu() {
  return DATA.menu;
}

module.exports = { BLOCKS, LISTS, getBlock, readPage, savePage, menu, sanitizeHtml, rebuildLines, rawMode };
