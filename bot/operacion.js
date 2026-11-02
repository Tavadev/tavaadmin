const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { clienteSupabase, usaSupabase, faltaTabla } = require("./nube");

const archivo = path.join(__dirname, "..", "datos", "operacion.json");

const LEGACY = {
  nueva: "cli-nueva",
  en_curso: "cli-en-curso",
  lista: "cli-lista",
  descartada: "cli-descartada",
};

let tablas = null;

function recorte(valor, max) {
  return String(valor == null ? "" : valor).replace(/\r/g, "").trim().slice(0, max);
}

function leerJson(fallback) {
  try {
    return JSON.parse(fs.readFileSync(archivo, "utf8"));
  } catch {
    return fallback;
  }
}

function escribirJson(data) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, JSON.stringify(data, null, 2), "utf8");
}

function idCorto(prefijo) {
  return prefijo + Date.now().toString(36).toUpperCase();
}

function hex(valor, fallback) {
  const t = String(valor || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toUpperCase() : fallback;
}

function semillaEstados() {
  return [
    ["cli-nueva", "cliente", "Nuevo contacto", 0, "#7B5FD1", true, false],
    ["cli-en-conversacion", "cliente", "En conversación", 1, "#6A4BC4", false, false],
    ["cli-cotizacion", "cliente", "Cotización enviada", 2, "#B9A3F2", false, false],
    ["cli-aprobado", "cliente", "Aprobado", 3, "#E57FB8", false, false],
    ["cli-en-curso", "cliente", "En trabajo", 4, "#2A2346", false, false],
    ["cli-lista", "cliente", "Listo", 5, "#4A4066", false, false],
    ["cli-pausado", "cliente", "Pausado", 6, "#F4A6D0", false, false],
    ["cli-descartada", "cliente", "Descartado", 7, "#9D2F4A", false, true],
    ["ped-recibido", "pedido", "Recibido", 0, "#7B5FD1", true, false],
    ["ped-confirmado", "pedido", "Confirmado", 1, "#6A4BC4", false, false],
    ["ped-en-curso", "pedido", "En curso", 2, "#2A2346", false, false],
    ["ped-listo", "pedido", "Listo", 3, "#E57FB8", false, false],
    ["ped-entregado", "pedido", "Entregado", 4, "#4A4066", false, true],
    ["ped-cancelado", "pedido", "Cancelado", 5, "#9D2F4A", false, true],
  ].map(([id, ambito, nombre, orden, color, esInicial, esFinal]) => ({
    id,
    ambito,
    nombre,
    orden,
    color,
    esInicial,
    esFinal,
  }));
}

function semillaDisponibilidad() {
  return [
    { id: "disp-disponible", nombre: "Disponible", color: "#3C8F63", orden: 0 },
    { id: "disp-ocupado", nombre: "Ocupado", color: "#C47B2A", orden: 1 },
    { id: "disp-ensayo", nombre: "En ensayo", color: "#6A4BC4", orden: 2 },
    { id: "disp-ausente", nombre: "Ausente", color: "#9D2F4A", orden: 3 },
  ];
}

function semillaActividad() {
  return [
    { id: "act-por-hacer", nombre: "Por hacer", orden: 0, color: "#7B5FD1", esInicial: true, esFinal: false },
    { id: "act-en-curso", nombre: "En curso", orden: 1, color: "#6A4BC4", esInicial: false, esFinal: false },
    { id: "act-revision", nombre: "En revisión", orden: 2, color: "#E57FB8", esInicial: false, esFinal: false },
    { id: "act-listo", nombre: "Listo", orden: 3, color: "#3C8F63", esInicial: false, esFinal: true },
  ];
}

function vacio() {
  return {
    estados: semillaEstados(),
    clientes: [],
    pedidos: [],
    equipos: [],
    personas: [],
    roles: [],
    caracteristicas: [],
    disponibilidades: semillaDisponibilidad(),
    chats: [],
    miembros: [],
    mensajes: [],
    usuarios: [],
    actividadEstados: semillaActividad(),
    epicas: [],
    sprints: [],
    tareas: [],
    notas: [],
  };
}

function leerLocal() {
  const data = leerJson(null);
  const base = vacio();
  if (!data || typeof data !== "object") return base;
  return {
    estados: Array.isArray(data.estados) && data.estados.length ? data.estados : base.estados,
    clientes: Array.isArray(data.clientes) ? data.clientes : [],
    pedidos: Array.isArray(data.pedidos) ? data.pedidos : [],
    equipos: Array.isArray(data.equipos) ? data.equipos : [],
    personas: Array.isArray(data.personas) ? data.personas : [],
    roles: Array.isArray(data.roles) ? data.roles : [],
    caracteristicas: Array.isArray(data.caracteristicas) ? data.caracteristicas : [],
    disponibilidades: Array.isArray(data.disponibilidades) && data.disponibilidades.length ? data.disponibilidades : base.disponibilidades,
    chats: Array.isArray(data.chats) ? data.chats : [],
    miembros: Array.isArray(data.miembros) ? data.miembros : [],
    mensajes: Array.isArray(data.mensajes) ? data.mensajes : [],
    usuarios: Array.isArray(data.usuarios) ? data.usuarios : [],
    actividadEstados: Array.isArray(data.actividadEstados) && data.actividadEstados.length ? data.actividadEstados : base.actividadEstados,
    epicas: Array.isArray(data.epicas) ? data.epicas : [],
    sprints: Array.isArray(data.sprints) ? data.sprints : [],
    tareas: Array.isArray(data.tareas) ? data.tareas : [],
    notas: Array.isArray(data.notas) ? data.notas : [],
  };
}

function filaEstado(row) {
  return {
    id: row.id,
    ambito: row.ambito,
    nombre: row.nombre,
    orden: row.orden,
    color: row.color,
    esInicial: Boolean(row.es_inicial != null ? row.es_inicial : row.esInicial),
    esFinal: Boolean(row.es_final != null ? row.es_final : row.esFinal),
  };
}

function filaCliente(row, detalles) {
  const datos = (detalles || row.detalles || []).filter((item) => (item.clase || "dato") === "dato");
  return {
    id: row.id,
    nombre: row.nombre,
    negocio: row.negocio || "",
    celular: row.celular || "",
    correo: row.correo || "",
    jid: row.jid || "",
    origen: row.origen || "panel",
    estadoId: row.estado_id || row.estadoId,
    nota: row.nota || "",
    creadoEn: row.creado_en || row.creadoEn,
    detalles: datos
      .slice()
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((item) => ({
        id: item.id,
        titulo: item.titulo || "",
        texto: item.texto || "",
      })),
  };
}

async function tablasNuevas() {
  if (tablas !== null) return tablas;
  const client = clienteSupabase();
  if (!client) {
    tablas = false;
    return false;
  }
  const { error } = await client.from("estados").select("id").limit(1);
  tablas = !error;
  return tablas;
}

function exigirTablas() {
  if (usaSupabase()) {
    throw new Error("Falta ejecutar el SQL nuevo en Supabase. Abre supabase/schema.sql, pégalo en el SQL Editor y dale Run.");
  }
}

async function listarEstados(ambito) {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    let q = client.from("estados").select("*").order("orden", { ascending: true });
    if (ambito) q = q.eq("ambito", ambito);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || !data.length) {
      const semilla = semillaEstados().filter((item) => !ambito || item.ambito === ambito);
      const filas = semilla.map(aFilaEstado);
      const { error: up } = await client.from("estados").upsert(filas);
      if (up) throw new Error(up.message);
      return semilla;
    }
    return data.map(filaEstado);
  }
  if (usaSupabase()) exigirTablas();
  const lista = leerLocal().estados.map(filaEstado);
  return ambito ? lista.filter((item) => item.ambito === ambito) : lista;
}

function aFilaEstado(item) {
  return {
    id: item.id,
    ambito: item.ambito,
    nombre: item.nombre,
    orden: item.orden,
    color: item.color,
    es_inicial: Boolean(item.esInicial),
    es_final: Boolean(item.esFinal),
  };
}

async function idEstado(valor, ambito) {
  const lista = await listarEstados(ambito);
  const texto = String(valor || "");
  if (lista.some((item) => item.id === texto)) return texto;
  if (LEGACY[texto] && lista.some((item) => item.id === LEGACY[texto])) return LEGACY[texto];
  const inicial = lista.find((item) => item.esInicial) || lista[0];
  return inicial ? inicial.id : "";
}

async function guardarEstado(entrada) {
  const ambito = entrada.ambito === "pedido" ? "pedido" : "cliente";
  const lista = await listarEstados(ambito);
  const nombre = recorte(entrada.nombre, 40);
  if (nombre.length < 2) throw new Error("Ponle un nombre al estado");
  const id = entrada.id || "est-" + ambito.slice(0, 3) + "-" + Date.now().toString(36);
  const actual = lista.find((item) => item.id === id);
  const fila = {
    id,
    ambito,
    nombre,
    orden: actual ? actual.orden : lista.reduce((max, item) => Math.max(max, item.orden), -1) + 1,
    color: hex(entrada.color, (actual && actual.color) || "#7B5FD1"),
    esInicial: actual ? actual.esInicial : lista.length === 0,
    esFinal: actual ? actual.esFinal : false,
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("estados").upsert(aFilaEstado(fila));
    if (error) throw new Error(error.message);
    return fila;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const i = data.estados.findIndex((item) => item.id === id);
  if (i >= 0) data.estados[i] = fila;
  else data.estados.push(fila);
  escribirJson(data);
  return fila;
}

async function moverEstado(id, delta) {
  const todos = await listarEstados();
  const item = todos.find((estado) => estado.id === id);
  if (!item) return null;
  const grupo = todos.filter((estado) => estado.ambito === item.ambito).sort((a, b) => a.orden - b.orden);
  const i = grupo.findIndex((estado) => estado.id === id);
  const j = i + delta;
  if (j < 0 || j >= grupo.length) return grupo;
  const ordenA = grupo[i].orden;
  grupo[i].orden = grupo[j].orden;
  grupo[j].orden = ordenA;
  if (ordenA === grupo[i].orden) {
    grupo.forEach((estado, n) => {
      estado.orden = n;
    });
  }
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("estados").upsert(grupo.map(aFilaEstado));
    if (error) throw new Error(error.message);
    return listarEstados(item.ambito);
  }
  const data = leerLocal();
  grupo.forEach((estado) => {
    const pos = data.estados.findIndex((fila) => fila.id === estado.id);
    if (pos >= 0) data.estados[pos] = estado;
  });
  escribirJson(data);
  return grupo.sort((a, b) => a.orden - b.orden);
}

async function borrarEstado(id) {
  const todos = await listarEstados();
  const item = todos.find((estado) => estado.id === id);
  if (!item) return false;
  const grupo = todos.filter((estado) => estado.ambito === item.ambito);
  if (grupo.length < 2) throw new Error("Deja al menos un estado");
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const tabla = item.ambito === "pedido" ? "pedidos" : "clientes";
    const { count, error: cuenta } = await client.from(tabla).select("id", { count: "exact", head: true }).eq("estado_id", id);
    if (cuenta) throw new Error(cuenta.message);
    if (count) throw new Error("Ese estado está en uso. Pasa esas fichas a otro y luego bórralo.");
    const { error } = await client.from("estados").delete().eq("id", id);
    if (error) throw new Error(error.message);
    if (item.esInicial) {
      const siguiente = grupo.find((estado) => estado.id !== id);
      if (siguiente) await client.from("estados").update({ es_inicial: true }).eq("id", siguiente.id);
    }
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const usado =
    item.ambito === "pedido"
      ? data.pedidos.some((pedido) => pedido.estadoId === id)
      : data.clientes.some((cliente) => cliente.estadoId === id);
  if (usado) throw new Error("Ese estado está en uso. Pasa esas fichas a otro y luego bórralo.");
  data.estados = data.estados.filter((estado) => estado.id !== id);
  if (item.esInicial) {
    const siguiente = data.estados.find((estado) => estado.ambito === item.ambito);
    if (siguiente) siguiente.esInicial = true;
  }
  escribirJson(data);
  return true;
}

function datosDe(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, 12).map((item, orden) => ({
    id: item && item.id ? String(item.id) : "dato-" + orden,
    clase: "dato",
    orden,
    titulo: recorte(item && item.titulo, 60),
    texto: recorte(item && item.texto, 400),
  })).filter((item) => item.titulo || item.texto);
}

function idDeCliente(entrada) {
  const cel = String(entrada.celular || "").replace(/\D/g, "");
  if (cel.length >= 10) return "CL-" + cel.slice(-10);
  if (entrada.id && String(entrada.id).startsWith("CL-")) return String(entrada.id);
  if (entrada.cotizacionId) return "CL-" + entrada.cotizacionId;
  return idCorto("CL-");
}

async function listarClientes() {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const { data, error } = await client.from("clientes").select("*").order("creado_en", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    const ids = (data || []).map((row) => row.id);
    let detalles = [];
    if (ids.length) {
      const det = await client.from("cliente_detalles").select("*").in("cliente_id", ids).eq("clase", "dato").order("orden");
      if (det.error) throw new Error(det.error.message);
      detalles = det.data || [];
    }
    return (data || []).map((row) => filaCliente(row, detalles.filter((item) => item.cliente_id === row.id)));
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().clientes.map((row) => filaCliente(row));
}

async function guardarClienteFila(fila, detallesRespuesta) {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const { error } = await client.from("clientes").upsert({
      id: fila.id,
      nombre: fila.nombre,
      negocio: fila.negocio,
      celular: fila.celular,
      correo: fila.correo,
      jid: fila.jid,
      origen: fila.origen,
      estado_id: fila.estadoId,
      nota: fila.nota,
      creado_en: fila.creadoEn,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    if (detallesRespuesta) {
      await client.from("cliente_detalles").delete().eq("cliente_id", fila.id).eq("clase", "dato");
      const datos = datosDe(fila.detalles).map((item, orden) => ({
        id: fila.id + ":d:" + orden,
        cliente_id: fila.id,
        cotizacion_id: null,
        clase: "dato",
        orden,
        titulo: item.titulo,
        texto: item.texto,
      }));
      if (datos.length) {
        const ins = await client.from("cliente_detalles").insert(datos);
        if (ins.error) throw new Error(ins.error.message);
      }
    }
    return filaCliente(fila);
  }
  const data = leerLocal();
  const i = data.clientes.findIndex((item) => item.id === fila.id);
  if (i >= 0) data.clientes[i] = { ...data.clientes[i], ...fila, detalles: fila.detalles };
  else data.clientes.push(fila);
  escribirJson(data);
  return filaCliente(fila);
}

async function anotarCliente(entrada) {
  const id = idDeCliente(entrada);
  const nombre = recorte(entrada.nombre, 80);
  if (!nombre) throw new Error("Falta el nombre");
  if (usaSupabase() && !(await tablasNuevas())) {
    const legado = LEGACY[entrada.estado] ? entrada.estado : "nueva";
    return { id, estadoId: legado, nombre };
  }
  const estadoId = await idEstado(entrada.estadoId || entrada.estado, "cliente");
  let actual = null;
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("clientes").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    actual = data ? filaCliente(data) : null;
    if (data) {
      const det = await clienteSupabase().from("cliente_detalles").select("*").eq("cliente_id", id);
      if (det.error) throw new Error(det.error.message);
      actual.detalles = (det.data || []).filter((item) => item.clase === "dato").map((item) => ({ id: item.id, titulo: item.titulo, texto: item.texto }));
      actual._respuestas = det.data || [];
    }
  } else {
    actual = leerLocal().clientes.find((item) => item.id === id) || null;
    if (actual) actual = filaCliente(actual);
  }

  const fila = {
    id,
    nombre,
    negocio: recorte(entrada.negocio, 80),
    celular: recorte(entrada.celular, 20).replace(/[^\d]/g, ""),
    correo: recorte(entrada.correo != null ? entrada.correo : actual && actual.correo, 80),
    jid: recorte(entrada.jid != null ? entrada.jid : actual && actual.jid, 80),
    origen: ["whatsapp", "pagina", "panel"].includes(entrada.origen) ? entrada.origen : (actual && actual.origen) || "panel",
    estadoId: entrada.forzarEstado ? estadoId : (actual && actual.estadoId) || estadoId,
    nota: entrada.nota != null ? recorte(entrada.nota, 500) : (actual && actual.nota) || "",
    creadoEn: (actual && actual.creadoEn) || new Date().toISOString(),
    detalles: actual && actual.detalles ? actual.detalles : [],
  };
  if (Array.isArray(entrada.detalles)) fila.detalles = datosDe(entrada.detalles);

  await guardarClienteFila(fila, true);

  if (entrada.cotizacionId && Array.isArray(entrada.respuestas)) {
    const respuestas = entrada.respuestas.slice(0, 8).map((item, orden) => ({
      id: entrada.cotizacionId + ":r:" + orden,
      clase: "respuesta",
      orden,
      cotizacionId: entrada.cotizacionId,
      titulo: recorte(item && item.pregunta, 200),
      texto: recorte(item && item.respuesta, 500),
    }));
    if (await tablasNuevas()) {
      const client = clienteSupabase();
      await client.from("cliente_detalles").delete().eq("cotizacion_id", entrada.cotizacionId).eq("clase", "respuesta");
      if (respuestas.length) {
        const ins = await client.from("cliente_detalles").insert(
          respuestas.map((item) => ({
            id: item.id,
            cliente_id: id,
            cotizacion_id: entrada.cotizacionId,
            clase: "respuesta",
            orden: item.orden,
            titulo: item.titulo,
            texto: item.texto,
          })),
        );
        if (ins.error) throw new Error(ins.error.message);
      }
    } else if (!usaSupabase()) {
      const data = leerLocal();
      const cli = data.clientes.find((item) => item.id === id);
      if (cli) {
        const previas = Array.isArray(cli.respuestas) ? cli.respuestas : [];
        cli.respuestas = previas.filter((item) => item.cotizacionId !== entrada.cotizacionId).concat(respuestas);
        escribirJson(data);
      }
    }
  }
  return filaCliente(fila);
}

async function actualizarCliente(id, cambios) {
  const lista = await listarClientes();
  const actual = lista.find((item) => item.id === id);
  if (!actual) return null;
  return anotarCliente({
    ...actual,
    id: actual.id,
    nombre: cambios.nombre != null ? cambios.nombre : actual.nombre,
    negocio: cambios.negocio != null ? cambios.negocio : actual.negocio,
    celular: cambios.celular != null ? cambios.celular : actual.celular,
    correo: cambios.correo != null ? cambios.correo : actual.correo,
    nota: cambios.nota != null ? cambios.nota : actual.nota,
    estadoId: cambios.estadoId || actual.estadoId,
    forzarEstado: cambios.estadoId != null,
    origen: actual.origen,
    detalles: cambios.detalles != null ? cambios.detalles : actual.detalles,
  });
}

async function borrarCliente(id) {
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("clientes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const antes = data.clientes.length;
  data.clientes = data.clientes.filter((item) => item.id !== id);
  data.pedidos = data.pedidos.filter((item) => item.clienteId !== id);
  if (data.clientes.length === antes) return false;
  escribirJson(data);
  return true;
}

async function respuestasDe(cotizacionIds) {
  if (!cotizacionIds.length) return [];
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase()
      .from("cliente_detalles")
      .select("*")
      .in("cotizacion_id", cotizacionIds)
      .eq("clase", "respuesta")
      .order("orden");
    if (error) throw new Error(error.message);
    return data || [];
  }
  if (usaSupabase()) return [];
  const salida = [];
  leerLocal().clientes.forEach((cliente) => {
    (cliente.respuestas || []).forEach((item) => {
      if (cotizacionIds.includes(item.cotizacionId)) salida.push(item);
    });
  });
  return salida;
}

function filaPedido(row, items) {
  return {
    id: row.id,
    clienteId: row.cliente_id || row.clienteId,
    estadoId: row.estado_id || row.estadoId,
    titulo: row.titulo || "",
    nota: row.nota || "",
    creadoEn: row.creado_en || row.creadoEn,
    items: (items || row.items || [])
      .slice()
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((item) => ({
        id: item.id,
        ofertaId: item.oferta_id || item.ofertaId || "",
        descripcion: item.descripcion || "",
        cantidad: Number(item.cantidad) || 1,
        detalle: item.detalle || "",
      })),
  };
}

async function listarPedidos() {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const { data, error } = await client.from("pedidos").select("*").order("creado_en", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const ids = (data || []).map((row) => row.id);
    let items = [];
    if (ids.length) {
      const det = await client.from("pedido_items").select("*").in("pedido_id", ids).order("orden");
      if (det.error) throw new Error(det.error.message);
      items = det.data || [];
    }
    return (data || []).map((row) => filaPedido(row, items.filter((item) => item.pedido_id === row.id)));
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().pedidos.map((row) => filaPedido(row));
}

function itemsDe(lista, pedidoId) {
  return (Array.isArray(lista) ? lista : []).slice(0, 20).map((item, orden) => ({
    id: pedidoId + ":i:" + orden,
    ofertaId: recorte(item && item.ofertaId, 40),
    descripcion: recorte(item && item.descripcion, 120) || "Trabajo",
    cantidad: Math.min(999, Math.max(1, parseInt(item && item.cantidad, 10) || 1)),
    detalle: recorte(item && item.detalle, 400),
    orden,
  }));
}

async function guardarPedido(entrada) {
  const clientes = await listarClientes();
  const cliente = clientes.find((item) => item.id === entrada.clienteId);
  if (!cliente) throw new Error("Elige el cliente del pedido");
  const titulo = recorte(entrada.titulo, 80);
  if (titulo.length < 2) throw new Error("Ponle un nombre al pedido");
  const id = entrada.id || idCorto("PD-");
  const estadoId = await idEstado(entrada.estadoId, "pedido");
  const items = itemsDe(entrada.items, id);
  if (!items.length) throw new Error("Agrega al menos una línea al pedido");
  const fila = {
    id,
    clienteId: cliente.id,
    estadoId,
    titulo,
    nota: recorte(entrada.nota, 500),
    creadoEn: entrada.creadoEn || new Date().toISOString(),
    items,
  };
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const { error } = await client.from("pedidos").upsert({
      id,
      cliente_id: cliente.id,
      estado_id: estadoId,
      titulo,
      nota: fila.nota,
      creado_en: fila.creadoEn,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await client.from("pedido_items").delete().eq("pedido_id", id);
    const ins = await client.from("pedido_items").insert(
      items.map((item) => ({
        id: item.id,
        pedido_id: id,
        oferta_id: item.ofertaId || null,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        detalle: item.detalle,
        orden: item.orden,
      })),
    );
    if (ins.error && /foreign key|23503/i.test(ins.error.message)) {
      const retry = await client.from("pedido_items").insert(items.map((item) => ({
        id: item.id,
        pedido_id: id,
        oferta_id: null,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        detalle: item.detalle,
        orden: item.orden,
      })));
      if (retry.error) throw new Error(retry.error.message);
    } else if (ins.error) throw new Error(ins.error.message);
    return filaPedido(fila);
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const i = data.pedidos.findIndex((item) => item.id === id);
  if (i >= 0) data.pedidos[i] = fila;
  else data.pedidos.unshift(fila);
  escribirJson(data);
  return filaPedido(fila);
}

async function borrarPedido(id) {
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("pedidos").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const siguiente = data.pedidos.filter((item) => item.id !== id);
  if (siguiente.length === data.pedidos.length) return false;
  data.pedidos = siguiente;
  escribirJson(data);
  return true;
}

function filaEquipo(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion || "",
    orden: row.orden || 0,
    padreId: row.padre_id || row.padreId || "",
  };
}

function faltaColumnaPadre(error) {
  const msg = String((error && error.message) || "");
  return /padre_id|42703|PGRST204/i.test(msg);
}

function faltaColumnaRol(error) {
  const msg = String((error && error.message) || "");
  return /rol_id/i.test(msg);
}

function codigoDe(valor) {
  return recorte(valor, 24)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function filaRol(row) {
  return {
    id: row.id,
    codigo: row.codigo || "",
    nombre: row.nombre || "",
    descripcion: row.descripcion || "",
    orden: row.orden || 0,
  };
}

function filaCaracteristica(row) {
  return {
    id: row.id,
    rolId: row.rol_id || row.rolId || "",
    codigo: row.codigo || "",
    nombre: row.nombre || "",
    orden: row.orden || 0,
  };
}

function avisoRoles() {
  return "Falta el sistema de roles en Supabase. Vuelve a pegar supabase/schema.sql y dale Run.";
}

async function listarRoles() {
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("roles").select("*").order("orden");
    if (error && faltaTabla(error)) return [];
    if (error) throw new Error(error.message);
    return (data || []).map(filaRol);
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().roles.map(filaRol);
}

async function guardarRol(entrada) {
  const codigo = codigoDe(entrada.codigo);
  const nombre = recorte(entrada.nombre, 60);
  if (codigo.length < 2) throw new Error("El identificador usa letras y números, por ejemplo LIDER");
  if (nombre.length < 2) throw new Error("Ponle nombre al rol");
  const lista = await listarRoles();
  const id = entrada.id || idCorto("ROL-");
  if (lista.some((item) => item.codigo === codigo && item.id !== id)) throw new Error("Ese identificador de rol ya existe");
  const actual = lista.find((item) => item.id === id);
  const fila = {
    id,
    codigo,
    nombre,
    descripcion: recorte(entrada.descripcion, 200),
    orden: actual ? actual.orden : lista.length,
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("roles").upsert({
      id: fila.id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      orden: fila.orden,
    });
    if (error && faltaTabla(error)) throw new Error(avisoRoles());
    if (error) throw new Error(error.message);
    return fila;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const i = data.roles.findIndex((item) => item.id === id);
  if (i >= 0) data.roles[i] = fila;
  else data.roles.push(fila);
  escribirJson(data);
  return fila;
}

async function borrarRol(id) {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const suelta = await client.from("personas").update({ rol_id: null }).eq("rol_id", id);
    if (suelta.error && !faltaColumnaRol(suelta.error) && !faltaTabla(suelta.error)) throw new Error(suelta.error.message);
    const rasgos = await client.from("caracteristicas").delete().eq("rol_id", id);
    if (rasgos.error && !faltaTabla(rasgos.error)) throw new Error(rasgos.error.message);
    const { error } = await client.from("roles").delete().eq("id", id);
    if (error && faltaTabla(error)) throw new Error(avisoRoles());
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.personas.forEach((persona) => {
    if (persona.rolId === id) persona.rolId = "";
  });
  data.caracteristicas = data.caracteristicas.filter((item) => item.rolId !== id);
  data.roles = data.roles.filter((item) => item.id !== id);
  escribirJson(data);
  return true;
}

async function listarCaracteristicas() {
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("caracteristicas").select("*").order("orden");
    if (error && faltaTabla(error)) return [];
    if (error) throw new Error(error.message);
    return (data || []).map(filaCaracteristica);
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().caracteristicas.map(filaCaracteristica);
}

async function guardarCaracteristica(entrada) {
  const codigo = codigoDe(entrada.codigo);
  const nombre = recorte(entrada.nombre, 60);
  const rolId = recorte(entrada.rolId, 40);
  if (!rolId) throw new Error("Elige el rol de esta característica");
  if (codigo.length < 2) throw new Error("El identificador de la característica usa letras y números, por ejemplo DECIDE");
  if (nombre.length < 2) throw new Error("Ponle nombre a la característica");
  const roles = await listarRoles();
  if (!roles.some((item) => item.id === rolId)) throw new Error("Ese rol ya no está");
  const lista = await listarCaracteristicas();
  const id = entrada.id || idCorto("CR-");
  if (lista.some((item) => item.rolId === rolId && item.codigo === codigo && item.id !== id)) {
    throw new Error("Ese identificador ya está en este rol");
  }
  const actual = lista.find((item) => item.id === id);
  const fila = {
    id,
    rolId,
    codigo,
    nombre,
    orden: actual ? actual.orden : lista.filter((item) => item.rolId === rolId).length,
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("caracteristicas").upsert({
      id: fila.id,
      rol_id: fila.rolId,
      codigo: fila.codigo,
      nombre: fila.nombre,
      orden: fila.orden,
    });
    if (error && faltaTabla(error)) throw new Error(avisoRoles());
    if (error) throw new Error(error.message);
    return fila;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const i = data.caracteristicas.findIndex((item) => item.id === id);
  if (i >= 0) data.caracteristicas[i] = fila;
  else data.caracteristicas.push(fila);
  escribirJson(data);
  return fila;
}

async function borrarCaracteristica(id) {
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("caracteristicas").delete().eq("id", id);
    if (error && faltaTabla(error)) throw new Error(avisoRoles());
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.caracteristicas = data.caracteristicas.filter((item) => item.id !== id);
  escribirJson(data);
  return true;
}

async function listarEquipos() {
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("equipos").select("*").order("orden");
    if (error) throw new Error(error.message);
    return (data || []).map(filaEquipo);
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().equipos.map(filaEquipo);
}

async function guardarEquipo(entrada) {
  const nombre = recorte(entrada.nombre, 60);
  if (nombre.length < 2) throw new Error("Ponle nombre al equipo");
  const lista = await listarEquipos();
  const id = entrada.id || idCorto("EQ-");
  const padreId = recorte(entrada.padreId, 40);
  if (padreId && padreId === id) throw new Error("Un equipo no puede colgar de sí mismo");
  if (padreId && !lista.some((item) => item.id === padreId)) throw new Error("Elige de qué equipo cuelga");
  const prueba = lista.filter((item) => item.id !== id).concat([{ id, padreId }]);
  if (padreId && hayCiclo(prueba, id, padreId, "padreId")) throw new Error("Eso formaría un círculo entre equipos");
  const actual = lista.find((item) => item.id === id);
  const fila = {
    id,
    nombre,
    descripcion: recorte(entrada.descripcion, 200),
    orden: actual ? actual.orden : lista.length,
    padreId,
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("equipos").upsert({
      id: fila.id,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      orden: fila.orden,
      padre_id: fila.padreId || null,
    });
    if (error && faltaColumnaPadre(error)) {
      throw new Error("Falta relacionar los equipos en Supabase. Vuelve a pegar supabase/schema.sql y dale Run.");
    }
    if (error) throw new Error(error.message);
    return fila;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const i = data.equipos.findIndex((item) => item.id === id);
  if (i >= 0) data.equipos[i] = fila;
  else data.equipos.push(fila);
  escribirJson(data);
  return fila;
}

async function borrarEquipo(id) {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    await client.from("personas").update({ equipo_id: null }).eq("equipo_id", id);
    const suelta = await client.from("equipos").update({ padre_id: null }).eq("padre_id", id);
    if (suelta.error && !faltaColumnaPadre(suelta.error)) throw new Error(suelta.error.message);
    const { error } = await client.from("equipos").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.personas.forEach((persona) => {
    if (persona.equipoId === id) persona.equipoId = "";
  });
  data.equipos.forEach((equipo) => {
    if (equipo.padreId === id) equipo.padreId = "";
  });
  data.equipos = data.equipos.filter((item) => item.id !== id);
  escribirJson(data);
  return true;
}

function filaPersona(row) {
  return {
    id: row.id,
    equipoId: row.equipo_id || row.equipoId || "",
    reportaA: row.reporta_a || row.reportaA || "",
    nombre: row.nombre,
    cargo: row.cargo || "",
    rolId: row.rol_id || row.rolId || "",
    celular: row.celular || "",
    correo: row.correo || "",
    nota: row.nota || "",
    apodo: row.apodo || "",
    foto: row.foto || "",
    disponibilidadId: row.disponibilidad_id || row.disponibilidadId || "",
    orden: row.orden || 0,
    activo: row.activo !== false,
  };
}

async function listarPersonas() {
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("personas").select("*").order("orden");
    if (error) throw new Error(error.message);
    return (data || []).map(filaPersona);
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().personas.map(filaPersona);
}

function hayCiclo(lista, id, destino, campo) {
  let cursor = destino;
  const vistos = new Set([id]);
  while (cursor) {
    if (vistos.has(cursor)) return true;
    vistos.add(cursor);
    const nodo = lista.find((item) => item.id === cursor);
    cursor = nodo && nodo[campo];
  }
  return false;
}

async function guardarPersona(entrada) {
  const nombre = recorte(entrada.nombre, 80);
  if (nombre.length < 2) throw new Error("Falta el nombre");
  const lista = await listarPersonas();
  const id = entrada.id || idCorto("PE-");
  const reportaA = recorte(entrada.reportaA, 40);
  if (reportaA && reportaA === id) throw new Error("Una persona no puede reportarse a sí misma");
  if (reportaA && !lista.some((item) => item.id === reportaA) && reportaA !== id) {
    throw new Error("Elige a quién reporta dentro del equipo");
  }
  const prueba = lista.filter((item) => item.id !== id).concat([{ id, reportaA }]);
  if (reportaA && hayCiclo(prueba, id, reportaA, "reportaA")) throw new Error("Eso formaría un círculo en el organigrama");
  const actual = lista.find((item) => item.id === id);
  const equipos = await listarEquipos();
  let equipoId = recorte(entrada.equipoId, 40);
  if (equipoId && !equipos.some((item) => item.id === equipoId)) equipoId = "";
  let rolId = recorte(entrada.rolId, 40);
  const roles = await listarRoles();
  const rol = roles.find((item) => item.id === rolId);
  if (rolId && !rol) rolId = "";
  const fila = {
    id,
    equipoId,
    reportaA,
    rolId,
    nombre,
    cargo: rol ? recorte(rol.nombre, 60) : recorte(entrada.cargo, 60),
    celular: recorte(entrada.celular, 20).replace(/[^\d]/g, ""),
    correo: recorte(entrada.correo, 80),
    nota: recorte(entrada.nota, 300),
    apodo: entrada.apodo != null ? recorte(entrada.apodo, 40) : (actual && actual.apodo) || "",
    foto: entrada.foto != null ? recorte(entrada.foto, 300) : (actual && actual.foto) || "",
    disponibilidadId: entrada.disponibilidadId != null ? recorte(entrada.disponibilidadId, 40) : (actual && actual.disponibilidadId) || "",
    orden: actual ? actual.orden : lista.length,
    activo: entrada.activo !== false,
  };
  if (await tablasNuevas()) {
    const cuerpo = {
      id: fila.id,
      equipo_id: fila.equipoId || null,
      reporta_a: fila.reportaA || null,
      rol_id: fila.rolId || null,
      nombre: fila.nombre,
      cargo: fila.cargo,
      celular: fila.celular,
      correo: fila.correo,
      nota: fila.nota,
      apodo: fila.apodo,
      foto: fila.foto,
      disponibilidad_id: fila.disponibilidadId || null,
      orden: fila.orden,
      activo: fila.activo,
    };
    let { error } = await clienteSupabase().from("personas").upsert(cuerpo);
    if (error && faltaColumnaRol(error) && !fila.rolId) {
      delete cuerpo.rol_id;
      const segundo = await clienteSupabase().from("personas").upsert(cuerpo);
      error = segundo.error;
    }
    if (error && /apodo|disponibilidad_id|foto/i.test(String(error.message || "")) && !fila.apodo && !fila.disponibilidadId && !fila.foto) {
      delete cuerpo.apodo;
      delete cuerpo.disponibilidad_id;
      delete cuerpo.foto;
      const tercero = await clienteSupabase().from("personas").upsert(cuerpo);
      error = tercero.error;
    }
    if (error && /apodo|disponibilidad_id|foto/i.test(String(error.message || ""))) throw new Error(avisoChat());
    if (error && (faltaColumnaRol(error) || faltaTabla(error))) throw new Error(avisoRoles());
    if (error) throw new Error(error.message);
    return fila;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const i = data.personas.findIndex((item) => item.id === id);
  if (i >= 0) data.personas[i] = fila;
  else data.personas.push(fila);
  escribirJson(data);
  return fila;
}

async function borrarPersona(id) {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    await client.from("personas").update({ reporta_a: null }).eq("reporta_a", id);
    const miembros = await client.from("chat_miembros").delete().eq("persona_id", id);
    if (miembros.error && !faltaTabla(miembros.error)) throw new Error(miembros.error.message);
    const dichos = await client.from("mensajes").update({ persona_id: null }).eq("persona_id", id);
    if (dichos.error && !faltaTabla(dichos.error)) throw new Error(dichos.error.message);
    const cuentas = await client.from("usuarios").delete().eq("persona_id", id);
    if (cuentas.error && !faltaTabla(cuentas.error)) throw new Error(cuentas.error.message);
    const tareas = await client.from("tareas").update({ persona_id: null }).eq("persona_id", id);
    if (tareas.error && !faltaTabla(tareas.error)) throw new Error(tareas.error.message);
    const notas = await client.from("notas").update({ persona_id: null }).eq("persona_id", id);
    if (notas.error && !faltaTabla(notas.error)) throw new Error(notas.error.message);
    const { error } = await client.from("personas").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.personas.forEach((persona) => {
    if (persona.reportaA === id) persona.reportaA = "";
  });
  data.personas = data.personas.filter((item) => item.id !== id);
  data.miembros = (data.miembros || []).filter((item) => item.personaId !== id);
  (data.mensajes || []).forEach((item) => {
    if (item.personaId === id) item.personaId = "";
  });
  data.usuarios = (data.usuarios || []).filter((item) => item.personaId !== id);
  (data.tareas || []).forEach((item) => {
    if (item.personaId === id) item.personaId = "";
  });
  (data.notas || []).forEach((item) => {
    if (item.personaId === id) item.personaId = "";
  });
  escribirJson(data);
  return true;
}

function arbol(personas) {
  const activos = (personas || []).filter((item) => item.activo !== false);
  const ids = new Set(activos.map((item) => item.id));
  const hijos = new Map();
  activos.forEach((persona) => {
    const padre = persona.reportaA && ids.has(persona.reportaA) ? persona.reportaA : null;
    if (!hijos.has(padre)) hijos.set(padre, []);
    hijos.get(padre).push(persona);
  });
  function nodo(persona) {
    const ramas = (hijos.get(persona.id) || []).map(nodo);
    return {
      id: persona.id,
      nombre: persona.nombre,
      cargo: persona.cargo || "",
      equipoId: persona.equipoId || "",
      celular: persona.celular || "",
      correo: persona.correo || "",
      ramas: ramas.length,
      hijos: ramas,
    };
  }
  return (hijos.get(null) || []).map(nodo);
}

function arbolEquipos(equipos) {
  const lista = equipos || [];
  const ids = new Set(lista.map((item) => item.id));
  const hijos = new Map();
  lista.forEach((equipo) => {
    const padre = equipo.padreId && ids.has(equipo.padreId) ? equipo.padreId : null;
    if (!hijos.has(padre)) hijos.set(padre, []);
    hijos.get(padre).push(equipo);
  });
  function nodo(equipo) {
    const ramas = (hijos.get(equipo.id) || []).map(nodo);
    return {
      id: equipo.id,
      nombre: equipo.nombre,
      descripcion: equipo.descripcion || "",
      ramas: ramas.length,
      hijos: ramas,
    };
  }
  return (hijos.get(null) || []).map(nodo);
}

async function organigrama() {
  const [personas, equipos, roles, caracteristicas] = await Promise.all([
    listarPersonas(),
    listarEquipos(),
    listarRoles(),
    listarCaracteristicas(),
  ]);
  return { equipos, personas, roles, caracteristicas, equiposArbol: arbolEquipos(equipos), raices: arbol(personas) };
}

function sqlLiteral(valor) {
  return "'" + String(valor == null ? "" : valor).replace(/'/g, "''") + "'";
}

function ordenDependiente(lista, campo) {
  const pendientes = (lista || []).slice();
  const listos = new Set();
  const salida = [];
  while (pendientes.length) {
    const indice = pendientes.findIndex((item) => !item[campo] || listos.has(item[campo]));
    const item = pendientes.splice(indice < 0 ? 0 : indice, 1)[0];
    listos.add(item.id);
    salida.push(item);
  }
  return salida;
}

function sqlOrganigramaDe(roles, caracteristicas, equipos, personas) {
  const lineas = [
    "-- Organigrama TAVADEV. Se puede volver a ejecutar.",
    "-- Primero corre supabase/schema.sql si todavía no existen roles ni características.",
  ];
  function bloque(titulo, filas, armar) {
    if (!filas.length) {
      lineas.push("", "-- " + titulo + ": ninguno");
      return;
    }
    lineas.push("", armar(filas));
  }
  bloque("roles", roles, (filas) => {
    const valores = filas.map((item) => "  (" + [sqlLiteral(item.id), sqlLiteral(item.codigo), sqlLiteral(item.nombre), sqlLiteral(item.descripcion || ""), Number(item.orden) || 0].join(", ") + ")").join(",\n");
    return "insert into roles (id, codigo, nombre, descripcion, orden) values\n" + valores + "\non conflict (id) do update set codigo = excluded.codigo, nombre = excluded.nombre, descripcion = excluded.descripcion, orden = excluded.orden;";
  });
  bloque("características", caracteristicas, (filas) => {
    const valores = filas.map((item) => "  (" + [sqlLiteral(item.id), sqlLiteral(item.rolId), sqlLiteral(item.codigo), sqlLiteral(item.nombre), Number(item.orden) || 0].join(", ") + ")").join(",\n");
    return "insert into caracteristicas (id, rol_id, codigo, nombre, orden) values\n" + valores + "\non conflict (id) do update set rol_id = excluded.rol_id, codigo = excluded.codigo, nombre = excluded.nombre, orden = excluded.orden;";
  });
  bloque("equipos", ordenDependiente(equipos, "padreId"), (filas) => {
    const valores = filas.map((item) => "  (" + [sqlLiteral(item.id), sqlLiteral(item.nombre), sqlLiteral(item.descripcion || ""), Number(item.orden) || 0, item.padreId ? sqlLiteral(item.padreId) : "null"].join(", ") + ")").join(",\n");
    return "insert into equipos (id, nombre, descripcion, orden, padre_id) values\n" + valores + "\non conflict (id) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, orden = excluded.orden, padre_id = excluded.padre_id;";
  });
  bloque("personas", ordenDependiente(personas, "reportaA"), (filas) => {
    const valores = filas.map((item) => "  (" + [
      sqlLiteral(item.id),
      item.equipoId ? sqlLiteral(item.equipoId) : "null",
      item.reportaA ? sqlLiteral(item.reportaA) : "null",
      item.rolId ? sqlLiteral(item.rolId) : "null",
      sqlLiteral(item.nombre),
      sqlLiteral(item.cargo || ""),
      sqlLiteral(item.celular || ""),
      sqlLiteral(item.correo || ""),
      sqlLiteral(item.nota || ""),
      Number(item.orden) || 0,
      item.activo === false ? "false" : "true",
    ].join(", ") + ")").join(",\n");
    return "insert into personas (id, equipo_id, reporta_a, rol_id, nombre, cargo, celular, correo, nota, orden, activo) values\n" + valores + "\non conflict (id) do update set equipo_id = excluded.equipo_id, reporta_a = excluded.reporta_a, rol_id = excluded.rol_id, nombre = excluded.nombre, cargo = excluded.cargo, celular = excluded.celular, correo = excluded.correo, nota = excluded.nota, orden = excluded.orden, activo = excluded.activo;";
  });
  return lineas.join("\n") + "\n";
}

async function sqlOrganigrama() {
  const data = await organigrama();
  return sqlOrganigramaDe(data.roles, data.caracteristicas, data.equipos, data.personas);
}

function avisoChat() {
  return "Falta el chat interno en Supabase. Vuelve a pegar supabase/schema.sql y dale Run.";
}

function filaDisponibilidad(row) {
  return {
    id: row.id,
    nombre: row.nombre || "",
    color: row.color || "#7B5FD1",
    orden: row.orden || 0,
  };
}

function filaChat(row, miembros, ultimo) {
  return {
    id: row.id,
    tipo: row.tipo === "grupo" ? "grupo" : "directo",
    nombre: row.nombre || "",
    clave: row.clave || "",
    creadoEn: row.creado_en || row.creadoEn || "",
    miembros: miembros || [],
    ultimo: ultimo || null,
  };
}

function filaMensaje(row) {
  return {
    id: row.id,
    chatId: row.chat_id || row.chatId || "",
    personaId: row.persona_id || row.personaId || "",
    texto: row.texto || "",
    emote: row.emote || "",
    creadoEn: row.creado_en || row.creadoEn || "",
  };
}

async function listarDisponibilidades() {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const { data, error } = await client.from("disponibilidades").select("*").order("orden");
    if (error && faltaTabla(error)) throw new Error(avisoChat());
    if (error) throw new Error(error.message);
    if (!data || !data.length) {
      const semilla = semillaDisponibilidad();
      const { error: up } = await client.from("disponibilidades").upsert(semilla);
      if (up) throw new Error(up.message);
      return semilla;
    }
    return data.map(filaDisponibilidad);
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  return (data.disponibilidades.length ? data.disponibilidades : semillaDisponibilidad()).map(filaDisponibilidad);
}

async function guardarDisponibilidad(entrada) {
  const nombre = recorte(entrada.nombre, 40);
  if (nombre.length < 2) throw new Error("Ponle nombre al estado");
  const lista = await listarDisponibilidades();
  const id = entrada.id || idCorto("DP-");
  const actual = lista.find((item) => item.id === id);
  const fila = {
    id,
    nombre,
    color: hex(entrada.color, "#7B5FD1"),
    orden: actual ? actual.orden : lista.length,
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("disponibilidades").upsert(fila);
    if (error && faltaTabla(error)) throw new Error(avisoChat());
    if (error) throw new Error(error.message);
    return fila;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const i = data.disponibilidades.findIndex((item) => item.id === id);
  if (i >= 0) data.disponibilidades[i] = fila;
  else data.disponibilidades.push(fila);
  escribirJson(data);
  return fila;
}

async function borrarDisponibilidad(id) {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const suelta = await client.from("personas").update({ disponibilidad_id: null }).eq("disponibilidad_id", id);
    if (suelta.error && !faltaTabla(suelta.error) && !/disponibilidad_id/i.test(String(suelta.error.message || ""))) {
      throw new Error(suelta.error.message);
    }
    const { error } = await client.from("disponibilidades").delete().eq("id", id);
    if (error && faltaTabla(error)) throw new Error(avisoChat());
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.personas.forEach((persona) => {
    if (persona.disponibilidadId === id) persona.disponibilidadId = "";
  });
  data.disponibilidades = data.disponibilidades.filter((item) => item.id !== id);
  escribirJson(data);
  return true;
}

function ultimoDe(mensajes, chatId) {
  const propios = (mensajes || []).filter((item) => (item.chatId || item.chat_id) === chatId);
  if (!propios.length) return null;
  propios.sort((a, b) => String(a.creadoEn || a.creado_en).localeCompare(String(b.creadoEn || b.creado_en)));
  return filaMensaje(propios[propios.length - 1]);
}

async function listarChats() {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const chats = await client.from("chats").select("*").order("creado_en", { ascending: false });
    if (chats.error && faltaTabla(chats.error)) throw new Error(avisoChat());
    if (chats.error) throw new Error(chats.error.message);
    const miembros = await client.from("chat_miembros").select("*");
    if (miembros.error) throw new Error(miembros.error.message);
    const dichos = await client.from("mensajes").select("*").order("creado_en", { ascending: false }).limit(400);
    if (dichos.error) throw new Error(dichos.error.message);
    return (chats.data || []).map((chat) => filaChat(
      chat,
      (miembros.data || []).filter((item) => item.chat_id === chat.id).map((item) => item.persona_id),
      ultimoDe(dichos.data || [], chat.id),
    ));
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  return data.chats.map((chat) => filaChat(
    chat,
    data.miembros.filter((item) => item.chatId === chat.id).map((item) => item.personaId),
    ultimoDe(data.mensajes, chat.id),
  ));
}

async function listarMensajes(chatId) {
  if (!chatId) return [];
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("mensajes").select("*").eq("chat_id", chatId).order("creado_en").limit(300);
    if (error && faltaTabla(error)) throw new Error(avisoChat());
    if (error) throw new Error(error.message);
    return (data || []).map(filaMensaje);
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().mensajes.filter((item) => item.chatId === chatId).map(filaMensaje);
}

async function abrirChat(entrada) {
  const tipo = entrada.tipo === "grupo" ? "grupo" : "directo";
  const personas = await listarPersonas();
  const ids = [...new Set((entrada.personaIds || []).map((item) => recorte(item, 40)).filter((item) => personas.some((persona) => persona.id === item)))];
  if (tipo === "directo" && ids.length !== 2) throw new Error("Elige con quién conversas");
  if (tipo === "grupo" && ids.length < 2) throw new Error("Un grupo necesita al menos dos personas");
  const nombre = tipo === "grupo" ? recorte(entrada.nombre, 60) : "";
  if (tipo === "grupo" && nombre.length < 2) throw new Error("Ponle nombre al grupo");
  const clave = tipo === "directo" ? ids.slice().sort().join("|") : "";
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    if (clave) {
      const previo = await client.from("chats").select("*").eq("clave", clave).maybeSingle();
      if (previo.error && !faltaTabla(previo.error)) throw new Error(previo.error.message);
      if (previo.data) {
        const miembros = await client.from("chat_miembros").select("persona_id").eq("chat_id", previo.data.id);
        return filaChat(previo.data, (miembros.data || []).map((item) => item.persona_id), null);
      }
    }
    const fila = { id: idCorto(tipo === "grupo" ? "GR-" : "CH-"), tipo, nombre, clave: clave || null, creado_en: new Date().toISOString() };
    const creado = await client.from("chats").insert(fila).select("*").single();
    if (creado.error && faltaTabla(creado.error)) throw new Error(avisoChat());
    if (creado.error) throw new Error(creado.error.message);
    const altas = ids.map((personaId) => ({ chat_id: fila.id, persona_id: personaId }));
    const miembros = await client.from("chat_miembros").insert(altas);
    if (miembros.error) throw new Error(miembros.error.message);
    return filaChat(creado.data || fila, ids, null);
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  if (clave) {
    const previo = data.chats.find((item) => item.clave === clave);
    if (previo) {
      return filaChat(previo, data.miembros.filter((item) => item.chatId === previo.id).map((item) => item.personaId), null);
    }
  }
  const fila = { id: idCorto(tipo === "grupo" ? "GR-" : "CH-"), tipo, nombre, clave, creadoEn: new Date().toISOString() };
  data.chats.push(fila);
  ids.forEach((personaId) => data.miembros.push({ chatId: fila.id, personaId }));
  escribirJson(data);
  return filaChat(fila, ids, null);
}

async function renombrarChat(chatId, nombre) {
  const titulo = recorte(nombre, 60);
  if (titulo.length < 2) throw new Error("Ponle nombre al grupo");
  const chats = await listarChats();
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) throw new Error("Ese chat no está");
  if (chat.tipo !== "grupo") throw new Error("Solo los grupos tienen nombre");
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("chats").update({ nombre: titulo }).eq("id", chatId);
    if (error && faltaTabla(error)) throw new Error(avisoChat());
    if (error) throw new Error(error.message);
    return { ...chat, nombre: titulo };
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const fila = data.chats.find((item) => item.id === chatId);
  if (!fila) throw new Error("Ese chat no está");
  fila.nombre = titulo;
  escribirJson(data);
  return { ...chat, nombre: titulo };
}

async function agregarAlChat(chatId, personaId) {
  const idChat = recorte(chatId, 40);
  const idPersona = recorte(personaId, 40);
  const personas = await listarPersonas();
  if (!personas.some((item) => item.id === idPersona)) throw new Error("Esa persona no está guardada");
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("chat_miembros").upsert({ chat_id: idChat, persona_id: idPersona });
    if (error && faltaTabla(error)) throw new Error(avisoChat());
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  if (!data.chats.some((item) => item.id === idChat)) throw new Error("Ese chat no está");
  if (!data.miembros.some((item) => item.chatId === idChat && item.personaId === idPersona)) {
    data.miembros.push({ chatId: idChat, personaId: idPersona });
    escribirJson(data);
  }
  return true;
}

async function guardarMensaje(entrada) {
  const chatId = recorte(entrada.chatId, 40);
  const personaId = recorte(entrada.personaId, 40);
  const texto = recorte(entrada.texto, 1000);
  const emote = recorte(entrada.emote, 16);
  if (!texto && !emote) throw new Error("Escribe algo o elige un emote");
  const chats = await listarChats();
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) throw new Error("Ese chat no está");
  if (personaId && !chat.miembros.includes(personaId)) throw new Error("Esa persona no está en el chat");
  const fila = {
    id: idCorto("MG-"),
    chatId,
    personaId,
    texto,
    emote,
    creadoEn: new Date().toISOString(),
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("mensajes").insert({
      id: fila.id,
      chat_id: fila.chatId,
      persona_id: fila.personaId || null,
      texto: fila.texto,
      emote: fila.emote,
      creado_en: fila.creadoEn,
    });
    if (error && faltaTabla(error)) throw new Error(avisoChat());
    if (error) throw new Error(error.message);
    return fila;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.mensajes.push(fila);
  escribirJson(data);
  return fila;
}

function avisoPlan() {
  return "Faltan los usuarios o el tablero en Supabase. Vuelve a pegar supabase/schema.sql y dale Run.";
}

function normalizarUsuario(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24);
}

function hashClave(clave) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(clave), salt, 32).toString("hex");
  return "scrypt$" + salt + "$" + hash;
}

function claveCoincide(clave, guardada) {
  const partes = String(guardada || "").split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  let hash;
  try {
    hash = crypto.scryptSync(String(clave), partes[1], 32);
  } catch {
    return false;
  }
  const esperada = Buffer.from(partes[2], "hex");
  if (hash.length !== esperada.length || esperada.length !== 32) return false;
  return crypto.timingSafeEqual(hash, esperada);
}

function filaUsuario(row, personas) {
  const personaId = row.persona_id || row.personaId || "";
  const persona = (personas || []).find((item) => item.id === personaId);
  return {
    id: row.id,
    personaId,
    usuario: row.usuario || "",
    papel: row.papel === "admin" ? "admin" : "equipo",
    activo: row.activo !== false && row.activo !== "false",
    nombre: persona ? persona.nombre : "",
    cargo: persona ? persona.cargo || "" : "",
    claveHash: row.clave_hash || row.claveHash || "",
  };
}

function usuarioPublico(fila) {
  return {
    id: fila.id,
    personaId: fila.personaId,
    usuario: fila.usuario,
    papel: fila.papel,
    activo: fila.activo,
    nombre: fila.nombre,
    cargo: fila.cargo,
  };
}

async function listarUsuariosCrudo() {
  const personas = await listarPersonas();
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("usuarios").select("id, persona_id, usuario, papel, activo, clave_hash");
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return (data || []).map((row) => filaUsuario(row, personas));
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().usuarios.map((row) => filaUsuario(row, personas));
}

async function listarUsuarios() {
  const lista = await listarUsuariosCrudo();
  return lista.map(usuarioPublico);
}

async function obtenerUsuario(id) {
  const lista = await listarUsuariosCrudo();
  const fila = lista.find((item) => item.id === id);
  return fila ? usuarioPublico(fila) : null;
}

async function entrarUsuario(usuario, clave) {
  const nombre = normalizarUsuario(usuario);
  if (!nombre) return null;
  const lista = await listarUsuariosCrudo();
  const fila = lista.find((item) => item.usuario === nombre);
  if (!fila || !claveCoincide(clave, fila.claveHash)) return null;
  if (!fila.activo) throw new Error("Esta cuenta está en pausa");
  return usuarioPublico(fila);
}

async function guardarUsuario(entrada) {
  const personas = await listarPersonas();
  const personaId = recorte(entrada.personaId, 40);
  const usuario = normalizarUsuario(entrada.usuario);
  const papel = entrada.papel === "admin" ? "admin" : "equipo";
  if (!personas.some((item) => item.id === personaId)) throw new Error("Elige una persona del equipo");
  if (usuario.length < 3) throw new Error("El usuario necesita al menos 3 letras o números");
  const actuales = await listarUsuariosCrudo();
  const id = entrada.id || idCorto("US-");
  const actual = actuales.find((item) => item.id === id);
  if (entrada.id && !actual) throw new Error("No está ese usuario");
  if (actuales.some((item) => item.usuario === usuario && item.id !== id)) throw new Error("Ese usuario ya existe");
  if (actuales.some((item) => item.personaId === personaId && item.id !== id)) throw new Error("Esa persona ya tiene usuario");
  const clave = String(entrada.clave || "");
  if (!actual && clave.length < 6) throw new Error("La contraseña necesita al menos 6 caracteres");
  if (clave && clave.length < 6) throw new Error("La contraseña necesita al menos 6 caracteres");
  const fila = {
    id,
    personaId,
    usuario,
    papel,
    activo: entrada.activo == null ? (actual ? actual.activo : true) : entrada.activo !== false,
    claveHash: clave ? hashClave(clave) : actual.claveHash,
    nombre: (personas.find((item) => item.id === personaId) || {}).nombre || "",
    cargo: (personas.find((item) => item.id === personaId) || {}).cargo || "",
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("usuarios").upsert({
      id: fila.id,
      persona_id: fila.personaId,
      usuario: fila.usuario,
      papel: fila.papel,
      activo: fila.activo,
      clave_hash: fila.claveHash,
    });
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return usuarioPublico(fila);
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const i = data.usuarios.findIndex((item) => item.id === id);
  if (i >= 0) data.usuarios[i] = fila;
  else data.usuarios.push(fila);
  escribirJson(data);
  return usuarioPublico(fila);
}

async function borrarUsuario(id) {
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("usuarios").delete().eq("id", id);
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.usuarios = data.usuarios.filter((item) => item.id !== id);
  escribirJson(data);
  return true;
}

function filaActividadEstado(row) {
  return {
    id: row.id,
    nombre: row.nombre || "",
    orden: row.orden || 0,
    color: row.color || "#7B5FD1",
    esInicial: Boolean(row.es_inicial != null ? row.es_inicial : row.esInicial),
    esFinal: Boolean(row.es_final != null ? row.es_final : row.esFinal),
  };
}

function aFilaActividadEstado(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    orden: fila.orden,
    color: fila.color,
    es_inicial: Boolean(fila.esInicial),
    es_final: Boolean(fila.esFinal),
  };
}

async function listarActividadEstados() {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const { data, error } = await client.from("actividad_estados").select("*").order("orden");
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    if (!data || !data.length) {
      const semilla = semillaActividad();
      const { error: up } = await client.from("actividad_estados").upsert(semilla.map(aFilaActividadEstado));
      if (up) throw new Error(up.message);
      return semilla;
    }
    return data.map(filaActividadEstado);
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const lista = data.actividadEstados.length ? data.actividadEstados : semillaActividad();
  return lista.map(filaActividadEstado).sort((a, b) => a.orden - b.orden);
}

async function guardarActividadEstado(entrada) {
  const nombre = recorte(entrada.nombre, 40);
  if (nombre.length < 2) throw new Error("Ponle nombre al estado");
  const lista = await listarActividadEstados();
  const id = entrada.id || idCorto("AE-");
  const actual = lista.find((item) => item.id === id);
  const fila = {
    id,
    nombre,
    orden: actual ? actual.orden : lista.reduce((max, item) => Math.max(max, item.orden), -1) + 1,
    color: hex(entrada.color, (actual && actual.color) || "#7B5FD1"),
    esInicial: actual ? actual.esInicial : lista.length === 0,
    esFinal: actual ? actual.esFinal : false,
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("actividad_estados").upsert(aFilaActividadEstado(fila));
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return fila;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const i = data.actividadEstados.findIndex((item) => item.id === id);
  if (i >= 0) data.actividadEstados[i] = fila;
  else data.actividadEstados.push(fila);
  escribirJson(data);
  return fila;
}

async function moverActividadEstado(id, delta) {
  const lista = (await listarActividadEstados()).sort((a, b) => a.orden - b.orden);
  const i = lista.findIndex((item) => item.id === id);
  if (i < 0) return null;
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const ordenA = lista[i].orden;
  lista[i].orden = lista[j].orden;
  lista[j].orden = ordenA;
  if (ordenA === lista[i].orden) lista.forEach((item, n) => { item.orden = n; });
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("actividad_estados").upsert(lista.map(aFilaActividadEstado));
    if (error) throw new Error(error.message);
    return listarActividadEstados();
  }
  const data = leerLocal();
  data.actividadEstados = lista;
  escribirJson(data);
  return lista.sort((a, b) => a.orden - b.orden);
}

async function borrarActividadEstado(id) {
  const lista = await listarActividadEstados();
  if (!lista.some((item) => item.id === id)) return false;
  if (lista.length < 2) throw new Error("Deja al menos un estado");
  const tareas = await listarTareas();
  if (tareas.some((item) => item.estadoId === id)) throw new Error("Hay tareas en ese estado. Muévelas antes de quitarlo.");
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("actividad_estados").delete().eq("id", id);
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.actividadEstados = data.actividadEstados.filter((item) => item.id !== id);
  escribirJson(data);
  return true;
}

function filaEpica(row) {
  return {
    id: row.id,
    nombre: row.nombre || "",
    resumen: row.resumen || "",
    color: row.color || "#7B5FD1",
    estado: row.estado === "cerrada" ? "cerrada" : "abierta",
    orden: row.orden || 0,
    creadoEn: row.creado_en || row.creadoEn || "",
  };
}

async function listarEpicas() {
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("epicas").select("*").order("orden");
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return (data || []).map(filaEpica);
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().epicas.map(filaEpica);
}

async function guardarEpica(entrada) {
  const nombre = recorte(entrada.nombre, 80);
  if (nombre.length < 2) throw new Error("Ponle nombre a la épica");
  const lista = await listarEpicas();
  const id = entrada.id || idCorto("EP-");
  const actual = lista.find((item) => item.id === id);
  if (entrada.id && !actual) throw new Error("No está esa épica");
  const fila = {
    id,
    nombre,
    resumen: recorte(entrada.resumen, 500),
    color: hex(entrada.color, (actual && actual.color) || "#7B5FD1"),
    estado: entrada.estado === "cerrada" ? "cerrada" : "abierta",
    orden: actual ? actual.orden : lista.length,
    creadoEn: (actual && actual.creadoEn) || new Date().toISOString(),
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("epicas").upsert({
      id: fila.id,
      nombre: fila.nombre,
      resumen: fila.resumen,
      color: fila.color,
      estado: fila.estado,
      orden: fila.orden,
      creado_en: fila.creadoEn,
    });
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return fila;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  const i = data.epicas.findIndex((item) => item.id === id);
  if (i >= 0) data.epicas[i] = fila;
  else data.epicas.push(fila);
  escribirJson(data);
  return fila;
}

async function borrarEpica(id) {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const suelta = await client.from("tareas").update({ epica_id: null }).eq("epica_id", id);
    if (suelta.error && !faltaTabla(suelta.error)) throw new Error(suelta.error.message);
    const { error } = await client.from("epicas").delete().eq("id", id);
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.tareas.forEach((item) => {
    if (item.epicaId === id) item.epicaId = "";
  });
  data.epicas = data.epicas.filter((item) => item.id !== id);
  escribirJson(data);
  return true;
}

function fechaDe(valor) {
  const t = recorte(valor, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
}

function filaSprint(row) {
  const estado = row.estado === "activo" || row.estado === "cerrado" ? row.estado : "planificado";
  return {
    id: row.id,
    nombre: row.nombre || "",
    meta: row.meta || "",
    inicio: row.inicio || "",
    fin: row.fin || "",
    estado,
    orden: row.orden || 0,
    creadoEn: row.creado_en || row.creadoEn || "",
  };
}

function aFilaSprint(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    meta: fila.meta,
    inicio: fila.inicio,
    fin: fila.fin,
    estado: fila.estado,
    orden: fila.orden,
    creado_en: fila.creadoEn,
  };
}

async function listarSprints() {
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("sprints").select("*").order("orden");
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return (data || []).map(filaSprint);
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().sprints.map(filaSprint);
}

async function escribirSprints(filas) {
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("sprints").upsert(filas.map(aFilaSprint));
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  filas.forEach((fila) => {
    const i = data.sprints.findIndex((item) => item.id === fila.id);
    if (i >= 0) data.sprints[i] = fila;
    else data.sprints.push(fila);
  });
  escribirJson(data);
}

async function guardarSprint(entrada) {
  const nombre = recorte(entrada.nombre, 80);
  if (nombre.length < 2) throw new Error("Ponle nombre al sprint");
  const lista = await listarSprints();
  const id = entrada.id || idCorto("SP-");
  const actual = lista.find((item) => item.id === id);
  if (entrada.id && !actual) throw new Error("No está ese sprint");
  const estado = entrada.estado === "activo" || entrada.estado === "cerrado" ? entrada.estado : "planificado";
  const fila = {
    id,
    nombre,
    meta: recorte(entrada.meta, 500),
    inicio: fechaDe(entrada.inicio),
    fin: fechaDe(entrada.fin),
    estado,
    orden: actual ? actual.orden : lista.length,
    creadoEn: (actual && actual.creadoEn) || new Date().toISOString(),
  };
  const cambiados = [fila];
  if (estado === "activo") {
    lista.forEach((item) => {
      if (item.id !== id && item.estado === "activo") cambiados.push({ ...item, estado: "planificado" });
    });
  }
  await escribirSprints(cambiados);
  return fila;
}

async function borrarSprint(id) {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const suelta = await client.from("tareas").update({ sprint_id: null }).eq("sprint_id", id);
    if (suelta.error && !faltaTabla(suelta.error)) throw new Error(suelta.error.message);
    const { error } = await client.from("sprints").delete().eq("id", id);
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.tareas.forEach((item) => {
    if (item.sprintId === id) item.sprintId = "";
  });
  data.sprints = data.sprints.filter((item) => item.id !== id);
  escribirJson(data);
  return true;
}

function tipoDe(valor) {
  const tipo = String(valor || "tarea");
  if (!["historia", "tarea", "error"].includes(tipo)) throw new Error("El tipo tiene que ser historia, tarea o error");
  return tipo;
}

function prioridadDe(valor) {
  const prioridad = String(valor || "media");
  if (!["baja", "media", "alta", "urgente"].includes(prioridad)) throw new Error("La prioridad tiene que ser baja, media, alta o urgente");
  return prioridad;
}

function puntosDe(valor) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new Error("Los puntos van de 0 a 99");
  return n;
}

function filaTarea(row) {
  return {
    id: row.id,
    titulo: row.titulo || "",
    detalle: row.detalle || "",
    criterio: row.criterio || "",
    tipo: ["historia", "tarea", "error"].includes(row.tipo) ? row.tipo : "tarea",
    prioridad: ["baja", "media", "alta", "urgente"].includes(row.prioridad) ? row.prioridad : "media",
    puntos: row.puntos == null || row.puntos === "" ? null : Number(row.puntos),
    epicaId: row.epica_id || row.epicaId || "",
    sprintId: row.sprint_id || row.sprintId || "",
    estadoId: row.estado_id || row.estadoId || "",
    personaId: row.persona_id || row.personaId || "",
    orden: row.orden || 0,
    creadoEn: row.creado_en || row.creadoEn || "",
  };
}

function aFilaTarea(fila) {
  return {
    id: fila.id,
    titulo: fila.titulo,
    detalle: fila.detalle,
    criterio: fila.criterio,
    tipo: fila.tipo,
    prioridad: fila.prioridad,
    puntos: fila.puntos == null ? null : fila.puntos,
    epica_id: fila.epicaId || null,
    sprint_id: fila.sprintId || null,
    estado_id: fila.estadoId,
    persona_id: fila.personaId || null,
    orden: fila.orden,
    creado_en: fila.creadoEn,
  };
}

async function listarTareas() {
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("tareas").select("*").order("orden");
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return (data || []).map(filaTarea);
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().tareas.map(filaTarea);
}

async function escribirTareas(filas) {
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("tareas").upsert(filas.map(aFilaTarea));
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  filas.forEach((fila) => {
    const i = data.tareas.findIndex((item) => item.id === fila.id);
    if (i >= 0) data.tareas[i] = fila;
    else data.tareas.push(fila);
  });
  escribirJson(data);
}

async function guardarTarea(entrada) {
  const titulo = recorte(entrada.titulo, 140);
  if (titulo.length < 2) throw new Error("Ponle un título a la tarea");
  const [estados, epicas, sprints, personas, tareas] = await Promise.all([
    listarActividadEstados(),
    listarEpicas(),
    listarSprints(),
    listarPersonas(),
    listarTareas(),
  ]);
  const id = entrada.id || idCorto("TA-");
  const actual = tareas.find((item) => item.id === id);
  if (entrada.id && !actual) throw new Error("No está esa tarea");
  let estadoId = String(entrada.estadoId || (actual && actual.estadoId) || "");
  if (!estados.some((item) => item.id === estadoId)) {
    const inicial = estados.find((item) => item.esInicial) || estados[0];
    if (!inicial) throw new Error("Primero crea un estado");
    estadoId = inicial.id;
  }
  const epicaId = String(entrada.epicaId || "");
  const sprintId = String(entrada.sprintId || "");
  const personaId = String(entrada.personaId || "");
  if (epicaId && !epicas.some((item) => item.id === epicaId)) throw new Error("Esa épica no está");
  if (sprintId && !sprints.some((item) => item.id === sprintId)) throw new Error("Ese sprint no está");
  if (personaId && !personas.some((item) => item.id === personaId)) throw new Error("Esa persona no está en el equipo");
  const delEstado = tareas.filter((item) => item.estadoId === estadoId && item.id !== id);
  const fila = {
    id,
    titulo,
    detalle: recorte(entrada.detalle, 2000),
    criterio: recorte(entrada.criterio, 2000),
    tipo: tipoDe(entrada.tipo || (actual && actual.tipo)),
    prioridad: prioridadDe(entrada.prioridad || (actual && actual.prioridad)),
    puntos: puntosDe(Object.prototype.hasOwnProperty.call(entrada, "puntos") ? entrada.puntos : (actual ? actual.puntos : null)),
    epicaId,
    sprintId,
    estadoId,
    personaId,
    orden: actual && actual.estadoId === estadoId ? actual.orden : delEstado.reduce((max, item) => Math.max(max, item.orden), -1) + 1,
    creadoEn: (actual && actual.creadoEn) || new Date().toISOString(),
  };
  await escribirTareas([fila]);
  return fila;
}

async function ordenarTareas(entrada) {
  const estadoId = String(entrada.estadoId || "");
  const ids = [...new Set((entrada.ids || []).map((id) => String(id || "")).filter(Boolean))];
  if (!estadoId || !ids.length) throw new Error("Falta a dónde moverla");
  const estados = await listarActividadEstados();
  if (!estados.some((item) => item.id === estadoId)) throw new Error("Ese estado no está");
  const tareas = await listarTareas();
  const porId = new Map(tareas.map((item) => [item.id, item]));
  const cambiadas = [];
  ids.forEach((id, orden) => {
    const actual = porId.get(id);
    if (!actual) return;
    cambiadas.push({ ...actual, estadoId, orden });
  });
  if (!cambiadas.length) throw new Error("Esa tarea no está");
  await escribirTareas(cambiadas);
  return cambiadas;
}

async function borrarTarea(id) {
  if (await tablasNuevas()) {
    const client = clienteSupabase();
    const dichas = await client.from("notas").delete().eq("tarea_id", id);
    if (dichas.error && !faltaTabla(dichas.error)) throw new Error(dichas.error.message);
    const { error } = await client.from("tareas").delete().eq("id", id);
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.notas = data.notas.filter((item) => item.tareaId !== id);
  data.tareas = data.tareas.filter((item) => item.id !== id);
  escribirJson(data);
  return true;
}

function filaNota(row) {
  return {
    id: row.id,
    tareaId: row.tarea_id || row.tareaId || "",
    personaId: row.persona_id || row.personaId || "",
    texto: row.texto || "",
    creadoEn: row.creado_en || row.creadoEn || "",
  };
}

async function listarNotas() {
  if (await tablasNuevas()) {
    const { data, error } = await clienteSupabase().from("notas").select("*").order("creado_en");
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return (data || []).map(filaNota);
  }
  if (usaSupabase()) exigirTablas();
  return leerLocal().notas.map(filaNota);
}

async function guardarNota(entrada) {
  const texto = recorte(entrada.texto, 1000);
  if (texto.length < 1) throw new Error("Escribe la nota");
  const tareaId = String(entrada.tareaId || "");
  const tareas = await listarTareas();
  if (!tareas.some((item) => item.id === tareaId)) throw new Error("Esa tarea no está");
  const personaId = String(entrada.personaId || "");
  if (personaId) {
    const personas = await listarPersonas();
    if (!personas.some((item) => item.id === personaId)) throw new Error("Esa persona no está en el equipo");
  }
  const fila = {
    id: idCorto("NT-"),
    tareaId,
    personaId,
    texto,
    creadoEn: new Date().toISOString(),
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("notas").insert({
      id: fila.id,
      tarea_id: fila.tareaId,
      persona_id: fila.personaId || null,
      texto: fila.texto,
      creado_en: fila.creadoEn,
    });
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return fila;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.notas.push(fila);
  escribirJson(data);
  return fila;
}

async function borrarNota(id) {
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("notas").delete().eq("id", id);
    if (error && faltaTabla(error)) throw new Error(avisoPlan());
    if (error) throw new Error(error.message);
    return true;
  }
  if (usaSupabase()) exigirTablas();
  const data = leerLocal();
  data.notas = data.notas.filter((item) => item.id !== id);
  escribirJson(data);
  return true;
}

async function tablero() {
  const [estados, epicas, sprints, tareas, notas, personas] = await Promise.all([
    listarActividadEstados(),
    listarEpicas(),
    listarSprints(),
    listarTareas(),
    listarNotas(),
    listarPersonas(),
  ]);
  return { estados, epicas, sprints, tareas, notas, personas };
}

module.exports = {
  tablasNuevas,
  listarEstados,
  guardarEstado,
  moverEstado,
  borrarEstado,
  idEstado,
  listarClientes,
  anotarCliente,
  actualizarCliente,
  borrarCliente,
  respuestasDe,
  listarPedidos,
  guardarPedido,
  borrarPedido,
  listarEquipos,
  guardarEquipo,
  borrarEquipo,
  listarRoles,
  guardarRol,
  borrarRol,
  listarCaracteristicas,
  guardarCaracteristica,
  borrarCaracteristica,
  listarPersonas,
  guardarPersona,
  borrarPersona,
  listarDisponibilidades,
  guardarDisponibilidad,
  borrarDisponibilidad,
  listarChats,
  listarMensajes,
  abrirChat,
  renombrarChat,
  agregarAlChat,
  guardarMensaje,
  organigrama,
  sqlOrganigrama,
  arbol,
  semillaEstados,
  faltaTabla,
  listarUsuarios,
  obtenerUsuario,
  entrarUsuario,
  guardarUsuario,
  borrarUsuario,
  listarActividadEstados,
  guardarActividadEstado,
  moverActividadEstado,
  borrarActividadEstado,
  listarEpicas,
  guardarEpica,
  borrarEpica,
  listarSprints,
  guardarSprint,
  borrarSprint,
  listarTareas,
  guardarTarea,
  ordenarTareas,
  borrarTarea,
  listarNotas,
  guardarNota,
  borrarNota,
  tablero,
};
