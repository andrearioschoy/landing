// Acceso a GitHub con fetch nativo de Node (sin dependencias).
//
// Requiere la variable de entorno GITHUB_TOKEN: un Personal Access Token con
// permiso de escritura sobre el repo del sitio (fine-grained: acceso solo a
// andrearioschoy/landing con "Contents: Read and write"; classic: scope "repo").
// Vive solo del lado del servidor, nunca llega al navegador.

const API = 'https://api.github.com';

function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Falta GITHUB_TOKEN en las variables de entorno de Netlify');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status} en ${path}: ${text}`);
  }
  return res.json();
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Lee un archivo de texto del repo. Devuelve null si no existe.
async function getFile(site, path) {
  try {
    const data = await ghFetch(`/repos/${site.owner}/${site.repo}/contents/${path}?ref=${encodeURIComponent(site.branch)}`);
    return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha };
  } catch (e) {
    if (String(e.message).includes('GitHub API 404')) return null;
    throw e;
  }
}

// Un solo commit con todos los cambios (archivos nuevos o editados y borrados),
// igual que "git add . && git commit && git push" a mano. Netlify detecta el
// push y despliega una sola vez.
//   files:   [{ path, content }]   texto UTF-8
//   deletes: [path, ...]
async function commitChanges(site, { files = [], deletes = [] }, message) {
  const { owner, repo, branch } = site;
  const ref = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  const latestCommitSha = ref.object.sha;
  const latestCommit = await ghFetch(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`);

  const tree = [
    ...files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
    ...deletes.map((p) => ({ path: p, mode: '100644', type: 'blob', sha: null })),
  ];
  const newTree = await ghFetch(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ base_tree: latestCommit.tree.sha, tree }),
  });
  const newCommit = await ghFetch(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ message, tree: newTree.sha, parents: [latestCommitSha] }),
  });
  await ghFetch(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ sha: newCommit.sha }),
  });
  return { commitSha: newCommit.sha, commitUrl: newCommit.html_url };
}

module.exports = { getFile, commitChanges };
