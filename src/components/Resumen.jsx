import { useState, useEffect } from 'react'
import { supabase } from '../db/supabaseClient.js'
import { getRestauranteId } from '../db/database.js'
import { leerCache, escribirCache } from '../cacheMemoria.js'

function Resumen() {
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

  const restauranteId = getRestauranteId()
  const claveTurno = calcularTurno().inicio
  const [datos, setDatos] = useState(() => leerCache(restauranteId, 'resumen', claveTurno) ?? null)

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
      // Si ya habia datos (de cache o de una carga previa), los dejamos: no
      // los pisamos con el vacio. Sin nada previo, mismo comportamiento de
      // siempre.
      setDatos(prev => prev ?? RESUMEN_VACIO)
      return
    }

    // La RPC devuelve cada cuenta con fecha (epoch ms); el formato de hora
    // (locale es-AR) se arma en el cliente, igual que antes.
    const cuentas = (data.cuentas || []).map(c => ({
      ...c,
      fechaHora: new Date(c.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    }))

    const nuevosDatos = {
      cuentas,
      totales: data.totales || RESUMEN_VACIO.totales,
      totalGeneral: data.totalGeneral || 0,
      productos: data.productos || {},
      cantidadMesas: data.cantidadMesas || 0,
      ticketPromedio: data.ticketPromedio || 0,
      productoMasVendido: data.productoMasVendido || '-'
    }
    setDatos(nuevosDatos)
    escribirCache(restauranteId, 'resumen', claveTurno, nuevosDatos)
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
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 12px 0', textAlign: 'center' }}>Resumen del día</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '10px'
          }}
        >
          <div style={estiloTarjeta}>
            <div style={{ color: '#666', fontSize: '12px' }}>
              Mesas cerradas
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>
              {datos.cantidadMesas}
            </div>
          </div>

          <div style={estiloTarjeta}>
            <div style={{ color: '#666', fontSize: '12px' }}>
              Ticket promedio
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>
              ${datos.ticketPromedio.toLocaleString()}
            </div>
          </div>

          <div style={estiloTarjeta}>
            <div style={{ color: '#666', fontSize: '12px' }}>
              Más vendido
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {datos.productoMasVendido}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: '#666', fontSize: '13px', marginBottom: '4px' }}>Total del día</div>
        <div style={{ fontSize: '40px', fontWeight: 'bold', marginBottom: '16px' }}>
          ${datos.totalGeneral.toLocaleString()}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[
            { key: 'efectivo', label: 'Efectivo' },
            { key: 'transferencia', label: 'Transferencia' },
            { key: 'tarjeta', label: 'Tarjeta' },
          ].map(({ key, label }) => (
            <div key={key} style={estiloTarjeta}>
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
        <h3 style={{
          color: '#666',
          margin: '0 0 12px 0',
          fontSize: '12px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.06em'
        }}>Productos vendidos</h3>
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

      <h3 style={{
        color: '#666',
        marginBottom: '12px',
        fontSize: '12px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.06em'
      }}>
        Cuentas cerradas ({datos.cuentas.length})
      </h3>

      {datos.cuentas.length === 0 ? (
        <p style={{ color: '#888' }}>No hay cuentas cerradas hoy.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {datos.cuentas.map((cuenta, i) => (
            <div key={i} style={{
              borderBottom: '1px solid #e0e0e0',
              padding: '14px 4px'
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

const estiloTarjeta = {
  border: '1px solid #e0e0e0',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '16px'
}

export default Resumen
