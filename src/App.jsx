import { useState, useEffect, useRef } from 'react'
import { initDB } from './db/database.js'
import Mesas from './components/Mesas.jsx'
import DetalleMesa from './components/DetalleMesa.jsx'
import Stock from './components/Stock.jsx'
import Resumen from './components/Resumen.jsx'
import Login from './components/Login.jsx'
import { iniciarSync } from './sync.js'
import './App.css'

function App() {
  const [toast, setToast] = useState(null)
  const [dbReady, setDbReady] = useState(false)
  const [error, setError] = useState(null)
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [pantalla, setPantalla] = useState('mesas')
  const [rol, setRol] = useState(null)
  const mesasRef = useRef(null)

  useEffect(() => {
    initDB()
      .then(() => setDbReady(true))
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    if (dbReady) {
      iniciarSync(() => {
        if (mesasRef.current) {
          mesasRef.current.recargar()
        }
      })
    }
  }, [dbReady])

  function mostrarToast(mensaje) {
    setToast(mensaje)
    setTimeout(() => setToast(null), 3000)
  }

  function handleVolver() {
    setMesaSeleccionada(null)
    mesasRef.current.recargar()
  }

  if (!rol) {
    return <Login onLogin={(r) => setRol(r)} />
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <p>Error al iniciar la base de datos:</p>
        <p>{error}</p>
      </div>
    )
  }

  if (!dbReady) {
    return (
      <div style={{ padding: '20px' }}>
        <p>Iniciando sistema...</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: 0, backgroundColor: '#0f1117' }}>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        backgroundColor: '#1e1e1e',
        borderBottom: '1px solid #333',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>
          Vuelos Bar
        </span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setPantalla('resumen')}
            style={{
              backgroundColor: pantalla === 'resumen' ? '#1a73e8' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Resumen
          </button>
          <button
            onClick={() => setPantalla('mesas')}
            style={{
              backgroundColor: pantalla === 'mesas' ? '#1a73e8' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Mesas
          </button>
          {rol === 'dueno' && (
            <button
              onClick={() => setPantalla('stock')}
              style={{
                backgroundColor: pantalla === 'stock' ? '#1a73e8' : '#333',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Stock
            </button>
          )}
        </div>
      </div>

      {pantalla === 'mesas' && (
        <Mesas
          ref={mesasRef}
          key={mesaSeleccionada ? 'con-mesa' : 'sin-mesa'}
          onSeleccionarMesa={(mesa) => setMesaSeleccionada(mesa)}
        />
      )}

      {pantalla === 'stock' && (
        <Stock onVolver={() => setPantalla('mesas')} />
      )}

      {pantalla === 'resumen' && (
        <Resumen onVolver={() => setPantalla('mesas')} />
      )}

      {mesaSeleccionada && (
        <DetalleMesa
          mesa={mesaSeleccionada}
          onVolver={handleVolver}
          onActualizarMesa={() => {}}
          onToast={mostrarToast}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#2a9d5c',
          color: 'white',
          padding: '14px 28px',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: 'bold',
          zIndex: 999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          ✓ {toast}
        </div>
      )}

    </div>
  )
}

export default App
