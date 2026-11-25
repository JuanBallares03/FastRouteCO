import { describe, expect, it } from 'vitest';
import {
  SYNC_ACTION_LABELS,
  pendingSyncRejectionCount,
  pendingSyncRejectionsLabel,
  syncRejectionStopLabel,
  type SyncRejection,
} from './sync-rejections';

function rejection(overrides: Partial<SyncRejection> = {}): SyncRejection {
  return {
    id: 'rej-1',
    routeId: 'route-a',
    stopId: 'stop-1',
    driverId: 'driver-a',
    driverName: 'Driver A',
    actionType: 'completion',
    capturedAt: '2026-11-24T15:30:00.000Z',
    reason: 'Ruta no encontrada',
    errorCode: 'ROUTE_NOT_FOUND',
    reportedAt: '2026-11-24T16:00:00.000Z',
    reviewedAt: null,
    stop: { id: 'stop-1', sequence: 3, routeId: 'route-a' },
    photos: [],
    ...overrides,
  };
}

describe('syncRejectionStopLabel', () => {
  it('names the stop of the route', () => {
    expect(syncRejectionStopLabel(rejection(), 'route-a')).toBe('Parada 3');
  });

  it('says when a stop reassignment moved the stop to another route', () => {
    const moved = rejection({ stop: { id: 'stop-1', sequence: 2, routeId: 'route-b' } });
    expect(syncRejectionStopLabel(moved, 'route-a')).toBe('Parada 2 (ahora en otra ruta)');
  });

  it('distinguishes a deleted stop from an action without stop', () => {
    expect(syncRejectionStopLabel(rejection({ stop: null }), 'route-a')).toBe('Parada eliminada');
    expect(
      syncRejectionStopLabel(rejection({ stop: null, stopId: null, actionType: 'finish' }), 'route-a')
    ).toBe('Sin parada');
  });
});

describe('pending sync rejections', () => {
  it('counts only the reports not reviewed yet', () => {
    expect(
      pendingSyncRejectionCount([
        rejection(),
        rejection({ id: 'rej-2', reviewedAt: '2026-11-24T17:00:00.000Z' }),
        rejection({ id: 'rej-3' }),
      ])
    ).toBe(2);
  });

  it('labels the route list badge in Spanish', () => {
    expect(pendingSyncRejectionsLabel(undefined)).toBeNull();
    expect(pendingSyncRejectionsLabel(0)).toBeNull();
    expect(pendingSyncRejectionsLabel(1)).toBe('1 acción sin sincronizar');
    expect(pendingSyncRejectionsLabel(4)).toBe('4 acciones sin sincronizar');
  });

  it('has a Spanish label for every action type', () => {
    expect(Object.values(SYNC_ACTION_LABELS)).toEqual([
      'Inicio de ruta',
      'Llegada a la parada',
      'Entrega o recogida',
      'Fin de ruta',
    ]);
  });
});
