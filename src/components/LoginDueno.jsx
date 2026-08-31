import { useState } from 'react'
import { supabase } from '../db/supabaseClient.js'
import { estilos } from './loginEstilos.js'

// Traduce los errores mas comunes de Supabase Auth a algo legible en español.
function traducir(mensaje) {
  const m = (mensaje || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('user already registered')) return 'Ya existe una cuenta con ese email. Probá iniciar sesión.'
  if (m.includes('password should be at least')) return 'La contraseña es muy corta (mínimo 6 caracteres).'
  if (m.includes('unable to validate email')) return 'El email no es válido.'
  if (m.includes('email not confirmed')) return 'Falta confirmar el email. Revisá tu casilla.'
  return mensaje || 'Ocurrió un error. Reintentá.'
}

// Flujo de dueño: login / registro con email + contraseña.
// En registro, despues de crear el usuario se pide nombre del restaurante y
// cantidad de mesas, y se llama a la funcion RPC crear_restaurante.
//
// Props:
//  - onListo: avisa a App que revalide la sesion.
//  - forzarCrearRestaurante: entrar directo al paso "crear restaurante"
//    (el usuario ya esta autenticado pero sin restaurante).
//  - onVolver: volver al selector dueño/mozo (null si no aplica).
function LoginDueno({ onListo, forzarCrearRestaurante, onVolver }) {
  const [modo, setModo] = useState('login') // 'login' | 'registro'
  const [paso, setPaso] = useState(forzarCrearRestaurante ? 'restaurante' : 'credenciales')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombreRest, setNombreRest] = useState('')
  const [cantidadMesas, setCantidadMesas] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar() {
    setError(''); setCargando(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(), password
    })
    setCargando(false)
    if (err) { setError(traducir(err.message)); return }
    onListo() // App tambien reacciona via onAuthStateChange
  }

  async function registrar() {
    setError(''); setCargando(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(), password
    })
    if (err) { setCargando(false); setError(traducir(err.message)); return }
    setCargando(false)
    if (!data.session) {
      // Email confirmation activado en Supabase: no hay sesion todavia.
      setError('Te mandamos un email para confirmar la cuenta. Confirmá y volvé a iniciar sesión.')
      setModo('login')
      return
    }
    setPaso('restaurante')
  }

  async function crearRestaurante() {
    setError('')
    const n = parseInt(cantidadMesas, 10)
    if (!nombreRest.trim() || !n || n < 1 || n > 200) {
      setError('Poné un nombre y una cantidad de mesas entre 1 y 200.')
      return
    }
    setCargando(true)
    const { error: err } = await supabase.rpc('crear_restaurante', {
      p_nombre: nombreRest.trim(),
      p_cantidad_mesas: n
    })
    setCargando(false)
    if (err) { setError(traducir(err.message)); return }
    onListo()
  }

  // --- Paso 2: crear restaurante ------------------------------------------
  if (paso === 'restaurante') {
    return (
      <div style={estilos.pantalla}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#1a1a1a' }}>
          Configurá tu restaurante
        </h2>
        <p style={{ color: '#666', margin: '0 0 24px 0', fontSize: '14px' }}>
          Se van a crear las mesas numeradas 1 a N.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            style={estilos.input}
            placeholder="Nombre del restaurante"
            value={nombreRest}
            onChange={(e) => setNombreRest(e.target.value)}
          />
          <input
            style={estilos.input}
            type="number"
            placeholder="¿Cuántas mesas tenés?"
            value={cantidadMesas}
            onChange={(e) => setCantidadMesas(e.target.value)}
          />
          <button style={estilos.botonPrimario} onClick={crearRestaurante} disabled={cargando}>
            {cargando ? 'Creando...' : 'Crear restaurante'}
          </button>
        </div>

        {error && <p style={estilos.error}>{error}</p>}
      </div>
    )
  }

  // --- Paso 1: credenciales ---------------------------------------------------
  return (
    <div style={estilos.pantalla}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#1a1a1a' }}>
        {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h2>
      <p style={{ color: '#666', margin: '0 0 24px 0', fontSize: '14px' }}>
        Dueño del restaurante
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          style={estilos.input}
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={estilos.input}
          type="password"
          placeholder="Contraseña"
          autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          style={estilos.botonPrimario}
          onClick={modo === 'login' ? entrar : registrar}
          disabled={cargando}
        >
          {cargando ? 'Un momento...' : (modo === 'login' ? 'Entrar' : 'Registrarme')}
        </button>
      </div>

      {error && <p style={estilos.error}>{error}</p>}

      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
        <button
          style={estilos.link}
          onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError('') }}
        >
          {modo === 'login' ? 'No tengo cuenta, quiero registrarme' : 'Ya tengo cuenta, iniciar sesión'}
        </button>
        {onVolver && (
          <button style={estilos.link} onClick={onVolver}>
            Volver
          </button>
        )}
      </div>
    </div>
  )
}

export default LoginDueno
