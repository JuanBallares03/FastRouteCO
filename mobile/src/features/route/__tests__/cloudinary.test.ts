import { uploadEvidencePhoto } from '../cloudinary';
import {
  EvidenceFileMissingError,
  EvidenceUploadNetworkError,
  EvidenceUploadRejectedError,
} from '../sync-errors';

const mockFetch = jest.fn();
let mockFileExists = true;

jest.mock('expo/fetch', () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

jest.mock('expo-file-system', () => ({
  File: class {
    get exists() {
      return mockFileExists;
    }
  },
}));

jest.mock('@/services/http', () => ({ api: {} }));

const upload = {
  cloudName: 'demo',
  apiKey: 'key',
  timestamp: 1,
  folder: 'fastrouteco/evidence',
  signature: 'signature',
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFileExists = true;
});

describe('uploadEvidencePhoto', () => {
  it('returns the secure URL of the uploaded photo', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { secure_url: 'https://res.cloudinary.com/x.jpg' }));
    await expect(uploadEvidencePhoto(upload, 'file:///photo.jpg')).resolves.toBe(
      'https://res.cloudinary.com/x.jpg'
    );
  });

  it('reports a network error when fetch gets no response', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    await expect(uploadEvidencePhoto(upload, 'file:///photo.jpg')).rejects.toBeInstanceOf(
      EvidenceUploadNetworkError
    );
  });

  it('reports the Cloudinary rejection with its status and message', async () => {
    mockFetch.mockResolvedValue(jsonResponse(400, { error: { message: 'Invalid Signature' } }));
    const error = await uploadEvidencePhoto(upload, 'file:///photo.jpg').catch((e) => e);
    expect(error).toBeInstanceOf(EvidenceUploadRejectedError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Cloudinary rechazó la foto: Invalid Signature');
  });

  it('keeps the status of a Cloudinary server error without a JSON body', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    const error = await uploadEvidencePhoto(upload, 'file:///photo.jpg').catch((e) => e);
    expect(error).toBeInstanceOf(EvidenceUploadRejectedError);
    expect(error.status).toBe(502);
  });

  it('fails without uploading when the photo is missing', async () => {
    mockFileExists = false;
    await expect(uploadEvidencePhoto(upload, 'file:///photo.jpg')).rejects.toBeInstanceOf(
      EvidenceFileMissingError
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
