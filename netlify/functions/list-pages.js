const { menu } = require('./lib/pages');
const { getSite } = require('./lib/config');
const { checkAuth } = require('./lib/auth');

// Menú del panel: el blog y las páginas que se pueden editar.
exports.handler = async (event) => {
  const auth = checkAuth(event);
  if (!auth.ok) return { statusCode: auth.statusCode, body: JSON.stringify({ error: auth.error }) };
  const site = getSite();
  return { statusCode: 200, body: JSON.stringify({ menu: menu(), domain: site.domain }) };
};
