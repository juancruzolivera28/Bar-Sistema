import { useState, useEffect } from 'react'
import { getAll, agregar, actualizar, eliminar } from '../db/database.js'

function Stock({ refrescarStock }) {
  const [productos, setProductos] = useState([])
  const [editando, setEditando] = useState(null)
  const [nuevoProducto, setNuevoProducto] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    precio: '',
    stock: '',
    stockMinimo: ''
  })

  useEffect(() => {
    cargarProductos()
  }, [refrescarStock])

  async function cargarProductos() {
    const todos = await getAll('productos')
    todos.sort((a, b) => a.nombre.localeCompare(b.nombre))
    setProductos(todos)
  }

  function abrirEdicion(producto) {
    setEditando(producto.id)
    setNuevoProducto(false)
    setForm({
      nombre: producto.nombre,
      precio: producto.precio.toString(),
      stock: producto.stock.toString(),
      stockMinimo: (producto.stockMinimo || 0).toString()
    })
  }

  function abrirNuevo() {
    setNuevoProducto(true)
    setEditando(null)
    setForm({ nombre: '', precio: '', stock: '', stockMinimo: '' })
  }

  function cancelar() {
    setEditando(null)
    setNuevoProducto(false)
    setForm({ nombre: '', precio: '', stock: '', stockMinimo: '' })
  }

  async function guardarEdicion() {
    if (!form.nombre || !form.precio || !form.stock) {
      alert('Completá todos los campos.')
      return
    }
    const producto = productos.find(p => p.id === editando)
    const productoActualizado = {
      ...producto,
      nombre: form.nombre,
      precio: parseFloat(form.precio),
      stock: parseInt(form.stock),
      stockMinimo: parseInt(form.stockMinimo) || 0
    }
    await actualizar('productos', productoActualizado)
    cancelar()
    cargarProductos()
  }

  async function guardarNuevo() {
    if (!form.nombre || !form.precio || !form.stock) {
      alert('Completá todos los campos.')
      return
    }
    const productoNuevo = {
      nombre: form.nombre,
      precio: parseFloat(form.precio),
      stock: parseInt(form.stock),
      stockMinimo: parseInt(form.stockMinimo) || 0
    }
    await agregar('productos', productoNuevo)
    cancelar()
    cargarProductos()
  }

  async function eliminarProducto(producto) {
    const confirmar = window.confirm(`¿Eliminar ${producto.nombre}?`)
    if (!confirmar) return
    await eliminar('productos', producto.id)
    cargarProductos()
  }

  function colorStock(producto) {
    if (producto.stock === 0) return '#c0392b'
    if (producto.stockMinimo && producto.stock <= producto.stockMinimo) return '#e07b00'
    return '#2a9d5c'
  }

  const productosBajoStock = productos.filter(p => p.stockMinimo && p.stock <= p.stockMinimo)

  const formulario = (
    <div style={{
      backgroundColor: '#1e1e1e',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <input
        placeholder="Nombre del producto"
        value={form.nombre}
        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        style={estiloInput}
      />
      <input
        placeholder="Precio"
        type="number"
        value={form.precio}
        onChange={(e) => setForm({ ...form, precio: e.target.value })}
        style={estiloInput}
      />
      <input
        placeholder="Stock"
        type="number"
        value={form.stock}
        onChange={(e) => setForm({ ...form, stock: e.target.value })}
        style={estiloInput}
      />
      <input
        placeholder="Stock mínimo"
        type="number"
        value={form.stockMinimo}
        onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
        style={estiloInput}
      />
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={nuevoProducto ? guardarNuevo : guardarEdicion}
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
            backgroundColor: '#333',
            color: 'white',
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
      backgroundColor: '#111',
      color: 'white',
      overflowY: 'auto',
      padding: '16px',
      paddingBottom: '80px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
        <h2 style={{ margin: 0 }}>Stock</h2>
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
          + Producto
        </button>
      </div>

      {productosBajoStock.length > 0 && (
        <div style={{
          backgroundColor: '#e07b00',
          color: 'white',
          padding: '12px',
          borderRadius: '10px',
          marginBottom: '16px',
          fontWeight: 'bold'
        }}>
          ⚠ {productosBajoStock.length} productos con stock bajo
        </div>
      )}

      {nuevoProducto && formulario}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {productos.map((producto) => (
          <div key={producto.id}>
            {editando === producto.id ? formulario : (
              <div style={{
                backgroundColor: '#1e1e1e',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{producto.nombre}</div>
                  <div style={{ fontSize: '13px', color: '#aaa', marginTop: '2px' }}>
                    ${producto.precio.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    Mín: {producto.stockMinimo || 0}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    backgroundColor: colorStock(producto),
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '13px',
                    fontWeight: 'bold'
                  }}>
                    {producto.stock} unid.
                  </span>
                  <button
                    onClick={() => abrirEdicion(producto)}
                    style={{
                      background: '#333',
                      border: 'none',
                      color: 'white',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => eliminarProducto(producto)}
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
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const estiloInput = {
  backgroundColor: '#2a2a2a',
  border: '1px solid #444',
  borderRadius: '8px',
  padding: '12px',
  fontSize: '15px',
  color: 'white',
  width: '100%',
  boxSizing: 'border-box'
}

export default Stock
