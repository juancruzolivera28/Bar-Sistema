import { useState, useEffect } from 'react'
import { getAll } from '../db/database.js'

function Resumen() {
  const [datos, setDatos] = useState(null)

  function calcularTurno() {
    const ahora = new Date()
    const hora = ahora.getHours()
    const inicioTurno = new Date(ahora)

    if (hora < 7) {
      inicioTurno.setDate(inicioTurno.getDate() - 1)
    }
    inicioTurno.setHours(7, 0, 0, 0)

    const finTurno = new Date(inicioTurno)
    finTurno.setDate(finTurno.getDate() + 1)
    finTurno.setHours(6, 0, 0, 0)

    return { inicio: inicioTurno.getTime(), fin: finTurno.getTime() }
  }

  async function cargarResumen() {
    const { inicio, fin } = calcularTurno()
    const todoHistorial = await getAll('historial')

    const cuentas = todoHistorial
      .filter(h => h.fecha >= inicio && h.fecha < fin)
      .sort((a, b) => b.fecha - a.fecha)
      .map(h => ({
        ...h,
        fechaHora: new Date(h.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      }))

    const totales = { efectivo: 0, transferencia: 0, tarjeta: 0 }
    let totalGeneral = 0

    cuentas.forEach(cuenta => {
      totalGeneral += cuenta.total
      cuenta.metodo_pago.forEach(pago => {
        if (totales[pago.metodo] !== undefined) {
          totales[pago.metodo] += (pago.monto || 0)
        }
      })
    })

    const productos = {}
    cuentas.forEach(cuenta => {
      cuenta.detalle.forEach(item => {
        if (productos[item.nombre]) {
          productos[item.nombre] += item.cantidad
        } else {
          productos[item.nombre] = item.cantidad
        }
      })
    })

    const cantidadMesas = cuentas.length

    const ticketPromedio =
      cantidadMesas > 0
        ? Math.round(totalGeneral / cantidadMesas)
        : 0

    const productoMasVendido =
      Object.entries(productos)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

    setDatos({
      cuentas,
      totales,
      totalGeneral,
      productos,
      cantidadMesas,
      ticketPromedio,
      productoMasVendido
    })
  }

  useEffect(() => {
    cargarResumen()
  }, [])

  if (!datos) return <div style={{ padding: '20px', color: 'white' }}>Cargando...</div>

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#111',
      color: 'white',
      overflowY: 'auto',
      padding: '16px',
      paddingBottom: '80px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
        <h2 style={{ margin: 0 }}>Resumen del día</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '10px',
            marginBottom: '20px'
          }}
        >
        <div
          style={{
            backgroundColor: '#1e1e1e',
            borderRadius: '12px',
            padding: '16px'
          }}
        >
        <div style={{ color: '#888', fontSize: '12px' }}>
          Mesas cerradas
        </div>
        <div style={{ fontSize: '26px', fontWeight: 'bold' }}>
          {datos.cantidadMesas}
        </div>
      </div>

      <div
        style={{
          backgroundColor: '#1e1e1e',
          borderRadius: '12px',
          padding: '16px'
        }}
      >
      <div style={{ color: '#888', fontSize: '12px' }}>
      Ticket promedio
    </div>
    <div style={{ fontSize: '26px', fontWeight: 'bold' }}>
      ${datos.ticketPromedio.toLocaleString()}
    </div>
  </div>

  <div
    style={{
      backgroundColor: '#1e1e1e',
      borderRadius: '12px',
      padding: '16px'
    }}
  >
    <div style={{ color: '#888', fontSize: '12px' }}>
      Más vendido
    </div>
    <div
      style={{
        fontSize: '18px',
        fontWeight: 'bold'
      }}
    >
      {datos.productoMasVendido}
    </div>
  </div>
</div>
      </div>

      <div style={{
        backgroundColor: '#1e1e1e',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>Total del día</div>
        <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '16px' }}>
          ${datos.totalGeneral.toLocaleString()}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[
            { key: 'efectivo', label: 'Efectivo', color: '#2a9d5c' },
            { key: 'transferencia', label: 'Transferencia', color: '#1a73e8' },
            { key: 'tarjeta', label: 'Tarjeta', color: '#8e44ad' },
          ].map(({ key, label, color }) => (
            <div key={key} style={{
              backgroundColor: '#2a2a2a',
              borderRadius: '10px',
              padding: '12px',
              borderTop: `3px solid ${color}`
            }}>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                ${(datos.totales[key] || 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        backgroundColor: '#1e1e1e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#aaa', margin: '0 0 12px 0' }}>Productos vendidos</h3>
        {Object.keys(datos.productos).length === 0 ? (
          <p style={{ color: '#555', margin: 0 }}>Sin ventas todavía.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Object.entries(datos.productos)
              .sort((a, b) => b[1] - a[1])
              .map(([nombre, cantidad]) => (
                <div key={nombre} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#2a2a2a',
                  borderRadius: '8px',
                  padding: '10px 14px'
                }}>
                  <span>{nombre}</span>
                  <span style={{ fontWeight: 'bold', color: '#aaa' }}>× {cantidad}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      <h3 style={{ color: '#aaa', marginBottom: '12px' }}>
        Cuentas cerradas ({datos.cuentas.length})
      </h3>

      {datos.cuentas.length === 0 ? (
        <p style={{ color: '#555' }}>No hay cuentas cerradas hoy.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {datos.cuentas.map((cuenta, i) => (
            <div key={i} style={{
              backgroundColor: '#1e1e1e',
              borderRadius: '12px',
              padding: '14px 16px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#aaa', fontSize: '13px' }}>{cuenta.fechaHora}</span>
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                  ${cuenta.total.toLocaleString()}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                {cuenta.detalle.map((item, j) => (
                  <div key={j} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: '#ccc'
                  }}>
                    <span>{item.nombre} × {item.cantidad}</span>
                    <span>${(item.precio * item.cantidad).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {cuenta.metodo_pago.map((pago, j) => (
                  <span key={j} style={{
                    backgroundColor: '#2a2a2a',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    color: '#aaa'
                  }}>
                    {pago.metodo}: ${(pago.monto || 0).toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Resumen
