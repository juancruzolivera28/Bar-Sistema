import { supabase } from './supabaseClient.js'

const CLAVES_PRIMARIAS = {
  mesas: 'id',
  productos: 'id',
  pedidos: 'id',
  historial: 'id',
  gastos: 'id',
  configuracion: 'clave'
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
  const { error } = await supabase.from('configuracion').select('clave').limit(1)
  if (error) {
    manejarError('conexión inicial', error)
  }
  return true
}

export async function getAll(storeName) {
  const { data, error } = await supabase.from(storeName).select('*')
  if (error) manejarError(`getAll ${storeName}`, error)
  return data
}

export async function getByIndex(storeName, indexName, value) {
  const { data, error } = await supabase.from(storeName).select('*').eq(indexName, value)
  if (error) manejarError(`getByIndex ${storeName}`, error)
  return data
}

export async function getOne(storeName, key) {
  const clave = CLAVES_PRIMARIAS[storeName] || 'id'
  const { data, error } = await supabase.from(storeName).select('*').eq(clave, key).maybeSingle()
  if (error) manejarError(`getOne ${storeName}`, error)
  return data
}

export async function agregar(storeName, data) {
  const { data: insertado, error } = await supabase.from(storeName).insert(data).select().single()
  if (error) manejarError(`agregar ${storeName}`, error)
  const clave = CLAVES_PRIMARIAS[storeName] || 'id'
  return insertado[clave]
}

export async function actualizar(storeName, data) {
  const clave = CLAVES_PRIMARIAS[storeName] || 'id'
  const valorClave = data[clave]
  const resto = { ...data }
  delete resto[clave]
  const { error } = await supabase.from(storeName).update(resto).eq(clave, valorClave)
  if (error) manejarError(`actualizar ${storeName}`, error)
  return valorClave
}

export async function eliminar(storeName, key) {
  const clave = CLAVES_PRIMARIAS[storeName] || 'id'
  const { error } = await supabase.from(storeName).delete().eq(clave, key)
  if (error) manejarError(`eliminar ${storeName}`, error)
  return key
}
