// Estilos compartidos por las pantallas de login (Login / LoginDueno / LoginMozo).
// Tema claro, consistente con el resto de la app.
export const estilos = {
  pantalla: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#1a1a1a',
    padding: '16px'
  },
  input: {
    width: '260px',
    backgroundColor: '#ffffff',
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '15px',
    color: '#1a1a1a',
    boxSizing: 'border-box'
  },
  botonPrimario: {
    width: '260px',
    backgroundColor: '#1a73e8',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontSize: '15px',
    cursor: 'pointer'
  },
  botonSecundario: {
    width: '260px',
    backgroundColor: '#f4f4f5',
    color: '#1a1a1a',
    border: '1px solid #ddd',
    borderRadius: '10px',
    padding: '14px',
    fontSize: '15px',
    cursor: 'pointer'
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#1a73e8',
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  error: {
    color: '#c0392b',
    fontSize: '14px',
    margin: '4px 0 0 0',
    maxWidth: '260px',
    textAlign: 'center'
  }
}
