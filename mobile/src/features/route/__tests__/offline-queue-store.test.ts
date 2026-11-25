import { insertEntry, markReported, readEntries } from '../offline-queue-store';

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
    expect(mockDatabase.getAllAsync.mock.calls[0][0]).toContain(
      "owner_user_id = (SELECT value FROM offline_meta WHERE key = 'current_owner')"
    );
  });

  it('stores the lane of each new entry', async () => {
    await insertEntry('row-3', { type: 'location', routeId: 'r1', locations: [] }, 'location', 5);

    expect(mockDatabase.runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO offline_queue[\s\S]*owner_user_id[\s\S]*current_owner/),
      'row-3',
      JSON.stringify({ type: 'location', routeId: 'r1', locations: [] }),
      5,
      'location'
    );
  });

  it('marks only a rejected row of the current driver as reported', async () => {
    await markReported('row-4', 30);

    const [sql, reportedAt, id] = mockDatabase.runAsync.mock.calls[0];
    expect(sql).toMatch(/UPDATE offline_queue SET reported_at = \?/);
    expect(sql).toContain("status = 'rejected'");
    expect(sql).toContain(
      "owner_user_id = (SELECT value FROM offline_meta WHERE key = 'current_owner')"
    );
    expect(reportedAt).toBe(30);
    expect(id).toBe('row-4');
  });
});
