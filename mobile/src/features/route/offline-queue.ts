import { isAxiosError } from 'axios';
import {
  getApiErrorMessage,
  isOfflineError,
  routesApi,
} from './api';
import { uploadEvidencePhoto } from './cloudinary';
import { deleteEvidencePhoto } from './evidence-files';
import { getOfflineDatabase } from './offline-db';
import type { Coordinates, LocationSample } from './types';

interface PendingActionBase {
  id: string;
  routeId: string;
}

interface StartAction extends PendingActionBase {
  type: 'start';
  coordinates?: Coordinates;
}

interface FinishAction extends PendingActionBase {
  type: 'finish';
}

interface LocationAction extends PendingActionBase {
  type: 'location';
  locations: LocationSample[];
}

interface ArrivalAction extends PendingActionBase {
  type: 'arrival';
  stopId: string;
  body: { latitude?: number; longitude?: number; method: 'geofence' | 'manual' };
}

interface CompletionAction extends PendingActionBase {
  type: 'completion';
  stopId: string;
  notes?: string;
  recipientName?: string;
  photos: { uri: string; capturedAt: string }[];
}

type PendingAction =
  | StartAction
  | FinishAction
  | LocationAction
  | ArrivalAction
  | CompletionAction;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type NewPendingAction = DistributiveOmit<PendingAction, 'id'>;

export interface FlushResult {
  synced: number;
  pending: number;
  failed: number;
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

function parseAction(payload: string): PendingAction | null {
  try {
    const parsed = JSON.parse(payload) as PendingAction;
    return parsed && typeof parsed.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

async function readQueue(): Promise<PendingAction[]> {
  const db = await getOfflineDatabase();
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM offline_queue ORDER BY created_at ASC, rowid ASC'
  );

  return rows.flatMap((row) => {
    const action = parseAction(row.payload);
    return action ? [action] : [];
  });
}

async function removeAction(actionId: string): Promise<void> {
  const db = await getOfflineDatabase();
  await db.runAsync('DELETE FROM offline_queue WHERE id = ?', actionId);
}

function createActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function shouldDrop(error: unknown): boolean {
  if (isOfflineError(error) || !isAxiosError(error)) return false;

  const status = error.response?.status;
  if (!status) return false;

  return status >= 400 && status < 500 && status !== 401 && status !== 403;
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

      for (const photo of action.photos) {
        deleteEvidencePhoto(photo.uri);
      }
    }
  }
}

function cleanupActionFiles(action: PendingAction): void {
  if (action.type !== 'completion') return;

  for (const photo of action.photos) {
    deleteEvidencePhoto(photo.uri);
  }
}

async function runFlush(): Promise<FlushResult> {
  const queue = await readQueue();
  let synced = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (let index = 0; index < queue.length; index += 1) {
    const action = queue[index];

    try {
      await executeAction(action);
      synced += 1;
      await removeAction(action.id);
    } catch (error) {
      if (shouldDrop(error)) {
        failed += 1;
        lastError = getApiErrorMessage(error);
        cleanupActionFiles(action);
        await removeAction(action.id);
        continue;
      }

      return {
        synced,
        pending: queue.length - index,
        failed,
        lastError: lastError ?? getApiErrorMessage(error),
      };
    }
  }

  return { synced, pending: 0, failed, lastError };
}

export function enqueueAction(action: NewPendingAction): Promise<void> {
  return withLock(async () => {
    const db = await getOfflineDatabase();
    await db.runAsync(
      'INSERT INTO offline_queue (id, payload, created_at) VALUES (?, ?, ?)',
      createActionId(),
      JSON.stringify(action),
      Date.now()
    );
  });
}

export function flushOfflineQueue(): Promise<FlushResult> {
  return withLock(runFlush);
}

export function getPendingActionCount(): Promise<number> {
  return withLock(async () => {
    const db = await getOfflineDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM offline_queue'
    );
    return row?.count ?? 0;
  });
}

export function enqueueLocations(routeId: string, locations: LocationSample[]): Promise<void> {
  return enqueueAction({ type: 'location', routeId, locations });
}

export function enqueueLocation(routeId: string, location: LocationSample): Promise<void> {
  return enqueueLocations(routeId, [location]);
}
