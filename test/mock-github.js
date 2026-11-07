// GitHub falso, en memoria: simula la API que usa el panel con una copia local
// del repo `landing`. Lo comparten las pruebas de funciones y la del navegador.

const fs = require('fs');
const path = require('path');

function install(repoDir) {
  const files = new Map();
  (function load(dir, base = '') {
    for (const name of fs.readdirSync(dir)) {
      if (name === '.git' || name === 'site' || name === 'node_modules') continue;
      const full = path.join(dir, name);
      const rel = base ? `${base}/${name}` : name;
      if (fs.statSync(full).isDirectory()) load(full, rel);
      else if (/\.(html|xml|txt|css|js|toml)$/.test(name)) files.set(rel, fs.readFileSync(full, 'utf8'));
    }
  })(repoDir);
  const original = new Map(files);

  let pendingTree = null;
  let commits = 0;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    const p = u.pathname.replace('/repos/andrearioschoy/landing', '');
    const json = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj, text: async () => JSON.stringify(obj) });
    const method = opts.method || 'GET';
    let m;
    if ((m = /^\/contents\/(.+)$/.exec(p))) {
      const key = decodeURIComponent(m[1]);
      return files.has(key)
        ? json({ content: Buffer.from(files.get(key), 'utf8').toString('base64'), sha: 'sha-' + key })
        : json({ message: 'Not Found' }, 404);
    }
    if (/^\/git\/ref\/heads\/main$/.test(p)) return json({ object: { sha: 'commit-' + commits } });
    if (/^\/git\/commits\/commit-\d+$/.test(p)) return json({ tree: { sha: 'tree-' + commits } });
    if (method === 'POST' && p === '/git/trees') { pendingTree = JSON.parse(opts.body).tree; return json({ sha: 'tree-new' }); }
    if (method === 'POST' && p === '/git/commits') return json({ sha: 'commit-new', html_url: 'https://github.com/andrearioschoy/landing/commit/commit-new' });
    if (method === 'PATCH' && /^\/git\/refs\/heads\/main$/.test(p)) {
      pendingTree.forEach((e) => { if (e.sha === null) files.delete(e.path); else files.set(e.path, e.content); });
      commits++;
      return json({ ok: true });
    }
    return json({ message: 'ruta no simulada: ' + method + ' ' + p }, 500);
  };

  return { files, original, stats: { get commits() { return commits; } } };
}

module.exports = { install };
