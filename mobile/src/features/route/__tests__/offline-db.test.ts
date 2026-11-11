import { clearOfflineData, getOfflineDatabase } from '../offline-db';

const mockDatabase = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  withTransactionAsync: jest.fn(),
  runAsync: jest.fn(),
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
