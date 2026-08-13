import { WebSocketServer } from 'ws'
import { createServer } from 'http'

const PORT = process.env.PORT || 4000

const server = createServer((req, res) => {
  res.writeHead(200)
  res.end('WebSocket server corriendo')
})

const wss = new WebSocketServer({ server })

const clientes = new Set()

wss.on('connection', (ws) => {
  clientes.add(ws)
  console.log(`Cliente conectado. Total: ${clientes.size}`)

  ws.on('message', (mensaje) => {
    const datos = mensaje.toString()
    clientes.forEach((cliente) => {
      if (cliente !== ws && cliente.readyState === 1) {
        cliente.send(datos)
      }
    })
  })

  ws.on('close', () => {
    clientes.delete(ws)
    console.log(`Cliente desconectado. Total: ${clientes.size}`)
  })

  ws.on('error', (err) => {
    console.error('Error WebSocket:', err.message)
    clientes.delete(ws)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
})
