import { useState, useEffect, useRef } from 'react'
import { getAll, getByIndex, agregar, actualizar, eliminar, getRestauranteId } from '../db/database.js'
import { supabase } from '../db/supabaseClient.js'
import ModalPago from './ModalPago.jsx'
import { iniciarSyncMesa } from '../sync.js'

// Una fila de pedido "optimista" todavia no existe en la base: su id es un
// string temporal (ver agregarProducto) hasta que cargarPedidos() la reemplaza
// por la fila real. No se puede mandar ese id a Supabase.
const esOptimista = (id) => typeof id === 'string' && id.startsWith('optimista-')

function DetalleMesa({ mesa, onVolver, onActualizarMesa, onToast, refrescar }) {
  const [pedidos, setPedidos] = useState([])
  const [productos, setProductos] = useState([])
  // Catalogo tambien en un ref: cargarPedidos() lo lee para enriquecer las
  // filas con nombre/precio sin depender del closure de estado, que quedaria
  // viejo cuando lo invoca el callback de iniciarSyncMesa (suscripto una vez).
  const productosRef = useRef([])
  // Reflejo local del estado de la mesa. Sirve para el update optimista de
  // "agregar producto" (marcar 'ocupada' sin esperar al servidor) y para su
  // revert. La pantalla de detalle no dibuja el estado de la mesa (eso vive en
  // la grilla de atras), asi que hoy no tiene efecto visual aca, pero mantiene
  // el guard y el revert consistentes.
  // No se resincroniza con mesa.estado: DetalleMesa se monta de cero en cada
  // seleccion de mesa (al volver, App pone mesaSeleccionada=null y desmonta),
  // asi que el valor inicial siempre esta fresco.
  const [estadoMesa, setEstadoMesa] = useState(mesa.estado)
  const [mostrarModalPago, setMostrarModalPago] = useState(false)
  // Guard de doble submit del cierre de cuenta: mientras la RPC esta en vuelo,
  // confirmarPago corta al entrar y ModalPago deshabilita sus botones.
  const [cerrando, setCerrando] = useState(false)

  // Total derivado de pedidos: asi siempre coincide con lo que se ve en la
  // lista. Antes era un useState que seteaba cargarDatos, pero en cada alta
  // se disparan varias cargarDatos en paralelo (realtime de pedidos, realtime
  // de mesas, refresco global cada 5s y la llamada explicita). Si una leia la
  // mesa antes de que el INSERT fuera visible, terminaba pisando el total con 0.
  const total = pedidos.reduce((acc, p) => acc + (Number(p.precio) || 0) * p.cantidad, 0)

  useEffect(() => {
    const detener = iniciarSyncMesa(mesa.id, cargarPedidos)
    return () => detener()
  }, [mesa.id])

  useEffect(() => {
    cargarPedidos()
  }, [mesa.id, refrescar])

  // Catalogo de productos: no cambia durante el armado del pedido, asi que se
  // trae una sola vez (cargarPedidos lo dispara la primera vez, ver abajo) y no
  // se repite en cada alta ni en cada refresco.
  async function cargarCatalogo() {
    const todosProductos = await getAll('productos')
    todosProductos.sort((a, b) => a.nombre.localeCompare(b.nombre))
    productosRef.current = todosProductos
    setProductos(todosProductos)
  }

  // Pedidos de la mesa: se recarga en el montaje, en cada bump de refrescar, en
  // cada evento de Realtime y despues de cada operacion. La primera vez tambien
  // trae el catalogo para poder enriquecer las filas.
  async function cargarPedidos() {
    if (productosRef.current.length === 0) await cargarCatalogo()
    const pedidosMesa = await getByIndex('pedidos', 'mesa_id', mesa.id)
    const catalogo = productosRef.current
    const pedidosConNombre = pedidosMesa.map((p) => {
      const producto = catalogo.find(pr => pr.id === p.producto_id)
      return { ...p, nombre: producto?.nombre, precio: producto?.precio }
    })
    setPedidos(pedidosConNombre)
  }

  async function agregarProducto(producto) {
    if (producto.stock <= 0) {
      alert(`${producto.nombre} sin stock.`)
      return
    }

    // --- Update optimista: reflejamos el alta en pantalla YA, antes de tocar
    // Supabase. Las escrituras de abajo corren despues y el cargarPedidos()
    // final reconcilia el estado optimista con el real del servidor.
    const pedidosPrevios = pedidos
    const estadoMesaPrevio = estadoMesa

    setPedidos(prev => {
      const yaEsta = prev.find(p => p.producto_id === producto.id)
      if (yaEsta) {
        return prev.map(p =>
          p.producto_id === producto.id
            ? { ...p, cantidad: p.cantidad + 1 }
            : p
        )
      }
      return [
        ...prev,
        {
          // id temporal: cargarPedidos() lo reemplaza por la fila real.
          id: `optimista-${producto.id}-${Date.now()}`,
          mesa_id: mesa.id,
          producto_id: producto.id,
          cantidad: 1,
          nombre: producto.nombre,
          precio: producto.precio
        }
      ]
    })
    if (estadoMesa !== 'ocupada') setEstadoMesa('ocupada')

    // Buscamos el pedido existente en el estado local (ya lo tenemos en
    // memoria) en vez de un nuevo getByIndex. Solo cuenta si es una fila real:
    // si es optimista, la escritura de ese click todavia esta en vuelo.
    const enPedidoLocal = pedidos.find(p => p.producto_id === producto.id)
    const existenteReal = enPedidoLocal && !esOptimista(enPedidoLocal.id) ? enPedidoLocal : null

    try {
      if (existenteReal) {
        // Payload explicito con solo columnas reales de 'pedidos' (nombre y
        // precio son campos que agregamos en el cliente, no columnas).
        await actualizar('pedidos', {
          id: existenteReal.id,
          mesa_id: existenteReal.mesa_id,
          producto_id: existenteReal.producto_id,
          cantidad: existenteReal.cantidad + 1,
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

      // Solo tocamos 'mesas' si de verdad venia sin ocupar (primer producto de
      // la sesion). estadoMesaPrevio es el valor de antes del setEstadoMesa.
      if (estadoMesaPrevio !== 'ocupada') {
        await actualizar('mesas', { ...mesa, estado: 'ocupada' })
      }
      onActualizarMesa()
      cargarPedidos()
    } catch {
      // Revert: volvemos pedidos y el reflejo local de la mesa a como estaban
      // antes del click. realtime / el intervalo global reconcilian el resto.
      setPedidos(pedidosPrevios)
      setEstadoMesa(estadoMesaPrevio)
      onToast(`No se pudo agregar "${producto.nombre}". La acción no se guardó.`, 'error')
    }
  }

  async function quitarProducto(pedido) {
    // Fila todavia optimista: el boton "-" ya deberia estar deshabilitado en el
    // render, pero ademas cortamos aca para no mandar el id temporal a Supabase.
    if (esOptimista(pedido.id)) return

    const pedidosPrevios = pedidos

    // Update optimista: bajamos la cantidad (o sacamos la fila si llega a 0)
    // antes de tocar Supabase. cargarPedidos() reconcilia despues.
    setPedidos(prev => prev
      .map(p => p.id === pedido.id ? { ...p, cantidad: p.cantidad - 1 } : p)
      .filter(p => p.cantidad > 0)
    )

    try {
      if (pedido.cantidad > 1) {
        await actualizar('pedidos', {
          id: pedido.id,
          mesa_id: pedido.mesa_id,
          producto_id: pedido.producto_id,
          cantidad: pedido.cantidad - 1,
          timestamp: Date.now()
        })
      } else {
        await eliminar('pedidos', pedido.id)
      }
      cargarPedidos()
    } catch {
      setPedidos(pedidosPrevios)
      onToast(`No se pudo quitar "${pedido.nombre}". La acción no se guardó.`, 'error')
    }
  }

  async function confirmarPago(pagos) {
    // Todo el cierre (historial + descuento de stock + borrado de pedidos +
    // liberar la mesa) lo hace la RPC cerrar_cuenta en UNA transaccion atomica
    // del lado del servidor. Ver supabase/cerrar_cuenta_rpc.sql.
    if (cerrando) return
    setCerrando(true)
    try {
      const { error } = await supabase.rpc('cerrar_cuenta', {
        p_mesa_id: mesa.id,
        p_restaurante_id: getRestauranteId(),
        p_metodo_pago: pagos
      })
      if (error) throw error
      onToast(`Mesa ${mesa.numero || mesa.nombre} cerrada correctamente`)
      setMostrarModalPago(false)
      onActualizarMesa()
      onVolver()
    } catch (err) {
      // La transaccion se revirtio entera: no queda nada a medias. Reactivamos
      // los botones y dejamos el modal abierto para reintentar.
      onToast(`No se pudo cerrar la cuenta.${err?.message ? ` (${err.message})` : ''} Volvé a intentar.`, 'error')
      setCerrando(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#ffffff',
      color: '#1a1a1a',
      overflowY: 'auto',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
        <button
          onClick={onVolver}
          style={{
            background: 'none',
            border: '1px solid #ccc',
            color: '#1a1a1a',
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

      <h3 style={{ color: '#666', marginBottom: '10px' }}>Agregar productos</h3>
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
              backgroundColor: producto.stock > 0 ? '#1a73e8' : '#e0e0e0',
              color: producto.stock > 0 ? 'white' : '#999',
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

      <h3 style={{ color: '#666', marginBottom: '10px' }}>Pedido actual</h3>
      {pedidos.length === 0 ? (
        <p style={{ color: '#888' }}>Sin productos todavía.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {pedidos.map(pedido => {
            // Mientras la fila sea optimista (id temporal) no se puede operar
            // contra la base: deshabilitamos "-" hasta que cargarPedidos() la
            // reemplace por la fila real. Se rehabilita solo.
            const filaOptimista = esOptimista(pedido.id)
            return (
              <div key={pedido.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f4f4f5',
                border: '1px solid #e0e0e0',
                borderRadius: '10px',
                padding: '12px 16px'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{pedido.nombre}</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    ${pedido.precio?.toLocaleString()} × {pedido.cantidad}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 'bold' }}>
                    ${((pedido.precio || 0) * pedido.cantidad).toLocaleString()}
                  </span>
                  <button
                    onClick={() => quitarProducto(pedido)}
                    disabled={filaOptimista}
                    style={{
                      background: '#c0392b',
                      border: 'none',
                      color: 'white',
                      borderRadius: '6px',
                      width: '28px',
                      height: '28px',
                      fontSize: '16px',
                      cursor: filaOptimista ? 'not-allowed' : 'pointer',
                      opacity: filaOptimista ? 0.5 : 1
                    }}
                  >
                    −
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{
        position: 'sticky',
        bottom: '16px',
        backgroundColor: '#f4f4f5',
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ color: '#666', fontSize: '13px' }}>Total</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${total.toLocaleString()}</div>
        </div>
        <button
          onClick={() => setMostrarModalPago(true)}
          disabled={pedidos.length === 0}
          style={{
            backgroundColor: pedidos.length > 0 ? '#2a9d5c' : '#e0e0e0',
            color: pedidos.length > 0 ? 'white' : '#999',
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
          procesando={cerrando}
          onConfirmar={confirmarPago}
          onCancelar={() => setMostrarModalPago(false)}
        />
      )}
    </div>
  )
}

export default DetalleMesa
