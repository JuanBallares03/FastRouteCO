import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import {
  EvidenceFileMissingError,
  EvidenceUploadNetworkError,
  EvidenceUploadRejectedError,
} from './sync-errors';
import type { EvidenceUpload } from './types';

interface CloudinaryResponse {
  secure_url?: string;
  error?: { message?: string };
}

const DEFAULT_REJECTION = 'No se pudo subir la foto de evidencia.';

export async function uploadEvidencePhoto(
  upload: EvidenceUpload,
  uri: string
): Promise<string> {
  const file = new File(uri);
  if (!file.exists) {
    throw new EvidenceFileMissingError();
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', upload.apiKey);
  formData.append('timestamp', String(upload.timestamp));
  formData.append('folder', upload.folder);
  formData.append('signature', upload.signature);

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${upload.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );
  } catch (error) {
    // fetch only throws when no response arrives, whatever its error type.
    throw new EvidenceUploadNetworkError(error);
  }

  let data: CloudinaryResponse = {};
  try {
    data = (await response.json()) as CloudinaryResponse;
  } catch {
    data = {};
  }

  if (!response.ok || !data.secure_url) {
    throw new EvidenceUploadRejectedError(
      response.ok ? 422 : response.status,
      data.error?.message ?? DEFAULT_REJECTION
    );
  }

  return data.secure_url;
}
