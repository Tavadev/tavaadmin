const QRCode = require("qrcode");

let png = null;
let estado = "esperando";
let fallos = 0;
let aviso = "";
const logs = [];

function anotar(linea) {
  const texto = String(linea || "").replace(/\s+/g, " ").trim().slice(0, 280);
  if (!texto) return;
  logs.push(texto);
  if (logs.length > 40) logs.shift();
  if (texto.startsWith("CONECTADO |")) {
    estado = "conectado";
    fallos = 0;
    png = null;
  }
}

async function guardarQr(texto) {
  png = await QRCode.toBuffer(texto, { type: "png", width: 480, margin: 2, errorCorrectionLevel: "M" });
  if (estado !== "conectado") estado = fallos >= 2 ? "fallando" : "qr";
}

function marcarConectado() {
  estado = "conectado";
  fallos = 0;
  png = null;
}

function marcarFallo() {
  fallos += 1;
  estado = "fallando";
  aviso = "";
}

function esperarCodigo() {
  if (estado === "conectado" || estado === "reconectando") return;
  png = null;
  estado = "esperando";
  aviso = "";
}

function marcarReconectando() {
  png = null;
  estado = "reconectando";
  aviso = "";
}

function resumen() {
  if (estado === "conectado") {
    return {
      estado,
      titulo: "Conectado",
      detalle: "WhatsApp ya está vinculado. Los mensajes nuevos se responden solos.",
      hayQr: false,
    };
  }
  if (estado === "reconectando") {
    return {
      estado,
      titulo: "Sigue vinculado",
      detalle: "Se cortó un momento. Vuelvo a entrar con la misma sesión. No escanees.",
      hayQr: false,
    };
  }
  if (estado === "fallando" || fallos >= 2) {
    return {
      estado: "fallando",
      titulo: "Se está cayendo",
      detalle: aviso || "El vínculo se cae. Revisa el registro y, si hace falta, escanea de nuevo.",
      hayQr: Boolean(png),
    };
  }
  return {
    estado: png ? "qr" : "esperando",
    titulo: png ? "Listo para escanear" : "Pidiendo el código",
    detalle: png
      ? "En el celular: Ajustes, dispositivos vinculados, vincular. El nombre sale como TAVADEV."
      : "Estoy pidiendo el código a WhatsApp. Si tarda, espera unos segundos.",
    hayQr: Boolean(png),
  };
}

function obtenerPng() {
  return png;
}

function logsRecientes() {
  return logs.slice();
}

module.exports = {
  anotar,
  guardarQr,
  marcarConectado,
  marcarFallo,
  esperarCodigo,
  marcarReconectando,
  resumen,
  obtenerPng,
  logsRecientes,
};
