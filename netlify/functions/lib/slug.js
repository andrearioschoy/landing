// El slug es el nombre del archivo: blog/<slug>.html. Solo minúsculas, números
// y guiones, para que nunca pueda salirse de la carpeta /blog/ ni pisar otro archivo.
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Nombres que no se pueden usar como artículo porque ya son archivos del blog.
const RESERVED = new Set(['index']);

module.exports = { SLUG_RE, RESERVED };
