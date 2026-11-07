const { getSite } = require('./lib/config');
const { getFile, commitChanges } = require('./lib/github');
const { getBlock, savePage } = require('./lib/pages');
const { checkAuth } = require('./lib/auth');

const fail = (code, msg) => ({ statusCode: code, body: JSON.stringify({ error: msg }) });

// Guarda los cambios de una página en UN commit. Solo se reescribe lo que
// cambió; si no hay cambios, no se hace commit.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = checkAuth(event);
  if (!auth.ok) return fail(auth.statusCode, auth.error);
  try {
    const input = JSON.parse(event.body || '{}');
    let block;
    try { block = getBlock(input.block); } catch (e) { return fail(404, e.message); }
    const site = getSite();
    const file = await getFile(site, block.path);
    if (!file) return fail(500, `No se pudo leer ${block.path}`);

    let result;
    try { result = savePage(file.content, block, input); } catch (e) { return fail(400, e.message); }
    if (!result.htmlChanged) return { statusCode: 200, body: JSON.stringify({ ok: true, unchanged: true }) };

    const { commitSha, commitUrl } = await commitChanges(
      site,
      { files: [{ path: block.path, content: result.html }] },
      `Actualiza ${block.label}`
    );
    return { statusCode: 200, body: JSON.stringify({ ok: true, commitSha, commitUrl, changed: result.changed }) };
  } catch (e) {
    return fail(500, e.message);
  }
};
