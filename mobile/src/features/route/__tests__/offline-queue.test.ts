import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { routesApi } from '../api';
import { uploadEvidencePhoto } from '../cloudinary';
import { deleteEvidencePhoto } from '../evidence-files';
import type { NewPendingAction, PendingAction, QueueKind } from '../offline-actions';
import {
  flushOfflineQueue,
  getPendingActionCount,
  getPendingActionSummary,
  getRejectedActions,
  retryRejectedAction,
} from '../offline-queue';
import * as store from '../offline-queue-store';
import { EvidenceUploadNetworkError, EvidenceUploadRejectedError } from '../sync-errors';

interface MemoryRow {
  id: string;
  kind: QueueKind;
  createdAt: number;
  status: 'pending' | 'rejected';
  action: PendingAction;
  rejection?: { reason: string; code: string | null; status: number | null; rejectedAt: number };
}

jest.mock('@/services/http', () => ({ api: {} }));

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  routesApi: {
    startRoute: jest.fn(),
    finishRoute: jest.fn(),
    sendLocations: jest.fn(),
    arriveAtStop: jest.fn(),
    completeStop: jest.fn(),
    getEvidenceSignature: jest.fn(),
  },
}));

jest.mock('../cloudinary', () => ({ uploadEvidencePhoto: jest.fn() }));
jest.mock('../evidence-files', () => ({ deleteEvidencePhoto: jest.fn() }));

// In-memory replacement of the SQLite store with the same ordering rules.
jest.mock('../offline-queue-store', () => {
  const rows: MemoryRow[] = [];
  const toEntry = (row: MemoryRow) => ({
    id: row.id,
    kind: row.kind,
    createdAt: row.createdAt,
    action: row.action,
    ...(row.rejection ?? {}),
    reportedAt: null,
  });
  return {
    __rows: rows,
    insertEntry: jest.fn(
      async (id: string, action: NewPendingAction, kind: QueueKind, createdAt: number) => {
        rows.push({
          id,
          kind,
          createdAt,
          status: 'pending',
          action: { ...action, id } as PendingAction,
        });
      }
    ),
    readEntries: jest.fn(async (status: string, kind?: QueueKind) =>
      rows
        .filter((row) => row.status === status && (!kind || row.kind === kind))
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(toEntry)
    ),
    removeEntry: jest.fn(async (id: string) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) rows.splice(index, 1);
    }),
    markRejected: jest.fn(
      async (
        id: string,
        details: { reason: string; code: string | null; status: number | null },
        at: number
      ) => {
        const row = rows.find((item) => item.id === id);
        if (row) {
          row.status = 'rejected';
          row.rejection = { ...details, rejectedAt: at };
        }
      }
    ),
    restoreRejected: jest.fn(async (id: string) => {
      const row = rows.find((item) => item.id === id);
      if (row?.status === 'rejected') {
        row.status = 'pending';
        delete row.rejection;
      }
    }),
    countEntries: jest.fn(async () => ({
      pending: rows.filter((row) => row.status === 'pending').length,
      rejected: rows.filter((row) => row.status === 'rejected').length,
    })),
  };
});

const rows = (store as unknown as { __rows: MemoryRow[] }).__rows;
const api = jest.mocked(routesApi);
const upload = jest.mocked(uploadEvidencePhoto);

let clock = 1_000;
function seed(action: NewPendingAction): string {
  clock += 1_000;
  const id = `entry-${clock}`;
  rows.push({
    id,
    kind: action.type === 'location' ? 'location' : 'action',
    createdAt: clock,
    status: 'pending',
    action: { ...action, id } as PendingAction,
  });
  return id;
}

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response);
}

const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
const photo = { uri: 'file:///evidence/photo.jpg', capturedAt: '2026-11-23T15:00:00.000Z' };
const signature = { cloudName: 'demo', apiKey: 'k', timestamp: 1, folder: 'f', signature: 's' };

beforeEach(() => {
  rows.splice(0, rows.length);
  jest.clearAllMocks();
  for (const fn of Object.values(api)) fn.mockResolvedValue(undefined as never);
  api.getEvidenceSignature.mockResolvedValue(signature);
  upload.mockResolvedValue('https://res.cloudinary.com/demo/photo.jpg');
});

describe('flushOfflineQueue', () => {
  it('sends pending actions in order and removes them', async () => {
    seed({ type: 'start', routeId: 'r1' });
    seed({ type: 'arrival', routeId: 'r1', stopId: 's1', body: { method: 'manual' } });

    const result = await flushOfflineQueue();

    expect(result).toEqual({
      synced: 2,
      pending: 0,
      rejected: 0,
      lastRejected: null,
      lastError: null,
    });
    expect(api.startRoute).toHaveBeenCalled();
    expect(api.arriveAtStop).toHaveBeenCalledWith('r1', 's1', { method: 'manual' });
    expect(rows).toHaveLength(0);
  });

  it('keeps a 4xx as rejected with its reason and continues with the next action', async () => {
    api.arriveAtStop.mockRejectedValueOnce(
      httpError(404, { message: 'Ruta no encontrada', code: 'ROUTE_NOT_FOUND' })
    );
    const arrival = seed({
      type: 'arrival',
      routeId: 'r1',
      stopId: 's1',
      body: { method: 'manual' },
    });
    seed({ type: 'finish', routeId: 'r2' });

    const result = await flushOfflineQueue();

    expect(result).toMatchObject({
      synced: 1,
      pending: 0,
      rejected: 1,
      lastRejected: { id: arrival, type: 'arrival' },
      lastError: 'Ruta no encontrada',
    });
    expect(api.finishRoute).toHaveBeenCalledWith('r2');
    const rejected = await getRejectedActions();
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      id: arrival,
      reason: 'Ruta no encontrada',
      code: 'ROUTE_NOT_FOUND',
      status: 404,
    });
  });

  it('rejects a 403 instead of blocking the queue', async () => {
    api.startRoute.mockRejectedValueOnce(httpError(403, { message: 'Suscripción inactiva' }));
    seed({ type: 'start', routeId: 'r1' });
    seed({ type: 'finish', routeId: 'r2' });

    const result = await flushOfflineQueue();

    expect(result.rejected).toBe(1);
    expect(api.finishRoute).toHaveBeenCalled();
  });

  it('keeps the photos of a delivery rejected by Cloudinary', async () => {
    upload.mockRejectedValueOnce(new EvidenceUploadRejectedError(400, 'Invalid Signature'));
    seed({ type: 'completion', routeId: 'r1', stopId: 's1', photos: [photo] });
    seed({ type: 'finish', routeId: 'r2' });

    const result = await flushOfflineQueue();

    expect(result.rejected).toBe(1);
    expect(result.lastError).toBe('Cloudinary rechazó la foto: Invalid Signature');
    expect(api.completeStop).not.toHaveBeenCalled();
    expect(deleteEvidencePhoto).not.toHaveBeenCalled();
    expect(api.finishRoute).toHaveBeenCalled();
  });

  it('stops on a network error and keeps the remaining actions pending', async () => {
    api.startRoute.mockRejectedValueOnce(networkError);
    seed({ type: 'start', routeId: 'r1' });
    seed({ type: 'finish', routeId: 'r1' });

    const result = await flushOfflineQueue();

    expect(result).toMatchObject({ synced: 0, pending: 2, rejected: 0 });
    expect(api.finishRoute).not.toHaveBeenCalled();
    expect(await getPendingActionCount()).toBe(2);
  });

  it('stops on a temporary server error without rejecting the action', async () => {
    api.arriveAtStop.mockRejectedValueOnce(httpError(503));
    seed({ type: 'arrival', routeId: 'r1', stopId: 's1', body: { method: 'manual' } });

    const result = await flushOfflineQueue();

    expect(result).toMatchObject({ pending: 1, rejected: 0 });
    expect(await getRejectedActions()).toHaveLength(0);
  });

  it('counts an already completed stop as synced and removes its photos', async () => {
    api.completeStop.mockRejectedValueOnce(httpError(409, { code: 'STOP_ALREADY_COMPLETED' }));
    seed({ type: 'completion', routeId: 'r1', stopId: 's1', photos: [photo] });

    const result = await flushOfflineQueue();

    expect(result).toMatchObject({ synced: 1, rejected: 0 });
    expect(deleteEvidencePhoto).toHaveBeenCalledWith(photo.uri);
    expect(rows).toHaveLength(0);
  });

  it('removes the photos of a delivery once it syncs', async () => {
    seed({ type: 'completion', routeId: 'r1', stopId: 's1', photos: [photo] });

    await flushOfflineQueue();

    expect(api.completeStop).toHaveBeenCalledWith('r1', 's1', {
      evidence: [
        { photoUrl: 'https://res.cloudinary.com/demo/photo.jpg', capturedAt: photo.capturedAt },
      ],
      notes: undefined,
      recipientName: undefined,
    });
    expect(deleteEvidencePhoto).toHaveBeenCalledWith(photo.uri);
  });
});

describe('offline start time', () => {
  it('sends the time the driver tapped start as capturedAt', async () => {
    const coordinates = { latitude: 4.4389, longitude: -75.2322 };
    seed({
      type: 'start',
      routeId: 'r1',
      coordinates,
      capturedAt: '2026-11-23T13:05:00.000Z',
    });

    await flushOfflineQueue();

    expect(api.startRoute).toHaveBeenCalledWith('r1', coordinates, '2026-11-23T13:05:00.000Z');
  });

  it('uses the queue time for starts stored without capturedAt', async () => {
    const id = seed({ type: 'start', routeId: 'r1' });
    const createdAt = rows.find((row) => row.id === id)!.createdAt;

    await flushOfflineQueue();

    expect(api.startRoute).toHaveBeenCalledWith(
      'r1',
      undefined,
      new Date(createdAt).toISOString()
    );
  });
});

describe('GPS lane', () => {
  const sample = {
    latitude: 4.4389,
    longitude: -75.2322,
    capturedAt: '2026-11-23T15:00:00.000Z',
    isOffline: true,
  };

  function seedLocation(routeId: string) {
    return seed({ type: 'location', routeId, locations: [sample] });
  }

  it('keeps sending GPS points while a photo upload has no connection', async () => {
    upload.mockRejectedValueOnce(new EvidenceUploadNetworkError());
    seed({ type: 'completion', routeId: 'r1', stopId: 's1', photos: [photo] });
    seedLocation('r1');
    seedLocation('r1');

    const result = await flushOfflineQueue();

    expect(api.sendLocations).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ synced: 2, pending: 1, rejected: 0 });
  });

  it('keeps sending GPS points while a delivery waits for a temporary Cloudinary error', async () => {
    upload.mockRejectedValueOnce(new EvidenceUploadRejectedError(503, 'Unavailable'));
    seed({ type: 'completion', routeId: 'r1', stopId: 's1', photos: [photo] });
    seed({ type: 'finish', routeId: 'r1' });
    seedLocation('r1');

    const result = await flushOfflineQueue();

    expect(api.sendLocations).toHaveBeenCalledTimes(1);
    expect(api.finishRoute).not.toHaveBeenCalled();
    expect(result).toMatchObject({ synced: 1, pending: 2 });
  });

  it('holds the GPS points of a route whose start is still pending', async () => {
    api.startRoute.mockRejectedValueOnce(networkError);
    seed({ type: 'start', routeId: 'r1' });
    seedLocation('r1');
    seedLocation('r2');

    const result = await flushOfflineQueue();

    expect(api.sendLocations).toHaveBeenCalledTimes(1);
    expect(api.sendLocations).toHaveBeenCalledWith('r2', [sample]);
    expect(result).toMatchObject({ synced: 1, pending: 2, rejected: 0 });
  });

  it('sends the GPS points of a route before its finish', async () => {
    const calls: string[] = [];
    api.sendLocations.mockImplementation(async () => {
      calls.push('locations');
      return { accepted: 1, inserted: 1 };
    });
    api.finishRoute.mockImplementation(async () => {
      calls.push('finish');
      return undefined as never;
    });
    seed({ type: 'start', routeId: 'r1' });
    seedLocation('r1');
    seed({ type: 'finish', routeId: 'r1' });
    seedLocation('r1');

    await flushOfflineQueue();

    expect(calls).toEqual(['locations', 'finish', 'locations']);
  });

  it('rejects a GPS batch without stopping the other batches', async () => {
    api.sendLocations.mockRejectedValueOnce(
      httpError(409, { message: 'La ruta no está en curso', code: 'ROUTE_NOT_IN_PROGRESS' })
    );
    seedLocation('r1');
    seedLocation('r2');

    const result = await flushOfflineQueue();

    expect(api.sendLocations).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ synced: 1, rejected: 1, pending: 0 });
  });
});

describe('rejected actions', () => {
  it('can be moved back to pending and sent again', async () => {
    api.arriveAtStop.mockRejectedValueOnce(httpError(404, { message: 'Ruta no encontrada' }));
    const id = seed({ type: 'arrival', routeId: 'r1', stopId: 's1', body: { method: 'manual' } });
    await flushOfflineQueue();

    await retryRejectedAction(id);
    const result = await flushOfflineQueue();

    expect(result).toMatchObject({ synced: 1, rejected: 0 });
    expect(rows).toHaveLength(0);
  });

  it('are not counted as pending local changes', async () => {
    api.arriveAtStop.mockRejectedValueOnce(httpError(404, { message: 'Ruta no encontrada' }));
    seed({ type: 'arrival', routeId: 'r1', stopId: 's1', body: { method: 'manual' } });
    await flushOfflineQueue();

    expect(await getPendingActionCount()).toBe(0);
    expect(await getPendingActionSummary()).toEqual({ count: 0, routeIds: [], stopIds: [] });
  });
});
