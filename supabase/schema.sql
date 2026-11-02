-- Pega esto en Supabase: SQL Editor → Run
-- Se puede ejecutar de nuevo: no borra clientes ni pedidos que ya existan.
-- Luego Project Settings → API: URL y clave service_role. No uses la clave anónima.

create table if not exists contenido (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists estados (
  id text primary key,
  ambito text not null check (ambito in ('cliente', 'pedido')),
  nombre text not null,
  orden int not null default 0,
  color text not null default '#7B5FD1',
  es_inicial boolean not null default false,
  es_final boolean not null default false
);

insert into estados (id, ambito, nombre, orden, color, es_inicial, es_final) values
  ('cli-nueva', 'cliente', 'Nuevo contacto', 0, '#7B5FD1', true, false),
  ('cli-en-conversacion', 'cliente', 'En conversación', 1, '#6A4BC4', false, false),
  ('cli-cotizacion', 'cliente', 'Cotización enviada', 2, '#B9A3F2', false, false),
  ('cli-aprobado', 'cliente', 'Aprobado', 3, '#E57FB8', false, false),
  ('cli-en-curso', 'cliente', 'En trabajo', 4, '#2A2346', false, false),
  ('cli-lista', 'cliente', 'Listo', 5, '#4A4066', false, false),
  ('cli-pausado', 'cliente', 'Pausado', 6, '#F4A6D0', false, false),
  ('cli-descartada', 'cliente', 'Descartado', 7, '#9D2F4A', false, true),
  ('ped-recibido', 'pedido', 'Recibido', 0, '#7B5FD1', true, false),
  ('ped-confirmado', 'pedido', 'Confirmado', 1, '#6A4BC4', false, false),
  ('ped-en-curso', 'pedido', 'En curso', 2, '#2A2346', false, false),
  ('ped-listo', 'pedido', 'Listo', 3, '#E57FB8', false, false),
  ('ped-entregado', 'pedido', 'Entregado', 4, '#4A4066', false, true),
  ('ped-cancelado', 'pedido', 'Cancelado', 5, '#9D2F4A', false, true)
on conflict (id) do nothing;

create table if not exists ofertas (
  id text primary key,
  tipo text not null default 'servicio' check (tipo in ('servicio', 'producto')),
  activo boolean not null default true,
  orden int not null default 0,
  icono text not null default '</>',
  nombre text not null,
  resumen text not null default '',
  tono text not null default 'lila' check (tono in ('lila', 'rosa', 'oscuro', 'blanco')),
  imagen text not null default '',
  updated_at timestamptz default now()
);

create table if not exists oferta_detalles (
  id text primary key,
  oferta_id text not null references ofertas(id) on delete cascade,
  clase text not null check (clase in ('palabra', 'pregunta', 'detalle')),
  orden int not null default 0,
  titulo text not null default '',
  texto text not null default ''
);

create index if not exists oferta_detalles_oferta_idx on oferta_detalles (oferta_id, orden);

create table if not exists clientes (
  id text primary key,
  nombre text not null,
  negocio text not null default '',
  celular text not null default '',
  correo text not null default '',
  jid text not null default '',
  origen text not null default 'panel' check (origen in ('pagina', 'whatsapp', 'panel')),
  estado_id text not null references estados(id),
  nota text not null default '',
  creado_en timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists clientes_celular_idx on clientes (celular);
create index if not exists clientes_estado_idx on clientes (estado_id);

create table if not exists cliente_detalles (
  id text primary key,
  cliente_id text not null references clientes(id) on delete cascade,
  cotizacion_id text,
  clase text not null default 'dato' check (clase in ('dato', 'respuesta')),
  orden int not null default 0,
  titulo text not null default '',
  texto text not null default ''
);

create index if not exists cliente_detalles_cliente_idx on cliente_detalles (cliente_id, orden);
create index if not exists cliente_detalles_cota_idx on cliente_detalles (cotizacion_id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cotizaciones' and column_name = 'data'
  ) then
    alter table public.cotizaciones rename to cotizaciones_json;
  end if;
end $$;

create table if not exists cotizaciones (
  id text primary key,
  cliente_id text not null references clientes(id) on delete cascade,
  oferta_id text references ofertas(id) on delete set null,
  oferta_nombre text not null default '',
  origen text not null default 'pagina' check (origen in ('pagina', 'whatsapp', 'panel')),
  estado_id text not null references estados(id),
  mensaje text not null default '',
  nota_interna text not null default '',
  nombre text not null default '',
  negocio text not null default '',
  celular text not null default '',
  jid text not null default '',
  creado_en timestamptz default now()
);

create index if not exists cotizaciones_creado_idx on cotizaciones (creado_en desc);
create index if not exists cotizaciones_cliente_idx on cotizaciones (cliente_id);
create index if not exists cotizaciones_oferta_idx on cotizaciones (oferta_id);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'cliente_detalles_cotizacion_id_fkey'
  ) then
    alter table cliente_detalles
      add constraint cliente_detalles_cotizacion_id_fkey
      foreign key (cotizacion_id) references cotizaciones(id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;

create table if not exists pedidos (
  id text primary key,
  cliente_id text not null references clientes(id) on delete cascade,
  estado_id text not null references estados(id),
  titulo text not null,
  nota text not null default '',
  creado_en timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists pedidos_cliente_idx on pedidos (cliente_id);
create index if not exists pedidos_estado_idx on pedidos (estado_id);
create index if not exists pedidos_creado_idx on pedidos (creado_en desc);

create table if not exists pedido_items (
  id text primary key,
  pedido_id text not null references pedidos(id) on delete cascade,
  oferta_id text references ofertas(id) on delete set null,
  descripcion text not null,
  cantidad int not null default 1 check (cantidad > 0 and cantidad <= 999),
  detalle text not null default '',
  orden int not null default 0
);

create index if not exists pedido_items_pedido_idx on pedido_items (pedido_id, orden);
create index if not exists pedido_items_oferta_idx on pedido_items (oferta_id);

create table if not exists equipos (
  id text primary key,
  nombre text not null,
  descripcion text not null default '',
  orden int not null default 0,
  padre_id text
);

alter table equipos add column if not exists padre_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'equipos_padre_id_fkey') then
    alter table equipos
      add constraint equipos_padre_id_fkey
      foreign key (padre_id) references equipos(id) on delete set null;
  end if;
end $$;

create index if not exists equipos_padre_idx on equipos (padre_id);

create table if not exists personas (
  id text primary key,
  equipo_id text references equipos(id) on delete set null,
  reporta_a text references personas(id) on delete set null,
  nombre text not null,
  cargo text not null default '',
  celular text not null default '',
  correo text not null default '',
  nota text not null default '',
  orden int not null default 0,
  activo boolean not null default true
);

create index if not exists personas_equipo_idx on personas (equipo_id);
create index if not exists personas_reporta_idx on personas (reporta_a);

create table if not exists roles (
  id text primary key,
  codigo text not null,
  nombre text not null,
  descripcion text not null default '',
  orden int not null default 0
);

create unique index if not exists roles_codigo_idx on roles (codigo);

create table if not exists caracteristicas (
  id text primary key,
  rol_id text references roles(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  orden int not null default 0
);

create index if not exists caracteristicas_rol_idx on caracteristicas (rol_id);
create unique index if not exists caracteristicas_codigo_idx on caracteristicas (rol_id, codigo);

alter table personas add column if not exists rol_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'personas_rol_id_fkey') then
    alter table personas
      add constraint personas_rol_id_fkey
      foreign key (rol_id) references roles(id) on delete set null;
  end if;
end $$;

create index if not exists personas_rol_idx on personas (rol_id);

alter table personas add column if not exists apodo text not null default '';
alter table personas add column if not exists foto text not null default '';
alter table personas add column if not exists disponibilidad_id text;

create table if not exists disponibilidades (
  id text primary key,
  nombre text not null,
  color text not null default '#7B5FD1',
  orden int not null default 0
);

insert into disponibilidades (id, nombre, color, orden) values
  ('disp-disponible', 'Disponible', '#3C8F63', 0),
  ('disp-ocupado', 'Ocupado', '#C47B2A', 1),
  ('disp-ensayo', 'En ensayo', '#6A4BC4', 2),
  ('disp-ausente', 'Ausente', '#9D2F4A', 3)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'personas_disponibilidad_id_fkey') then
    alter table personas
      add constraint personas_disponibilidad_id_fkey
      foreign key (disponibilidad_id) references disponibilidades(id) on delete set null;
  end if;
end $$;

create table if not exists chats (
  id text primary key,
  tipo text not null check (tipo in ('directo', 'grupo')),
  nombre text not null default '',
  clave text,
  creado_en timestamptz not null default now()
);

create unique index if not exists chats_clave_idx on chats (clave) where clave is not null;

create table if not exists chat_miembros (
  chat_id text not null references chats(id) on delete cascade,
  persona_id text not null references personas(id) on delete cascade,
  primary key (chat_id, persona_id)
);

create table if not exists mensajes (
  id text primary key,
  chat_id text not null references chats(id) on delete cascade,
  persona_id text references personas(id) on delete set null,
  texto text not null default '',
  emote text not null default '',
  creado_en timestamptz not null default now()
);

create index if not exists mensajes_chat_idx on mensajes (chat_id, creado_en);

create table if not exists usuarios (
  id text primary key,
  persona_id text not null references personas(id) on delete cascade,
  usuario text not null,
  clave_hash text not null,
  papel text not null default 'equipo' check (papel in ('admin', 'equipo')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index if not exists usuarios_persona_idx on usuarios (persona_id);
create unique index if not exists usuarios_usuario_idx on usuarios (usuario);

create table if not exists actividad_estados (
  id text primary key,
  nombre text not null,
  orden int not null default 0,
  color text not null default '#7B5FD1',
  es_inicial boolean not null default false,
  es_final boolean not null default false
);

insert into actividad_estados (id, nombre, orden, color, es_inicial, es_final) values
  ('act-por-hacer', 'Por hacer', 0, '#7B5FD1', true, false),
  ('act-en-curso', 'En curso', 1, '#6A4BC4', false, false),
  ('act-revision', 'En revisión', 2, '#E57FB8', false, false),
  ('act-listo', 'Listo', 3, '#3C8F63', false, true)
on conflict (id) do nothing;

create table if not exists epicas (
  id text primary key,
  nombre text not null,
  resumen text not null default '',
  color text not null default '#7B5FD1',
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create table if not exists sprints (
  id text primary key,
  nombre text not null,
  meta text not null default '',
  inicio text not null default '',
  fin text not null default '',
  estado text not null default 'planificado' check (estado in ('planificado', 'activo', 'cerrado')),
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create table if not exists tareas (
  id text primary key,
  titulo text not null,
  detalle text not null default '',
  criterio text not null default '',
  tipo text not null default 'tarea' check (tipo in ('historia', 'tarea', 'error')),
  prioridad text not null default 'media' check (prioridad in ('baja', 'media', 'alta', 'urgente')),
  puntos int,
  epica_id text references epicas(id) on delete set null,
  sprint_id text references sprints(id) on delete set null,
  estado_id text not null references actividad_estados(id) on delete restrict,
  persona_id text references personas(id) on delete set null,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create index if not exists tareas_estado_idx on tareas (estado_id, orden);
create index if not exists tareas_sprint_idx on tareas (sprint_id);
create index if not exists tareas_epica_idx on tareas (epica_id);

create table if not exists notas (
  id text primary key,
  tarea_id text not null references tareas(id) on delete cascade,
  persona_id text references personas(id) on delete set null,
  texto text not null,
  creado_en timestamptz not null default now()
);

create index if not exists notas_tarea_idx on notas (tarea_id, creado_en);

insert into ofertas (id, tipo, activo, orden, icono, nombre, resumen, tono, imagen)
select
  s.item->>'id',
  case when s.item->>'tipo' = 'producto' then 'producto' else 'servicio' end,
  coalesce(s.item->>'activo', 'true') <> 'false',
  (s.ord - 1)::int,
  coalesce(nullif(s.item->>'icono', ''), '</>'),
  coalesce(nullif(s.item->>'nombre', ''), 'Servicio'),
  coalesce(s.item->>'resumen', ''),
  case when s.item->>'tono' in ('lila', 'rosa', 'oscuro', 'blanco') then s.item->>'tono' else 'lila' end,
  coalesce(s.item->>'imagen', '')
from contenido c
cross join lateral jsonb_array_elements(coalesce(c.data->'servicios', '[]'::jsonb)) with ordinality as s(item, ord)
where c.id = 'sitio' and coalesce(s.item->>'id', '') <> ''
on conflict (id) do nothing;

insert into oferta_detalles (id, oferta_id, clase, orden, titulo, texto)
select (s.item->>'id') || ':palabra:' || (p.ord - 1), s.item->>'id', 'palabra', (p.ord - 1)::int, '', p.texto
from contenido c
cross join lateral jsonb_array_elements(coalesce(c.data->'servicios', '[]'::jsonb)) as s(item)
cross join lateral jsonb_array_elements_text(coalesce(s.item->'palabras', '[]'::jsonb)) with ordinality as p(texto, ord)
where c.id = 'sitio' and coalesce(s.item->>'id', '') <> '' and p.texto <> ''
on conflict (id) do nothing;

insert into oferta_detalles (id, oferta_id, clase, orden, titulo, texto)
select (s.item->>'id') || ':pregunta:' || (p.ord - 1), s.item->>'id', 'pregunta', (p.ord - 1)::int, '', p.texto
from contenido c
cross join lateral jsonb_array_elements(coalesce(c.data->'servicios', '[]'::jsonb)) as s(item)
cross join lateral jsonb_array_elements_text(coalesce(s.item->'preguntas', '[]'::jsonb)) with ordinality as p(texto, ord)
where c.id = 'sitio' and coalesce(s.item->>'id', '') <> '' and p.texto <> ''
on conflict (id) do nothing;

insert into oferta_detalles (id, oferta_id, clase, orden, titulo, texto)
select (s.item->>'id') || ':detalle:' || (d.ord - 1), s.item->>'id', 'detalle', (d.ord - 1)::int,
  coalesce(d.item->>'titulo', ''), coalesce(d.item->>'texto', '')
from contenido c
cross join lateral jsonb_array_elements(coalesce(c.data->'servicios', '[]'::jsonb)) as s(item)
cross join lateral jsonb_array_elements(coalesce(s.item->'detalles', '[]'::jsonb)) with ordinality as d(item, ord)
where c.id = 'sitio' and coalesce(s.item->>'id', '') <> ''
  and (coalesce(d.item->>'titulo', '') <> '' or coalesce(d.item->>'texto', '') <> '')
on conflict (id) do nothing;

do $$
declare
  r record;
  cli text;
  cel text;
  est text;
  i int;
  resp jsonb;
  ts timestamptz;
begin
  if to_regclass('public.cotizaciones_json') is null then
    return;
  end if;
  for r in select id, data, creado_en from cotizaciones_json loop
    begin
      ts := nullif(r.data->>'creadoEn', '')::timestamptz;
    exception when others then
      ts := null;
    end;
    ts := coalesce(ts, r.creado_en, now());
    cel := regexp_replace(coalesce(r.data->>'celular', ''), '\D', '', 'g');
    if length(cel) >= 10 then
      cli := 'CL-' || right(cel, 10);
    else
      cli := 'CL-' || r.id;
    end if;
    est := case coalesce(r.data->>'estado', 'nueva')
      when 'en_curso' then 'cli-en-curso'
      when 'lista' then 'cli-lista'
      when 'descartada' then 'cli-descartada'
      else 'cli-nueva'
    end;
    insert into clientes (id, nombre, negocio, celular, correo, jid, origen, estado_id, nota, creado_en)
    values (
      cli,
      coalesce(nullif(r.data->>'nombre', ''), 'Sin nombre'),
      coalesce(r.data->>'negocio', ''),
      cel,
      coalesce(r.data->>'correo', ''),
      coalesce(r.data->>'jid', ''),
      case when r.data->>'origen' = 'whatsapp' then 'whatsapp' else 'pagina' end,
      est,
      coalesce(r.data->>'notaInterna', ''),
      ts
    )
    on conflict (id) do update set
      nombre = excluded.nombre,
      negocio = excluded.negocio,
      celular = excluded.celular,
      jid = excluded.jid,
      nota = excluded.nota,
      estado_id = excluded.estado_id,
      updated_at = now();

    insert into cotizaciones (
      id, cliente_id, oferta_id, oferta_nombre, origen, estado_id, mensaje, nota_interna, nombre, negocio, celular, jid, creado_en
    ) values (
      r.id,
      cli,
      case when exists (select 1 from ofertas o where o.id = r.data->>'servicioId') then r.data->>'servicioId' else null end,
      coalesce(r.data->>'servicioNombre', ''),
      case when r.data->>'origen' = 'whatsapp' then 'whatsapp' else 'pagina' end,
      est,
      coalesce(r.data->>'mensaje', ''),
      coalesce(r.data->>'notaInterna', ''),
      coalesce(nullif(r.data->>'nombre', ''), 'Sin nombre'),
      coalesce(r.data->>'negocio', ''),
      cel,
      coalesce(r.data->>'jid', ''),
      ts
    )
    on conflict (id) do nothing;

    i := 0;
    for resp in select value from jsonb_array_elements(coalesce(r.data->'respuestas', '[]'::jsonb)) loop
      insert into cliente_detalles (id, cliente_id, cotizacion_id, clase, orden, titulo, texto)
      values (
        r.id || ':r:' || i,
        cli,
        r.id,
        'respuesta',
        i,
        coalesce(resp->>'pregunta', ''),
        coalesce(resp->>'respuesta', '')
      )
      on conflict (id) do nothing;
      i := i + 1;
    end loop;
  end loop;
  drop table cotizaciones_json;
end $$;

alter table contenido enable row level security;
alter table estados enable row level security;
alter table ofertas enable row level security;
alter table oferta_detalles enable row level security;
alter table clientes enable row level security;
alter table cliente_detalles enable row level security;
alter table cotizaciones enable row level security;
alter table pedidos enable row level security;
alter table pedido_items enable row level security;
alter table equipos enable row level security;
alter table personas enable row level security;
alter table roles enable row level security;
alter table caracteristicas enable row level security;
alter table disponibilidades enable row level security;
alter table chats enable row level security;
alter table chat_miembros enable row level security;
alter table mensajes enable row level security;
alter table usuarios enable row level security;
alter table actividad_estados enable row level security;
alter table epicas enable row level security;
alter table sprints enable row level security;
alter table tareas enable row level security;
alter table notas enable row level security;

insert into storage.buckets (id, name, public)
values ('marca', 'marca', true)
on conflict (id) do update set public = true;

drop policy if exists "lectura publica marca" on storage.objects;
create policy "lectura publica marca"
on storage.objects for select
to public
using (bucket_id = 'marca');
