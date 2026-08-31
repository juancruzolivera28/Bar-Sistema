import { useState, useEffect } from 'react'
import { supabase } from '../db/supabaseClient.js'
import { getRestauranteId } from '../db/database.js'

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

  const RESUMEN_VACIO = {
    cuentas: [],
    totales: { efectivo: 0, transferencia: 0, tarjeta: 0 },
    totalGeneral: 0,
    productos: {},
    cantidadMesas: 0,
    ticketPromedio: 0,
    productoMasVendido: '-'
  }

  async function cargarResumen() {
    const { inicio, fin } = calcularTurno()

    // Antes esto hacia getAll('historial') y agregaba en el cliente. Ahora
    // historial no es legible con la anon key: el resumen del turno lo calcula
    // la RPC resumen_turno del lado del servidor, acotada a este restaurante y
    // a la ventana del turno. Se renderiza exactamente lo mismo que antes.
    const { data, error } = await supabase.rpc('resumen_turno', {
      p_restaurante_id: getRestauranteId(),
      p_desde: inicio,
      p_hasta: fin
    })

    if (error || !data) {
      console.error('resumen_turno:', error)
      setDatos(RESUMEN_VACIO)
      return
    }

    // La RPC devuelve cada cuenta con fecha (epoch ms); el formato de hora
    // (locale es-AR) se arma en el cliente, igual que antes.
    const cuentas = (data.cuentas || []).map(c => ({
      ...c,
      fechaHora: new Date(c.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    }))

    setDatos({
      cuentas,
      totales: data.totales || RESUMEN_VACIO.totales,
      totalGeneral: data.totalGeneral || 0,
      productos: data.productos || {},
      cantidadMesas: data.cantidadMesas || 0,
      ticketPromedio: data.ticketPromedio || 0,
      productoMasVendido: data.productoMasVendido || '-'
    })
  }

  useEffect(() => {
    cargarResumen()
  }, [])

  if (!datos) return <div style={{ padding: '20px', color: '#1a1a1a' }}>Cargando...</div>

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#ffffff',
      color: '#1a1a1a',
      overflowY: 'auto',
      padding: '16px',
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom))'
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
            backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0',
            borderRadius: '12px',
            padding: '16px'
          }}
        >
        <div style={{ color: '#666', fontSize: '12px' }}>
          Mesas cerradas
        </div>
        <div style={{ fontSize: '26px', fontWeight: 'bold' }}>
          {datos.cantidadMesas}
        </div>
      </div>

      <div
        style={{
          backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '16px'
        }}
      >
      <div style={{ color: '#666', fontSize: '12px' }}>
      Ticket promedio
    </div>
    <div style={{ fontSize: '26px', fontWeight: 'bold' }}>
      ${datos.ticketPromedio.toLocaleString()}
    </div>
  </div>

  <div
    style={{
      backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0',
      borderRadius: '12px',
      padding: '16px'
    }}
  >
    <div style={{ color: '#666', fontSize: '12px' }}>
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
        backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ color: '#666', fontSize: '13px', marginBottom: '4px' }}>Total del día</div>
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
              backgroundColor: '#ffffff', border: '1px solid #e0e0e0',
              borderRadius: '10px',
              padding: '12px',
              borderTop: `3px solid ${color}`
            }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                ${(datos.totales[key] || 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#666', margin: '0 0 12px 0' }}>Productos vendidos</h3>
        {Object.keys(datos.productos).length === 0 ? (
          <p style={{ color: '#888', margin: 0 }}>Sin ventas todavía.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Object.entries(datos.productos)
              .sort((a, b) => b[1] - a[1])
              .map(([nombre, cantidad]) => (
                <div key={nombre} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#ffffff', border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '10px 14px'
                }}>
                  <span>{nombre}</span>
                  <span style={{ fontWeight: 'bold', color: '#666' }}>× {cantidad}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      <h3 style={{ color: '#666', marginBottom: '12px' }}>
        Cuentas cerradas ({datos.cuentas.length})
      </h3>

      {datos.cuentas.length === 0 ? (
        <p style={{ color: '#888' }}>No hay cuentas cerradas hoy.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {datos.cuentas.map((cuenta, i) => (
            <div key={i} style={{
              backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0',
              borderRadius: '12px',
              padding: '14px 16px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#666', fontSize: '13px' }}>{cuenta.fechaHora}</span>
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
                    color: '#555'
                  }}>
                    <span>{item.nombre} × {item.cantidad}</span>
                    <span>${(item.precio * item.cantidad).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {cuenta.metodo_pago.map((pago, j) => (
                  <span key={j} style={{
                    backgroundColor: '#ffffff', border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    color: '#666'
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
