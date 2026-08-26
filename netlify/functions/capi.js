// netlify/functions/capi.js
//
// Reenvía a Meta Conversions API los eventos que el navegador ya mandó por
// Pixel, con el MISMO event_id, para que Meta los fusione en uno solo en
// vez de contarlos dos veces. Lo llama assets/tracking.js por fetch().
//
// Requiere estas variables de entorno en Netlify:
//   META_PIXEL_ID    -> 1374011144230741
//   META_CAPI_TOKEN  -> el token que genera Events Manager > Configuración > Conversions API

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return {
      statusCode: 500,
      body: 'Faltan META_PIXEL_ID o META_CAPI_TOKEN en las variables de entorno de Netlify.'
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: 'JSON inválido' };
  }

  const { event_name, event_id, event_source_url, fbp, fbc, custom_data } = payload;

  if (!event_name || !event_id) {
    return { statusCode: 400, body: 'Falta event_name o event_id' };
  }

  const clientIp =
    event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || '';
  const userAgent = event.headers['user-agent'] || '';

  const userData = {
    client_ip_address: clientIp,
    client_user_agent: userAgent
  };
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const body = {
    data: [
      {
        event_name: event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event_id,
        event_source_url: event_source_url,
        action_source: 'website',
        user_data: userData,
        custom_data: custom_data || {}
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
