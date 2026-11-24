import { isAxiosError } from 'axios';
import { getApiErrorCode, getApiErrorMessage } from './api';

// Errors raised while uploading evidence photos to Cloudinary (RF16). They are
// typed so the offline queue can tell a lost connection from a real rejection.

/** The upload request never got a response (no connection, DNS, TLS). */
export class EvidenceUploadNetworkError extends Error {
  constructor(cause?: unknown) {
    super('Sin conexión a internet. Guardaremos los datos para sincronizarlos.');
    this.name = 'EvidenceUploadNetworkError';
    this.cause = cause;
  }
}

/** Cloudinary answered with an error status. */
export class EvidenceUploadRejectedError extends Error {
  constructor(
    public readonly status: number,
    public readonly providerMessage: string
  ) {
    super(`Cloudinary rechazó la foto: ${providerMessage}`);
    this.name = 'EvidenceUploadRejectedError';
  }
}

/** The photo file is no longer on the device, so it can never be uploaded. */
export class EvidenceFileMissingError extends Error {
  constructor() {
    super('La foto de evidencia ya no está guardada en el teléfono.');
    this.name = 'EvidenceFileMissingError';
  }
}

export type SyncErrorKind = 'network' | 'retry' | 'rejected' | 'already-done';

/** Server codes meaning the action is already applied on the server. */
const ALREADY_DONE_CODES = new Set(['STOP_ALREADY_COMPLETED']);

function isTemporaryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** True only for a real lost connection: the request got no response. */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof EvidenceUploadNetworkError) return true;
  return isAxiosError(error) && !error.response;
}

/**
 * Decides what the offline queue does with a failed action (RF17, RNF07):
 * - network: no connection, stop and retry later;
 * - retry: temporary server answer (401 session refresh, 408, 429, 5xx), retry later;
 * - rejected: permanent answer (403 and other 4xx, Cloudinary 4xx, missing photo or
 *   an unknown error), kept on the device as rejected so it does not block the queue;
 * - already-done: the server already has the change, so it counts as synced.
 */
export function classifySyncError(error: unknown): SyncErrorKind {
  if (isNetworkError(error)) return 'network';

  if (error instanceof EvidenceUploadRejectedError) {
    return isTemporaryStatus(error.status) ? 'retry' : 'rejected';
  }

  if (isAxiosError(error) && error.response) {
    const status = error.response.status;
    const code = getApiErrorCode(error);
    if (code && ALREADY_DONE_CODES.has(code)) return 'already-done';
    if (status === 401 || isTemporaryStatus(status)) return 'retry';
    return 'rejected';
  }

  return 'rejected';
}

/** Message shown to the driver for any sync or action error. */
export function getSyncErrorMessage(error: unknown): string {
  if (
    error instanceof EvidenceUploadNetworkError ||
    error instanceof EvidenceUploadRejectedError ||
    error instanceof EvidenceFileMissingError
  ) {
    return error.message;
  }
  return getApiErrorMessage(error);
}

/** HTTP or Cloudinary status of a failed action, when there is one. */
export function getSyncErrorStatus(error: unknown): number | null {
  if (error instanceof EvidenceUploadRejectedError) return error.status;
  if (isAxiosError(error)) return error.response?.status ?? null;
  return null;
}
