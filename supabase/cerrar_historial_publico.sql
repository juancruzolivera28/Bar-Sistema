-- ============================================================================
-- Cerrar la lectura publica de la tabla historial
-- ============================================================================
-- Correr en Supabase: SQL Editor > New query > pegar TODO > Run.
-- No modifica el esquema; agrega una RPC y ajusta permisos de historial.
--
-- PROBLEMA: hoy el rol anon (mozo, sin auth real) tiene SELECT sobre historial
-- con USING (true). Como la anon key esta en el bundle publico, cualquiera
-- puede leer el historial de ventas de CUALQUIER restaurante.
--
-- SOLUCION: se quita el SELECT del anon sobre historial y la pantalla Resumen
-- pasa a leer los datos del turno via esta RPC (SECURITY DEFINER), que
-- devuelve SOLO el resumen del turno de UN restaurante y ventana de tiempo.
--
-- El INSERT del anon (cierre de cuenta en DetalleMesa) NO se toca: insertar
-- no expone datos ajenos.
--
-- NOTA de firma: los parametros de tiempo son bigint (epoch en milisegundos),
-- no timestamptz, porque historial.fecha es bigint (Date.now()) y Resumen.jsx
-- ya calcula el inicio/fin del turno en milisegundos. Asi calcularTurno()
-- queda intacto en el cliente.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) RPC: resumen del turno (agregado, del lado del servidor)
-- ----------------------------------------------------------------------------
-- Devuelve un jsonb con exactamente lo que Resumen.jsx necesita:
--   {
--     cuentas: [ { fecha, total, detalle, metodo_pago }, ... ]  (del turno, desc)
--     totales: { efectivo, transferencia, tarjeta },
--     totalGeneral: number,
--     productos: { "<nombre>": <cantidad>, ... },
--     cantidadMesas: number,
--     ticketPromedio: number,
--     productoMasVendido: "<nombre>" | "-"
--   }
--
-- Es SECURITY DEFINER: puede leer historial aunque el que llama (anon) ya no
-- tenga SELECT. Solo lee las filas del p_restaurante_id y la ventana dada;
-- nunca expone la tabla entera.
create or replace function resumen_turno(
  p_restaurante_id uuid,
  p_desde bigint,
  p_hasta bigint
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with cuentas_turno as (
  select h.fecha, h.total, h.detalle, h.metodo_pago
  from historial h
  where h.restaurante_id = p_restaurante_id
    and h.fecha >= p_desde
    and h.fecha <  p_hasta
),
pagos as (
  select lower(pg->>'metodo')                 as metodo,
         coalesce((pg->>'monto')::numeric, 0)  as monto
  from cuentas_turno c
  cross join lateral jsonb_array_elements(c.metodo_pago) as pg
),
items as (
  select it->>'nombre'                           as nombre,
         coalesce((it->>'cantidad')::numeric, 0) as cantidad
  from cuentas_turno c
  cross join lateral jsonb_array_elements(c.detalle) as it
),
productos_agg as (
  select nombre, sum(cantidad) as cantidad
  from items
  where nombre is not null
  group by nombre
),
tot as (
  select coalesce(sum(total), 0) as total_general,
         count(*)                as cantidad_mesas
  from cuentas_turno
)
select jsonb_build_object(
  'cuentas', coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'fecha',       c.fecha,
               'total',       c.total,
               'detalle',     c.detalle,
               'metodo_pago', c.metodo_pago
             )
             order by c.fecha desc
           )
    from cuentas_turno c
  ), '[]'::jsonb),

  'totales', jsonb_build_object(
    'efectivo',      coalesce((select sum(monto) from pagos where metodo = 'efectivo'), 0),
    'transferencia', coalesce((select sum(monto) from pagos where metodo = 'transferencia'), 0),
    'tarjeta',       coalesce((select sum(monto) from pagos where metodo = 'tarjeta'), 0)
  ),

  'totalGeneral', (select total_general from tot),

  'productos', coalesce(
    (select jsonb_object_agg(nombre, cantidad) from productos_agg),
    '{}'::jsonb
  ),

  'cantidadMesas', (select cantidad_mesas from tot),

  'ticketPromedio', case
    when (select cantidad_mesas from tot) > 0
      then round((select total_general from tot) / (select cantidad_mesas from tot))
      else 0
  end,

  'productoMasVendido', coalesce(
    (select nombre from productos_agg order by cantidad desc, nombre asc limit 1),
    '-'
  )
);
$$;

-- La puede ejecutar el mozo (anon) y el dueño (authenticated). No requiere auth.uid().
revoke all on function resumen_turno(uuid, bigint, bigint) from public;
grant execute on function resumen_turno(uuid, bigint, bigint) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2) Cerrar el SELECT publico de historial
-- ----------------------------------------------------------------------------
-- Se saca la policy de lectura del anon y el privilegio SELECT del anon.
-- A partir de aca, un GET directo a /rest/v1/historial con la anon key
-- responde 403 "permission denied for table historial".
drop policy if exists "mozo: leer historial" on historial;
revoke select on table historial from anon;

-- Lo que NO se toca (el mozo lo sigue necesitando para cerrar cuentas):
--   * policy "mozo: insertar historial"  (anon, INSERT, with check true)
--   * grant insert on table historial to anon
-- Y el dueño (authenticated) sigue con acceso total via:
--   * policy "dueño: historial"  +  grant all ... to authenticated
--   -> Dashboard.jsx no cambia.
