import { clearEvidencePhotos } from '../evidence-files';
import { clearOwnerOfflineData, setOfflineOwner } from '../offline-owner';

const mockDatabase = {
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  runAsync: jest.fn(),
  withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
};

jest.mock('../offline-db', () => ({
  getOfflineDatabase: async () => mockDatabase,
}));

jest.mock('../evidence-files', () => ({
  clearEvidencePhotos: jest.fn(),
  evidenceFileName: (uri: string) => uri.split('/').pop(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockDatabase.withTransactionAsync.mockImplementation(async (task: () => Promise<void>) =>
    task()
  );
});

function sqlCalls(): string[] {
  return mockDatabase.runAsync.mock.calls.map(([sql]) => String(sql));
}

describe('setOfflineOwner', () => {
  it('adopts rows without owner and is not a change on the first sign-in', async () => {
    mockDatabase.getFirstAsync.mockResolvedValue(null);

    await expect(setOfflineOwner('driver-a')).resolves.toEqual({ changed: false });

    expect(mockDatabase.runAsync).toHaveBeenCalledWith(
      'UPDATE offline_queue SET owner_user_id = ? WHERE owner_user_id IS NULL',
      'driver-a'
    );
    expect(mockDatabase.runAsync).toHaveBeenCalledWith(
      'DELETE FROM route_cache WHERE owner_user_id IS NOT ?',
      'driver-a'
    );
  });

  it('keeps the queue when the same driver signs in again', async () => {
    mockDatabase.getFirstAsync.mockResolvedValue({ value: 'driver-a' });

    await expect(setOfflineOwner('driver-a')).resolves.toEqual({ changed: false });
    expect(sqlCalls().some((sql) => sql.startsWith('DELETE FROM offline_queue'))).toBe(false);
  });

  it('reports a change when another driver signs in, without deleting the queue', async () => {
    mockDatabase.getFirstAsync.mockResolvedValue({ value: 'driver-a' });

    await expect(setOfflineOwner('driver-b')).resolves.toEqual({ changed: true });
    expect(sqlCalls().some((sql) => sql.startsWith('DELETE FROM offline_queue'))).toBe(false);
  });
});

describe('clearOwnerOfflineData', () => {
  it('deletes only the current driver rows and keeps the photos of other drivers', async () => {
    mockDatabase.getFirstAsync.mockResolvedValue({ value: 'driver-b' });
    mockDatabase.getAllAsync.mockResolvedValue([
      {
        owner_user_id: 'driver-a',
        payload: JSON.stringify({ type: 'completion', photos: [{ uri: 'file:///evidence/a.jpg' }] }),
      },
      {
        owner_user_id: 'driver-b',
        payload: JSON.stringify({ type: 'completion', photos: [{ uri: 'file:///evidence/b.jpg' }] }),
      },
    ]);

    await clearOwnerOfflineData();

    expect(mockDatabase.runAsync).toHaveBeenCalledWith(
      'DELETE FROM offline_queue WHERE owner_user_id = ?',
      'driver-b'
    );
    expect(clearEvidencePhotos).toHaveBeenCalledWith(new Set(['a.jpg']));
  });

  it('does nothing when no driver owns the data', async () => {
    mockDatabase.getFirstAsync.mockResolvedValue(null);

    await clearOwnerOfflineData();

    expect(mockDatabase.runAsync).not.toHaveBeenCalled();
    expect(clearEvidencePhotos).not.toHaveBeenCalled();
  });
});
