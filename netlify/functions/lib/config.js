// Configuración del sitio que maneja este panel: Hora Azul Fotografía.
// Todo lo que cambia entre un sitio y otro vive acá; el resto del código
// (templates, github, panel) lo toma de este objeto.

const SITE = {
  key: 'horaazul',
  label: 'Hora Azul Fotografía',

  // Dominio público. Si más adelante conectas un dominio propio, cámbialo
  // aquí o con la variable de entorno SITE_DOMAIN en Netlify (sin https://).
  domain: process.env.SITE_DOMAIN || 'horaazulfotografia.netlify.app',

  // Repositorio donde el panel hace los commits.
  owner: process.env.GITHUB_OWNER || 'andrearioschoy',
  repo: process.env.GITHUB_REPO || 'landing',
  branch: process.env.GITHUB_BRANCH || 'main',

  // Rutas dentro del repositorio.
  blogIndexPath: 'blog/index.html',
  sitemapPath: 'sitemap.xml',
  postPath: (slug) => `blog/${slug}.html`,
  postUrlPath: (slug) => `/blog/${slug}.html`,

  // Marcador exacto de blog/index.html después del cual se inserta una tarjeta nueva.
  cardAnchor: '<div class="post-grid">',

  author: 'Andrea Ríos',
  authorLine: 'Fotógrafa de retrato de familias y parejas en CDMX',
  brand: 'Hora Azul',
  brandFull: 'Hora Azul Fotografía',

  logoHeaderUrl: 'https://res.cloudinary.com/dlu6jpw54/image/upload/f_auto,q_auto,w_200/v1777602198/HA_LOGO_copy_risxon.png',
  logoUrl: 'https://res.cloudinary.com/dlu6jpw54/image/upload/v1777602198/logo_fpqtx8.png',
  faviconUrl: 'https://res.cloudinary.com/dlu6jpw54/image/upload/v1777602207/mini-logo_aax5c9.png',
  fontsHref: 'https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500&family=Outfit:wght@300;400;500&display=swap',

  // Transformaciones de Cloudinary que se agregan solas según dónde se use la imagen.
  cardImgTransform: 'f_auto,q_auto,w_600',
  ogImgTransform: 'f_auto,q_auto,w_1200',

  // Botón de WhatsApp al final de cada artículo.
  whatsappNumber: '525551376253',
  defaultCtaText: 'Si tienes dudas antes de reservar, escríbeme directo por WhatsApp.',
  defaultWaMessage: 'Hola, leí tu blog y quiero más información sobre mi sesión',
};

function getSite() {
  return SITE;
}

module.exports = { SITE, getSite };
