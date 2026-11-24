import { clearEvidencePhotos, evidenceFileName } from './evidence-files';
import { getOfflineDatabase } from './offline-db';

// Each offline action belongs to the driver who created it (owner_user_id).
// `current_owner` in offline_meta is the driver signed in on this phone; it
// survives an expired session so the same driver can sync after signing in
// again, and actions of another driver are never sent with the new token.

const OWNER_KEY = 'current_owner';

/** SQL expression for the current owner, used by the queue and the route cache. */
export const CURRENT_OWNER_SQL = `(SELECT value FROM offline_meta WHERE key = '${OWNER_KEY}')`;

export async function getOfflineOwner(): Promise<string | null> {
  const db = await getOfflineDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM offline_meta WHERE key = ?',
    OWNER_KEY
  );
  return row?.value ?? null;
}

/**
 * Makes `userId` the owner of new offline actions. Rows stored before owners
 * existed are adopted by this driver, and the cached route of another driver
 * is removed. `changed` is true when a different driver was the owner.
 */
export async function setOfflineOwner(userId: string): Promise<{ changed: boolean }> {
  const db = await getOfflineDatabase();
  let changed = false;

  await db.withTransactionAsync(async () => {
    const previous = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM offline_meta WHERE key = ?',
      OWNER_KEY
    );
    changed = previous !== null && previous.value !== userId;

    await db.runAsync(
      `INSERT INTO offline_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      OWNER_KEY,
      userId
    );
    await db.runAsync(
      'UPDATE offline_queue SET owner_user_id = ? WHERE owner_user_id IS NULL',
      userId
    );
    await db.runAsync('DELETE FROM route_cache WHERE owner_user_id IS NOT ?', userId);
  });

  return { changed };
}

function photoUris(payload: string): string[] {
  try {
    const parsed = JSON.parse(payload) as { photos?: { uri?: unknown }[] } | null;
    return (parsed?.photos ?? []).flatMap((photo) =>
      typeof photo.uri === 'string' ? [photo.uri] : []
    );
  } catch {
    return [];
  }
}

/**
 * Manual sign-out: removes the current driver's queued and rejected actions,
 * their photos and the cached route. Data of other drivers stays on the phone.
 */
export async function clearOwnerOfflineData(): Promise<void> {
  const db = await getOfflineDatabase();
  const owner = await getOfflineOwner();
  if (!owner) return;

  const rows = await db.getAllAsync<{ owner_user_id: string | null; payload: string }>(
    'SELECT owner_user_id, payload FROM offline_queue'
  );
  const keep = new Set(
    rows
      .filter((row) => row.owner_user_id !== owner)
      .flatMap((row) => photoUris(row.payload))
      .map(evidenceFileName)
  );

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM offline_queue WHERE owner_user_id = ?', owner);
    await db.runAsync('DELETE FROM route_cache');
    await db.runAsync('DELETE FROM offline_meta WHERE key = ?', OWNER_KEY);
  });

  clearEvidencePhotos(keep);
}
