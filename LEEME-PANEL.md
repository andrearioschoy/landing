# Panel de Hora Azul en tu mismo repositorio

El panel vive en `tudominio/admin` dentro del mismo repositorio y el mismo sitio de Netlify que tu landing. Con él editas los textos, los precios, las fotos y los carruseles de toda la landing, y creas, editas y despublicas los artículos del blog. Cada guardado hace un commit real en `andrearioschoy/landing` y Netlify publica el cambio en un par de minutos, igual que cuando subías archivos a mano.

## Qué puedes editar

| Sección del menú | Qué incluye |
|---|---|
| Artículos | Crear, editar y despublicar artículos del blog (con editor visual, revisión de SEO y botón de WhatsApp propio). |
| Inicio | Todos los textos, enlaces y fotos de la landing, agrupados por sección: encabezado, hero, el problema, una pausa para conectar, proceso, portafolio, sobre mí, testimonios, precios y paquetes, contacto y pie de página. Incluye los precios de Instante, Conexión y Huella, y los datos de Google y de cuando compartes el link. |
| Carruseles de Inicio | Agregar, quitar y reordenar las fotos del portafolio y las capturas de testimonios. |
| Blog · portada del listado | Título y texto de introducción de `/blog/`. |
| Recurso gratuito, Privacidad | Todos sus textos. |
| Gracias (llamada, pago, formulario) y Página 404 | Todos sus textos. |

Los campos de varios renglones (descripción y "qué incluye" de cada paquete) se editan con un renglón por línea. Las imágenes se pegan como URL de Cloudinary sin transformaciones; el panel agrega solo la versión reducida que cada lugar ya usaba. El `srcset` de la foto principal se regenera solo. La descripción y la imagen de Google también actualizan el marcado estructurado (JSON-LD) de la Home.

Cuando guardas, el panel reescribe únicamente los campos que cambiaste. El resto del HTML queda igual, byte por byte. Si guardas sin cambios no se hace ningún commit.

## Qué sube a tu repositorio

Copia el contenido de esta carpeta sobre la raíz de `landing` (el mismo nivel que `index.html`).

**Archivos nuevos**
- `admin/index.html`: el panel.
- `netlify/functions/`: `list-pages`, `get-page`, `save-page`, `list-posts`, `get-post`, `save-post`, `delete-post` y su carpeta `lib/`. Conviven con tus funciones `capi.js` y `cal-webhook.js` sin tocarlas.
- `tools/marcar-pagina.js`: marca los textos de una página nueva para que el panel pueda editarla.
- `test/`: pruebas automáticas. Puedes borrar esta carpeta y `tools/` si no las quieres en el repo; el sitio funciona igual.

**Archivos que se reemplazan** (tomados de la versión del repo con el commit `b20830e`)
- `index.html`, `privacy.html`, `404.html`, `gracias-reunion.html`, `gracias-pago.html`, `gracias-cliente.html`, `recursos/index.html`, `blog/index.html`. Lo único que cambia es que ciertos elementos llevan atributos `data-t`, `data-tx` o `data-ta`. Se comprobó que sin esos atributos cada archivo queda idéntico al original, así que el diseño y el tracking quedan igual. Si cambiaste alguno de estos archivos después de ese commit, compara con `git diff` antes de subirlo.
- `netlify.toml`: tu archivo con tres adiciones: incluir `lib/` en las funciones y cabeceras de `/admin` (sin indexar, sin caché).
- `robots.txt`: tu archivo con `Disallow: /admin/` en cada grupo.

`formulariocliente.html` queda igual: su formulario tiene montos y lógica propios.

## Activarlo (una sola vez)

1. Sube los archivos al repo (commit a `main`) y espera el deploy.
2. Crea un token en GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens. En Repository access elige solo `andrearioschoy/landing` y en Repository permissions pon **Contents: Read and write**.
3. En Netlify, en el sitio de tu landing: Site configuration → Environment variables, agrega:
   - `GITHUB_TOKEN`: el token del paso 2.
   - `ADMIN_PASSWORD`: la contraseña con la que entrarás al panel.
   - Opcionales: `SITE_DOMAIN` si conectas un dominio propio (por ejemplo `horaazulfotografia.com`, sin `https://`) y `GITHUB_BRANCH` si tu rama principal tiene otro nombre.
4. Trigger deploy para que las funciones tomen las variables. Tus variables `META_PIXEL_ID`, `META_ACCESS_TOKEN` y `CALCOM_WEBHOOK_SECRET` siguen donde están.
5. Entra a `tudominio/admin`, escribe la contraseña y haz un cambio pequeño para probar.

Pega el token y la contraseña directo en Netlify. Evita compartirlos en un chat o escribirlos en un archivo del repo.

## Qué sigue fuera del panel

- **Precios en otros lugares.** El panel cambia lo que se ve en la landing. `formulariocliente.html` (opciones con `data-monto`) y los montos de `gracias-pago.html` los editas a mano si cambian.
- **Nombres de paquetes en Meta y Cal.com.** El botón de cada paquete manda a Meta su nombre original (`data-paquete`) y `cal-webhook.js` usa Instante, Conexión y Huella. Si renombras un paquete, esos dos lugares conservan el nombre anterior.
- **Enlaces de WhatsApp.** Deben empezar con `https://wa.me/` para que `tracking.js` cuente el clic como Contacto.
- **Dominio.** `canonical`, `og:url` y los links del sitemap siguen con `horaazulfotografia.netlify.app`. Al conectar un dominio propio se cambian en un solo repaso.
- **Estructura.** El panel edita contenido. Agregar o quitar secciones completas de la Home sigue siendo trabajo de código.
- **Carruseles.** Se editan fotos y textos alternativos. Los testimonios son capturas de imagen, por eso no tienen campo de texto.

## Agregar otra página al panel

1. Desde la raíz del repo: `node tools/marcar-pagina.js . ruta/pagina.html clave "Etiqueta" /tmp/pagina.json`
2. Pega el contenido de `/tmp/pagina.json` dentro de `blocks` en `netlify/functions/lib/page-blocks.json` y agrega la clave al `menu` del mismo archivo.
3. Haz commit. La página aparece en el menú del panel.

Para dejar fuera del marcado una zona que otra función ya administra (por ejemplo las tarjetas del blog), agrega una clase al final del comando: `... pagina.json post-grid`. Un contenedor con `data-cms-skip` también se omite.

## Cómo está armado

```
admin/index.html                  panel (menú, formularios por sección, carruseles, editor de artículos)
netlify/functions/
  list-pages.js  get-page.js  save-page.js        páginas
  list-posts.js  get-post.js  save-post.js  delete-post.js    blog
  lib/
    pages.js            lee y reescribe solo lo que cambió, valida enlaces e imágenes, listas
    page-blocks.json    campos de cada página y menú del panel
    bindings.js         motor que enlaza cada campo con su elemento del HTML
    templates.js  parse.js  compose.js     artículos, tarjetas y sitemap
    config.js           dominio, repo, logo, WhatsApp y fuentes
    github.js  auth.js  slug.js
tools/marcar-pagina.js            marca una página nueva
test/                             pruebas con GitHub simulado
```

## Seguridad

La contraseña es única y se compara en tiempo constante. Alcanza para un panel de una sola persona. Para dar acceso a otra persona con su propia cuenta, el siguiente paso es Netlify Identity. El token de GitHub vive solo del lado del servidor. Los enlaces, las imágenes y el HTML con formato se validan al guardar: solo `https://`, `/`, `#`, `tel:` y `mailto:` en enlaces, y solo etiquetas `a`, `strong`, `em`, `b`, `i`, `mark` y `br` en textos con formato.

## Pruebas

```
node test/blog.js  /ruta/a/tu/copia/de/landing    # 42 comprobaciones del blog
node test/pages.js /ruta/a/tu/copia/de/landing    # 58 comprobaciones de páginas y carruseles
```

Ambas simulan la API de GitHub en memoria. Comprueban que leer y guardar sin cambios no modifica nada, que cada edición cambia solo su campo, que se conservan sangrías, transformaciones de Cloudinary y `srcset`, que se rechazan enlaces peligrosos y que el resto del sitio queda intacto.
