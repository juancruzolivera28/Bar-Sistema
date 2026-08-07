import { useState } from 'react'

function ModalPago({ total, onConfirmar, onCancelar }) {
  const [modo, setModo] = useState(null) // null | 'mixto'
  const [pagos, setPagos] = useState([])
  const [metodoActual, setMetodoActual] = useState('efectivo')
  const [montoActual, setMontoActual] = useState('')

  const totalPagado = pagos.reduce((acc, p) => acc + p.monto, 0)
  const falta = total - totalPagado

  function pagoDirecto(metodo) {
    onConfirmar([{ metodo, monto: total }])
  }

  function agregarPago() {
    const monto = parseFloat(montoActual)
    if (!monto || monto <= 0) {
      alert('Ingresá un monto válido.')
      return
    }
    if (monto > falta) {
      alert(`El monto no puede superar lo que falta: $${falta.toLocaleString()}`)
      return
    }
    setPagos([...pagos, { metodo: metodoActual, monto }])
    setMontoActual('')
  }

  function quitarPago(index) {
    setPagos(pagos.filter((_, i) => i !== index))
  }

  function etiquetaMetodo(metodo) {
    if (metodo === 'efectivo') return 'Efectivo'
    if (metodo === 'transferencia') return 'Transferencia'
    if (metodo === 'tarjeta') return 'Tarjeta'
    return metodo
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '420px',
        color: 'white'
      }}>

        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Cerrar cuenta</h3>
        <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>
          Total: ${total.toLocaleString()}
        </div>

        {modo === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {['efectivo', 'transferencia', 'tarjeta'].map((metodo) => (
                <button
                  key={metodo}
                  onClick={() => pagoDirecto(metodo)}
                  style={{
                    backgroundColor: '#2a2a2a',
                    color: 'white',
                    border: '1px solid #444',
                    borderRadius: '10px',
                    padding: '16px',
                    fontSize: '15px',
                    cursor: 'pointer'
                  }}
                >
                  {etiquetaMetodo(metodo)}
                </button>
              ))}
              <button
                onClick={() => setModo('mixto')}
                style={{
                  backgroundColor: '#1a73e8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '16px',
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Mixto
              </button>
            </div>
            <button
              onClick={onCancelar}
              style={{
                backgroundColor: 'transparent',
                color: '#aaa',
                border: 'none',
                padding: '10px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        )}

        {modo === 'mixto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div style={{
              backgroundColor: '#2a2a2a',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span style={{ color: '#aaa' }}>Pagado</span>
              <span style={{ fontWeight: 'bold' }}>${totalPagado.toLocaleString()}</span>
            </div>

            <div style={{
              backgroundColor: falta > 0 ? '#3a2a00' : '#1a3a2a',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span style={{ color: '#aaa' }}>Falta</span>
              <span style={{ fontWeight: 'bold', color: falta > 0 ? '#e07b00' : '#2a9d5c' }}>
                ${falta.toLocaleString()}
              </span>
            </div>

            {pagos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {pagos.map((pago, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}>
                    <span>{etiquetaMetodo(pago.metodo)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>${pago.monto.toLocaleString()}</span>
                      <button
                        onClick={() => quitarPago(i)}
                        style={{
                          background: '#c0392b',
                          border: 'none',
                          color: 'white',
                          borderRadius: '4px',
                          width: '22px',
                          height: '22px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {falta > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['efectivo', 'transferencia', 'tarjeta'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetodoActual(m)}
                      style={{
                        flex: 1,
                        backgroundColor: metodoActual === m ? '#1a73e8' : '#2a2a2a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {etiquetaMetodo(m)}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder={`Monto (máx $${falta.toLocaleString()})`}
                    value={montoActual}
                    onChange={(e) => setMontoActual(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '15px',
                      color: 'white'
                    }}
                  />
                  <button
                    onClick={agregarPago}
                    style={{
                      backgroundColor: '#2a9d5c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '15px',
                      cursor: 'pointer'
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => { setModo(null); setPagos([]) }}
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
                Atrás
              </button>
              <button
                onClick={() => onConfirmar(pagos)}
                disabled={falta > 0}
                style={{
                  flex: 1,
                  backgroundColor: falta === 0 ? '#2a9d5c' : '#333',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '15px',
                  cursor: falta === 0 ? 'pointer' : 'not-allowed'
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ModalPago
