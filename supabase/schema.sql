-- Esquema de Supabase para bar-sistema
-- Ejecutar completo en el SQL Editor de Supabase (Project > SQL Editor > New query)

-- ==========================================================
-- Tablas
-- ==========================================================

create table if not exists mesas (
  id bigint generated always as identity primary key,
  numero integer not null,
  estado text not null default 'libre',
  nombre text,
  fija smallint not null default 1
);

create table if not exists productos (
  id bigint generated always as identity primary key,
  nombre text not null,
  precio numeric not null,
  stock integer not null default 0,
  "stockMinimo" integer not null default 0
);

create table if not exists pedidos (
  id bigint generated always as identity primary key,
  mesa_id bigint not null references mesas(id) on delete cascade,
  producto_id bigint not null references productos(id) on delete restrict,
  cantidad integer not null default 1,
  "timestamp" bigint not null
);

create table if not exists historial (
  id bigint generated always as identity primary key,
  mesa_id bigint,
  total numeric not null,
  fecha bigint not null,
  detalle jsonb not null default '[]'::jsonb,
  metodo_pago jsonb not null default '[]'::jsonb
);

create table if not exists configuracion (
  clave text primary key,
  valor text
);

create index if not exists idx_pedidos_mesa_id on pedidos(mesa_id);
create index if not exists idx_historial_fecha on historial(fecha);

-- ==========================================================
-- Row Level Security
-- La app usa la clave "anon" para todos los dispositivos (login es solo
-- a nivel de UI con PIN, no hay Supabase Auth). Estas políticas permiten
-- lectura/escritura total con la clave anon, equivalente al acceso que
-- ya tenía cada dispositivo sobre su propia IndexedDB.
-- ==========================================================

alter table mesas enable row level security;
alter table productos enable row level security;
alter table pedidos enable row level security;
alter table historial enable row level security;
alter table configuracion enable row level security;

drop policy if exists "anon acceso total" on mesas;
create policy "anon acceso total" on mesas for all using (true) with check (true);

drop policy if exists "anon acceso total" on productos;
create policy "anon acceso total" on productos for all using (true) with check (true);

drop policy if exists "anon acceso total" on pedidos;
create policy "anon acceso total" on pedidos for all using (true) with check (true);

drop policy if exists "anon acceso total" on historial;
create policy "anon acceso total" on historial for all using (true) with check (true);

drop policy if exists "anon acceso total" on configuracion;
create policy "anon acceso total" on configuracion for all using (true) with check (true);

-- ==========================================================
-- Realtime
-- Alternativa a hacer esto a mano en Database > Replication.
-- ==========================================================

alter publication supabase_realtime add table mesas;
alter publication supabase_realtime add table productos;
alter publication supabase_realtime add table pedidos;
alter publication supabase_realtime add table historial;

-- ==========================================================
-- Datos iniciales (equivalentes a insertarDatosInicialesSeNecesario)
-- Solo insertan si las tablas están vacías.
-- ==========================================================

insert into mesas (numero, estado, nombre, fija)
select v.numero, 'libre', null, 1
from (values (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
             (11),(12),(13),(14),(15),(16),(17),(18),
             (19),(20),(21),(22),(23),(24),(25)) as v(numero)
where not exists (select 1 from mesas);

insert into mesas (numero, estado, nombre, fija)
select 0, 'libre', 'Barra', 1
where not exists (select 1 from mesas where nombre = 'Barra');

insert into productos (nombre, precio, stock, "stockMinimo")
select v.nombre, v.precio, v.stock, v."stockMinimo"
from (values
  ('Coca Cola', 1500, 24, 6),
  ('Agua', 800, 20, 4),
  ('Cerveza', 2000, 30, 8),
  ('Fernet', 2500, 15, 3),
  ('Papas fritas', 1800, 10, 2)
) as v(nombre, precio, stock, "stockMinimo")
where not exists (select 1 from productos);

insert into configuracion (clave, valor)
values ('pin_dueno', '1234')
on conflict (clave) do nothing;
