#!/usr/bin/env node
// Marca una página HTML para que el panel pueda editarla.
// Agrega data-t / data-tx / data-ta a cada texto, enlace e imagen y escribe la
// definición del bloque (campos) en un JSON. No cambia cómo se ve la página:
// solo suma atributos. Uso:
//   node tools/marcar-pagina.js <carpeta-del-sitio> <ruta-de-la-página> <clave> "<etiqueta>" <salida.json>
const fs = require('fs');
const path = require('path');
const { scan, getAttr, unescText } = require('../netlify/functions/lib/bindings');

const [, , siteDir, pagePath, key, label, outJson, skipClassesArg] = process.argv;
const SKIP_CLASSES = new Set((skipClassesArg || '').split(',').map((x) => x.trim()).filter(Boolean));
if (!outJson) { console.error('Faltan argumentos'); process.exit(1); }
const file = path.join(siteDir, pagePath);
let html = fs.readFileSync(file, 'utf8');
if (/data-t=|data-tx=/.test(html)) { console.error('La página ya tiene marcas: ' + pagePath); process.exit(2); }

const els = scan(html);
const bodyAt = html.search(/<body[\s>]/i);
const INLINE = new Set(['b', 'strong', 'i', 'em', 'mark', 'br', 'span', 'u', 'small', 'sup', 'sub', 'a', 's']);
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'path', 'head', 'title', 'meta', 'link', 'option', 'select', 'textarea', 'code', 'pre', 'template', 'iframe', 'canvas', 'button-dynamic']);

// ids que el JavaScript de la página usa (se reescriben solos, no se marcan)
const scripts = els.filter((e) => e.tag === 'script' && e.closeStart >= 0).map((e) => html.slice(e.openEnd, e.closeStart)).join('\n');
const dyn = new Set();
let m;
const r1 = /getElementById\(\s*['"`]([^'"`]+)['"`]/g; while ((m = r1.exec(scripts))) dyn.add(m[1]);
const r2 = /querySelector(?:All)?\(\s*['"`]([^'"`]+)['"`]/g;
while ((m = r2.exec(scripts))) { (m[1].match(/#[A-Za-z][\w-]*/g) || []).forEach((x) => dyn.add(x.slice(1))); }
const r3 = /\$\(\s*['"`]#([A-Za-z][\w-]*)/g; while ((m = r3.exec(scripts))) dyn.add(m[1]);

function isDynamic(i) {
  let p = i;
  while (p >= 0) {
    const e = els[p];
    const id = getAttr(e.attrs, 'id');
    if (id && dyn.has(id)) return true;
    if (SKIP_TAGS.has(e.tag)) return true;
    if (/\saria-live=|\scontenteditable|\sdata-cms-skip|\sdata-list=/i.test(e.attrs)) return true;
    if (SKIP_CLASSES.size && (getAttr(e.attrs, 'class') || '').split(/\s+/).some((c) => SKIP_CLASSES.has(c))) return true;
    p = e.parent;
  }
  return false;
}

function sectionOf(i) {
  let p = i, found = null;
  while (p >= 0) {
    const e = els[p];
    if (['header', 'nav', 'section', 'footer', 'main', 'form'].includes(e.tag) || (e.tag === 'div' && getAttr(e.attrs, 'id'))) {
      const id = getAttr(e.attrs, 'id');
      const cls = (getAttr(e.attrs, 'class') || '').split(/\s+/)[0];
      found = { tag: e.tag, id, cls, aria: getAttr(e.attrs, 'aria-label') };
      if (e.tag !== 'div') break;
    }
    p = e.parent;
  }
  if (!found) return 'Página';
  const names = { header: 'Encabezado', nav: 'Menú', footer: 'Pie de página', main: 'Contenido', form: 'Formulario' };
  if (names[found.tag]) return names[found.tag];
  if (found.aria) return found.aria;
  const nice = (found.id || found.cls || 'sección').replace(/[-_]+/g, ' ');
  return 'Sección: ' + nice;
}

const KIND = { h1: 'Título principal', h2: 'Título', h3: 'Subtítulo', h4: 'Subtítulo', h5: 'Subtítulo', h6: 'Subtítulo', p: 'Párrafo', li: 'Elemento de lista', a: 'Botón o enlace', button: 'Botón', label: 'Etiqueta', figcaption: 'Pie de foto', blockquote: 'Cita', th: 'Encabezado de tabla', td: 'Celda', dt: 'Término', dd: 'Definición', summary: 'Pregunta desplegable' };
const counters = {};
const fields = [];
const inserts = [];
let usesMark = false;

function snippet(s) {
  const t = unescText(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return t.length > 42 ? t.slice(0, 40) + '…' : t;
}
const addAttr = (el, attr) => inserts.push({ at: el.openEnd - (/\/\s*>$/.test(html.slice(el.start, el.openEnd)) ? html.slice(el.start, el.openEnd).match(/\/\s*>$/)[0].length : 1), text: ' ' + attr });
let n = 0;
let nImg = 0;

els.forEach((el, i) => {
  if (el.start < bodyAt) return;
  if (isDynamic(i)) return;
  if (getAttr(el.attrs, 'data-t') || getAttr(el.attrs, 'data-tx') || getAttr(el.attrs, 'data-ta')) return;
  const section = sectionOf(i);

  if (el.tag === 'img') {
    const src = getAttr(el.attrs, 'src');
    if (!src || /facebook\.com\/tr|pixel|data:image/.test(src)) return;
    nImg++;
    const k = 'i' + nImg;
    fields.push({ key: k + '_src', label: 'Imagen ' + nImg + ': ' + snippet(getAttr(el.attrs, 'alt') || src.split('/').pop()), image: true, section });
    fields.push({ key: k + '_alt', label: 'Texto alternativo de la imagen ' + nImg, section });
    addAttr(el, 'data-ta="src:' + key + '.' + k + '_src|alt:' + key + '.' + k + '_alt"');
    return;
  }
  if (el.closeStart < 0) return;

  // contenido propio del elemento
  const inner = html.slice(el.openEnd, el.closeStart);
  const kids = el.children.map((c) => els[c]);
  const hasBlockKid = kids.some((k) => !INLINE.has(k.tag) || (k.tag === 'a' && k.children.length && k.children.some((g) => !INLINE.has(els[g].tag))));
  const hasSvgKid = kids.some((k) => k.tag === 'svg' || k.tag === 'img');
  const plain = inner.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, ' ').trim();
  if (!/[A-Za-zÁÉÍÓÚáéíóúñÑ]{2}/.test(plain)) return;

  // texto propio del elemento (fuera de sus hijos)
  const own = []; { let pos0 = el.openEnd; kids.slice().sort((a, b) => a.start - b.start).forEach((k) => { if (k.start > pos0) own.push(html.slice(pos0, k.start)); pos0 = Math.max(pos0, k.end); }); if (el.closeStart > pos0) own.push(html.slice(pos0, el.closeStart)); }
  const hasOwnText = own.some((d) => /[A-Za-zÁÉÍÓÚáéíóúñÑ]{2}/.test(d.replace(/&[a-z#0-9]+;/g, ' ')));
  if (kids.length && !hasOwnText) return; // el texto está en los hijos: se marcan ellos
  let mode = null;
  if (!kids.length) mode = 't';
  else if (!hasBlockKid && !hasSvgKid && !kids.some((k) => getAttr(k.attrs, 'id') && dyn.has(getAttr(k.attrs, 'id')))) mode = 'rich';
  else if (!hasBlockKid || hasSvgKid) {
    // texto suelto junto a un ícono
    const direct = []; let pos = el.openEnd;
    kids.slice().sort((a, b) => a.start - b.start).forEach((k) => { if (k.start > pos) direct.push(html.slice(pos, k.start)); pos = Math.max(pos, k.end); });
    if (el.closeStart > pos) direct.push(html.slice(pos, el.closeStart));
    if (direct.some((d) => /[A-Za-zÁÉÍÓÚáéíóúñÑ]{2}/.test(d.replace(/&[a-z#0-9]+;/g, ' ')))) mode = 'tx';
  }
  if (!mode) {
    // elementos con hijos de bloque: solo si tienen texto propio, que se resuelve en sus hijos
    return;
  }
  // un contenedor inline cuyo padre ya se marca como rico no se marca dos veces
  let anc = el.parent, covered = false;
  while (anc >= 0) { if (inserts.some((x) => x.el === els[anc] && x.mode === 'rich')) { covered = true; break; } anc = els[anc].parent; }
  if (covered) return;

  const tag = el.tag;
  const kind = KIND[tag] || (tag === 'span' || tag === 'small' || tag === 'div' ? 'Texto' : 'Texto');
  counters[kind] = (counters[kind] || 0) + 1;
  n++;
  const k = 't' + String(n).padStart(2, '0');
  const f = { key: k, label: kind + ' ' + counters[kind] + ' · «' + snippet(inner) + '»', section };
  if (mode === 'rich') {
    if (/<mark/i.test(inner)) usesMark = true;
    f.rich = true;
    if (/<br/i.test(inner)) f.lineBreaks = true;
  }
  if (plain.length > 90) f.long = true;
  fields.push(f);
  const attr = (mode === 'tx' ? 'data-tx' : 'data-t') + '="' + key + '.' + k + '"';
  let extra = '';
  if (tag === 'a') {
    const href = getAttr(el.attrs, 'href');
    if (href && !/^(#|javascript:|tel:|mailto:)/i.test(href)) {
      const hk = 'h' + n;
      fields.push({ key: hk, label: 'Enlace de: ' + snippet(inner), section, link: true, hint: 'Dirección a la que lleva este botón.' });
      extra = ' data-ta="href:' + key + '.' + hk + '"';
    }
  }
  inserts.push({ el, mode, at: el.openEnd - 1 - (/\/\s*>$/.test(html.slice(el.start, el.openEnd)) ? 1 : 0), text: ' ' + attr + extra });
});

// SEO: título de la pestaña y descripción
const head = [];
els.forEach((el) => {
  if (el.tag === 'title' && el.closeStart >= 0 && el.start < bodyAt) {
    fields.unshift({ key: 'seoTitle', label: 'Título de la pestaña y de Google', section: 'Google y redes' });
    inserts.push({ el, mode: 'seo', at: el.openEnd - 1, text: ' data-t="' + key + '.seoTitle"' });
  }
  if (el.tag === 'meta' && /name\s*=\s*["']description["']/i.test(el.attrs) && el.start < bodyAt) {
    fields.splice(1, 0, { key: 'seoDesc', label: 'Descripción para Google', long: true, section: 'Google y redes' });
    inserts.push({ el, mode: 'seo', at: el.openEnd - 1 - (/\/\s*>$/.test(html.slice(el.start, el.openEnd)) ? 1 : 0), text: ' data-ta="content:' + key + '.seoDesc"' });
  }
});

inserts.sort((a, b) => b.at - a.at);
inserts.forEach((x) => { html = html.slice(0, x.at) + x.text + html.slice(x.at); });
fs.writeFileSync(file, html);

const block = { key, label, path: pagePath.replace(/\\/g, '/'), bind: key, singleton: true, fixedRows: true, livePath: '/' + pagePath.replace(/index\.html$/, ''), fields };
if (usesMark) block.richStyles = [{ label: '★ Resaltado dorado', tag: 'mark' }];
fs.writeFileSync(outJson, JSON.stringify(block, null, 1));
console.log(pagePath + ': ' + fields.length + ' campos (' + n + ' textos, ' + nImg + ' imágenes)');
