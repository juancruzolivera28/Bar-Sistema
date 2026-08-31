import { supabase } from './supabaseClient.js'

const CLAVES_PRIMARIAS = {
  mesas: 'id',
  productos: 'id',
  pedidos: 'id',
  historial: 'id',
  gastos: 'id',
  configuracion: 'clave',
  restaurantes: 'id'
}

// Tablas que llevan restaurante_id: todas las consultas se filtran por el
// restaurante activo y los INSERT lo inyectan automaticamente.
// 'restaurantes' NO va aca (se consulta directo por user_id desde App.jsx).
const TABLAS_CON_RESTAURANTE = new Set([
  'mesas', 'productos', 'pedidos', 'historial', 'gastos', 'configuracion'
])

// restaurante_id del tenant activo (dueño logueado o mozo con codigo guardado
// en localStorage). Lo fija App.jsx en el arranque, una sola vez, ANTES de
// montar cualquier pantalla. Es el unico punto donde se aplica el filtro
// multi-tenant: asi ningun componente puede olvidarse de filtrar.
let restauranteIdActivo = null

export function setRestauranteId(id) {
  restauranteIdActivo = id || null
}

export function getRestauranteId() {
  return restauranteIdActivo
}

function aplicaRestaurante(storeName) {
  return TABLAS_CON_RESTAURANTE.has(storeName) && restauranteIdActivo != null
}

let onError = null

export function setOnError(handler) {
  onError = handler
}

function manejarError(accion, error) {
  console.error(`Error en ${accion}:`, error)
  const detalle = error?.message ? ` (${error.message})` : ''
  const mensaje = navigator.onLine
    ? `No se pudo conectar con el servidor.${detalle} Intentá de nuevo.`
    : 'Sin conexión a internet. Los cambios no se guardaron.'
  if (onError) onError(mensaje)
  throw error
}

export async function initDB() {
  if (!supabase) {
    manejarError('conexión inicial', new Error('Cliente de Supabase no configurado (faltan variables de entorno).'))
  }
  // Ping de conectividad. 'mesas' tiene lectura abierta para anon, sirve como
  // check aunque todavia no haya restaurante activo.
  const { error } = await supabase.from('mesas').select('id').limit(1)
  if (error) {
    manejarError('conexión inicial', error)
  }
  return true
}

export async function getAll(storeName) {
  let consulta = supabase.from(storeName).select('*')
  if (aplicaRestaurante(storeName)) {
    consulta = consulta.eq('restaurante_id', restauranteIdActivo)
  }
  const { data, error } = await consulta
  if (error) manejarError(`getAll ${storeName}`, error)
  return data
}

export async function getByIndex(storeName, indexName, value) {
  let consulta = supabase.from(storeName).select('*').eq(indexName, value)
  if (aplicaRestaurante(storeName)) {
    consulta = consulta.eq('restaurante_id', restauranteIdActivo)
  }
  const { data, error } = await consulta
  if (error) manejarError(`getByIndex ${storeName}`, error)
  return data
}

export async function getOne(storeName, key) {
  const clave = CLAVES_PRIMARIAS[storeName] || 'id'
  let consulta = supabase.from(storeName).select('*').eq(clave, key)
  if (aplicaRestaurante(storeName)) {
    consulta = consulta.eq('restaurante_id', restauranteIdActivo)
  }
  const { data, error } = await consulta.maybeSingle()
  if (error) manejarError(`getOne ${storeName}`, error)
  return data
}

export async function agregar(storeName, data) {
  const payload = aplicaRestaurante(storeName)
    ? { ...data, restaurante_id: data.restaurante_id ?? restauranteIdActivo }
    : data
  const { data: insertado, error } = await supabase.from(storeName).insert(payload).select().single()
  if (error) manejarError(`agregar ${storeName}`, error)
  const clave = CLAVES_PRIMARIAS[storeName] || 'id'
  return insertado[clave]
}

export async function actualizar(storeName, data) {
  const clave = CLAVES_PRIMARIAS[storeName] || 'id'
  const valorClave = data[clave]
  const resto = { ...data }
  delete resto[clave]
  // El tenant de una fila nunca se cambia por un UPDATE.
  delete resto.restaurante_id
  let consulta = supabase.from(storeName).update(resto).eq(clave, valorClave)
  if (aplicaRestaurante(storeName)) {
    consulta = consulta.eq('restaurante_id', restauranteIdActivo)
  }
  const { error } = await consulta
  if (error) manejarError(`actualizar ${storeName}`, error)
  return valorClave
}

export async function eliminar(storeName, key) {
  const clave = CLAVES_PRIMARIAS[storeName] || 'id'
  let consulta = supabase.from(storeName).delete().eq(clave, key)
  if (aplicaRestaurante(storeName)) {
    consulta = consulta.eq('restaurante_id', restauranteIdActivo)
  }
  const { error } = await consulta
  if (error) manejarError(`eliminar ${storeName}`, error)
  return key
}
