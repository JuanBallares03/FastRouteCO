import { isAxiosError } from 'axios';
import { File, Paths } from 'expo-file-system';
import {
  getApiErrorMessage,
  isOfflineError,
  routesApi,
} from '@/services/routes-api';
import { uploadEvidencePhoto } from './cloudinary';
import { deleteEvidencePhoto } from './evidence-files';
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

const queueFile = new File(Paths.document, 'fastrouteco-offline-queue.json');
let serialOperation: Promise<unknown> = Promise.resolve();

function withLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = serialOperation.then(operation, operation);
  serialOperation = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function readQueue(): Promise<PendingAction[]> {
  if (!queueFile.exists) return [];

  try {
    const content = await queueFile.text();
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as PendingAction[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingAction[]): Promise<void> {
  if (!queueFile.exists) {
    queueFile.create({ intermediates: true });
  }

  await queueFile.write(JSON.stringify(queue));
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
      await writeQueue(queue.slice(index + 1));
    } catch (error) {
      if (shouldDrop(error)) {
        failed += 1;
        lastError = getApiErrorMessage(error);
        cleanupActionFiles(action);
        await writeQueue(queue.slice(index + 1));
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

  await writeQueue([]);
  return { synced, pending: 0, failed, lastError };
}

export function enqueueAction(action: NewPendingAction): Promise<void> {
  return withLock(async () => {
    const queue = await readQueue();
    queue.push({ ...action, id: createActionId() } as PendingAction);
    await writeQueue(queue);
  });
}

export function flushOfflineQueue(): Promise<FlushResult> {
  return withLock(runFlush);
}

export function getPendingActionCount(): Promise<number> {
  return withLock(async () => (await readQueue()).length);
}

export function enqueueLocation(routeId: string, location: LocationSample): Promise<void> {
  return enqueueAction({ type: 'location', routeId, locations: [location] });
}
