// Inserta, reemplaza o quita la tarjeta de un artículo en blog/index.html y su
// entrada en sitemap.xml, dejando todo lo demás del archivo intacto.
// Si el artículo ya existía (edición) se reemplaza en su lugar, así no cambia
// de posición ni queda duplicado. Si es nuevo, entra al principio del listado.

const { CARD_RE } = require('./parse');

function hasSlug(block, site, slug) {
  return block.includes(`href="${site.postUrlPath(slug)}"`);
}

function upsertBlogCard(site, blogIndexHtml, slug, cardHtml) {
  let replaced = false;
  const out = blogIndexHtml.replace(CARD_RE, (block) => {
    if (!hasSlug(block, site, slug)) return block;
    replaced = true;
    return cardHtml.trim();
  });
  if (replaced) return out;

  const i = out.indexOf(site.cardAnchor);
  if (i === -1) {
    throw new Error(`No se encontró el marcador "${site.cardAnchor}" en ${site.blogIndexPath}. Revisa si cambió la estructura del archivo.`);
  }
  const at = i + site.cardAnchor.length;
  return out.slice(0, at) + '\n' + cardHtml + out.slice(at);
}

function removeCard(site, blogIndexHtml, slug) {
  return blogIndexHtml.replace(CARD_RE, (block) => (hasSlug(block, site, slug) ? '' : block))
    .replace(/(<div class="post-grid">)\s*\n(\s*\n)+/, '$1\n');
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function urlRegex(site, slug) {
  return new RegExp(`[ \\t]*<url>\\s*<loc>https://${reEsc(site.domain)}${reEsc(site.postUrlPath(slug))}</loc>[\\s\\S]*?</url>[ \\t]*\\n?`);
}

function bumpBlogLastmod(site, xml, today) {
  const re = new RegExp(`(<loc>https://${reEsc(site.domain)}/blog/</loc><lastmod>)[^<]*(</lastmod>)`);
  return xml.replace(re, `$1${today}$2`);
}

function upsertSitemapEntry(site, sitemapXml, slug, entryXml, today) {
  const re = urlRegex(site, slug);
  let xml;
  if (re.test(sitemapXml)) {
    xml = sitemapXml.replace(re, entryXml + '\n');
  } else {
    // Nuevo: justo debajo de la entrada de /blog/, si existe; si no, antes de </urlset>.
    const blogLine = new RegExp(`[ \\t]*<url>\\s*<loc>https://${reEsc(site.domain)}/blog/</loc>[\\s\\S]*?</url>[ \\t]*\\n`);
    const m = blogLine.exec(sitemapXml);
    if (m) {
      const at = m.index + m[0].length;
      xml = sitemapXml.slice(0, at) + entryXml + '\n' + sitemapXml.slice(at);
    } else {
      const end = sitemapXml.lastIndexOf('</urlset>');
      if (end === -1) throw new Error('No se encontró </urlset> en sitemap.xml. Revisa si cambió la estructura del archivo.');
      xml = sitemapXml.slice(0, end) + entryXml + '\n' + sitemapXml.slice(end);
    }
  }
  return bumpBlogLastmod(site, xml, today);
}

function removeSitemapEntry(site, sitemapXml, slug, today) {
  return bumpBlogLastmod(site, sitemapXml.replace(urlRegex(site, slug), ''), today);
}

module.exports = { upsertBlogCard, removeCard, upsertSitemapEntry, removeSitemapEntry };
