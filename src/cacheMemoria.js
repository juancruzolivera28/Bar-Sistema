// Cache PURAMENTE en memoria (nunca localStorage): vive solo mientras la
// pestaña esta abierta, se pierde al recargar. Sirve para mostrar al
// instante el ultimo dato conocido de una pantalla mientras se refresca en
// segundo plano, sin tener que esperar a Supabase de nuevo cada vez que se
// remonta el componente.
//
// Clave = restaurante_id + pantalla + una sub-clave propia de cada pantalla
// (mes, turno, etc.) para que dos restaurantes o dos periodos nunca
// compartan datos. Sin restauranteId no se lee ni se escribe nada.
const cache = new Map()

function armarClave(restauranteId, pantalla, subClave) {
  return `${restauranteId}::${pantalla}::${subClave ?? ''}`
}

export function leerCache(restauranteId, pantalla, subClave) {
  if (!restauranteId) return undefined
  return cache.get(armarClave(restauranteId, pantalla, subClave))
}

export function escribirCache(restauranteId, pantalla, subClave, datos) {
  if (!restauranteId) return
  cache.set(armarClave(restauranteId, pantalla, subClave), datos)
}

// Se llama al cerrar sesion y cuando cambia el restaurante activo (ver
// App.jsx), para que el dato de un restaurante/sesion nunca se le muestre
// de entrada a otro.
export function vaciarCache() {
  cache.clear()
}
