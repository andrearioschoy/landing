const { getSite } = require('./lib/config');
const { getFile } = require('./lib/github');
const { parseCards } = require('./lib/parse');
const { checkAuth } = require('./lib/auth');

exports.handler = async (event) => {
  const auth = checkAuth(event);
  if (!auth.ok) return { statusCode: auth.statusCode, body: JSON.stringify({ error: auth.error }) };

  try {
    const site = getSite();
    const file = await getFile(site, site.blogIndexPath);
    if (!file) return { statusCode: 404, body: JSON.stringify({ error: `No se encontró ${site.blogIndexPath}` }) };
    return { statusCode: 200, body: JSON.stringify({ posts: parseCards(site, file.content), domain: site.domain }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
