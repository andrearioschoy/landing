/* ==========================================================================
   Hora Azul Fotografía — tracking.js
   Un solo archivo, enlazado en TODAS las páginas (landing, blog, gracias,
   recursos). Pixel base + eventos estándar/personalizados + deduplicación
   Pixel <-> Conversions API con el mismo event_id.
   ID de Pixel: 1374011144230741
   ========================================================================== */

/* ---- 1. Código base del Meta Pixel ---- */
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');

var HA_PIXEL_ID = '1374011144230741';
fbq('init', HA_PIXEL_ID);

/* Evita que Meta invente eventos automáticos (incluido SubscribedButtonClick).
   Sin esta línea el pixel escanea la página solo y puede mandar eventos
   estándar que nadie programó. Con esto, SOLO se disparan los de este archivo. */
fbq('set', 'autoConfig', false, HA_PIXEL_ID);

/* PageView en cada página que incluya este script */
fbq('track', 'PageView');

/* ---- 2. Utilidades de deduplicación Pixel + CAPI ---- */
function haMakeEventId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function haGetCookie(name) {
  var match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
  return match ? decodeURIComponent(match.pop()) : '';
}

/**
 * Dispara un evento por Pixel del navegador Y por Conversions API,
 * con el mismo event_id, para que Meta los fusione en uno solo en vez
 * de contarlos dos veces.
 * eventName: nombre técnico del evento (estándar o personalizado)
 * customData: objeto con value/currency/content_name, etc. (opcional)
 * isCustom: true si el evento NO es uno de los estándar de Meta
 */
function haTrack(eventName, customData, isCustom) {
  customData = customData || {};
  var eventId = haMakeEventId(eventName.toLowerCase().replace(/\s+/g, '_'));
  var method = isCustom ? 'trackCustom' : 'track';
  fbq(method, eventName, customData, { eventID: eventId });

  fetch('/.netlify/functions/capi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      fbp: haGetCookie('_fbp'),
      fbc: haGetCookie('_fbc'),
      custom_data: customData
    })
  }).catch(function () {
    /* Si CAPI falla, el Pixel del navegador ya mandó el evento — no se pierde todo. */
  });
}

/* ==========================================================================
   3. EVENTOS — mapa completo del embudo
   ========================================================================== */

/* Contacto: cualquier clic a WhatsApp, en CUALQUIER página del sitio
   (landing, blog, recursos). Un solo listener cubre todos los botones,
   presentes y futuros, sin tener que marcarlos uno por uno. */
document.addEventListener('click', function (e) {
  var link = e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
  if (link) {
    haTrack('Contact');
    if (sessionStorage.getItem('ha_origen_blog') === '1') {
      haTrack('IniciadoEnBlog', {}, true);
    }
  }
});

/* Interesado en reunión: clic en el botón de agendar la llamada de 15 min en Cal.com */
document.addEventListener('click', function (e) {
  var link = e.target.closest('[data-track="agendar-reunion"]');
  if (link) {
    haTrack('InteresadoReunion', {}, true);
    if (sessionStorage.getItem('ha_origen_blog') === '1') {
      haTrack('IniciadoEnBlog', {}, true);
    }
  }
});

/* Vio portafolio: clic en el botón "Ver portafolio" */
document.addEventListener('click', function (e) {
  var link = e.target.closest('[data-track="ver-portafolio"]');
  if (link) haTrack('VioPortafolio', {}, true);
});

/* Inicio compra: clic en cualquier botón de paquete (Instante / Conexión / Huella).
   Es la señal de que alguien quiere reservar un paquete específico. */
document.addEventListener('click', function (e) {
  var link = e.target.closest('[data-track="inicio-compra"]');
  if (link) {
    var paquete = link.getAttribute('data-paquete') || '';
    haTrack('InitiateCheckout', paquete ? { content_name: paquete } : {});
  }
});

/* Compra: automático al cargar la página de gracias del pago.
   El monto se lee de la URL: /gracias-pago.html?monto=7300&paquete=Conexion */
if (document.body.hasAttribute('data-page-compra')) {
  var params = new URLSearchParams(window.location.search);
  var monto = params.get('monto');
  var paquete = params.get('paquete') || '';
  var dataCompra = { currency: 'MXN' };
  if (monto) dataCompra.value = Number(monto);
  if (paquete) dataCompra.content_name = paquete;
  haTrack('Purchase', dataCompra);
}

/* Contacto (reunión confirmada): automático al cargar la thank-you page
   de la llamada de Cal.com, si configuraste el redirect ahí (ver README). */
if (document.body.hasAttribute('data-page-gracias-reunion')) {
  haTrack('Contact');
}

/* Cliente confirmado: automático al cargar la thank-you page del formulario
   privado de datos (formulariocliente.html), después de que alguien ya
   agendó su sesión y te mandó sus datos de contacto/envío. */
if (document.body.hasAttribute('data-page-cliente-confirmado')) {
  haTrack('CompleteRegistration');
}

/* Ver blog: automático al abrir cualquier post */
if (document.body.hasAttribute('data-page-blog-post')) {
  haTrack('VerBlog', { content_name: document.title }, true);
}

/* Marca de origen: si alguien llega desde una URL /blog/, se guarda para
   la sesión, así el próximo Contact/InteresadoReunion también dispara
   "Inició en blog" (ver arriba). Se usa sessionStorage, no cookie, porque
   solo importa dentro de la misma visita. */
if (document.referrer.indexOf('/blog/') !== -1) {
  sessionStorage.setItem('ha_origen_blog', '1');
}
