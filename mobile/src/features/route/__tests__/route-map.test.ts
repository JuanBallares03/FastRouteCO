import {
  boundsForStops,
  buildRouteLineGeoJSON,
  mapFallbackMessage,
  resolveMapStyleUrl,
  toMapStops,
} from '../route-map';
import type { RouteStop } from '../types';

function makeStop(
  sequence: number,
  latitude: number | null,
  longitude: number | null,
  address = `Calle ${sequence}`
): RouteStop {
  return {
    id: `stop-${sequence}`,
    routeId: 'route-1',
    sequence,
    status: 'pending',
    arrivedAt: null,
    isGeofenceVerified: false,
    confirmedAt: null,
    syncedAt: null,
    notes: null,
    recipientName: null,
    order: {
      id: `order-${sequence}`,
      type: 'delivery',
      address,
      latitude,
      longitude,
      priority: 'normal',
      status: 'assigned',
      customerName: null,
      customerPhone: null,
      description: null,
    },
    student: null,
    evidencePhotos: [],
  };
}

describe('route map helpers', () => {
  it('keeps stops with coordinates in optimized sequence order', () => {
    const stops = toMapStops([
      makeStop(2, 4.44, -75.23, 'Calle 2'),
      makeStop(1, 4.43, -75.22, 'Calle 1'),
      makeStop(3, null, null, 'Sin ubicación'),
    ]);

    expect(stops.map((stop) => stop.sequence)).toEqual([1, 2]);
    expect(stops.map((stop) => stop.label)).toEqual(['Calle 1', 'Calle 2']);
  });

  it('builds bounds that contain every stop with coordinates', () => {
    const stops = toMapStops([
      makeStop(1, 4.45, -75.25),
      makeStop(2, 4.41, -75.21),
    ]);

    expect(boundsForStops(stops)).toEqual([-75.25, 4.41, -75.21, 4.45]);
  });

  it('returns no bounds when there are no located stops', () => {
    expect(boundsForStops([])).toBeNull();
  });

  it('prepares route geometry for the map when the backend delivers it', () => {
    const geometry = buildRouteLineGeoJSON([
      [-75.25, 4.45],
      [-75.21, 4.41],
    ]);

    expect(geometry?.features[0].geometry.coordinates).toEqual([
      [-75.25, 4.45],
      [-75.21, 4.41],
    ]);
  });

  it('does not draw a line without at least two valid points', () => {
    expect(buildRouteLineGeoJSON(null)).toBeNull();
    expect(buildRouteLineGeoJSON([[-75.25, 4.45]])).toBeNull();
  });

  it('uses the configured map style and falls back to OpenFreeMap only in development', () => {
    expect(resolveMapStyleUrl('https://maps.example.com/style.json', false)).toBe(
      'https://maps.example.com/style.json'
    );
    expect(resolveMapStyleUrl('', true)).toBe('https://tiles.openfreemap.org/styles/liberty');
    expect(resolveMapStyleUrl(undefined, false)).toBeNull();
  });

  it('explains why the stop list is shown instead of the map', () => {
    expect(
      mapFallbackMessage({ isOffline: true, hasMapStyle: true, mapFailed: false, stopCount: 2 })
    ).toContain('Sin conexión');
    expect(
      mapFallbackMessage({ isOffline: false, hasMapStyle: false, mapFailed: false, stopCount: 2 })
    ).toContain('no está disponible');
    expect(
      mapFallbackMessage({ isOffline: false, hasMapStyle: true, mapFailed: true, stopCount: 2 })
    ).toContain('No pudimos cargar el mapa');
    expect(
      mapFallbackMessage({ isOffline: false, hasMapStyle: true, mapFailed: false, stopCount: 0 })
    ).toContain('no tiene paradas con ubicación');
    expect(
      mapFallbackMessage({ isOffline: false, hasMapStyle: true, mapFailed: false, stopCount: 2 })
    ).toBeNull();
  });
});
