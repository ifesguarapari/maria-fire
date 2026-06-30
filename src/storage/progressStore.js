const DB_NAME = "maria-fire-progress";
const STORE_NAME = "level-progress";
const LOCAL_PREFIX = "maria-fire:progress:";
const CURRENT_LEVEL_KEY = "maria-fire:current-level";

export function createEmptyProgress(levelId) {
  return {
    levelId,
    status: "blank",
    code: "",
    attempts: 0,
    bestLineCount: null,
    bestActionCount: null,
    hintUsed: false,
    lessonViewed: false,
    videoStarted: false,
    videoCompleted: false,
    lastResult: null,
    updatedAt: null,
  };
}

function makeMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    get length() {
      return values.size;
    },
  };
}

function createLocalStore(storage = makeMemoryStorage()) {
  return {
    async get(levelId) {
      const raw = storage.getItem(`${LOCAL_PREFIX}${levelId}`);
      return raw ? JSON.parse(raw) : null;
    },
    async getAll() {
      const items = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(LOCAL_PREFIX)) {
          items.push(JSON.parse(storage.getItem(key)));
        }
      }
      return items;
    },
    async save(progress) {
      const next = { ...progress, updatedAt: new Date().toISOString() };
      storage.setItem(`${LOCAL_PREFIX}${progress.levelId}`, JSON.stringify(next));
      return next;
    },
    async remove(levelId) {
      storage.removeItem(`${LOCAL_PREFIX}${levelId}`);
    },
    async clear() {
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(LOCAL_PREFIX)) {
          keys.push(key);
        }
      }
      keys.forEach((key) => storage.removeItem(key));
      storage.removeItem(CURRENT_LEVEL_KEY);
    },
    async getCurrentLevel() {
      return storage.getItem(CURRENT_LEVEL_KEY);
    },
    async setCurrentLevel(levelId) {
      storage.setItem(CURRENT_LEVEL_KEY, levelId);
    },
  };
}

function openDatabase(indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "levelId" });
      }
      if (!db.objectStoreNames.contains("metadata")) {
        db.createObjectStore("metadata", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionRequest(db, storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createIndexedDbStore(indexedDB, fallback) {
  let dbPromise = openDatabase(indexedDB);

  async function withFallback(operation) {
    try {
      const db = await dbPromise;
      return await operation(db);
    } catch (error) {
      console.warn("IndexedDB indisponivel; usando localStorage.", error);
      dbPromise = Promise.reject(error);
      return null;
    }
  }

  return {
    async get(levelId) {
      const result = await withFallback((db) =>
        transactionRequest(db, STORE_NAME, "readonly", (store) => store.get(levelId))
      );
      return result ?? fallback.get(levelId);
    },
    async getAll() {
      const result = await withFallback((db) =>
        transactionRequest(db, STORE_NAME, "readonly", (store) => store.getAll())
      );
      return result ?? fallback.getAll();
    },
    async save(progress) {
      const next = { ...progress, updatedAt: new Date().toISOString() };
      const result = await withFallback((db) =>
        transactionRequest(db, STORE_NAME, "readwrite", (store) => store.put(next))
      );
      if (result === null) {
        return fallback.save(next);
      }
      return next;
    },
    async remove(levelId) {
      const result = await withFallback((db) =>
        transactionRequest(db, STORE_NAME, "readwrite", (store) => store.delete(levelId))
      );
      if (result === null) {
        return fallback.remove(levelId);
      }
      return undefined;
    },
    async clear() {
      const result = await withFallback((db) =>
        transactionRequest(db, STORE_NAME, "readwrite", (store) => store.clear())
      );
      await this.setCurrentLevel("");
      if (result === null) {
        return fallback.clear();
      }
      return undefined;
    },
    async getCurrentLevel() {
      const result = await withFallback((db) =>
        transactionRequest(db, "metadata", "readonly", (store) => store.get(CURRENT_LEVEL_KEY))
      );
      return result?.value ?? fallback.getCurrentLevel();
    },
    async setCurrentLevel(levelId) {
      const entry = { key: CURRENT_LEVEL_KEY, value: levelId };
      const result = await withFallback((db) =>
        transactionRequest(db, "metadata", "readwrite", (store) => store.put(entry))
      );
      if (result === null) {
        return fallback.setCurrentLevel(levelId);
      }
      return undefined;
    },
  };
}

export function createProgressStore(options = {}) {
  const local = createLocalStore(options.localStorage);
  const indexedDB = options.indexedDB;
  if (!indexedDB) {
    return local;
  }
  return createIndexedDbStore(indexedDB, local);
}

export function createMemoryStorage() {
  return makeMemoryStorage();
}
