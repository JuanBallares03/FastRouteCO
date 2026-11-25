import { v2 as cloudinary } from 'cloudinary';
import { ServiceUnavailableError } from '../../lib/errors.js';
import { env } from '../../env.js';

function cloudinaryConfig() {
  // Signing with empty credentials produces uploads Cloudinary always rejects,
  // so the missing configuration is reported as a temporary server error (RF16).
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new ServiceUnavailableError(
      'El almacenamiento de fotos de evidencia no está configurado',
      'EVIDENCE_STORAGE_NOT_CONFIGURED'
    );
  }
  return { cloudName, apiKey, apiSecret };
}

export function evidenceFolder(companyId: string, routeId: string, stopId: string): string {
  return `fastrouteco/evidence/${companyId}/${routeId}/${stopId}`;
}

// Signed direct upload to Cloudinary: the phone uploads the file and only the
// resulting URL reaches the API (RF16).
export function signEvidenceUpload(folder: string) {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);

  return { cloudName, apiKey, timestamp, folder, signature };
}

// True when the URL is an upload of this Cloudinary account inside the folder.
export function isEvidenceUrlInFolder(photoUrl: string, folder: string): boolean {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName) return false;

  let url: URL;
  try {
    url = new URL(photoUrl);
  } catch {
    return false;
  }

  return (
    url.protocol === 'https:' &&
    url.hostname === 'res.cloudinary.com' &&
    url.pathname.startsWith(`/${cloudName}/`) &&
    url.pathname.includes(`/${folder}/`)
  );
}
