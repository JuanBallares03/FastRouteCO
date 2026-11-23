import { File, Paths } from 'expo-file-system';
import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import {
  parseLegacyQueue,
  parseLegacyRouteCache,
  type LegacyQueueEntry,
} from './offline-storage-utils';

const DATABASE_NAME = 'fastrouteco.db';
const LEGACY_QUEUE_FILE = 'fastrouteco-offline-queue.json';
const LEGACY_ROUTE_CACHE_FILE = 'fastrouteco-route-cache.json';

const SCHEMA_VERSION = 1;

let databasePromise: Promise<SQLiteDatabase> | null = null;

function isLocationPayload(payload: string): boolean {
  try {
    return (JSON.parse(payload) as { type?: unknown })?.type === 'location';
  } catch {
    return false;
  }
}

// Versioned with PRAGMA user_version. Version 1 adds the lane (`kind`), the
// rejected state with its reason, the owner of each action and the
// `offline_meta` table (RF17, RNF07). ADD COLUMN with a constant default fills
// the rows already stored, so pending actions stay pending. Everything runs in
// one transaction: if any step fails nothing is applied, user_version stays 0
// and the migration runs again on the next start.
export async function migrateSchema(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= SCHEMA_VERSION) {
    return;
  }

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      ALTER TABLE offline_queue ADD COLUMN kind TEXT NOT NULL DEFAULT 'action';
      ALTER TABLE offline_queue ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE offline_queue ADD COLUMN rejected_at INTEGER;
      ALTER TABLE offline_queue ADD COLUMN reject_reason TEXT;
      ALTER TABLE offline_queue ADD COLUMN reject_code TEXT;
      ALTER TABLE offline_queue ADD COLUMN reject_status INTEGER;
      ALTER TABLE offline_queue ADD COLUMN reported_at INTEGER;
      ALTER TABLE offline_queue ADD COLUMN owner_user_id TEXT;
      ALTER TABLE route_cache ADD COLUMN owner_user_id TEXT;
      CREATE TABLE IF NOT EXISTS offline_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS offline_queue_lane_idx
        ON offline_queue (owner_user_id, kind, status, created_at);
    `);

    // The lane is filled in JS so the migration does not depend on json_extract.
    const rows = await db.getAllAsync<{ id: string; payload: string }>(
      'SELECT id, payload FROM offline_queue'
    );
    for (const entry of rows) {
      if (isLocationPayload(entry.payload)) {
        await db.runAsync("UPDATE offline_queue SET kind = 'location' WHERE id = ?", entry.id);
      }
    }

    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

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

  // Legacy JSON rows are imported with the version 0 columns first, so the
  // schema migration below assigns their lane like any other stored row.
  await migrateLegacyStorage(db);
  await migrateSchema(db);
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

export async function clearOfflineData(): Promise<void> {
  const pendingDatabase = databasePromise;
  databasePromise = null;

  if (pendingDatabase) {
    const database = await pendingDatabase.catch(() => null);
    await database?.closeAsync().catch(() => undefined);
  }

  await deleteDatabaseAsync(DATABASE_NAME).catch(() => undefined);
}
