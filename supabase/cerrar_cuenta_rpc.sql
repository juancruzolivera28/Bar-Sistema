-- ============================================================================
-- RPC: cerrar_cuenta  -  cierre de cuenta de una mesa en UNA transaccion
-- ============================================================================
-- Correr en Supabase: SQL Editor > New query > pegar TODO > Run.
-- Agrega una funcion; NO modifica el esquema de tablas.
--
-- Reemplaza la cadena de ~2N+3 llamadas que hacia el cliente (insert historial,
-- N updates de stock, select pedidos, N deletes de pedidos, update mesas) por
-- una sola llamada transaccional. Mismo patron que resumen_turno /
-- crear_restaurante / buscar_restaurante_por_codigo.
--
-- Garantias:
--   * ATOMICA: una funcion PL/pgSQL corre dentro de la transaccion del
--     statement que la invoca. Si cualquier paso lanza excepcion y no la
--     captura un bloque BEGIN..EXCEPTION (a proposito NO se usa uno), TODA la
--     funcion se revierte: no hay commit parcial. Imposible que quede stock
--     descontado sin historial, o pedidos borrados sin cierre registrado.
--   * total y detalle se calculan DEL LADO DEL SERVIDOR leyendo pedidos join
--     productos: el cliente no puede falsificar el registro de venta.
--   * stock se descuenta con  stock = stock - cantidad  sobre el valor real de
--     la fila (no un valor cacheado en el cliente): sin perdida de updates
--     concurrentes de otros dispositivos.
--   * Todo va scopeado por restaurante_id: no se puede cerrar la mesa de otro
--     tenant pasando un mesa_id ajeno (los id de mesas son bigint global).
--   * Si la mesa no tiene pedidos -> excepcion. Esto tambien frena un segundo
--     tap que llegue despues de que el primer cierre ya borro los pedidos: no
--     se crea un historial duplicado (backstop server-side del doble submit).
--
-- fecha: se calcula server-side como epoch en milisegundos, igual formato que
-- Date.now() que usa el resto de la app y que espera resumen_turno.
--
-- Decisiones (ver conversacion de diseño):
--   * El stock PUEDE quedar negativo, igual que el cliente actual (sin clamp).
--   * detalle se agrupa por producto: una linea por producto, cantidad sumada.
--   * metodo_pago se valida solo como "array jsonb no vacio". La reconciliacion
--     sum(monto) == total queda como endurecimiento futuro (ModalPago ya lo
--     fuerza en el cliente con falta === 0).
-- ============================================================================

create or replace function cerrar_cuenta(
  p_mesa_id        bigint,
  p_restaurante_id uuid,
  p_metodo_pago    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha        bigint := (extract(epoch from now()) * 1000)::bigint;
  v_total        numeric;
  v_detalle      jsonb;
  v_historial_id bigint;
begin
  -- 0) Validaciones -----------------------------------------------------------
  if p_mesa_id is null or p_restaurante_id is null then
    raise exception 'Faltan parametros (mesa_id / restaurante_id)';
  end if;

  if jsonb_typeof(p_metodo_pago) is distinct from 'array' then
    raise exception 'metodo_pago invalido: se espera un array jsonb';
  end if;
  if jsonb_array_length(p_metodo_pago) = 0 then
    raise exception 'metodo_pago vacio';
  end if;

  if not exists (
    select 1 from mesas
    where id = p_mesa_id and restaurante_id = p_restaurante_id
  ) then
    raise exception 'Mesa % no encontrada para este restaurante', p_mesa_id;
  end if;

  -- a) Detalle + total, calculados server-side (pedidos join productos),
  --    agrupados por producto (una linea por producto, cantidad sumada).
  select
    coalesce(sum(x.cantidad * pr.precio), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'nombre',   pr.nombre,
          'cantidad', x.cantidad,
          'precio',   pr.precio
        )
        order by pr.nombre
      ),
      '[]'::jsonb
    )
  into v_total, v_detalle
  from (
    select producto_id, sum(cantidad)::int as cantidad
    from pedidos
    where mesa_id = p_mesa_id and restaurante_id = p_restaurante_id
    group by producto_id
  ) x
  join productos pr on pr.id = x.producto_id;

  if v_detalle = '[]'::jsonb then
    raise exception 'La mesa % no tiene pedidos', p_mesa_id;
  end if;

  -- b) Registrar la venta en historial con los valores recien calculados.
  insert into historial (mesa_id, restaurante_id, total, fecha, detalle, metodo_pago)
  values (p_mesa_id, p_restaurante_id, v_total, v_fecha, v_detalle, p_metodo_pago)
  returning id into v_historial_id;

  -- c) Descontar stock de forma atomica: stock = stock - cantidad, sobre el
  --    valor real de la fila (patron UPDATE ... FROM).
  update productos p
  set stock = p.stock - x.cantidad
  from (
    select producto_id, sum(cantidad)::int as cantidad
    from pedidos
    where mesa_id = p_mesa_id and restaurante_id = p_restaurante_id
    group by producto_id
  ) x
  where p.id = x.producto_id
    and p.restaurante_id = p_restaurante_id;

  -- d) Borrar todos los pedidos de la mesa.
  delete from pedidos
  where mesa_id = p_mesa_id and restaurante_id = p_restaurante_id;

  -- e) Liberar la mesa.
  update mesas set estado = 'libre'
  where id = p_mesa_id and restaurante_id = p_restaurante_id;

  return jsonb_build_object(
    'historial_id', v_historial_id,
    'total',        v_total,
    'fecha',        v_fecha
  );
end;
$$;

-- Permisos: mismo criterio que resumen_turno / buscar_restaurante_por_codigo.
-- El mozo (anon, sin auth real) es quien cierra cuentas hoy; darle execute NO
-- es escalar privilegios (ya tiene los grants crudos de tabla para hacer lo
-- mismo), y esta via es MAS segura: total/detalle server-side, todo scopeado
-- por restaurante_id, y guard de "mesa sin pedidos".
revoke all on function cerrar_cuenta(bigint, uuid, jsonb) from public;
grant execute on function cerrar_cuenta(bigint, uuid, jsonb) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- PASO 2 (OPCIONAL) - endurecer grants. Correr POR SEPARADO y DESPUES de
-- verificar en produccion que todos los cierres pasan por cerrar_cuenta.
-- ----------------------------------------------------------------------------
-- Una vez que confirmarPago usa la RPC, el cierre de cuenta es el UNICO uso
-- que hace el rol anon de:
--    * insert on historial          (policy "mozo: insertar historial")
--    * update (stock) on productos  (policy "mozo: descontar stock")
-- Revocarlos fuerza que TODO registro de venta y TODO descuento de stock por
-- venta pase por la funcion (SECURITY DEFINER, no necesita el grant del que
-- llama). Asi una anon key filtrada no puede fabricar ventas ni reescribir
-- stock directo.
--
-- NO se puede hacer lo mismo con pedidos / mesas: agregar y quitar productos
-- del pedido (agregarProducto / quitarProducto) y agregar / eliminar mesas
-- extra siguen necesitando insert/update/delete crudos de anon sobre esas dos
-- tablas.
--
-- No se corre ahora para no romper clientes con bundle viejo en cache que
-- todavia hagan la cadena directa. Correr como migracion aparte:
--
--   drop policy if exists "mozo: insertar historial" on historial;
--   revoke insert on table historial from anon;
--
--   drop policy if exists "mozo: descontar stock" on productos;
--   revoke update (stock) on table productos from anon;
-- ----------------------------------------------------------------------------
