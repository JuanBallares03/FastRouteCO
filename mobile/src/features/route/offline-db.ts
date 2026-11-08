import { File, Paths } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import {
  parseLegacyQueue,
  parseLegacyRouteCache,
  type LegacyQueueEntry,
} from './offline-storage-utils';

const DATABASE_NAME = 'fastrouteco.db';
const LEGACY_QUEUE_FILE = 'fastrouteco-offline-queue.json';
const LEGACY_ROUTE_CACHE_FILE = 'fastrouteco-route-cache.json';

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function migrateLegacyStorage(db: SQLiteDatabase): Promise<void> {
  const queueFile = new File(Paths.document, LEGACY_QUEUE_FILE);
  const cacheFile = new File(Paths.document, LEGACY_ROUTE_CACHE_FILE);

  let legacyQueue: LegacyQueueEntry[] = [];
  let legacyCache: string | null = null;

  if (queueFile.exists) {
    try {
      legacyQueue = parseLegacyQueue(await queueFile.text());
    } catch {
      legacyQueue = [];
    }
  }

  if (cacheFile.exists) {
    try {
      legacyCache = parseLegacyRouteCache(await cacheFile.text());
    } catch {
      legacyCache = null;
    }
  }

  if (legacyQueue.length > 0 || legacyCache !== null) {
    await db.withTransactionAsync(async () => {
      const now = Date.now();

      for (const entry of legacyQueue) {
        await db.runAsync(
          'INSERT OR IGNORE INTO offline_queue (id, payload, created_at) VALUES (?, ?, ?)',
          entry.id,
          entry.payload,
          now
        );
      }

      if (legacyCache !== null) {
        await db.runAsync(
          `INSERT INTO route_cache (id, payload, updated_at)
           VALUES (1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
          legacyCache,
          now
        );
      }
    });
  }

  if (queueFile.exists) {
    queueFile.delete();
  }

  if (cacheFile.exists) {
    cacheFile.delete();
  }
}

async function openOfflineDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);

  await db.execAsync('PRAGMA journal_mode = WAL;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS route_cache (
      id INTEGER PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await migrateLegacyStorage(db);
  return db;
}

export function getOfflineDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openOfflineDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}
