// Modal de confirmacion reutilizable para "eliminar mesa", extraido de
// MesasGenerico.jsx. Reemplaza al window.confirm original; mismo estilo
// claro que ModalPago.jsx (overlay oscuro semitransparente + tarjeta blanca).
function ModalConfirmarEliminarMesa({ mesa, onConfirmar, onCancelar }) {
  if (!mesa) return null
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '360px',
        color: '#1a1a1a',
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>
          ¿Eliminar Mesa {mesa.numero}?
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancelar}
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
          <button
            onClick={onConfirmar}
            style={{
              flex: 1,
              backgroundColor: '#c0392b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '15px',
              cursor: 'pointer'
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalConfirmarEliminarMesa
