const dbName = "raddus-canvas-data";
const legacyDbName = "canvas-local-data";
const dbVersion = 1;
const projectStoreName = "projects";
const mcpServerStoreName = "mcpServers";
let legacyMigrationPromise: Promise<void> | null = null;

export type LocalRecord = object & { id: string };

export class LocalCanvasStore {
  async listProjects<T extends LocalRecord>(): Promise<T[]> {
    return this.list<T>(projectStoreName);
  }

  async saveProject<T extends LocalRecord>(project: T): Promise<T> {
    await this.put(projectStoreName, project);
    return project;
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.delete(projectStoreName, projectId);
  }

  async listMcpServers<T extends LocalRecord>(): Promise<T[]> {
    return this.list<T>(mcpServerStoreName);
  }

  async saveMcpServer<T extends LocalRecord>(server: T): Promise<T> {
    await this.put(mcpServerStoreName, server);
    return server;
  }

  private async list<T>(storeName: string): Promise<T[]> {
    const db = await openDb();
    await migrateLegacyData(db);
    return withStore<T[]>(db, storeName, "readonly", (store) => store.getAll());
  }

  private async put(storeName: string, value: LocalRecord): Promise<void> {
    const db = await openDb();
    await migrateLegacyData(db);
    await withStore<void>(db, storeName, "readwrite", (store) => store.put(value));
  }

  private async delete(storeName: string, key: string): Promise<void> {
    const db = await openDb();
    await migrateLegacyData(db);
    await withStore<void>(db, storeName, "readwrite", (store) => store.delete(key));
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(projectStoreName)) {
        request.result.createObjectStore(projectStoreName, { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains(mcpServerStoreName)) {
        request.result.createObjectStore(mcpServerStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local canvas storage."));
  });
}

function migrateLegacyData(db: IDBDatabase): Promise<void> {
  legacyMigrationPromise ??= (async () => {
    const legacyDb = await openLegacyDbIfExists();
    if (!legacyDb) return;
    try {
      await Promise.all([
        migrateLegacyStore(db, legacyDb, projectStoreName),
        migrateLegacyStore(db, legacyDb, mcpServerStoreName),
      ]);
    } finally {
      legacyDb.close();
    }
  })();
  return legacyMigrationPromise;
}

async function migrateLegacyStore(db: IDBDatabase, legacyDb: IDBDatabase, storeName: string): Promise<void> {
  if (!legacyDb.objectStoreNames.contains(storeName)) return;
  const [legacyRecords, currentRecords] = await Promise.all([
    withStore<LocalRecord[]>(legacyDb, storeName, "readonly", (store) => store.getAll()),
    withStore<LocalRecord[]>(db, storeName, "readonly", (store) => store.getAll()),
  ]);
  const currentIds = new Set(currentRecords.map((record) => record.id));
  await Promise.all(legacyRecords.filter((record) => !currentIds.has(record.id)).map((record) => withStore<void>(db, storeName, "readwrite", (store) => store.put(record))));
}

async function openLegacyDbIfExists(): Promise<IDBDatabase | null> {
  const databases = await listIndexedDbs();
  if (databases && !databases.some((database) => database.name === legacyDbName)) return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(legacyDbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open legacy local canvas storage."));
  });
}

async function listIndexedDbs(): Promise<Array<{ name?: string | null }> | null> {
  const indexedDbWithList = indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string | null }>> };
  return typeof indexedDbWithList.databases === "function" ? indexedDbWithList.databases() : null;
}

function withStore<T>(db: IDBDatabase, storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = run(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}
