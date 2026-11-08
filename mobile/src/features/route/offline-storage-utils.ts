export interface LegacyQueueEntry {
  id: string;
  payload: string;
}

export function parseLegacyQueue(content: string): LegacyQueueEntry[] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as { id?: unknown };
      if (typeof candidate.id !== 'string' || candidate.id.length === 0) return [];
      return [{ id: candidate.id, payload: JSON.stringify(item) }];
    });
  } catch {
    return [];
  }
}

export function parseLegacyRouteCache(content: string): string | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

export function isCurrentRoute(
  route: { routeDate: string } | null,
  today: string
): boolean {
  return Boolean(route && route.routeDate.slice(0, 10) === today);
}
