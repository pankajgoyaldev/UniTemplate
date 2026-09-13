import type { ImportedDataSource } from '../../operations/dataSource/dataSourceTypes.js';

const DB_NAME = 'uts_data_source_db';
const STORE_NAME = 'active_source';
const STORAGE_KEY = 'current_data_source';

let memoryFallback: ImportedDataSource | null = null;

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    } catch (err) {
      reject(err);
    }
  });
}

export async function loadPersistedDataSource(): Promise<ImportedDataSource | null> {
  if (!isIndexedDbAvailable()) {
    return memoryFallback;
  }

  try {
    const db = await openDb();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(STORAGE_KEY);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return memoryFallback;
  }
}

export async function savePersistedDataSource(dataSource: ImportedDataSource): Promise<boolean> {
  memoryFallback = dataSource;
  if (!isIndexedDbAvailable()) {
    return true;
  }

  try {
    const db = await openDb();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(dataSource, STORAGE_KEY);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

export async function clearPersistedDataSource(): Promise<boolean> {
  memoryFallback = null;
  if (!isIndexedDbAvailable()) {
    return true;
  }

  try {
    const db = await openDb();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(STORAGE_KEY);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

