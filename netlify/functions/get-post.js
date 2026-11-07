const { getSite } = require('./lib/config');
const { getFile } = require('./lib/github');
const { parsePost, parseCards } = require('./lib/parse');
const { checkAuth } = require('./lib/auth');
const { SLUG_RE } = require('./lib/slug');

exports.handler = async (event) => {
  const auth = checkAuth(event);
  if (!auth.ok) return { statusCode: auth.statusCode, body: JSON.stringify({ error: auth.error }) };

  try {
    const slug = (event.queryStringParameters || {}).slug;
    if (!slug || !SLUG_RE.test(slug)) return { statusCode: 400, body: JSON.stringify({ error: 'Falta un slug válido' }) };
    const site = getSite();
    const [postFile, indexFile] = await Promise.all([
      getFile(site, site.postPath(slug)),
      getFile(site, site.blogIndexPath),
    ]);
    if (!postFile) return { statusCode: 404, body: JSON.stringify({ error: 'Artículo no encontrado' }) };

    const post = parsePost(site, postFile.content);
    // La portada y el texto alternativo viven en la tarjeta del listado.
    const card = indexFile ? parseCards(site, indexFile.content).find((c) => c.slug === slug) : null;
    return {
      statusCode: 200,
      body: JSON.stringify({
        slug,
        ...post,
        coverImageUrl: card ? card.coverImageUrl : '',
        coverImageAlt: card ? card.coverImageAlt : '',
        excerpt: (card && card.excerpt) || post.excerpt,
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
