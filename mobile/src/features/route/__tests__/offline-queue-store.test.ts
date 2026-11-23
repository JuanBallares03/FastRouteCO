import { insertEntry, readEntries } from '../offline-queue-store';

const mockDatabase = {
  runAsync: jest.fn(),
  getAllAsync: jest.fn(),
};

jest.mock('../offline-db', () => ({
  getOfflineDatabase: async () => mockDatabase,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('offline queue store', () => {
  it('reads the action id from the row, not from the payload', async () => {
    mockDatabase.getAllAsync.mockResolvedValue([
      {
        id: 'row-1',
        payload: JSON.stringify({ type: 'finish', routeId: 'r1' }),
        created_at: 10,
        kind: 'action',
      },
    ]);

    const entries = await readEntries('pending');

    expect(entries).toEqual([
      {
        id: 'row-1',
        kind: 'action',
        createdAt: 10,
        action: { type: 'finish', routeId: 'r1', id: 'row-1' },
      },
    ]);
  });

  it('skips rows whose payload cannot be read', async () => {
    mockDatabase.getAllAsync.mockResolvedValue([
      { id: 'broken', payload: '{not json', created_at: 1, kind: 'action' },
      { id: 'no-type', payload: JSON.stringify({ routeId: 'r1' }), created_at: 2, kind: 'action' },
    ]);

    expect(await readEntries('pending')).toEqual([]);
  });

  it('maps the rejection details of rejected rows', async () => {
    mockDatabase.getAllAsync.mockResolvedValue([
      {
        id: 'row-2',
        payload: JSON.stringify({ type: 'start', routeId: 'r1' }),
        created_at: 10,
        kind: 'action',
        rejected_at: 20,
        reject_reason: 'Ruta no encontrada',
        reject_code: 'ROUTE_NOT_FOUND',
        reject_status: 404,
        reported_at: null,
      },
    ]);

    const [entry] = await readEntries('rejected');

    expect(entry).toMatchObject({
      id: 'row-2',
      rejectedAt: 20,
      reason: 'Ruta no encontrada',
      code: 'ROUTE_NOT_FOUND',
      status: 404,
      reportedAt: null,
    });
    expect(mockDatabase.getAllAsync.mock.calls[0][1]).toBe('rejected');
  });

  it('stores the lane of each new entry', async () => {
    await insertEntry('row-3', { type: 'location', routeId: 'r1', locations: [] }, 'location', 5);

    expect(mockDatabase.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO offline_queue'),
      'row-3',
      JSON.stringify({ type: 'location', routeId: 'r1', locations: [] }),
      5,
      'location'
    );
  });
});
