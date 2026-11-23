import type { PendingAction } from '../offline-actions';
import type { RejectedEntry } from '../offline-queue-store';
import {
  describeRejectedAction,
  groupRejectedActions,
  rejectedSyncMessage,
} from '../rejected-actions';

const stops = [
  { id: 's1', sequence: 1 },
  { id: 's3', sequence: 3 },
];

const sample = {
  latitude: 4.4389,
  longitude: -75.2322,
  capturedAt: '2026-11-23T15:00:00.000Z',
  isOffline: true,
};

function rejected(
  action: PendingAction,
  rejectedAt: number,
  reason = 'Ruta no encontrada'
): RejectedEntry {
  return {
    id: action.id,
    kind: action.type === 'location' ? 'location' : 'action',
    createdAt: rejectedAt - 1,
    action,
    rejectedAt,
    reason,
    code: 'ROUTE_NOT_FOUND',
    status: 404,
    reportedAt: null,
  };
}

describe('describeRejectedAction', () => {
  it('names each action in Spanish with its stop number', () => {
    expect(describeRejectedAction({ id: '1', type: 'start', routeId: 'r1' }, stops)).toBe(
      'Inicio de ruta'
    );
    expect(describeRejectedAction({ id: '2', type: 'finish', routeId: 'r1' }, stops)).toBe(
      'Fin de ruta'
    );
    expect(
      describeRejectedAction(
        { id: '3', type: 'arrival', routeId: 'r1', stopId: 's3', body: { method: 'manual' } },
        stops
      )
    ).toBe('Llegada a la parada 3');
    expect(
      describeRejectedAction(
        {
          id: '4',
          type: 'completion',
          routeId: 'r1',
          stopId: 's1',
          photos: [{ uri: 'file:///a.jpg', capturedAt: sample.capturedAt }],
        },
        stops
      )
    ).toBe('Entrega en la parada 1 (1 foto)');
  });

  it('falls back when the stop is no longer in the route', () => {
    expect(
      describeRejectedAction(
        { id: '5', type: 'arrival', routeId: 'r1', stopId: 'gone', body: { method: 'manual' } },
        stops
      )
    ).toBe('Llegada a una parada');
  });
});

describe('groupRejectedActions', () => {
  it('groups the GPS batches of a route into one row', () => {
    const items = groupRejectedActions(
      [
        rejected({ id: 'g1', type: 'location', routeId: 'r1', locations: [sample] }, 10, 'Viejo'),
        rejected({ id: 'f1', type: 'finish', routeId: 'r1' }, 11),
        rejected(
          { id: 'g2', type: 'location', routeId: 'r1', locations: [sample, sample] },
          12,
          'La ruta no está en curso'
        ),
      ],
      stops
    );

    expect(items).toEqual([
      {
        key: 'gps-r1',
        ids: ['g1', 'g2'],
        title: 'Recorrido GPS (3 puntos)',
        reason: 'La ruta no está en curso',
        rejectedAt: 12,
      },
      { key: 'f1', ids: ['f1'], title: 'Fin de ruta', reason: 'Ruta no encontrada', rejectedAt: 11 },
    ]);
  });
});

describe('rejectedSyncMessage', () => {
  it('names the single rejected action and its reason', () => {
    expect(
      rejectedSyncMessage(
        1,
        {
          id: '4',
          type: 'completion',
          routeId: 'r1',
          stopId: 's1',
          photos: [{ uri: 'file:///a.jpg', capturedAt: sample.capturedAt }],
        },
        'Cloudinary rechazó la foto: Invalid Signature',
        stops
      )
    ).toBe(
      'No se pudo enviar entrega en la parada 1 (1 foto): Cloudinary rechazó la foto: Invalid Signature'
    );
  });

  it('summarizes several rejected actions', () => {
    expect(rejectedSyncMessage(3, null, 'x', stops)).toBe('3 acciones no se pudieron enviar.');
  });
});
