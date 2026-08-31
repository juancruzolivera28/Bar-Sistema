import { useState } from 'react'
import LoginDueno from './LoginDueno.jsx'
import LoginMozo from './LoginMozo.jsx'
import { estilos } from './loginEstilos.js'

// Pantalla de entrada. Elige entre:
//  - Dueño: email + contraseña (Supabase Auth). En registro crea el
//    restaurante y pide la cantidad de mesas.
//  - Mozo: codigo de restaurante (sin cuenta). Se guarda en localStorage.
//
// Props:
//  - necesitaCrearRestaurante: el dueño ya se registro pero todavia no tiene
//    restaurante. Se salta directo al flujo de dueño en el paso "crear".
//  - onListo: avisa a App que vuelva a evaluar la sesion.
function Login({ necesitaCrearRestaurante, onListo }) {
  const [modo, setModo] = useState(necesitaCrearRestaurante ? 'dueno' : null)

  if (modo === 'dueno' || necesitaCrearRestaurante) {
    return (
      <LoginDueno
        onListo={onListo}
        forzarCrearRestaurante={necesitaCrearRestaurante}
        onVolver={necesitaCrearRestaurante ? null : () => setModo(null)}
      />
    )
  }

  if (modo === 'mozo') {
    return <LoginMozo onListo={onListo} onVolver={() => setModo(null)} />
  }

  return (
    <div style={estilos.pantalla}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', color: '#1a1a1a' }}>
        Bar Sistema
      </h2>
      <p style={{ color: '#666', margin: '0 0 32px 0', fontSize: '14px' }}>
        ¿Cómo querés entrar?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button style={estilos.botonPrimario} onClick={() => setModo('dueno')}>
          Soy dueño
        </button>
        <button style={estilos.botonSecundario} onClick={() => setModo('mozo')}>
          Soy mozo
        </button>
      </div>
    </div>
  )
}

export default Login
