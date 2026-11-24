import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import {
  EvidenceFileMissingError,
  EvidenceUploadNetworkError,
  EvidenceUploadRejectedError,
  classifySyncError,
  getSyncErrorMessage,
  getSyncErrorStatus,
  isNetworkError,
} from '../sync-errors';

jest.mock('@/services/http', () => ({ api: {} }));

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response);
}

const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
const timeoutError = new AxiosError('timeout', 'ECONNABORTED');

describe('isNetworkError', () => {
  it('accepts only requests that got no response', () => {
    expect(isNetworkError(networkError)).toBe(true);
    expect(isNetworkError(timeoutError)).toBe(true);
    expect(isNetworkError(new EvidenceUploadNetworkError())).toBe(true);
    expect(isNetworkError(httpError(500))).toBe(false);
    expect(isNetworkError(new EvidenceUploadRejectedError(400, 'Invalid Signature'))).toBe(false);
    expect(isNetworkError(new Error('boom'))).toBe(false);
  });
});

describe('classifySyncError', () => {
  it('keeps network errors for a later retry', () => {
    expect(classifySyncError(networkError)).toBe('network');
    expect(classifySyncError(new EvidenceUploadNetworkError())).toBe('network');
  });

  it.each([401, 408, 429, 500, 503])('retries the temporary status %i', (status) => {
    expect(classifySyncError(httpError(status))).toBe('retry');
  });

  it.each([400, 403, 404, 409, 422])('rejects the permanent status %i', (status) => {
    expect(classifySyncError(httpError(status))).toBe('rejected');
  });

  it('treats an already completed stop as synced', () => {
    expect(classifySyncError(httpError(409, { code: 'STOP_ALREADY_COMPLETED' }))).toBe(
      'already-done'
    );
  });

  it('classifies Cloudinary answers by status', () => {
    expect(classifySyncError(new EvidenceUploadRejectedError(400, 'Invalid Signature'))).toBe(
      'rejected'
    );
    expect(classifySyncError(new EvidenceUploadRejectedError(503, 'Unavailable'))).toBe('retry');
    expect(classifySyncError(new EvidenceUploadRejectedError(429, 'Rate limited'))).toBe('retry');
  });

  it('rejects a missing photo and unknown errors', () => {
    expect(classifySyncError(new EvidenceFileMissingError())).toBe('rejected');
    expect(classifySyncError(new Error('boom'))).toBe('rejected');
    expect(classifySyncError(new TypeError('x is undefined'))).toBe('rejected');
  });
});

describe('getSyncErrorMessage', () => {
  it('shows the real reason to the driver', () => {
    expect(getSyncErrorMessage(new EvidenceUploadRejectedError(400, 'Invalid Signature'))).toBe(
      'Cloudinary rechazó la foto: Invalid Signature'
    );
    expect(getSyncErrorMessage(httpError(404, { message: 'Ruta no encontrada' }))).toBe(
      'Ruta no encontrada'
    );
    expect(getSyncErrorMessage(new EvidenceFileMissingError())).toBe(
      'La foto de evidencia ya no está guardada en el teléfono.'
    );
  });

  it('reports the status of the failed request', () => {
    expect(getSyncErrorStatus(httpError(404))).toBe(404);
    expect(getSyncErrorStatus(new EvidenceUploadRejectedError(400, 'x'))).toBe(400);
    expect(getSyncErrorStatus(new Error('boom'))).toBeNull();
  });
});
