import { useState, useEffect } from 'react'
import { supabase } from '../db/supabaseClient.js'

// Pantalla (solo dueño) para ver y regenerar el codigo_acceso del
// restaurante. Los mozos lo usan una unica vez en su dispositivo para
// vincularse (LoginMozo.jsx). Sin esta pantalla, un restaurante nuevo no
// tiene forma de dar de alta a sus mozos.
function CodigoAcceso({ restauranteId }) {
  const [codigo, setCodigo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [regenerando, setRegenerando] = useState(false)

  // Carga inicial del codigo. `cargando` ya arranca en true y solo se carga
  // una vez, asi que no hace falta volver a setearlo aca (y evita setState
  // sincrono dentro del efecto).
  async function cargarCodigo() {
    const { data, error: err } = await supabase
      .from('restaurantes')
      .select('codigo_acceso')
      .eq('id', restauranteId)
      .maybeSingle()
    setCargando(false)
    if (err || !data) {
      setError('No se pudo cargar el código.')
      return
    }
    setCodigo(data.codigo_acceso)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarCodigo()
  }, [restauranteId])

  async function copiar() {
    if (!codigo) return
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError('No se pudo copiar automáticamente. Copialo a mano.')
    }
  }

  async function regenerar() {
    const ok = window.confirm(
      'Vas a generar un código NUEVO.\n\n' +
      'El código actual va a dejar de servir para vincular dispositivos NUEVOS.\n\n' +
      'Los mozos que ya lo usaron NO se ven afectados: su celular ya tiene el ' +
      'acceso guardado y no vuelve a pedir el código.\n\n' +
      '¿Regenerar el código?'
    )
    if (!ok) return
    setRegenerando(true)
    setError('')
    const { data, error: err } = await supabase.rpc('regenerar_codigo_restaurante')
    setRegenerando(false)
    if (err) {
      setError('No se pudo regenerar el código. Reintentá.')
      return
    }
    setCodigo(data)
    setCopiado(false)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#ffffff',
      color: '#1a1a1a',
      overflowY: 'auto',
      padding: '16px',
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom))'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <h2 style={{ margin: 0 }}>Código de acceso</h2>
      </div>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px 0', maxWidth: '420px' }}>
        Compartí este código con tus mozos para que puedan acceder al sistema
        desde sus celulares. Lo ingresan una sola vez.
      </p>

      <div style={{
        backgroundColor: '#f4f4f5',
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '24px 16px',
        maxWidth: '420px',
        textAlign: 'center'
      }}>
        {cargando ? (
          <div style={{ color: '#666', fontSize: '15px' }}>Cargando...</div>
        ) : (
          <>
            <div style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '40px',
              fontWeight: 'bold',
              letterSpacing: '0.32em',
              // el letter-spacing agrega espacio a la derecha del ultimo char:
              // lo compensamos para que el bloque quede centrado
              paddingLeft: '0.32em',
              color: '#1a1a1a',
              wordBreak: 'break-all'
            }}>
              {codigo || '—'}
            </div>

            <button
              onClick={copiar}
              disabled={!codigo}
              style={{
                marginTop: '18px',
                backgroundColor: '#1a73e8',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 22px',
                fontSize: '15px',
                cursor: codigo ? 'pointer' : 'not-allowed'
              }}
            >
              {copiado ? '¡Copiado!' : 'Copiar'}
            </button>
          </>
        )}
      </div>

      <div style={{ maxWidth: '420px', marginTop: '28px' }}>
        <button
          onClick={regenerar}
          disabled={regenerando || cargando}
          style={{
            backgroundColor: '#ffffff',
            color: '#c0392b',
            border: '1px solid #e0a9a2',
            borderRadius: '10px',
            padding: '12px 18px',
            fontSize: '15px',
            cursor: (regenerando || cargando) ? 'not-allowed' : 'pointer'
          }}
        >
          {regenerando ? 'Regenerando...' : 'Regenerar código'}
        </button>
        <p style={{ color: '#666', fontSize: '13px', margin: '10px 0 0 0' }}>
          Genera un código nuevo. El anterior deja de servir para vincular
          dispositivos nuevos; los mozos ya vinculados siguen funcionando.
        </p>
      </div>

      {error && (
        <p style={{ color: '#c0392b', fontSize: '14px', marginTop: '16px', maxWidth: '420px' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export default CodigoAcceso
