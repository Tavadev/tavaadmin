# TAVADEV

Página, panel y asistente de WhatsApp para cotizar landing pages, chatbots, boletería y software a la medida.

La carpeta `CHATBOT 7SEVEND` queda como referencia del bot que ya funcionaba. Este proyecto es el que se publica.

## En tu computador

```bash
npm install
copy .env.example .env
npm start
```

- Página: http://localhost:3000
- Panel: http://localhost:3000/panel

En `.env` pon `PANEL_CLAVE`. Sin esa clave el panel no abre.

Sin Supabase, la página y las cotizaciones se guardan en `datos/`. Sirve para probar. Para Render hace falta Supabase, porque el disco de Render no es la base de la página.

## Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. SQL Editor → pega `supabase/schema.sql` → Run.
3. Project Settings → API: copia **Project URL** y **service_role**.
4. Pégalas en `.env`. No uses la clave anónima y no la pongas en el navegador.

La primera vez que arranque, sube el contenido de `datos/sitio.json`.

## Render

Hace falta un Web Service que no se duerma. El plan gratis se apaga y WhatsApp se cae.

1. Conecta este repositorio. La raíz es esta carpeta, donde está el `Dockerfile`. No uses `CHATBOT 7SEVEND`.
2. New → Web Service → Docker.
3. Plan **Starter**.
4. Disco persistente: montar `/data` (1 GB). Así no vuelves a escanear el QR en cada reinicio.
5. Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PANEL_CLAVE`, `PORT=10000`, `AUTH_PATH=/data/baileys-auth`.

La página queda en `https://tu-servicio.onrender.com` y el panel en `/panel`.

El QR solo se ve dentro del panel, en WhatsApp. En el celular: dispositivos vinculados → vincular. El nombre sale como TAVADEV.

## Qué puedes cambiar sin tocar código

En el panel:

- textos de la página
- servicios y las preguntas del bot
- colores, logos e imágenes
- mensajes de la conversación
- a quién avisar cuando llegue una cotización
- el estado de cada solicitud, y tomar un chat para responder tú

El bot no publica precios. Pregunta el servicio, unas respuestas, el nombre y el negocio. Al confirmar, la cotización queda en el panel.
