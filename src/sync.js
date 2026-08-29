import { supabase } from './db/supabaseClient.js'

let canalGlobal = null

export function iniciarSync(onCambio) {
  if (!supabase || canalGlobal) return canalGlobal

  let conectadoAntes = false

  canalGlobal = supabase
    .channel('bar-sistema-cambios')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => onCambio())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => onCambio())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => onCambio())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'historial' }, () => onCambio())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => onCambio())
    .subscribe((status) => {
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
