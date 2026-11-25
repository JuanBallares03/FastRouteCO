// Last time the driver's phone reached the server, used to warn before
// reassigning a route in progress (RF07, HU-10 CA03, HU-36 CA04). An old sync
// means the driver may have deliveries or photos not sent yet.

/** Decided with the product owner on 2026-11-24: 5 minutes (about 60 missed GPS samples). */
export const SYNC_STALE_THRESHOLD_MS = 5 * 60 * 1000;

/** No sync at all also counts as old: nothing proves the phone is up to date. */
export function isSyncStale(
  lastSyncedAt: string | null | undefined,
  now: number,
  thresholdMs = SYNC_STALE_THRESHOLD_MS
): boolean {
  if (!lastSyncedAt) return true;
  const time = Date.parse(lastSyncedAt);
  if (Number.isNaN(time)) return true;
  return now - time > thresholdMs;
}

/** "hace 3 min", "hace 1 h 5 min"; a phone clock ahead of the panel reads "hace un momento". */
export function formatSyncAge(lastSyncedAt: string | null | undefined, now: number): string {
  if (!lastSyncedAt) return 'Sin sincronizaciones';
  const time = Date.parse(lastSyncedAt);
  if (Number.isNaN(time)) return 'Sin sincronizaciones';

  const minutes = Math.floor(Math.max(0, now - time) / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `hace ${hours} h` : `hace ${hours} h ${rest} min`;
}

export function reassignWarningMessage(lastSyncedAt: string | null | undefined, now: number): string {
  const age = formatSyncAge(lastSyncedAt, now);
  const since = lastSyncedAt && age !== 'Sin sincronizaciones'
    ? `El conductor no sincroniza desde ${age}.`
    : 'El conductor todavía no ha sincronizado esta ruta.';
  return `${since} Puede tener entregas o fotos sin enviar; si reasignas, quedarán como acciones no sincronizadas para revisar.`;
}
