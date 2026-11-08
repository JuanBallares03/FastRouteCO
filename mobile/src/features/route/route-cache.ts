import { getOfflineDatabase } from './offline-db';
import { isCurrentRoute } from './offline-storage-utils';
import type { DriverRoute } from './types';

export function todayInBogota(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function saveCachedRoute(route: DriverRoute | null): Promise<void> {
  const db = await getOfflineDatabase();

  if (!route) {
    await db.runAsync('DELETE FROM route_cache WHERE id = 1');
    return;
  }

  await db.runAsync(
    `INSERT INTO route_cache (id, payload, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    JSON.stringify(route),
    Date.now()
  );
}

export async function loadCachedRoute(): Promise<DriverRoute | null> {
  const db = await getOfflineDatabase();
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM route_cache WHERE id = 1'
  );

  if (!row) return null;

  try {
    const parsed = JSON.parse(row.payload) as DriverRoute | null;
    if (!isCurrentRoute(parsed, todayInBogota())) return null;
    return parsed;
  } catch {
    return null;
  }
}
