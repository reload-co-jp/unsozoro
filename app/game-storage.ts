export type LocationLog = {
  latitude: number
  longitude: number
  timestamp: number
  accuracy: number
}

export type SavedGame = {
  courseId: number
  startedAt: number
  updatedAt: number
  cleared: boolean
  visitedCells: string[]
  discoveredIds: number[]
  locations: LocationLog[]
}

const DATABASE = "unsozoro"
const STORE = "games"

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "courseId" })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

export const loadGame = async (courseId: number): Promise<SavedGame | null> => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE).objectStore(STORE).get(courseId)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

export const saveGame = async (game: SavedGame) => {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE, "readwrite").objectStore(STORE).put(game)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
