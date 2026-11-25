import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { routesApi } from '../api';
import { uploadEvidencePhoto } from '../cloudinary';
import type { PendingAction } from '../offline-actions';
import { markReported, readEntries, type RejectedEntry } from '../offline-queue-store';
import { EvidenceFileMissingError } from '../sync-errors';
import { reportRejectedActions, resetRefusedReports } from '../sync-rejection-report';

jest.mock('@/services/http', () => ({ api: {} }));

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  routesApi: {
    getSyncRejectionSignature: jest.fn(),
    reportSyncRejection: jest.fn(),
  },
}));

jest.mock('../cloudinary', () => ({ uploadEvidencePhoto: jest.fn() }));

jest.mock('../offline-queue-store', () => ({
  readEntries: jest.fn(),
  markReported: jest.fn(),
}));

const api = jest.mocked(routesApi);
const upload = jest.mocked(uploadEvidencePhoto);
const read = jest.mocked(readEntries);
const mark = jest.mocked(markReported);

const signature = { cloudName: 'demo', apiKey: 'k', timestamp: 1, folder: 'f', signature: 's' };
const photo = { uri: 'file:///evidence/a.jpg', capturedAt: '2026-11-24T15:30:00.000Z' };

function rejected(
  action: PendingAction,
  overrides: Partial<RejectedEntry> = {}
): RejectedEntry {
  return {
    id: action.id,
    kind: action.type === 'location' ? 'location' : 'action',
    createdAt: Date.parse('2026-11-24T15:31:00.000Z'),
    action,
    rejectedAt: Date.parse('2026-11-24T16:00:00.000Z'),
    reason: 'Ruta no encontrada',
    code: 'ROUTE_NOT_FOUND',
    status: 404,
    reportedAt: null,
    ...overrides,
  };
}

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data: {}, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response);
}

const networkError = new AxiosError('Network Error', 'ERR_NETWORK');

const delivery: PendingAction = {
  id: 'c1',
  type: 'completion',
  routeId: 'r1',
  stopId: 's1',
  photos: [photo],
};

beforeEach(() => {
  jest.clearAllMocks();
  resetRefusedReports();
  api.getSyncRejectionSignature.mockResolvedValue(signature);
  api.reportSyncRejection.mockResolvedValue(undefined);
  upload.mockResolvedValue('https://res.cloudinary.com/demo/pending/a.jpg');
  mark.mockResolvedValue(undefined);
});

describe('reportRejectedActions', () => {
  it('uploads the photos of a rejected delivery and reports it once with its real time', async () => {
    read.mockResolvedValue([rejected(delivery)]);

    await expect(reportRejectedActions(() => 99)).resolves.toBe(1);

    expect(read).toHaveBeenCalledWith('rejected', 'action');
    expect(api.getSyncRejectionSignature).toHaveBeenCalledWith('r1', 's1');
    expect(upload).toHaveBeenCalledWith(signature, photo.uri);
    expect(api.reportSyncRejection).toHaveBeenCalledWith({
      clientActionId: 'c1',
      routeId: 'r1',
      stopId: 's1',
      actionType: 'completion',
      capturedAt: '2026-11-24T15:31:00.000Z',
      reason: 'Ruta no encontrada',
      errorCode: 'ROUTE_NOT_FOUND',
      photos: [
        { photoUrl: 'https://res.cloudinary.com/demo/pending/a.jpg', capturedAt: photo.capturedAt },
      ],
    });
    expect(mark).toHaveBeenCalledWith('c1', 99);
  });

  it('uses the tap time of an offline start', async () => {
    read.mockResolvedValue([
      rejected({ id: 'st1', type: 'start', routeId: 'r1', capturedAt: '2026-11-24T13:00:00.000Z' }),
    ]);

    await reportRejectedActions();

    expect(api.reportSyncRejection).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'start', capturedAt: '2026-11-24T13:00:00.000Z' })
    );
    expect(api.reportSyncRejection.mock.calls[0][0]).not.toHaveProperty('stopId');
  });

  it('reports a delivery of a stop moved to another driver', async () => {
    read.mockResolvedValue([
      rejected(delivery, { code: 'STOP_NOT_FOUND', reason: 'Parada no encontrada' }),
    ]);

    await reportRejectedActions();

    expect(api.reportSyncRejection).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'STOP_NOT_FOUND' })
    );
  });

  it('skips actions already reported, GPS points and other rejection codes', async () => {
    read.mockResolvedValue([
      rejected(delivery, { reportedAt: 5 }),
      rejected({ id: 'g1', type: 'location', routeId: 'r1', locations: [] }),
      rejected({ id: 'f1', type: 'finish', routeId: 'r1' }, { code: 'VALIDATION_ERROR' }),
      rejected({ id: 'f2', type: 'finish', routeId: 'r1' }, { code: null }),
    ]);

    await expect(reportRejectedActions()).resolves.toBe(0);
    expect(api.reportSyncRejection).not.toHaveBeenCalled();
  });

  it('leaves the report pending when there is no connection', async () => {
    read.mockResolvedValue([rejected(delivery), rejected({ id: 'f1', type: 'finish', routeId: 'r1' })]);
    api.reportSyncRejection.mockRejectedValueOnce(networkError);

    await expect(reportRejectedActions()).resolves.toBe(0);

    expect(api.reportSyncRejection).toHaveBeenCalledTimes(1);
    expect(mark).not.toHaveBeenCalled();
  });

  it('stops on a failed photo upload without a connection', async () => {
    read.mockResolvedValue([rejected(delivery)]);
    upload.mockRejectedValueOnce(networkError);

    await reportRejectedActions();

    expect(api.reportSyncRejection).not.toHaveBeenCalled();
    expect(mark).not.toHaveBeenCalled();
  });

  it('does not retry a report the server refused until the app restarts', async () => {
    read.mockResolvedValue([rejected(delivery), rejected({ id: 'f1', type: 'finish', routeId: 'r1' })]);
    api.reportSyncRejection.mockRejectedValueOnce(httpError(404));

    await expect(reportRejectedActions()).resolves.toBe(1);
    expect(mark).toHaveBeenCalledWith('f1', expect.any(Number));
    expect(mark).not.toHaveBeenCalledWith('c1', expect.any(Number));

    api.reportSyncRejection.mockClear();
    await reportRejectedActions();
    expect(api.reportSyncRejection).not.toHaveBeenCalledWith(
      expect.objectContaining({ clientActionId: 'c1' })
    );
  });

  it('still reports a delivery whose photo file is gone', async () => {
    read.mockResolvedValue([rejected(delivery)]);
    upload.mockRejectedValueOnce(new EvidenceFileMissingError());

    await reportRejectedActions();

    expect(api.reportSyncRejection).toHaveBeenCalledWith(expect.objectContaining({ photos: [] }));
    expect(mark).toHaveBeenCalledWith('c1', expect.any(Number));
  });
});
