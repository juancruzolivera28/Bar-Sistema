import { useRef, useState, useEffect } from 'react'

// Hook generico de long-press por puntero (touch + mouse), extraido de la
// implementacion original en MesasGenerico.jsx. No sabe nada de mesas: recibe
// un callback onLongPress(item) y devuelve, por item, los handlers de puntero
// a aplicar sobre la tarjeta. Un toque normal (soltar antes de LONG_PRESS_MS,
// o moverse mas de UMBRAL_MOVIMIENTO_PX) dispara onTap(item) via el onClick
// devuelto; un long press completo dispara onLongPress(item) y suprime el
// click posterior.
export const LONG_PRESS_MS = 600
const UMBRAL_MOVIMIENTO_PX = 10

export function useLongPress(onLongPress, duracionMs = LONG_PRESS_MS) {
  const [presionando, setPresionando] = useState(null)
  const timerRef = useRef(null)
  const disparadoRef = useRef(false)
  const inicioRef = useRef({ x: 0, y: 0 })
  const activoIdRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function cancelar() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    activoIdRef.current = null
    setPresionando(null)
  }

  function disparar(item) {
    disparadoRef.current = true
    timerRef.current = null
    activoIdRef.current = null
    setPresionando(null)
    onLongPress(item)
  }

  function obtenerHandlers(item, onTap) {
    return {
      onPointerDown: (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        disparadoRef.current = false
        inicioRef.current = { x: e.clientX, y: e.clientY }
        activoIdRef.current = item.id
        setPresionando(item.id)
        timerRef.current = setTimeout(() => disparar(item), duracionMs)
      },
      onPointerMove: (e) => {
        if (activoIdRef.current !== item.id) return
        const dx = e.clientX - inicioRef.current.x
        const dy = e.clientY - inicioRef.current.y
        if (Math.sqrt(dx * dx + dy * dy) > UMBRAL_MOVIMIENTO_PX) cancelar()
      },
      onPointerUp: cancelar,
      onPointerLeave: cancelar,
      onPointerCancel: cancelar,
      onContextMenu: (e) => e.preventDefault(),
      onClick: () => {
        if (disparadoRef.current) {
          disparadoRef.current = false
          return
        }
        onTap(item)
      }
    }
  }

  return { presionando, obtenerHandlers }
}
