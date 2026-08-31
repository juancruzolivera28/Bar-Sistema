import { useState, useEffect, useRef } from 'react'
import { initDB, setOnError, setRestauranteId as fijarRestauranteActivo } from './db/database.js'
import { supabase } from './db/supabaseClient.js'
import Mesas from './components/mesas.jsx'
import DetalleMesa from './components/DetalleMesa.jsx'
import Stock from './components/Stock.jsx'
import Resumen from './components/Resumen.jsx'
import Dashboard from './components/Dashboard.jsx'
import Login from './components/Login.jsx'
import BottomNav from './components/BottomNav.jsx'
import { ALTO_BOTTOM_NAV } from './components/bottomNavConfig.js'
import { iniciarSync, detenerSync } from './sync.js'
import './App.css'

const LS_RESTAURANTE = 'bar_sistema_restaurante_id'

function App() {
  const [toast, setToast] = useState(null)
  const [dbReady, setDbReady] = useState(false)
  const [error, setError] = useState(null)
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [pantalla, setPantalla] = useState('mesas')
  const [rol, setRol] = useState(null)

  // Sesion / tenant
  const [sesionCargando, setSesionCargando] = useState(true)
  const [restauranteId, setRestauranteId] = useState(null)
  const [nombreRestaurante, setNombreRestaurante] = useState('')
  // El dueño se registro (auth) pero todavia no creo su restaurante.
  const [necesitaCrearRestaurante, setNecesitaCrearRestaurante] = useState(false)
  // Se incrementa para pedirle a App que vuelva a evaluar la sesion
  // (post "crear restaurante" o post "ingresar codigo de mozo").
  const [revalidarSesion, setRevalidarSesion] = useState(0)

  const [refrescarStock, setRefrescarStock] = useState(0)
  const [refrescarGlobal, setRefrescarGlobal] = useState(0)
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const mesasRef = useRef(null)

  function refrescarTodo() {
    if (mesasRef.current) {
      mesasRef.current.recargar()
    }
    setRefrescarStock(r => r + 1)
    setRefrescarGlobal(r => r + 1)
  }

  useEffect(() => {
    setOnError((mensaje) => mostrarToast(mensaje, 'error'))

    initDB()
      .then(() => setDbReady(true))
      .catch((err) => setError(err.message))
  }, [])

  // --- Bootstrap de sesion / tenant -----------------------------------------
  useEffect(() => {
    let vivo = true

    async function aplicarSesion(session) {
      // A) Dueño autenticado con Supabase Auth
      if (session?.user) {
        const { data, error: errRest } = await supabase
          .from('restaurantes')
          .select('id, nombre')
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (!vivo) return
        if (errRest) {
          setError(errRest.message)
          setSesionCargando(false)
          return
        }
        if (data) {
          fijarRestauranteActivo(data.id)
          setRestauranteId(data.id)
          setNombreRestaurante(data.nombre)
          setNecesitaCrearRestaurante(false)
          setRol('dueno')
          setPantalla('dashboard')
        } else {
          // Registrado pero sin restaurante: Login muestra el paso "crear restaurante".
          setNecesitaCrearRestaurante(true)
          setRol(null)
        }
        setSesionCargando(false)
        return
      }

      // B) Sin sesion de dueño: ver si el dispositivo ya tiene codigo de mozo
      const ridGuardado = localStorage.getItem(LS_RESTAURANTE)
      if (ridGuardado) {
        fijarRestauranteActivo(ridGuardado)
        setRestauranteId(ridGuardado)
        setRol('mozo')
        setPantalla('mesas')
      } else {
        // C) Nadie: pantalla de Login
        detenerSync()
        fijarRestauranteActivo(null)
        setRestauranteId(null)
        setNombreRestaurante('')
        setNecesitaCrearRestaurante(false)
        setRol(null)
        setMesaSeleccionada(null)
      }
      setSesionCargando(false)
    }

    supabase.auth.getSession().then(({ data }) => aplicarSesion(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      aplicarSesion(session)
    })

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [revalidarSesion])

  useEffect(() => {
    function handleOnline() {
      setEnLinea(true)
      // Mientras estuvo desconectado puede haber cambios de otros
      // dispositivos que no llegaron por Realtime: recargamos todo.
      refrescarTodo()
    }
    function handleOffline() { setEnLinea(false) }
    function handleVisibilidad() {
      // Al reabrir la app (celular que estaba en segundo plano, pestaña
      // que se retoma) volvemos a traer el estado real desde Supabase.
      if (document.visibilityState === 'visible') {
        refrescarTodo()
      }
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilidad)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilidad)
    }
  }, [])

  useEffect(() => {
    if (dbReady && restauranteId) {
      iniciarSync(refrescarTodo, restauranteId)
    }
    // Si cambia el restaurante (o se cierra sesion) se corta el canal viejo
    // y el proximo efecto lo re-crea con el filtro del nuevo tenant.
    return () => detenerSync()
  }, [dbReady, restauranteId])

  useEffect(() => {
    if (!dbReady || !restauranteId) return
    // Red de seguridad: Realtime avisa los cambios al toque, pero si por lo
    // que sea (wifi rara, service worker viejo, etc.) un dispositivo no
    // recibe el evento, este intervalo lo termina poniendo al día solo.
    const intervalo = setInterval(refrescarTodo, 5000)
    return () => clearInterval(intervalo)
  }, [dbReady, restauranteId])

  function mostrarToast(mensaje, tipo = 'success') {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  function handleVolver() {
    setMesaSeleccionada(null)
    mesasRef.current.recargar()
  }

  async function salir() {
    if (rol === 'dueno') {
      await supabase.auth.signOut()
      // onAuthStateChange dispara aplicarSesion(null)
    } else {
      localStorage.removeItem(LS_RESTAURANTE)
      detenerSync()
      fijarRestauranteActivo(null)
      setRevalidarSesion(n => n + 1)
    }
  }

  return (
    <>
      {!enLinea && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          backgroundColor: '#c0392b',
          color: 'white',
          textAlign: 'center',
          padding: '8px',
          fontSize: '13px',
          fontWeight: 'bold',
          zIndex: 1000
        }}>
          Sin conexión a internet — los cambios no se van a guardar hasta reconectar
        </div>
      )}

      {sesionCargando ? (
        <div style={{ padding: '20px', color: '#1a1a1a' }}>
          <p>Cargando...</p>
        </div>
      ) : !rol ? (
        <Login
          necesitaCrearRestaurante={necesitaCrearRestaurante}
          onListo={() => setRevalidarSesion(n => n + 1)}
        />
      ) : error ? (
        <div style={{ padding: '20px', color: 'red' }}>
          <p>Error al iniciar la base de datos:</p>
          <p>{error}</p>
        </div>
      ) : !dbReady ? (
        <div style={{ padding: '20px' }}>
          <p>Iniciando sistema...</p>
        </div>
      ) : (
        <div style={{
          width: '100%',
          minHeight: '100vh',
          padding: 0,
          paddingBottom: `${ALTO_BOTTOM_NAV + 16}px`,
          backgroundColor: '#ffffff'
        }}>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <span style={{ color: '#1a1a1a', fontWeight: 'bold', fontSize: '18px' }}>
          {nombreRestaurante || 'Bar'}
        </span>
        <button
          onClick={salir}
          style={{
            background: 'none',
            border: '1px solid #ccc',
            color: '#666',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          {rol === 'dueno' ? 'Salir' : 'Cambiar'}
        </button>
      </div>

      {pantalla === 'mesas' && (
        <Mesas
          ref={mesasRef}
          key={mesaSeleccionada ? 'con-mesa' : 'sin-mesa'}
          onSeleccionarMesa={(mesa) => setMesaSeleccionada(mesa)}
        />
      )}

      {pantalla === 'stock' && (
        <Stock refrescarStock={refrescarStock} />
      )}

      {pantalla === 'resumen' && (
        <Resumen />
      )}

      {pantalla === 'dashboard' && (
        <Dashboard refrescar={refrescarGlobal} />
      )}

      {mesaSeleccionada && (
        <DetalleMesa
          mesa={mesaSeleccionada}
          onVolver={handleVolver}
          onActualizarMesa={() => {}}
          onToast={mostrarToast}
          refrescar={refrescarGlobal}
        />
      )}

      {/* DetalleMesa es un overlay a pantalla completa con su propio boton
          Volver, asi que ocultamos la barra mientras hay una mesa abierta. */}
      {!mesaSeleccionada && (
        <BottomNav
          rol={rol}
          pantalla={pantalla}
          onCambiarPantalla={setPantalla}
        />
      )}

        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: toast.tipo === 'error' ? '#c0392b' : '#2a9d5c',
          color: 'white',
          padding: '14px 28px',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: 'bold',
          zIndex: 999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          {toast.tipo === 'error' ? '⚠' : '✓'} {toast.mensaje}
        </div>
      )}
    </>
  )
}

export default App
