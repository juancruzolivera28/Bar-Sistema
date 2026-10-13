import { useState } from 'react'
import { supabase } from '../db/supabaseClient.js'
import { estilos } from './loginEstilos.js'

function traducir(mensaje) {
  const m = (mensaje || '').toLowerCase()
  if (m.includes('password should be at least')) return 'La contraseña es muy corta (mínimo 8 caracteres).'
  if (m.includes('should be different')) return 'La nueva contraseña tiene que ser distinta de la actual.'
  return mensaje || 'No se pudo guardar la contraseña. Reintentá.'
}

// Pantalla que App.jsx muestra en lugar de la app normal mientras hay una
// sesion de recuperacion de contraseña activa (evento PASSWORD_RECOVERY de
// Supabase Auth, disparado cuando el dueño vuelve desde el link del mail de
// resetPasswordForEmail). La sesion de recuperacion ya esta autenticada, asi
// que solo hace falta pedir la contraseña nueva y guardarla.
//
// Props:
//  - onListo: avisa a App que la recuperacion termino (exito) para que
//    vuelva a mostrar la app normal.
function NuevaContrasena({ onListo }) {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function guardar() {
    setError('')
    if (password.length < 8) {
      setError('La contraseña tiene que tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setCargando(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setCargando(false)
    if (err) { setError(traducir(err.message)); return }
    setExito(true)
  }

  return (
    <div style={estilos.pantalla}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#1a1a1a' }}>
        Elegí tu nueva contraseña
      </h2>
      <p style={{ color: '#666', margin: '0 0 24px 0', fontSize: '14px' }}>
        Dueño del restaurante
      </p>

      {exito ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <p style={estilos.exito}>Contraseña actualizada correctamente.</p>
          <button style={estilos.botonPrimario} onClick={onListo}>
            Entrar
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            style={estilos.input}
            type="password"
            placeholder="Nueva contraseña"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            style={estilos.input}
            type="password"
            placeholder="Confirmar contraseña"
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
          <button style={estilos.botonPrimario} onClick={guardar} disabled={cargando}>
            {cargando ? 'Guardando...' : 'Guardar contraseña'}
          </button>
          {error && <p style={estilos.error}>{error}</p>}
        </div>
      )}
    </div>
  )
}

export default NuevaContrasena
