-- ============================================================================
-- Esquema de Supabase para bar-sistema  (MULTI-TENANT / SaaS)
-- ============================================================================
-- Este archivo describe el esquema COMPLETO para una base nueva desde cero.
-- Para migrar una base single-tenant que ya tiene datos, usar en cambio
-- supabase/migracion_multitenant.sql (agrega restaurante_id sin romper datos).
--
-- Modelo: un usuario de Supabase Auth (el dueño) = un restaurante. Los mozos
-- no tienen cuenta; entran con el codigo_acceso del restaurante (guardado en
-- localStorage del dispositivo) y operan con la anon key.
-- ============================================================================

-- ==========================================================
-- Tablas
-- ==========================================================

create table if not exists restaurantes (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  codigo_acceso  text not null unique,
  user_id        uuid not null references auth.users(id) on delete cascade,
  fecha_creacion timestamptz not null default now(),
  cantidad_mesas integer not null default 0
);
create unique index if not exists idx_restaurantes_user_id on restaurantes(user_id);
create unique index if not exists idx_restaurantes_codigo   on restaurantes(codigo_acceso);

create table if not exists mesas (
  id             bigint generated always as identity primary key,
  numero         integer not null,
  estado         text not null default 'libre',
  nombre         text,
  fija           smallint not null default 1,
  restaurante_id uuid not null references restaurantes(id) on delete cascade
);

create table if not exists productos (
  id             bigint generated always as identity primary key,
  nombre         text not null,
  precio         numeric not null,
  stock          integer not null default 0,
  "stockMinimo"  integer not null default 0,
  restaurante_id uuid not null references restaurantes(id) on delete cascade
);

create table if not exists pedidos (
  id             bigint generated always as identity primary key,
  mesa_id        bigint not null references mesas(id) on delete cascade,
  producto_id    bigint not null references productos(id) on delete restrict,
  cantidad       integer not null default 1,
  "timestamp"    bigint not null,
  restaurante_id uuid not null references restaurantes(id) on delete cascade
);

create table if not exists historial (
  id             bigint generated always as identity primary key,
  mesa_id        bigint,
  total          numeric not null,
  fecha          bigint not null,
  detalle        jsonb not null default '[]'::jsonb,
  metodo_pago    jsonb not null default '[]'::jsonb,
  restaurante_id uuid not null references restaurantes(id) on delete cascade
);

create table if not exists gastos (
  id             bigint generated always as identity primary key,
  descripcion    text not null,
  monto          numeric not null,
  fecha          bigint not null,
  categoria      text not null,
  restaurante_id uuid not null references restaurantes(id) on delete cascade
);

create table if not exists configuracion (
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  clave          text not null,
  valor          text,
  primary key (restaurante_id, clave)
);

create index if not exists idx_mesas_restaurante        on mesas(restaurante_id);
create index if not exists idx_productos_restaurante    on productos(restaurante_id);
create index if not exists idx_pedidos_restaurante      on pedidos(restaurante_id);
create index if not exists idx_pedidos_mesa_id          on pedidos(mesa_id);
create index if not exists idx_historial_restaurante    on historial(restaurante_id);
create index if not exists idx_historial_fecha          on historial(fecha);
create index if not exists idx_gastos_restaurante       on gastos(restaurante_id);
create index if not exists idx_gastos_fecha             on gastos(fecha);

-- ==========================================================
-- Funciones
-- ==========================================================

-- ¿El restaurante rid pertenece al usuario autenticado? (helper de las policies)
create or replace function es_mi_restaurante(rid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from restaurantes r where r.id = rid and r.user_id = auth.uid());
$$;

-- Codigo de acceso de 7 caracteres, mayusculas, sin 0/O ni 1/I.
create or replace function generar_codigo_acceso()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidato text; i int;
begin
  loop
    candidato := '';
    for i in 1..7 loop
      candidato := candidato || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from restaurantes where codigo_acceso = candidato);
  end loop;
  return candidato;
end;
$$;

-- Crea el restaurante del usuario autenticado + sus mesas 1..N.
create or replace function crear_restaurante(p_nombre text, p_cantidad_mesas int)
returns restaurantes
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rest restaurantes;
  i int;
begin
  if v_uid is null then raise exception 'No hay usuario autenticado'; end if;
  if exists (select 1 from restaurantes where user_id = v_uid) then
    raise exception 'Este usuario ya tiene un restaurante';
  end if;
  if p_cantidad_mesas is null or p_cantidad_mesas < 1 or p_cantidad_mesas > 200 then
    raise exception 'cantidad_mesas fuera de rango (1..200)';
  end if;

  insert into restaurantes (nombre, codigo_acceso, user_id, cantidad_mesas)
  values (coalesce(nullif(trim(p_nombre), ''), 'Mi restaurante'),
          generar_codigo_acceso(), v_uid, p_cantidad_mesas)
  returning * into v_rest;

  for i in 1..p_cantidad_mesas loop
    insert into mesas (numero, estado, nombre, fija, restaurante_id)
    values (i, 'libre', null, 1, v_rest.id);
  end loop;

  return v_rest;
end;
$$;

-- Login de mozo: id + nombre del restaurante con ese codigo (sin exponer la tabla).
create or replace function buscar_restaurante_por_codigo(p_codigo text)
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public
as $$
  select r.id, r.nombre from restaurantes r
  where r.codigo_acceso = upper(trim(p_codigo)) limit 1;
$$;

revoke all on function crear_restaurante(text, int)    from public;
revoke all on function generar_codigo_acceso()         from public;
grant execute on function crear_restaurante(text, int) to authenticated;
grant execute on function generar_codigo_acceso()      to authenticated;
grant execute on function es_mi_restaurante(uuid)      to authenticated;
grant execute on function buscar_restaurante_por_codigo(text) to anon, authenticated;

-- ==========================================================
-- Row Level Security
-- ==========================================================
-- Dueño  = rol authenticated (Supabase Auth): acceso total SOLO a las filas
--          de su restaurante.
-- Mozo   = rol anon (anon key, sin login): acceso acotado a las tablas
--          operativas, SIN verificacion de identidad. gastos / configuracion
--          / restaurantes quedan cerrados para anon.

alter table restaurantes  enable row level security;
alter table mesas         enable row level security;
alter table productos     enable row level security;
alter table pedidos       enable row level security;
alter table historial     enable row level security;
alter table gastos        enable row level security;
alter table configuracion enable row level security;

-- restaurantes: solo el dueño, solo el suyo.
drop policy if exists "dueño: su restaurante" on restaurantes;
create policy "dueño: su restaurante" on restaurantes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- mesas
drop policy if exists "dueño: mesas"       on mesas;
drop policy if exists "mozo: leer mesas"   on mesas;
drop policy if exists "mozo: editar mesas" on mesas;
drop policy if exists "mozo: mesas"        on mesas;
create policy "dueño: mesas" on mesas for all to authenticated
  using (es_mi_restaurante(restaurante_id)) with check (es_mi_restaurante(restaurante_id));
-- Mozo: CRUD completo de mesas (leer, agregar/eliminar mesas extras, cambiar estado).
create policy "mozo: mesas" on mesas for all to anon using (true) with check (true);

-- productos
drop policy if exists "dueño: productos"      on productos;
drop policy if exists "mozo: leer productos"  on productos;
drop policy if exists "mozo: descontar stock" on productos;
create policy "dueño: productos" on productos for all to authenticated
  using (es_mi_restaurante(restaurante_id)) with check (es_mi_restaurante(restaurante_id));
create policy "mozo: leer productos"  on productos for select to anon using (true);
create policy "mozo: descontar stock" on productos for update to anon using (true) with check (true);

-- pedidos
drop policy if exists "dueño: pedidos" on pedidos;
drop policy if exists "mozo: pedidos"  on pedidos;
create policy "dueño: pedidos" on pedidos for all to authenticated
  using (es_mi_restaurante(restaurante_id)) with check (es_mi_restaurante(restaurante_id));
create policy "mozo: pedidos" on pedidos for all to anon using (true) with check (true);

-- historial
drop policy if exists "dueño: historial"         on historial;
drop policy if exists "mozo: leer historial"     on historial;
drop policy if exists "mozo: insertar historial" on historial;
create policy "dueño: historial" on historial for all to authenticated
  using (es_mi_restaurante(restaurante_id)) with check (es_mi_restaurante(restaurante_id));
create policy "mozo: leer historial"     on historial for select to anon using (true);
create policy "mozo: insertar historial" on historial for insert to anon with check (true);

-- gastos (solo dueño)
drop policy if exists "dueño: gastos" on gastos;
create policy "dueño: gastos" on gastos for all to authenticated
  using (es_mi_restaurante(restaurante_id)) with check (es_mi_restaurante(restaurante_id));

-- configuracion (solo dueño)
drop policy if exists "dueño: configuracion" on configuracion;
create policy "dueño: configuracion" on configuracion for all to authenticated
  using (es_mi_restaurante(restaurante_id)) with check (es_mi_restaurante(restaurante_id));

-- ==========================================================
-- GRANT / REVOKE  (defensa extra ademas de RLS)
-- ==========================================================
revoke all on table restaurantes  from anon;
revoke all on table gastos        from anon;
revoke all on table configuracion from anon;
grant  all on table restaurantes  to   authenticated;
grant  all on table gastos        to   authenticated;
grant  all on table configuracion to   authenticated;

grant all on table mesas, productos, pedidos, historial to authenticated;

revoke all on table mesas from anon;
grant  select, insert, update, delete on table mesas to anon;

revoke all on table pedidos from anon;
grant  select, insert, update, delete on table pedidos to anon;

revoke all on table historial from anon;
grant  select, insert on table historial to anon;

revoke all on table productos from anon;
grant  select on table productos to anon;
grant  update (stock) on table productos to anon;

-- ==========================================================
-- Realtime
-- ==========================================================
alter publication supabase_realtime add table mesas;
alter publication supabase_realtime add table productos;
alter publication supabase_realtime add table pedidos;
alter publication supabase_realtime add table historial;
alter publication supabase_realtime add table gastos;

-- REPLICA IDENTITY FULL: necesario para filtrar los eventos de Realtime por
-- restaurante_id (filter: restaurante_id=eq.<id>) desde el cliente.
alter table mesas     replica identity full;
alter table productos replica identity full;
alter table pedidos   replica identity full;
alter table historial replica identity full;
alter table gastos    replica identity full;
