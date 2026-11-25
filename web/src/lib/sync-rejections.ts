// Offline driver actions the server rejected after a reassignment or a closed
// route, reported by the phone for the supervisor to review (RF07, HU-10 CA03,
// HU-36 CA04 and CA05).

export type SyncActionType = 'start' | 'arrival' | 'completion' | 'finish';

export interface SyncRejection {
  id: string;
  routeId: string;
  stopId: string | null;
  driverId: string;
  driverName: string;
  actionType: SyncActionType;
  capturedAt: string;
  reason: string;
  errorCode: string | null;
  reportedAt: string;
  reviewedAt: string | null;
  stop: { id: string; sequence: number; routeId: string } | null;
  photos: Array<{ id: string; photoUrl: string; capturedAt: string | null }>;
}

export const SYNC_ACTION_LABELS: Record<SyncActionType, string> = {
  start: 'Inicio de ruta',
  arrival: 'Llegada a la parada',
  completion: 'Entrega o recogida',
  finish: 'Fin de ruta',
};

/** Where the action happened, as the supervisor reads it. */
export function syncRejectionStopLabel(rejection: SyncRejection, routeId: string): string {
  if (rejection.stop) {
    const label = `Parada ${rejection.stop.sequence}`;
    // A stop reassignment moved it to the new driver's route.
    return rejection.stop.routeId === routeId ? label : `${label} (ahora en otra ruta)`;
  }
  return rejection.stopId ? 'Parada eliminada' : 'Sin parada';
}

export function pendingSyncRejectionCount(rejections: readonly SyncRejection[]): number {
  return rejections.filter((rejection) => rejection.reviewedAt === null).length;
}

/** Badge text of the route list; null when nothing is pending. */
export function pendingSyncRejectionsLabel(count: number | undefined): string | null {
  if (!count || count <= 0) return null;
  return count === 1 ? '1 acción sin sincronizar' : `${count} acciones sin sincronizar`;
}

export function formatSyncDateTime(value: string): string {
  return new Date(value).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
