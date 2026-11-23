import { getApiErrorCode, routesApi } from './api';
import { uploadEvidencePhoto } from './cloudinary';
import { deleteEvidencePhoto } from './evidence-files';
import {
  queueKindOf,
  type NewPendingAction,
  type PendingAction,
} from './offline-actions';
import {
  countEntries,
  insertEntry,
  markRejected,
  readEntries,
  removeEntry,
  restoreRejected,
  type QueueEntry,
  type RejectedEntry,
} from './offline-queue-store';
import { classifySyncError, getSyncErrorMessage, getSyncErrorStatus } from './sync-errors';
import type { LocationSample } from './types';

export type { NewPendingAction, PendingAction } from './offline-actions';
export type { RejectedEntry } from './offline-queue-store';

export interface FlushResult {
  synced: number;
  /** Actions still waiting for a connection or a temporary server error. */
  pending: number;
  /** Actions rejected in this flush; they stay on the device as rejected. */
  rejected: number;
  lastError: string | null;
}

let serialOperation: Promise<unknown> = Promise.resolve();

function withLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = serialOperation.then(operation, operation);
  serialOperation = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function createActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function executeAction(action: PendingAction): Promise<void> {
  switch (action.type) {
    case 'start':
      await routesApi.startRoute(action.routeId, action.coordinates);
      return;
    case 'finish':
      await routesApi.finishRoute(action.routeId);
      return;
    case 'location':
      await routesApi.sendLocations(action.routeId, action.locations);
      return;
    case 'arrival':
      await routesApi.arriveAtStop(action.routeId, action.stopId, action.body);
      return;
    case 'completion': {
      const signature = await routesApi.getEvidenceSignature(action.routeId, action.stopId);
      const evidence = [];

      for (const photo of action.photos) {
        evidence.push({
          photoUrl: await uploadEvidencePhoto(signature, photo.uri),
          capturedAt: photo.capturedAt,
        });
      }

      await routesApi.completeStop(action.routeId, action.stopId, {
        evidence,
        notes: action.notes,
        recipientName: action.recipientName,
      });
    }
  }
}

function cleanupActionFiles(action: PendingAction): void {
  if (action.type !== 'completion') return;

  for (const photo of action.photos) {
    deleteEvidencePhoto(photo.uri);
  }
}

type EntryOutcome = 'synced' | 'rejected' | 'blocked';

interface FlushState {
  synced: number;
  rejected: number;
  lastError: string | null;
}

// Sends one entry. Synced and already-applied entries are removed. A permanent
// rejection is kept as rejected with its reason (photos stay on the device) and
// does not block the queue. A network or temporary error blocks the lane.
async function processEntry(entry: QueueEntry, state: FlushState): Promise<EntryOutcome> {
  try {
    await executeAction(entry.action);
  } catch (error) {
    const kind = classifySyncError(error);

    if (kind === 'network' || kind === 'retry') {
      state.lastError = getSyncErrorMessage(error);
      return 'blocked';
    }

    if (kind === 'rejected') {
      const reason = getSyncErrorMessage(error);
      await markRejected(
        entry.id,
        { reason, code: getApiErrorCode(error), status: getSyncErrorStatus(error) },
        Date.now()
      );
      state.rejected += 1;
      state.lastError = reason;
      return 'rejected';
    }
  }

  cleanupActionFiles(entry.action);
  await removeEntry(entry.id);
  state.synced += 1;
  return 'synced';
}

async function runFlush(): Promise<FlushResult> {
  const queue = await readEntries('pending');
  const state: FlushState = { synced: 0, rejected: 0, lastError: null };

  for (let index = 0; index < queue.length; index += 1) {
    const outcome = await processEntry(queue[index], state);
    if (outcome === 'blocked') {
      return { ...state, pending: queue.length - index };
    }
  }

  return { ...state, pending: 0 };
}

export function enqueueAction(action: NewPendingAction): Promise<void> {
  return withLock(() =>
    insertEntry(createActionId(), action, queueKindOf(action), Date.now())
  );
}

export function flushOfflineQueue(): Promise<FlushResult> {
  return withLock(runFlush);
}

export function getPendingActionCount(): Promise<number> {
  return withLock(async () => (await countEntries()).pending);
}

export function getRejectedActionCount(): Promise<number> {
  return withLock(async () => (await countEntries()).rejected);
}

/** Rejected actions with their reason, for the driver and the supervisor notice. */
export function getRejectedActions(): Promise<RejectedEntry[]> {
  return withLock(() => readEntries('rejected'));
}

/** Moves a rejected action back to pending so the next flush sends it again. */
export function retryRejectedAction(id: string): Promise<void> {
  return withLock(() => restoreRejected(id));
}

export interface PendingActionSummary {
  count: number;
  routeIds: string[];
  stopIds: string[];
}

// Read-only view of the pending queue so route refreshes can tell which local
// changes are still waiting to sync (HU-36 CA05). Rejected actions are not
// included: the server state wins for them.
export function getPendingActionSummary(): Promise<PendingActionSummary> {
  return withLock(async () => {
    const queue = await readEntries('pending');
    const routeIds = new Set<string>();
    const stopIds = new Set<string>();

    for (const { action } of queue) {
      routeIds.add(action.routeId);
      if (action.type === 'arrival' || action.type === 'completion') {
        stopIds.add(action.stopId);
      }
    }

    return { count: queue.length, routeIds: [...routeIds], stopIds: [...stopIds] };
  });
}

export function enqueueLocations(routeId: string, locations: LocationSample[]): Promise<void> {
  return enqueueAction({ type: 'location', routeId, locations });
}

export function enqueueLocation(routeId: string, location: LocationSample): Promise<void> {
  return enqueueLocations(routeId, [location]);
}
