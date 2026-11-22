import { mergeRouteUpdate } from '../route-merge';
import type { DriverRoute, RouteStop, StopStatus } from '../types';

function makeStop(id: string, status: StopStatus, overrides: Partial<RouteStop> = {}): RouteStop {
  return {
    id,
    routeId: 'route-1',
    sequence: 1,
    status,
    arrivedAt: null,
    isGeofenceVerified: false,
    confirmedAt: null,
    syncedAt: null,
    notes: null,
    recipientName: null,
    order: null,
    student: null,
    evidencePhotos: [],
    ...overrides,
  };
}

function makeRoute(id: string, stops: RouteStop[]): DriverRoute {
  return {
    id,
    companyId: 'company-1',
    driverId: 'driver-1',
    routeDate: '2026-11-21',
    status: 'in_progress',
    startLatitude: null,
    startLongitude: null,
    startedAt: '2026-11-21T12:00:00.000Z',
    endedAt: null,
    stops,
  };
}

describe('mergeRouteUpdate', () => {
  it('keeps a locally completed stop that the server still returns as pending', () => {
    const previous = makeRoute('route-1', [
      makeStop('stop-1', 'completed', {
        confirmedAt: '2026-11-21T13:00:00.000Z',
        evidencePhotos: [
          { id: 'photo-1', photoUrl: 'file://evidence-1.jpg', capturedAt: null },
        ],
      }),
    ]);
    const incoming = makeRoute('route-1', [makeStop('stop-1', 'pending')]);

    const merged = mergeRouteUpdate(previous, incoming);

    expect(merged?.stops[0].status).toBe('completed');
    expect(merged?.stops[0].confirmedAt).toBe('2026-11-21T13:00:00.000Z');
    expect(merged?.stops[0].evidencePhotos).toHaveLength(1);
  });

  it('keeps a locally arrived stop when the server has not received it yet', () => {
    const previous = makeRoute('route-1', [
      makeStop('stop-1', 'arrived', { arrivedAt: '2026-11-21T12:30:00.000Z' }),
    ]);
    const incoming = makeRoute('route-1', [makeStop('stop-1', 'pending')]);

    const merged = mergeRouteUpdate(previous, incoming);

    expect(merged?.stops[0].status).toBe('arrived');
    expect(merged?.stops[0].arrivedAt).toBe('2026-11-21T12:30:00.000Z');
  });

  it('accepts the server state when it is ahead of the local state', () => {
    const previous = makeRoute('route-1', [makeStop('stop-1', 'pending')]);
    const incoming = makeRoute('route-1', [
      makeStop('stop-1', 'completed', { confirmedAt: '2026-11-21T13:00:00.000Z' }),
    ]);

    const merged = mergeRouteUpdate(previous, incoming);

    expect(merged?.stops[0].status).toBe('completed');
  });

  it('does not revive stops that are no longer in the server response', () => {
    const previous = makeRoute('route-1', [
      makeStop('stop-1', 'completed'),
      makeStop('stop-2', 'pending'),
    ]);
    const incoming = makeRoute('route-1', [makeStop('stop-2', 'pending')]);

    const merged = mergeRouteUpdate(previous, incoming);

    expect(merged?.stops.map((stop) => stop.id)).toEqual(['stop-2']);
  });

  it('does not carry stops to a different route', () => {
    const previous = makeRoute('route-1', [makeStop('stop-1', 'completed')]);
    const incoming = makeRoute('route-2', [makeStop('stop-2', 'pending')]);

    const merged = mergeRouteUpdate(previous, incoming);

    expect(merged?.id).toBe('route-2');
    expect(merged?.stops.map((stop) => stop.id)).toEqual(['stop-2']);
  });

  it('returns no route when the server no longer returns one', () => {
    const previous = makeRoute('route-1', [makeStop('stop-1', 'completed')]);

    expect(mergeRouteUpdate(previous, null)).toBeNull();
  });
});
