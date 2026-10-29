const sesiones = new Map();

function sesionNueva() {
  return {
    estado: "menu",
    servicioId: null,
    paso: 0,
    respuestas: [],
    nombre: null,
    negocio: null,
    presentada: false,
  };
}

function obtenerSesion(jid) {
  if (!sesiones.has(jid)) sesiones.set(jid, sesionNueva());
  return sesiones.get(jid);
}

function guardarSesion(jid, sesion) {
  sesiones.set(jid, sesion);
}

function reiniciarSesion(jid) {
  const limpia = sesionNueva();
  sesiones.set(jid, limpia);
  return limpia;
}

module.exports = { obtenerSesion, guardarSesion, reiniciarSesion, sesionNueva };
