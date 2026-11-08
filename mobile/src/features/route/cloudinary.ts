import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import type { EvidenceUpload } from './types';

interface CloudinaryResponse {
  secure_url?: string;
  error?: { message?: string };
}

export async function uploadEvidencePhoto(
  upload: EvidenceUpload,
  uri: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', new File(uri));
  formData.append('api_key', upload.apiKey);
  formData.append('timestamp', String(upload.timestamp));
  formData.append('folder', upload.folder);
  formData.append('signature', upload.signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${upload.cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const data = (await response.json()) as CloudinaryResponse;

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message ?? 'No se pudo subir la foto de evidencia.');
  }

  return data.secure_url;
}
