HORA AZUL FOTOGRAFÍA — README DE LA ESTRUCTURA
======================================================
Pixel: 1374011144230741
Ad Account: 324951284798664

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
netlify/functions/cal-webhook.js  Recibe reservas de Cal.com (firma verificada) y manda Lead/Schedule a Meta
blog/                      Índice + 3 artículos de prueba
recursos/                  Página de recurso gratuito (pendiente tu contenido real)
formulariocliente.html    Formulario PRIVADO de datos del cliente (no está en el sitemap,
                           no tiene link desde ninguna página — solo entra quien tenga el link).
                           Tú se lo compartes directo a cada clienta cuando ya agendó.
gracias-cliente.html       Thank-you page después de llenar ese formulario — dispara "Cliente confirmado"


VARIABLES DE ENTORNO EN NETLIFY (ya las tienes cargadas)
-----------------------
META_PIXEL_ID          = 1374011144230741
META_ACCESS_TOKEN      = tu token de Conversions API (Events Manager → dataset → Configuración → Conversions API)
META_AD_ACCOUNT_ID     = 324951284798664  (no la usa ningún archivo de este paquete todavía —
                          es para cuando armes campañas con la skill meta-ads-fotografos)
CALCOM_WEBHOOK_SECRET  = el secreto que pusiste al crear el webhook en Cal.com


TUS 4 EVENTOS DE CAL.COM Y A DÓNDE VAN
-----------------------
Evento en Cal.com                                          | Slug               | Dispara en Meta
-------------------------------------------------------------|--------------------|------------------
https://cal.com/hora-azul-fotografia/30min                  | 30min              | Lead ("Cliente potencial")
https://cal.com/hora-azul-fotografia/horaazul-instante       | horaazul-instante   | Schedule ("Programar"), paquete=Instante
https://cal.com/hora-azul-fotografia/horaazul-conexion       | horaazul-conexion   | Schedule ("Programar"), paquete=Conexión
https://cal.com/hora-azul-fotografia/horaazul-huella         | horaazul-huella     | Schedule ("Programar"), paquete=Huella

Todo esto pasa por netlify/functions/cal-webhook.js, que ahora SÍ verifica que
la llamada venga realmente de Cal.com (compara la firma del header
x-cal-signature-256 contra CALCOM_WEBHOOK_SECRET) antes de mandar nada a Meta.
Si la firma no coincide, la función responde 401 y no dispara ningún evento.

IMPORTANTE — no instales la app "Meta Pixel" dentro de Cal.com.
El tutorial que capturaste (y la mayoría de guías) sugiere instalar esa app
para el evento Lead. NO la instales: ya la cubre el webhook, y si activas
las dos formas al mismo tiempo, cada reserva manda "Lead" DOS VECES con dos
identificadores distintos que Meta no puede fusionar — se infla el número
que usa el algoritmo para optimizar campañas.


MAPA COMPLETO DE EVENTOS
-----------------------
Tu nombre               | Evento técnico     | Tipo          | Se dispara en
--------------------------|---------------------|---------------|------------------------------
Page View                 | PageView            | Estándar      | Automático, todas las páginas
Interesado en reunión     | InteresadoReunion    | Personalizado | Sin disparador activo — el botón "Agendar llamada" ya no está en el sitio; el link /30min lo mandas tú directo por WhatsApp a quien ya pagó
Cliente potencial         | Lead                 | Estándar      | Server-side, al agendar el "30min" en Cal.com (sin importar dónde compartiste el link)
Contacto                  | Contact              | Estándar      | Cualquier clic a WhatsApp + carga de gracias-reunion.html
Programar                 | Schedule             | Estándar      | Server-side, al agendar cualquiera de los 3 paquetes en Cal.com
Inicio compra              | InitiateCheckout     | Estándar      | Clic en cualquier botón de paquete (baja a la sección de WhatsApp)
Compra                    | Purchase             | Estándar      | Carga de gracias-pago.html, con el monto real
Vio portafolio             | VioPortafolio        | Personalizado | Clic en "Ver portafolio"
Ver blog                  | VerBlog              | Personalizado | Carga de cualquier post
Inició en blog             | IniciadoEnBlog       | Personalizado | Primer Contact/InteresadoReunion después de venir del blog
Cliente confirmado         | CompleteRegistration | Estándar      | Envío del formulario privado (formulariocliente.html)

FORMULARIO PRIVADO DE CLIENTES
-----------------------
formulariocliente.html usa Netlify Forms (sin backend propio). Después de
subir estos archivos a GitHub y que Netlify despliegue, ve a tu panel de
Netlify → tu sitio → pestaña "Forms" — ahí vas a ver cada envío (nombre,
correo, teléfono, dirección) listo para exportar a CSV. No hace falta
configurar nada extra: Netlify detecta el formulario solo por el atributo
data-netlify="true" que ya trae el HTML.

El link para compartir con tus clientas, una vez publicado, es:
https://horaazulfotografia.netlify.app/formulariocliente (URL corta, ver netlify.toml)
No está en ningún menú ni en el sitemap — solo lo encuentra quien tenga
el link directo.

Todos los eventos de clic van deduplicados: se disparan por Pixel del
navegador Y por Conversions API con el mismo event_id, para que Meta los
fusione en uno solo. Se eliminó el riesgo de "SubscribedButtonClick" y
otros eventos fantasma con fbq('set','autoConfig',false,...) en tracking.js.


LO QUE FALTA DE TU LADO
-----------------------
1. VERIFICACIÓN DE DOMINIO (Meta + Google)
   Aún sin instalar — cuando quieras, te ayudo a sacar las etiquetas y las
   pegamos en el <head> de index.html donde están los comentarios "PENDIENTE".

2. GA4 Y TIKTOK PIXEL
   No están instalados — no diste esos IDs. Se agregan cuando los tengas.

3. RECURSO GRATUITO
   recursos/index.html tiene la estructura lista pero el contenido es un
   placeholder. Dime qué guía quieres ofrecer y la escribimos.

4. PROBAR EL WEBHOOK
   En Cal.com, agenda una reserva de prueba en cualquiera de los 4 eventos,
   y revisa en Meta Events Manager → Probar eventos si llega Lead o
   Schedule con origen "API de conversiones". Si no llega nada, lo primero
   a revisar es que el deploy en Netlify ya tenga las 4 variables de
   entorno cargadas (a veces hace falta un redeploy después de agregarlas).


NOTA SOBRE "Programar"
-----------------------
Los tres botones de paquete de la landing bajan a WhatsApp, no a Cal.com —
así lo pediste. Eso significa que horaazul-instante / horaazul-conexion /
horaazul-huella (y por lo tanto el evento "Programar") solo se disparan
cuando TÚ mandas alguno de esos 3 links directamente en la conversación de
WhatsApp y la clienta reserva ahí. El webhook sigue funcionando igual sin
importar desde dónde llegue el link — no depende de que esté en la landing.


NOTA SOBRE "Compra"
-----------------------
Como cobras por transferencia, efectivo o link de pago (no por una
plataforma con webhook propio), "Compra" sigue dependiendo de que tú (o
la clienta) abran gracias-pago.html después de confirmar el pago:
https://horaazulfotografia.netlify.app/gracias-pago.html?monto=7300&paquete=Conexion
Si en algún momento usas Stripe, Nas.io o similar, dímelo y lo conectamos
directo por CAPI sin depender de que abras el link a mano.
