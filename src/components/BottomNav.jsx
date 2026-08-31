import { NAV_ITEMS, COLOR_ACTIVO, COLOR_INACTIVO, ALTO_BOTTOM_NAV } from './bottomNavConfig.js'

export default function BottomNav({ rol, pantalla, onCambiarPantalla }) {
  const items = NAV_ITEMS.filter(item => item.roles.includes(rol))

  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: `${ALTO_BOTTOM_NAV}px`,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e0e0e0',
        zIndex: 900,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map(({ ruta, label, icono: Icono }) => {
        const activo = pantalla === ruta
        return (
          <button
            key={ruta}
            type="button"
            onClick={() => onCambiarPantalla(ruta)}
            aria-label={label}
            title={label}
            aria-current={activo ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: activo ? COLOR_ACTIVO : COLOR_INACTIVO,
            }}
          >
            <Icono size={26} strokeWidth={activo ? 2.4 : 2} color="currentColor" />
          </button>
        )
      })}
    </nav>
  )
}
