const crypto = require("crypto");
const path = require("path");
const express = require("express");
const multer = require("multer");
const contenido = require("./bot/contenido");
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

function firmaDe(expira) {
  return crypto.createHmac("sha256", clavePanel() || "tavadev").update(String(expira)).digest("hex");
}

function cookiePanel(req) {
  if (!clavePanel()) return false;
  const trozo = String(req.headers.cookie || "")
    .split(";")
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith("panel="));
  if (!trozo) return false;
  const valor = decodeURIComponent(trozo.slice("panel=".length));
  const punto = valor.indexOf(".");
  if (punto < 1) return false;
  const expira = valor.slice(0, punto);
  const firma = valor.slice(punto + 1);
  if (!/^\d+$/.test(expira) || Number(expira) < Date.now()) return false;
  const esperada = firmaDe(expira);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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

function ponerCookie(res) {
  const expira = Date.now() + 14 * 24 * 60 * 60 * 1000;
  const token = `${expira}.${firmaDe(expira)}`;
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
    <p>Entra para cuidar la página, los servicios y las cotizaciones.</p>
    ${falta}
    <label for="clave">Contraseña</label>
    <input id="clave" type="password" autocomplete="current-password" autofocus required />
    <button type="submit">Entrar</button>
    ${aviso}
  </form>
  <script>
    document.getElementById("entrar").addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const clave = document.getElementById("clave").value;
      const res = await fetch("/api/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave }),
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
  if (cookiePanel(req)) return next();
  if (String(req.originalUrl || "").startsWith("/api/")) {
    return res.status(401).json({ error: "Entra con la contraseña" });
  }
  return res.redirect("/panel");
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

  app.post("/api/entrar", (req, res) => {
    const ip = ipDe(req);
    if (!clavePanel()) return res.status(503).json({ error: "El panel todavía no tiene contraseña" });
    if (demasiados(intentosClave, ip, 8)) {
      return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
    }
    if (!mismaClave(req.body && req.body.clave)) {
      anotarIntento(intentosClave, ip);
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }
    intentosClave.delete(ip);
    ponerCookie(res);
    res.json({ ok: true });
  });

  app.post("/api/salir", (_req, res) => {
    res.clearCookie("panel", { path: "/" });
    res.json({ ok: true });
  });

  app.get("/panel", (req, res) => {
    if (!cookiePanel(req)) return res.type("html").send(paginaLogin());
    res.sendFile(path.join(__dirname, "panel", "index.html"));
  });
  app.use("/panel-assets", express.static(path.join(__dirname, "panel")));

  const panel = express.Router();
  panel.use(exigirPanel);

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
