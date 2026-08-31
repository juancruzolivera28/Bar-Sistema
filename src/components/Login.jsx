import { useState } from 'react'
import { getAll } from '../db/database.js'

function Login({ onLogin }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  async function verificarPin() {
    const configuracion = await getAll('configuracion')
    const pinGuardado = configuracion.find(c => c.clave === 'pin_dueno')?.valor

    if (pin === pinGuardado) {
      setError(false)
      onLogin('dueno')
      return
    }

    setError(true)
    setPin('')
  }

  function agregarDigito(digito) {
    if (pin.length < 4) {
      setPin(prev => prev + digito)
      setError(false)
    }
  }

  function borrar() {
    setPin(prev => prev.slice(0, -1))
    setError(false)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#1a1a1a'
    }}>
      <h2
        style={{
          marginBottom: '8px',
          fontSize: '22px',
          color: '#1a1a1a'
      }}
    >
      Vuelos Bar
    </h2>
      <p style={{ color: '#666', marginBottom: '32px', fontSize: '14px' }}>
        Ingresá el PIN de administrador
      </p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: i < pin.length ? '#1a73e8' : '#e0e0e0',
            border: '2px solid #ccc',
            transition: 'background-color 0.1s'
          }} />
        ))}
      </div>

      {error && (
        <p style={{ color: '#c0392b', marginBottom: '16px', fontSize: '14px' }}>
          PIN incorrecto
        </p>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 72px)',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button
            key={n}
            onClick={() => agregarDigito(String(n))}
            style={{
              height: '72px',
              backgroundColor: '#f4f4f5',
              color: '#1a1a1a',
              border: '1px solid #ddd',
              borderRadius: '12px',
              fontSize: '24px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {n}
          </button>
        ))}

        <button
          onClick={borrar}
          style={{
            height: '72px',
            backgroundColor: '#f4f4f5',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '12px',
            fontSize: '18px',
            cursor: 'pointer'
          }}
        >
          ←
        </button>

        <button
          onClick={() => agregarDigito('0')}
          style={{
            height: '72px',
            backgroundColor: '#f4f4f5',
            color: '#1a1a1a',
            border: '1px solid #ddd',
            borderRadius: '12px',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          0
        </button>

        <button
          onClick={verificarPin}
          style={{
            height: '72px',
            backgroundColor: pin.length > 0 ? '#1a73e8' : '#f4f4f5',
            color: pin.length > 0 ? 'white' : '#1a1a1a',
            border: '1px solid #ddd',
            borderRadius: '12px',
            fontSize: '20px',
            cursor: 'pointer'
          }}
        >
          ✓
        </button>
      </div>

      <button
        onClick={() => onLogin('mozo')}
        style={{
          marginTop: '16px',
          background: 'none',
          border: 'none',
          color: '#1a73e8',
          fontSize: '14px',
          cursor: 'pointer',
          textDecoration: 'underline'
        }}
      >
        Entrar como mozo
      </button>
    </div>
  )
}

export default Login
