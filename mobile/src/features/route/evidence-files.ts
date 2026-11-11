import { Directory, File, Paths } from 'expo-file-system';

const evidenceDirectory = new Directory(Paths.document, 'evidence');

export async function persistEvidencePhoto(uri: string): Promise<string> {
  if (!evidenceDirectory.exists) {
    evidenceDirectory.create({ intermediates: true });
  }

  const source = new File(uri);
  const destination = new File(evidenceDirectory, `evidence-${Date.now()}.jpg`);
  await source.copy(destination);
  return destination.uri;
}

export function deleteEvidencePhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

export function clearEvidencePhotos(): void {
  if (!evidenceDirectory.exists) {
    return;
  }

  for (const entry of evidenceDirectory.list()) {
    try {
      entry.delete();
    } catch {
      // ignore files that are already gone
    }
  }

  try {
    evidenceDirectory.delete();
  } catch {
    // ignore a directory that is already gone
  }
}
