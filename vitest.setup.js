import 'fake-indexeddb/auto'

if (!globalThis.crypto) globalThis.crypto = {}
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
}

// Vitest 4's built-in localStorage stub doesn't implement the full Storage
// interface (no getItem/setItem/clear). Replace it with a plain in-memory
// shim that does so sync.js's watermark persistence works in tests.
const makeLocalStorage = () => {
  const store = new Map()
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
    clear: () => { store.clear() },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
  return new Proxy(ls, {
    ownKeys: () => Array.from(store.keys()),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    has: (target, key) => key in target || store.has(key),
  })
}

Object.defineProperty(globalThis, 'localStorage', {
  value: makeLocalStorage(),
  writable: true,
  configurable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: globalThis.localStorage,
    writable: true,
    configurable: true,
  })
}
