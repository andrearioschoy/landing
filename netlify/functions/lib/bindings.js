// Enlaces entre un dataBlock y el HTML estático de la página.
//
// Idea: el texto de la página sigue escrito en el HTML (así Google y las IAs
// lo leen sin ejecutar JavaScript), pero cada elemento editable lleva una
// marca que dice de qué campo sale su contenido:
//
//   data-t="tHero.titulo"            reemplaza TODO el contenido del elemento
//   data-tx="tHero.boton"            reemplaza solo el texto suelto del elemento
//                                    (para botones con texto + ícono)
//   data-ta="href:tHero.enlace|alt:tHero.alt"
//                                    cambia atributos del elemento
//
// Cuando el panel guarda un bloque, applyBindings() reescribe esos elementos
// en el HTML con los valores nuevos. Todo lo demás del archivo queda intacto.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);

// Recorre el HTML y devuelve la lista de elementos con sus posiciones.
function scan(html) {
  const els = [];
  const stack = [];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!doctype[^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[2] === undefined) continue; // comentario o doctype
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (!closing) {
      const selfClose = /\/\s*$/.test(m[3]) || VOID.has(tag);
      const el = {
        tag, attrs: m[3], start: m.index, openEnd: m.index + m[0].length,
        closeStart: -1, end: m.index + m[0].length,
        parent: stack.length ? stack[stack.length - 1] : -1, children: [],
      };
      const idx = els.push(el) - 1;
      if (el.parent >= 0) els[el.parent].children.push(idx);
      if (selfClose) continue;
      if (RAW.has(tag)) {
        // el contenido de script/style no se interpreta como HTML
        const close = new RegExp('</' + tag + '\\s*>', 'i');
        close.lastIndex = 0;
        const rest = html.slice(el.openEnd);
        const cm = close.exec(rest);
        if (cm) {
          el.closeStart = el.openEnd + cm.index;
          el.end = el.closeStart + cm[0].length;
          re.lastIndex = el.end;
        }
        continue;
      }
      stack.push(idx);
    } else {
      // cierra el último abierto con ese nombre (tolera <p>/<li> sin cerrar)
      let k = stack.length - 1;
      while (k >= 0 && els[stack[k]].tag !== tag) k--;
      if (k < 0) continue;
      const idx = stack[k];
      els[idx].closeStart = m.index;
      els[idx].end = m.index + m[0].length;
      stack.length = k;
    }
  }
  return els;
}

function getAttr(rawAttrs, name) {
  const re = new RegExp('(?:^|\\s)' + name.replace(/[-]/g, '\\-') + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i');
  const m = re.exec(rawAttrs || '');
  return m ? (m[1] !== undefined ? m[1] : m[2]) : null;
}

function escText(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function unescText(s) {
  return String(s)
    .replace(/&nbsp;/g, '\u00a0').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&amp;/g, '&');
}

// ¿El campo guarda HTML (negrita, resaltado, saltos de línea) o texto plano?
function isRawField(f) { return !!(f && (f.rich || f.lineBreaks)); }

// Texto suelto de un elemento: el primer tramo con texto que no está dentro
// de un hijo (por ejemplo "Quiero entrar" en <a>Quiero entrar <svg/></a>).
function textRun(html, els, el) {
  if (el.closeStart < 0) return null;
  let pos = el.openEnd;
  const kids = el.children.map((i) => els[i]).sort((a, b) => a.start - b.start);
  const spans = [];
  kids.forEach((k) => { if (k.start > pos) spans.push([pos, k.start]); pos = Math.max(pos, k.end); });
  if (el.closeStart > pos) spans.push([pos, el.closeStart]);
  for (const [a, b] of spans) {
    if (html.slice(a, b).trim()) {
      const seg = html.slice(a, b);
      const lead = seg.length - seg.trimStart().length;
      const trail = seg.length - seg.trimEnd().length;
      return { start: a + lead, end: b - trail };
    }
  }
  return null;
}

function setAttrInTag(rawTag, name, value) {
  const re = new RegExp('(\\s' + name + '\\s*=\\s*)(?:"[^"]*"|\'[^\']*\')', 'i');
  if (re.test(rawTag)) return rawTag.replace(re, (_, p1) => p1 + '"' + escAttr(value) + '"');
  return rawTag.replace(/(\s*\/?>)$/, ' ' + name + '="' + escAttr(value) + '"$1');
}

// Reescribe en `html` todos los elementos enlazados a `blockKey` con los
// valores de `item`. fields: definición de campos del bloque (para saber cuáles
// guardan HTML).
function applyBindings(html, blockKey, item, fields) {
  const els = scan(html);
  const byKey = {};
  (fields || []).forEach((f) => { byKey[f.key] = f; });
  const prefix = blockKey + '.';
  const edits = [];
  els.forEach((el) => {
    const t = getAttr(el.attrs, 'data-t');
    if (t && t.startsWith(prefix) && el.closeStart >= 0) {
      const key = t.slice(prefix.length);
      if (item[key] !== undefined) {
        const v = isRawField(byKey[key]) ? String(item[key] == null ? '' : item[key]) : escText(item[key]);
        edits.push({ start: el.openEnd, end: el.closeStart, text: v });
      }
    }
    const tx = getAttr(el.attrs, 'data-tx');
    if (tx && tx.startsWith(prefix)) {
      const key = tx.slice(prefix.length);
      const run = textRun(html, els, el);
      if (item[key] !== undefined && run) {
        const v = isRawField(byKey[key]) ? String(item[key]) : escText(item[key]);
        edits.push({ start: run.start, end: run.end, text: v });
      }
    }
    const ta = getAttr(el.attrs, 'data-ta');
    if (ta) {
      let tag = html.slice(el.start, el.openEnd);
      let changed = false;
      ta.split('|').forEach((pair) => {
        const i = pair.indexOf(':');
        if (i < 0) return;
        const attr = pair.slice(0, i).trim();
        const ref = pair.slice(i + 1).trim();
        if (!ref.startsWith(prefix)) return;
        const key = ref.slice(prefix.length);
        if (item[key] === undefined) return;
        tag = setAttrInTag(tag, attr, item[key]);
        changed = true;
      });
      if (changed) edits.push({ start: el.start, end: el.openEnd, text: tag });
    }
  });
  edits.sort((a, b) => b.start - a.start);
  let out = html;
  edits.forEach((e) => { out = out.slice(0, e.start) + e.text + out.slice(e.end); });
  return out;
}

// Lee de un HTML todos los valores enlazados: { bloque: { campo: valor } }.
// Sirve para armar los datos iniciales de cada bloque a partir de la página.
function extractBindings(html, rawKeys) {
  const els = scan(html);
  const out = {};
  const put = (ref, val) => {
    const i = ref.indexOf('.');
    const b = ref.slice(0, i), k = ref.slice(i + 1);
    (out[b] = out[b] || {})[k] = val;
  };
  els.forEach((el) => {
    const t = getAttr(el.attrs, 'data-t');
    if (t && el.closeStart >= 0) {
      const inner = html.slice(el.openEnd, el.closeStart).trim();
      put(t, rawKeys && rawKeys.has(t) ? inner : unescText(inner));
    }
    const tx = getAttr(el.attrs, 'data-tx');
    if (tx) {
      const run = textRun(html, els, el);
      if (run) {
        const inner = html.slice(run.start, run.end);
        put(tx, rawKeys && rawKeys.has(tx) ? inner : unescText(inner));
      }
    }
    const ta = getAttr(el.attrs, 'data-ta');
    if (ta) ta.split('|').forEach((pair) => {
      const i = pair.indexOf(':');
      if (i < 0) return;
      const attr = pair.slice(0, i).trim();
      const v = getAttr(el.attrs, attr);
      if (v !== null) put(pair.slice(i + 1).trim(), unescText(v));
    });
  });
  return out;
}

module.exports = { scan, getAttr, applyBindings, extractBindings, escText, unescText, isRawField, textRun };
