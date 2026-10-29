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

function vacio() {
  return { estados: semillaEstados(), clientes: [], pedidos: [], equipos: [], personas: [] };
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
    celular: row.celular || "",
    correo: row.correo || "",
    nota: row.nota || "",
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
  const fila = {
    id,
    equipoId,
    reportaA,
    nombre,
    cargo: recorte(entrada.cargo, 60),
    celular: recorte(entrada.celular, 20).replace(/[^\d]/g, ""),
    correo: recorte(entrada.correo, 80),
    nota: recorte(entrada.nota, 300),
    orden: actual ? actual.orden : lista.length,
    activo: entrada.activo !== false,
  };
  if (await tablasNuevas()) {
    const { error } = await clienteSupabase().from("personas").upsert({
      id: fila.id,
      equipo_id: fila.equipoId || null,
      reporta_a: fila.reportaA || null,
      nombre: fila.nombre,
      cargo: fila.cargo,
      celular: fila.celular,
      correo: fila.correo,
      nota: fila.nota,
      orden: fila.orden,
      activo: fila.activo,
    });
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
  const [personas, equipos] = await Promise.all([listarPersonas(), listarEquipos()]);
  return { equipos, equiposArbol: arbolEquipos(equipos), raices: arbol(personas) };
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
  listarPersonas,
  guardarPersona,
  borrarPersona,
  organigrama,
  arbol,
  semillaEstados,
  faltaTabla,
};
