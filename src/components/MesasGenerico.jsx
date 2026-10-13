import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { getAll, agregar, eliminar } from '../db/database.js'
import { useLongPress, LONG_PRESS_MS } from './useLongPress.js'
import ModalConfirmarEliminarMesa from './ModalConfirmarEliminarMesa.jsx'

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
const MesasGenerico = forwardRef(function MesasGenerico({ onSeleccionarMesa, onToast }, ref) {
  const [mesas, setMesas] = useState([])
  const [mesaAEliminar, setMesaAEliminar] = useState(null)

  useImperativeHandle(ref, () => ({
    recargar: cargarMesas
  }))

  useEffect(() => {
    cargarMesas()
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

  function manejarLongPress(mesa) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30)
    }
    if (mesa.estado !== 'libre') {
      onToast?.('Solo se pueden eliminar mesas libres.', 'error')
      return
    }
    setMesaAEliminar(mesa)
  }

  const { presionando, obtenerHandlers } = useLongPress(manejarLongPress)

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
            {...obtenerHandlers(mesa, onSeleccionarMesa)}
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

      <ModalConfirmarEliminarMesa
        mesa={mesaAEliminar}
        onConfirmar={confirmarEliminarMesa}
        onCancelar={() => setMesaAEliminar(null)}
      />
    </div>
  )
})

export default MesasGenerico
