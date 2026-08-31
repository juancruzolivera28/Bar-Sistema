import { useState, useEffect } from 'react'
import { getAll, agregar, eliminar } from '../db/database.js'

const CATEGORIAS = ['Proveedores', 'Sueldos', 'Servicios', 'Alquiler', 'Otros']

function fechaISOHoy() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function Dashboard({ refrescar }) {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth())
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [ingresos, setIngresos] = useState([])
  const [gastos, setGastos] = useState([])
  const [mesasPorId, setMesasPorId] = useState({})
  const [nuevoGasto, setNuevoGasto] = useState(false)
  const [form, setForm] = useState({
    descripcion: '',
    monto: '',
    categoria: CATEGORIAS[0],
    fecha: fechaISOHoy()
  })

  useEffect(() => {
    cargarDatos()
  }, [mes, anio, refrescar])

  async function cargarDatos() {
    const inicio = new Date(anio, mes, 1).getTime()
    const fin = new Date(anio, mes + 1, 1).getTime()

    const [todoHistorial, todosGastos, todasMesas] = await Promise.all([
      getAll('historial'),
      getAll('gastos'),
      getAll('mesas')
    ])

    const lookup = {}
    todasMesas.forEach(m => { lookup[m.id] = m.numero })
    setMesasPorId(lookup)

    setIngresos(
      todoHistorial
        .filter(h => h.fecha >= inicio && h.fecha < fin)
        .sort((a, b) => b.fecha - a.fecha)
    )
    setGastos(
      todosGastos
        .filter(g => g.fecha >= inicio && g.fecha < fin)
        .sort((a, b) => b.fecha - a.fecha)
    )
  }

  function mesAnterior() {
    if (mes === 0) {
      setMes(11)
      setAnio(anio - 1)
    } else {
      setMes(mes - 1)
    }
  }

  function mesSiguiente() {
    if (mes === 11) {
      setMes(0)
      setAnio(anio + 1)
    } else {
      setMes(mes + 1)
    }
  }

  function abrirNuevo() {
    setNuevoGasto(true)
    setForm({ descripcion: '', monto: '', categoria: CATEGORIAS[0], fecha: fechaISOHoy() })
  }

  function cancelar() {
    setNuevoGasto(false)
    setForm({ descripcion: '', monto: '', categoria: CATEGORIAS[0], fecha: fechaISOHoy() })
  }

  async function guardarGasto() {
    const monto = parseFloat(form.monto)
    if (!form.descripcion.trim() || !form.fecha || isNaN(monto) || monto <= 0) {
      alert('Completá descripción, un monto mayor a 0 y una fecha.')
      return
    }
    const gastoNuevo = {
      descripcion: form.descripcion.trim(),
      monto,
      categoria: form.categoria,
      fecha: new Date(`${form.fecha}T12:00:00`).getTime()
    }
    await agregar('gastos', gastoNuevo)
    cancelar()
    cargarDatos()
  }

  async function eliminarGasto(gasto) {
    const confirmar = window.confirm(`¿Eliminar "${gasto.descripcion}"?`)
    if (!confirmar) return
    await eliminar('gastos', gasto.id)
    cargarDatos()
  }

  const totalGanado = ingresos.reduce((s, i) => s + i.total, 0)
  const totalGastado = gastos.reduce((s, g) => s + g.monto, 0)
  const neta = totalGanado - totalGastado

  const nombreMesRaw = new Date(anio, mes, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const nombreMes = nombreMesRaw.charAt(0).toUpperCase() + nombreMesRaw.slice(1)

  function fechaCorta(ms) {
    return new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  }

  const formulario = (
    <div style={{
      backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <input
        placeholder="Descripción (ej: Compra de cerveza a distribuidor)"
        value={form.descripcion}
        onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        style={estiloInput}
      />
      <input
        placeholder="Monto"
        type="number"
        value={form.monto}
        onChange={(e) => setForm({ ...form, monto: e.target.value })}
        style={estiloInput}
      />
      <select
        value={form.categoria}
        onChange={(e) => setForm({ ...form, categoria: e.target.value })}
        style={estiloInput}
      >
        {CATEGORIAS.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <input
        type="date"
        value={form.fecha}
        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
        style={estiloInput}
      />
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={guardarGasto}
          style={{
            flex: 1,
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          Guardar
        </button>
        <button
          onClick={cancelar}
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
      </div>
    </div>
  )

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
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <button
          onClick={abrirNuevo}
          style={{
            marginLeft: 'auto',
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          + Gasto
        </button>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <button
          onClick={mesAnterior}
          style={{
            background: '#f4f4f5',
            border: '1px solid #ccc',
            color: '#1a1a1a',
            borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          ‹
        </button>
        <span style={{
          fontSize: '17px',
          fontWeight: 'bold',
          minWidth: '160px',
          textAlign: 'center'
        }}>
          {nombreMes}
        </span>
        <button
          onClick={mesSiguiente}
          style={{
            background: '#f4f4f5',
            border: '1px solid #ccc',
            color: '#1a1a1a',
            borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          ›
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '10px',
        marginBottom: '20px'
      }}>
        <div style={{ backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: '#666', fontSize: '12px' }}>Total Ganado</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#2a9d5c' }}>
            ${totalGanado.toLocaleString()}
          </div>
        </div>
        <div style={{ backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: '#666', fontSize: '12px' }}>Total Gastado</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#c0392b' }}>
            ${totalGastado.toLocaleString()}
          </div>
        </div>
        <div style={{ backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '16px' }}>
          <div style={{ color: '#666', fontSize: '12px' }}>Ganancia Neta</div>
          <div style={{
            fontSize: '26px',
            fontWeight: 'bold',
            color: neta >= 0 ? '#2a9d5c' : '#c0392b'
          }}>
            ${neta.toLocaleString()}
          </div>
        </div>
      </div>

      {nuevoGasto && formulario}

      <div style={{
        backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#666', margin: '0 0 12px 0' }}>
          Ingresos ({ingresos.length})
        </h3>
        {ingresos.length === 0 ? (
          <p style={{ color: '#888', margin: 0 }}>Sin ingresos este mes.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ingresos.map((ingreso) => {
              const numeroMesa = mesasPorId[ingreso.mesa_id]
              return (
                <div key={ingreso.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  padding: '10px 14px'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {fechaCorta(ingreso.fecha)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                      {numeroMesa != null ? `Mesa ${numeroMesa} · ` : ''}cuenta cerrada
                    </div>
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#2a9d5c' }}>
                    ${ingreso.total.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{
        backgroundColor: '#f4f4f5', border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#666', margin: '0 0 12px 0' }}>
          Gastos ({gastos.length})
        </h3>
        {gastos.length === 0 ? (
          <p style={{ color: '#888', margin: 0 }}>Sin gastos este mes.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {gastos.map((gasto) => (
              <div key={gasto.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                padding: '10px 14px',
                gap: '10px',
                flexWrap: 'wrap'
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                    {gasto.descripcion}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    {fechaCorta(gasto.fecha)} · {gasto.categoria}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 'bold', color: '#c0392b' }}>
                    ${gasto.monto.toLocaleString()}
                  </span>
                  <button
                    onClick={() => eliminarGasto(gasto)}
                    style={{
                      background: '#c0392b',
                      border: 'none',
                      color: 'white',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const estiloInput = {
  backgroundColor: '#ffffff',
  border: '1px solid #ccc',
  borderRadius: '8px',
  padding: '12px',
  fontSize: '15px',
  color: '#1a1a1a',
  width: '100%',
  boxSizing: 'border-box'
}

export default Dashboard
