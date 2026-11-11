import { clearEvidencePhotos } from '../evidence-files';

const mockEntry = { delete: jest.fn() };
const mockList = jest.fn(() => [mockEntry]);
const mockDirectoryDelete = jest.fn();
let mockDirectoryExists = true;

jest.mock('expo-file-system', () => ({
  Directory: class {
    get exists() {
      return mockDirectoryExists;
    }
    list() {
      return mockList();
    }
    delete() {
      return mockDirectoryDelete();
    }
  },
  File: class {},
  Paths: { document: 'document' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockDirectoryExists = true;
  mockList.mockReturnValue([mockEntry]);
});

describe('evidence files', () => {
  it('deletes cached evidence photos on sign-out', () => {
    clearEvidencePhotos();

    expect(mockEntry.delete).toHaveBeenCalled();
    expect(mockDirectoryDelete).toHaveBeenCalled();
  });

  it('does nothing when there is no evidence directory', () => {
    mockDirectoryExists = false;

    clearEvidencePhotos();

    expect(mockList).not.toHaveBeenCalled();
    expect(mockDirectoryDelete).not.toHaveBeenCalled();
  });
});
