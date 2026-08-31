-- ============================================================================
-- MIGRACION A MULTI-TENANT (SaaS)  -  bar-sistema
-- ============================================================================
-- Correr en Supabase: Project > SQL Editor > New query > pegar TODO > Run.
--
-- Esta migracion esta pensada para ejecutarse sobre la base ACTUAL de Vuelos
-- Bar SIN perder datos: la columna restaurante_id se agrega como NULLABLE.
-- Despues de hacer el backfill (ver "PASOS MANUALES VUELOS BAR" al final)
-- se corre la PARTE G para dejarla NOT NULL.
--
-- Orden:
--   PARTE A  tabla restaurantes
--   PARTE B  columna restaurante_id en las tablas de datos + indices
--   PARTE C  funciones auxiliares (RLS helper, generador de codigo, RPCs)
--   PARTE D  Row Level Security (policies)
--   PARTE E  GRANT / REVOKE de tabla y de columna
--   PARTE F  Realtime (replica identity para poder filtrar por restaurante)
--   PARTE G  NOT NULL  <-- correr recien DESPUES del backfill
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PARTE A: tabla restaurantes
-- ----------------------------------------------------------------------------
-- Un usuario de Supabase Auth (el dueño) = un restaurante. Relacion 1 a 1.
create table if not exists restaurantes (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  codigo_acceso  text not null unique,          -- lo usa el mozo para entrar
  user_id        uuid not null references auth.users(id) on delete cascade,
  fecha_creacion timestamptz not null default now(),
  cantidad_mesas integer not null default 0
);

-- 1 restaurante por usuario.
create unique index if not exists idx_restaurantes_user_id on restaurantes(user_id);
-- Busqueda por codigo (login de mozo).
create unique index if not exists idx_restaurantes_codigo   on restaurantes(codigo_acceso);

alter table restaurantes enable row level security;


-- ----------------------------------------------------------------------------
-- PARTE B: restaurante_id en todas las tablas de datos
-- ----------------------------------------------------------------------------
-- NULLABLE a proposito: las filas que ya existen (Vuelos Bar) quedan con NULL
-- hasta el backfill. El on delete cascade borra los datos de un restaurante
-- si se elimina el restaurante.
alter table mesas         add column if not exists restaurante_id uuid references restaurantes(id) on delete cascade;
alter table productos     add column if not exists restaurante_id uuid references restaurantes(id) on delete cascade;
alter table pedidos       add column if not exists restaurante_id uuid references restaurantes(id) on delete cascade;
alter table historial     add column if not exists restaurante_id uuid references restaurantes(id) on delete cascade;
alter table gastos        add column if not exists restaurante_id uuid references restaurantes(id) on delete cascade;
alter table configuracion add column if not exists restaurante_id uuid references restaurantes(id) on delete cascade;

create index if not exists idx_mesas_restaurante        on mesas(restaurante_id);
create index if not exists idx_productos_restaurante    on productos(restaurante_id);
create index if not exists idx_pedidos_restaurante      on pedidos(restaurante_id);
create index if not exists idx_historial_restaurante    on historial(restaurante_id);
create index if not exists idx_gastos_restaurante       on gastos(restaurante_id);
create index if not exists idx_configuracion_restaurante on configuracion(restaurante_id);


-- ----------------------------------------------------------------------------
-- PARTE C: funciones auxiliares
-- ----------------------------------------------------------------------------

-- es_mi_restaurante(rid): true si el restaurante rid pertenece al usuario
-- autenticado. La usan TODAS las policies del dueño. SECURITY DEFINER +
-- search_path fijo para que no dependa de la RLS de restaurantes ni del
-- search_path de quien la llame.
create or replace function es_mi_restaurante(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from restaurantes r
    where r.id = rid and r.user_id = auth.uid()
  );
$$;

-- generar_codigo_acceso(): codigo de 7 caracteres en mayusculas, SIN
-- caracteres ambiguos (sin 0/O ni 1/I). Reintenta hasta encontrar uno libre.
create or replace function generar_codigo_acceso()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidato text;
  i int;
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

-- crear_restaurante(nombre, cantidad_mesas): la llama el front DESPUES de
-- supabase.auth.signUp(). Crea el restaurante del usuario autenticado y sus
-- mesas 1..N (estado 'libre', fija=1, mismo patron que las mesas fijas de
-- Vuelos Bar). SECURITY DEFINER para poder insertar salteando RLS, pero
-- exige usuario autenticado y que todavia no tenga restaurante (1 a 1).
create or replace function crear_restaurante(p_nombre text, p_cantidad_mesas int)
returns restaurantes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_rest restaurantes;
  i int;
begin
  if v_uid is null then
    raise exception 'No hay usuario autenticado';
  end if;
  if exists (select 1 from restaurantes where user_id = v_uid) then
    raise exception 'Este usuario ya tiene un restaurante';
  end if;
  if p_cantidad_mesas is null or p_cantidad_mesas < 1 or p_cantidad_mesas > 200 then
    raise exception 'cantidad_mesas fuera de rango (1..200)';
  end if;

  insert into restaurantes (nombre, codigo_acceso, user_id, cantidad_mesas)
  values (
    coalesce(nullif(trim(p_nombre), ''), 'Mi restaurante'),
    generar_codigo_acceso(),
    v_uid,
    p_cantidad_mesas
  )
  returning * into v_rest;

  for i in 1..p_cantidad_mesas loop
    insert into mesas (numero, estado, nombre, fija, restaurante_id)
    values (i, 'libre', null, 1, v_rest.id);
  end loop;

  return v_rest;
end;
$$;

-- buscar_restaurante_por_codigo(codigo): login del mozo. Devuelve solo id y
-- nombre del restaurante que tenga ese codigo. SECURITY DEFINER para que el
-- rol anon NO necesite SELECT sobre restaurantes: asi no se expone user_id
-- ni el listado completo de codigos a cualquiera que tenga la anon key.
create or replace function buscar_restaurante_por_codigo(p_codigo text)
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.nombre
  from restaurantes r
  where r.codigo_acceso = upper(trim(p_codigo))
  limit 1;
$$;

-- Permisos de ejecucion de las funciones
revoke all on function crear_restaurante(text, int)      from public;
revoke all on function generar_codigo_acceso()           from public;
grant execute on function crear_restaurante(text, int)   to authenticated;      -- solo dueño logueado
grant execute on function generar_codigo_acceso()        to authenticated;
grant execute on function es_mi_restaurante(uuid)        to authenticated;
grant execute on function buscar_restaurante_por_codigo(text) to anon, authenticated;  -- mozo (anon) + dueño


-- ----------------------------------------------------------------------------
-- PARTE D: Row Level Security
-- ----------------------------------------------------------------------------
-- Modelo:
--   * Dueño  = rol 'authenticated' (Supabase Auth). Acceso TOTAL pero solo a
--     las filas de SU restaurante (es_mi_restaurante(restaurante_id)).
--   * Mozo   = rol 'anon' (anon key, sin login real). Acceso ACOTADO y sin
--     verificacion de identidad, al mismo nivel que la app tiene hoy. El
--     filtro por restaurante lo pone el cliente (localStorage); RLS no puede
--     confiar en eso, por eso lo unico que se protege de verdad es NO darle
--     al anon acceso a las tablas sensibles (gastos, configuracion,
--     restaurantes).
--
-- Las policies son permisivas (se combinan con OR). anon y authenticated son
-- roles distintos: una policy "to anon" NO aplica al dueño y viceversa.

-- Sacar las policies viejas de acceso total (single-tenant)
drop policy if exists "anon acceso total" on mesas;
drop policy if exists "anon acceso total" on productos;
drop policy if exists "anon acceso total" on pedidos;
drop policy if exists "anon acceso total" on historial;
drop policy if exists "anon acceso total" on gastos;
drop policy if exists "anon acceso total" on configuracion;

-- ===== restaurantes =====
-- El dueño ve y edita unicamente su propio restaurante.
drop policy if exists "dueño: su restaurante" on restaurantes;
create policy "dueño: su restaurante" on restaurantes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- El anon NO tiene ninguna policy sobre restaurantes: el login de mozo pasa
-- por la funcion buscar_restaurante_por_codigo (SECURITY DEFINER).

-- ===== mesas =====
drop policy if exists "dueño: mesas"       on mesas;
drop policy if exists "mozo: leer mesas"   on mesas;
drop policy if exists "mozo: editar mesas" on mesas;
drop policy if exists "mozo: mesas"        on mesas;
-- Dueño: todo, solo sus mesas.
create policy "dueño: mesas" on mesas
  for all to authenticated
  using (es_mi_restaurante(restaurante_id))
  with check (es_mi_restaurante(restaurante_id));
-- Mozo: CRUD completo de mesas (leer, agregar y eliminar mesas extras,
-- cambiar estado), igual que la app single-tenant. Sin verificacion de identidad.
create policy "mozo: mesas" on mesas
  for all to anon using (true) with check (true);

-- ===== productos =====
drop policy if exists "dueño: productos"        on productos;
drop policy if exists "mozo: leer productos"    on productos;
drop policy if exists "mozo: descontar stock"   on productos;
-- Dueño: todo, solo sus productos.
create policy "dueño: productos" on productos
  for all to authenticated
  using (es_mi_restaurante(restaurante_id))
  with check (es_mi_restaurante(restaurante_id));
-- Mozo: leer productos (precios/stock para la comanda) y actualizar. El
-- update queda ademas limitado por GRANT a la sola columna stock (PARTE E),
-- que es lo que se descuenta al cerrar una cuenta.
create policy "mozo: leer productos" on productos
  for select to anon using (true);
create policy "mozo: descontar stock" on productos
  for update to anon using (true) with check (true);

-- ===== pedidos =====
drop policy if exists "dueño: pedidos" on pedidos;
drop policy if exists "mozo: pedidos"  on pedidos;
-- Dueño: todo, solo sus pedidos.
create policy "dueño: pedidos" on pedidos
  for all to authenticated
  using (es_mi_restaurante(restaurante_id))
  with check (es_mi_restaurante(restaurante_id));
-- Mozo: CRUD completo de la comanda (tomar, editar, borrar renglones).
create policy "mozo: pedidos" on pedidos
  for all to anon using (true) with check (true);

-- ===== historial =====
drop policy if exists "dueño: historial"          on historial;
drop policy if exists "mozo: leer historial"      on historial;
drop policy if exists "mozo: insertar historial"  on historial;
-- Dueño: todo, solo su historial.
create policy "dueño: historial" on historial
  for all to authenticated
  using (es_mi_restaurante(restaurante_id))
  with check (es_mi_restaurante(restaurante_id));
-- Mozo: insertar (cierre de cuenta) y leer (pantalla Resumen del turno).
-- NO puede modificar ni borrar cuentas ya cerradas.
create policy "mozo: leer historial" on historial
  for select to anon using (true);
create policy "mozo: insertar historial" on historial
  for insert to anon with check (true);

-- ===== gastos =====  (SOLO dueño, requiere auth)
drop policy if exists "dueño: gastos" on gastos;
create policy "dueño: gastos" on gastos
  for all to authenticated
  using (es_mi_restaurante(restaurante_id))
  with check (es_mi_restaurante(restaurante_id));
-- Sin policy para anon => el mozo no ve ni toca gastos.

-- ===== configuracion =====  (SOLO dueño, requiere auth)
drop policy if exists "dueño: configuracion" on configuracion;
create policy "dueño: configuracion" on configuracion
  for all to authenticated
  using (es_mi_restaurante(restaurante_id))
  with check (es_mi_restaurante(restaurante_id));
-- Sin policy para anon.


-- ----------------------------------------------------------------------------
-- PARTE E: GRANT / REVOKE  (defensa extra ademas de RLS)
-- ----------------------------------------------------------------------------
-- RLS decide QUE FILAS; los GRANT deciden QUE OPERACIONES/COLUMNAS puede
-- tocar cada rol. Aca ajustamos el anon a lo minimo.

-- Tablas 100% privadas del dueño: el anon no debe tener ningun permiso.
revoke all on table restaurantes  from anon;
revoke all on table gastos        from anon;
revoke all on table configuracion from anon;
grant  all on table restaurantes  to   authenticated;
grant  all on table gastos        to   authenticated;
grant  all on table configuracion to   authenticated;

-- Tablas operativas: el dueño (authenticated) tiene todo.
grant all on table mesas, productos, pedidos, historial to authenticated;

-- anon / mesas: CRUD completo (leer, agregar/eliminar mesas extras, cambiar estado).
revoke all    on table mesas from anon;
grant  select, insert, update, delete on table mesas to anon;

-- anon / pedidos: CRUD completo de la comanda.
revoke all    on table pedidos from anon;
grant  select, insert, update, delete on table pedidos to anon;

-- anon / historial: leer + insertar. No update/delete.
revoke all    on table historial from anon;
grant  select, insert on table historial to anon;

-- anon / productos: leer todo; actualizar SOLO la columna stock.
revoke all    on table productos from anon;
grant  select on table productos to anon;
grant  update (stock) on table productos to anon;


-- ----------------------------------------------------------------------------
-- PARTE F: Realtime
-- ----------------------------------------------------------------------------
-- Las tablas ya estan en la publication supabase_realtime (schema single-tenant).
-- Para poder FILTRAR los eventos por restaurante_id desde el cliente
-- (filter: restaurante_id=eq.<id>), la columna tiene que estar en la
-- "replica identity" de la tabla. La forma simple es REPLICA IDENTITY FULL.
alter table mesas     replica identity full;
alter table productos replica identity full;
alter table pedidos   replica identity full;
alter table historial replica identity full;
alter table gastos    replica identity full;

-- (opcional) exponer restaurantes por Realtime al dueño:
-- alter publication supabase_realtime add table restaurantes;


-- ============================================================================
-- PASOS MANUALES  -  MIGRAR "VUELOS BAR" AL NUEVO ESQUEMA
-- ============================================================================
-- Hacelos DESPUES de correr PARTE A..F y ANTES de PARTE G.
--
-- 1) Crear el usuario dueño:
--    Supabase Dashboard > Authentication > Users > "Add user"
--      - Email:    tu email
--      - Password: la que quieras
--      - Marcar "Auto Confirm User"
--    Copiar el "User UID" que queda listado.
--
--    (Ademas: Authentication > Providers > Email > desactivar "Confirm email"
--     para que el registro de nuevos dueños desde la app entre directo sin
--     mail de confirmacion. Si lo dejas activo, el signUp no da sesion y no
--     se puede crear el restaurante en el momento.)
--
-- 2) Crear el restaurante de Vuelos Bar (reemplazar <USER_UID>):
--
--      insert into restaurantes (nombre, codigo_acceso, user_id, cantidad_mesas)
--      values ('Vuelos Bar', 'VUELO7X', '<USER_UID>', 25)
--      returning id;
--
--    Copiar el id devuelto  ->  <RID>  (es el restaurante_id de Vuelos Bar).
--    ('VUELO7X' es el codigo que va a usar el mozo. Podes poner otro, 6-8
--     alfanumericos en mayusculas, sin 0/O ni 1/I.)
--
-- 3) Backfill: TODAS las filas actuales son de Vuelos Bar. Reemplazar <RID>:
--
--      update mesas         set restaurante_id = '<RID>' where restaurante_id is null;
--      update productos     set restaurante_id = '<RID>' where restaurante_id is null;
--      update pedidos       set restaurante_id = '<RID>' where restaurante_id is null;
--      update historial     set restaurante_id = '<RID>' where restaurante_id is null;
--      update gastos        set restaurante_id = '<RID>' where restaurante_id is null;
--      update configuracion set restaurante_id = '<RID>' where restaurante_id is null;
--
-- 4) Verificar que no quedo nada sin asignar (todas deben dar 0):
--
--      select count(*) from mesas         where restaurante_id is null;
--      select count(*) from productos     where restaurante_id is null;
--      select count(*) from pedidos       where restaurante_id is null;
--      select count(*) from historial     where restaurante_id is null;
--      select count(*) from gastos        where restaurante_id is null;
--      select count(*) from configuracion where restaurante_id is null;
--
-- 5) (opcional) borrar la fila muerta del PIN viejo:
--      delete from configuracion where clave = 'pin_dueno';
--
-- 6) Correr PARTE G (abajo).
--
-- 7) En el celular del mozo: entrar una vez con el codigo 'VUELO7X'.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PARTE G: NOT NULL  (correr SOLO despues del backfill del paso 3)
-- ----------------------------------------------------------------------------
alter table mesas     alter column restaurante_id set not null;
alter table productos alter column restaurante_id set not null;
alter table pedidos   alter column restaurante_id set not null;
alter table historial alter column restaurante_id set not null;
alter table gastos    alter column restaurante_id set not null;

-- configuracion: ademas de NOT NULL, la PK pasa a ser compuesta
-- (restaurante_id, clave) para que dos restaurantes puedan tener la misma clave.
alter table configuracion alter column restaurante_id set not null;
alter table configuracion drop constraint configuracion_pkey;
alter table configuracion add  primary key (restaurante_id, clave);
