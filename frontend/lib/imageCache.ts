/**
 * IndexedDB cache for processed car images
 * Stores processed images (with background removed) to avoid reprocessing
 */

const DB_NAME = 'CarWiseIQ_ImageCache'
const DB_VERSION = 1
const STORE_NAME = 'processedImages'

interface CacheEntry {
  originalUrl: string
  processedUrl: string
  timestamp: number
  blob: Blob
}

let dbInstance: IDBDatabase | null = null

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'originalUrl' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

/**
 * Get cached processed image from IndexedDB
 */
export async function getCachedProcessedImage(originalUrl: string): Promise<string | null> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(originalUrl)

      request.onsuccess = () => {
        const entry: CacheEntry | undefined = request.result
        if (entry) {
          // Check if cache is still valid (7 days)
          const maxAge = 7 * 24 * 60 * 60 * 1000
          const age = Date.now() - entry.timestamp

          if (age < maxAge) {
            // Create blob URL from cached blob
            const blobUrl = URL.createObjectURL(entry.blob)
            resolve(blobUrl)
          } else {
            // Cache expired, remove it
            deleteCachedImage(originalUrl)
            resolve(null)
          }
        } else {
          resolve(null)
        }
      }

      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting cached image:', error)
    return null
  }
}

/**
 * Cache processed image in IndexedDB
 */
export async function cacheProcessedImage(originalUrl: string, processedBlob: Blob): Promise<void> {
  try {
    const db = await getDB()
    const entry: CacheEntry = {
      originalUrl,
      processedUrl: URL.createObjectURL(processedBlob),
      timestamp: Date.now(),
      blob: processedBlob,
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(entry)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error caching processed image:', error)
  }
}

/**
 * Delete cached image
 */
async function deleteCachedImage(originalUrl: string): Promise<void> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(originalUrl)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error deleting cached image:', error)
  }
}

/**
 * Clear old cache entries (older than 7 days)
 */
export async function clearOldCache(): Promise<void> {
  try {
    const db = await getDB()
    const maxAge = 7 * 24 * 60 * 60 * 1000
    const cutoffTime = Date.now() - maxAge

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime))

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error clearing old cache:', error)
  }
}
