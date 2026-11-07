// Arma el HTML de cada pieza (artículo, tarjeta del listado, entrada de
// sitemap) reproduciendo la estructura que ya usan tus artículos en /blog/.
// El cuerpo (post.bodyHtml) llega armado desde el panel; aquí se automatiza
// lo que siempre es igual: head, header, breadcrumb, CTA, footer y tracking.

function escText(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return escText(s).replace(/"/g, '&quot;');
}
function unesc(s) {
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'").replace(/&amp;/g, '&');
}

// Cloudinary: agrega o quita el tramo de transformaciones (f_auto,q_auto,w_600…)
// que va entre /upload/ y la versión (v123…). Otras URLs quedan tal cual.
const CLD = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;
const TRANSFORM_SEG = /^[a-z]{1,3}_[^/,]*(,[a-z]{1,3}_[^/,]*)*$/;

// Separa una URL de Cloudinary en: prefijo, transformaciones y el resto (versión + archivo).
function splitCloudinary(url) {
  const m = CLD.exec(url || '');
  if (!m) return null;
  const segs = m[2].split('/');
  const v = segs.findIndex((s) => /^v\d+$/.test(s));
  let n = v >= 0 ? v : 0;
  if (v < 0) while (n < segs.length - 1 && TRANSFORM_SEG.test(segs[n])) n++;
  return { prefix: m[1], transforms: segs.slice(0, n), rest: segs.slice(n).join('/') };
}
function stripTransform(url) {
  const c = splitCloudinary(url);
  return c ? c.prefix + c.rest : url || '';
}
function withTransform(url, transform) {
  const c = splitCloudinary(url);
  if (!c) return url || '';
  return c.prefix + (transform ? transform + '/' : '') + c.rest;
}

const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

function indent(html, spaces) {
  const pad = ' '.repeat(spaces);
  return String(html || '').trim().split('\n').map((l) => (l.trim() ? pad + l : l)).join('\n');
}

function whatsappHref(site, message) {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message || site.defaultWaMessage)}`;
}

function buildPostHtml(site, post) {
  const url = `https://${site.domain}${site.postUrlPath(post.slug)}`;
  const ogImage = withTransform(post.coverImageUrl, site.ogImgTransform) || site.logoUrl;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription,
    author: { '@type': 'Person', name: site.author },
    publisher: { '@type': 'Organization', name: site.brandFull },
    datePublished: post.date,
    dateModified: post.dateModified || post.date,
    image: ogImage,
    mainEntityOfPage: url,
  }, null, 2).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escText(post.title)} | ${site.brand}</title>
<meta name="description" content="${escAttr(post.metaDescription)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${escAttr(post.title)}">
<meta property="og:description" content="${escAttr(post.excerpt)}">
<meta property="og:image" content="${escAttr(ogImage)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<link rel="icon" href="${site.faviconUrl}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${site.fontsHref}" rel="stylesheet">
<link rel="stylesheet" href="/assets/global.css">
<script type="application/ld+json">
${jsonLd}
</script>
</head>
<body data-page-blog-post>
<header class="site-header">
  <a href="/" aria-label="Ir al inicio">
    <img class="logo" src="${site.logoHeaderUrl}" alt="${site.brandFull} — logo">
  </a>
</header>
<main class="section">
  <div class="wrap post-body">
    <p class="breadcrumb"><a href="/">Inicio</a> / <a href="/blog/">Blog</a> / ${escText(post.category)}</p>
    <h1>${escText(post.title)}</h1>
    <p class="post-meta">Por ${site.author} · ${site.authorLine}</p>

${indent(post.bodyHtml, 4)}

    <div class="post-cta">
      <p>${escText(post.ctaText || site.defaultCtaText)}</p>
      <a class="btn-wa" href="${whatsappHref(site, post.waMessage)}" target="_blank" rel="noopener noreferrer">
        ${WA_ICON}
        Escríbeme por WhatsApp
      </a>
    </div>
  </div>
</main>
<footer>
  <p>${site.brandFull} · ${site.author} · Ciudad de México</p>
  <p><a href="/">Inicio</a> · <a href="/blog/">Blog</a></p>
</footer>
<script src="/assets/tracking.js" defer></script>
</body>
</html>
`;
}

function buildCardHtml(site, post) {
  return `      <article class="post-card">
        <img src="${escAttr(withTransform(post.coverImageUrl, site.cardImgTransform))}" alt="${escAttr(post.coverImageAlt)}" loading="lazy">
        <div class="post-card-body">
          <h3>${escText(post.title)}</h3>
          <p>${escText(post.excerpt)}</p>
          <a href="${site.postUrlPath(post.slug)}">Leer artículo →</a>
        </div>
      </article>`;
}

function buildSitemapEntry(site, post) {
  const lastmod = post.dateModified || post.date;
  return `  <url><loc>https://${site.domain}${site.postUrlPath(post.slug)}</loc><lastmod>${lastmod}</lastmod><priority>0.7</priority></url>`;
}

module.exports = {
  buildPostHtml, buildCardHtml, buildSitemapEntry,
  escText, escAttr, unesc, stripTransform, withTransform, splitCloudinary, whatsappHref,
};
