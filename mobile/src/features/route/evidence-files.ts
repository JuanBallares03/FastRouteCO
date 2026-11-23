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

/** File name of an evidence photo, used to compare URIs from different sources. */
export function evidenceFileName(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

/** Deletes cached evidence photos except the ones named in `keep`. */
export function clearEvidencePhotos(keep: ReadonlySet<string> = new Set()): void {
  if (!evidenceDirectory.exists) {
    return;
  }

  for (const entry of evidenceDirectory.list()) {
    if (keep.has(evidenceFileName(entry.uri))) continue;
    try {
      entry.delete();
    } catch {
      // ignore files that are already gone
    }
  }

  if (keep.size > 0) return;

  try {
    evidenceDirectory.delete();
  } catch {
    // ignore a directory that is already gone
  }
}
