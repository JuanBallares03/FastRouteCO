import { tokenStore } from '@/features/auth/token-store';
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
  /** The last action rejected in this flush, to name it in the sync message. */
  lastRejected: PendingAction | null;
  lastError: string | null;
  /**
   * Routes whose GPS points the server refused because the route is closed
   * for this driver (finished, cancelled, reassigned or deleted), so the
   * background task can stop tracking them (RF09).
   */
  closedRouteIds: string[];
}

/** Server codes meaning the route no longer takes GPS points from this driver. */
const CLOSED_ROUTE_CODES = new Set(['ROUTE_NOT_IN_PROGRESS', 'ROUTE_NOT_FOUND']);

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

async function executeAction(entry: QueueEntry): Promise<void> {
  const { action } = entry;
  switch (action.type) {
    case 'start':
      // Starts stored before capturedAt existed use the time they were queued.
      await routesApi.startRoute(
        action.routeId,
        action.coordinates,
        action.capturedAt ?? new Date(entry.createdAt).toISOString()
      );
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
  lastRejected: PendingAction | null;
  lastError: string | null;
  closedRouteIds: Set<string>;
}

// Sends one entry. Synced and already-applied entries are removed. A permanent
// rejection is kept as rejected with its reason (photos stay on the device) and
// does not block the queue. A network or temporary error blocks the lane.
async function processEntry(entry: QueueEntry, state: FlushState): Promise<EntryOutcome> {
  try {
    await executeAction(entry);
  } catch (error) {
    const kind = classifySyncError(error);

    if (kind === 'network' || kind === 'retry') {
      state.lastError = getSyncErrorMessage(error);
      return 'blocked';
    }

    if (kind === 'rejected') {
      const reason = getSyncErrorMessage(error);
      const code = getApiErrorCode(error);
      if (entry.action.type === 'location' && code && CLOSED_ROUTE_CODES.has(code)) {
        state.closedRouteIds.add(entry.action.routeId);
      }
      await markRejected(
        entry.id,
        { reason, code, status: getSyncErrorStatus(error) },
        Date.now()
      );
      state.rejected += 1;
      state.lastRejected = entry.action;
      state.lastError = reason;
      return 'rejected';
    }
  }

  cleanupActionFiles(entry.action);
  await removeEntry(entry.id);
  state.synced += 1;
  return 'synced';
}

// Two lanes (RF13, RF17):
// - Actions (start, arrival, completion, finish) keep strict FIFO order and stop
//   at the first network or temporary error, so a stop is never finished before
//   its delivery is sent.
// - GPS samples run in their own lane, so a photo upload or a rejected action
//   never blocks the trail. Samples of a route whose start is still pending wait
//   for it, and a finish first sends the samples of its route captured before it.
async function runFlush(): Promise<FlushResult> {
  // Without a session (expired, or another driver signed out) nothing is sent:
  // the actions wait for their owner to sign in again.
  if (!tokenStore.getAccessToken()) {
    const { pending } = await countEntries();
    return {
      synced: 0,
      pending,
      rejected: 0,
      lastRejected: null,
      lastError: null,
      closedRouteIds: [],
    };
  }

  const actions = await readEntries('pending', 'action');
  const locations = await readEntries('pending', 'location');
  const state: FlushState = {
    synced: 0,
    rejected: 0,
    lastRejected: null,
    lastError: null,
    closedRouteIds: new Set(),
  };
  const doneLocations = new Set<string>();
  let locationsBlocked = false;

  async function flushLocations(include: (entry: QueueEntry) => boolean): Promise<void> {
    for (const entry of locations) {
      if (locationsBlocked) return;
      if (doneLocations.has(entry.id) || !include(entry)) continue;
      if ((await processEntry(entry, state)) === 'blocked') {
        locationsBlocked = true;
        return;
      }
      doneLocations.add(entry.id);
    }
  }

  let blockedAt = actions.length;
  for (let index = 0; index < actions.length; index += 1) {
    const entry = actions[index];

    if (entry.action.type === 'finish') {
      const { routeId } = entry.action;
      await flushLocations(
        (location) => location.action.routeId === routeId && location.createdAt <= entry.createdAt
      );
      if (locationsBlocked) {
        blockedAt = index;
        break;
      }
    }

    if ((await processEntry(entry, state)) === 'blocked') {
      blockedAt = index;
      break;
    }
  }

  const waitingActions = actions.slice(blockedAt);
  const routesWaitingStart = new Set(
    waitingActions.filter(({ action }) => action.type === 'start').map(({ action }) => action.routeId)
  );
  await flushLocations((location) => !routesWaitingStart.has(location.action.routeId));

  const waitingLocations = locations.filter((entry) => !doneLocations.has(entry.id)).length;
  return {
    synced: state.synced,
    rejected: state.rejected,
    lastRejected: state.lastRejected,
    lastError: state.lastError,
    closedRouteIds: [...state.closedRouteIds],
    pending: waitingActions.length + waitingLocations,
  };
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
// included: the server state wins for them. GPS points are not local changes
// either; counting them kept a route the server had closed on screen, and its
// tracking kept adding points.
export function getPendingActionSummary(): Promise<PendingActionSummary> {
  return withLock(async () => {
    const queue = await readEntries('pending', 'action');
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
