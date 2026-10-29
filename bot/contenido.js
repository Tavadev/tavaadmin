const fs = require("fs");
const path = require("path");
const { clienteSupabase, usaSupabase } = require("./nube");
const operacion = require("./operacion");

try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch (_) {}

const archivoSitio = path.join(__dirname, "..", "datos", "sitio.json");
const archivoCotas = path.join(__dirname, "..", "datos", "cotizaciones.json");
const archivoPausas = path.join(__dirname, "..", "datos", "pausas.json");
const carpetaMedia = path.join(__dirname, "..", "media");

const TONOS = ["lila", "rosa", "oscuro", "blanco"];
const ESTILO_CLAVES = [
  "fondo",
  "profundo",
  "morado",
  "acento",
  "rosado",
  "lavanda",
  "rosadoPastel",
  "tarjetaLila",
  "tarjetaRosa",
  "texto",
  "textoSuave",
  "textoOscuroSuave",
];

let cacheSitio = null;
let cachePausas = [];
let cachePausasEn = 0;
let avisador = null;
let resolverJids = null;

function leerJson(archivo, fallback) {
  try {
    return JSON.parse(fs.readFileSync(archivo, "utf8"));
  } catch {
    return fallback;
  }
}

function escribirJson(archivo, data) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, JSON.stringify(data, null, 2), "utf8");
}

function slug(texto) {
  return (
    String(texto || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "item"
  );
}

function recorte(valor, max) {
  return String(valor == null ? "" : valor).replace(/\r/g, "").trim().slice(0, max);
}

function hex(valor, fallback) {
  const t = String(valor || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toUpperCase() : fallback;
}

function urlSegura(valor) {
  const t = recorte(valor, 500);
  if (!t) return "";
  if (t.startsWith("/marca/") || t.startsWith("/media/")) return t;
  if (/^https:\/\/[^\s]+$/i.test(t)) return t;
  return "";
}

function listaTextos(valor, maxItems, maxLen) {
  const origen = Array.isArray(valor) ? valor : String(valor || "").split(",");
  const salida = [];
  for (const item of origen) {
    const texto = recorte(item, maxLen);
    if (!texto) continue;
    salida.push(texto);
    if (salida.length >= maxItems) break;
  }
  return salida;
}

function baseSitio() {
  const data = leerJson(archivoSitio, null);
  if (data && data.marca && data.hero) return data;
  return {
    marca: { nombre: "TAVADEV", frase: "", aparte: "", logoClaro: "", logoOscuro: "", simbolo: "" },
    estilo: {},
    hero: { etiqueta: "TAVADEV", titulo: "TAVADEV", acento: "", bajada: "", boton: "Quiero una cotización", secundario: "Ver qué hacemos", pruebas: [] },
    quienes: { etiqueta: "", titulo: "", texto: "" },
    servicios: [],
    pasos: { etiqueta: "", titulo: "", items: [] },
    paraQuien: { etiqueta: "", titulo: "", items: [] },
    cierre: { etiqueta: "", titulo: "", texto: "", boton: "Pedir cotización" },
    contacto: { whatsapp: "", correo: "", instagram: "", web: "", prefijo: "57" },
    bot: { avisos: [] },
  };
}

function normalizarSitio(data) {
  const base = baseSitio();
  const entrada = data && typeof data === "object" ? data : {};
  const estiloBase = base.estilo || {};
  const estilo = {};
  for (const clave of ESTILO_CLAVES) {
    estilo[clave] = hex((entrada.estilo || {})[clave], hex(estiloBase[clave], "#2A2346"));
  }

  const heroBase = base.hero || {};
  const heroIn = entrada.hero || {};
  const hero = {
    etiqueta: recorte(heroIn.etiqueta, 60) || heroBase.etiqueta || "TAVADEV",
    titulo: recorte(heroIn.titulo, 140) || heroBase.titulo || "TAVADEV",
    acento: recorte(heroIn.acento, 180) || heroBase.acento || "",
    bajada: recorte(heroIn.bajada, 400) || heroBase.bajada || "",
    boton: recorte(heroIn.boton, 40) || heroBase.boton || "Quiero una cotización",
    secundario: recorte(heroIn.secundario, 40) || heroBase.secundario || "Ver qué hacemos",
    pruebas: listaTextos(heroIn.pruebas || heroBase.pruebas, 3, 80),
  };

  const marcaIn = entrada.marca || {};
  const marcaBase = base.marca || {};
  const marca = {
    nombre: "TAVADEV",
    frase: recorte(marcaIn.frase, 120) || marcaBase.frase || "",
    aparte: recorte(marcaIn.aparte, 80) || marcaBase.aparte || "",
    logoClaro: marcaIn.logoClaro != null ? urlSegura(marcaIn.logoClaro) : urlSegura(marcaBase.logoClaro),
    logoOscuro: marcaIn.logoOscuro != null ? urlSegura(marcaIn.logoOscuro) : urlSegura(marcaBase.logoOscuro),
    simbolo: urlSegura(marcaIn.simbolo),
  };

  const quienesIn = entrada.quienes || {};
  const quienesBase = base.quienes || {};
  const quienes = {
    etiqueta: recorte(quienesIn.etiqueta, 40) || quienesBase.etiqueta || "",
    titulo: recorte(quienesIn.titulo, 220) || quienesBase.titulo || "",
    texto: recorte(quienesIn.texto, 1200) || quienesBase.texto || "",
  };

  let serviciosFuente = Array.isArray(entrada.servicios) ? entrada.servicios : null;
  if (!serviciosFuente || !serviciosFuente.length) serviciosFuente = base.servicios || [];
  const usados = new Set();
  const servicios = serviciosFuente.slice(0, 30).map((item, i) => {
    const nombre = recorte(item && item.nombre, 60) || `Servicio ${i + 1}`;
    let id = slug((item && item.id) || nombre);
    while (usados.has(id)) id = `${id}-${usados.size + 1}`;
    usados.add(id);
    const tono = TONOS.includes(item && item.tono) ? item.tono : "lila";
    return {
      id,
      activo: !item || item.activo !== false,
      tipo: item && item.tipo === "producto" ? "producto" : "servicio",
      icono: recorte(item && item.icono, 24) || "</>",
      nombre,
      resumen: recorte(item && item.resumen, 220),
      tono,
      imagen: urlSegura(item && item.imagen),
      palabras: listaTextos(item && item.palabras, 12, 32),
      preguntas: listaTextos(item && item.preguntas, 6, 200),
      detalles: (Array.isArray(item && item.detalles) ? item.detalles : [])
        .slice(0, 12)
        .map((detalle) => ({
          titulo: recorte(detalle && detalle.titulo, 60),
          texto: recorte(detalle && detalle.texto, 400),
        }))
        .filter((detalle) => detalle.titulo || detalle.texto),
    };
  });

  const pasosIn = entrada.pasos || {};
  const pasosBase = base.pasos || {};
  let pasosItems = Array.isArray(pasosIn.items) ? pasosIn.items : pasosBase.items || [];
  pasosItems = pasosItems.slice(0, 4).map((item, i) => ({
    numero: String(i + 1).padStart(2, "0"),
    titulo: recorte(item && item.titulo, 40) || `Paso ${i + 1}`,
    texto: recorte(item && item.texto, 220),
  }));
  if (!pasosItems.length) pasosItems = [{ numero: "01", titulo: "Nos cuentas", texto: "" }];

  const paraIn = entrada.paraQuien || {};
  const paraBase = base.paraQuien || {};
  let paraItems = listaTextos(paraIn.items && paraIn.items.length ? paraIn.items : paraBase.items, 6, 180);

  const cierreIn = entrada.cierre || {};
  const cierreBase = base.cierre || {};
  const cierre = {
    etiqueta: recorte(cierreIn.etiqueta, 40) || cierreBase.etiqueta || "HABLEMOS",
    titulo: recorte(cierreIn.titulo, 160) || cierreBase.titulo || "",
    texto: recorte(cierreIn.texto, 400) || cierreBase.texto || "",
    boton: recorte(cierreIn.boton, 40) || cierreBase.boton || "Pedir cotización",
  };

  const contactoIn = entrada.contacto || {};
  const contactoBase = base.contacto || {};
  let prefijo = recorte(contactoIn.prefijo || contactoBase.prefijo || "57", 4).replace(/\D/g, "");
  if (prefijo.length < 1 || prefijo.length > 3) prefijo = "57";
  const contacto = {
    whatsapp: recorte(contactoIn.whatsapp || "", 20).replace(/[^\d]/g, ""),
    correo: recorte(contactoIn.correo || "", 80),
    instagram: recorte(contactoIn.instagram || "", 80),
    web: recorte(contactoIn.web || "", 120),
    prefijo,
  };

  const botIn = entrada.bot || {};
  const botBase = base.bot || {};
  const campoBot = (clave, max) => recorte(botIn[clave], max) || recorte(botBase[clave], max);
  const avisos = (Array.isArray(botIn.avisos) ? botIn.avisos : botBase.avisos || [])
    .slice(0, 8)
    .map((aviso) => ({
      nombre: recorte(aviso && aviso.nombre, 40) || "Aviso",
      valor: recorte(aviso && aviso.valor, 80),
    }))
    .filter((aviso) => aviso.valor);

  return {
    marca,
    estilo,
    hero,
    quienes,
    servicios,
    pasos: {
      etiqueta: recorte(pasosIn.etiqueta, 40) || pasosBase.etiqueta || "",
      titulo: recorte(pasosIn.titulo, 120) || pasosBase.titulo || "",
      items: pasosItems,
    },
    paraQuien: {
      etiqueta: recorte(paraIn.etiqueta, 40) || paraBase.etiqueta || "",
      titulo: recorte(paraIn.titulo, 140) || paraBase.titulo || "",
      items: paraItems,
    },
    cierre,
    contacto,
    bot: {
      bienvenida: campoBot("bienvenida", 500),
      pedirNombre: campoBot("pedirNombre", 180),
      pedirNegocio: campoBot("pedirNegocio", 220),
      antesDeConfirmar: campoBot("antesDeConfirmar", 120),
      confirmar: campoBot("confirmar", 220),
      gracias: campoBot("gracias", 300),
      noEntendi: campoBot("noEntendi", 220),
      cancelado: campoBot("cancelado", 220),
      asesor: campoBot("asesor", 300),
      avisos,
    },
  };
}

function sitioPublico(sitio) {
  const s = sitio || getSitio();
  return {
    marca: s.marca,
    estilo: s.estilo,
    hero: s.hero,
    quienes: s.quienes,
    pasos: s.pasos,
    paraQuien: s.paraQuien,
    cierre: s.cierre,
    contacto: {
      whatsapp: s.contacto.whatsapp,
      correo: s.contacto.correo,
      instagram: s.contacto.instagram,
      web: s.contacto.web,
    },
    servicios: s.servicios
      .filter((item) => item.activo)
      .map((item) => ({
        id: item.id,
        tipo: item.tipo,
        icono: item.icono,
        nombre: item.nombre,
        resumen: item.resumen,
        tono: item.tono,
        imagen: item.imagen,
      })),
  };
}

function getSitio() {
  if (!cacheSitio) cacheSitio = normalizarSitio(baseSitio());
  return cacheSitio;
}

async function leerOfertas(client) {
  const { data, error } = await client.from("ofertas").select("*").order("orden", { ascending: true });
  if (error) return null;
  if (!data || !data.length) return [];
  const ids = data.map((row) => row.id);
  const det = await client.from("oferta_detalles").select("*").in("oferta_id", ids).order("orden");
  if (det.error) return null;
  const detalles = det.data || [];
  const de = (id, clase) => detalles.filter((item) => item.oferta_id === id && item.clase === clase).sort((a, b) => a.orden - b.orden);
  return data.map((row) => ({
    id: row.id,
    activo: row.activo !== false,
    tipo: row.tipo === "producto" ? "producto" : "servicio",
    icono: row.icono,
    nombre: row.nombre,
    resumen: row.resumen,
    tono: row.tono,
    imagen: row.imagen,
    palabras: de(row.id, "palabra").map((item) => item.texto),
    preguntas: de(row.id, "pregunta").map((item) => item.texto),
    detalles: de(row.id, "detalle").map((item) => ({ titulo: item.titulo || "", texto: item.texto || "" })),
  }));
}

async function guardarOfertas(client, servicios) {
  const probe = await client.from("ofertas").select("id").limit(1);
  if (probe.error) return false;
  const ids = servicios.map((item) => item.id);
  const { data: actuales } = await client.from("ofertas").select("id");
  const sobran = (actuales || []).map((row) => row.id).filter((id) => !ids.includes(id));
  if (sobran.length) {
    const borradas = await client.from("ofertas").delete().in("id", sobran);
    if (borradas.error) throw new Error(borradas.error.message);
  }
  if (!servicios.length) return true;
  const filas = servicios.map((item, orden) => ({
    id: item.id,
    tipo: item.tipo === "producto" ? "producto" : "servicio",
    activo: item.activo !== false,
    orden,
    icono: item.icono || "</>",
    nombre: item.nombre,
    resumen: item.resumen || "",
    tono: item.tono || "lila",
    imagen: item.imagen || "",
    updated_at: new Date().toISOString(),
  }));
  const { error } = await client.from("ofertas").upsert(filas);
  if (error) throw new Error(error.message);
  const detalles = [];
  servicios.forEach((item) => {
    (item.palabras || []).forEach((texto, orden) => detalles.push({ id: item.id + ":palabra:" + orden, oferta_id: item.id, clase: "palabra", orden, titulo: "", texto }));
    (item.preguntas || []).forEach((texto, orden) => detalles.push({ id: item.id + ":pregunta:" + orden, oferta_id: item.id, clase: "pregunta", orden, titulo: "", texto }));
    (item.detalles || []).forEach((detalle, orden) => detalles.push({
      id: item.id + ":detalle:" + orden,
      oferta_id: item.id,
      clase: "detalle",
      orden,
      titulo: detalle.titulo || "",
      texto: detalle.texto || "",
    }));
  });
  const limpia = await client.from("oferta_detalles").delete().in("oferta_id", ids);
  if (limpia.error) throw new Error(limpia.error.message);
  if (detalles.length) {
    const ins = await client.from("oferta_detalles").insert(detalles);
    if (ins.error) throw new Error(ins.error.message);
  }
  return true;
}

async function conOfertas(client, sitio) {
  const ofertas = await leerOfertas(client);
  if (ofertas === null) return sitio;
  if (!ofertas.length && sitio.servicios.length) {
    await guardarOfertas(client, sitio.servicios);
    return sitio;
  }
  if (ofertas.length) return normalizarSitio({ ...sitio, servicios: ofertas });
  return sitio;
}

async function cargarSitio() {
  const local = normalizarSitio(baseSitio());
  const client = clienteSupabase();
  if (!client) {
    cacheSitio = local;
    return cacheSitio;
  }
  const { data, error } = await client.from("contenido").select("data").eq("id", "sitio").maybeSingle();
  if (error) {
    console.error("Supabase sitio:", error.message);
    cacheSitio = local;
    return cacheSitio;
  }
  let sitio = data && data.data ? normalizarSitio(data.data) : local;
  if (!data || !data.data) {
    const { error: up } = await client.from("contenido").upsert({
      id: "sitio",
      data: local,
      updated_at: new Date().toISOString(),
    });
    if (up) console.error("Supabase sitio inicial:", up.message);
    sitio = local;
  }
  try {
    sitio = await conOfertas(client, sitio);
  } catch (errorOfertas) {
    console.error("Supabase ofertas:", errorOfertas.message);
  }
  cacheSitio = sitio;
  return cacheSitio;
}

async function guardarSitio(data) {
  const limpio = normalizarSitio(data);
  cacheSitio = limpio;
  const client = clienteSupabase();
  if (client) {
    const { error } = await client.from("contenido").upsert({
      id: "sitio",
      data: limpio,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await guardarOfertas(client, limpio.servicios);
  } else {
    escribirJson(archivoSitio, limpio);
  }
  return limpio;
}

function coloresDeMarca() {
  return {
    fondo: "#FBF8FF",
    profundo: "#2A2346",
    morado: "#7B5FD1",
    acento: "#6A4BC4",
    rosado: "#E57FB8",
    lavanda: "#B9A3F2",
    rosadoPastel: "#F4A6D0",
    tarjetaLila: "#E6DEFB",
    tarjetaRosa: "#FBDDEC",
    texto: "#2A2346",
    textoSuave: "#4A4066",
    textoOscuroSuave: "#D9CFF5",
  };
}

async function subirMedia(buffer, originalName, mimetype) {
  const permitidos = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
  const ext = permitidos[mimetype] || permitidos[mimetype && mimetype.split(";")[0].trim()];
  if (!ext) throw new Error("Usa una imagen PNG, JPG, WEBP o GIF");
  const archivo = `${Date.now()}-${slug(originalName || "imagen")}${ext}`;
  const client = clienteSupabase();
  if (client) {
    const { error } = await client.storage.from("marca").upload(archivo, buffer, {
      contentType: mimetype,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const { data } = client.storage.from("marca").getPublicUrl(archivo);
    return data.publicUrl;
  }
  fs.mkdirSync(carpetaMedia, { recursive: true });
  fs.writeFileSync(path.join(carpetaMedia, archivo), buffer);
  return `/media/${archivo}`;
}

function nuevoId() {
  return "TD-" + Date.now().toString(36).toUpperCase();
}

function leerCotasLocal() {
  const data = leerJson(archivoCotas, []);
  return Array.isArray(data) ? data : [];
}

function presentarCota(row, respuestas) {
  return {
    id: row.id,
    clienteId: row.clienteId || "",
    origen: row.origen || "pagina",
    servicioId: row.servicioId || "",
    servicioNombre: row.servicioNombre || "",
    nombre: row.nombre || "",
    negocio: row.negocio || "",
    celular: row.celular || "",
    jid: row.jid || "",
    mensaje: row.mensaje || "",
    respuestas: respuestas || row.respuestas || [],
    estado: row.estado || "cli-nueva",
    notaInterna: row.notaInterna || "",
    creadoEn: row.creadoEn,
  };
}

async function listarCotizaciones() {
  const client = clienteSupabase();
  if (client && (await operacion.tablasNuevas())) {
    const { data, error } = await client
      .from("cotizaciones")
      .select("id, cliente_id, oferta_id, oferta_nombre, origen, estado_id, mensaje, nota_interna, nombre, negocio, celular, jid, creado_en")
      .order("creado_en", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = (data || []).map((row) => row.id);
    const dets = await operacion.respuestasDe(ids);
    const clientes = await operacion.listarClientes();
    const porCliente = new Map(clientes.map((item) => [item.id, item]));
    return (data || []).map((row) => {
      const persona = porCliente.get(row.cliente_id);
      return presentarCota(
        {
          id: row.id,
          clienteId: row.cliente_id,
          origen: row.origen,
          servicioId: row.oferta_id || "",
          servicioNombre: row.oferta_nombre || "",
          nombre: row.nombre,
          negocio: row.negocio,
          celular: row.celular,
          jid: row.jid,
          mensaje: row.mensaje,
          estado: (persona && persona.estadoId) || row.estado_id,
          notaInterna: row.nota_interna || "",
          creadoEn: row.creado_en,
        },
        dets
          .filter((item) => (item.cotizacion_id || item.cotizacionId) === row.id)
          .map((item) => ({ pregunta: item.titulo || "", respuesta: item.texto || "" })),
      );
    });
  }
  if (client) {
    const { data, error } = await client.from("cotizaciones").select("id, data, creado_en").order("creado_en", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => presentarCota({ ...(row.data || {}), id: row.id, creadoEn: (row.data && row.data.creadoEn) || row.creado_en }));
  }
  const lista = leerCotasLocal();
  let cambio = false;
  for (const item of lista) {
    if (item.clienteId) continue;
    const persona = await operacion.anotarCliente({ ...item, cotizacionId: item.id, estado: item.estado });
    item.clienteId = persona.id;
    item.estado = persona.estadoId || item.estado;
    cambio = true;
  }
  if (cambio) escribirJson(archivoCotas, lista);
  return lista
    .map((item) => presentarCota(item))
    .sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
}

async function guardarCotizacion(entrada) {
  const sitio = getSitio();
  const servicio = (sitio.servicios || []).find((item) => item.id === entrada.servicioId);
  const cota = {
    id: entrada.id || nuevoId(),
    origen: entrada.origen === "whatsapp" ? "whatsapp" : entrada.origen === "panel" ? "panel" : "pagina",
    servicioId: recorte(entrada.servicioId, 40),
    servicioNombre: recorte(entrada.servicioNombre || (servicio && servicio.nombre) || "", 80),
    nombre: recorte(entrada.nombre, 80),
    negocio: recorte(entrada.negocio, 80),
    celular: recorte(entrada.celular, 20).replace(/[^\d]/g, ""),
    correo: recorte(entrada.correo, 80),
    jid: recorte(entrada.jid, 80),
    mensaje: recorte(entrada.mensaje, 800),
    respuestas: (Array.isArray(entrada.respuestas) ? entrada.respuestas : []).slice(0, 8).map((item) => ({
      pregunta: recorte(item && item.pregunta, 200),
      respuesta: recorte(item && item.respuesta, 500),
    })),
    estado: entrada.estado || entrada.estadoId || "nueva",
    notaInterna: recorte(entrada.notaInterna, 500),
    creadoEn: entrada.creadoEn || new Date().toISOString(),
    clienteId: entrada.clienteId || "",
  };
  if (!cota.nombre) throw new Error("Falta el nombre");
  const persona = await operacion.anotarCliente({
    id: cota.clienteId,
    nombre: cota.nombre,
    negocio: cota.negocio,
    celular: cota.celular,
    correo: cota.correo,
    jid: cota.jid,
    origen: cota.origen,
    estado: cota.estado,
    estadoId: entrada.forzarEstado ? cota.estado : "",
    forzarEstado: Boolean(entrada.forzarEstado),
    ...(entrada.notaInterna != null ? { nota: cota.notaInterna } : {}),
    cotizacionId: cota.id,
    respuestas: cota.respuestas,
  });
  cota.clienteId = persona.id;
  cota.estado = persona.estadoId || cota.estado;
  const client = clienteSupabase();
  if (client && (await operacion.tablasNuevas())) {
    const fila = {
      id: cota.id,
      cliente_id: cota.clienteId,
      oferta_id: cota.servicioId || null,
      oferta_nombre: cota.servicioNombre,
      origen: cota.origen,
      estado_id: cota.estado,
      mensaje: cota.mensaje,
      nota_interna: cota.notaInterna,
      nombre: cota.nombre,
      negocio: cota.negocio,
      celular: cota.celular,
      jid: cota.jid,
      creado_en: cota.creadoEn,
    };
    let { error } = await client.from("cotizaciones").upsert(fila);
    if (error && /23503|foreign key/i.test(error.message || "")) {
      fila.oferta_id = null;
      const retry = await client.from("cotizaciones").upsert(fila);
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    if (entrada.forzarEstado) await propagarEstadoCliente(cota.clienteId, cota.estado);
  } else if (client) {
    const { error } = await client.from("cotizaciones").upsert({
      id: cota.id,
      data: cota,
      creado_en: cota.creadoEn,
    });
    if (error) throw new Error(error.message);
  } else {
    const lista = leerCotasLocal().filter((item) => item.id !== cota.id);
    lista.push(cota);
    escribirJson(archivoCotas, lista);
    if (entrada.forzarEstado) await propagarEstadoCliente(cota.clienteId, cota.estado);
  }
  return cota;
}

async function propagarEstadoCliente(clienteId, estadoId) {
  if (!clienteId || !estadoId) return;
  const client = clienteSupabase();
  if (client && (await operacion.tablasNuevas())) {
    const { error } = await client.from("cotizaciones").update({ estado_id: estadoId }).eq("cliente_id", clienteId);
    if (error) throw new Error(error.message);
    return;
  }
  if (client) return;
  const lista = leerCotasLocal().map((item) => (item.clienteId === clienteId ? { ...item, estado: estadoId } : item));
  escribirJson(archivoCotas, lista);
}

async function actualizarCotizacion(id, cambios) {
  const lista = await listarCotizaciones();
  const actual = lista.find((item) => item.id === id);
  if (!actual) return null;
  const estado = cambios.estado || cambios.estadoId || actual.estado;
  return guardarCotizacion({
    ...actual,
    estado,
    forzarEstado: cambios.estado != null || cambios.estadoId != null,
    notaInterna: cambios.notaInterna != null ? recorte(cambios.notaInterna, 500) : actual.notaInterna,
  });
}

async function borrarCotizacion(id) {
  const client = clienteSupabase();
  if (client) {
    const { error } = await client.from("cotizaciones").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }
  const lista = leerCotasLocal();
  const siguiente = lista.filter((item) => item.id !== id);
  if (siguiente.length === lista.length) return false;
  escribirJson(archivoCotas, siguiente);
  return true;
}

async function borrarCotizacionesDeCliente(clienteId) {
  const client = clienteSupabase();
  if (client) return;
  const lista = leerCotasLocal().filter((item) => item.clienteId !== clienteId);
  escribirJson(archivoCotas, lista);
}

function clavePausa(valor) {
  let texto = String(valor || "").trim();
  if (!texto) return "";
  if (/@(hosted\.)?lid$/i.test(texto)) return "";
  texto = texto.split("@")[0].split(":")[0];
  const digits = texto.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function jidsDe(item) {
  const lista = [];
  if (item && item.jid) lista.push(item.jid);
  if (item && Array.isArray(item.jids)) lista.push(...item.jids);
  return lista.filter(Boolean);
}

function coincidePausa(item, valor) {
  const texto = String(valor || "");
  if (!item || !texto) return false;
  if (jidsDe(item).includes(texto)) return true;
  const claveItem = clavePausa(item.celular);
  const claveValor = clavePausa(texto);
  return Boolean(claveItem && claveValor && claveItem === claveValor);
}

async function cargarPausas(forzar) {
  if (!forzar && cachePausasEn && Date.now() - cachePausasEn < 2000) return cachePausas;
  const client = clienteSupabase();
  if (client) {
    const { data, error } = await client.from("contenido").select("data").eq("id", "pausas").maybeSingle();
    if (error) console.error("Supabase pausas:", error.message);
    const numeros = data && data.data && data.data.numeros;
    cachePausas = Array.isArray(numeros) ? numeros : [];
  } else {
    const local = leerJson(archivoPausas, []);
    cachePausas = Array.isArray(local) ? local : [];
  }
  cachePausasEn = Date.now();
  return cachePausas;
}

async function guardarPausas(lista) {
  cachePausas = lista;
  cachePausasEn = Date.now();
  const client = clienteSupabase();
  if (client) {
    const { error } = await client.from("contenido").upsert({
      id: "pausas",
      data: { numeros: lista },
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return lista;
  }
  escribirJson(archivoPausas, lista);
  return lista;
}

async function chatPausadoAlguno(valores) {
  const lista = await cargarPausas(true);
  const ids = (valores || []).map((valor) => String(valor || "")).filter(Boolean);
  return lista.some((item) => ids.some((valor) => coincidePausa(item, valor)));
}

async function recordarChatPausado(valores) {
  const lista = await cargarPausas(false);
  const ids = (valores || []).map((valor) => String(valor || "")).filter((valor) => valor.includes("@"));
  if (!ids.length) return lista;
  let cambio = false;
  const siguiente = lista.map((item) => {
    if (!ids.some((valor) => coincidePausa(item, valor))) return item;
    const unidos = [...new Set(jidsDe(item).concat(ids))];
    if (unidos.length === jidsDe(item).length) return item;
    cambio = true;
    return { ...item, jid: item.jid || unidos.find((id) => /@lid$/i.test(id)) || unidos[0], jids: unidos };
  });
  if (!cambio) return lista;
  return guardarPausas(siguiente);
}

async function listarPausas() {
  return cargarPausas(true);
}

async function pausarChat(entrada) {
  const crudo = entrada && entrada.celular != null ? entrada.celular : entrada;
  let celular = clavePausa(crudo);
  const jid = entrada && entrada.jid ? String(entrada.jid) : null;
  if ((!celular || celular.length < 7) && jid) celular = "jid-" + slug(jid).slice(0, 20);
  if (!celular || celular.length < 7) throw new Error("Escribe el celular de la persona, por ejemplo 3000000000");
  const lista = (await cargarPausas(true)).slice();
  const i = lista.findIndex((item) => clavePausa(item.celular) === celular);
  let resueltos = [];
  if (resolverJids) {
    try {
      resueltos = (await resolverJids(celular)) || [];
    } catch (error) {
      console.error("PAUSA | no vinculé el chat de", celular, error.message);
    }
  }
  const jids = [...new Set([jid, ...(i >= 0 ? jidsDe(lista[i]) : []), ...resueltos].filter(Boolean))];
  const fila = {
    celular,
    jid: jid || jids.find((id) => /@lid$/i.test(id)) || jids[0] || (i >= 0 ? lista[i].jid : null),
    jids,
    desde: new Date().toISOString(),
  };
  if (i >= 0) lista[i] = { ...lista[i], ...fila, desde: lista[i].desde || fila.desde };
  else lista.push(fila);
  return guardarPausas(lista);
}

async function reactivarChat(entrada) {
  const crudo = entrada && entrada.celular != null ? entrada.celular : entrada;
  const celular = clavePausa(crudo);
  const jid = entrada && entrada.jid ? String(entrada.jid) : "";
  const lista = (await cargarPausas(true)).filter((item) => {
    if (celular && clavePausa(item.celular) === celular) return false;
    if (jid && item.jid === jid) return false;
    return true;
  });
  return guardarPausas(lista);
}

function setResolvedorJids(fn) {
  resolverJids = fn;
}

function setAvisador(fn) {
  avisador = fn;
}

function destinoJid(aviso) {
  const sitio = getSitio();
  const prefijo = (sitio.contacto && sitio.contacto.prefijo) || "57";
  const valor = String(aviso && aviso.valor ? aviso.valor : aviso || "").trim();
  if (!valor) return null;
  if (valor.endsWith("@g.us") || valor.endsWith("@s.whatsapp.net") || valor.endsWith("@c.us") || valor.endsWith("@lid")) {
    return valor;
  }
  let digits = valor.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith(prefijo) && digits.length >= prefijo.length + 8) return `${digits}@s.whatsapp.net`;
  if (digits.length >= 8 && digits.length <= 11) return `${prefijo}${digits}@s.whatsapp.net`;
  if (digits.length >= 8) return `${digits}@s.whatsapp.net`;
  return null;
}

function textoAviso(cota) {
  const respuestas = (cota.respuestas || [])
    .map((item, i) => `${i + 1}. ${item.pregunta}\n${item.respuesta}`)
    .join("\n");
  return [
    `Nueva cotización ${cota.id}`,
    `Servicio: ${cota.servicioNombre || "sin elegir"}`,
    `Nombre: ${cota.nombre}`,
    cota.negocio ? `Negocio: ${cota.negocio}` : "",
    `Origen: ${cota.origen === "whatsapp" ? "WhatsApp" : "Página"}`,
    cota.celular ? `Celular: ${cota.celular}` : "",
    "",
    respuestas || cota.mensaje || "",
  ]
    .filter((linea, i, arr) => linea || (i > 0 && arr[i - 1]))
    .join("\n")
    .trim();
}

async function avisarCotizacion(cota) {
  if (!avisador) return;
  const destinos = (getSitio().bot && getSitio().bot.avisos) || [];
  const texto = textoAviso(cota);
  await Promise.all(
    destinos.map(async (aviso) => {
      const jid = destinoJid(aviso);
      if (!jid) return;
      try {
        await avisador(jid, texto);
        console.log("Aviso enviado a", jid);
      } catch (error) {
        console.error("No se pudo avisar a", jid, error.message);
      }
    }),
  );
}

async function iniciar() {
  await cargarSitio();
  await cargarPausas(true);
  if (usaSupabase()) {
    console.log("Datos: Supabase");
    setInterval(() => {
      cargarSitio().catch((error) => console.error("Supabase sitio:", error.message));
    }, 20000);
  } else {
    console.log("Datos: archivos locales. Para la nube, llena SUPABASE_URL en .env");
  }
}

module.exports = {
  carpetaMedia,
  usaSupabase,
  getSitio,
  sitioPublico,
  cargarSitio,
  guardarSitio,
  coloresDeMarca,
  subirMedia,
  listarCotizaciones,
  guardarCotizacion,
  actualizarCotizacion,
  borrarCotizacion,
  borrarCotizacionesDeCliente,
  propagarEstadoCliente,
  listarPausas,
  pausarChat,
  reactivarChat,
  chatPausadoAlguno,
  recordarChatPausado,
  setResolvedorJids,
  setAvisador,
  avisarCotizacion,
  destinoJid,
  clavePausa,
  iniciar,
  normalizarSitio,
};
