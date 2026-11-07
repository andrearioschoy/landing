// Lee de vuelta lo que ya está publicado: las tarjetas de blog/index.html y
// los artículos. Así el panel siempre refleja lo que el sitio muestra de
// verdad, sin mantener un índice aparte que se pueda desincronizar.

const { unesc, stripTransform } = require('./templates');

const CARD_RE = /<article class="post-card">[\s\S]*?<\/article>/g;

function parseCards(site, html) {
  const cards = [];
  const hrefRe = /href="\/blog\/([^"/]+)\.html"/;
  (html.match(CARD_RE) || []).forEach((block) => {
    const href = hrefRe.exec(block);
    if (!href) return;
    const img = /<img src="([^"]*)"(?:[^>]*?alt="([^"]*)")?/.exec(block) || [];
    cards.push({
      slug: href[1],
      coverImageUrl: stripTransform(unesc(img[1] || '')),
      coverImageAlt: unesc(img[2] || ''),
      title: unesc(((/<h3>([\s\S]*?)<\/h3>/.exec(block) || [])[1] || '').trim()),
      excerpt: unesc(((/<p>([\s\S]*?)<\/p>/.exec(block) || [])[1] || '').trim()),
    });
  });
  return cards;
}

function metaContent(html, attr, name) {
  const re = new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`, 'i');
  const m = re.exec(html);
  return m ? unesc(m[1]) : '';
}

function parsePost(site, html) {
  const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html);
  const title = unesc((h1 ? h1[1] : (/<title>([^<]*)<\/title>/.exec(html) || [, ''])[1].split(' | ')[0]).trim());
  const crumb = /<p class="breadcrumb">[\s\S]*?\/\s*([^<\/]*?)\s*<\/p>/.exec(html);
  const date = (/"datePublished":\s*"([^"]+)"/.exec(html) || [, ''])[1];

  // Cuerpo: entre la línea "Por Andrea…" y el bloque del botón de WhatsApp.
  const start = /<p class="post-meta">[\s\S]*?<\/p>/.exec(html);
  let bodyHtml = '';
  if (start) {
    const from = start.index + start[0].length;
    const rest = html.slice(from);
    const cta = /<div class="post-cta">/.exec(rest);
    const endMain = /<\/div>\s*<\/main>/.exec(rest);
    const to = cta ? cta.index : endMain ? endMain.index : rest.length;
    bodyHtml = rest.slice(0, to).split('\n').map((l) => l.replace(/^ {4}/, '')).join('\n').trim();
  }

  const ctaBlock = /<div class="post-cta">\s*<p>([\s\S]*?)<\/p>\s*<a class="btn-wa" href="([^"]*)"/.exec(html);
  let waMessage = '';
  if (ctaBlock) {
    const t = /[?&]text=([^&"]*)/.exec(ctaBlock[2]);
    try { waMessage = t ? decodeURIComponent(t[1]) : ''; } catch (e) { waMessage = ''; }
  }

  return {
    title,
    metaDescription: metaContent(html, 'name', 'description'),
    excerpt: metaContent(html, 'property', 'og:description'),
    date,
    category: crumb ? unesc(crumb[1].trim()) : '',
    bodyHtml,
    ctaText: ctaBlock ? unesc(ctaBlock[1].trim()) : '',
    waMessage,
  };
}

module.exports = { parseCards, parsePost, CARD_RE };
