const crypto = require("crypto");
const path = require("path");
const express = require("express");
const multer = require("multer");
const contenido = require("./bot/contenido");
const operacion = require("./bot/operacion");
const qrWeb = require("./bot/qr-web");

const intentosClave = new Map();
const intentosCota = new Map();
let getGrupos = async () => ({ conectado: false, grupos: [] });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function manejar(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      console.error(error);
      if (!res.headersSent) res.status(500).json({ error: error.message || "No se pudo completar" });
    });
  };
}

function clavePanel() {
  return String(process.env.PANEL_CLAVE || "");
}

function mismaClave(dada) {
  const esperada = clavePanel();
  if (!esperada || !dada) return false;
  const a = crypto.createHash("sha256").update(String(dada)).digest();
  const b = crypto.createHash("sha256").update(esperada).digest();
  return crypto.timingSafeEqual(a, b);
}

function firmaDe(cuerpo) {
  return crypto.createHmac("sha256", clavePanel() || "tavadev").update(String(cuerpo)).digest("hex");
}

function leerMarca(req) {
  if (!clavePanel()) return null;
  const trozo = String(req.headers.cookie || "")
    .split(";")
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith("panel="));
  if (!trozo) return null;
  const valor = decodeURIComponent(trozo.slice("panel=".length));
  const partes = valor.split(".");
  if (partes.length < 2) return null;
  const firma = partes.pop();
  const cuerpo = partes.join(".");
  const expira = partes[0];
  if (!/^\d+$/.test(expira) || Number(expira) < Date.now()) return null;
  const esperada = firmaDe(cuerpo);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return { usuarioId: partes.slice(1).join(".") };
}

async function cargarSesion(req) {
  const marca = leerMarca(req);
  if (!marca) return null;
  if (!marca.usuarioId) {
    return { maestro: true, papel: "admin", personaId: "", usuarioId: "", usuario: "", nombre: "Administración" };
  }
  const usuario = await operacion.obtenerUsuario(marca.usuarioId);
  if (!usuario || usuario.activo === false) return null;
  return {
    maestro: false,
    papel: usuario.papel,
    personaId: usuario.personaId,
    usuarioId: usuario.id,
    usuario: usuario.usuario,
    nombre: usuario.nombre || usuario.usuario,
  };
}

function ipDe(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket?.remoteAddress || "local";
}

function demasiados(mapa, ip, limite) {
  const ahora = Date.now();
  const lista = (mapa.get(ip) || []).filter((t) => ahora - t < 10 * 60 * 1000);
  mapa.set(ip, lista);
  return lista.length >= limite;
}

function anotarIntento(mapa, ip) {
  const lista = mapa.get(ip) || [];
  lista.push(Date.now());
  mapa.set(ip, lista);
}

function ponerCookie(res, usuarioId) {
  const expira = Date.now() + 14 * 24 * 60 * 60 * 1000;
  const cuerpo = usuarioId ? expira + "." + usuarioId : String(expira);
  const token = cuerpo + "." + firmaDe(cuerpo);
  res.cookie("panel", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 60 * 60 * 1000,
    secure: Boolean(process.env.RENDER),
  });
}

function paginaLogin(error) {
  const aviso = error ? `<p class="mal">${error}</p>` : "";
  const falta = !clavePanel()
    ? `<p class="mal">Falta PANEL_CLAVE en el entorno. Sin esa clave el panel no abre.</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Entrar · TAVADEV</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/panel-assets/estilos.css" />
</head>
<body class="login-body">
  <form class="login" id="entrar">
    <p class="marca-login"><span>TAVA</span><span>DEV</span></p>
    <h1>Panel</h1>
    <p>Entra con tu usuario del equipo. Si usas la contraseña general, deja el usuario vacío.</p>
    ${falta}
    <label for="usuario">Usuario</label>
    <input id="usuario" autocomplete="username" />
    <label for="clave">Contraseña</label>
    <input id="clave" type="password" autocomplete="current-password" autofocus required />
    <button type="submit">Entrar</button>
    ${aviso}
  </form>
  <script>
    document.getElementById("entrar").addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const clave = document.getElementById("clave").value;
      const usuario = document.getElementById("usuario").value;
      const res = await fetch("/api/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let mal = document.querySelector(".mal.respuesta");
        if (!mal) {
          mal = document.createElement("p");
          mal.className = "mal respuesta";
          evento.target.appendChild(mal);
        }
        mal.textContent = data.error || "No pude entrar";
        return;
      }
      location.href = "/panel";
    });
  </script>
</body>
</html>`;
}

function exigirPanel(req, res, next) {
  cargarSesion(req).then((sesion) => {
    if (!sesion) {
      if (String(req.originalUrl || "").startsWith("/api/")) {
        return res.status(401).json({ error: "Entra con la contraseña" });
      }
      return res.redirect("/panel");
    }
    req.sesion = sesion;
    next();
  }).catch((error) => {
    if (!res.headersSent) res.status(500).json({ error: error.message || "No se pudo revisar la sesión" });
  });
}

function esEquipo(req) {
  return req.sesion && !req.sesion.maestro && req.sesion.papel !== "admin";
}

function permiteEquipo(req) {
  const m = req.method;
  const p = req.path;
  if (m === "GET" && ["/sesion", "/sitio", "/estado", "/personas", "/equipos", "/disponibilidades", "/chats", "/mensajes", "/roles", "/caracteristicas", "/organigrama", "/tablero"].includes(p)) return true;
  if (m === "POST" && ["/chats", "/mensajes", "/personas", "/tareas", "/tareas/orden", "/notas", "/epicas", "/sprints", "/actividad-estados"].includes(p)) return true;
  if (m === "POST" && /^\/chats\/[^/]+\/miembros$/.test(p)) return true;
  if (m === "POST" && /^\/chats\/[^/]+$/.test(p)) return true;
  if (m === "POST" && /^\/actividad-estados\/[^/]+\/mover$/.test(p)) return true;
  if (m === "DELETE" && /^\/tareas\/[^/]+$/.test(p)) return true;
  if (m === "DELETE" && /^\/notas\/[^/]+$/.test(p)) return true;
  return false;
}

function iniciar(puerto, extras = {}) {
  if (extras.getGrupos) getGrupos = extras.getGrupos;
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));

  app.get("/salud", (_req, res) => {
    res.type("text").send("ok");
  });

  app.use("/marca", express.static(path.join(__dirname, "publico", "marca"), { maxAge: "1h" }));
  app.use("/media", express.static(contenido.carpetaMedia, { maxAge: "1h" }));
  app.use(express.static(path.join(__dirname, "publico")));

  app.get("/api/sitio", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(contenido.sitioPublico());
  });

  app.post("/api/cotizar", manejar(async (req, res) => {
    const ip = ipDe(req);
    if (demasiados(intentosCota, ip, 6)) {
      return res.status(429).json({ error: "Ya enviaste varias solicitudes. Espera unos minutos." });
    }
    const cuerpo = req.body || {};
    if (cuerpo.empresa_web) return res.json({ ok: true });
    anotarIntento(intentosCota, ip);
    const sitio = contenido.getSitio();
    const servicio = sitio.servicios.find((item) => item.id === cuerpo.servicioId && item.activo);
    if (!servicio) return res.status(400).json({ error: "Elige un servicio" });
    const nombre = String(cuerpo.nombre || "").trim();
    const mensaje = String(cuerpo.mensaje || "").trim();
    if (nombre.length < 2) return res.status(400).json({ error: "Escribe tu nombre" });
    if (mensaje.length < 8) return res.status(400).json({ error: "Cuéntanos un poco más, aunque sea en una frase" });
    const cota = await contenido.guardarCotizacion({
      origen: "pagina",
      servicioId: servicio.id,
      servicioNombre: servicio.nombre,
      nombre,
      negocio: cuerpo.negocio,
      celular: cuerpo.celular,
      mensaje,
      estado: "nueva",
    });
    contenido.avisarCotizacion(cota).catch(() => {});
    res.json({ ok: true, id: cota.id });
  }));

  app.post("/api/entrar", manejar(async (req, res) => {
    const ip = ipDe(req);
    if (!clavePanel()) return res.status(503).json({ error: "El panel todavía no tiene contraseña" });
    if (demasiados(intentosClave, ip, 8)) {
      return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
    }
    const usuario = String((req.body && req.body.usuario) || "").trim();
    const clave = String((req.body && req.body.clave) || "");
    if (!usuario) {
      if (!mismaClave(clave)) {
        anotarIntento(intentosClave, ip);
        return res.status(401).json({ error: "Contraseña incorrecta" });
      }
      intentosClave.delete(ip);
      ponerCookie(res, "");
      return res.json({ ok: true, maestro: true });
    }
    let hallado = null;
    try {
      hallado = await operacion.entrarUsuario(usuario, clave);
    } catch (error) {
      return res.status(503).json({ error: error.message || "No pude revisar el usuario" });
    }
    if (!hallado) {
      anotarIntento(intentosClave, ip);
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }
    intentosClave.delete(ip);
    ponerCookie(res, hallado.id);
    res.json({ ok: true, maestro: false });
  }));

  app.post("/api/salir", (_req, res) => {
    res.clearCookie("panel", { path: "/" });
    res.json({ ok: true });
  });

  app.get("/panel", (req, res) => {
    cargarSesion(req).then((sesion) => {
      if (!sesion) return res.type("html").send(paginaLogin());
      res.sendFile(path.join(__dirname, "panel", "index.html"));
    }).catch((error) => {
      res.type("html").send(paginaLogin(error.message || "No pude revisar la sesión"));
    });
  });
  app.use("/panel-assets", express.static(path.join(__dirname, "panel")));

  const panel = express.Router();
  panel.use(exigirPanel);
  panel.use((req, res, next) => {
    if (!esEquipo(req) || permiteEquipo(req)) return next();
    res.status(403).json({ error: "Tu usuario entra al chat y a las actividades" });
  });

  panel.get("/sesion", (req, res) => {
    res.json(req.sesion);
  });

  panel.get("/estado", (_req, res) => {
    res.json({ supabase: contenido.usaSupabase(), whatsapp: qrWeb.resumen() });
  });

  panel.get("/sitio", (_req, res) => {
    res.json(contenido.getSitio());
  });

  panel.put("/sitio", manejar(async (req, res) => {
    const guardado = await contenido.guardarSitio(req.body || {});
    res.json(guardado);
  }));

  panel.post("/media", upload.single("archivo"), manejar(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Falta la imagen" });
    const url = await contenido.subirMedia(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ url });
  }));

  panel.get("/cotizaciones", manejar(async (_req, res) => {
    res.json(await contenido.listarCotizaciones());
  }));

  panel.patch("/cotizaciones/:id", manejar(async (req, res) => {
    const actual = await contenido.actualizarCotizacion(req.params.id, req.body || {});
    if (!actual) return res.status(404).json({ error: "No está esa cotización" });
    res.json(actual);
  }));

  panel.delete("/cotizaciones/:id", manejar(async (req, res) => {
    await contenido.borrarCotizacion(req.params.id);
    res.json({ ok: true });
  }));

  panel.get("/estados", manejar(async (req, res) => {
    const ambito = req.query.ambito === "pedido" || req.query.ambito === "cliente" ? req.query.ambito : undefined;
    res.json(await operacion.listarEstados(ambito));
  }));

  panel.post("/estados", manejar(async (req, res) => {
    res.json(await operacion.guardarEstado(req.body || {}));
  }));

  panel.post("/estados/:id/mover", manejar(async (req, res) => {
    const lista = await operacion.moverEstado(req.params.id, Number(req.body && req.body.delta) || 0);
    if (!lista) return res.status(404).json({ error: "No está ese estado" });
    res.json(lista);
  }));

  panel.delete("/estados/:id", manejar(async (req, res) => {
    await operacion.borrarEstado(req.params.id);
    res.json({ ok: true });
  }));

  panel.get("/clientes", manejar(async (req, res) => {
    const [clientes, cotas] = await Promise.all([operacion.listarClientes(), contenido.listarCotizaciones()]);
    const por = {};
    cotas.forEach((item) => {
      if (!item.clienteId) return;
      if (!por[item.clienteId]) por[item.clienteId] = [];
      por[item.clienteId].push(item);
    });
    res.json(clientes.map((item) => ({ ...item, solicitudes: por[item.id] || [] })));
  }));

  panel.post("/clientes", manejar(async (req, res) => {
    const cuerpo = req.body || {};
    res.json(await operacion.anotarCliente({ ...cuerpo, origen: cuerpo.origen || "panel", forzarEstado: Boolean(cuerpo.estadoId) }));
  }));

  panel.patch("/clientes/:id", manejar(async (req, res) => {
    const cuerpo = req.body || {};
    const actual = await operacion.actualizarCliente(req.params.id, cuerpo);
    if (!actual) return res.status(404).json({ error: "No está ese cliente" });
    if (cuerpo.estadoId) await contenido.propagarEstadoCliente(actual.id, actual.estadoId);
    res.json(actual);
  }));

  panel.delete("/clientes/:id", manejar(async (req, res) => {
    await operacion.borrarCliente(req.params.id);
    await contenido.borrarCotizacionesDeCliente(req.params.id);
    res.json({ ok: true });
  }));

  panel.get("/pedidos", manejar(async (_req, res) => {
    res.json(await operacion.listarPedidos());
  }));

  panel.post("/pedidos", manejar(async (req, res) => {
    res.json(await operacion.guardarPedido(req.body || {}));
  }));

  panel.delete("/pedidos/:id", manejar(async (req, res) => {
    await operacion.borrarPedido(req.params.id);
    res.json({ ok: true });
  }));

  panel.get("/equipos", manejar(async (_req, res) => {
    res.json(await operacion.listarEquipos());
  }));

  panel.post("/equipos", manejar(async (req, res) => {
    res.json(await operacion.guardarEquipo(req.body || {}));
  }));

  panel.delete("/equipos/:id", manejar(async (req, res) => {
    await operacion.borrarEquipo(req.params.id);
    res.json({ ok: true });
  }));

  panel.get("/personas", manejar(async (_req, res) => {
    res.json(await operacion.listarPersonas());
  }));

  panel.post("/personas", manejar(async (req, res) => {
    let cuerpo = req.body || {};
    if (esEquipo(req)) {
      if (!cuerpo.id || cuerpo.id !== req.sesion.personaId) {
        return res.status(403).json({ error: "Solo puedes actualizar tu ficha" });
      }
      const actuales = await operacion.listarPersonas();
      const propia = actuales.find((item) => item.id === cuerpo.id);
      if (!propia) return res.status(404).json({ error: "No está tu ficha" });
      cuerpo = { ...propia, apodo: cuerpo.apodo, disponibilidadId: cuerpo.disponibilidadId };
    }
    res.json(await operacion.guardarPersona(cuerpo));
  }));

  panel.delete("/personas/:id", manejar(async (req, res) => {
    await operacion.borrarPersona(req.params.id);
    res.json({ ok: true });
  }));

  panel.get("/disponibilidades", manejar(async (_req, res) => {
    res.json(await operacion.listarDisponibilidades());
  }));

  panel.post("/disponibilidades", manejar(async (req, res) => {
    res.json(await operacion.guardarDisponibilidad(req.body || {}));
  }));

  panel.delete("/disponibilidades/:id", manejar(async (req, res) => {
    await operacion.borrarDisponibilidad(req.params.id);
    res.json({ ok: true });
  }));

  panel.get("/chats", manejar(async (_req, res) => {
    res.json(await operacion.listarChats());
  }));

  panel.post("/chats", manejar(async (req, res) => {
    const cuerpo = req.body || {};
    if (esEquipo(req)) {
      const ids = Array.isArray(cuerpo.personaIds) ? cuerpo.personaIds.map(String) : [];
      if (!ids.includes(req.sesion.personaId)) ids.push(req.sesion.personaId);
      cuerpo.personaIds = ids;
    }
    res.json(await operacion.abrirChat(cuerpo));
  }));

  panel.post("/chats/:id", manejar(async (req, res) => {
    res.json(await operacion.renombrarChat(req.params.id, (req.body || {}).nombre));
  }));

  panel.post("/chats/:id/miembros", manejar(async (req, res) => {
    await operacion.agregarAlChat(req.params.id, (req.body || {}).personaId);
    res.json({ ok: true });
  }));

  panel.get("/mensajes", manejar(async (req, res) => {
    res.json(await operacion.listarMensajes(String(req.query.chat || "")));
  }));

  panel.post("/mensajes", manejar(async (req, res) => {
    const cuerpo = req.body || {};
    if (esEquipo(req)) cuerpo.personaId = req.sesion.personaId;
    res.json(await operacion.guardarMensaje(cuerpo));
  }));

  panel.get("/organigrama/sql", manejar(async (_req, res) => {
    res.json({ sql: await operacion.sqlOrganigrama() });
  }));

  panel.get("/organigrama", manejar(async (_req, res) => {
    res.json(await operacion.organigrama());
  }));

  panel.get("/roles", manejar(async (_req, res) => {
    res.json(await operacion.listarRoles());
  }));

  panel.post("/roles", manejar(async (req, res) => {
    res.json(await operacion.guardarRol(req.body || {}));
  }));

  panel.delete("/roles/:id", manejar(async (req, res) => {
    await operacion.borrarRol(req.params.id);
    res.json({ ok: true });
  }));

  panel.get("/caracteristicas", manejar(async (_req, res) => {
    res.json(await operacion.listarCaracteristicas());
  }));

  panel.post("/caracteristicas", manejar(async (req, res) => {
    res.json(await operacion.guardarCaracteristica(req.body || {}));
  }));

  panel.delete("/caracteristicas/:id", manejar(async (req, res) => {
    await operacion.borrarCaracteristica(req.params.id);
    res.json({ ok: true });
  }));

  panel.get("/pausas", manejar(async (_req, res) => {
    res.json(await contenido.listarPausas());
  }));

  panel.post("/pausar", manejar(async (req, res) => {
    res.json(await contenido.pausarChat(req.body || {}));
  }));

  panel.post("/reactivar", manejar(async (req, res) => {
    res.json(await contenido.reactivarChat(req.body || {}));
  }));

  panel.get("/whatsapp", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ...qrWeb.resumen(), logs: qrWeb.logsRecientes(), supabase: contenido.usaSupabase() });
  });

  panel.get("/whatsapp.png", (_req, res) => {
    const png = qrWeb.obtenerPng();
    if (!png) return res.status(404).end();
    res.set("Cache-Control", "no-store");
    res.type("png").send(png);
  });

  panel.get("/grupos", manejar(async (_req, res) => {
    res.json(await getGrupos());
  }));

  panel.get("/colores-marca", (_req, res) => {
    res.json(contenido.coloresDeMarca());
  });

  panel.get("/usuarios", manejar(async (_req, res) => {
    res.json(await operacion.listarUsuarios());
  }));

  panel.post("/usuarios", manejar(async (req, res) => {
    res.json(await operacion.guardarUsuario(req.body || {}));
  }));

  panel.delete("/usuarios/:id", manejar(async (req, res) => {
    await operacion.borrarUsuario(req.params.id);
    res.json({ ok: true });
  }));

  panel.get("/tablero", manejar(async (_req, res) => {
    res.json(await operacion.tablero());
  }));

  panel.post("/actividad-estados", manejar(async (req, res) => {
    res.json(await operacion.guardarActividadEstado(req.body || {}));
  }));

  panel.post("/actividad-estados/:id/mover", manejar(async (req, res) => {
    const lista = await operacion.moverActividadEstado(req.params.id, Number(req.body && req.body.delta) || 0);
    if (!lista) return res.status(404).json({ error: "No está ese estado" });
    res.json(lista);
  }));

  panel.delete("/actividad-estados/:id", manejar(async (req, res) => {
    await operacion.borrarActividadEstado(req.params.id);
    res.json({ ok: true });
  }));

  panel.post("/epicas", manejar(async (req, res) => {
    res.json(await operacion.guardarEpica(req.body || {}));
  }));

  panel.delete("/epicas/:id", manejar(async (req, res) => {
    await operacion.borrarEpica(req.params.id);
    res.json({ ok: true });
  }));

  panel.post("/sprints", manejar(async (req, res) => {
    res.json(await operacion.guardarSprint(req.body || {}));
  }));

  panel.delete("/sprints/:id", manejar(async (req, res) => {
    await operacion.borrarSprint(req.params.id);
    res.json({ ok: true });
  }));

  panel.post("/tareas/orden", manejar(async (req, res) => {
    res.json(await operacion.ordenarTareas(req.body || {}));
  }));

  panel.post("/tareas", manejar(async (req, res) => {
    res.json(await operacion.guardarTarea(req.body || {}));
  }));

  panel.delete("/tareas/:id", manejar(async (req, res) => {
    await operacion.borrarTarea(req.params.id);
    res.json({ ok: true });
  }));

  panel.post("/notas", manejar(async (req, res) => {
    const cuerpo = req.body || {};
    if (esEquipo(req)) cuerpo.personaId = req.sesion.personaId;
    res.json(await operacion.guardarNota(cuerpo));
  }));

  panel.delete("/notas/:id", manejar(async (req, res) => {
    await operacion.borrarNota(req.params.id);
    res.json({ ok: true });
  }));

  app.use("/api/admin", panel);

  const servidor = app.listen(puerto, "0.0.0.0", () => {
    console.log("Página: http://localhost:" + puerto);
    console.log("Panel:  http://localhost:" + puerto + "/panel");
  });
  servidor.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error("El puerto " + puerto + " ya está ocupado. Cierra la otra ventana y vuelve a intentar.");
      process.exit(1);
    }
    throw error;
  });
  return app;
}

module.exports = { iniciar };
