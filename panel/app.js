let sitio = null;
let vista = "resumen";
let paginaParte = "portada";
let chatParte = "clientes";
let clientesParte = "fichas";
let equipoParte = "personas";
const equiposAbiertos = new Set();
let orgEdit = null;
let contactoEdit = null;
let servicioId = null;
let pedidoDesde = "";
let internoParte = "sala";
let chatAbierto = "";
let chatComponer = "";
let chatYo = "";
let chatPersonas = [];
let reloj = null;
let sesion = { maestro: true, papel: "admin", personaId: "", usuarioId: "", usuario: "", nombre: "" };
let actividadParte = "tablero";
let sprintVista = "";
let epicaFiltro = "";
let personaFiltro = "";
let tareaAbierta = "";
let arrastrando = false;

const vistaEl = document.getElementById("vista");
const aviso = document.getElementById("aviso");

const TITULOS = {
  resumen: ["HOY", "Resumen"],
  pagina: ["LA PÁGINA", "Todo lo que ve la gente"],
  clientes: ["CLIENTES", "Estados y fichas"],
  pedidos: ["PEDIDOS", "Trabajos con cada cliente"],
  equipo: ["EQUIPO", "Contactos y organigrama"],
  chat: ["CHAT", "Conversaciones del equipo"],
  actividades: ["ACTIVIDADES", "Tablero"],
  usuarios: ["USUARIOS", "Acceso del equipo"],
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
  if (tipo === "color" || tipo === "date" || tipo === "number" || tipo === "password") input.type = tipo;
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

function esAdmin() {
  return sesion.maestro || sesion.papel === "admin";
}

function aplicarSesion() {
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    const libre = btn.dataset.nav === "chat" || btn.dataset.nav === "actividades";
    btn.hidden = !esAdmin() && !libre;
  });
  const quien = document.getElementById("quien");
  if (quien) quien.textContent = sesion.maestro ? "Clave del panel" : (sesion.nombre || sesion.usuario || "");
  if (sesion.personaId) chatYo = sesion.personaId;
  else {
    try { chatYo = localStorage.getItem("tavadev-chat-yo") || ""; } catch (error) { chatYo = chatYo || ""; }
  }
  if (!esAdmin() && vista !== "chat" && vista !== "actividades") vista = "actividades";
}

function elegir(etiqueta, opciones, valor, alCambiar) {
  const label = document.createElement("label");
  label.className = "campo";
  const span = document.createElement("span");
  span.textContent = etiqueta;
  label.append(span, selectDe(opciones, valor, alCambiar));
  return label;
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
  const titulosEquipo = {
    personas: ["EQUIPO", "Personas"],
    roles: ["EQUIPO", "Roles"],
    equipos: ["EQUIPO", "Equipos"],
    organigrama: ["EQUIPO", "Organigrama"],
  };
  const titulosInterno = {
    sala: ["CHAT", "Conversaciones del equipo"],
    disponibilidad: ["CHAT", "Disponibilidad"],
  };
  const titulosActividad = {
    tablero: ["ACTIVIDADES", "Tablero"],
    backlog: ["ACTIVIDADES", "Backlog"],
    epicas: ["ACTIVIDADES", "Épicas"],
    sprints: ["ACTIVIDADES", "Sprints"],
    estados: ["ACTIVIDADES", "Estados"],
  };
  const titulosPagina = {
    portada: ["PÁGINA", "Portada"],
    quienes: ["PÁGINA", "Quiénes somos"],
    pasos: ["PÁGINA", "Cómo trabajamos"],
    para: ["PÁGINA", "Es para ti"],
    cierre: ["PÁGINA", "Cierre"],
    contacto: ["PÁGINA", "Contacto"],
    marca: ["PÁGINA", "Marca y colores"],
  };
  const tituloEquipo = titulosEquipo[equipoParte] || titulosEquipo.personas;
  const mapa = vista === "chatbot"
    ? TITULOS_CHAT[chatParte]
    : vista === "pagina" || vista === "apariencia"
      ? titulosPagina[paginaParte] || titulosPagina.portada
    : vista === "clientes"
      ? tituloClientes
      : vista === "equipo"
        ? tituloEquipo
        : vista === "chat"
          ? titulosInterno[internoParte] || titulosInterno.sala
          : vista === "actividades"
            ? titulosActividad[actividadParte] || titulosActividad.tablero
            : TITULOS[vista];
  const [etiqueta, titulo] = mapa;
  document.getElementById("etiqueta").textContent = etiqueta;
  document.getElementById("titulo").textContent = titulo;
  const edita = vista === "pagina" || vista === "apariencia" || (vista === "chatbot" && (chatParte === "registro" || chatParte === "mensajes"));
  document.getElementById("guardar").hidden = !edita;
}

async function pintarResumen() {
  vistaEl.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const [estado, cotas, pedidos, tableroDatos] = await Promise.all([
    api("/api/admin/estado"),
    api("/api/admin/cotizaciones"),
    api("/api/admin/pedidos").catch(() => []),
    api("/api/admin/tablero").catch(() => null),
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
  if (tableroDatos) {
    const abiertas = tableroDatos.tareas.filter((item) => {
      const estadoTarea = tableroDatos.estados.find((estadoItem) => estadoItem.id === item.estadoId);
      return !estadoTarea || !estadoTarea.esFinal;
    }).length;
    const sprint = tableroDatos.sprints.find((item) => item.estado === "activo");
    bloques.push(["Tareas abiertas", abiertas], ["Sprint", sprint ? sprint.nombre : "Sin sprint activo"]);
  }
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
  if (vista === "apariencia") {
    vista = "pagina";
    paginaParte = "marca";
  }
  vistaEl.innerHTML = "";
  vistaEl.append(subnav([
    ["portada", "Portada"],
    ["quienes", "Quiénes"],
    ["pasos", "Cómo"],
    ["para", "Para ti"],
    ["cierre", "Cierre"],
    ["contacto", "Contacto"],
    ["marca", "Marca"],
  ], paginaParte, (id) => {
    paginaParte = id;
    ir("pagina");
  }));
  if (paginaParte === "marca") {
    pintarMarca();
    return;
  }
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
  const bloques = { portada: hero, quienes, pasos, para, cierre, contacto };
  vistaEl.append(bloques[paginaParte] || hero);
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

function pintarMarca() {
  const fotos = tarjeta("Imágenes", "El panel no cambia de colores: así siempre puedes leerlo. Lo que guardes aquí se ve en la página. Pulsa Guardar arriba.");
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

async function publicarPersona(persona) {
  return api("/api/admin/personas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(persona),
  });
}

async function sacarDeEquipo(persona, personas) {
  const huerfanos = (personas || []).filter((item) => item.equipoId === persona.equipoId && item.reportaA === persona.id);
  await publicarPersona({ ...persona, equipoId: "", reportaA: "" });
  for (const otro of huerfanos) await publicarPersona({ ...otro, reportaA: "" });
}

function enlaceDeEquipo(equipo, equipos, personas) {
  const caja = document.createElement("div");
  caja.className = "org-enlace";
  const disponibles = (personas || []).filter((item) => item.activo !== false && item.equipoId !== equipo.id);
  const delEquipo = (personas || []).filter((item) => item.equipoId === equipo.id && item.activo !== false);
  const eleccion = { personaId: "", reportaA: "" };
  const personaLabel = document.createElement("label");
  personaLabel.className = "campo";
  personaLabel.append(Object.assign(document.createElement("span"), { textContent: "Persona guardada" }));
  const opciones = [{ id: "", nombre: disponibles.length ? "Elige una persona" : "Primero créala en Personas" }];
  disponibles.forEach((item) => {
    const actual = (equipos || []).find((eq) => eq.id === item.equipoId);
    opciones.push({
      id: item.id,
      nombre: item.nombre + (item.cargo ? " · " + item.cargo : "") + (actual ? " · está en " + actual.nombre : ""),
    });
  });
  personaLabel.append(selectDe(opciones, "", (v) => (eleccion.personaId = v)));
  const jefeLabel = document.createElement("label");
  jefeLabel.className = "campo";
  jefeLabel.append(Object.assign(document.createElement("span"), { textContent: "Reporta a" }));
  jefeLabel.append(selectDe(
    [{ id: "", nombre: "A nadie en este equipo" }].concat(delEquipo.map((item) => ({ id: item.id, nombre: item.nombre }))),
    "",
    (v) => (eleccion.reportaA = v),
  ));
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "primario";
  boton.textContent = "Enlazar";
  boton.onclick = async () => {
    const persona = (personas || []).find((item) => item.id === eleccion.personaId);
    if (!persona) {
      toast("Elige una persona guardada");
      return;
    }
    try {
      if (persona.equipoId && persona.equipoId !== equipo.id) {
        const huerfanos = (personas || []).filter((item) => item.equipoId === persona.equipoId && item.reportaA === persona.id);
        for (const otro of huerfanos) await publicarPersona({ ...otro, reportaA: "" });
      }
      await publicarPersona({ ...persona, equipoId: equipo.id, reportaA: eleccion.reportaA });
      toast(persona.nombre + " quedó en " + equipo.nombre);
      equiposAbiertos.add(equipo.id);
      pintar();
    } catch (error) {
      toast(error.message);
    }
  };
  caja.append(personaLabel, jefeLabel, boton);
  return caja;
}

function selectorRol(roles, valor, alElegir) {
  const label = document.createElement("label");
  label.className = "campo";
  label.append(Object.assign(document.createElement("span"), { textContent: "Rol" }));
  const opciones = [{ id: "", nombre: (roles || []).length ? "Sin rol" : "Primero créalo en Roles" }];
  (roles || []).forEach((rol) => opciones.push({ id: rol.id, nombre: rol.codigo + " · " + rol.nombre }));
  label.append(selectDe(opciones, valor || "", alElegir));
  return label;
}

function textoRol(persona, roles, caracteristicas) {
  const rol = (roles || []).find((item) => item.id === persona.rolId);
  if (!rol) return persona.cargo || "Sin rol";
  const rasgos = (caracteristicas || []).filter((item) => item.rolId === rol.id).map((item) => item.codigo);
  return [rol.codigo, rol.nombre].concat(rasgos).join(" · ");
}

function formularioPersona(base, roles, alTerminar) {
  const draft = {
    id: base.id || "",
    nombre: base.nombre || "",
    cargo: base.cargo || "",
    celular: base.celular || "",
    correo: base.correo || "",
    equipoId: base.equipoId || "",
    rolId: base.rolId || "",
    reportaA: base.reportaA || "",
    nota: base.nota || "",
    foto: base.foto || "",
    activo: base.activo !== false,
  };
  const caja = document.createElement("div");
  caja.className = "rejilla org-editor";
  const acciones = document.createElement("div");
  acciones.className = "fila";
  const guardar = document.createElement("button");
  guardar.type = "button";
  guardar.className = "primario";
  guardar.textContent = "Guardar";
  guardar.onclick = async () => {
    try {
      await publicarPersona(draft);
      toast(draft.id ? "Persona actualizada" : "Persona agregada");
      alTerminar();
    } catch (error) {
      toast(error.message);
    }
  };
  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "suave";
  cancelar.textContent = "Cancelar";
  cancelar.onclick = () => alTerminar();
  acciones.append(guardar, cancelar);
  if (draft.id) {
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "peligro";
    quitar.textContent = "Quitar";
    quitar.onclick = async () => {
      try {
        await api("/api/admin/personas/" + encodeURIComponent(draft.id), { method: "DELETE" });
        toast("Persona quitada");
        alTerminar();
      } catch (error) {
        toast(error.message);
      }
    };
    acciones.append(quitar);
  }
  const rolLabel = selectorRol(roles, draft.rolId, (valor) => {
    draft.rolId = valor;
    const rol = (roles || []).find((item) => item.id === valor);
    draft.cargo = rol ? rol.nombre : "";
  });
  caja.append(
    fotoDePersona(draft),
    campo("Nombre", draft.nombre, (v) => (draft.nombre = v)),
    rolLabel,
    campo("Celular", draft.celular, (v) => (draft.celular = v)),
    campo("Correo", draft.correo, (v) => (draft.correo = v)),
    campo("Nota", draft.nota, (v) => (draft.nota = v), "area"),
    acciones,
  );
  return caja;
}

function formularioEquipo(base, equipos, alTerminar) {
  const draft = {
    id: base.id || "",
    nombre: base.nombre || "",
    descripcion: base.descripcion || "",
    padreId: base.padreId || "",
  };
  const caja = document.createElement("div");
  caja.className = "rejilla org-editor";
  const padre = document.createElement("label");
  padre.className = "campo";
  padre.append(Object.assign(document.createElement("span"), { textContent: "Cuelga de" }));
  padre.append(selectDe(opcionesDeArbol(equipos, "padreId", draft.id, "De nadie. Queda arriba"), draft.padreId, (v) => (draft.padreId = v)));
  const acciones = document.createElement("div");
  acciones.className = "fila";
  const guardar = document.createElement("button");
  guardar.type = "button";
  guardar.className = "primario";
  guardar.textContent = "Guardar";
  guardar.onclick = async () => {
    try {
      await api("/api/admin/equipos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      toast("Equipo actualizado");
      alTerminar();
    } catch (error) {
      toast(error.message);
    }
  };
  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "suave";
  cancelar.textContent = "Cancelar";
  cancelar.onclick = () => alTerminar();
  acciones.append(guardar, cancelar);
  if (draft.id) {
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "peligro";
    quitar.textContent = "Quitar equipo";
    quitar.onclick = async () => {
      try {
        await api("/api/admin/equipos/" + encodeURIComponent(draft.id), { method: "DELETE" });
        toast("Equipo quitado");
        alTerminar();
      } catch (error) {
        toast(error.message);
      }
    };
    acciones.append(quitar);
  }
  caja.append(
    campo("Nombre del equipo", draft.nombre, (v) => (draft.nombre = v)),
    campo("Descripción", draft.descripcion, (v) => (draft.descripcion = v), "area"),
    padre,
    acciones,
  );
  return caja;
}

function textoPersonas(cantidad) {
  const n = Number(cantidad) || 0;
  if (n === 1) return "1 persona";
  if (n > 1) return n + " personas";
  return "Sin personas";
}

function pintarRama(nodo, personas, equipos, roles, caracteristicas, esRaiz) {
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
  cargo.textContent = encargados.length
    ? encargados.map((item) => item.nombre + " · " + textoRol(item, roles, caracteristicas)).join(" · ")
    : "Sin encargado";
  const pie = document.createElement("p");
  pie.className = "org-ramas";
  pie.textContent = textoPersonas(delEquipo.length);
  abrir.append(nombre, cargo, pie);
  const gente = document.createElement("div");
  gente.className = "org-gente";
  const abierto = equiposAbiertos.has(nodo.id);
  gente.hidden = !abierto;
  abrir.setAttribute("aria-expanded", abierto ? "true" : "false");
  if (abierto) card.classList.add("abierta");
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
    detalle.textContent = [textoRol(item, roles, caracteristicas), item.celular, item.correo, jefe ? "reporta a " + jefe.nombre : ""].filter(Boolean).join(" · ");
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "org-mini";
    editar.textContent = "Editar";
    editar.onclick = () => {
      orgEdit = { tipo: "persona", id: item.id };
      equiposAbiertos.add(nodo.id);
      pintar();
    };
    const sacar = document.createElement("button");
    sacar.type = "button";
    sacar.className = "org-mini";
    sacar.textContent = "Sacar";
    sacar.onclick = async () => {
      try {
        await sacarDeEquipo(item, personas);
        toast(item.nombre + " salió del equipo");
        equiposAbiertos.add(nodo.id);
        pintar();
      } catch (error) {
        toast(error.message);
      }
    };
    ficha.append(quien, detalle, editar, sacar);
    gente.append(ficha);
  });
  const herramientas = document.createElement("div");
  const editarEquipo = document.createElement("button");
  editarEquipo.type = "button";
  editarEquipo.className = "org-mini";
  editarEquipo.textContent = "Editar equipo";
  editarEquipo.onclick = () => {
    orgEdit = { tipo: "equipo", id: nodo.id };
    equiposAbiertos.add(nodo.id);
    pintar();
  };
  herramientas.append(editarEquipo);
  gente.append(herramientas, enlaceDeEquipo(nodo, equipos, personas));
  abrir.onclick = () => {
    if (equiposAbiertos.has(nodo.id)) equiposAbiertos.delete(nodo.id);
    else equiposAbiertos.add(nodo.id);
    const sigue = equiposAbiertos.has(nodo.id);
    gente.hidden = !sigue;
    abrir.setAttribute("aria-expanded", sigue ? "true" : "false");
    card.classList.toggle("abierta", sigue);
  };
  card.append(abrir, gente);
  rama.append(card);
  if (nodo.hijos && nodo.hijos.length) {
    const hijos = document.createElement("div");
    hijos.className = "org-hijos";
    nodo.hijos.forEach((hijo) => hijos.append(pintarRama(hijo, personas, equipos, roles, caracteristicas, false)));
    rama.append(hijos);
  }
  return rama;
}

function vistaRoles(roles, caracteristicas) {
  const card = tarjeta("Roles", "El identificador es corto y único, como LIDER. Cada característica del rol también tiene el suyo, como DECIDE.");
  const nuevo = { codigo: "", nombre: "", descripcion: "" };
  const alta = document.createElement("div");
  alta.className = "rejilla";
  alta.append(
    campo("Identificador", "", (v) => (nuevo.codigo = v)),
    campo("Nombre", "", (v) => (nuevo.nombre = v)),
    campo("Descripción", "", (v) => (nuevo.descripcion = v), "area"),
  );
  const add = document.createElement("button");
  add.type = "button";
  add.className = "primario";
  add.textContent = "Agregar rol";
  add.onclick = async () => {
    try {
      await api("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevo),
      });
      toast("Rol guardado");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  };
  card.append(alta, add);
  if (!roles.length) {
    const vacio = document.createElement("p");
    vacio.className = "ayuda";
    vacio.textContent = "Todavía no hay roles. Si no guarda, pega de nuevo supabase/schema.sql en Supabase.";
    card.append(vacio);
  }
  roles.forEach((rol) => {
    const bloque = document.createElement("div");
    const fila = document.createElement("div");
    fila.className = "liga";
    const nombre = document.createElement("strong");
    nombre.textContent = rol.codigo + " · " + rol.nombre;
    const detalle = document.createElement("span");
    detalle.textContent = rol.descripcion || "Sin descripción";
    const acciones = document.createElement("div");
    acciones.className = "fila";
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "suave";
    editar.textContent = "Editar";
    editar.onclick = () => {
      contactoEdit = contactoEdit === "r:" + rol.id ? null : "r:" + rol.id;
      pintar();
    };
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "suave";
    quitar.textContent = "Quitar";
    quitar.onclick = async () => {
      try {
        await api("/api/admin/roles/" + encodeURIComponent(rol.id), { method: "DELETE" });
        pintar();
      } catch (error) {
        toast(error.message);
      }
    };
    acciones.append(editar, quitar);
    fila.append(nombre, detalle, acciones);
    bloque.append(fila);
    if (contactoEdit === "r:" + rol.id) {
      const draft = { id: rol.id, codigo: rol.codigo, nombre: rol.nombre, descripcion: rol.descripcion || "" };
      const form = document.createElement("div");
      form.className = "rejilla";
      form.append(
        campo("Identificador", draft.codigo, (v) => (draft.codigo = v)),
        campo("Nombre", draft.nombre, (v) => (draft.nombre = v)),
        campo("Descripción", draft.descripcion, (v) => (draft.descripcion = v), "area"),
      );
      const guardar = document.createElement("button");
      guardar.type = "button";
      guardar.className = "primario";
      guardar.textContent = "Guardar rol";
      guardar.onclick = async () => {
        try {
          await api("/api/admin/roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
          });
          contactoEdit = null;
          toast("Rol actualizado");
          pintar();
        } catch (error) {
          toast(error.message);
        }
      };
      form.append(guardar);
      bloque.append(form);
    }
    const rasgos = caracteristicas.filter((item) => item.rolId === rol.id);
    rasgos.forEach((rasgo) => {
      const linea = document.createElement("div");
      linea.className = "liga";
      linea.style.paddingLeft = "22px";
      const texto = document.createElement("strong");
      texto.textContent = rasgo.codigo + " · " + rasgo.nombre;
      const sacar = document.createElement("button");
      sacar.type = "button";
      sacar.className = "suave";
      sacar.textContent = "Quitar";
      sacar.onclick = async () => {
        try {
          await api("/api/admin/caracteristicas/" + encodeURIComponent(rasgo.id), { method: "DELETE" });
          pintar();
        } catch (error) {
          toast(error.message);
        }
      };
      linea.append(texto, document.createElement("span"), sacar);
      bloque.append(linea);
    });
    const rasgo = { rolId: rol.id, codigo: "", nombre: "" };
    const altaRasgo = document.createElement("div");
    altaRasgo.className = "liga";
    altaRasgo.style.paddingLeft = "22px";
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "primario";
    boton.textContent = "Agregar característica";
    boton.onclick = async () => {
      try {
        await api("/api/admin/caracteristicas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rasgo),
        });
        toast("Característica guardada");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    };
    altaRasgo.append(
      campo("Identificador", "", (v) => (rasgo.codigo = v)),
      campo("Nombre", "", (v) => (rasgo.nombre = v)),
      boton,
    );
    bloque.append(altaRasgo);
    card.append(bloque);
  });
  return card;
}

async function pintarEquipo() {
  vistaEl.innerHTML = "";
  vistaEl.append(subnav([["personas", "Personas"], ["roles", "Roles"], ["equipos", "Equipos"], ["organigrama", "Organigrama"]], equipoParte, (id) => {
    equipoParte = id;
    ir("equipo");
  }));
  const caja = document.createElement("div");
  vistaEl.append(caja);
  if (equipoParte === "organigrama") {
    caja.innerHTML = "<p class='ayuda'>Cargando…</p>";
    const data = await api("/api/admin/organigrama");
    caja.innerHTML = "";
    const card = tarjeta("Organigrama", "La persona se crea una vez en Personas, con un rol. Aquí abres el equipo y solo la enlazas.");
    const generar = document.createElement("button");
    generar.type = "button";
    generar.className = "suave";
    generar.textContent = "Generar SQL";
    generar.onclick = async () => {
      try {
        const dataSql = await api("/api/admin/organigrama/sql");
        let cajaSql = card.querySelector(".org-sql-caja");
        if (!cajaSql) {
          cajaSql = document.createElement("div");
          cajaSql.className = "org-sql-caja";
          const area = document.createElement("textarea");
          area.className = "org-sql";
          area.readOnly = true;
          const copiar = document.createElement("button");
          copiar.type = "button";
          copiar.className = "primario";
          copiar.textContent = "Copiar";
          copiar.onclick = async () => {
            area.focus();
            area.select();
            try {
              await navigator.clipboard.writeText(area.value);
              toast("SQL copiado");
            } catch (error) {
              toast("Selecciona el SQL y cópialo");
            }
          };
          cajaSql.append(area, copiar);
          card.append(cajaSql);
        }
        cajaSql.querySelector("textarea").value = dataSql.sql || "";
        toast("SQL listo");
      } catch (error) {
        toast(error.message);
      }
    };
    card.append(generar);
    const equiposArbol = data.equiposArbol || [];
    const personas = data.personas || [];
    if (!equiposArbol.length) {
      const p = document.createElement("p");
      p.className = "ayuda";
      p.textContent = "Agrega equipos en Equipos y marca de cuál cuelga cada uno.";
      card.append(p);
    } else {
      const org = document.createElement("div");
      org.className = "org";
      equiposArbol.forEach((raiz) => org.append(pintarRama(raiz, personas, data.equipos || [], data.roles || [], data.caracteristicas || [], true)));
      card.append(org);
    }
    const sueltos = personas.filter((item) => !item.equipoId && item.activo !== false);
    if (sueltos.length) {
      const nota = document.createElement("p");
      nota.className = "ayuda";
      nota.textContent = "Guardadas, todavía sin equipo";
      const fila = document.createElement("div");
      fila.className = "fila";
      sueltos.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "suave";
        btn.textContent = "Editar " + item.nombre;
        btn.onclick = () => {
          orgEdit = { tipo: "persona", id: item.id };
          pintar();
        };
        fila.append(btn);
      });
      card.append(nota, fila);
    }
    caja.append(card);
    const equipos = data.equipos || [];
    if (orgEdit && orgEdit.tipo === "equipo") {
      const base = equipos.find((item) => item.id === orgEdit.id);
      if (base) {
        const editor = tarjeta("Editar equipo", "Cambia el nombre, la descripción y de qué equipo cuelga.");
        editor.append(formularioEquipo(base, equipos, () => {
          orgEdit = null;
          pintar();
        }));
        caja.append(editor);
        editor.scrollIntoView({ block: "nearest" });
      }
    }
    if (orgEdit && orgEdit.tipo === "persona") {
      const base = orgEdit.id
        ? personas.find((item) => item.id === orgEdit.id)
        : { nombre: "", cargo: "", celular: "", correo: "", equipoId: orgEdit.equipoId || "", reportaA: "", nota: "" };
      if (base) {
        const editor = tarjeta("Editar " + base.nombre, "Nombre, rol y contacto. El equipo se elige al enlazarla.");
        editor.append(formularioPersona(base, data.roles || [], () => {
          orgEdit = null;
          pintar();
        }));
        caja.append(editor);
        editor.scrollIntoView({ block: "nearest" });
      }
    }
    return;
  }
  caja.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const [equipos, personas, roles, caracteristicas] = await Promise.all([
    api("/api/admin/equipos"),
    api("/api/admin/personas"),
    api("/api/admin/roles"),
    api("/api/admin/caracteristicas"),
  ]);
  caja.innerHTML = "";
  if (equipoParte === "roles") {
    caja.append(vistaRoles(roles, caracteristicas));
    return;
  }
  const equiposCard = tarjeta("Conectar equipos", "Cuelga un equipo de otro. Abajo eliges una persona ya guardada y a quién reporta en ese equipo.");
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
    const acciones = document.createElement("div");
    acciones.className = "fila";
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "suave";
    editar.textContent = "Editar";
    editar.onclick = () => {
      contactoEdit = contactoEdit === "e:" + equipo.id ? null : "e:" + equipo.id;
      pintar();
    };
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "suave";
    borrar.textContent = "Quitar";
    borrar.onclick = async () => {
      await api("/api/admin/equipos/" + encodeURIComponent(equipo.id), { method: "DELETE" });
      pintar();
    };
    acciones.append(editar, borrar);
    fila.append(nombre, elegir, acciones);
    const bloque = document.createElement("div");
    bloque.append(fila);
    if (contactoEdit === "e:" + equipo.id) {
      bloque.append(formularioEquipo(equipo, equipos, () => {
        contactoEdit = null;
        pintar();
      }));
    }
    personas.filter((item) => item.equipoId === equipo.id && item.activo !== false).forEach((item) => {
      const quien = document.createElement("div");
      quien.className = "liga";
      quien.style.paddingLeft = (nivel + 1) * 22 + "px";
      const nombrePersona = document.createElement("strong");
      nombrePersona.textContent = item.nombre + (item.cargo ? " · " + item.cargo : "");
      const sacar = document.createElement("button");
      sacar.type = "button";
      sacar.className = "suave";
      sacar.textContent = "Sacar";
      sacar.onclick = async () => {
        try {
          await sacarDeEquipo(item, personas);
          toast(item.nombre + " salió del equipo");
          pintar();
        } catch (error) {
          toast(error.message);
        }
      };
      quien.append(nombrePersona, sacar);
      bloque.append(quien);
    });
    bloque.append(enlaceDeEquipo(equipo, equipos, personas));
    equiposCard.append(bloque);
  });
  if (equipoParte === "equipos") {
    caja.append(equiposCard);
    return;
  }
  const gente = tarjeta("Personas", "Créala una vez. El rol y el contacto quedan guardados. Después solo la enlazas a un equipo.");
  const persona = { nombre: "", cargo: "", rolId: "", celular: "", correo: "", nota: "" };
  const altaPersona = document.createElement("div");
  altaPersona.className = "rejilla";
  altaPersona.append(
    campo("Nombre", "", (v) => (persona.nombre = v)),
    selectorRol(roles, "", (valor) => {
      persona.rolId = valor;
      const rol = roles.find((item) => item.id === valor);
      persona.cargo = rol ? rol.nombre : "";
    }),
    campo("Celular", "", (v) => (persona.celular = v)),
    campo("Correo", "", (v) => (persona.correo = v)),
  );
  const addPersona = document.createElement("button");
  addPersona.type = "button";
  addPersona.className = "primario";
  addPersona.textContent = "Agregar persona";
  addPersona.onclick = async () => {
    try {
      await publicarPersona(persona);
      toast("Persona agregada");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  };
  gente.append(altaPersona, addPersona);
  const ordenadas = personas.slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
  if (!ordenadas.length) {
    const vacio = document.createElement("p");
    vacio.className = "ayuda";
    vacio.textContent = "Todavía no hay personas. La primera queda guardada aunque no tenga equipo.";
    gente.append(vacio);
  }
  ordenadas.forEach((item) => {
    const fila = document.createElement("div");
    fila.className = "liga";
    const rol = roles.find((itemRol) => itemRol.id === item.rolId);
    const equipo = equipos.find((itemEquipo) => itemEquipo.id === item.equipoId);
    const nombre = document.createElement("strong");
    nombre.append(avatarDe(item, "sm"), document.createTextNode(" " + item.nombre + (rol ? " · " + rol.codigo : item.cargo ? " · " + item.cargo : "")));
    const donde = document.createElement("span");
    donde.textContent = [item.celular, item.correo, equipo ? equipo.nombre : "Sin equipo"].filter(Boolean).join(" · ");
    const acciones = document.createElement("div");
    acciones.className = "fila";
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "suave";
    editar.textContent = "Editar";
    editar.onclick = () => {
      contactoEdit = contactoEdit === item.id ? null : item.id;
      pintar();
    };
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "suave";
    borrar.textContent = "Quitar";
    borrar.onclick = async () => {
      await api("/api/admin/personas/" + encodeURIComponent(item.id), { method: "DELETE" });
      pintar();
    };
    acciones.append(editar, borrar);
    fila.append(nombre, donde, acciones);
    const bloque = document.createElement("div");
    bloque.append(fila);
    if (contactoEdit === item.id) {
      bloque.append(formularioPersona(item, roles, () => {
        contactoEdit = null;
        pintar();
      }));
    }
    gente.append(bloque);
  });
  caja.append(gente);
}

const EMOTES = ["✨", "🎭", "💜", "👏", "🔥", "😂", "🙌", "💪", "🌙", "✅", "❤️", "👀", "🎉", "🤝", "😴", "🫡"];

function nombreVisible(persona) {
  if (!persona) return "Alguien";
  return persona.apodo || persona.nombre || "Alguien";
}

function inicialesDe(persona) {
  const base = nombreVisible(persona);
  const partes = String(base).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!partes.length) return "?";
  return partes.map((parte) => parte[0]).join("").toUpperCase();
}

function colorDeAvatar(id) {
  const paleta = ["#6A4BC4", "#E57FB8", "#2A2346", "#7B5FD1", "#9D2F4A", "#3C8F63"];
  let n = 0;
  String(id || "?").split("").forEach((letra) => { n += letra.charCodeAt(0); });
  return paleta[n % paleta.length];
}

function avatarDe(persona, tam, colorEstado) {
  const el = document.createElement("span");
  el.className = "avatar" + (tam === "lg" ? " lg" : tam === "sm" ? " sm" : "");
  if (persona && persona.foto) {
    const img = document.createElement("img");
    img.src = persona.foto;
    img.alt = "";
    el.append(img);
  } else {
    el.style.background = colorDeAvatar(persona && persona.id);
    el.textContent = inicialesDe(persona);
  }
  if (colorEstado) {
    const punto = document.createElement("i");
    punto.className = "punto-estado";
    punto.style.background = colorEstado;
    el.append(punto);
  }
  return el;
}

function avatarGrupo(gente) {
  const caras = (gente || []).filter(Boolean).slice(0, 4);
  if (caras.length <= 1) return avatarDe(caras[0] || null);
  const caja = document.createElement("span");
  caja.className = "mosaico";
  caras.forEach((persona) => caja.append(avatarDe(persona, "sm")));
  return caja;
}

function fotoDePersona(draft) {
  const caja = document.createElement("div");
  caja.className = "campo ancho";
  const span = document.createElement("span");
  span.textContent = "Foto";
  const fila = document.createElement("div");
  fila.className = "fila";
  const poner = () => {
    const viejo = fila.querySelector(".avatar");
    const nuevo = avatarDe(draft, "lg");
    if (viejo) viejo.replaceWith(nuevo);
    else fila.prepend(nuevo);
  };
  poner();
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
      draft.foto = data.url;
      poner();
      toast("Foto lista. Guarda la ficha.");
    } catch (error) {
      toast(error.message);
    }
  });
  const quitar = document.createElement("button");
  quitar.type = "button";
  quitar.className = "suave";
  quitar.textContent = "Quitar foto";
  quitar.onclick = () => {
    draft.foto = "";
    poner();
  };
  fila.append(file, quitar);
  caja.append(span, fila);
  return caja;
}

function horaLista(valor) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  const hoy = new Date();
  if (fecha.toDateString() === hoy.toDateString()) {
    return fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function etiquetaPersona(persona) {
  return [persona.nombre, persona.apodo, persona.cargo].filter(Boolean).join(" · ");
}

function horaCorta(valor) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function tituloDeChat(chat, personas) {
  if (chat.tipo === "grupo") return chat.nombre || "Grupo";
  const otro = (chat.miembros || []).map((id) => personas.find((item) => item.id === id)).find((item) => item && item.id !== chatYo);
  return otro ? nombreVisible(otro) : "Chat";
}

function pintarHilo(hilo, mensajes) {
  hilo.innerHTML = "";
  hilo.dataset.ultimo = mensajes.length ? mensajes[mensajes.length - 1].id : "";
  if (!mensajes.length) {
    const vacio = document.createElement("p");
    vacio.className = "ayuda";
    vacio.textContent = "Todavía no hay mensajes. Escribe abajo o manda un emote.";
    hilo.append(vacio);
    return;
  }
  mensajes.forEach((mensaje, indice) => {
    const anterior = mensajes[indice - 1];
    const sigue = Boolean(anterior && anterior.personaId && anterior.personaId === mensaje.personaId);
    const persona = chatPersonas.find((item) => item.id === mensaje.personaId);
    const fila = document.createElement("article");
    fila.className = "msg" + (sigue ? " sigue" : "");
    if (!sigue) fila.append(avatarDe(persona));
    const cuerpo = document.createElement("div");
    if (!sigue) {
      const meta = document.createElement("div");
      meta.className = "msg-meta";
      const quien = document.createElement("b");
      quien.textContent = nombreVisible(persona);
      quien.style.color = colorDeAvatar(persona && persona.id);
      const hora = document.createElement("span");
      hora.textContent = horaCorta(mensaje.creadoEn);
      meta.append(quien, hora);
      cuerpo.append(meta);
    }
    const texto = document.createElement("p");
    if (mensaje.emote && !mensaje.texto) {
      texto.className = "emote-grande";
      texto.textContent = mensaje.emote;
    } else {
      texto.textContent = (mensaje.emote ? mensaje.emote + " " : "") + mensaje.texto;
    }
    cuerpo.append(texto);
    fila.append(cuerpo);
    hilo.append(fila);
  });
  hilo.scrollTop = hilo.scrollHeight;
}

async function refrescarMensajes() {
  const hilo = vistaEl.querySelector("[data-hilo]");
  if (!hilo || vista !== "chat" || !chatAbierto) return;
  try {
    const mensajes = await api("/api/admin/mensajes?chat=" + encodeURIComponent(chatAbierto));
    const ultimo = mensajes.length ? mensajes[mensajes.length - 1].id : "";
    if (ultimo === (hilo.dataset.ultimo || "") && hilo.childElementCount) return;
    pintarHilo(hilo, mensajes);
  } catch (error) {
    /* el siguiente envío muestra el error */
  }
}

async function pintarChat() {
  if (reloj) clearInterval(reloj);
  reloj = null;
  vistaEl.innerHTML = "";
  const caja = document.createElement("div");
  vistaEl.append(caja);
  caja.innerHTML = "<p class='ayuda'>Cargando…</p>";
  const [personas, chats, disponibilidades] = await Promise.all([
    api("/api/admin/personas"),
    api("/api/admin/chats"),
    api("/api/admin/disponibilidades"),
  ]);
  chatPersonas = personas;
  if (sesion.personaId) chatYo = sesion.personaId;
  else if (!personas.some((item) => item.id === chatYo)) chatYo = "";
  caja.innerHTML = "";
  if (internoParte === "disponibilidad") {
    const lista = esAdmin() ? personas : personas.filter((item) => item.id === sesion.personaId);
    caja.append(boton("Volver al chat", "suave", () => {
      internoParte = "sala";
      ir("chat");
    }));
    caja.append(vistaDisponibilidad(lista, disponibilidades, esAdmin()));
    return;
  }
  const colorDe = (persona) => {
    const estado = disponibilidades.find((item) => item.id === (persona && persona.disponibilidadId));
    return estado ? estado.color : "";
  };
  const cara = (persona, tam) => avatarDe(persona, tam, colorDe(persona));
  const genteDe = (chat) => (chat.miembros || []).map((id) => personas.find((item) => item.id === id)).filter(Boolean);
  const app = document.createElement("div");
  app.className = "chat-app";
  const lado = document.createElement("div");
  lado.className = "chat-lado";
  const perfil = document.createElement("div");
  perfil.className = "chat-perfil";
  const propia = personas.find((item) => item.id === chatYo);
  perfil.append(cara(propia, "lg"));
  const perfilTexto = document.createElement("div");
  if (sesion.personaId) {
    const nombre = document.createElement("b");
    nombre.textContent = propia ? nombreVisible(propia) : "Tu ficha";
    const detalle = document.createElement("p");
    detalle.textContent = propia ? [propia.nombre, propia.cargo].filter(Boolean).join(" · ") : "";
    perfilTexto.append(nombre, detalle);
  } else {
    perfilTexto.append(selectDe(
      [{ id: "", nombre: "Elige tu ficha" }].concat(personas.map((item) => ({ id: item.id, nombre: etiquetaPersona(item) }))),
      chatYo,
      (valor) => {
        chatYo = valor;
        try { localStorage.setItem("tavadev-chat-yo", valor); } catch (error) { /* sigue en esta visita */ }
        pintar();
      },
    ));
  }
  perfil.append(perfilTexto);
  const acciones = document.createElement("div");
  acciones.className = "chat-acciones";
  acciones.append(
    boton("Nuevo chat", chatComponer === "directo" ? "primario" : "suave", () => {
      chatComponer = "directo";
      chatAbierto = "";
      pintar();
    }),
    boton("Nuevo grupo", chatComponer === "grupo" ? "primario" : "suave", () => {
      chatComponer = "grupo";
      chatAbierto = "";
      pintar();
    }),
    boton("Estado", internoParte === "disponibilidad" ? "primario" : "suave", () => {
      internoParte = internoParte === "disponibilidad" ? "sala" : "disponibilidad";
      ir("chat");
    }),
  );
  lado.append(perfil, acciones);
  const lista = document.createElement("div");
  lista.className = "chat-lista";
  const ordenados = chats.slice().sort((a, b) => String((b.ultimo && b.ultimo.creadoEn) || b.creadoEn).localeCompare(String((a.ultimo && a.ultimo.creadoEn) || a.creadoEn)));
  if (!ordenados.length) {
    const vacio = document.createElement("p");
    vacio.className = "ayuda";
    vacio.textContent = "Todavía no hay chats. Empieza uno con una persona o arma un grupo.";
    lista.append(vacio);
  }
  ordenados.forEach((chat) => {
    const miembros = genteDe(chat);
    const otro = miembros.find((item) => item.id !== chatYo) || miembros[0];
    const item = document.createElement("button");
    item.type = "button";
    item.className = "chat-item" + (chat.id === chatAbierto && !chatComponer ? " activa" : "");
    item.append(chat.tipo === "grupo" ? avatarGrupo(miembros) : cara(otro));
    const textos = document.createElement("div");
    textos.className = "textos";
    const titulo = document.createElement("b");
    titulo.textContent = tituloDeChat(chat, personas);
    const previo = document.createElement("span");
    previo.textContent = chat.ultimo ? ((chat.ultimo.emote || "") + " " + (chat.ultimo.texto || "")).trim() : "Sin mensajes";
    textos.append(titulo, previo);
    const hora = document.createElement("time");
    hora.textContent = chat.ultimo ? horaLista(chat.ultimo.creadoEn) : "";
    item.append(textos, hora);
    item.onclick = () => {
      chatAbierto = chat.id;
      chatComponer = "";
      pintar();
    };
    lista.append(item);
  });
  lado.append(lista);
  const sala = document.createElement("div");
  sala.className = "chat-sala";
  const actual = !chatComponer && chats.find((item) => item.id === chatAbierto);
  if (chatComponer === "directo") {
    const cabeza = document.createElement("div");
    cabeza.className = "chat-cabeza";
    const textos = document.createElement("div");
    const h = document.createElement("h2");
    h.textContent = "Nuevo chat";
    const p = document.createElement("p");
    p.textContent = "Elige a alguien del equipo. Si ya hablaron, se abre la misma conversación.";
    textos.append(h, p);
    cabeza.append(textos);
    const gente = document.createElement("div");
    gente.className = "gente-chat";
    personas.filter((item) => item.id !== chatYo).forEach((persona) => {
      const fila = document.createElement("button");
      fila.type = "button";
      fila.className = "gente-fila";
      fila.append(cara(persona, "lg"));
      const datos = document.createElement("div");
      const nombre = document.createElement("b");
      nombre.textContent = nombreVisible(persona);
      const sub = document.createElement("p");
      sub.textContent = [persona.nombre !== nombreVisible(persona) ? persona.nombre : "", persona.cargo].filter(Boolean).join(" · ");
      datos.append(nombre, sub);
      fila.append(datos);
      fila.onclick = async () => {
        if (!chatYo) {
          toast("Primero elige quién eres");
          return;
        }
        try {
          const chat = await api("/api/admin/chats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: "directo", personaIds: [chatYo, persona.id] }),
          });
          chatAbierto = chat.id;
          chatComponer = "";
          pintar();
        } catch (error) {
          toast(error.message);
        }
      };
      gente.append(fila);
    });
    sala.append(cabeza, gente);
  } else if (chatComponer === "grupo") {
    const cabeza = document.createElement("div");
    cabeza.className = "chat-cabeza";
    const textos = document.createElement("div");
    const h = document.createElement("h2");
    h.textContent = "Nuevo grupo";
    const p = document.createElement("p");
    p.textContent = "Ponle nombre y marca a las personas. La misma persona puede estar en varios grupos.";
    textos.append(h, p);
    cabeza.append(textos);
    const nombreGrupo = { valor: "" };
    const elegidos = new Set();
    const marcas = document.createElement("div");
    marcas.className = "gente-chat";
    personas.forEach((persona) => {
      const fila = document.createElement("label");
      fila.className = "gente-fila";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.onchange = () => {
        if (box.checked) elegidos.add(persona.id);
        else elegidos.delete(persona.id);
      };
      const datos = document.createElement("div");
      const nombre = document.createElement("b");
      nombre.textContent = nombreVisible(persona);
      const sub = document.createElement("p");
      sub.textContent = persona.cargo || persona.nombre;
      datos.append(nombre, sub);
      fila.append(box, cara(persona), datos);
      marcas.append(fila);
    });
    const crear = boton("Crear grupo", "primario", async () => {
      const ids = [...elegidos];
      if (chatYo && !ids.includes(chatYo)) ids.push(chatYo);
      try {
        const chat = await api("/api/admin/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "grupo", nombre: nombreGrupo.valor, personaIds: ids }),
        });
        chatAbierto = chat.id;
        chatComponer = "";
        pintar();
      } catch (error) {
        toast(error.message);
      }
    });
    const alta = document.createElement("div");
    alta.className = "chat-alta";
    alta.append(campo("Nombre del grupo", "", (v) => (nombreGrupo.valor = v)), marcas, crear);
    sala.append(cabeza, alta);
  } else if (!actual) {
    const ayuda = document.createElement("p");
    ayuda.className = "ayuda sala-vacia";
    ayuda.textContent = "Elige una conversación, o empieza un chat o un grupo.";
    sala.append(ayuda);
  } else {
    const miembros = genteDe(actual);
    const otros = miembros.filter((item) => item.id !== chatYo);
    const cabeza = document.createElement("div");
    cabeza.className = "chat-cabeza";
    const foco = actual.tipo === "grupo" ? null : (otros[0] || miembros[0]);
    cabeza.append(actual.tipo === "grupo" ? avatarGrupo(miembros) : cara(foco, "lg"));
    const textos = document.createElement("div");
    const h = document.createElement("h2");
    h.textContent = tituloDeChat(actual, personas);
    const sub = document.createElement("p");
    if (actual.tipo === "grupo") {
      sub.textContent = miembros.map((item) => nombreVisible(item)).join(", ");
    } else if (foco) {
      sub.textContent = [foco.nombre, foco.cargo].filter(Boolean).join(" · ");
    }
    textos.append(h, sub);
    cabeza.append(textos);
    if (actual.tipo === "directo" && foco) {
      const apodo = { valor: foco.apodo || "" };
      const linea = document.createElement("div");
      linea.className = "apodo-linea";
      linea.append(campo("Apodo", foco.apodo || "", (v) => (apodo.valor = v)), boton("Guardar", "suave", async () => {
        try {
          await publicarPersona({ ...foco, apodo: apodo.valor });
          toast("Apodo guardado");
          pintar();
        } catch (error) {
          toast(error.message);
        }
      }));
      cabeza.append(linea);
    }
    if (actual.tipo === "grupo") {
      const nombre = { valor: actual.nombre || "" };
      const linea = document.createElement("div");
      linea.className = "apodo-linea";
      linea.append(campo("Nombre", actual.nombre || "", (v) => (nombre.valor = v)), boton("Guardar", "suave", async () => {
        try {
          await api("/api/admin/chats/" + encodeURIComponent(actual.id), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: nombre.valor }),
          });
          toast("Nombre del grupo guardado");
          pintar();
        } catch (error) {
          toast(error.message);
        }
      }));
      cabeza.append(linea);
    }
    const hilo = document.createElement("div");
    hilo.className = "hilo";
    hilo.dataset.hilo = "1";
    const mensajes = await api("/api/admin/mensajes?chat=" + encodeURIComponent(actual.id));
    pintarHilo(hilo, mensajes);
    let extra = null;
    if (actual.tipo === "grupo") {
      const fuera = personas.filter((item) => !actual.miembros.includes(item.id));
      if (fuera.length) {
        let sumar = "";
        extra = document.createElement("div");
        extra.className = "chat-sumar";
        extra.append(
          selectDe([{ id: "", nombre: "Agregar a alguien más" }].concat(fuera.map((item) => ({ id: item.id, nombre: etiquetaPersona(item) }))), "", (v) => (sumar = v)),
          boton("Agregar", "suave", async () => {
            if (!sumar) return;
            try {
              await api("/api/admin/chats/" + encodeURIComponent(actual.id) + "/miembros", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ personaId: sumar }),
              });
              pintar();
            } catch (error) {
              toast(error.message);
            }
          }),
        );
      }
    }
    const emotes = document.createElement("div");
    emotes.className = "emotes";
    emotes.hidden = true;
    const entrada = document.createElement("input");
    entrada.placeholder = chatYo ? "Escribe un mensaje" : "Primero elige quién eres";
    entrada.disabled = !chatYo || !actual.miembros.includes(chatYo);
    async function enviar(texto, emote) {
      if (!chatYo) {
        toast("Elige quién eres");
        return;
      }
      try {
        await api("/api/admin/mensajes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: actual.id, personaId: chatYo, texto, emote: emote || "" }),
        });
        entrada.value = "";
        await refrescarMensajes();
      } catch (error) {
        toast(error.message);
      }
    }
    EMOTES.forEach((signo) => {
      const signoBtn = document.createElement("button");
      signoBtn.type = "button";
      signoBtn.textContent = signo;
      signoBtn.onclick = () => {
        if (entrada.value.trim()) {
          entrada.value += signo;
          entrada.focus();
          return;
        }
        enviar("", signo);
      };
      emotes.append(signoBtn);
    });
    const emoji = document.createElement("button");
    emoji.type = "button";
    emoji.className = "icono";
    emoji.textContent = "😊";
    emoji.onclick = () => { emotes.hidden = !emotes.hidden; };
    const enviarBtn = document.createElement("button");
    enviarBtn.type = "button";
    enviarBtn.className = "primario";
    enviarBtn.textContent = "Enviar";
    enviarBtn.disabled = entrada.disabled;
    enviarBtn.onclick = () => enviar(entrada.value, "");
    entrada.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") enviar(entrada.value, "");
    });
    const pie = document.createElement("div");
    pie.className = "composer";
    pie.append(emoji, entrada, enviarBtn);
    sala.append(cabeza);
    if (extra) sala.append(extra);
    sala.append(hilo, emotes, pie);
    reloj = setInterval(refrescarMensajes, 4000);
  }
  app.append(lado, sala);
  caja.append(app);
}

function vistaDisponibilidad(personas, disponibilidades, editarCatalogo) {
  const puede = editarCatalogo !== false;
  const card = tarjeta("Disponibilidad", puede ? "Cada persona puede tener un estado. Si falta uno, escríbelo y agrégalo." : "Marca cómo estás hoy. El apodo es como te ven en el chat.");
  const nuevo = { nombre: "", color: "#7B5FD1" };
  const alta = document.createElement("div");
  alta.className = "fila";
  const agregar = document.createElement("button");
  agregar.type = "button";
  agregar.className = "primario";
  agregar.textContent = "Agregar estado";
  agregar.onclick = async () => {
    try {
      await api("/api/admin/disponibilidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevo),
      });
      toast("Estado agregado");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  };
  alta.append(campo("Nombre", "", (v) => (nuevo.nombre = v)), campo("Color", nuevo.color, (v) => (nuevo.color = v), "color"), agregar);
  if (puede) card.append(alta);
  disponibilidades.forEach((estado) => {
    const fila = document.createElement("div");
    fila.className = "liga";
    const nombre = document.createElement("strong");
    const punto = document.createElement("i");
    punto.className = "punto-disp";
    punto.style.background = estado.color;
    nombre.append(punto, document.createTextNode(" " + estado.nombre));
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "suave";
    quitar.textContent = "Quitar";
    quitar.onclick = async () => {
      await api("/api/admin/disponibilidades/" + encodeURIComponent(estado.id), { method: "DELETE" });
      pintar();
    };
    fila.append(nombre, document.createElement("span"));
    if (puede) fila.append(quitar);
    card.append(fila);
  });
  const gente = tarjeta("Personas", "El apodo es como la ves en el chat. El nombre del organigrama no cambia.");
  personas.forEach((persona) => {
    const fila = document.createElement("div");
    fila.className = "persona-chat";
    const estado = disponibilidades.find((item) => item.id === persona.disponibilidadId);
    const punto = document.createElement("i");
    punto.className = "punto-disp";
    punto.style.background = estado ? estado.color : "#d9cff5";
    const nombre = document.createElement("strong");
    nombre.textContent = etiquetaPersona(persona);
    const elegir = selectDe(
      [{ id: "", nombre: "Sin estado" }].concat(disponibilidades.map((item) => ({ id: item.id, nombre: item.nombre }))),
      persona.disponibilidadId || "",
      async (valor) => {
        try {
          await publicarPersona({ ...persona, disponibilidadId: valor });
          toast("Disponibilidad actualizada");
          pintar();
        } catch (error) {
          toast(error.message);
        }
      },
    );
    const apodo = { valor: persona.apodo || "" };
    const guardar = document.createElement("button");
    guardar.type = "button";
    guardar.className = "suave";
    guardar.textContent = "Apodo";
    guardar.onclick = async () => {
      try {
        await publicarPersona({ ...persona, apodo: apodo.valor });
        toast("Apodo guardado");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    };
    fila.append(punto, nombre, elegir, campo("Apodo", persona.apodo || "", (v) => (apodo.valor = v)), guardar);
    gente.append(fila);
  });
  const caja = document.createElement("div");
  caja.append(card, gente);
  return caja;
}

const TIPOS_TAREA = [
  { id: "historia", nombre: "Historia" },
  { id: "tarea", nombre: "Tarea" },
  { id: "error", nombre: "Error" },
];
const PRIORIDADES = [
  { id: "baja", nombre: "Baja" },
  { id: "media", nombre: "Media" },
  { id: "alta", nombre: "Alta" },
  { id: "urgente", nombre: "Urgente" },
];
const NOMBRE_SPRINT = { planificado: "Planificado", activo: "Activo", cerrado: "Cerrado" };
let epicaEnEdicion = null;
let sprintEnEdicion = null;

function boton(texto, clase, accion) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = clase;
  btn.textContent = texto;
  btn.onclick = accion;
  return btn;
}

async function enviarJson(url, cuerpo, metodo) {
  return api(url, {
    method: metodo || "POST",
    headers: { "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
}

function nombrePersona(personas, id) {
  const persona = (personas || []).find((item) => item.id === id);
  return persona ? nombreVisible(persona) : "";
}

function corteDe(sprints) {
  if (sprintVista === "todo" || sprintVista === "backlog") return sprintVista;
  if (sprintVista && sprints.some((item) => item.id === sprintVista)) return sprintVista;
  const activo = sprints.find((item) => item.estado === "activo");
  return activo ? activo.id : "backlog";
}

function tareasVisibles(tareas, corte) {
  return tareas.filter((item) => {
    if (corte === "todo") return true;
    if (corte === "backlog") return !item.sprintId;
    return item.sprintId === corte;
  }).filter((item) => !epicaFiltro || item.epicaId === epicaFiltro)
    .filter((item) => !personaFiltro || item.personaId === personaFiltro)
    .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, "es"));
}

function fichaTarea(data, corte) {
  const actual = data.tareas.find((item) => item.id === tareaAbierta);
  if (tareaAbierta && tareaAbierta !== "nueva" && !actual) {
    tareaAbierta = "";
    return document.createElement("div");
  }
  const inicial = (data.estados.find((item) => item.esInicial) || data.estados[0] || {}).id || "";
  const base = actual
    ? { ...actual, puntos: actual.puntos == null ? "" : String(actual.puntos) }
    : {
      titulo: "",
      detalle: "",
      criterio: "",
      tipo: "tarea",
      prioridad: "media",
      puntos: "",
      epicaId: epicaFiltro || "",
      sprintId: corte === "todo" || corte === "backlog" ? "" : corte,
      estadoId: inicial,
      personaId: sesion.personaId || "",
    };
  const card = tarjeta(actual ? "Tarea" : "Nueva tarea", "Historia, tarea y error ya vienen definidos. La prioridad también. Arrastrar la tarjeta cambia la columna.");
  card.append(campo("Título", base.titulo, (v) => (base.titulo = v)));
  card.append(campo("Detalle", base.detalle, (v) => (base.detalle = v), "area"));
  card.append(campo("Cómo sabemos que quedó lista", base.criterio, (v) => (base.criterio = v), "area"));
  const rejilla = document.createElement("div");
  rejilla.className = "rejilla";
  rejilla.append(
    elegir("Tipo", TIPOS_TAREA, base.tipo, (v) => (base.tipo = v)),
    elegir("Prioridad", PRIORIDADES, base.prioridad, (v) => (base.prioridad = v)),
    elegir("Estado", data.estados.map((item) => ({ id: item.id, nombre: item.nombre })), base.estadoId, (v) => (base.estadoId = v)),
    elegir("Sprint", [{ id: "", nombre: "Backlog" }].concat(data.sprints.map((item) => ({ id: item.id, nombre: item.nombre }))), base.sprintId, (v) => (base.sprintId = v)),
    elegir("Épica", [{ id: "", nombre: "Sin épica" }].concat(data.epicas.map((item) => ({ id: item.id, nombre: item.nombre }))), base.epicaId, (v) => (base.epicaId = v)),
    elegir("Responsable", [{ id: "", nombre: "Sin asignar" }].concat(data.personas.map((item) => ({ id: item.id, nombre: etiquetaPersona(item) }))), base.personaId, (v) => (base.personaId = v)),
    campo("Puntos", base.puntos, (v) => (base.puntos = v), "number"),
  );
  card.append(rejilla);
  const acciones = document.createElement("div");
  acciones.className = "fila";
  acciones.append(boton("Guardar", "primario", async () => {
    try {
      const guardada = await enviarJson("/api/admin/tareas", {
        ...base,
        id: actual ? actual.id : undefined,
        puntos: base.puntos === "" || base.puntos == null ? null : Number(base.puntos),
      });
      tareaAbierta = guardada.id;
      toast("Tarea guardada");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  }));
  acciones.append(boton("Cerrar", "suave", () => {
    tareaAbierta = "";
    pintar();
  }));
  if (actual) {
    acciones.append(boton("Quitar", "peligro", async () => {
      try {
        await api("/api/admin/tareas/" + encodeURIComponent(actual.id), { method: "DELETE" });
        tareaAbierta = "";
        toast("Tarea quitada");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    }));
  }
  card.append(acciones);
  if (!actual) return card;
  const notas = data.notas.filter((item) => item.tareaId === actual.id);
  const bloque = document.createElement("div");
  const tituloNotas = document.createElement("h3");
  tituloNotas.textContent = "Notas";
  bloque.append(tituloNotas);
  if (!notas.length) {
    const vacio = document.createElement("p");
    vacio.className = "ayuda";
    vacio.textContent = "Todavía no hay notas.";
    bloque.append(vacio);
  }
  notas.forEach((nota) => {
    const fila = document.createElement("div");
    fila.className = "nota-item";
    const quien = document.createElement("strong");
    quien.textContent = nombrePersona(data.personas, nota.personaId) || "Administración";
    const texto = document.createElement("p");
    texto.textContent = nota.texto;
    const cuando = document.createElement("span");
    cuando.className = "ayuda";
    cuando.textContent = horaCorta(nota.creadoEn);
    fila.append(quien, texto, cuando);
    if (esAdmin() || nota.personaId === sesion.personaId) {
      fila.append(boton("Quitar", "suave", async () => {
        try {
          await api("/api/admin/notas/" + encodeURIComponent(nota.id), { method: "DELETE" });
          pintar();
        } catch (error) {
          toast(error.message);
        }
      }));
    }
    bloque.append(fila);
  });
  const nueva = { texto: "" };
  const alta = document.createElement("div");
  alta.className = "fila";
  alta.append(campo("Nota", "", (v) => (nueva.texto = v), "area"), boton("Anotar", "primario", async () => {
    try {
      await enviarJson("/api/admin/notas", { tareaId: actual.id, personaId: sesion.personaId || "", texto: nueva.texto });
      toast("Nota guardada");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  }));
  bloque.append(alta);
  card.append(bloque);
  return card;
}

function tarjetaDeTarea(tarea, data) {
  const epica = data.epicas.find((item) => item.id === tarea.epicaId);
  const card = document.createElement("article");
  card.className = "tarea-card";
  card.draggable = true;
  card.dataset.tarea = tarea.id;
  card.title = "Arrastra a otra columna";
  card.style.borderLeftColor = epica ? epica.color : "#B9A3F2";
  card.addEventListener("dragstart", (evento) => {
    arrastrando = true;
    card.classList.add("arrastrando");
    evento.dataTransfer.setData("text/plain", tarea.id);
    evento.dataTransfer.effectAllowed = "move";
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("arrastrando");
    setTimeout(() => { arrastrando = false; }, 0);
  });
  card.addEventListener("click", () => {
    if (arrastrando) return;
    tareaAbierta = tarea.id;
    pintar();
  });
  const tipo = document.createElement("span");
  tipo.className = "tipo-tarea";
  const prioridad = PRIORIDADES.find((item) => item.id === tarea.prioridad);
  tipo.textContent = (TIPOS_TAREA.find((item) => item.id === tarea.tipo) || TIPOS_TAREA[1]).nombre;
  const punto = document.createElement("i");
  punto.className = "punto-disp";
  punto.style.background = { baja: "#B9A3F2", media: "#7B5FD1", alta: "#E57FB8", urgente: "#9D2F4A" }[tarea.prioridad] || "#7B5FD1";
  punto.title = prioridad ? prioridad.nombre : "";
  const cabeza = document.createElement("div");
  cabeza.className = "fila";
  cabeza.append(tipo, punto);
  const titulo = document.createElement("b");
  titulo.textContent = tarea.titulo;
  card.append(cabeza, titulo);
  const meta = [epica ? epica.nombre : "", nombrePersona(data.personas, tarea.personaId), tarea.puntos == null ? "" : tarea.puntos + " pts"].filter(Boolean);
  if (meta.length) {
    const p = document.createElement("p");
    p.textContent = meta.join(" · ");
    card.append(p);
  }
  return card;
}

function vistaTablero(data) {
  const corte = corteDe(data.sprints);
  const envoltorio = document.createElement("div");
  const ayuda = document.createElement("p");
  ayuda.className = "ayuda";
  ayuda.textContent = "Arrastra una tarjeta a otra columna para cambiarle el estado. El backlog es lo que todavía no entra a un sprint.";
  const filtros = document.createElement("div");
  filtros.className = "rejilla";
  const opcionesSprint = [{ id: "todo", nombre: "Todo el trabajo" }, { id: "backlog", nombre: "Backlog" }].concat(data.sprints.map((item) => ({
    id: item.id,
    nombre: item.nombre + (item.estado === "activo" ? " · activo" : ""),
  })));
  filtros.append(
    elegir("Vista", opcionesSprint, corte, (valor) => { sprintVista = valor; pintar(); }),
    elegir("Épica", [{ id: "", nombre: "Todas" }].concat(data.epicas.map((item) => ({ id: item.id, nombre: item.nombre }))), epicaFiltro, (valor) => { epicaFiltro = valor; pintar(); }),
    elegir("Persona", [{ id: "", nombre: "Todas" }].concat(data.personas.map((item) => ({ id: item.id, nombre: etiquetaPersona(item) }))), personaFiltro, (valor) => { personaFiltro = valor; pintar(); }),
  );
  const acciones = document.createElement("div");
  acciones.className = "fila";
  acciones.append(boton("Nueva tarea", "primario", () => { tareaAbierta = "nueva"; pintar(); }));
  const tablero = document.createElement("div");
  tablero.className = "tablero";
  const visibles = tareasVisibles(data.tareas, corte);
  data.estados.forEach((estado) => {
    const col = document.createElement("section");
    col.className = "columna";
    const h = document.createElement("h3");
    const nombre = document.createElement("span");
    nombre.textContent = estado.nombre;
    const cuenta = document.createElement("span");
    const deColumna = visibles.filter((item) => item.estadoId === estado.id);
    cuenta.textContent = String(deColumna.length);
    h.append(nombre, cuenta);
    const punto = document.createElement("i");
    punto.className = "punto-disp";
    punto.style.background = estado.color;
    nombre.prepend(punto, document.createTextNode(" "));
    col.append(h);
    if (!deColumna.length) {
      const vacio = document.createElement("p");
      vacio.className = "ayuda";
      vacio.textContent = "Suelta aquí";
      col.append(vacio);
    }
    deColumna.forEach((tarea) => col.append(tarjetaDeTarea(tarea, data)));
    col.addEventListener("dragover", (evento) => {
      evento.preventDefault();
      col.classList.add("sobre");
    });
    col.addEventListener("dragleave", () => col.classList.remove("sobre"));
    col.addEventListener("drop", async (evento) => {
      evento.preventDefault();
      col.classList.remove("sobre");
      const id = evento.dataTransfer.getData("text/plain");
      if (!id) return;
      const antes = evento.target.closest("[data-tarea]");
      const ids = deColumna.filter((item) => item.id !== id).map((item) => item.id);
      const en = antes ? ids.indexOf(antes.dataset.tarea) : -1;
      ids.splice(en < 0 ? ids.length : en, 0, id);
      try {
        await enviarJson("/api/admin/tareas/orden", { estadoId: estado.id, ids });
        pintar();
      } catch (error) {
        toast(error.message);
      }
    });
    tablero.append(col);
  });
  envoltorio.append(ayuda, filtros, acciones);
  const plan = document.createElement("div");
  plan.className = "plan" + (tareaAbierta ? "" : " sin-ficha");
  plan.append(tablero);
  if (tareaAbierta) plan.append(fichaTarea(data, corte));
  envoltorio.append(plan);
  return envoltorio;
}

function vistaBacklog(data) {
  const card = tarjeta("Backlog", "Estas tareas todavía no están en un sprint. Elige un sprint para meterlas.");
  const sueltas = data.tareas.filter((item) => !item.sprintId).sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, "es"));
  if (!sueltas.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "El backlog está vacío.";
    card.append(p);
  }
  sueltas.forEach((tarea) => {
    const fila = document.createElement("div");
    fila.className = "liga";
    const nombre = document.createElement("strong");
    nombre.textContent = tarea.titulo;
    nombre.style.cursor = "pointer";
    nombre.onclick = () => { tareaAbierta = tarea.id; actividadParte = "tablero"; sprintVista = "backlog"; pintar(); };
    const meta = document.createElement("span");
    const epica = data.epicas.find((item) => item.id === tarea.epicaId);
    const tipo = TIPOS_TAREA.find((item) => item.id === tarea.tipo) || TIPOS_TAREA[1];
    meta.textContent = [tipo.nombre, epica ? epica.nombre : "", nombrePersona(data.personas, tarea.personaId)].filter(Boolean).join(" · ");
    const meter = selectDe([{ id: "", nombre: "A un sprint…" }].concat(data.sprints.map((item) => ({ id: item.id, nombre: item.nombre }))), "", async (valor) => {
      if (!valor) return;
      try {
        await enviarJson("/api/admin/tareas", { ...tarea, sprintId: valor });
        toast("Entró al sprint");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    });
    fila.append(nombre, meta, meter);
    card.append(fila);
  });
  card.append(boton("Nueva tarea en el backlog", "primario", () => {
    tareaAbierta = "nueva";
    sprintVista = "backlog";
    actividadParte = "tablero";
    pintar();
  }));
  return card;
}

function vistaEpicas(data) {
  const caja = document.createElement("div");
  const base = epicaEnEdicion ? { ...epicaEnEdicion } : { nombre: "", resumen: "", color: "#7B5FD1", estado: "abierta" };
  const form = tarjeta(epicaEnEdicion ? "Editar épica" : "Nueva épica", "Una épica agrupa varias tareas de un mismo esfuerzo. Por ejemplo: temporada, web o gira.");
  form.append(campo("Nombre", base.nombre, (v) => (base.nombre = v)));
  form.append(campo("Contexto", base.resumen, (v) => (base.resumen = v), "area"));
  form.append(campo("Color", base.color, (v) => (base.color = v), "color"));
  const acciones = document.createElement("div");
  acciones.className = "fila";
  acciones.append(boton("Guardar", "primario", async () => {
    try {
      await enviarJson("/api/admin/epicas", { ...base, id: epicaEnEdicion ? epicaEnEdicion.id : undefined });
      epicaEnEdicion = null;
      toast("Épica guardada");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  }));
  if (epicaEnEdicion) {
    acciones.append(boton("Cancelar", "suave", () => { epicaEnEdicion = null; pintar(); }));
  }
  form.append(acciones);
  const lista = tarjeta("Épicas");
  if (!data.epicas.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Todavía no hay épicas.";
    lista.append(p);
  }
  data.epicas.forEach((epica) => {
    const fila = document.createElement("div");
    fila.className = "liga";
    const nombre = document.createElement("strong");
    const punto = document.createElement("i");
    punto.className = "punto-disp";
    punto.style.background = epica.color;
    nombre.append(punto, document.createTextNode(" " + epica.nombre));
    const meta = document.createElement("span");
    const cuantas = data.tareas.filter((item) => item.epicaId === epica.id).length;
    meta.textContent = (epica.estado === "cerrada" ? "Cerrada" : "Abierta") + " · " + cuantas + (cuantas === 1 ? " tarea" : " tareas");
    const controles = document.createElement("div");
    controles.className = "fila";
    controles.append(boton("Editar", "suave", () => { epicaEnEdicion = epica; pintar(); }));
    controles.append(boton(epica.estado === "cerrada" ? "Abrir" : "Cerrar", "suave", async () => {
      try {
        await enviarJson("/api/admin/epicas", { ...epica, estado: epica.estado === "cerrada" ? "abierta" : "cerrada" });
        pintar();
      } catch (error) {
        toast(error.message);
      }
    }));
    if (esAdmin()) {
      controles.append(boton("Quitar", "peligro", async () => {
        try {
          await api("/api/admin/epicas/" + encodeURIComponent(epica.id), { method: "DELETE" });
          if (epicaEnEdicion && epicaEnEdicion.id === epica.id) epicaEnEdicion = null;
          pintar();
        } catch (error) {
          toast(error.message);
        }
      }));
    }
    fila.append(nombre, meta, controles);
    if (epica.resumen) {
      const resumen = document.createElement("p");
      resumen.className = "ayuda";
      resumen.textContent = epica.resumen;
      lista.append(fila, resumen);
    } else lista.append(fila);
  });
  caja.append(form, lista);
  return caja;
}

function vistaSprints(data) {
  const caja = document.createElement("div");
  const base = sprintEnEdicion
    ? { ...sprintEnEdicion }
    : { nombre: "", meta: "", inicio: "", fin: "", estado: "planificado" };
  const form = tarjeta(sprintEnEdicion ? "Editar sprint" : "Nuevo sprint", "Un sprint es un tramo con fecha. Solo uno queda activo: al activar otro, el anterior vuelve a planificado.");
  form.append(campo("Nombre", base.nombre, (v) => (base.nombre = v)));
  form.append(campo("Meta", base.meta, (v) => (base.meta = v), "area"));
  const fechas = document.createElement("div");
  fechas.className = "rejilla";
  fechas.append(campo("Inicio", base.inicio, (v) => (base.inicio = v), "date"), campo("Fin", base.fin, (v) => (base.fin = v), "date"));
  form.append(fechas);
  form.append(elegir("Estado", [
    { id: "planificado", nombre: "Planificado" },
    { id: "activo", nombre: "Activo" },
    { id: "cerrado", nombre: "Cerrado" },
  ], base.estado, (v) => (base.estado = v)));
  const acciones = document.createElement("div");
  acciones.className = "fila";
  acciones.append(boton("Guardar", "primario", async () => {
    try {
      await enviarJson("/api/admin/sprints", { ...base, id: sprintEnEdicion ? sprintEnEdicion.id : undefined });
      sprintEnEdicion = null;
      toast("Sprint guardado");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  }));
  if (sprintEnEdicion) acciones.append(boton("Cancelar", "suave", () => { sprintEnEdicion = null; pintar(); }));
  form.append(acciones);
  const lista = tarjeta("Sprints");
  if (!data.sprints.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Todavía no hay sprints. El tablero muestra el backlog hasta que actives uno.";
    lista.append(p);
  }
  data.sprints.forEach((sprint) => {
    const fila = document.createElement("div");
    fila.className = "liga";
    const nombre = document.createElement("strong");
    nombre.textContent = sprint.nombre;
    const meta = document.createElement("span");
    const cuantas = data.tareas.filter((item) => item.sprintId === sprint.id).length;
    const fechasTxt = [sprint.inicio, sprint.fin].filter(Boolean).join(" – ");
    meta.textContent = [NOMBRE_SPRINT[sprint.estado] || sprint.estado, fechasTxt, cuantas + (cuantas === 1 ? " tarea" : " tareas"), sprint.meta].filter(Boolean).join(" · ");
    const controles = document.createElement("div");
    controles.className = "fila";
    controles.append(boton("Editar", "suave", () => { sprintEnEdicion = sprint; pintar(); }));
    if (sprint.estado !== "activo") {
      controles.append(boton("Activar", "primario", async () => {
        try {
          await enviarJson("/api/admin/sprints", { ...sprint, estado: "activo" });
          sprintVista = sprint.id;
          toast("Sprint activo");
          pintar();
        } catch (error) {
          toast(error.message);
        }
      }));
    }
    if (sprint.estado !== "cerrado") {
      controles.append(boton("Cerrar", "suave", async () => {
        try {
          await enviarJson("/api/admin/sprints", { ...sprint, estado: "cerrado" });
          pintar();
        } catch (error) {
          toast(error.message);
        }
      }));
    }
    if (esAdmin()) {
      controles.append(boton("Quitar", "peligro", async () => {
        try {
          await api("/api/admin/sprints/" + encodeURIComponent(sprint.id), { method: "DELETE" });
          if (sprintEnEdicion && sprintEnEdicion.id === sprint.id) sprintEnEdicion = null;
          pintar();
        } catch (error) {
          toast(error.message);
        }
      }));
    }
    fila.append(nombre, meta, controles);
    lista.append(fila);
  });
  caja.append(form, lista);
  return caja;
}

function vistaEstadosActividad(data) {
  const card = tarjeta("Estados", "Estas columnas salen listas: Por hacer, En curso, En revisión y Listo. Puedes agregar otras y cambiar el orden. El orden es el orden del tablero.");
  const nuevo = { nombre: "", color: "#7B5FD1" };
  const alta = document.createElement("div");
  alta.className = "fila";
  alta.append(campo("Nombre", "", (v) => (nuevo.nombre = v)), campo("Color", nuevo.color, (v) => (nuevo.color = v), "color"), boton("Agregar", "primario", async () => {
    try {
      await enviarJson("/api/admin/actividad-estados", nuevo);
      toast("Estado agregado");
      pintar();
    } catch (error) {
      toast(error.message);
    }
  }));
  card.append(alta);
  data.estados.forEach((estado, indice) => {
    const fila = document.createElement("div");
    fila.className = "liga";
    const edicion = { nombre: estado.nombre, color: estado.color };
    const nombre = campo("Nombre", estado.nombre, (v) => (edicion.nombre = v));
    const color = campo("Color", estado.color, (v) => (edicion.color = v), "color");
    const controles = document.createElement("div");
    controles.className = "fila";
    controles.append(boton("Guardar", "suave", async () => {
      try {
        await enviarJson("/api/admin/actividad-estados", { ...estado, ...edicion });
        toast("Estado guardado");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    }));
    if (indice > 0) {
      controles.append(boton("Subir", "suave", async () => {
        await enviarJson("/api/admin/actividad-estados/" + encodeURIComponent(estado.id) + "/mover", { delta: -1 });
        pintar();
      }));
    }
    if (indice < data.estados.length - 1) {
      controles.append(boton("Bajar", "suave", async () => {
        await enviarJson("/api/admin/actividad-estados/" + encodeURIComponent(estado.id) + "/mover", { delta: 1 });
        pintar();
      }));
    }
    if (esAdmin()) {
      controles.append(boton("Quitar", "peligro", async () => {
        try {
          await api("/api/admin/actividad-estados/" + encodeURIComponent(estado.id), { method: "DELETE" });
          pintar();
        } catch (error) {
          toast(error.message);
        }
      }));
    }
    fila.append(nombre, color, controles);
    card.append(fila);
  });
  return card;
}

async function pintarActividades() {
  if (reloj) clearInterval(reloj);
  reloj = null;
  vistaEl.innerHTML = "";
  vistaEl.append(subnav([
    ["tablero", "Tablero"],
    ["backlog", "Backlog"],
    ["epicas", "Épicas"],
    ["sprints", "Sprints"],
    ["estados", "Estados"],
  ], actividadParte, (id) => {
    actividadParte = id;
    ir("actividades");
  }));
  const caja = document.createElement("div");
  vistaEl.append(caja);
  caja.className = "ayuda";
  caja.textContent = "Cargando…";
  const data = await api("/api/admin/tablero");
  caja.className = "";
  caja.textContent = "";
  if (actividadParte === "backlog") caja.append(vistaBacklog(data));
  else if (actividadParte === "epicas") caja.append(vistaEpicas(data));
  else if (actividadParte === "sprints") caja.append(vistaSprints(data));
  else if (actividadParte === "estados") caja.append(vistaEstadosActividad(data));
  else caja.append(vistaTablero(data));
}

async function pintarUsuarios() {
  vistaEl.innerHTML = "";
  if (!esAdmin()) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Esta parte es para quien administra el panel.";
    vistaEl.append(p);
    return;
  }
  const caja = document.createElement("div");
  vistaEl.append(caja);
  caja.className = "ayuda";
  caja.textContent = "Cargando…";
  const [personas, usuarios] = await Promise.all([api("/api/admin/personas"), api("/api/admin/usuarios")]);
  caja.className = "";
  caja.textContent = "";
  const libres = personas.filter((item) => !usuarios.some((cuenta) => cuenta.personaId === item.id));
  const form = tarjeta("Nuevo usuario", "El usuario se cuelga de una persona del equipo. En el chat escribe con esa ficha. Quien entra con la contraseña general deja el usuario vacío y ve todo.");
  if (!personas.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Primero crea las personas en Equipo. Después vuelves aquí y les abres el acceso.";
    form.append(p);
  } else if (!libres.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Todas las personas ya tienen usuario.";
    form.append(p);
  } else {
    const alta = { personaId: libres[0].id, usuario: "", clave: "", papel: "equipo" };
    form.append(elegir("Persona", libres.map((item) => ({ id: item.id, nombre: etiquetaPersona(item) })), alta.personaId, (v) => (alta.personaId = v)));
    form.append(campo("Usuario", "", (v) => (alta.usuario = v)));
    form.append(campo("Contraseña", "", (v) => (alta.clave = v), "password"));
    form.append(elegir("Papel", [{ id: "equipo", nombre: "Equipo: chat y tablero" }, { id: "admin", nombre: "Administra: todo el panel" }], alta.papel, (v) => (alta.papel = v)));
    form.append(boton("Crear usuario", "primario", async () => {
      try {
        await enviarJson("/api/admin/usuarios", alta);
        toast("Usuario creado");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    }));
  }
  const lista = tarjeta("Usuarios");
  if (!usuarios.length) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Todavía no hay usuarios.";
    lista.append(p);
  }
  usuarios.forEach((cuenta) => {
    const fila = document.createElement("div");
    fila.className = "cota";
    const nombre = document.createElement("strong");
    nombre.textContent = (cuenta.nombre || "Sin ficha") + " · " + cuenta.usuario;
    const meta = document.createElement("p");
    meta.className = "ayuda";
    meta.textContent = (cuenta.papel === "admin" ? "Administra el panel" : "Chat y tablero") + (cuenta.activo ? "" : " · en pausa") + (cuenta.cargo ? " · " + cuenta.cargo : "");
    const controles = document.createElement("div");
    controles.className = "fila";
    controles.append(elegir("Papel", [{ id: "equipo", nombre: "Equipo" }, { id: "admin", nombre: "Administra" }], cuenta.papel, async (valor) => {
      try {
        await enviarJson("/api/admin/usuarios", { ...cuenta, papel: valor });
        toast("Papel actualizado");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    }));
    const clave = { valor: "" };
    controles.append(campo("Nueva contraseña", "", (v) => (clave.valor = v), "password"));
    controles.append(boton("Cambiar clave", "suave", async () => {
      if (String(clave.valor || "").length < 6) {
        toast("La contraseña necesita al menos 6 caracteres");
        return;
      }
      try {
        await enviarJson("/api/admin/usuarios", { ...cuenta, clave: clave.valor });
        toast("Contraseña actualizada");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    }));
    controles.append(boton(cuenta.activo ? "Pausar" : "Activar", "suave", async () => {
      try {
        await enviarJson("/api/admin/usuarios", { ...cuenta, activo: !cuenta.activo });
        pintar();
      } catch (error) {
        toast(error.message);
      }
    }));
    controles.append(boton("Quitar acceso", "peligro", async () => {
      try {
        await api("/api/admin/usuarios/" + encodeURIComponent(cuenta.id), { method: "DELETE" });
        toast("Acceso quitado");
        pintar();
      } catch (error) {
        toast(error.message);
      }
    }));
    fila.append(nombre, meta, controles);
    lista.append(fila);
  });
  caja.append(form, lista);
}

async function pintar() {
  pintarNav();
  try {
    if (vista === "resumen") return await pintarResumen();
    if (vista === "pagina" || vista === "apariencia") return pintarPagina();
    if (vista === "chatbot") return await pintarChatbot();
    if (vista === "clientes") return await pintarClientes();
    if (vista === "pedidos") return await pintarPedidos();
    if (vista === "equipo") return await pintarEquipo();
    if (vista === "chat") return await pintarChat();
    if (vista === "actividades") return await pintarActividades();
    if (vista === "usuarios") return await pintarUsuarios();
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

api("/api/admin/sesion")
  .then((data) => {
    sesion = data;
    aplicarSesion();
    return api("/api/admin/sitio");
  })
  .then((data) => {
    sitio = data;
    return pintar();
  })
  .catch((error) => {
    vistaEl.textContent = error.message;
  });
