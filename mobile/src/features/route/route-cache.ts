import { File, Paths } from 'expo-file-system';
import type { DriverRoute } from './types';

const cacheFile = new File(Paths.document, 'fastrouteco-route-cache.json');

export function todayInBogota(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function saveCachedRoute(route: DriverRoute | null): Promise<void> {
  if (!cacheFile.exists) {
    cacheFile.create({ intermediates: true });
  }
  await cacheFile.write(JSON.stringify(route));
}

export async function loadCachedRoute(): Promise<DriverRoute | null> {
  if (!cacheFile.exists) return null;

  try {
    const content = await cacheFile.text();
    const parsed = JSON.parse(content) as DriverRoute | null;
    if (!parsed) return null;
    if (parsed.routeDate.slice(0, 10) !== todayInBogota()) return null;
    return parsed;
  } catch {
    return null;
  }
}
