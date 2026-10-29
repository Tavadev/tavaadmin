-- Pega esto en Supabase: SQL Editor → Run
-- Luego Project Settings → API: copia la URL y la clave service_role al .env
-- La clave service_role solo vive en el servidor. No la pongas en la página.

create table if not exists contenido (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists cotizaciones (
  id text primary key,
  data jsonb not null,
  creado_en timestamptz default now()
);

alter table contenido enable row level security;
alter table cotizaciones enable row level security;

insert into storage.buckets (id, name, public)
values ('marca', 'marca', true)
on conflict (id) do update set public = true;

drop policy if exists "lectura publica marca" on storage.objects;
create policy "lectura publica marca"
on storage.objects for select
to public
using (bucket_id = 'marca');
