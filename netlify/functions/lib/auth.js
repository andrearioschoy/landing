// Autenticación por contraseña compartida. Alcanza para un panel de una sola
// persona. Si algún día otra persona necesita acceso propio, lo indicado es
// migrar a Netlify Identity.

const crypto = require('crypto');

function sha(s) {
  return crypto.createHash('sha256').update(String(s)).digest();
}

function checkAuth(event) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return { ok: false, statusCode: 500, error: 'Falta ADMIN_PASSWORD en las variables de entorno de Netlify' };
  }
  const headers = event.headers || {};
  const provided = headers['x-admin-password'] || '';
  // Comparación en tiempo constante, para que el tiempo de respuesta no delate la contraseña.
  if (!crypto.timingSafeEqual(sha(provided), sha(expected))) {
    return { ok: false, statusCode: 401, error: 'Contraseña incorrecta' };
  }
  return { ok: true };
}

module.exports = { checkAuth };
