import * as TaskManager from 'expo-task-manager';
import { loadTokens } from '@/features/auth/session-storage';
import { tokenStore } from '@/features/auth/token-store';
import { getActiveRouteId } from './active-route';
import { LOCATION_TASK_NAME } from './background-location';
import { persistLocationBatch, type CapturedLocation } from './location-batch';
import { enqueueLocations, flushOfflineQueue } from './offline-queue';

interface LocationTaskData {
  locations?: CapturedLocation[];
}

export async function runLocationTask({
  data,
  error,
}: TaskManager.TaskManagerTaskBody<LocationTaskData>): Promise<void> {
  if (error) {
    return;
  }

  const locations = data?.locations ?? [];

  if (locations.length === 0) {
    return;
  }

  await persistLocationBatch(locations, {
    getActiveRouteId,
    saveLocations: enqueueLocations,
    loadTokens,
    applyTokens: (tokens) => tokenStore.set(tokens),
    syncOfflineQueue: flushOfflineQueue,
  });
}

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask<LocationTaskData>(LOCATION_TASK_NAME, runLocationTask);
}
