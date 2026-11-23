import type { PendingAction } from './offline-actions';
import type { RejectedEntry } from './offline-queue-store';

// Labels for offline actions the server or Cloudinary rejected, shown to the
// driver in "Mi ruta" (RF17, HU-36). GPS batches of the same route are grouped
// into one row because the driver does not need each sample.

interface StopReference {
  id: string;
  sequence: number;
}

export interface RejectedActionItem {
  key: string;
  /** Queue entries the row stands for; "Reintentar" restores all of them. */
  ids: string[];
  title: string;
  reason: string;
  rejectedAt: number;
}

function stopLabel(stopId: string, stops: readonly StopReference[]): string {
  const stop = stops.find((item) => item.id === stopId);
  return stop ? `la parada ${stop.sequence}` : 'una parada';
}

export function describeRejectedAction(
  action: PendingAction,
  stops: readonly StopReference[]
): string {
  switch (action.type) {
    case 'start':
      return 'Inicio de ruta';
    case 'finish':
      return 'Fin de ruta';
    case 'arrival':
      return `Llegada a ${stopLabel(action.stopId, stops)}`;
    case 'completion': {
      const count = action.photos.length;
      return `Entrega en ${stopLabel(action.stopId, stops)} (${count} ${count === 1 ? 'foto' : 'fotos'})`;
    }
    case 'location': {
      const count = action.locations.length;
      return `Recorrido GPS (${count} ${count === 1 ? 'punto' : 'puntos'})`;
    }
  }
}

export function groupRejectedActions(
  entries: readonly RejectedEntry[],
  stops: readonly StopReference[]
): RejectedActionItem[] {
  const items: RejectedActionItem[] = [];
  const gpsGroups = new Map<string, { item: RejectedActionItem; points: number }>();

  for (const entry of entries) {
    const { action } = entry;

    if (action.type !== 'location') {
      items.push({
        key: entry.id,
        ids: [entry.id],
        title: describeRejectedAction(action, stops),
        reason: entry.reason,
        rejectedAt: entry.rejectedAt,
      });
      continue;
    }

    const group = gpsGroups.get(action.routeId);
    if (!group) {
      const item: RejectedActionItem = {
        key: `gps-${action.routeId}`,
        ids: [entry.id],
        title: describeRejectedAction(action, stops),
        reason: entry.reason,
        rejectedAt: entry.rejectedAt,
      };
      gpsGroups.set(action.routeId, { item, points: action.locations.length });
      items.push(item);
      continue;
    }

    group.points += action.locations.length;
    group.item.ids.push(entry.id);
    group.item.title = `Recorrido GPS (${group.points} ${group.points === 1 ? 'punto' : 'puntos'})`;
    if (entry.rejectedAt >= group.item.rejectedAt) {
      group.item.rejectedAt = entry.rejectedAt;
      group.item.reason = entry.reason;
    }
  }

  return items;
}

/** Message shown right after a sync that rejected actions. */
export function rejectedSyncMessage(
  rejected: number,
  lastRejected: PendingAction | null,
  lastError: string | null,
  stops: readonly StopReference[]
): string {
  if (rejected === 1 && lastRejected) {
    const title = describeRejectedAction(lastRejected, stops);
    const action = title.charAt(0).toLowerCase() + title.slice(1);
    return lastError ? `No se pudo enviar ${action}: ${lastError}` : `No se pudo enviar ${action}.`;
  }
  return `${rejected} acciones no se pudieron enviar.`;
}
