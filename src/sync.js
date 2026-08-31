import { supabase } from './db/supabaseClient.js'

let canalGlobal = null

// iniciarSync(onCambio, restauranteId)
// Canal global de Realtime. Escucha cambios en las tablas operativas y
// dispara onCambio() para que la app recargue. Filtra por restaurante_id
// para no reaccionar a cambios de OTROS restaurantes (multi-tenant).
// Requiere REPLICA IDENTITY FULL en esas tablas (ver migracion_multitenant.sql).
export function iniciarSync(onCambio, restauranteId) {
  if (!supabase || canalGlobal) return canalGlobal

  let conectadoAntes = false
  const filtro = restauranteId ? `restaurante_id=eq.${restauranteId}` : undefined
  const tablas = ['mesas', 'productos', 'pedidos', 'historial', 'gastos']

  let canal = supabase.channel('bar-sistema-cambios')
  for (const table of tablas) {
    const cfg = { event: '*', schema: 'public', table }
    if (filtro) cfg.filter = filtro
    canal = canal.on('postgres_changes', cfg, () => onCambio())
  }

  canalGlobal = canal.subscribe((status) => {
    // Si el canal se reconecta después de haber estado caído (wifi cortado,
    // app en segundo plano, etc.), Realtime NO reenvía lo que pasó mientras
    // estuvo desconectado. Por eso forzamos una recarga completa apenas
    // vuelve a quedar "SUBSCRIBED", para no quedarnos con datos viejos.
    if (status === 'SUBSCRIBED') {
      if (conectadoAntes) onCambio()
      conectadoAntes = true
    }
  })

  return canalGlobal
}

export function detenerSync() {
  if (canalGlobal) {
    supabase.removeChannel(canalGlobal)
    canalGlobal = null
  }
}

// Canal por mesa. Filtra por mesa_id / id, que son globalmente unicos
// (bigint), asi que ya es seguro entre restaurantes sin filtrar por tenant.
export function iniciarSyncMesa(mesaId, onCambio) {
  if (!supabase) return () => {}

  let conectadoAntes = false

  const canal = supabase
    .channel(`mesa-${mesaId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `mesa_id=eq.${mesaId}` }, () => onCambio())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas', filter: `id=eq.${mesaId}` }, () => onCambio())
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (conectadoAntes) onCambio()
        conectadoAntes = true
      }
    })

  return () => supabase.removeChannel(canal)
}
