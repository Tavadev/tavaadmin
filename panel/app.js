let sitio = null;
let vista = "resumen";
let chatParte = "clientes";
let clientesParte = "fichas";
let equipoParte = "personas";
let servicioId = null;
let pedidoDesde = "";
let reloj = null;

const vistaEl = document.getElementById("vista");
const aviso = document.getElementById("aviso");

const TITULOS = {
  resumen: ["HOY", "Resumen"],
  pagina: ["LA PÁGINA", "Textos que ve la gente"],
  apariencia: ["ESTILO", "Colores e imágenes"],
  clientes: ["CLIENTES", "Estados y fichas"],
  pedidos: ["PEDIDOS", "Trabajos con cada cliente"],
  equipo: ["EQUIPO", "Contactos y organigrama"],
};
const TITULOS_CHAT = {
  clientes: ["CHATBOT", "Seguimiento de clientes"],
  registro: ["CHATBOT", "Registro de productos y servicios"],
  dispositivo: ["CHATBOT", "Vincular el celular"],
  mensajes: ["CHATBOT", "Cómo conversa"],
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
  const tituloClientes = clientesParte === "estados" ? ["CLIENTES", "Estados del recorrido"] : TITULOS.clientes;
  const tituloEquipo = equipoParte === "organigrama" ? ["EQUIPO", "Organigrama"] : TITULOS.equipo;
  const mapa = vista === "chatbot" ? TITULOS_CHAT[chatParte] : vista === "clientes" ? tituloClientes : vista === "equipo" ? tituloEquipo : TITULOS[vista];
  const [etiqueta, titulo] = mapa;
  document.getElementById("etiqueta").textContent = etiqueta;
  document.getElementById("titulo").textContent = titulo;
  const edita = vista === "pagina" || vista === "apariencia" || (vista === "chatbot" && (chatParte === "registro" || chatParte === "mensajes"));
  document.getElementById("guardar").hidden = !edita;
}

async function pintarResumen() {
  vistaEl.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const [estado, cotas, pedidos] = await Promise.all([
    api("/api/admin/estado"),
    api("/api/admin/cotizaciones"),
    api("/api/admin/pedidos").catch(() => []),
  ]);
  vistaEl.innerHTML = "";
  const nums = document.createElement("div");
  nums.className = "metricas";
  const nuevas = cotas.filter((item) => item.estado === "nueva" || item.estado === "cli-nueva").length;
  const abiertos = pedidos.filter((item) => item.estadoId !== "ped-entregado" && item.estadoId !== "ped-cancelado").length;
  const bloques = [
    ["Clientes", cotas.length],
    ["Sin revisar", nuevas],
    ["Pedidos abiertos", abiertos],
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

function pintarServicios(nodo) {
  const caja = nodo || vistaEl;
  caja.innerHTML = "";
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
    btn.textContent = (item.tipo === "producto" ? "Producto" : "Servicio") + " · " + item.nombre + (item.activo ? "" : " · oculto");
    btn.onclick = () => {
      servicioId = item.id;
      pintar();
    };
    lista.append(btn);
  });
  const nuevo = document.createElement("button");
  nuevo.type = "button";
  nuevo.className = "suave";
  nuevo.textContent = "Agregar";
  nuevo.onclick = () => {
    const id = "item-" + Date.now().toString(36);
    sitio.servicios.push({
      id,
      activo: true,
      tipo: "servicio",
      icono: "</>",
      nombre: "Nuevo",
      resumen: "",
      tono: "lila",
      imagen: "",
      palabras: [],
      preguntas: ["¿Qué necesitas?"],
      detalles: [],
    });
    servicioId = id;
    pintar();
  };
  lista.append(nuevo);

  const actual = servicioActual();
  const editor = tarjeta("Ficha", "Elige si es un producto o un servicio. Sin precio. El bot hace las preguntas de abajo.");
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
    const tipo = document.createElement("label");
    tipo.className = "campo";
    const tipoSpan = document.createElement("span");
    tipoSpan.textContent = "Qué es";
    const tipoSelect = document.createElement("select");
    [["servicio", "Servicio"], ["producto", "Producto"]].forEach(([valor, nombre]) => {
      const op = document.createElement("option");
      op.value = valor;
      op.textContent = nombre;
      if ((actual.tipo || "servicio") === valor) op.selected = true;
      tipoSelect.append(op);
    });
    tipoSelect.onchange = () => {
      actual.tipo = tipoSelect.value;
    };
    tipo.append(tipoSpan, tipoSelect);
    editor.append(
      tipo,
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
    const detTitulo = document.createElement("h2");
    detTitulo.textContent = "Detalles";
    editor.append(detTitulo);
    if (!Array.isArray(actual.detalles)) actual.detalles = [];
    actual.detalles.forEach((detalle, i) => {
      const fila = document.createElement("div");
      fila.className = "rejilla";
      fila.append(
        campo("Título", detalle.titulo, (v) => (actual.detalles[i].titulo = v)),
        campo("Texto", detalle.texto, (v) => (actual.detalles[i].texto = v)),
      );
      const quitar = document.createElement("button");
      quitar.type = "button";
      quitar.className = "suave";
      quitar.textContent = "Quitar detalle";
      quitar.onclick = () => {
        actual.detalles.splice(i, 1);
        pintar();
      };
      editor.append(fila, quitar);
    });
    const addDet = document.createElement("button");
    addDet.type = "button";
    addDet.className = "suave";
    addDet.textContent = "Agregar detalle";
    addDet.onclick = () => {
      actual.detalles.push({ titulo: "", texto: "" });
      pintar();
    };
    editor.append(addDet);
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
    borrarServicio.textContent = "Eliminar";
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
  caja.append(layout);
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

function pintarBot(nodo) {
  const caja = nodo || vistaEl;
  caja.innerHTML = "";
  const textos = tarjeta("Mensajes", "El bot agrega solo la lista numerada. No la escribas aquí.");
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
  const avisos = tarjeta("Avisos", "Cuando llegue un cliente, el bot escribe a estos números. Tú atiendes desde tu WhatsApp.");
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
  caja.append(textos, avisos);
}

async function pintarCotizaciones(nodo) {
  const caja = nodo || vistaEl;
  caja.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const [cotas, pausas, estados] = await Promise.all([
    api("/api/admin/cotizaciones"),
    api("/api/admin/pausas"),
    api("/api/admin/estados?ambito=cliente").catch(() => [
      { id: "nueva", nombre: "Nueva" },
      { id: "en_curso", nombre: "En conversación" },
      { id: "lista", nombre: "Lista" },
      { id: "descartada", nombre: "Descartada" },
    ]),
  ]);
  caja.innerHTML = "";
  const card = tarjeta("Clientes", "Aquí queda quien escribió por la página o por WhatsApp. Cambia el estado según cómo vaya la conversación.");
  if (!cotas.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Todavía no hay clientes.";
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
    estados.forEach((opcion) => {
      const op = document.createElement("option");
      op.value = opcion.id;
      op.textContent = opcion.nombre;
      if (item.estado === opcion.id) op.selected = true;
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
      if (!confirm("¿Quitar a esta persona del seguimiento?")) return;
      await api("/api/admin/cotizaciones/" + encodeURIComponent(item.id), { method: "DELETE" });
      pintar();
    };
    acciones.append(borrar);
    bloque.append(cabeza, meta, cuerpo, estado, nota, acciones);
    card.append(bloque);
  });
  caja.append(card);
}

async function pintarWhatsapp(nodo) {
  const caja = nodo || vistaEl;
  caja.innerHTML = "";
  const card = tarjeta("Vincular el celular", "WhatsApp, luego dispositivos vinculados. El nombre del dispositivo es TAVADEV. Confírmalo, no lo escribas.");
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
  card.append(h, p, img, logs);
  caja.append(card);

  async function refrescar() {
    if (vista !== "chatbot" || chatParte !== "dispositivo") return;
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

function subnavChat() {
  const barra = document.createElement("div");
  barra.className = "fila subnav";
  [
    ["clientes", "Seguimiento"],
    ["registro", "Registro"],
    ["dispositivo", "Dispositivo"],
    ["mensajes", "Mensajes"],
  ].forEach(([id, nombre]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suave" + (chatParte === id ? " activa" : "");
    btn.textContent = nombre;
    btn.onclick = () => {
      chatParte = id;
      ir("chatbot");
    };
    barra.append(btn);
  });
  return barra;
}

async function pintarChatbot() {
  vistaEl.innerHTML = "";
  vistaEl.append(subnavChat());
  const caja = document.createElement("div");
  vistaEl.append(caja);
  if (chatParte === "clientes") return pintarCotizaciones(caja);
  if (chatParte === "registro") return pintarServicios(caja);
  if (chatParte === "dispositivo") return pintarWhatsapp(caja);
  return pintarBot(caja);
}

function subnav(opciones, actual, alElegir) {
  const barra = document.createElement("div");
  barra.className = "fila subnav";
  opciones.forEach(([id, nombre]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suave" + (actual === id ? " activa" : "");
    btn.textContent = nombre;
    btn.onclick = () => alElegir(id);
    barra.append(btn);
  });
  return barra;
}

function selectDe(opciones, valor, alCambiar) {
  const select = document.createElement("select");
  opciones.forEach((opcion) => {
    const op = document.createElement("option");
    op.value = opcion.id;
    op.textContent = opcion.nombre;
    if (opcion.id === valor) op.selected = true;
    select.append(op);
  });
  select.onchange = () => alCambiar(select.value);
  return select;
}

async function pintarClientes() {
  vistaEl.innerHTML = "";
  vistaEl.append(subnav([["fichas", "Fichas"], ["estados", "Estados"]], clientesParte, (id) => {
    clientesParte = id;
    ir("clientes");
  }));
  const caja = document.createElement("div");
  vistaEl.append(caja);
  if (clientesParte === "estados") return pintarEstados(caja, "cliente");
  caja.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const [clientes, estados] = await Promise.all([
    api("/api/admin/clientes"),
    api("/api/admin/estados?ambito=cliente"),
  ]);
  caja.innerHTML = "";
  const alta = tarjeta("Nuevo cliente", "También entran solos cuando escriben por la página o por WhatsApp.");
  const borrador = { nombre: "", negocio: "", celular: "", correo: "", estadoId: (estados[0] && estados[0].id) || "" };
  const red = document.createElement("div");
  red.className = "rejilla";
  red.append(
    campo("Nombre", "", (v) => (borrador.nombre = v)),
    campo("Negocio", "", (v) => (borrador.negocio = v)),
    campo("Celular", "", (v) => (borrador.celular = v)),
    campo("Correo", "", (v) => (borrador.correo = v)),
  );
  const crear = document.createElement("button");
  crear.type = "button";
  crear.className = "primario";
  crear.textContent = "Agregar cliente";
  crear.onclick = async () => {
    try {
      await api("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(borrador),
      });
      toast("Cliente agregado");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  };
  alta.append(red, crear);
  caja.append(alta);
  const lista = tarjeta("Fichas", "Cada persona tiene un estado. Puedes agregar los que faltan en Estados.");
  if (!clientes.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Todavía no hay clientes.";
    lista.append(p);
  }
  clientes.forEach((item) => {
    const bloque = document.createElement("article");
    bloque.className = "cota";
    const cabeza = document.createElement("p");
    cabeza.innerHTML = `<strong>${esc(item.nombre)}</strong>`;
    const ficha = { ...item, detalles: (item.detalles || []).map((detalle) => ({ ...detalle })) };
    const redFicha = document.createElement("div");
    redFicha.className = "rejilla";
    redFicha.append(
      campo("Nombre", ficha.nombre, (v) => (ficha.nombre = v)),
      campo("Negocio", ficha.negocio, (v) => (ficha.negocio = v)),
      campo("Celular", ficha.celular, (v) => (ficha.celular = v)),
      campo("Correo", ficha.correo, (v) => (ficha.correo = v)),
    );
    const estadoLabel = document.createElement("label");
    estadoLabel.className = "campo";
    estadoLabel.append(Object.assign(document.createElement("span"), { textContent: "Estado" }));
    estadoLabel.append(selectDe(estados, ficha.estadoId, (v) => (ficha.estadoId = v)));
    if (item.solicitudes && item.solicitudes.length) {
      item.solicitudes.forEach((sol) => {
        const p = document.createElement("p");
        p.className = "ayuda";
        p.textContent = [sol.servicioNombre || "Solicitud", sol.origen === "whatsapp" ? "WhatsApp" : "Página", (sol.mensaje || "").slice(0, 140)]
          .filter(Boolean)
          .join(" · ");
        bloque.append(p);
      });
    }
    const detTitulo = document.createElement("p");
    detTitulo.textContent = "Detalles";
    const detCaja = document.createElement("div");
    const pintarDets = () => {
      detCaja.innerHTML = "";
      ficha.detalles.forEach((detalle, i) => {
        const fila = document.createElement("div");
        fila.className = "rejilla";
        fila.append(
          campo("Título", detalle.titulo, (v) => (ficha.detalles[i].titulo = v)),
          campo("Texto", detalle.texto, (v) => (ficha.detalles[i].texto = v)),
        );
        detCaja.append(fila);
      });
    };
    pintarDets();
    const addDet = document.createElement("button");
    addDet.type = "button";
    addDet.className = "suave";
    addDet.textContent = "Agregar detalle";
    addDet.onclick = () => {
      ficha.detalles.push({ titulo: "", texto: "" });
      pintarDets();
    };
    const nota = document.createElement("textarea");
    nota.placeholder = "Nota interna. La persona no la ve.";
    nota.value = ficha.nota || "";
    nota.addEventListener("input", () => (ficha.nota = nota.value));
    const acciones = document.createElement("div");
    acciones.className = "fila";
    const guardarFicha = document.createElement("button");
    guardarFicha.type = "button";
    guardarFicha.className = "primario";
    guardarFicha.textContent = "Guardar ficha";
    guardarFicha.onclick = async () => {
      try {
        await api("/api/admin/clientes/" + encodeURIComponent(item.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ficha),
        });
        toast("Ficha guardada");
      } catch (error) {
        toast(error.message);
      }
    };
    const pedido = document.createElement("button");
    pedido.type = "button";
    pedido.className = "suave";
    pedido.textContent = "Hacer pedido";
    pedido.onclick = () => {
      pedidoDesde = item.id;
      ir("pedidos");
    };
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "peligro";
    borrar.textContent = "Eliminar";
    borrar.onclick = async () => {
      if (!confirm("¿Quitar a esta persona, sus solicitudes y sus pedidos?")) return;
      await api("/api/admin/clientes/" + encodeURIComponent(item.id), { method: "DELETE" });
      pintar();
    };
    acciones.append(guardarFicha, pedido, addDet, borrar);
    bloque.prepend(cabeza);
    bloque.append(redFicha, estadoLabel, detTitulo, detCaja, nota, acciones);
    lista.append(bloque);
  });
  caja.append(lista);
}

async function pintarEstados(caja, ambito) {
  caja.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const estados = await api("/api/admin/estados?ambito=" + ambito);
  caja.innerHTML = "";
  const card = tarjeta(
    ambito === "pedido" ? "Estados del pedido" : "Estados del cliente",
    "Agrega los que uses. El primero es por donde entra una ficha nueva.",
  );
  estados.forEach((estado) => {
    const fila = document.createElement("div");
    fila.className = "fila";
    const punto = document.createElement("i");
    punto.className = "punto";
    punto.style.background = estado.color || "#7B5FD1";
    const nombre = document.createElement("strong");
    nombre.textContent = estado.nombre;
    const subir = document.createElement("button");
    subir.type = "button";
    subir.className = "suave";
    subir.textContent = "Subir";
    subir.onclick = async () => {
      await api("/api/admin/estados/" + encodeURIComponent(estado.id) + "/mover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: -1 }),
      });
      pintar();
    };
    const bajar = document.createElement("button");
    bajar.type = "button";
    bajar.className = "suave";
    bajar.textContent = "Bajar";
    bajar.onclick = async () => {
      await api("/api/admin/estados/" + encodeURIComponent(estado.id) + "/mover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: 1 }),
      });
      pintar();
    };
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "peligro";
    borrar.textContent = "Quitar";
    borrar.onclick = async () => {
      try {
        await api("/api/admin/estados/" + encodeURIComponent(estado.id), { method: "DELETE" });
        pintar();
      } catch (error) {
        toast(error.message);
      }
    };
    fila.append(punto, nombre, subir, bajar, borrar);
    card.append(fila);
  });
  const nuevo = { nombre: "", color: "#7B5FD1", ambito };
  const red = document.createElement("div");
  red.className = "rejilla";
  red.append(
    campo("Nombre del estado", "", (v) => (nuevo.nombre = v)),
    campo("Color", nuevo.color, (v) => (nuevo.color = v), "color"),
  );
  const add = document.createElement("button");
  add.type = "button";
  add.className = "primario";
  add.textContent = "Agregar estado";
  add.onclick = async () => {
    try {
      await api("/api/admin/estados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevo),
      });
      pintar();
    } catch (error) {
      toast(error.message);
    }
  };
  card.append(red, add);
  caja.append(card);
}

async function pintarPedidos() {
  vistaEl.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const [pedidos, clientes, estados] = await Promise.all([
    api("/api/admin/pedidos"),
    api("/api/admin/clientes"),
    api("/api/admin/estados?ambito=pedido"),
  ]);
  vistaEl.innerHTML = "";
  vistaEl.append(subnav([["lista", "Pedidos"], ["estados", "Estados"]], "lista", (id) => {
    if (id === "estados") {
      vistaEl.innerHTML = "";
      const caja = document.createElement("div");
      vistaEl.append(subnav([["lista", "Pedidos"], ["estados", "Estados"]], "estados", (otro) => {
        if (otro === "lista") pintar();
      }));
      vistaEl.append(caja);
      pintarEstados(caja, "pedido").catch((error) => toast(error.message));
    }
  }));
  const ofertas = (sitio && sitio.servicios) || [];
  const borrador = {
    clienteId: pedidoDesde || (clientes[0] && clientes[0].id) || "",
    titulo: "",
    estadoId: (estados.find((item) => item.esInicial) || estados[0] || {}).id || "",
    nota: "",
    items: [{ ofertaId: "", descripcion: "", cantidad: 1, detalle: "" }],
  };
  pedidoDesde = "";
  const alta = tarjeta("Nuevo pedido", "Un pedido junta a un cliente con lo que hay que hacerle. Sin precio público.");
  if (!clientes.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Primero agrega un cliente.";
    alta.append(p);
  } else {
    const clienteLabel = document.createElement("label");
    clienteLabel.className = "campo";
    clienteLabel.append(Object.assign(document.createElement("span"), { textContent: "Cliente" }));
    clienteLabel.append(selectDe(clientes.map((item) => ({ id: item.id, nombre: item.nombre })), borrador.clienteId, (v) => (borrador.clienteId = v)));
    const estadoLabel = document.createElement("label");
    estadoLabel.className = "campo";
    estadoLabel.append(Object.assign(document.createElement("span"), { textContent: "Estado" }));
    estadoLabel.append(selectDe(estados, borrador.estadoId, (v) => (borrador.estadoId = v)));
    const lineas = document.createElement("div");
    const pintarLineas = () => {
      lineas.innerHTML = "";
      borrador.items.forEach((linea, i) => {
        const fila = document.createElement("div");
        fila.className = "rejilla";
        const oferta = document.createElement("label");
        oferta.className = "campo";
        oferta.append(Object.assign(document.createElement("span"), { textContent: "Producto o servicio" }));
        oferta.append(selectDe([{ id: "", nombre: "Sin ficha" }].concat(ofertas.map((item) => ({ id: item.id, nombre: item.nombre }))), linea.ofertaId, (v) => {
          borrador.items[i].ofertaId = v;
          const elegida = ofertas.find((item) => item.id === v);
          if (elegida && !borrador.items[i].descripcion) borrador.items[i].descripcion = elegida.nombre;
        }));
        fila.append(
          oferta,
          campo("Descripción", linea.descripcion, (v) => (borrador.items[i].descripcion = v)),
          campo("Cantidad", String(linea.cantidad || 1), (v) => (borrador.items[i].cantidad = v)),
          campo("Detalle", linea.detalle, (v) => (borrador.items[i].detalle = v)),
        );
        lineas.append(fila);
      });
    };
    pintarLineas();
    const addLinea = document.createElement("button");
    addLinea.type = "button";
    addLinea.className = "suave";
    addLinea.textContent = "Agregar línea";
    addLinea.onclick = () => {
      borrador.items.push({ ofertaId: "", descripcion: "", cantidad: 1, detalle: "" });
      pintarLineas();
    };
    const crear = document.createElement("button");
    crear.type = "button";
    crear.className = "primario";
    crear.textContent = "Guardar pedido";
    crear.onclick = async () => {
      try {
        await api("/api/admin/pedidos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...borrador,
            titulo: borrador.titulo,
          }),
        });
        toast("Pedido guardado");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    };
    alta.append(
      clienteLabel,
      campo("Nombre del pedido", "", (v) => (borrador.titulo = v)),
      estadoLabel,
      campo("Nota", "", (v) => (borrador.nota = v), "area"),
      lineas,
      addLinea,
      crear,
    );
  }
  const lista = tarjeta("Pedidos");
  if (!pedidos.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Todavía no hay pedidos.";
    lista.append(p);
  }
  const porCliente = new Map(clientes.map((item) => [item.id, item.nombre]));
  const porEstado = new Map(estados.map((item) => [item.id, item.nombre]));
  pedidos.forEach((pedido) => {
    const bloque = document.createElement("article");
    bloque.className = "cota";
    const cabeza = document.createElement("p");
    cabeza.innerHTML = `<strong>${esc(pedido.titulo)}</strong> · ${esc(porCliente.get(pedido.clienteId) || "Cliente")} · ${esc(porEstado.get(pedido.estadoId) || "")}`;
    bloque.append(cabeza);
    (pedido.items || []).forEach((linea) => {
      const p = document.createElement("p");
      p.textContent = `${linea.cantidad} × ${linea.descripcion}${linea.detalle ? " · " + linea.detalle : ""}`;
      bloque.append(p);
    });
    if (pedido.nota) {
      const nota = document.createElement("p");
      nota.className = "ayuda";
      nota.textContent = pedido.nota;
      bloque.append(nota);
    }
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "peligro";
    borrar.textContent = "Eliminar";
    borrar.onclick = async () => {
      if (!confirm("¿Quitar este pedido?")) return;
      await api("/api/admin/pedidos/" + encodeURIComponent(pedido.id), { method: "DELETE" });
      pintar();
    };
    bloque.append(borrar);
    lista.append(bloque);
  });
  vistaEl.append(alta, lista);
}

function ordenArbol(lista, campo) {
  const ids = new Set(lista.map((item) => item.id));
  const hijos = new Map();
  lista.forEach((item) => {
    const padre = item[campo] && ids.has(item[campo]) ? item[campo] : "";
    if (!hijos.has(padre)) hijos.set(padre, []);
    hijos.get(padre).push(item);
  });
  const salida = [];
  function bajar(padre, nivel) {
    (hijos.get(padre) || []).forEach((item) => {
      salida.push({ item, nivel });
      bajar(item.id, nivel + 1);
    });
  }
  bajar("", 0);
  return salida;
}

function opcionesDeArbol(lista, campo, excluirId, raiz) {
  const ids = new Set(lista.map((item) => item.id));
  const hijos = new Map();
  lista.forEach((item) => {
    const padre = item[campo] && ids.has(item[campo]) ? item[campo] : "";
    if (!hijos.has(padre)) hijos.set(padre, []);
    hijos.get(padre).push(item);
  });
  const prohibidos = new Set();
  if (excluirId) {
    const pila = [excluirId];
    while (pila.length) {
      const id = pila.pop();
      if (prohibidos.has(id)) continue;
      prohibidos.add(id);
      (hijos.get(id) || []).forEach((item) => pila.push(item.id));
    }
  }
  const opciones = [{ id: "", nombre: raiz }];
  function caminar(padre, prefijo) {
    (hijos.get(padre) || []).forEach((item) => {
      if (!prohibidos.has(item.id)) opciones.push({ id: item.id, nombre: prefijo + item.nombre });
      caminar(item.id, prefijo + item.nombre + " / ");
    });
  }
  caminar("", "");
  return opciones;
}

function textoPersonas(cantidad) {
  const n = Number(cantidad) || 0;
  if (n === 1) return "1 persona";
  if (n > 1) return n + " personas";
  return "Sin personas";
}

function pintarRama(nodo, personas, esRaiz) {
  const rama = document.createElement("div");
  rama.className = "org-rama";
  if (!esRaiz) {
    const punta = document.createElement("span");
    punta.className = "org-punta";
    punta.setAttribute("aria-hidden", "true");
    rama.append(punta);
  }
  const delEquipo = (personas || []).filter((item) => item.equipoId === nodo.id && item.activo !== false);
  const orden = ordenArbol(delEquipo, "reportaA");
  const encargados = orden.filter((fila) => fila.nivel === 0).map((fila) => fila.item);
  const card = document.createElement("article");
  card.className = "org-nodo equipo";
  const abrir = document.createElement("button");
  abrir.type = "button";
  abrir.className = "org-abrir";
  abrir.setAttribute("aria-expanded", "false");
  const nombre = document.createElement("b");
  nombre.textContent = nodo.nombre;
  const cargo = document.createElement("span");
  cargo.className = "cargo";
  cargo.textContent = encargados.length ? encargados.map((item) => item.nombre).join(" · ") : "Sin encargado";
  const pie = document.createElement("p");
  pie.className = "org-ramas";
  pie.textContent = textoPersonas(delEquipo.length);
  abrir.append(nombre, cargo, pie);
  const gente = document.createElement("div");
  gente.className = "org-gente";
  gente.hidden = true;
  if (!orden.length) {
    const vacio = document.createElement("p");
    vacio.textContent = "Nadie está en este equipo.";
    gente.append(vacio);
  }
  orden.forEach(({ item, nivel }) => {
    const ficha = document.createElement("article");
    ficha.style.paddingLeft = nivel * 12 + "px";
    const quien = document.createElement("b");
    quien.textContent = (nivel ? "↳ " : "") + item.nombre;
    const detalle = document.createElement("span");
    const jefe = delEquipo.find((persona) => persona.id === item.reportaA);
    detalle.textContent = [item.cargo || "Sin cargo", jefe ? "reporta a " + jefe.nombre : ""].filter(Boolean).join(" · ");
    ficha.append(quien, detalle);
    gente.append(ficha);
  });
  abrir.onclick = () => {
    const abierto = gente.hidden;
    gente.hidden = !abierto;
    abrir.setAttribute("aria-expanded", abierto ? "true" : "false");
    card.classList.toggle("abierta", abierto);
  };
  card.append(abrir, gente);
  rama.append(card);
  if (nodo.hijos && nodo.hijos.length) {
    const hijos = document.createElement("div");
    hijos.className = "org-hijos";
    nodo.hijos.forEach((hijo) => hijos.append(pintarRama(hijo, personas, false)));
    rama.append(hijos);
  }
  return rama;
}

async function pintarEquipo() {
  vistaEl.innerHTML = "";
  vistaEl.append(subnav([["personas", "Contactos"], ["organigrama", "Organigrama"]], equipoParte, (id) => {
    equipoParte = id;
    ir("equipo");
  }));
  const caja = document.createElement("div");
  vistaEl.append(caja);
  if (equipoParte === "organigrama") {
    caja.innerHTML = "<p class='ayuda'>Cargando…</p>";
    const data = await api("/api/admin/organigrama");
    caja.innerHTML = "";
    const card = tarjeta("Organigrama", "En cada equipo se ve quién está a cargo. Haz clic para abrir a las personas de ese equipo.");
    const equiposArbol = data.equiposArbol || [];
    const personas = data.personas || [];
    if (!equiposArbol.length) {
      const p = document.createElement("p");
      p.className = "ayuda";
      p.textContent = "Agrega equipos en Contactos y marca de cuál cuelga cada uno.";
      card.append(p);
    } else {
      const org = document.createElement("div");
      org.className = "org";
      equiposArbol.forEach((raiz) => org.append(pintarRama(raiz, personas, true)));
      card.append(org);
    }
    const sueltos = personas.filter((item) => !item.equipoId && item.activo !== false);
    if (sueltos.length) {
      const nota = document.createElement("p");
      nota.className = "ayuda";
      nota.textContent = "Sin equipo: " + sueltos.map((item) => item.nombre).join(", ") + ".";
      card.append(nota);
    }
    caja.append(card);
    return;
  }
  caja.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const [equipos, personas] = await Promise.all([api("/api/admin/equipos"), api("/api/admin/personas")]);
  caja.innerHTML = "";
  const equiposCard = tarjeta("Conectar equipos", "Crea el equipo y, en la lista, elige de cuál cuelga. El que no cuelga de nadie queda arriba.");
  const equipoNuevo = { nombre: "", descripcion: "", padreId: "" };
  const alta = document.createElement("div");
  alta.className = "liga";
  const padreNuevo = document.createElement("label");
  padreNuevo.className = "campo";
  padreNuevo.append(Object.assign(document.createElement("span"), { textContent: "Este equipo cuelga de" }));
  padreNuevo.append(selectDe(opcionesDeArbol(equipos, "padreId", "", "De nadie. Queda arriba"), "", (v) => (equipoNuevo.padreId = v)));
  const addEquipo = document.createElement("button");
  addEquipo.type = "button";
  addEquipo.className = "primario";
  addEquipo.textContent = "Agregar equipo";
  addEquipo.onclick = async () => {
    try {
      await api("/api/admin/equipos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(equipoNuevo),
      });
      toast("Equipo agregado");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  };
  alta.append(campo("Nombre del equipo", "", (v) => (equipoNuevo.nombre = v)), padreNuevo, addEquipo);
  equiposCard.append(alta);
  if (!equipos.length) {
    const vacio = document.createElement("p");
    vacio.className = "ayuda";
    vacio.textContent = "Todavía no hay equipos. El primero déjalo en «De nadie».";
    equiposCard.append(vacio);
  }
  ordenArbol(equipos, "padreId").forEach(({ item: equipo, nivel }) => {
    const fila = document.createElement("div");
    fila.className = "liga";
    fila.style.paddingLeft = nivel * 22 + "px";
    const nombre = document.createElement("strong");
    nombre.textContent = (nivel ? "↳ " : "") + equipo.nombre;
    const elegir = document.createElement("label");
    elegir.className = "campo";
    elegir.append(Object.assign(document.createElement("span"), { textContent: "Cuelga de" }));
    elegir.append(selectDe(opcionesDeArbol(equipos, "padreId", equipo.id, "De nadie. Queda arriba"), equipo.padreId || "", async (valor) => {
      try {
        await api("/api/admin/equipos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...equipo, padreId: valor }),
        });
        toast(valor ? "Quedó conectado" : "Quedó arriba");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    }));
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "suave";
    borrar.textContent = "Quitar";
    borrar.onclick = async () => {
      await api("/api/admin/equipos/" + encodeURIComponent(equipo.id), { method: "DELETE" });
      pintar();
    };
    fila.append(nombre, elegir, borrar);
    equiposCard.append(fila);
  });
  const gente = tarjeta("Conectar personas", "Abajo de cada persona eliges a quién reporta. Eso arma las ramas del organigrama.");
  const persona = { nombre: "", cargo: "", celular: "", correo: "", equipoId: "", reportaA: "", nota: "" };
  const altaPersona = document.createElement("div");
  altaPersona.className = "rejilla";
  const equipoLabel = document.createElement("label");
  equipoLabel.className = "campo";
  equipoLabel.append(Object.assign(document.createElement("span"), { textContent: "Equipo" }));
  equipoLabel.append(selectDe([{ id: "", nombre: "Sin equipo" }].concat(opcionesDeArbol(equipos, "padreId", "", "").slice(1)), "", (v) => (persona.equipoId = v)));
  const jefeLabel = document.createElement("label");
  jefeLabel.className = "campo";
  jefeLabel.append(Object.assign(document.createElement("span"), { textContent: "Reporta a" }));
  jefeLabel.append(selectDe(opcionesDeArbol(personas, "reportaA", "", "A nadie. Queda arriba"), "", (v) => (persona.reportaA = v)));
  altaPersona.append(
    campo("Nombre", "", (v) => (persona.nombre = v)),
    campo("Cargo", "", (v) => (persona.cargo = v)),
    campo("Celular", "", (v) => (persona.celular = v)),
    campo("Correo", "", (v) => (persona.correo = v)),
    equipoLabel,
    jefeLabel,
  );
  const addPersona = document.createElement("button");
  addPersona.type = "button";
  addPersona.className = "primario";
  addPersona.textContent = "Agregar persona";
  addPersona.onclick = async () => {
    try {
      await api("/api/admin/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona),
      });
      toast("Persona agregada");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  };
  gente.append(altaPersona, addPersona);
  ordenArbol(personas, "reportaA").forEach(({ item, nivel }) => {
    const fila = document.createElement("div");
    fila.className = "liga";
    fila.style.paddingLeft = nivel * 22 + "px";
    const nombre = document.createElement("strong");
    nombre.textContent = (nivel ? "↳ " : "") + item.nombre + (item.cargo ? " · " + item.cargo : "");
    const elegir = document.createElement("label");
    elegir.className = "campo";
    elegir.append(Object.assign(document.createElement("span"), { textContent: "Reporta a" }));
    elegir.append(selectDe(opcionesDeArbol(personas, "reportaA", item.id, "A nadie. Queda arriba"), item.reportaA || "", async (valor) => {
      try {
        await api("/api/admin/personas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, reportaA: valor }),
        });
        toast(valor ? "Quedó conectada" : "Quedó arriba");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    }));
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "suave";
    borrar.textContent = "Quitar";
    borrar.onclick = async () => {
      await api("/api/admin/personas/" + encodeURIComponent(item.id), { method: "DELETE" });
      pintar();
    };
    fila.append(nombre, elegir, borrar);
    gente.append(fila);
  });
  caja.append(equiposCard, gente);
}

async function pintar() {
  pintarNav();
  try {
    if (vista === "resumen") return await pintarResumen();
    if (vista === "pagina") return pintarPagina();
    if (vista === "apariencia") return pintarApariencia();
    if (vista === "chatbot") return await pintarChatbot();
    if (vista === "clientes") return await pintarClientes();
    if (vista === "pedidos") return await pintarPedidos();
    if (vista === "equipo") return await pintarEquipo();
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
