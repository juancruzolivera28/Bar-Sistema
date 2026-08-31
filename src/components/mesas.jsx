import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { getAll, agregar, eliminar } from '../db/database.js'

const Mesas = forwardRef(function Mesas({ onSeleccionarMesa }, ref) {
  const [mesas, setMesas] = useState([])

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

  function getMesa(numero) {
    return mesas.find(m => m.numero === numero)
  }

  function getBarra() {
    return mesas.find(m => m.nombre === 'Barra')
  }

  function getMesasExtras() {
    return mesas.filter(m => m.fija === 0)
  }

  async function agregarMesaExtra() {
    const ultimoNumero = mesas.length > 0 ? Math.max(...mesas.map(m => m.numero)) : 25
    await agregar('mesas', { numero: ultimoNumero + 1, estado: 'libre', nombre: null, fija: 0 })
    cargarMesas()
  }

  async function eliminarMesaExtra(mesa) {
    if (mesa.estado !== 'libre') {
      alert('Solo se pueden eliminar mesas libres.')
      return
    }
    const confirmar = window.confirm(`¿Eliminar Mesa ${mesa.numero}?`)
    if (!confirmar) return
    await eliminar('mesas', mesa.id)
    cargarMesas()
  }

  function TarjetaMesa({ mesa, ancho, alto }) {
    if (!mesa) return <div style={{ width: ancho, height: alto }} />
    return (
      <div
        onClick={() => onSeleccionarMesa(mesa)}
        style={{
          backgroundColor: colorEstado(mesa.estado),
          borderRadius: '10px',
          width: ancho,
          height: alto,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '13px',
          userSelect: 'none'
        }}
      >
        <div>{mesa.nombre || `Mesa ${mesa.numero}`}</div>
        <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
          {mesa.estado === 'libre' ? 'Libre' : mesa.estado === 'ocupada' ? 'Ocupada' : 'Cuenta'}
        </div>
      </div>
    )
  }

  const M = (numero) => getMesa(numero)
  const barra = getBarra()
  const mesasExtras = getMesasExtras()
  const w = '70px'
  const h = '52px'

  return (
    // El plano de Vuelos Bar tiene ancho fijo (~384px). En celulares chicos
    // eso superaba el ancho del viewport y el navegador aplicaba zoom-out
    // automatico a TODA la app. Ahora el plano vive en un contenedor con
    // scroll horizontal: en PC/tablet queda centrado e identico; en celular
    // se puede desplazar de lado sin forzar el zoom.
    <div style={{ padding: '16px', overflowX: 'auto' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        width: 'min-content',
        minWidth: '100%',
        margin: '0 auto'
      }}>
      <div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '74px 74px 8px 8px 74px 74px',
          gap: '8px',
          alignItems: 'center'
        }}>
          <div style={{ gridColumn: '1 / 3', gridRow: '5' }}>
            <TarjetaMesa mesa={barra} ancho="156px" alto={h} />
          </div>

          <div style={{ gridColumn: '6', gridRow: '1' }}><TarjetaMesa mesa={M(25)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '6', gridRow: '2' }}><TarjetaMesa mesa={M(24)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '6', gridRow: '3' }}><TarjetaMesa mesa={M(23)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '6', gridRow: '4' }}><TarjetaMesa mesa={M(22)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '6', gridRow: '5' }}><TarjetaMesa mesa={M(21)} ancho={w} alto={h} /></div>

          <div style={{ gridColumn: '5', gridRow: '6' }}><TarjetaMesa mesa={M(20)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '6', gridRow: '6' }}><TarjetaMesa mesa={M(19)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '5', gridRow: '7' }}><TarjetaMesa mesa={M(18)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '6', gridRow: '7' }}><TarjetaMesa mesa={M(17)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '5', gridRow: '8' }}><TarjetaMesa mesa={M(16)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '6', gridRow: '8' }}><TarjetaMesa mesa={M(15)} ancho={w} alto={h} /></div>

          <div style={{ gridColumn: '1', gridRow: '6' }}><TarjetaMesa mesa={M(1)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '2', gridRow: '6' }}><TarjetaMesa mesa={M(4)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '1', gridRow: '7' }}><TarjetaMesa mesa={M(2)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '2', gridRow: '7' }}><TarjetaMesa mesa={M(5)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '1', gridRow: '8' }}><TarjetaMesa mesa={M(3)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '2', gridRow: '8' }}><TarjetaMesa mesa={M(6)} ancho={w} alto={h} /></div>

          <div style={{ gridColumn: '1', gridRow: '10' }}><TarjetaMesa mesa={M(11)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '2', gridRow: '10' }}><TarjetaMesa mesa={M(12)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '5', gridRow: '10' }}><TarjetaMesa mesa={M(13)} ancho={w} alto={h} /></div>
          <div style={{ gridColumn: '6', gridRow: '10' }}><TarjetaMesa mesa={M(14)} ancho={w} alto={h} /></div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
        {mesasExtras.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {mesasExtras.map(mesa => (
              <div
                key={mesa.id}
                style={{
                  backgroundColor: colorEstado(mesa.estado),
                  borderRadius: '10px',
                  width: w,
                  height: h,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  position: 'relative',
                  userSelect: 'none'
                }}
                onClick={() => onSeleccionarMesa(mesa)}
              >
                <div>Mesa {mesa.numero}</div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                  {mesa.estado === 'libre' ? 'Libre' : mesa.estado === 'ocupada' ? 'Ocupada' : 'Cuenta'}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); eliminarMesaExtra(mesa) }}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: 'rgba(0,0,0,0.25)',
                    border: 'none',
                    borderRadius: '50%',
                    color: 'white',
                    width: '20px',
                    height: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    lineHeight: '20px',
                    textAlign: 'center',
                    padding: 0
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
})

export default Mesas
