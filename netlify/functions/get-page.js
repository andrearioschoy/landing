const { getSite } = require('./lib/config');
const { getFile } = require('./lib/github');
const { getBlock, readPage } = require('./lib/pages');
const { checkAuth } = require('./lib/auth');

const fail = (code, msg) => ({ statusCode: code, body: JSON.stringify({ error: msg }) });

exports.handler = async (event) => {
  const auth = checkAuth(event);
  if (!auth.ok) return fail(auth.statusCode, auth.error);
  try {
    const key = (event.queryStringParameters || {}).block;
    let block;
    try { block = getBlock(key); } catch (e) { return fail(404, e.message); }
    const site = getSite();
    const file = await getFile(site, block.path);
    if (!file) return fail(404, `No se encontró ${block.path} en el repositorio`);
    const { values, modes, lists } = readPage(file.content, block);
    return {
      statusCode: 200,
      body: JSON.stringify({ key: block.key, label: block.label, livePath: block.livePath, fields: block.fields, values, modes, lists }),
    };
  } catch (e) {
    return fail(500, e.message);
  }
};
