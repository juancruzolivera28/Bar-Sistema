import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Registra el service worker y, cuando detecta una versión nueva ya
// instalada, recarga la página sola. Sin esto, una pestaña que quedó
// abierta desde antes de un deploy sigue corriendo el JS viejo hasta
// que alguien la cierra y la abre de nuevo a mano.
registerSW({ immediate: true })

let recargandoPorActualizacion = false
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargandoPorActualizacion) return
    recargandoPorActualizacion = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
