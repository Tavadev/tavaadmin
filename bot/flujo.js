const { getSitio } = require("./contenido");
const { sesionNueva } = require("./sesiones");

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function activos(sitio) {
  return (sitio.servicios || []).filter((item) => item.activo);
}

function menuDe(sitio) {
  const lineas = activos(sitio).map((item, i) => `${i + 1}. ${item.nombre}`);
  const intro = String(sitio.bot.bienvenida || "").trim();
  return `${intro}\n\n${lineas.join("\n")}\n\nSi prefieres hablar con una persona, escribe ASESOR.`;
}

function esComandoMenu(texto) {
  return /^(menu|inicio|volver|servicios|opciones)$/.test(normalizar(texto));
}

function esSaludo(texto) {
  return /^(hola+|holi+|hey|buenas|buen dia|buenos dias|buenas tardes|buenas noches|que tal|buenas noches)$/.test(
    normalizar(texto),
  );
}

function esCancelar(texto) {
  return /^(cancelar|cancelo|olvidalo|ya no|no gracias|parar|salir)$/.test(normalizar(texto));
}

function esAsesor(texto) {
  return /^(asesor|asesora|persona|humano|humana|alguien)$/.test(normalizar(texto));
}

function esSi(texto) {
  return /^(si|sip|sis|claro|ok|okay|listo|dale|confirmo|de una|va|correcto)$/.test(normalizar(texto));
}

function esNo(texto) {
  return /^(no|nop|nel|corregir|cambiar)$/.test(normalizar(texto));
}

const NUMEROS = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };

function numeroDe(texto, total) {
  const n = normalizar(texto);
  const directo = n.match(/^(?:la |el |opcion |numero )?(\d+)$/);
  if (directo) {
    const valor = Number(directo[1]);
    if (valor >= 1 && valor <= total) return valor;
  }
  if (NUMEROS[n] && NUMEROS[n] <= total) return NUMEROS[n];
  return 0;
}

function buscarServicio(sitio, texto) {
  const lista = activos(sitio);
  const porNumero = numeroDe(texto, lista.length);
  if (porNumero) return lista[porNumero - 1];
  const n = normalizar(texto);
  let mejor = null;
  for (const servicio of lista) {
    const nombres = [servicio.nombre].concat(servicio.palabras || []);
    for (const palabra of nombres) {
      const p = normalizar(palabra);
      if (!p || p.length < 3) continue;
      if (n === p || n.includes(p)) {
        if (!mejor || p.length > mejor.largo) mejor = { servicio, largo: p.length };
      }
    }
  }
  return mejor && mejor.servicio;
}

function celularDeJid(jid) {
  const crudo = String(jid || "").split("@")[0].split(":")[0].replace(/\D/g, "");
  if (!crudo || /lid$/i.test(String(jid || ""))) return "";
  if (crudo.length > 10) return crudo.slice(-10);
  return crudo;
}

function clonar(sesion) {
  return {
    estado: sesion.estado,
    servicioId: sesion.servicioId,
    paso: sesion.paso || 0,
    respuestas: (sesion.respuestas || []).map((item) => ({ ...item })),
    nombre: sesion.nombre,
    negocio: sesion.negocio,
    presentada: sesion.presentada,
  };
}

function empezar(sitio, servicio) {
  const sesion = sesionNueva();
  sesion.presentada = true;
  sesion.servicioId = servicio.id;
  sesion.estado = "pregunta";
  sesion.paso = 0;
  const primera = (servicio.preguntas || [])[0];
  if (!primera) {
    sesion.estado = "nombre";
    return { sesion, respuesta: `${servicio.nombre}. ${sitio.bot.pedirNombre}` };
  }
  return {
    sesion,
    respuesta: `${servicio.nombre}.\n\n${primera}`,
  };
}

function resumenDe(sitio, sesion) {
  const servicio = (sitio.servicios || []).find((item) => item.id === sesion.servicioId);
  const bloque = (sesion.respuestas || [])
    .map((item, i) => `${i + 1}. ${item.pregunta}\n${item.respuesta}`)
    .join("\n\n");
  return [
    sitio.bot.antesDeConfirmar,
    "",
    `Servicio: ${servicio ? servicio.nombre : "servicio"}`,
    bloque,
    "",
    `Nombre: ${sesion.nombre}`,
    `Negocio: ${sesion.negocio || "sin nombre todavía"}`,
    "",
    sitio.bot.confirmar,
  ]
    .filter((linea) => linea !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function armarCotizacion(sitio, sesion, extra) {
  const servicio = (sitio.servicios || []).find((item) => item.id === sesion.servicioId);
  return {
    origen: "whatsapp",
    servicioId: sesion.servicioId,
    servicioNombre: servicio ? servicio.nombre : "",
    nombre: sesion.nombre,
    negocio: sesion.negocio || "",
    celular: celularDeJid(extra && extra.jid),
    jid: (extra && extra.jid) || "",
    respuestas: sesion.respuestas || [],
    mensaje: "",
    estado: "nueva",
  };
}

function procesarMensaje(sesion, texto, extra) {
  const sitio = getSitio();
  const actual = clonar(sesion || sesionNueva());
  const crudo = String(texto || "").trim();
  const jid = extra && extra.jid;

  if (!activos(sitio).length) {
    return { sesion: actual, respuesta: "Todavía no hay servicios publicados. Escríbenos en un rato." };
  }

  if (esCancelar(crudo) && actual.estado !== "menu") {
    const limpia = sesionNueva();
    limpia.presentada = true;
    return { sesion: limpia, respuesta: sitio.bot.cancelado };
  }

  if (esAsesor(crudo)) {
    const quieta = clonar(actual);
    quieta.estado = "asesor";
    return {
      sesion: quieta,
      respuesta: sitio.bot.asesor,
      pausar: { celular: celularDeJid(jid) || (extra && extra.celular) || "", jid: jid || "" },
    };
  }

  if ((esComandoMenu(crudo) || (esSaludo(crudo) && (actual.estado === "menu" || actual.estado === "listo" || actual.estado === "asesor"))) && actual.estado !== "nombre") {
    if (actual.estado === "pregunta" && esSaludo(crudo) && !esComandoMenu(crudo)) {
      const servicio = (sitio.servicios || []).find((item) => item.id === actual.servicioId);
      const pregunta = servicio && servicio.preguntas[actual.paso];
      return { sesion: actual, respuesta: `Sigo con esto:\n\n${pregunta}\n\nSi quieres ver los servicios de nuevo, escribe MENU.` };
    }
    if (esComandoMenu(crudo) || esSaludo(crudo)) {
      const limpia = sesionNueva();
      limpia.presentada = true;
      return { sesion: limpia, respuesta: menuDe(sitio) };
    }
  }

  if (!actual.presentada && actual.estado === "menu") {
    const elegido = buscarServicio(sitio, crudo);
    actual.presentada = true;
    if (elegido && !esSaludo(crudo)) return empezar(sitio, elegido);
    return { sesion: actual, respuesta: menuDe(sitio) };
  }

  if (actual.estado === "menu" || actual.estado === "listo") {
    const elegido = buscarServicio(sitio, crudo);
    if (elegido) return empezar(sitio, elegido);
    return { sesion: actual, respuesta: `${sitio.bot.noEntendi}\n\n${menuDe(sitio)}` };
  }

  if (actual.estado === "pregunta") {
    const servicio = (sitio.servicios || []).find((item) => item.id === actual.servicioId) || activos(sitio)[0];
    if (crudo.length < 2) {
      return { sesion: actual, respuesta: servicio.preguntas[actual.paso] || sitio.bot.noEntendi };
    }
    actual.respuestas.push({ pregunta: servicio.preguntas[actual.paso], respuesta: crudo.slice(0, 500) });
    actual.paso += 1;
    if (actual.paso < servicio.preguntas.length) {
      return { sesion: actual, respuesta: servicio.preguntas[actual.paso] };
    }
    actual.estado = "nombre";
    return { sesion: actual, respuesta: sitio.bot.pedirNombre };
  }

  if (actual.estado === "nombre") {
    const nombre = crudo.replace(/\s+/g, " ");
    if (nombre.length < 2 || /^\d+$/.test(nombre)) {
      return { sesion: actual, respuesta: sitio.bot.pedirNombre };
    }
    actual.nombre = nombre.slice(0, 80);
    actual.estado = "negocio";
    return { sesion: actual, respuesta: sitio.bot.pedirNegocio };
  }

  if (actual.estado === "negocio") {
    const negocio = crudo.replace(/\s+/g, " ");
    actual.negocio = /^ninguno$/.test(normalizar(negocio)) ? "" : negocio.slice(0, 80);
    actual.estado = "confirmar";
    return { sesion: actual, respuesta: resumenDe(sitio, actual) };
  }

  if (actual.estado === "confirmar") {
    if (esNo(crudo)) {
      const servicio = (sitio.servicios || []).find((item) => item.id === actual.servicioId);
      actual.respuestas = [];
      actual.paso = 0;
      actual.estado = servicio && servicio.preguntas.length ? "pregunta" : "nombre";
      const sigue = actual.estado === "pregunta" ? servicio.preguntas[0] : sitio.bot.pedirNombre;
      return { sesion: actual, respuesta: `De acuerdo. Vamos de nuevo.\n\n${sigue}` };
    }
    if (!esSi(crudo)) {
      return { sesion: actual, respuesta: sitio.bot.confirmar };
    }
    return {
      sesion: actual,
      respuesta: sitio.bot.gracias,
      cotizacion: armarCotizacion(sitio, actual, extra),
    };
  }

  if (actual.estado === "asesor") {
    return { sesion: actual, respuesta: "" };
  }

  return { sesion: actual, respuesta: menuDe(sitio) };
}

module.exports = { procesarMensaje, menuDe, normalizar };
