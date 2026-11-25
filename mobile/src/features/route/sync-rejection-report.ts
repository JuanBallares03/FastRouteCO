import { routesApi, type SyncRejectionReportPayload } from './api';
import { uploadEvidencePhoto } from './cloudinary';
import type { PendingAction } from './offline-actions';
import { markReported, readEntries, type RejectedEntry } from './offline-queue-store';
import { classifySyncError, EvidenceFileMissingError } from './sync-errors';

// Reports to the supervisor, once, the offline actions the server rejected
// because the route was reassigned or closed, or the stop was moved to another
// driver (RF07, HU-10 CA03, HU-36 CA04 and CA05). The rows stay rejected on the
// phone with their photos; reported_at only prevents a second report.

/** Codes the backend accepts in a report; any other rejection is not reported. */
export const REPORTABLE_CODES = new Set(['ROUTE_NOT_FOUND', 'ROUTE_NOT_IN_PROGRESS', 'STOP_NOT_FOUND']);

const MAX_REASON_LENGTH = 500;
const DEFAULT_REASON = 'El servidor rechazó la acción.';

// Reports the server refused for good (403/404/409/422...) are not retried in
// this session, so the flush does not loop on them; they are tried again after
// the app restarts.
const refusedThisSession = new Set<string>();

/** Only for tests. */
export function resetRefusedReports(): void {
  refusedThisSession.clear();
}

type ReportableAction = Exclude<PendingAction, { type: 'location' }>;

function isReportable(entry: RejectedEntry): entry is RejectedEntry & { action: ReportableAction } {
  return (
    entry.action.type !== 'location' &&
    entry.reportedAt === null &&
    entry.code !== null &&
    REPORTABLE_CODES.has(entry.code) &&
    !refusedThisSession.has(entry.id)
  );
}

// The real time of the action: the start keeps the tap time; other actions were
// stored in the queue the moment the driver did them.
function capturedAtOf(entry: RejectedEntry & { action: ReportableAction }): string {
  if (entry.action.type === 'start' && entry.action.capturedAt) {
    return entry.action.capturedAt;
  }
  return new Date(entry.createdAt).toISOString();
}

async function uploadPendingPhotos(
  action: Extract<ReportableAction, { type: 'completion' }>
): Promise<SyncRejectionReportPayload['photos']> {
  if (action.photos.length === 0) return [];

  const signature = await routesApi.getSyncRejectionSignature(action.routeId, action.stopId);
  const photos: SyncRejectionReportPayload['photos'] = [];
  for (const photo of action.photos) {
    try {
      const photoUrl = await uploadEvidencePhoto(signature, photo.uri);
      photos.push({ photoUrl, capturedAt: photo.capturedAt });
    } catch (error) {
      // A photo file that is already gone cannot be uploaded; the report still
      // tells the supervisor about the delivery.
      if (error instanceof EvidenceFileMissingError) continue;
      throw error;
    }
  }
  return photos;
}

async function buildPayload(
  entry: RejectedEntry & { action: ReportableAction }
): Promise<SyncRejectionReportPayload> {
  const { action } = entry;
  const reason = entry.reason.trim() || DEFAULT_REASON;

  return {
    clientActionId: entry.id,
    routeId: action.routeId,
    ...(action.type === 'arrival' || action.type === 'completion' ? { stopId: action.stopId } : {}),
    actionType: action.type,
    capturedAt: capturedAtOf(entry),
    reason: reason.slice(0, MAX_REASON_LENGTH),
    errorCode: entry.code ?? undefined,
    photos: action.type === 'completion' ? await uploadPendingPhotos(action) : [],
  };
}

/**
 * Sends the reports still due. Stops at the first network or temporary error
 * and leaves the rest for the next flush. Must run inside the queue lock.
 */
export async function reportRejectedActions(now: () => number = Date.now): Promise<number> {
  const entries = (await readEntries('rejected', 'action')).filter(isReportable);
  let reported = 0;

  for (const entry of entries) {
    try {
      await routesApi.reportSyncRejection(await buildPayload(entry));
    } catch (error) {
      const kind = classifySyncError(error);
      if (kind === 'network' || kind === 'retry') return reported;
      refusedThisSession.add(entry.id);
      continue;
    }

    await markReported(entry.id, now());
    reported += 1;
  }

  return reported;
}
