import {
  isCurrentRoute,
  parseLegacyQueue,
  parseLegacyRouteCache,
} from '../offline-storage-utils';

describe('offline storage utilities', () => {
  it('keeps valid pending actions and serializes them as payloads', () => {
    const content = JSON.stringify([
      { id: 'action-1', type: 'start', routeId: 'route-1' },
      { type: 'finish', routeId: 'route-2' },
      null,
      'not-an-action',
    ]);

    expect(parseLegacyQueue(content)).toEqual([
      {
        id: 'action-1',
        payload: JSON.stringify({ id: 'action-1', type: 'start', routeId: 'route-1' }),
      },
    ]);
  });

  it('ignores corrupt or non-array legacy queues', () => {
    expect(parseLegacyQueue('{invalid')).toEqual([]);
    expect(parseLegacyQueue(JSON.stringify({ id: 'action-1' }))).toEqual([]);
  });

  it('migrates a legacy route cache object', () => {
    const route = { id: 'route-1', routeDate: '2026-11-07T00:00:00.000Z', stops: [] };
    expect(parseLegacyRouteCache(JSON.stringify(route))).toBe(JSON.stringify(route));
  });

  it('rejects null or non-object legacy route caches', () => {
    expect(parseLegacyRouteCache('null')).toBeNull();
    expect(parseLegacyRouteCache(JSON.stringify(['route']))).toBeNull();
    expect(parseLegacyRouteCache('{invalid')).toBeNull();
  });

  it('accepts only routes for the requested business date', () => {
    const route = { routeDate: '2026-11-07T00:00:00.000Z' };
    expect(isCurrentRoute(route, '2026-11-07')).toBe(true);
    expect(isCurrentRoute(route, '2026-11-08')).toBe(false);
    expect(isCurrentRoute(null, '2026-11-07')).toBe(false);
  });
});
