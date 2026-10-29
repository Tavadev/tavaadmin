let sitio = null;
let vista = "resumen";
let servicioId = null;
let reloj = null;

const vistaEl = document.getElementById("vista");
const aviso = document.getElementById("aviso");

const TITULOS = {
  resumen: ["HOY", "Resumen"],
  pagina: ["LA PÁGINA", "Textos que ve la gente"],
  servicios: ["CATÁLOGO", "Servicios"],
  apariencia: ["ESTILO", "Colores e imágenes"],
  bot: ["WHATSAPP", "Cómo conversa el asistente"],
  cotizaciones: ["BANDEJA", "Cotizaciones"],
  whatsapp: ["DISPOSITIVO", "Vincular WhatsApp"],
};

function esc(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api(url, opciones) {
  const res = await fetch(url, opciones);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    location.href = "/panel";
    throw new Error("Entra de nuevo");
  }
  if (!res.ok) throw new Error(data.error || "No se pudo completar");
  return data;
}

function toast(texto) {
  aviso.hidden = false;
  aviso.textContent = texto;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    aviso.hidden = true;
  }, 2400);
}

function campo(etiqueta, valor, alCambiar, tipo) {
  const label = document.createElement("label");
  label.className = "campo" + (tipo === "area" ? " ancho" : "");
  const span = document.createElement("span");
  span.textContent = etiqueta;
  const input = document.createElement(tipo === "area" ? "textarea" : "input");
  if (tipo === "color") input.type = "color";
  input.value = valor || "";
  input.addEventListener("input", () => alCambiar(input.value));
  label.append(span, input);
  return label;
}

function imagenCampo(etiqueta, valor, alCambiar) {
  const caja = document.createElement("div");
  caja.className = "campo";
  const span = document.createElement("span");
  span.textContent = etiqueta;
  const fila = document.createElement("div");
  fila.className = "fila";
  if (valor) {
    const img = document.createElement("img");
    img.className = "mini";
    img.src = valor;
    img.alt = "";
    fila.append(img);
  }
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp,image/gif";
  file.addEventListener("change", async () => {
    const archivo = file.files && file.files[0];
    if (!archivo) return;
    const cuerpo = new FormData();
    cuerpo.append("archivo", archivo);
    try {
      const data = await api("/api/admin/media", { method: "POST", body: cuerpo });
      alCambiar(data.url);
      toast("Imagen lista. Recuerda guardar.");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  });
  const quitar = document.createElement("button");
  quitar.type = "button";
  quitar.className = "suave";
  quitar.textContent = "Quitar";
  quitar.onclick = () => {
    alCambiar("");
    pintar();
  };
  fila.append(file, quitar);
  caja.append(span, fila);
  return caja;
}

function tarjeta(titulo, ayuda) {
  const card = document.createElement("section");
  card.className = "tarjeta";
  const h = document.createElement("h2");
  h.textContent = titulo;
  card.append(h);
  if (ayuda) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = ayuda;
    card.append(p);
  }
  return card;
}

async function guardar() {
  const boton = document.getElementById("guardar");
  boton.disabled = true;
  try {
    sitio = await api("/api/admin/sitio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sitio),
    });
    toast("Guardado");
    pintar();
  } catch (error) {
    toast(error.message);
  } finally {
    boton.disabled = false;
  }
}

function ir(nombre) {
  vista = nombre;
  if (reloj) clearInterval(reloj);
  reloj = null;
  pintar();
}

function pintarNav() {
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.classList.toggle("activa", btn.dataset.nav === vista);
  });
  const [etiqueta, titulo] = TITULOS[vista];
  document.getElementById("etiqueta").textContent = etiqueta;
  document.getElementById("titulo").textContent = titulo;
  document.getElementById("guardar").hidden = ["resumen", "cotizaciones", "whatsapp"].includes(vista);
}

async function pintarResumen() {
  vistaEl.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const [estado, cotas] = await Promise.all([api("/api/admin/estado"), api("/api/admin/cotizaciones")]);
  vistaEl.innerHTML = "";
  const nums = document.createElement("div");
  nums.className = "metricas";
  const nuevas = cotas.filter((item) => item.estado === "nueva").length;
  const bloques = [
    ["Cotizaciones", cotas.length],
    ["Sin revisar", nuevas],
    ["WhatsApp", estado.whatsapp && estado.whatsapp.titulo],
  ];
  for (const [nombre, valor] of bloques) {
    const card = document.createElement("article");
    card.className = "metrica";
    const b = document.createElement("b");
    b.textContent = valor;
    const p = document.createElement("p");
    p.textContent = nombre;
    card.append(b, p);
    nums.append(card);
  }
  const nota = tarjeta(
    estado.supabase ? "Los datos están en Supabase" : "Los datos están en este computador",
    estado.supabase
      ? "La página, el panel y el bot leen la misma base."
      : "Para publicarlo en Render, conecta Supabase. Mientras tanto puedes ver la página y el panel aquí.",
  );
  const recientes = tarjeta("Últimas solicitudes");
  if (!cotas.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Todavía no llega ninguna.";
    recientes.append(p);
  }
  cotas.slice(0, 5).forEach((item) => {
    const p = document.createElement("p");
    p.textContent = `${item.nombre} · ${item.servicioNombre || "servicio"} · ${item.origen === "whatsapp" ? "WhatsApp" : "Página"}`;
    recientes.append(p);
  });
  vistaEl.append(nums, nota, recientes);
}

function pintarPagina() {
  vistaEl.innerHTML = "";
  const hero = tarjeta("Portada", "El mensaje grande. Una idea, dicha claro.");
  const rejilla = document.createElement("div");
  rejilla.className = "rejilla";
  rejilla.append(
    campo("Etiqueta pequeña", sitio.hero.etiqueta, (v) => (sitio.hero.etiqueta = v)),
    campo("Botón principal", sitio.hero.boton, (v) => (sitio.hero.boton = v)),
    campo("Título", sitio.hero.titulo, (v) => (sitio.hero.titulo = v), "area"),
    campo("Frase destacada", sitio.hero.acento, (v) => (sitio.hero.acento = v), "area"),
    campo("Texto de apoyo", sitio.hero.bajada, (v) => (sitio.hero.bajada = v), "area"),
    campo("Botón secundario", sitio.hero.secundario, (v) => (sitio.hero.secundario = v)),
  );
  while (sitio.hero.pruebas.length < 3) sitio.hero.pruebas.push("");
  sitio.hero.pruebas.forEach((texto, i) => {
    rejilla.append(campo(`Frase corta ${i + 1}`, texto, (v) => (sitio.hero.pruebas[i] = v)));
  });
  hero.append(rejilla);

  const quienes = tarjeta("Quiénes somos", "La historia del teatro, en corto.");
  quienes.append(
    campo("Etiqueta", sitio.quienes.etiqueta, (v) => (sitio.quienes.etiqueta = v)),
    campo("Título", sitio.quienes.titulo, (v) => (sitio.quienes.titulo = v), "area"),
    campo("Texto", sitio.quienes.texto, (v) => (sitio.quienes.texto = v), "area"),
  );

  const pasos = tarjeta("Cómo trabajamos");
  pasos.append(
    campo("Etiqueta", sitio.pasos.etiqueta, (v) => (sitio.pasos.etiqueta = v)),
    campo("Título", sitio.pasos.titulo, (v) => (sitio.pasos.titulo = v)),
  );
  sitio.pasos.items.forEach((item, i) => {
    const caja = document.createElement("div");
    caja.className = "rejilla";
    caja.append(
      campo(`Paso ${item.numero}`, item.titulo, (v) => (sitio.pasos.items[i].titulo = v)),
      campo("Explicación", item.texto, (v) => (sitio.pasos.items[i].texto = v)),
    );
    pasos.append(caja);
  });

  const para = tarjeta("Es para ti si", "Una frase por renglón. Pensado para quien no es técnico.");
  para.append(
    campo("Etiqueta", sitio.paraQuien.etiqueta, (v) => (sitio.paraQuien.etiqueta = v)),
    campo("Título", sitio.paraQuien.titulo, (v) => (sitio.paraQuien.titulo = v)),
  );
  sitio.paraQuien.items.forEach((texto, i) => {
    para.append(campo(`Frase ${i + 1}`, texto, (v) => (sitio.paraQuien.items[i] = v), "area"));
  });
  const agregar = document.createElement("button");
  agregar.type = "button";
  agregar.className = "suave";
  agregar.textContent = "Agregar frase";
  agregar.onclick = () => {
    if (sitio.paraQuien.items.length >= 6) return;
    sitio.paraQuien.items.push("");
    pintar();
  };
  para.append(agregar);

  const cierre = tarjeta("Cierre");
  cierre.append(
    campo("Etiqueta", sitio.cierre.etiqueta, (v) => (sitio.cierre.etiqueta = v)),
    campo("Título", sitio.cierre.titulo, (v) => (sitio.cierre.titulo = v), "area"),
    campo("Texto", sitio.cierre.texto, (v) => (sitio.cierre.texto = v), "area"),
    campo("Botón", sitio.cierre.boton, (v) => (sitio.cierre.boton = v)),
  );

  const contacto = tarjeta("Contacto", "Si dejas el WhatsApp, aparece el botón verde. El indicativo sirve para los avisos.");
  const red = document.createElement("div");
  red.className = "rejilla";
  red.append(
    campo("WhatsApp (solo números)", sitio.contacto.whatsapp, (v) => (sitio.contacto.whatsapp = v)),
    campo("Correo", sitio.contacto.correo, (v) => (sitio.contacto.correo = v)),
    campo("Instagram", sitio.contacto.instagram, (v) => (sitio.contacto.instagram = v)),
    campo("Sitio web", sitio.contacto.web, (v) => (sitio.contacto.web = v)),
    campo("Indicativo del país", sitio.contacto.prefijo, (v) => (sitio.contacto.prefijo = v)),
  );
  contacto.append(red);
  vistaEl.append(hero, quienes, pasos, para, cierre, contacto);
}

function servicioActual() {
  return sitio.servicios.find((item) => item.id === servicioId) || sitio.servicios[0];
}

function pintarServicios() {
  vistaEl.innerHTML = "";
  if (!servicioId || !sitio.servicios.some((item) => item.id === servicioId)) {
    servicioId = sitio.servicios[0] && sitio.servicios[0].id;
  }
  const layout = document.createElement("div");
  layout.className = "editor";
  const lista = document.createElement("div");
  lista.className = "lista-servicios";
  sitio.servicios.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item" + (item.id === servicioId ? " activa" : "");
    btn.textContent = item.nombre + (item.activo ? "" : " (oculto)");
    btn.onclick = () => {
      servicioId = item.id;
      pintar();
    };
    lista.append(btn);
  });
  const nuevo = document.createElement("button");
  nuevo.type = "button";
  nuevo.className = "suave";
  nuevo.textContent = "Nuevo servicio";
  nuevo.onclick = () => {
    const id = "servicio-" + Date.now().toString(36);
    sitio.servicios.push({
      id,
      activo: true,
      icono: "</>",
      nombre: "Nuevo servicio",
      resumen: "",
      tono: "lila",
      imagen: "",
      palabras: [],
      preguntas: ["¿Qué necesitas?"],
    });
    servicioId = id;
    pintar();
  };
  lista.append(nuevo);

  const actual = servicioActual();
  const editor = tarjeta("Este servicio", "Sin precio. La gente pide cotización y el bot hace estas preguntas.");
  if (actual) {
    const tono = document.createElement("label");
    tono.className = "campo";
    tono.innerHTML = "<span>Color de la tarjeta</span>";
    const select = document.createElement("select");
    [["lila", "Lila"], ["rosa", "Rosado"], ["oscuro", "Oscuro"], ["blanco", "Blanco"]].forEach(([valor, nombre]) => {
      const op = document.createElement("option");
      op.value = valor;
      op.textContent = nombre;
      if (actual.tono === valor) op.selected = true;
      select.append(op);
    });
    select.onchange = () => (actual.tono = select.value);
    tono.append(select);
    const activo = document.createElement("label");
    activo.className = "check";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = actual.activo !== false;
    check.onchange = () => (actual.activo = check.checked);
    activo.append(check, document.createTextNode("Visible en la página y en el bot"));
    editor.append(
      campo("Nombre", actual.nombre, (v) => (actual.nombre = v)),
      campo("Resumen", actual.resumen, (v) => (actual.resumen = v), "area"),
      campo("Símbolo", actual.icono, (v) => (actual.icono = v)),
      tono,
      imagenCampo("Imagen de la tarjeta", actual.imagen, (url) => (actual.imagen = url)),
      activo,
      campo("Palabras con las que lo piden, separadas por coma", (actual.palabras || []).join(", "), (v) => {
        actual.palabras = v.split(",").map((parte) => parte.trim()).filter(Boolean);
      }),
    );
    const pregTitulo = document.createElement("h2");
    pregTitulo.textContent = "Preguntas del bot";
    editor.append(pregTitulo);
    actual.preguntas.forEach((texto, i) => {
      const fila = document.createElement("div");
      fila.className = "fila";
      const input = document.createElement("textarea");
      input.value = texto;
      input.addEventListener("input", () => (actual.preguntas[i] = input.value));
      const borrar = document.createElement("button");
      borrar.type = "button";
      borrar.className = "suave";
      borrar.textContent = "Quitar";
      borrar.onclick = () => {
        actual.preguntas.splice(i, 1);
        pintar();
      };
      fila.append(input, borrar);
      editor.append(fila);
    });
    const addP = document.createElement("button");
    addP.type = "button";
    addP.className = "suave";
    addP.textContent = "Agregar pregunta";
    addP.onclick = () => {
      actual.preguntas.push("");
      pintar();
    };
    const borrarServicio = document.createElement("button");
    borrarServicio.type = "button";
    borrarServicio.className = "peligro";
    borrarServicio.textContent = "Eliminar servicio";
    borrarServicio.onclick = () => {
      if (sitio.servicios.length < 2) return toast("Deja al menos un servicio");
      sitio.servicios = sitio.servicios.filter((item) => item.id !== actual.id);
      servicioId = sitio.servicios[0].id;
      pintar();
    };
    const mover = document.createElement("div");
    mover.className = "fila";
    const subir = document.createElement("button");
    subir.type = "button";
    subir.className = "suave";
    subir.textContent = "Subir";
    const bajar = document.createElement("button");
    bajar.type = "button";
    bajar.className = "suave";
    bajar.textContent = "Bajar";
    const moverA = (delta) => {
      const i = sitio.servicios.findIndex((item) => item.id === actual.id);
      const j = i + delta;
      if (j < 0 || j >= sitio.servicios.length) return;
      const [item] = sitio.servicios.splice(i, 1);
      sitio.servicios.splice(j, 0, item);
      pintar();
    };
    subir.onclick = () => moverA(-1);
    bajar.onclick = () => moverA(1);
    mover.append(subir, bajar, addP, borrarServicio);
    editor.append(mover);
  }
  layout.append(lista, editor);
  vistaEl.append(layout);
}

const COLORES = [
  ["fondo", "Fondo de la página"],
  ["profundo", "Fondo oscuro"],
  ["morado", "Morado"],
  ["acento", "Morado de botones"],
  ["rosado", "Rosado"],
  ["lavanda", "Lavanda"],
  ["rosadoPastel", "Rosado suave"],
  ["tarjetaLila", "Tarjeta lila"],
  ["tarjetaRosa", "Tarjeta rosada"],
  ["texto", "Texto principal"],
  ["textoSuave", "Texto de párrafos"],
  ["textoOscuroSuave", "Texto sobre fondo oscuro"],
];

function pintarApariencia() {
  vistaEl.innerHTML = "";
  const fotos = tarjeta("Imágenes", "El panel no cambia de colores: así siempre puedes leerlo. Lo que guardes aquí se ve en la página.");
  fotos.append(
    imagenCampo("Logo para fondo claro", sitio.marca.logoClaro, (url) => (sitio.marca.logoClaro = url)),
    imagenCampo("Logo para fondo oscuro", sitio.marca.logoOscuro, (url) => (sitio.marca.logoOscuro = url)),
    campo("Frase de la marca", sitio.marca.frase, (v) => (sitio.marca.frase = v)),
    campo("Aparte", sitio.marca.aparte, (v) => (sitio.marca.aparte = v)),
  );
  const colores = tarjeta("Colores");
  const grid = document.createElement("div");
  grid.className = "colores";
  COLORES.forEach(([clave, nombre]) => {
    const label = document.createElement("label");
    label.className = "color";
    const span = document.createElement("span");
    span.textContent = nombre;
    const input = document.createElement("input");
    input.type = "color";
    input.value = /^#[0-9a-fA-F]{6}$/.test(sitio.estilo[clave] || "") ? sitio.estilo[clave] : "#2A2346";
    input.addEventListener("input", () => (sitio.estilo[clave] = input.value.toUpperCase()));
    label.append(span, input);
    grid.append(label);
  });
  const restaurar = document.createElement("button");
  restaurar.type = "button";
  restaurar.className = "suave";
  restaurar.textContent = "Volver a los colores de la marca";
  restaurar.onclick = async () => {
    sitio.estilo = await api("/api/admin/colores-marca");
    pintar();
    toast("Colores restaurados. Guarda para publicarlos.");
  };
  colores.append(grid, restaurar);
  vistaEl.append(fotos, colores);
}

function pintarBot() {
  vistaEl.innerHTML = "";
  const textos = tarjeta("Mensajes", "El bot agrega solo la lista numerada de servicios. No la escribas aquí.");
  const campos = [
    ["bienvenida", "Saludo", "area"],
    ["pedirNombre", "Pide el nombre", "text"],
    ["pedirNegocio", "Pide el negocio", "area"],
    ["antesDeConfirmar", "Antes del resumen", "text"],
    ["confirmar", "Pide el sí", "area"],
    ["gracias", "Cuando queda anotada", "area"],
    ["noEntendi", "Si no entiende", "area"],
    ["cancelado", "Si cancelan", "area"],
    ["asesor", "Si piden una persona", "area"],
  ];
  campos.forEach(([clave, etiqueta, tipo]) => {
    textos.append(campo(etiqueta, sitio.bot[clave], (v) => (sitio.bot[clave] = v), tipo));
  });
  const avisos = tarjeta("Avisos", "Cuando llegue una cotización, el bot escribe a estos números o grupos. Tú atiendes desde tu WhatsApp.");
  sitio.bot.avisos.forEach((avisoItem, i) => {
    const fila = document.createElement("div");
    fila.className = "rejilla";
    fila.append(
      campo("Nombre", avisoItem.nombre, (v) => (sitio.bot.avisos[i].nombre = v)),
      campo("Número o id del grupo", avisoItem.valor, (v) => (sitio.bot.avisos[i].valor = v)),
    );
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "suave";
    quitar.textContent = "Quitar";
    quitar.onclick = () => {
      sitio.bot.avisos.splice(i, 1);
      pintar();
    };
    avisos.append(fila, quitar);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "suave";
  add.textContent = "Agregar destino";
  add.onclick = () => {
    sitio.bot.avisos.push({ nombre: "Yo", valor: "" });
    pintar();
  };
  avisos.append(add);
  vistaEl.append(textos, avisos);
}

async function pintarCotizaciones() {
  vistaEl.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const [cotas, pausas] = await Promise.all([api("/api/admin/cotizaciones"), api("/api/admin/pausas")]);
  vistaEl.innerHTML = "";
  const card = tarjeta("Solicitudes", "Las de la página y las del chat llegan al mismo lugar.");
  if (!cotas.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Todavía no hay cotizaciones.";
    card.append(p);
  }
  const pausados = new Set(pausas.map((item) => String(item.celular || "").replace(/\D/g, "").slice(-10)));
  cotas.forEach((item) => {
    const bloque = document.createElement("article");
    bloque.className = "cota";
    const cabeza = document.createElement("p");
    cabeza.innerHTML = `<strong>${esc(item.nombre)}</strong> · ${esc(item.servicioNombre || "Sin servicio")} · ${esc(item.origen === "whatsapp" ? "WhatsApp" : "Página")}`;
    const meta = document.createElement("p");
    meta.className = "ayuda";
    meta.textContent = [item.negocio, item.celular, (item.creadoEn || "").replace("T", " ").slice(0, 16)].filter(Boolean).join(" · ");
    const cuerpo = document.createElement("div");
    if (item.respuestas && item.respuestas.length) {
      item.respuestas.forEach((par) => {
        const p = document.createElement("p");
        p.innerHTML = `<strong>${esc(par.pregunta)}</strong><br>${esc(par.respuesta)}`;
        cuerpo.append(p);
      });
    } else if (item.mensaje) {
      const p = document.createElement("p");
      p.textContent = item.mensaje;
      cuerpo.append(p);
    }
    const estado = document.createElement("select");
    [["nueva", "Nueva"], ["en_curso", "En conversación"], ["lista", "Lista"], ["descartada", "Descartada"]].forEach(([valor, nombre]) => {
      const op = document.createElement("option");
      op.value = valor;
      op.textContent = nombre;
      if (item.estado === valor) op.selected = true;
      estado.append(op);
    });
    estado.onchange = async () => {
      try {
        await api("/api/admin/cotizaciones/" + encodeURIComponent(item.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: estado.value }),
        });
        toast("Estado actualizado");
      } catch (error) {
        toast(error.message);
      }
    };
    const nota = document.createElement("textarea");
    nota.placeholder = "Nota interna. La persona no la ve.";
    nota.value = item.notaInterna || "";
    const acciones = document.createElement("div");
    acciones.className = "fila";
    const guardarNota = document.createElement("button");
    guardarNota.type = "button";
    guardarNota.className = "suave";
    guardarNota.textContent = "Guardar nota";
    guardarNota.onclick = async () => {
      try {
        await api("/api/admin/cotizaciones/" + encodeURIComponent(item.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notaInterna: nota.value, estado: estado.value }),
        });
        toast("Nota guardada");
      } catch (error) {
        toast(error.message);
      }
    };
    acciones.append(guardarNota);
    const cel = String(item.celular || "").replace(/\D/g, "").slice(-10);
    if (cel) {
      const tomar = document.createElement("button");
      tomar.type = "button";
      tomar.className = "primario";
      const pausado = pausados.has(cel);
      tomar.textContent = pausado ? "Devolver al bot" : "Tomar este chat";
      tomar.onclick = async () => {
        try {
          await api(pausado ? "/api/admin/reactivar" : "/api/admin/pausar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ celular: cel, jid: item.jid || "" }),
          });
          toast(pausado ? "El bot vuelve a ese chat" : "El bot se calla en ese chat");
          pintar();
        } catch (error) {
          toast(error.message);
        }
      };
      acciones.append(tomar);
    }
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "peligro";
    borrar.textContent = "Eliminar";
    borrar.onclick = async () => {
      if (!confirm("¿Eliminar esta cotización?")) return;
      await api("/api/admin/cotizaciones/" + encodeURIComponent(item.id), { method: "DELETE" });
      pintar();
    };
    acciones.append(borrar);
    bloque.append(cabeza, meta, cuerpo, estado, nota, acciones);
    card.append(bloque);
  });
  vistaEl.append(card);
}

async function pintarWhatsapp() {
  vistaEl.innerHTML = "";
  const card = tarjeta("Vincular el celular", "WhatsApp Business, o WhatsApp, luego dispositivos vinculados. El nombre del dispositivo es TAVADEV. Confírmalo, no lo escribas.");
  const estado = document.createElement("div");
  estado.id = "wa-estado";
  const h = document.createElement("h2");
  h.id = "wa-titulo";
  h.textContent = "Revisando…";
  const p = document.createElement("p");
  p.id = "wa-detalle";
  p.className = "ayuda";
  const img = document.createElement("img");
  img.id = "wa-qr";
  img.alt = "Código QR";
  img.hidden = true;
  img.width = 280;
  const logs = document.createElement("div");
  logs.id = "wa-logs";
  logs.className = "logs";
  const gruposBtn = document.createElement("button");
  gruposBtn.type = "button";
  gruposBtn.className = "suave";
  gruposBtn.textContent = "Buscar mis grupos";
  const grupos = document.createElement("div");
  gruposBtn.onclick = async () => {
    grupos.textContent = "Buscando…";
    try {
      const data = await api("/api/admin/grupos");
      grupos.innerHTML = "";
      if (!data.conectado) {
        grupos.textContent = "Primero vincula el celular.";
        return;
      }
      if (!data.grupos.length) {
        grupos.textContent = "No aparecieron grupos.";
        return;
      }
      data.grupos.forEach((grupo) => {
        const fila = document.createElement("p");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "suave";
        b.textContent = "Usar para avisos";
        b.onclick = () => {
          sitio.bot.avisos.push({ nombre: grupo.nombre, valor: grupo.id });
          toast("Quedó en Conversación. Entra allá y guarda.");
        };
        fila.append(document.createTextNode(grupo.nombre + " "), b);
        grupos.append(fila);
      });
    } catch (error) {
      grupos.textContent = error.message;
    }
  };
  card.append(estado, h, p, img, gruposBtn, grupos, logs);
  vistaEl.append(card);

  async function refrescar() {
    if (vista !== "whatsapp") return;
    try {
      const data = await api("/api/admin/whatsapp");
      h.textContent = data.titulo;
      p.textContent = data.detalle;
      if (data.hayQr) {
        img.hidden = false;
        img.src = "/api/admin/whatsapp.png?t=" + Date.now();
      } else {
        img.hidden = true;
      }
      logs.textContent = (data.logs || []).slice(-12).join("\n") || "Sin registro todavía.";
    } catch (error) {
      p.textContent = error.message;
    }
  }
  refrescar();
  reloj = setInterval(refrescar, 4000);
}

async function pintar() {
  pintarNav();
  try {
    if (vista === "resumen") return await pintarResumen();
    if (vista === "pagina") return pintarPagina();
    if (vista === "servicios") return pintarServicios();
    if (vista === "apariencia") return pintarApariencia();
    if (vista === "bot") return pintarBot();
    if (vista === "cotizaciones") return await pintarCotizaciones();
    if (vista === "whatsapp") return await pintarWhatsapp();
  } catch (error) {
    vistaEl.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = error.message;
    vistaEl.append(p);
  }
}

document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.onclick = () => ir(btn.dataset.nav);
});
document.getElementById("guardar").onclick = guardar;
document.getElementById("salir").onclick = async () => {
  await fetch("/api/salir", { method: "POST" });
  location.href = "/panel";
};

api("/api/admin/sitio")
  .then((data) => {
    sitio = data;
    return pintar();
  })
  .catch((error) => {
    vistaEl.textContent = error.message;
  });
