// netlify/functions/cal-webhook.js
//
// Recibe el webhook de Cal.com cuando alguien agenda una llamada, y manda
// el evento correspondiente a Meta por Conversions API (server-side, no
// depende del navegador de la persona que agendó).
//
// CONFIGURACIÓN EN CAL.COM (una sola vez):
//   Cal.com -> Settings -> Developer -> Webhooks -> New Webhook
//   Subscriber URL: https://TU-DOMINIO/.netlify/functions/cal-webhook
//   Event trigger: Booking created
//
// Requiere las mismas variables de entorno que capi.js:
//   META_PIXEL_ID, META_CAPI_TOKEN

const crypto = require('crypto');

function hashSHA256(value) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

// Slug del evento de la llamada gratuita de 15 min (el que ya tienes):
// https://cal.com/hora-azul-fotografia/15min -> slug = "15min"
const SLUG_LLAMADA_GRATIS = '15min';

// AJUSTAR cuando crees en Cal.com un tipo de evento para agendar sesiones
// PAGADAS directamente ahí (hoy no existe: cobras por transferencia/link
// aparte). En cuanto lo crees, pon aquí su slug y el evento "Programar"
// (Schedule) empieza a dispararse solo.
const SLUG_SESION_PAGADA = 'sesion-hora-azul';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { statusCode: 500, body: 'Faltan META_PIXEL_ID o META_CAPI_TOKEN' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: 'JSON inválido' };
  }

  if (payload.triggerEvent !== 'BOOKING_CREATED') {
    return { statusCode: 200, body: 'Ignorado: no es una reserva nueva' };
  }

  const booking = payload.payload || {};
  const eventTypeSlug = (booking.eventType && booking.eventType.slug) || booking.type || '';

  let eventName;
  if (eventTypeSlug === SLUG_SESION_PAGADA) {
    eventName = 'Schedule'; // "Programar"
  } else if (eventTypeSlug === SLUG_LLAMADA_GRATIS) {
    eventName = 'Lead'; // "Cliente potencial"
  } else {
    // Tipo de evento no reconocido: se registra igual como Lead, para no
    // perder el dato, pero conviene revisar el slug en Cal.com.
    eventName = 'Lead';
  }

  const attendee = (booking.attendees && booking.attendees[0]) || {};
  const eventId = 'cal_' + (booking.uid || Date.now()) + '_' + eventName.toLowerCase();

  const userData = {};
  if (attendee.email) userData.em = [hashSHA256(attendee.email)];

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'system_generated',
        user_data: userData,
        custom_data: {
          content_name: booking.title || eventTypeSlug
        }
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
