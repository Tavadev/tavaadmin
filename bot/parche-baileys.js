/**
 * Si la llave del chat no coincide, Baileys pide el mismo texto cifrado
 * y espera al segundo intento para crear una llave nueva.
 * Este parche pide la llave nueva en el primer fallo.
 */
const fs = require("fs");
const path = require("path");

function aplicar() {
  const archivo = path.join(__dirname, "..", "node_modules", "@whiskeysockets", "baileys", "lib", "Socket", "messages-recv.js");
  if (!fs.existsSync(archivo)) return;
  let src = fs.readFileSync(archivo, "utf8");
  if (src.includes("/* tavadev-retry */")) return;

  const bloque = `        if (enableAutoSessionRecreation && messageRetryManager && retryCount > 1) {
            try {
                // Check if we have a session with this JID
                const sessionId = signalRepository.jidToSignalProtocolAddress(fromJid);
                const hasSession = await signalRepository.validateSession(fromJid);
                const result = messageRetryManager.shouldRecreateSession(fromJid, hasSession.exists);`;
  const nuevo = `        if (enableAutoSessionRecreation && messageRetryManager && retryCount >= 1) {
            try {
                // Check if we have a session with this JID
                const sessionId = signalRepository.jidToSignalProtocolAddress(fromJid);
                const hasSession = await signalRepository.validateSession(fromJid);
                const result = messageRetryManager.shouldRecreateSession(fromJid, hasSession.exists, 7); /* tavadev-retry */`;
  if (!src.includes(bloque)) return;
  src = src.replace(bloque, nuevo);
  src = src.replace(
    "        if (retryCount <= 2) {",
    "        if (retryCount <= 2 && !shouldRecreateSession) { /* tavadev-sin-espera */",
  );
  fs.writeFileSync(archivo, src);
  console.log("Parche de lectura de Baileys aplicado");
}

aplicar();
