const { getSite } = require('./lib/config');
const { getFile, commitChanges } = require('./lib/github');
const { upsertBlogCard, upsertSitemapEntry } = require('./lib/compose');
const { buildPostHtml, buildCardHtml, buildSitemapEntry } = require('./lib/templates');
const { SLUG_RE, RESERVED } = require('./lib/slug');
const { checkAuth } = require('./lib/auth');

const REQUIRED = ['slug', 'title', 'metaDescription', 'category', 'date', 'coverImageUrl', 'coverImageAlt', 'excerpt', 'bodyHtml'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (code, msg) => ({ statusCode: code, body: JSON.stringify({ error: msg }) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = checkAuth(event);
  if (!auth.ok) return fail(auth.statusCode, auth.error);

  try {
    const post = JSON.parse(event.body || '{}');
    for (const field of REQUIRED) {
      if (!post[field] || !String(post[field]).trim()) return fail(400, `Falta el campo "${field}"`);
    }
    if (!SLUG_RE.test(post.slug) || RESERVED.has(post.slug)) {
      return fail(400, 'El slug solo puede tener minúsculas, números y guiones (sin espacios ni tildes), y no puede ser "index"');
    }
    if (!DATE_RE.test(post.date)) return fail(400, 'La fecha no tiene el formato correcto');
    if (!/^https:\/\//.test(post.coverImageUrl)) return fail(400, 'La imagen de portada tiene que ser una URL que empiece con https://');

    const site = getSite();
    const today = new Date().toISOString().slice(0, 10);
    post.dateModified = today;

    const [blogIndex, sitemap, existing] = await Promise.all([
      getFile(site, site.blogIndexPath),
      getFile(site, site.sitemapPath),
      getFile(site, site.postPath(post.slug)),
    ]);
    if (!blogIndex || !sitemap) return fail(500, 'No se pudo leer blog/index.html o sitemap.xml del repo');
    if (existing && !post.isEdit) return fail(409, `Ya existe un artículo con el slug "${post.slug}". Cambia el slug o edita el que ya está publicado.`);
    if (!existing && post.isEdit) return fail(404, 'El artículo que intentas editar ya no existe');

    const newBlogIndex = upsertBlogCard(site, blogIndex.content, post.slug, buildCardHtml(site, post));
    const newSitemap = upsertSitemapEntry(site, sitemap.content, post.slug, buildSitemapEntry(site, post), today);

    const { commitSha, commitUrl } = await commitChanges(
      site,
      {
        files: [
          { path: site.postPath(post.slug), content: buildPostHtml(site, post) },
          { path: site.blogIndexPath, content: newBlogIndex },
          { path: site.sitemapPath, content: newSitemap },
        ],
      },
      `${post.isEdit ? 'Edita' : 'Publica'} artículo: ${post.title}`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, url: `https://${site.domain}${site.postUrlPath(post.slug)}`, commitSha, commitUrl }),
    };
  } catch (e) {
    return fail(500, e.message);
  }
};
