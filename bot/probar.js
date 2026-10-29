const assert = require("assert");
const { procesarMensaje } = require("./flujo");
const { sesionNueva } = require("./sesiones");
const { iniciar } = require("./contenido");

function paso(sesion, texto) {
  return procesarMensaje(sesion, texto, { jid: "573001112233@s.whatsapp.net" });
}

async function main() {
  await iniciar();
  let s = sesionNueva();
  let r = paso(s, "hola");
  assert.match(r.respuesta, /1\. Landing page/);
  assert.match(r.respuesta, /2\. Chatbots/);

  r = paso(r.sesion, "quiero un chatbot");
  assert.match(r.respuesta, /WhatsApp/);
  assert.equal(r.sesion.servicioId, "chatbots");

  r = paso(r.sesion, "Sí, por WhatsApp");
  r = paso(r.sesion, "Que responda dudas de horarios");
  r = paso(r.sesion, "Cuando pidan un humano");
  assert.match(r.respuesta, /Cómo te llamas/);

  r = paso(r.sesion, "Ana");
  assert.match(r.respuesta, /negocio/i);
  r = paso(r.sesion, "Taller Luna");
  assert.match(r.respuesta, /Responde SI/);
  assert.match(r.respuesta, /Ana/);

  r = paso(r.sesion, "si");
  assert.ok(r.cotizacion);
  assert.equal(r.cotizacion.nombre, "Ana");
  assert.equal(r.cotizacion.negocio, "Taller Luna");
  assert.equal(r.cotizacion.celular, "3001112233");
  assert.equal(r.cotizacion.respuestas.length, 3);

  s = sesionNueva();
  r = paso(s, "2");
  r = paso(r.sesion, "asesor");
  assert.ok(r.pausar);
  assert.match(r.respuesta, /persona/);

  r = paso(sesionNueva(), "1");
  r = paso(r.sesion, "es un evento");
  r = paso(r.sesion, "menu");
  assert.match(r.respuesta, /3\. Sistemas de boletería/);
  assert.equal(r.sesion.estado, "menu");

  console.log("Flujo de cotización: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
