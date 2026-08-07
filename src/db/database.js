const DB_NAME = 'bar_sistema'
const DB_VERSION = 1

let db = null

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains('mesas')) {
        const mesasStore = db.createObjectStore('mesas', { keyPath: 'id', autoIncrement: true })
        mesasStore.createIndex('numero', 'numero', { unique: false })
      }

      if (!db.objectStoreNames.contains('productos')) {
        db.createObjectStore('productos', { keyPath: 'id', autoIncrement: true })
      }

      if (!db.objectStoreNames.contains('pedidos')) {
        const pedidosStore = db.createObjectStore('pedidos', { keyPath: 'id', autoIncrement: true })
        pedidosStore.createIndex('mesa_id', 'mesa_id', { unique: false })
      }

      if (!db.objectStoreNames.contains('historial')) {
        const historialStore = db.createObjectStore('historial', { keyPath: 'id', autoIncrement: true })
        historialStore.createIndex('fecha', 'fecha', { unique: false })
      }

      if (!db.objectStoreNames.contains('configuracion')) {
        db.createObjectStore('configuracion', { keyPath: 'clave' })
      }
    }

    request.onsuccess = async (event) => {
      db = event.target.result
      await insertarDatosInicialesSeNecesario()
      resolve(db)
    }

    request.onerror = (event) => {
      reject(event.target.error)
    }
  })
}

async function insertarDatosInicialesSeNecesario() {
  const mesas = await getAll('mesas')
  if (mesas.length > 0) return

  const mesasIniciales = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18,
    19, 20, 21, 22, 23, 24, 25
  ]

  for (const numero of mesasIniciales) {
    await agregar('mesas', { numero, estado: 'libre', nombre: null, fija: 1 })
  }
  await agregar('mesas', { numero: 0, estado: 'libre', nombre: 'Barra', fija: 1 })

  const productos = [
  { nombre: 'Coca Cola', precio: 1500, stock: 24, stockMinimo: 6 },
  { nombre: 'Agua', precio: 800, stock: 20, stockMinimo: 4 },
  { nombre: 'Cerveza', precio: 2000, stock: 30, stockMinimo: 8 },
  { nombre: 'Fernet', precio: 2500, stock: 15, stockMinimo: 3 },
  { nombre: 'Papas fritas', precio: 1800, stock: 10, stockMinimo: 2 },
]

  for (const producto of productos) {
    await agregar('productos', producto)
  }

  await agregar('configuracion', { clave: 'pin_dueno', valor: '1234' })
}

export function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function getByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.getAll(value)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function getOne(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function agregar(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.add(data)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function actualizar(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.put(data)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function eliminar(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.delete(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
