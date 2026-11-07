const { getSite } = require('./lib/config');
const { getFile, commitChanges } = require('./lib/github');
const { removeCard, removeSitemapEntry } = require('./lib/compose');
const { SLUG_RE, RESERVED } = require('./lib/slug');
const { checkAuth } = require('./lib/auth');

const fail = (code, msg) => ({ statusCode: code, body: JSON.stringify({ error: msg }) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = checkAuth(event);
  if (!auth.ok) return fail(auth.statusCode, auth.error);

  try {
    const { slug } = JSON.parse(event.body || '{}');
    if (!slug || !SLUG_RE.test(slug) || RESERVED.has(slug)) return fail(400, 'Falta un slug válido');
    const site = getSite();

    const [blogIndex, sitemap, existing] = await Promise.all([
      getFile(site, site.blogIndexPath),
      getFile(site, site.sitemapPath),
      getFile(site, site.postPath(slug)),
    ]);
    if (!blogIndex || !sitemap) return fail(500, 'No se pudo leer blog/index.html o sitemap.xml del repo');
    if (!existing) return fail(404, 'Ese artículo ya no existe');

    const today = new Date().toISOString().slice(0, 10);
    const { commitSha, commitUrl } = await commitChanges(
      site,
      {
        files: [
          { path: site.blogIndexPath, content: removeCard(site, blogIndex.content, slug) },
          { path: site.sitemapPath, content: removeSitemapEntry(site, sitemap.content, slug, today) },
        ],
        deletes: [site.postPath(slug)],
      },
      `Despublica artículo: ${slug}`
    );
    return { statusCode: 200, body: JSON.stringify({ ok: true, commitSha, commitUrl }) };
  } catch (e) {
    return fail(500, e.message);
  }
};
