const $ = (sel) => document.querySelector(sel);
const app = $("#app");
const form = $("#form-cota");

function esc(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function urlSegura(valor) {
  const t = String(valor || "").trim();
  if (t.startsWith("/marca/") || t.startsWith("/media/") || t.startsWith("https://")) return t;
  return "";
}

function aplicarEstilo(estilo) {
  const mapa = {
    fondo: "--fondo",
    profundo: "--profundo",
    morado: "--morado",
    acento: "--acento",
    rosado: "--rosado",
    lavanda: "--lavanda",
    rosadoPastel: "--rosado-pastel",
    tarjetaLila: "--tarjeta-lila",
    tarjetaRosa: "--tarjeta-rosa",
    texto: "--texto",
    textoSuave: "--texto-suave",
    textoOscuroSuave: "--texto-oscuro-suave",
  };
  const root = document.documentElement;
  for (const [clave, variable] of Object.entries(mapa)) {
    if (/^#[0-9a-fA-F]{6}$/.test(estilo[clave] || "")) root.style.setProperty(variable, estilo[clave]);
  }
}

function telefonoWa(numero) {
  const digits = String(numero || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 10) return "57" + digits;
  return digits;
}

function fragmento(id, nombre, enredo) {
  const quien = esc(nombre || "Tu negocio");
  const lio = esc(enredo || "Lo que hoy se te enreda");
  if (id === "chatbots") {
    return `<div class="frag" data-ui>
      <p class="frag-nota">WhatsApp</p>
      <p class="burbuja"><b>${quien}</b><br>Hola. ¿Qué necesitas?</p>
      <p class="burbuja mia">El horario de hoy</p>
      <p class="burbuja">Te lo digo en una frase, y si hace falta pasa con una persona.</p>
    </div>`;
  }
  if (id === "boleteria") {
    return `<div class="frag" data-ui>
      <p class="frag-nota">Boleta</p>
      <p class="frag-titulo">${quien}</p>
      <p>Una función · una entrada · sabes quién ya entró</p>
      <p class="frag-butaca">Butaca libre</p>
    </div>`;
  }
  if (id === "software") {
    return `<div class="frag" data-ui>
      <p class="frag-nota">El sistema</p>
      <p class="frag-titulo">${lio}</p>
      <ul>
        <li>Anotado</li>
        <li>En curso</li>
        <li>Listo</li>
      </ul>
    </div>`;
  }
  return `<div class="frag" data-ui>
    <p class="frag-nota">La página</p>
    <p class="frag-titulo">${quien}</p>
    <p>Qué haces, en claro, y un camino para escribirte.</p>
    <p class="frag-boton">Escribir</p>
  </div>`;
}

function etapa(n, nombre) {
  const quien = esc(nombre || "tu negocio");
  if (n === 1) {
    return `<div class="frag" data-ui>
      <p class="frag-nota">En el taller</p>
      <p class="frag-titulo">${quien}</p>
      <p>La página, el chat o el sistema, con la cara de tu negocio.</p>
    </div>`;
  }
  if (n === 2) {
    return `<div class="frag" data-ui>
      <p class="frag-nota">Quedó listo</p>
      <p class="frag-titulo">Así se usa</p>
      <ul>
        <li>Entras</li>
        <li>Lo usas</li>
        <li>No dependes de nadie cada semana</li>
      </ul>
    </div>`;
  }
  return `<div class="frag" data-ui>
    <p class="frag-nota">Con tus palabras</p>
    <p class="frag-titulo">Quiero algo para ${quien}</p>
    <p>Sin tener que sonar técnico.</p>
  </div>`;
}

function instalarPixel(id) {
  const pixel = String(id || "").replace(/\D/g, "");
  if (!/^\d{8,20}$/.test(pixel)) return;
  if (document.documentElement.dataset.pixel === pixel) return;
  document.documentElement.dataset.pixel = pixel;
  if (!window.fbq) {
    const n = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    window.fbq = n;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const primero = document.getElementsByTagName("script")[0];
    primero.parentNode.insertBefore(script, primero);
  }
  window.fbq("init", pixel);
  window.fbq("track", "PageView");
}

function pintar(sitio) {
  aplicarEstilo(sitio.estilo || {});
  const marca = sitio.marca || {};
  instalarPixel(marca.pixel);
  const logoOscuro = urlSegura(marca.logoOscuro) || "/marca/logo-oscuro.jpg";
  const logoClaro = urlSegura(marca.logoClaro) || "/marca/logo-claro.jpg";
  const quienes = sitio.quienes || {};
  const pasos = (sitio.pasos && sitio.pasos.items) || [];
  const para = (sitio.paraQuien && sitio.paraQuien.items) || [];
  const servicios = sitio.servicios || [];
  const contacto = sitio.contacto || {};
  const cierre = sitio.cierre || {};
  const hero = sitio.hero || {};
  const tituloHero = String(hero.titulo || "Tu negocio, claro para quien te visita.").trim();
  const lineasHero = tituloHero === "Tu negocio, claro para quien te visita."
    ? ["Tu negocio,", "claro para", "quien te visita."]
    : [tituloHero];
  const pruebas = Array.isArray(hero.pruebas) ? hero.pruebas : [];
  document.title = "TAVADEV · " + (tituloHero || "Páginas, chats y sistemas");

  const bloques = servicios.map((item, i) => `<article class="capaz" data-reveal style="--d:${i * 70}ms">
      <p class="frase">${esc(item.nombre)}</p>
      <p>${esc(item.resumen)}</p>
      <button type="button" class="boton boton-linea" data-servicio="${esc(item.id)}">Ver ${esc(item.nombre)}</button>
    </article>`).join("");

  const filas = para.map((item) => `<li>${esc(item)}</li>`).join("");
  const nombres = pasos.map((item, i) => `<span data-etapa="${i}">${esc(item.titulo)}</span>`).join("");

  const links = [];
  if (contacto.correo) links.push(`<a href="mailto:${esc(contacto.correo)}">${esc(contacto.correo)}</a>`);
  if (contacto.whatsapp) links.push(`<a href="https://wa.me/${esc(telefonoWa(contacto.whatsapp))}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (contacto.instagram) {
    const ig = String(contacto.instagram).replace(/^@/, "");
    const href = ig.startsWith("http") ? ig : "https://instagram.com/" + ig;
    links.push(`<a href="${esc(href)}" target="_blank" rel="noopener">Instagram</a>`);
  }
  const contactoHtml = links.length ? links.join("") : `<a href="#cotizar">Pedir cotización</a>`;

  app.innerHTML = `
    <section class="hero" id="inicio">
      <svg class="neuronas" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g class="red" fill="none" stroke="currentColor" stroke-width="1.25">
          <path d="M70 150 L210 230 L150 390 L320 470" />
          <path d="M210 230 L390 150 L560 280" />
          <path d="M320 470 L520 620 L700 540" />
          <path d="M860 300 L1040 180 L1220 250" />
          <path d="M980 160 L1120 310 L1040 470 L1220 560" />
          <path d="M900 560 L1080 640 L1260 500" />
          <path d="M700 540 L860 420 L1040 470" />
          <path class="impulso" d="M390 150 L640 90 L860 210 L1040 180" />
          <path class="impulso impulso-lento" d="M560 280 L760 360 L900 560 L1080 640" />
        </g>
        <g class="nodos">
          <circle cx="70" cy="150" r="3.2" />
          <circle cx="210" cy="230" r="3.4" />
          <circle class="nodo-pulso" style="--p:0s" cx="150" cy="390" r="4" />
          <circle cx="320" cy="470" r="3" />
          <circle cx="390" cy="150" r="3.2" />
          <circle class="nodo-rosa nodo-pulso" style="--p:1.4s" cx="560" cy="280" r="4.2" />
          <circle cx="520" cy="620" r="3" />
          <circle cx="700" cy="540" r="3.4" />
          <circle cx="640" cy="90" r="2.8" />
          <circle class="nodo-pulso" style="--p:0.6s" cx="860" cy="210" r="4" />
          <circle cx="860" cy="300" r="3" />
          <circle cx="860" cy="420" r="3.2" />
          <circle class="nodo-rosa" cx="980" cy="160" r="3.6" />
          <circle class="nodo-rosa nodo-pulso" style="--p:2.1s" cx="1040" cy="180" r="5" />
          <circle cx="1120" cy="310" r="3.4" />
          <circle class="nodo-pulso" style="--p:1s" cx="1040" cy="470" r="4.4" />
          <circle cx="1220" cy="250" r="3" />
          <circle class="nodo-rosa" cx="1220" cy="560" r="3.6" />
          <circle cx="900" cy="560" r="3.2" />
          <circle class="nodo-pulso" style="--p:2.8s" cx="1080" cy="640" r="4.6" />
          <circle cx="1260" cy="500" r="3" />
        </g>
      </svg>
      <div class="hero-copia">
        <p class="hero-etiqueta" data-load style="--d:40ms">${esc(hero.etiqueta || "Para gente sencilla")}</p>
        <h1 class="hero-titulo lines">
          ${lineasHero.map((linea, i) => `<span class="line"><span data-line style="--i:${i}">${esc(linea)}</span></span>`).join("")}
        </h1>
        <p class="hero-acento" data-load style="--d:260ms">${esc(hero.acento || "")}</p>
        <p class="hero-bajada" data-load style="--d:320ms">${esc(hero.bajada || "")}</p>
        <div class="hero-acciones" data-load style="--d:380ms">
          <a class="boton boton-pill" href="#cotizar">${esc(hero.boton || "Quiero una cotización")}</a>
          <a class="boton boton-ghost" href="#armamos">${esc(hero.secundario || "Ver qué hacemos")}</a>
        </div>
        <ul class="hero-pruebas" data-load style="--d:440ms">${pruebas.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
      </div>
      <figure class="logo-hero">
        <img src="${esc(logoOscuro)}" alt="Logo de TAVADEV: una figura en el escenario, entre signos de código" width="640" height="640" fetchpriority="high" />
      </figure>
    </section>
    <section class="capitulo acerca" id="acerca">
      <div>
        <h2 data-reveal>Nace en el escenario</h2>
        <div class="columnas" data-reveal>
          <p><b>TAVADEV</b> nace en el <mark class="m1">escenario</mark>, entre personajes. En <mark class="m2">TAVA</mark>, nuestro grupo de teatro, aprendimos que para construir un personaje primero hay que <mark class="m3">escuchar</mark>, observar y ponerse en los zapatos del otro. Hoy hacemos ese mismo ejercicio con cada cliente: conocemos a las personas detrás de cada negocio, entendemos qué necesitan de verdad y solo entonces diseñamos una solución tecnológica <mark class="m4">sencilla</mark>, cercana y hecha a su medida.</p>
          <p><a class="remate" href="#cotizar">Cuéntanos qué se te enreda.</a></p>
        </div>
      </div>
      <img class="logo-claro" data-reveal src="${esc(logoClaro)}" alt="Logo de TAVADEV sobre fondo claro" width="640" height="640" />
    </section>
    <section class="capitulo arma" id="armamos">
      <div class="arma-fijo">
        <div id="previa">${fragmento(servicios[0] && servicios[0].id, "", "")}</div>
      </div>
      <div class="arma-texto">
        <h2 data-reveal>Qué armamos</h2>
        <article class="capaz" data-reveal>
          <p class="frase">El nombre, en la pieza</p>
          <p>Escribe cómo se llama el negocio, la obra o el proyecto. Aparece en lo que estás viendo.</p>
          <label>Nombre
            <input id="nombre-vivo" maxlength="80" value="" />
          </label>
        </article>
        ${bloques}
        <article class="capaz" data-reveal>
          <p class="frase">Qué se te enreda</p>
          <p>Si es un sistema, dinos el lío en una frase. Queda escrito en la pieza.</p>
          <label>En una frase
            <input id="enredo-vivo" maxlength="120" />
          </label>
        </article>
      </div>
    </section>
    <section class="capitulo como" id="como">
      <div class="como-izq">
        <h2 id="clausula">Primero<br>nos cuentas</h2>
        <p id="clausula-texto">${esc(pasos[0] ? pasos[0].texto : "")}</p>
      </div>
      <div class="como-der" id="etapa-vista">${etapa(0, "")}</div>
      <div class="riel-caja">
        <div class="riel" aria-hidden="true"><div class="riel-lleno" id="riel-lleno"></div></div>
        <label class="sr" for="pasos-rango">El recorrido</label>
        <input id="pasos-rango" type="range" min="0" max="${Math.max(pasos.length - 1, 0)}" step="1" value="0" />
        <div class="riel-nombres" id="riel-nombres">${nombres}</div>
      </div>
    </section>
    <section class="capitulo para" id="para">
      <h2 data-reveal>Aunque no sepas<br>de tecnología</h2>
      <ul data-reveal>${filas}</ul>
    </section>
    <section class="capitulo cotizar" id="cotizar">
      <div class="cotizar-texto" data-reveal>
        <h2>Cuéntanos<br>el enredo</h2>
        <p>${esc(cierre.texto || "No publicamos precios. Cada caso es distinto.")}</p>
      </div>
      <div id="hueco-form" data-reveal></div>
    </section>
    <footer class="pie">
      <div class="baldosa" data-reveal>
        <p>${esc(marca.frase || "Soluciones tecnológicas sencillas para gente sencilla")}</p>
        <p class="legal">${esc(marca.aparte || "un apartado de TAVA · Teatro")}</p>
      </div>
      <nav class="baldosa" aria-label="Mapa">
        <a href="#inicio">Inicio</a>
        <a href="#armamos">Qué armamos</a>
        <a href="#como">Cómo</a>
        <a href="#para">Para ti</a>
      </nav>
      <div class="baldosa">
        <p>TAVA · Teatro</p>
        <p class="legal">De ahí sale esta casa</p>
      </div>
      <div class="baldosa baldosa-mail">${contactoHtml}</div>
      <div class="baldosa baldosa-nombre" data-reveal><p>TAVADEV</p></div>
      <a class="baldosa baldosa-cta" href="#cotizar" data-reveal>
        <span>Hablemos</span>
        <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 32h40M36 16l16 16-16 16" fill="none" stroke="currentColor" stroke-width="4"/></svg>
      </a>
    </footer>`;

  const select = form.servicioId;
  select.innerHTML = servicios.map((item) => `<option value="${esc(item.id)}">${esc(item.nombre)}</option>`).join("");
  form.hidden = false;
  $("#hueco-form").append(form);

  const previa = $("#previa");
  const nombreVivo = $("#nombre-vivo");
  const enredoVivo = $("#enredo-vivo");
  let servicioActual = (servicios[0] && servicios[0].id) || "landing";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function marcarEntrada(el) {
    if (!el || reduce) return;
    const pieza = el.querySelector(".frag") || el;
    pieza.classList.remove("entra");
    void pieza.offsetWidth;
    pieza.classList.add("entra");
  }

  function refrescar(animar) {
    const nombre = nombreVivo.value.trim();
    previa.innerHTML = fragmento(servicioActual, nombre, enredoVivo.value.trim());
    if (animar) marcarEntrada(previa);
    if (nombre) form.nombre.value = nombre;
    if (enredoVivo.value.trim()) form.mensaje.value = enredoVivo.value.trim();
    if ([...select.options].some((op) => op.value === servicioActual)) select.value = servicioActual;
    const vistaEtapa = $("#etapa-vista");
    if (vistaEtapa) vistaEtapa.innerHTML = etapa(Number($("#pasos-rango").value), nombre);
  }

  nombreVivo.addEventListener("input", refrescar);
  enredoVivo.addEventListener("input", refrescar);
  document.querySelectorAll("[data-servicio]").forEach((btn) => {
    btn.onclick = () => {
      servicioActual = btn.dataset.servicio;
      document.querySelectorAll("[data-servicio]").forEach((b) => b.classList.toggle("activo", b === btn));
      refrescar(true);
    };
  });

  const rango = $("#pasos-rango");
  const clausulas = [
    ["Primero", "nos cuentas"],
    ["Luego", "lo armamos"],
    ["Después", "te lo dejamos"],
  ];
  function pintarEtapa(animar) {
    const i = Number(rango.value);
    const par = clausulas[i] || clausulas[0];
    const clausula = $("#clausula");
    clausula.innerHTML = `${esc(par[0])}<br>${esc(par[1])}`;
    if (animar) marcarEntrada(clausula);
    const item = pasos[i];
    $("#clausula-texto").textContent = item ? item.texto : "";
    const max = Math.max(Number(rango.max), 1);
    $("#riel-lleno").style.transform = `scaleX(${i / max})`;
    document.querySelectorAll("[data-etapa]").forEach((el) => {
      el.classList.toggle("activa", Number(el.dataset.etapa) === i);
    });
    refrescar(false);
    if (animar) marcarEntrada($("#etapa-vista"));
  }
  rango.addEventListener("input", () => pintarEtapa(true));
  pintarEtapa(false);
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));
  }
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const error = $("#error-cota");
  error.hidden = true;
  const datos = Object.fromEntries(new FormData(form).entries());
  const boton = form.querySelector("button[type=submit]");
  boton.disabled = true;
  boton.textContent = "Enviando";
  try {
    const res = await fetch("/api/cotizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "No se pudo enviar");
    form.reset();
    error.className = "exito";
    error.hidden = false;
    error.textContent = "Quedó anotada. Te escribimos pronto.";
  } catch (err) {
    error.className = "error";
    error.hidden = false;
    error.textContent = err.message;
  } finally {
    boton.disabled = false;
    boton.textContent = "Enviar solicitud";
  }
});

fetch("/api/sitio")
  .then((res) => {
    if (!res.ok) throw new Error("sin sitio");
    return res.json();
  })
  .then(pintar)
  .catch(() => {
    app.innerHTML = "<p class='cargando'>No pude cargar la página. Recarga en un momento.</p>";
  });
