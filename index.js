/**
 * TAVADEV: página, panel y WhatsApp en el mismo proceso.
 * El celular se vincula con un QR, sin abrir Chrome.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
require("./bot/parche-baileys");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { procesarMensaje } = require("./bot/flujo");
const { obtenerSesion, guardarSesion } = require("./bot/sesiones");
const contenido = require("./bot/contenido");
const qrWeb = require("./bot/qr-web");
const { esperarTurno } = require("./bot/turno");
const { iniciar: iniciarServidor } = require("./servidor");

for (const metodo of ["log", "error"]) {
  const original = console[metodo].bind(console);
  console[metodo] = (...args) => {
    const texto = args
      .map((parte) => (parte instanceof Error ? parte.stack || parte.message : String(parte)))
      .join(" ");
    if (/Bad MAC|Failed to decrypt message with any known session|Session error:/.test(texto)) return;
    original(...args);
    try {
      qrWeb.anotar(args.map((parte) => (parte instanceof Error ? parte.message : String(parte))).join(" "));
    } catch (_) {}
  };
}

let listoDesdeMs = 0;
let aceptarMensajes = false;
let sock = null;
let vinculado = false;
let arrancando = false;
let cerrando = false;
let reconectarTimer = null;
let avisoQr = false;
let versionWhatsApp = null;
const colas = new Map();
const recientes = new Map();
const vistos = new Set();
const cacheMensajes = new Map();

function rutaAuth() {
  let base = process.env.AUTH_PATH;
  if (!base) {
    base = process.env.RENDER
      ? "/data/baileys-auth"
      : path.join(process.env.LOCALAPPDATA || os.homedir(), "tavadev-baileys");
  }
  return base;
}

const authPath = rutaAuth();
console.log("Sesión de WhatsApp:", authPath);

function memoriaTotalMb() {
  const rutas = ["/sys/fs/cgroup/memory.current", "/sys/fs/cgroup/memory/memory.usage_in_bytes"];
  for (const ruta of rutas) {
    try {
      const n = Number(fs.readFileSync(ruta, "utf8"));
      if (n > 0) return Math.round(n / 1048576);
    } catch (_) {}
  }
  return Math.round(process.memoryUsage().rss / 1048576);
}

function segundosDe(valor) {
  if (valor == null) return 0;
  if (typeof valor === "number") return valor;
  if (typeof valor === "object" && typeof valor.toNumber === "function") {
    try {
      return valor.toNumber();
    } catch (_) {}
  }
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function desenvolver(message) {
  if (!message) return null;
  return (
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.documentWithCaptionMessage?.message ||
    message
  );
}

function textoDe(msg) {
  const m = desenvolver(msg.message);
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    ""
  );
}

function debeIgnorar(msg) {
  if (!msg || !msg.key) return "vacío";
  if (!aceptarMensajes || !listoDesdeMs) return "cargando";
  const from = String(msg.key.remoteJid || "");
  if (!from) return "sin remitente";
  if (msg.key.fromMe) return "eco";
  if (from === "status@broadcast") return "estado";
  if (from.endsWith("@g.us")) return "grupo";
  if (from.endsWith("@newsletter")) return "canal";
  const enviado = segundosDe(msg.messageTimestamp);
  const enviadoMs = enviado ? (enviado > 1e12 ? enviado : enviado * 1000) : Date.now();
  if (enviadoMs < listoDesdeMs) return "anterior";
  if (!textoDe(msg).trim()) return "vacío";
  return null;
}

function esDuplicado(jid, texto) {
  const clave = `${jid}|${String(texto || "").trim().toLowerCase()}`;
  const ahora = Date.now();
  const anterior = recientes.get(clave);
  if (anterior && ahora - anterior < 8000) return true;
  recientes.set(clave, ahora);
  return false;
}

function yaVisto(id) {
  if (!id) return false;
  if (vistos.has(id)) return true;
  vistos.add(id);
  if (vistos.size > 400) vistos.delete(vistos.values().next().value);
  return false;
}

function sesionAnterior() {
  fs.mkdirSync(authPath, { recursive: true });
  const marca = path.join(authPath, ".baileys-v7");
  if (fs.existsSync(marca)) return;
  const habia = fs.readdirSync(authPath).some((nombre) => nombre !== ".baileys-v7");
  for (const nombre of fs.readdirSync(authPath)) {
    fs.rmSync(path.join(authPath, nombre), { recursive: true, force: true });
  }
  fs.writeFileSync(marca, "1");
  if (habia) console.log("SESION | la sesión vieja no sirve. Sale un QR nuevo. Escanéalo una vez.");
}

function recordarMensaje(msg) {
  if (!msg || !msg.key || !msg.key.id || !msg.message) return;
  cacheMensajes.set(msg.key.id, msg.message);
  if (cacheMensajes.size > 200) cacheMensajes.delete(cacheMensajes.keys().next().value);
}

function encolar(jid, tarea) {
  const previa = colas.get(jid) || Promise.resolve();
  const siguiente = previa.then(tarea, tarea);
  colas.set(jid, siguiente.catch((error) => console.error("Error en cola de", jid, error.message)));
  return siguiente;
}

async function identidadesDe(actual, msg) {
  const key = (msg && msg.key) || {};
  const ids = [key.remoteJid, key.remoteJidAlt, key.participant, key.participantAlt].filter(Boolean);
  const mapping = actual && actual.signalRepository && actual.signalRepository.lidMapping;
  if (mapping && typeof mapping.getPNForLID === "function") {
    for (const id of [...ids]) {
      if (!/@lid$/i.test(String(id))) continue;
      try {
        const telefono = await mapping.getPNForLID(id);
        if (telefono) ids.push(telefono);
      } catch (_) {}
    }
  }
  return ids;
}

function destinosDe(msg) {
  const ids = [];
  const principal = msg.key && msg.key.remoteJid;
  const alterno = msg.key && msg.key.remoteJidAlt;
  if (principal) ids.push(principal);
  if (alterno && !ids.includes(alterno)) ids.push(alterno);
  return ids;
}

async function enviarTexto(actual, ids, texto) {
  let ultimo = null;
  for (const id of ids) {
    try {
      await actual.sendMessage(id, { text: texto });
      return;
    } catch (error) {
      ultimo = error;
      console.error("FALLO | texto a", id, "|", error.message);
    }
  }
  if (ultimo) throw ultimo;
}

async function enviarRespuestas(actual, msg, resultado) {
  const mensajes = (Array.isArray(resultado.respuesta) ? resultado.respuesta : [resultado.respuesta]).filter(Boolean);
  if (!mensajes.length) return;
  const destinos = destinosDe(msg);
  for (const texto of mensajes) {
    if (actual && typeof actual.sendPresenceUpdate === "function") {
      Promise.resolve(actual.sendPresenceUpdate("composing", destinos[0])).catch(() => {});
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
    await enviarTexto(actual, destinos, texto);
  }
}

async function atenderMensaje(actual, msg) {
  recordarMensaje(msg);
  const de = (msg.key && msg.key.remoteJid) || "?";
  const texto = textoDe(msg).trim();
  if (debeIgnorar(msg)) return;
  if (yaVisto(msg.key && msg.key.id)) return;
  if (esDuplicado(de, texto)) return;
  const identidades = await identidadesDe(actual, msg);
  if (await contenido.chatPausadoAlguno(identidades)) {
    console.log("PAUSA | este chat lo atiende una persona:", de);
    contenido.recordarChatPausado(identidades).catch(() => {});
    return;
  }
  console.log("RECIBIDO |", de, "|", texto.slice(0, 160));
  await encolar(de, async () => {
    try {
      const sesion = obtenerSesion(de);
      const resultado = procesarMensaje(sesion, texto, { jid: de });
      if (resultado.pausar) {
        try {
          await contenido.pausarChat({
            celular: resultado.pausar.celular || "",
            jid: resultado.pausar.jid || de,
          });
        } catch (error) {
          console.error("PAUSA |", error.message);
        }
      }
      if (resultado.cotizacion) {
        try {
          const guardada = await contenido.guardarCotizacion(resultado.cotizacion);
          resultado.sesion.estado = "listo";
          contenido.avisarCotizacion(guardada).catch(() => {});
        } catch (error) {
          console.error("FALLO | cotización |", error.message);
          resultado.sesion.estado = "confirmar";
          resultado.respuesta = "No pude anotarla. Responde SI otra vez en un momento.";
        }
      }
      guardarSesion(de, resultado.sesion);
      await enviarRespuestas(actual, msg, resultado);
    } catch (error) {
      console.error("FALLO |", de, "|", error.message);
    }
  });
}

function programarReconexion(espera) {
  if (cerrando) return;
  if (reconectarTimer) clearTimeout(reconectarTimer);
  reconectarTimer = setTimeout(() => {
    reconectarTimer = null;
    if (arrancando) {
      programarReconexion(1000);
      return;
    }
    conectar().catch((error) => console.error("FALLO | reconexión |", error.message));
  }, espera);
}

async function versionDe(fetchLatestBaileysVersion) {
  if (versionWhatsApp) return versionWhatsApp;
  try {
    const resultado = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("tardó")), 8000)),
    ]);
    versionWhatsApp = resultado.version;
  } catch (error) {
    console.log("VERSION | uso la incluida de Baileys:", error.message);
  }
  return versionWhatsApp;
}

async function conectar() {
  if (cerrando || arrancando) return;
  arrancando = true;
  try {
    const baileys = await import("@whiskeysockets/baileys");
    const pino = (await import("pino")).default;
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;
    sesionAnterior();
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const version = await versionDe(fetchLatestBaileysVersion);
    const logger = pino({ level: "silent" });
    if (sock) {
      const viejo = sock;
      sock = null;
      try {
        viejo.ev.removeAllListeners("connection.update");
        viejo.end(undefined);
      } catch (_) {}
    }
    const yaVinculado = Boolean(state.creds && state.creds.registered);
    if (yaVinculado) {
      qrWeb.marcarReconectando();
      console.log("CONEXION | entro de nuevo con la sesión guardada");
    } else {
      console.log("QR | pidiendo código a WhatsApp");
    }
    let guardandoCreds = Promise.resolve();
    const opciones = {
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ["TAVADEV", "Chrome", "1.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      qrTimeout: 60000,
      connectTimeoutMs: 60000,
      getMessage: async (clave) => (clave && cacheMensajes.get(clave.id)) || undefined,
    };
    if (version) opciones.version = version;
    const actual = makeWASocket(opciones);
    sock = actual;
    aceptarMensajes = true;
    if (!listoDesdeMs) listoDesdeMs = Date.now() - 120000;
    actual.ev.on("creds.update", () => {
      guardandoCreds = Promise.resolve(saveCreds()).catch((error) => console.error("FALLO | sesión |", error.message));
    });
    actual.ev.on("connection.update", async (update) => {
      if (sock !== actual) return;
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        try {
          await qrWeb.guardarQr(qr);
        } catch (error) {
          console.error("FALLO | QR |", error.message);
          return;
        }
        if (!avisoQr) {
          avisoQr = true;
          console.log("QR | código listo. Ábrelo en el panel, sección WhatsApp.");
          console.log("NOMBRE | el dispositivo queda como TAVADEV. En el celular solo confírmalo.");
        }
      }
      if (connection === "open") {
        vinculado = true;
        aceptarMensajes = true;
        listoDesdeMs = Date.now() - 120000;
        avisoQr = false;
        qrWeb.marcarConectado();
        const numero = String(actual.user?.id || "").split(":")[0].split("@")[0] || "desconocido";
        console.log("CONECTADO | número", numero);
        console.log("LISTO | ya recibo y respondo los mensajes que lleguen ahora.");
        console.log("MEMORIA |", memoriaTotalMb(), "MB");
      }
      if (connection === "close") {
        const seguiaVinculado = Boolean(state.creds && state.creds.registered);
        vinculado = false;
        aceptarMensajes = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        const salio = code === DisconnectReason.loggedOut;
        const reinicio = code === DisconnectReason.restartRequired;
        console.log("DESCONECTADO |", code || "sin código");
        if (sock === actual) sock = null;
        if (cerrando) return;
        await guardandoCreds;
        if (salio) {
          qrWeb.marcarFallo();
          try {
            fs.rmSync(authPath, { recursive: true, force: true });
          } catch (_) {}
          avisoQr = false;
          console.log("SESION | el celular quitó el dispositivo. En un momento sale otro QR.");
          programarReconexion(800);
          return;
        }
        if (seguiaVinculado || reinicio) {
          qrWeb.marcarReconectando();
          console.log("CONEXION | se cortó. Sigo con la misma sesión, sin QR nuevo.");
          programarReconexion(reinicio ? 800 : 2000);
          return;
        }
        avisoQr = false;
        qrWeb.esperarCodigo();
        programarReconexion(1000);
      }
    });
    actual.ev.on("messages.upsert", ({ messages }) => {
      if (sock !== actual || !messages) return;
      for (const msg of messages) {
        atenderMensaje(actual, msg).catch((error) => console.error("FALLO | mensaje |", error.message));
      }
    });
  } catch (error) {
    console.error("FALLO | no pude abrir WhatsApp |", error.message);
    programarReconexion(5000);
  } finally {
    arrancando = false;
  }
}

contenido.setResolvedorJids(async (celular) => {
  if (!sock || !vinculado) return [];
  const prefijo = (contenido.getSitio().contacto && contenido.getSitio().contacto.prefijo) || "57";
  const digits = String(celular).replace(/\D/g, "");
  const pn = `${digits.startsWith(prefijo) ? digits : prefijo + digits}@s.whatsapp.net`;
  const ids = [pn];
  const mapping = sock.signalRepository && sock.signalRepository.lidMapping;
  if (mapping && typeof mapping.getLIDForPN === "function") {
    const lid = await mapping.getLIDForPN(pn);
    if (lid) ids.push(lid);
  }
  return ids;
});

contenido.setAvisador(async (jid, texto) => {
  if (!sock || !vinculado) throw new Error("WhatsApp no está conectado");
  await sock.sendMessage(jid, { text: texto });
});

async function listarGrupos() {
  if (!sock || !vinculado) return { conectado: false, grupos: [] };
  const mapa = await sock.groupFetchAllParticipating();
  const grupos = Object.values(mapa || {}).map((grupo) => ({
    id: grupo.id,
    nombre: grupo.subject || grupo.id,
  }));
  return { conectado: true, grupos };
}

const puerto = Number(process.env.PORT || 3000);
let soltarTurno = () => {};

function apagar(signal) {
  if (cerrando) return;
  cerrando = true;
  console.log("TURNO | señal", signal);
  if (reconectarTimer) clearTimeout(reconectarTimer);
  soltarTurno();
  const forzar = setTimeout(() => process.exit(0), 8000);
  if (forzar.unref) forzar.unref();
  Promise.resolve()
    .then(() => {
      if (sock && typeof sock.end === "function") sock.end(undefined);
    })
    .catch(() => {})
    .then(() => process.exit(0));
}

process.on("SIGTERM", () => apagar("SIGTERM"));
process.on("SIGINT", () => apagar("SIGINT"));
process.on("unhandledRejection", (error) => {
  console.error("FALLO | promesa sin esperar:", error && error.message ? error.message : String(error));
});

contenido
  .iniciar()
  .then(async () => {
    if (!process.env.PANEL_CLAVE) {
      console.log("PANEL | define PANEL_CLAVE en .env antes de publicar el panel.");
    }
    iniciarServidor(puerto, { getGrupos: listarGrupos });
    const lock = path.join(path.dirname(authPath), "bot.lock");
    soltarTurno = await esperarTurno(lock, (estado) => {
      if (estado === "mio") console.log("TURNO | este proceso abre WhatsApp");
      else console.log("TURNO | otro proceso ya tiene WhatsApp. Espero.");
    });
    return conectar();
  })
  .catch((error) => {
    console.error("No se pudo iniciar:", error);
    soltarTurno();
    process.exit(1);
  });
