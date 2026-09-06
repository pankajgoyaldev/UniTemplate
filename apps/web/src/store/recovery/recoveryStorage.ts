import type { SessionRecoveryRecord } from './recoveryTypes.js';

export interface IRecoveryStorage {
  get(key: string): Promise<SessionRecoveryRecord | null>;
  set(key: string, record: SessionRecoveryRecord): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
}

/**
 * In-memory storage adapter for test environments or fallback when IndexedDB is unavailable.
 */
export class MemoryRecoveryStorage implements IRecoveryStorage {
  private store = new Map<string, SessionRecoveryRecord>();

  async get(key: string): Promise<SessionRecoveryRecord | null> {
    const item = this.store.get(key);
    if (!item) return null;
    return JSON.parse(JSON.stringify(item));
  }

  async set(key: string, record: SessionRecoveryRecord): Promise<boolean> {
    this.store.set(key, JSON.parse(JSON.stringify(record)));
    return true;
  }

  async delete(key: string): Promise<boolean> {
    this.store.delete(key);
    return true;
  }

  async clear(): Promise<boolean> {
    this.store.clear();
    return true;
  }
}

/**
 * Production IndexedDB storage engine.
 * Database: uts_session_recovery_db
 * Store: session_records
 */
export class IndexedDbRecoveryStorage implements IRecoveryStorage {
  private dbName = 'uts_session_recovery_db';
  private storeName = 'session_records';
  private dbVersion = 1;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private fallback = new MemoryRecoveryStorage();

  private isIndexedDbAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  private async getDb(): Promise<IDBDatabase> {
    if (!this.isIndexedDbAvailable()) {
      throw new Error('IndexedDB is not available');
    }

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(this.dbName, this.dbVersion);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error || new Error('Failed to open IndexedDB'));
        };

        request.onblocked = () => {
          reject(new Error('IndexedDB database open blocked'));
        };
      } catch (err) {
        reject(err);
      }
    });

    return this.dbPromise;
  }

  async get(key: string): Promise<SessionRecoveryRecord | null> {
    try {
      if (!this.isIndexedDbAvailable()) {
        return this.fallback.get(key);
      }
      const db = await this.getDb();
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const request = store.get(key);

          request.onsuccess = () => {
            resolve(request.result ?? null);
          };

          request.onerror = () => {
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      });
    } catch {
      return this.fallback.get(key);
    }
  }

  async set(key: string, record: SessionRecoveryRecord): Promise<boolean> {
    try {
      if (!this.isIndexedDbAvailable()) {
        return this.fallback.set(key, record);
      }
      const db = await this.getDb();
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const request = store.put(record, key);

          request.onsuccess = () => {
            resolve(true);
          };

          request.onerror = () => {
            resolve(false);
          };
        } catch {
          resolve(false);
        }
      });
    } catch {
      return this.fallback.set(key, record);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (!this.isIndexedDbAvailable()) {
        return this.fallback.delete(key);
      }
      const db = await this.getDb();
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const request = store.delete(key);

          request.onsuccess = () => {
            resolve(true);
          };

          request.onerror = () => {
            resolve(false);
          };
        } catch {
          resolve(false);
        }
      });
    } catch {
      return this.fallback.delete(key);
    }
  }

  async clear(): Promise<boolean> {
    try {
      if (!this.isIndexedDbAvailable()) {
        return this.fallback.clear();
      }
      const db = await this.getDb();
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const request = store.clear();

          request.onsuccess = () => {
            resolve(true);
          };

          request.onerror = () => {
            resolve(false);
          };
        } catch {
          resolve(false);
        }
      });
    } catch {
      return this.fallback.clear();
    }
  }
}

// Global storage singleton with swappable instance for tests
let globalRecoveryStorage: IRecoveryStorage | null = null;

export function getRecoveryStorage(): IRecoveryStorage {
  if (!globalRecoveryStorage) {
    if (typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
      globalRecoveryStorage = new IndexedDbRecoveryStorage();
    } else {
      globalRecoveryStorage = new MemoryRecoveryStorage();
    }
  }
  return globalRecoveryStorage;
}

export function setCustomRecoveryStorage(storage: IRecoveryStorage | null): void {
  globalRecoveryStorage = storage;
}

