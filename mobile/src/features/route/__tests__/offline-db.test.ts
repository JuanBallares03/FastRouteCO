import { clearOfflineData, getOfflineDatabase, migrateSchema } from '../offline-db';

const mockDatabase = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  runAsync: jest.fn(),
  getFirstAsync: jest.fn().mockResolvedValue({ user_version: 1 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
  closeAsync: jest.fn().mockResolvedValue(undefined),
};
const mockOpenDatabaseAsync = jest.fn().mockResolvedValue(mockDatabase);
const mockDeleteDatabaseAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
  deleteDatabaseAsync: (...args: unknown[]) => mockDeleteDatabaseAsync(...args),
}));

jest.mock('expo-file-system', () => ({
  File: class {
    exists = false;
    async text() {
      return '';
    }
    delete() {}
  },
  Paths: { document: 'document' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockDatabase.getFirstAsync.mockResolvedValue({ user_version: 1 });
  mockDatabase.getAllAsync.mockResolvedValue([]);
  mockDatabase.withTransactionAsync.mockImplementation(async (task: () => Promise<void>) =>
    task()
  );
});

type MigrationDatabase = Parameters<typeof migrateSchema>[0];
const db = mockDatabase as unknown as MigrationDatabase;

function executedSql(): string {
  return mockDatabase.execAsync.mock.calls.map(([sql]) => String(sql)).join(' ');
}

describe('offline schema migration', () => {
  it('adds the new columns to version 0 and keeps the stored actions', async () => {
    mockDatabase.getFirstAsync.mockResolvedValue({ user_version: 0 });
    mockDatabase.getAllAsync.mockResolvedValue([
      { id: 'start-1', payload: JSON.stringify({ type: 'start', routeId: 'r1' }) },
      { id: 'gps-1', payload: JSON.stringify({ type: 'location', routeId: 'r1' }) },
      { id: 'broken', payload: '{not json' },
    ]);

    await migrateSchema(db);

    const sql = executedSql();
    expect(sql).toContain("ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
    expect(sql).toContain("ADD COLUMN kind TEXT NOT NULL DEFAULT 'action'");
    expect(sql).toContain('ADD COLUMN owner_user_id TEXT');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS offline_meta');
    expect(sql).toContain('PRAGMA user_version = 1');
    expect(sql).not.toMatch(/DELETE|DROP/);

    expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1);
    expect(mockDatabase.runAsync).toHaveBeenCalledWith(
      "UPDATE offline_queue SET kind = 'location' WHERE id = ?",
      'gps-1'
    );
  });

  it('does nothing when the schema is already current', async () => {
    await migrateSchema(db);

    expect(mockDatabase.withTransactionAsync).not.toHaveBeenCalled();
    expect(mockDatabase.execAsync).not.toHaveBeenCalled();
  });

  it('does not mark the version when a step fails, so it runs again', async () => {
    mockDatabase.getFirstAsync.mockResolvedValue({ user_version: 0 });
    mockDatabase.getAllAsync.mockRejectedValue(new Error('disk I/O error'));

    await expect(migrateSchema(db)).rejects.toThrow('disk I/O error');
    expect(executedSql()).not.toContain('PRAGMA user_version = 1');
  });
});

describe('offline database', () => {
  it('closes and deletes the local database on sign-out', async () => {
    await getOfflineDatabase();
    await clearOfflineData();

    expect(mockDatabase.closeAsync).toHaveBeenCalled();
    expect(mockDeleteDatabaseAsync).toHaveBeenCalledWith('fastrouteco.db');
  });

  it('opens a fresh database after it has been cleared', async () => {
    await getOfflineDatabase();
    await clearOfflineData();
    await getOfflineDatabase();

    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2);
  });
});
