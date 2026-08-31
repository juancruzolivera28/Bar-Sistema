-- ============================================================================
-- RPC: regenerar_codigo_restaurante()
-- ============================================================================
-- Genera un codigo_acceso NUEVO para el restaurante del dueño autenticado,
-- lo guarda en la tabla restaurantes y lo devuelve.
--
-- Correr en Supabase: SQL Editor > New query > pegar > Run.
-- No modifica nada del esquema, solo agrega esta funcion (idempotente por
-- create or replace).
--
-- Reusa generar_codigo_acceso() (la misma funcion que usa el registro de
-- restaurantes nuevos): 7 caracteres, mayusculas, sin 0/O ni 1/I, unico.
-- ============================================================================

create or replace function regenerar_codigo_restaurante()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_nuevo text;
begin
  if v_uid is null then
    raise exception 'No hay usuario autenticado';
  end if;

  -- El dueño solo puede tocar SU restaurante (relacion 1 a 1 por user_id).
  if not exists (select 1 from restaurantes where user_id = v_uid) then
    raise exception 'Este usuario no tiene un restaurante';
  end if;

  -- Mismo generador que el registro. Es SECURITY DEFINER, asi que el chequeo
  -- de unicidad ve TODOS los restaurantes (no lo limita la RLS del dueño).
  v_nuevo := generar_codigo_acceso();

  update restaurantes
  set codigo_acceso = v_nuevo
  where user_id = v_uid;

  return v_nuevo;
end;
$$;

-- Solo el dueño autenticado. El anon (mozo) no puede ejecutarla.
revoke all on function regenerar_codigo_restaurante() from public, anon;
grant execute on function regenerar_codigo_restaurante() to authenticated;
