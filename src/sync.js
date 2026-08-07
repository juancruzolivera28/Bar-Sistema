import { getAll, actualizar, agregar, eliminar } from './db/database.js'

let ws = null
let reconectarTimer = null
const IP_SERVIDOR = window.location.hostname

export function iniciarSync(onCambio) {
  conectar(onCambio)
}

function conectar(onCambio) {
  try {
    ws = new WebSocket(`ws://${IP_SERVIDOR}:4000`)

    ws.onopen = () => {
      console.log('Sync conectado')
      if (reconectarTimer) {
        clearTimeout(reconectarTimer)
        reconectarTimer = null
      }
    }

    ws.onmessage = async (event) => {
      try {
        const mensaje = JSON.parse(event.data)
        await aplicarCambio(mensaje)
        onCambio()
      } catch (err) {
        console.error('Error procesando mensaje sync:', err)
      }
    }

    ws.onclose = () => {
      console.log('Sync desconectado, reintentando en 3s...')
      reconectarTimer = setTimeout(() => conectar(onCambio), 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  } catch (err) {
    console.error('Error al conectar sync:', err)
    reconectarTimer = setTimeout(() => conectar(onCambio), 3000)
  }
}

export function enviarCambio(tipo, datos) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ tipo, datos, timestamp: Date.now() }))
  }
}

async function aplicarCambio(mensaje) {
  const { tipo, datos } = mensaje

  switch (tipo) {
    case 'mesa_actualizada':
      await actualizar('mesas', datos)
      break

    case 'pedido_agregado':
      const pedidos = await getAll('pedidos')
      const existente = pedidos.find(p => p.mesa_id === datos.mesa_id && p.producto_id === datos.producto_id)
      if (existente) {
        await actualizar('pedidos', { ...existente, cantidad: datos.cantidad, timestamp: datos.timestamp })
      } else {
        const { id, ...sinId } = datos
        await agregar('pedidos', sinId)
      }
      break

    case 'pedido_eliminado':
      const todosPedidos = await getAll('pedidos')
      const pedidoLocal = todosPedidos.find(p =>
        p.mesa_id === datos.mesa_id &&
        p.producto_id === datos.producto_id
      )
      if (pedidoLocal) {
        if (datos.cantidad > 0) {
          await actualizar('pedidos', { ...pedidoLocal, cantidad: datos.cantidad })
        } else {
          await eliminar('pedidos', pedidoLocal.id)
        }
      }
      break

    case 'cuenta_cerrada':
      const pedidosMesa = await getAll('pedidos')
      for (const p of pedidosMesa.filter(p => p.mesa_id === datos.mesa_id)) {
        await eliminar('pedidos', p.id)
      }
      await actualizar('mesas', { ...datos.mesa, estado: 'libre' })
      const productos = await getAll('productos')
      for (const item of datos.detalle) {
        const producto = productos.find(p => p.nombre === item.nombre)
        if (producto) {
          await actualizar('productos', { ...producto, stock: producto.stock - item.cantidad })
        }
      }
      await agregar('historial', datos.historial)
      break

    case 'mesa_extra_agregada':
      await agregar('mesas', datos)
      break

    case 'mesa_extra_eliminada':
      const todasMesas = await getAll('mesas')
      const mesaLocal = todasMesas.find(m => m.numero === datos.numero && m.fija === 0)
      if (mesaLocal) {
        await eliminar('mesas', mesaLocal.id)
      }
      break

    default:
      break
  }
}
