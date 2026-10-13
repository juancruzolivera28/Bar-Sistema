import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { getAll, agregar, eliminar } from '../db/database.js'

// Layout GENERICO de mesas: grid responsive simple con las mesas 1..N del
// restaurante actual. Se usa para todos los restaurantes MENOS Vuelos Bar,
// que tiene un plano fijo hecho a medida en mesas.jsx. App.jsx decide cual
// de los dos montar segun el restaurante_id.
//
// La logica de datos (cargarMesas, colorEstado, agregarMesaExtra,
// eliminarMesaExtra) es IGUAL a la de mesas.jsx: lo unico distinto es el JSX
// del layout (grid responsive en vez de posiciones fijas + Barra). Recibe
// exactamente las mismas props que mesas.jsx (onSeleccionarMesa + el ref con
// recargar()), mas onToast (opcional, solo lo usa este layout para el aviso
// de "mesa no libre" al eliminar) para que sean intercambiables sin tocar el
// resto de App.jsx.
const LONG_PRESS_MS = 600
const UMBRAL_MOVIMIENTO_PX = 10

const MesasGenerico = forwardRef(function MesasGenerico({ onSeleccionarMesa, onToast }, ref) {
  const [mesas, setMesas] = useState([])
  const [presionando, setPresionando] = useState(null)
  const [mesaAEliminar, setMesaAEliminar] = useState(null)

  const timerRef = useRef(null)
  const disparadoRef = useRef(false)
  const inicioRef = useRef({ x: 0, y: 0 })
  const mesaActivaIdRef = useRef(null)

  useImperativeHandle(ref, () => ({
    recargar: cargarMesas
  }))

  useEffect(() => {
    cargarMesas()
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function cargarMesas() {
    const todas = await getAll('mesas')
    todas.sort((a, b) => a.numero - b.numero)
    setMesas(todas)
  }

  function colorEstado(estado) {
    if (estado === 'libre') return '#2a9d5c'
    if (estado === 'ocupada') return '#e07b00'
    if (estado === 'esperando_cuenta') return '#c0392b'
    return '#555'
  }

  async function agregarMesaExtra() {
    const ultimoNumero = mesas.length > 0 ? Math.max(...mesas.map(m => m.numero)) : 25
    await agregar('mesas', { numero: ultimoNumero + 1, estado: 'libre', nombre: null, fija: 0 })
    cargarMesas()
  }

  async function eliminarMesaExtra(mesa) {
    await eliminar('mesas', mesa.id)
    cargarMesas()
  }

  function cancelarPresion() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    mesaActivaIdRef.current = null
    setPresionando(null)
  }

  function dispararLongPress(mesa) {
    disparadoRef.current = true
    timerRef.current = null
    mesaActivaIdRef.current = null
    setPresionando(null)

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30)
    }

    if (mesa.estado !== 'libre') {
      onToast?.('Solo se pueden eliminar mesas libres.', 'error')
      return
    }
    setMesaAEliminar(mesa)
  }

  function manejarPointerDown(e, mesa) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    disparadoRef.current = false
    inicioRef.current = { x: e.clientX, y: e.clientY }
    mesaActivaIdRef.current = mesa.id
    setPresionando(mesa.id)
    timerRef.current = setTimeout(() => dispararLongPress(mesa), LONG_PRESS_MS)
  }

  function manejarPointerMove(e, mesa) {
    if (mesaActivaIdRef.current !== mesa.id) return
    const dx = e.clientX - inicioRef.current.x
    const dy = e.clientY - inicioRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > UMBRAL_MOVIMIENTO_PX) cancelarPresion()
  }

  function manejarClick(mesa) {
    if (disparadoRef.current) {
      disparadoRef.current = false
      return
    }
    onSeleccionarMesa(mesa)
  }

  async function confirmarEliminarMesa() {
    const mesa = mesaAEliminar
    setMesaAEliminar(null)
    if (mesa) await eliminarMesaExtra(mesa)
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '32px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
        gap: '10px',
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {mesas.map(mesa => (
          <div
            key={mesa.id}
            onClick={() => manejarClick(mesa)}
            onPointerDown={(e) => manejarPointerDown(e, mesa)}
            onPointerMove={(e) => manejarPointerMove(e, mesa)}
            onPointerUp={cancelarPresion}
            onPointerLeave={cancelarPresion}
            onPointerCancel={cancelarPresion}
            onContextMenu={(e) => e.preventDefault()}
            className={presionando === mesa.id ? 'mesa-card-presionando' : undefined}
            style={{
              backgroundColor: colorEstado(mesa.estado),
              borderRadius: '10px',
              height: '52px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '13px',
              position: 'relative',
              overflow: 'hidden',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              touchAction: 'pan-y',
              transform: presionando === mesa.id ? 'scale(0.95)' : 'scale(1)',
              transition: 'transform 150ms ease'
            }}
          >
            <div>{mesa.nombre || `Mesa ${mesa.numero}`}</div>
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
              {mesa.estado === 'libre' ? 'Libre' : mesa.estado === 'ocupada' ? 'Ocupada' : 'Cuenta'}
            </div>
            {presionando === mesa.id && (
              <div style={{
                position: 'absolute',
                left: 0, right: 0, bottom: 0,
                height: '4px',
                backgroundColor: 'rgba(0,0,0,0.2)'
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: '#ffd166',
                  width: '0%',
                  animation: `mesaLongPressProgreso ${LONG_PRESS_MS}ms linear forwards`
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
        <button
          onClick={agregarMesaExtra}
          style={{
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          + Mesa
        </button>
      </div>

      {mesaAEliminar && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '360px',
            color: '#1a1a1a',
            boxShadow: '0 8px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>
              ¿Eliminar Mesa {mesaAEliminar.numero}?
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setMesaAEliminar(null)}
                style={{
                  flex: 1,
                  backgroundColor: '#e0e0e0',
                  color: '#1a1a1a',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminarMesa}
                style={{
                  flex: 1,
                  backgroundColor: '#c0392b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default MesasGenerico
