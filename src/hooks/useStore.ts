
const DB_NAME = 'synthetic-md'
const STORE_NAME = 'documents'
const TEXT_KEY = 'text'

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open DB'))
  })

const loadText = async () => {
  const db = await openDb()
  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(TEXT_KEY)

    request.onsuccess = () => resolve((request.result as string | undefined) ?? '')
    request.onerror = () => reject(request.error ?? new Error('Failed to read from DB'))
  })
}

const saveText = async (text: string) => {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(text, TEXT_KEY)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? request.error ?? new Error('Failed to write to DB'))
  })
}

function useStore() {
    return {
        loadText,
        saveText,
    }
}

export default useStore
