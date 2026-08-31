import { useState } from 'react'
import { supabase } from '../db/supabaseClient.js'
import { estilos } from './loginEstilos.js'

const LS_RESTAURANTE = 'bar_sistema_restaurante_id'

// Flujo de mozo: ingresa el codigo del restaurante UNA sola vez. Se valida
// contra la tabla restaurantes via la funcion buscar_restaurante_por_codigo
// (RPC SECURITY DEFINER, asi el anon no necesita leer la tabla). Si es
// valido, se guarda restaurante_id en localStorage y no se vuelve a pedir.
//
// App.jsx ya se encarga de saltar directo a Mesas cuando el codigo ya esta
// guardado; este componente solo se muestra cuando NO hay nada guardado.
//
// Props:
//  - onListo: avisa a App que revalide (ya hay restaurante_id guardado).
//  - onVolver: volver al selector dueño/mozo.
function LoginMozo({ onListo, onVolver }) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function validar() {
    setError('')
    const limpio = codigo.trim().toUpperCase()
    if (limpio.length < 6) {
      setError('El código tiene entre 6 y 8 caracteres.')
      return
    }
    setCargando(true)
    const { data, error: err } = await supabase.rpc('buscar_restaurante_por_codigo', {
      p_codigo: limpio
    })
    setCargando(false)
    if (err) { setError('No se pudo validar el código. Reintentá.'); return }
    const rest = Array.isArray(data) ? data[0] : data
    if (!rest) { setError('Código incorrecto.'); return }
    localStorage.setItem(LS_RESTAURANTE, rest.id)
    onListo()
  }

  return (
    <div style={estilos.pantalla}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#1a1a1a' }}>
        Código del restaurante
      </h2>
      <p style={{ color: '#666', margin: '0 0 24px 0', fontSize: '14px', maxWidth: '260px', textAlign: 'center' }}>
        Te lo da el dueño. Se pide una sola vez en este dispositivo.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          style={{ ...estilos.input, textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', fontWeight: 'bold' }}
          placeholder="EJ: VUELO7X"
          maxLength={8}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
        <button style={estilos.botonPrimario} onClick={validar} disabled={cargando}>
          {cargando ? 'Validando...' : 'Entrar'}
        </button>
      </div>

      {error && <p style={estilos.error}>{error}</p>}

      {onVolver && (
        <button style={{ ...estilos.link, marginTop: '20px' }} onClick={onVolver}>
          Volver
        </button>
      )}
    </div>
  )
}

export default LoginMozo
