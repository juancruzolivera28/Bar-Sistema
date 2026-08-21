import { useState, useEffect } from 'react'
import { getAll, getByIndex, agregar, actualizar, eliminar } from '../db/database.js'
import ModalPago from './ModalPago.jsx'
import { iniciarSyncMesa } from '../sync.js'

function DetalleMesa({ mesa, onVolver, onActualizarMesa, onToast, refrescar }) {
  const [pedidos, setPedidos] = useState([])
  const [productos, setProductos] = useState([])
  const [total, setTotal] = useState(0)
  const [mostrarModalPago, setMostrarModalPago] = useState(false)

  useEffect(() => {
    const detener = iniciarSyncMesa(mesa.id, cargarDatos)
    return () => detener()
  }, [mesa.id])

  useEffect(() => {
    cargarDatos()
  }, [mesa.id, refrescar])

  async function cargarDatos() {
    const todosProductos = await getAll('productos')
    todosProductos.sort((a, b) => a.nombre.localeCompare(b.nombre))
    setProductos(todosProductos)

    const pedidosMesa = await getByIndex('pedidos', 'mesa_id', mesa.id)
    const pedidosConNombre = await Promise.all(pedidosMesa.map(async (p) => {
      const producto = todosProductos.find(pr => pr.id === p.producto_id)
      return { ...p, nombre: producto?.nombre, precio: producto?.precio }
    }))
    setPedidos(pedidosConNombre)
    setTotal(pedidosConNombre.reduce((acc, p) => acc + (p.precio || 0) * p.cantidad, 0))
  }

  async function agregarProducto(producto) {
    if (producto.stock <= 0) {
      alert(`${producto.nombre} sin stock.`)
      return
    }

    const pedidosMesa = await getByIndex('pedidos', 'mesa_id', mesa.id)
    const existente = pedidosMesa.find(p => p.producto_id === producto.id)

    if (existente) {
      await actualizar('pedidos', {
        ...existente,
        cantidad: existente.cantidad + 1,
        timestamp: Date.now()
      })
    } else {
      await agregar('pedidos', {
        mesa_id: mesa.id,
        producto_id: producto.id,
        cantidad: 1,
        timestamp: Date.now()
      })
    }

    await actualizar('mesas', { ...mesa, estado: 'ocupada' })
    onActualizarMesa()
    cargarDatos()
  }

  async function quitarProducto(pedido) {
    if (pedido.cantidad > 1) {
      await actualizar('pedidos', {
        ...pedido,
        cantidad: pedido.cantidad - 1,
        timestamp: Date.now()
      })
    } else {
      await eliminar('pedidos', pedido.id)
    }
    cargarDatos()
  }

  async function confirmarPago(pagos) {
    await agregar('historial', {
      mesa_id: mesa.id,
      total,
      fecha: Date.now(),
      detalle: pedidos.map(p => ({
        nombre: p.nombre,
        cantidad: p.cantidad,
        precio: p.precio
      })),
      metodo_pago: pagos
    })

    for (const p of pedidos) {
      const producto = productos.find(pr => pr.id === p.producto_id)
      if (producto) {
        await actualizar('productos', {
          ...producto,
          stock: producto.stock - p.cantidad
        })
      }
    }

    const pedidosMesa = await getByIndex('pedidos', 'mesa_id', mesa.id)
    for (const p of pedidosMesa) {
      await eliminar('pedidos', p.id)
    }

    await actualizar('mesas', { ...mesa, estado: 'libre' })

    onToast(`Mesa ${mesa.numero || mesa.nombre} cerrada correctamente`)
    setMostrarModalPago(false)
    onActualizarMesa()
    onVolver()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#111',
      color: 'white',
      overflowY: 'auto',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
        <button
          onClick={onVolver}
          style={{
            background: 'none',
            border: '1px solid #444',
            color: 'white',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          ← Volver
        </button>
        <h2 style={{ margin: 0 }}>{mesa.nombre || `Mesa ${mesa.numero}`}</h2>
      </div>

      <h3 style={{ color: '#aaa', marginBottom: '10px' }}>Agregar productos</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '10px',
        marginBottom: '24px'
      }}>
        {productos.map(producto => (
          <button
            key={producto.id}
            onClick={() => agregarProducto(producto)}
            style={{
              backgroundColor: producto.stock > 0 ? '#1a73e8' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '14px 10px',
              fontSize: '14px',
              cursor: producto.stock > 0 ? 'pointer' : 'not-allowed',
              textAlign: 'left'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{producto.nombre}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>${producto.precio.toLocaleString()}</div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>Stock: {producto.stock}</div>
          </button>
        ))}
      </div>

      <h3 style={{ color: '#aaa', marginBottom: '10px' }}>Pedido actual</h3>
      {pedidos.length === 0 ? (
        <p style={{ color: '#555' }}>Sin productos todavía.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {pedidos.map(pedido => (
            <div key={pedido.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#1e1e1e',
              borderRadius: '10px',
              padding: '12px 16px'
            }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{pedido.nombre}</div>
                <div style={{ fontSize: '13px', color: '#aaa' }}>
                  ${pedido.precio?.toLocaleString()} × {pedido.cantidad}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 'bold' }}>
                  ${((pedido.precio || 0) * pedido.cantidad).toLocaleString()}
                </span>
                <button
                  onClick={() => quitarProducto(pedido)}
                  style={{
                    background: '#c0392b',
                    border: 'none',
                    color: 'white',
                    borderRadius: '6px',
                    width: '28px',
                    height: '28px',
                    fontSize: '16px',
                    cursor: 'pointer'
                  }}
                >
                  −
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        position: 'sticky',
        bottom: '16px',
        backgroundColor: '#1e1e1e',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ color: '#aaa', fontSize: '13px' }}>Total</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${total.toLocaleString()}</div>
        </div>
        <button
          onClick={() => setMostrarModalPago(true)}
          disabled={pedidos.length === 0}
          style={{
            backgroundColor: pedidos.length > 0 ? '#2a9d5c' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '14px 20px',
            fontSize: '16px',
            cursor: pedidos.length > 0 ? 'pointer' : 'not-allowed'
          }}
        >
          Cerrar cuenta
        </button>
      </div>

      {mostrarModalPago && (
        <ModalPago
          total={total}
          onConfirmar={confirmarPago}
          onCancelar={() => setMostrarModalPago(false)}
        />
      )}
    </div>
  )
}

export default DetalleMesa
