HORA AZUL FOTOGRAFÍA — README DE LA ESTRUCTURA NUEVA
======================================================

ESTRUCTURA DE ARCHIVOS
-----------------------
index.html                Landing principal
privacy.html              Política de privacidad
404.html                  Página de error (Netlify la sirve sola)
gracias-reunion.html      Thank-you page de la llamada de Cal.com (opcional, ver abajo)
gracias-pago.html         Thank-you page después de pagar — dispara "Compra"
netlify.toml              Config de Netlify (rutas del blog, headers, functions)
robots.txt                Permite el rastreo, incluidas las IAs (GPTBot, ClaudeBot, etc.)
sitemap.xml               Mapa del sitio para Google Search Console
llms.txt / ai.txt         Archivos para que las IAs entiendan y citen el sitio
assets/global.css         CSS ÚNICO para TODAS las páginas — no lo dupliques
assets/tracking.js        Pixel + todos los eventos del embudo, un solo archivo
netlify/functions/capi.js         Reenvía eventos del navegador a Meta (Conversions API)
netlify/functions/cal-webhook.js  Recibe reservas de Cal.com y manda Lead/Schedule a Meta
blog/                      Índice + 3 artículos de prueba
recursos/                  Página de recurso gratuito (pendiente tu contenido real)


MAPA DE EVENTOS
-----------------------
Tu nombre                 | Evento técnico     | Tipo          | Se dispara en
---------------------------|---------------------|---------------|------------------------------
Page View                  | PageView            | Estándar      | Automático, todas las páginas
Interesado en reunión      | InteresadoReunion    | Personalizado | Clic en "Agendar llamada"
Cliente potencial          | Lead                 | Estándar      | Server-side, al agendar el "15min" en Cal.com
Contacto                   | Contact              | Estándar      | Cualquier clic a WhatsApp + carga de gracias-reunion.html
Programar                  | Schedule             | Estándar      | Reservado — aún no tienes un tipo de evento pagado en Cal.com (ver abajo)
Inicio compra               | InitiateCheckout     | Estándar      | Clic en cualquier botón de paquete (Instante/Conexión/Huella)
Compra                     | Purchase             | Estándar      | Carga de gracias-pago.html, con el monto real
Vio portafolio              | VioPortafolio        | Personalizado | Clic en "Ver portafolio" (nuevo, en el hero)
Ver blog                   | VerBlog              | Personalizado | Carga de cualquier post
Inició en blog              | IniciadoEnBlog       | Personalizado | Primer Contact/InteresadoReunion después de venir del blog

Todos los eventos de clic van deduplicados: se disparan por Pixel del
navegador Y por Conversions API con el mismo event_id, para que Meta los
fusione en uno solo. Se eliminó el riesgo de "SubscribedButtonClick" y
otros eventos fantasma con fbq('set','autoConfig',false,...) en tracking.js.


LO QUE TIENES QUE HACER TÚ (en este orden)
-----------------------
1. VARIABLES DE ENTORNO EN NETLIFY
   Site configuration → Environment variables → agregar:
     META_PIXEL_ID   = 1374011144230741
     META_CAPI_TOKEN = (Events Manager → tu dataset → Configuración →
                        Conversions API → Generar token de acceso)

2. WEBHOOK DE CAL.COM (para "Cliente potencial")
   Cal.com → Settings → Developer → Webhooks → New Webhook
     Subscriber URL: https://TU-DOMINIO/.netlify/functions/cal-webhook
     Event trigger: Booking created
   Esto ya cubre tu llamada de 15 min (slug "15min").

3. REDIRECT DESPUÉS DE AGENDAR (opcional, para "Contacto" reforzado)
   Cal.com → tu evento "15min" → Advanced → Redirect on booking →
   pega la URL de gracias-reunion.html una vez publicada.

4. CUANDO TENGAS UN TIPO DE SESIÓN PAGADA EN CAL.COM (para "Programar")
   Crea el evento en Cal.com, copia su slug, y ponlo en
   netlify/functions/cal-webhook.js donde dice SLUG_SESION_PAGADA.

5. VERIFICACIÓN DE DOMINIO (Meta + Google)
   Sigue references/prerrequisitos-tracking.md (o pídeme que te guíe) y
   pega las dos etiquetas en el <head> de index.html donde están los
   comentarios "PENDIENTE".

6. AL CONFIRMAR UN PAGO
   Manda a la clienta (o ábrelo tú) este link con su monto real:
   https://TU-DOMINIO/gracias-pago.html?monto=7300&paquete=Conexion

7. GA4 Y TIKTOK PIXEL
   No están instalados todavía — no diste esos IDs. Cuando los tengas,
   los agrego en index.html (y en las demás páginas si vas a anunciar
   ahí también).

8. RECURSO GRATUITO
   recursos/index.html tiene la estructura lista pero el contenido es
   un placeholder. Dime qué guía quieres ofrecer y la escribimos.


NOTA SOBRE "Inicio compra" Y "Compra"
-----------------------
Como cobras por transferencia, efectivo o link de pago (no por una
plataforma con webhook propio), armé el flujo así: "Inicio compra" se
dispara cuando alguien elige un paquete en la landing (intención real de
reservar), y "Compra" se dispara cuando abres/mandas gracias-pago.html
después de confirmar el pago con tus propias manos. Si en algún momento
usas Stripe, Nas.io o similar, dímelo y lo conectamos directo por CAPI
sin depender de que abras el link a mano.
