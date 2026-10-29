const $ = (sel) => document.querySelector(sel);
const app = $("#app");
const velo = $("#velo");
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

function pintar(sitio) {
  aplicarEstilo(sitio.estilo || {});
  const hero = sitio.hero || {};
  const marca = sitio.marca || {};
  const logoOscuro = urlSegura(marca.logoOscuro);
  const logoClaro = urlSegura(marca.logoClaro);
  document.title = "TAVADEV · " + (hero.titulo || "Soluciones sencillas");
  $("#hablar").textContent = "Hablemos";

  const pruebas = (hero.pruebas || []).map((item) => `<li>${esc(item)}</li>`).join("");
  const servicios = (sitio.servicios || [])
    .map((item) => {
      const foto = urlSegura(item.imagen);
      return `<article class="servicio tono-${esc(item.tono || "lila")}">
        ${foto ? `<img class="cover" src="${esc(foto)}" alt="" />` : `<div class="icono">${esc(item.icono || "</>")}</div>`}
        <h3>${esc(item.nombre)}</h3>
        <p>${esc(item.resumen)}</p>
        <button type="button" class="boton-solido" data-servicio="${esc(item.id)}">Quiero este</button>
      </article>`;
    })
    .join("");

  const pasos = ((sitio.pasos && sitio.pasos.items) || [])
    .map(
      (item) => `<article class="paso">
        <p class="num">${esc(item.numero)}</p>
        <h3>${esc(item.titulo)}</h3>
        <p>${esc(item.texto)}</p>
      </article>`,
    )
    .join("");

  const para = ((sitio.paraQuien && sitio.paraQuien.items) || []).map((item) => `<li>${esc(item)}</li>`).join("");
  const contacto = sitio.contacto || {};
  const links = [];
  if (contacto.correo) links.push(`<a href="mailto:${esc(contacto.correo)}">${esc(contacto.correo)}</a>`);
  if (contacto.whatsapp) links.push(`<a href="https://wa.me/${esc(telefonoWa(contacto.whatsapp))}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (contacto.instagram) {
    const ig = contacto.instagram.replace(/^@/, "");
    const href = ig.startsWith("http") ? ig : "https://instagram.com/" + ig.replace(/^@/, "");
    links.push(`<a href="${esc(href)}" target="_blank" rel="noopener">Instagram</a>`);
  }
  if (contacto.web) {
    const href = /^https?:\/\//i.test(contacto.web) ? contacto.web : "https://" + contacto.web;
    links.push(`<a href="${esc(href)}" target="_blank" rel="noopener">${esc(contacto.web)}</a>`);
  }

  app.innerHTML = `
    <section class="hero" id="inicio">
      <div>
        <p class="etiqueta">${esc(hero.etiqueta || "")}</p>
        <h1>${esc(hero.titulo || "")}</h1>
        <p class="acento">${esc(hero.acento || "")}</p>
        <p class="bajada">${esc(hero.bajada || "")}</p>
        <div class="acciones">
          <button type="button" class="boton boton-claro" id="abrir">${esc(hero.boton || "Quiero una cotización")}</button>
          <a class="boton boton-linea" href="#catalogo">${esc(hero.secundario || "Ver qué hacemos")}</a>
        </div>
        <ul class="pruebas">${pruebas}</ul>
      </div>
      ${logoOscuro ? `<div class="placa"><img src="${esc(logoOscuro)}" alt="TAVADEV" /></div>` : ""}
    </section>
    <section class="bloque">
      <div class="quienes">
        <div class="angosto">
          <p class="etiqueta">${esc((sitio.quienes && sitio.quienes.etiqueta) || "")}</p>
          <h2>${esc((sitio.quienes && sitio.quienes.titulo) || "")}</h2>
          <p>${esc((sitio.quienes && sitio.quienes.texto) || "")}</p>
        </div>
        ${logoClaro ? `<img class="marca-clara" src="${esc(logoClaro)}" alt="Marca TAVADEV" />` : ""}
      </div>
    </section>
    <section class="bloque" id="catalogo" style="padding-top:0">
      <p class="etiqueta">02  /  CATÁLOGO</p>
      <h2>Qué podemos armarte</h2>
      <div class="catalogo">${servicios}</div>
    </section>
    <section class="bloque" style="padding-top:0">
      <p class="etiqueta">${esc((sitio.pasos && sitio.pasos.etiqueta) || "")}</p>
      <h2>${esc((sitio.pasos && sitio.pasos.titulo) || "")}</h2>
      <div class="pasos">${pasos}</div>
    </section>
    <section class="bloque para">
      <p class="etiqueta">${esc((sitio.paraQuien && sitio.paraQuien.etiqueta) || "")}</p>
      <h2>${esc((sitio.paraQuien && sitio.paraQuien.titulo) || "")}</h2>
      <ul class="lista">${para}</ul>
    </section>
    <section class="bloque cierre">
      <p class="etiqueta">${esc((sitio.cierre && sitio.cierre.etiqueta) || "")}</p>
      <h2>${esc((sitio.cierre && sitio.cierre.titulo) || "")}</h2>
      <p>${esc((sitio.cierre && sitio.cierre.texto) || "")}</p>
      <div class="acciones">
        <button type="button" class="boton boton-claro" id="abrir-cierre">${esc((sitio.cierre && sitio.cierre.boton) || "Pedir cotización")}</button>
      </div>
    </section>
    <footer class="pie">
      <div>
        <div class="wordmark"><span class="tava">TAVA</span><span class="dev">DEV</span></div>
        <p class="aparte">&lt;/&gt; ${esc(marca.aparte || "")}</p>
        <p class="aparte">${esc(marca.frase || "")}</p>
      </div>
      <div class="contactos">${links.join("")}</div>
    </footer>`;

  const select = form.servicioId;
  select.innerHTML = (sitio.servicios || [])
    .map((item) => `<option value="${esc(item.id)}">${esc(item.nombre)}</option>`)
    .join("");

  const wa = $("#wa");
  const destino = telefonoWa(contacto.whatsapp);
  if (destino) {
    wa.hidden = false;
    wa.href = "https://wa.me/" + destino;
  } else {
    wa.hidden = true;
  }

  $("#abrir").onclick = () => abrir();
  $("#abrir-cierre").onclick = () => abrir();
  document.querySelectorAll("[data-servicio]").forEach((btn) => {
    btn.onclick = () => abrir(btn.dataset.servicio);
  });
}

function abrir(servicioId) {
  const error = $("#error-cota");
  error.hidden = true;
  if (servicioId) form.servicioId.value = servicioId;
  velo.hidden = false;
  form.nombre.focus();
}

function cerrar() {
  velo.hidden = true;
}

$("#hablar").onclick = () => abrir();
$("#cerrar").onclick = cerrar;
velo.addEventListener("click", (evento) => {
  if (evento.target === velo) cerrar();
});
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") cerrar();
});

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const error = $("#error-cota");
  error.hidden = true;
  const datos = Object.fromEntries(new FormData(form).entries());
  const boton = form.querySelector("button[type=submit]");
  boton.disabled = true;
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
