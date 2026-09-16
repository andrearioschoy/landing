// netlify/functions/cal-webhook.js
//
// Recibe el webhook de Cal.com cuando alguien agenda, verifica que la
// llamada venga realmente de Cal.com (firma HMAC), y manda el evento
// correspondiente a Meta por Conversions API — server-side, no depende
// del navegador de quien agendó.
//
// CONFIGURACIÓN EN CAL.COM (ya la hiciste):
//   Subscriber URL: https://horaazulfotografia.netlify.app/.netlify/functions/cal-webhook
//   Event trigger: Booking created
//   Secret: el mismo valor que pusiste en CALCOM_WEBHOOK_SECRET
//
// Requiere estas variables de entorno en Netlify (ya las tienes):
//   META_PIXEL_ID, META_ACCESS_TOKEN, CALCOM_WEBHOOK_SECRET

const crypto = require('crypto');

function hashSHA256(value) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

// Mapa de tus 4 tipos de evento en Cal.com:
//   30min                -> llamada informativa gratis      -> Lead ("Cliente potencial")
//   horaazul-instante     -> sesión pagada, paquete Instante  -> Schedule ("Programar")
//   horaazul-conexion     -> sesión pagada, paquete Conexión  -> Schedule ("Programar")
//   horaazul-huella       -> sesión pagada, paquete Huella    -> Schedule ("Programar")
const EVENTOS = {
  '30min':             { eventName: 'Lead',     paquete: null },
  'horaazul-instante':  { eventName: 'Schedule', paquete: 'Instante' },
  'horaazul-conexion':  { eventName: 'Schedule', paquete: 'Conexión' },
  'horaazul-huella':    { eventName: 'Schedule', paquete: 'Huella' }
};

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
  const WEBHOOK_SECRET = process.env.CALCOM_WEBHOOK_SECRET;

  if (!PIXEL_ID || !ACCESS_TOKEN || !WEBHOOK_SECRET) {
    return { statusCode: 500, body: 'Faltan META_PIXEL_ID, META_ACCESS_TOKEN o CALCOM_WEBHOOK_SECRET' };
  }

  // Cuerpo crudo tal cual llegó, necesario para verificar la firma byte a byte
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  const signatureHeader =
    event.headers['x-cal-signature-256'] || event.headers['X-Cal-Signature-256'];

  if (!signatureHeader) {
    return { statusCode: 401, body: 'Falta la firma del webhook' };
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');

  const sigBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expectedSignature);
  const firmaValida =
    sigBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, expectedBuffer);

  if (!firmaValida) {
    return { statusCode: 401, body: 'Firma inválida — esta llamada no viene de Cal.com' };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return { statusCode: 400, body: 'JSON inválido' };
  }

  if (payload.triggerEvent !== 'BOOKING_CREATED') {
    return { statusCode: 200, body: 'Ignorado: no es una reserva nueva' };
  }

  const booking = payload.payload || {};
  const eventTypeSlug = (booking.eventType && booking.eventType.slug) || booking.type || '';
  const config = EVENTOS[eventTypeSlug];

  if (!config) {
    // Tipo de evento no reconocido: no se manda nada a Meta, pero se
    // responde 200 para que Cal.com no lo marque como fallido/reintente.
    return { statusCode: 200, body: 'Tipo de evento sin mapear: ' + eventTypeSlug };
  }

  const attendee = (booking.attendees && booking.attendees[0]) || {};
  const eventId = 'cal_' + (booking.uid || Date.now()) + '_' + config.eventName.toLowerCase();

  const userData = {};
  if (attendee.email) userData.em = [hashSHA256(attendee.email)];

  const customData = { content_name: booking.title || eventTypeSlug };
  if (config.paquete) customData.paquete = config.paquete;

  const body = {
    data: [
      {
        event_name: config.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'system_generated',
        user_data: userData,
        custom_data: customData
      }
    ]
  };

  try {
    const res = await fetch(
      'https://graph.facebook.com/v21.0/' + PIXEL_ID + '/events?access_token=' + ACCESS_TOKEN,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    const data = await res.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 502, body: 'Error al mandar el evento a Meta: ' + err.message };
  }
};
