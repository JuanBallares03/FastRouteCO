import { describe, expect, it } from 'vitest';
import {
  SYNC_STALE_THRESHOLD_MS,
  formatSyncAge,
  isSyncStale,
  reassignWarningMessage,
} from './sync-status';

const now = Date.parse('2026-11-24T16:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

describe('isSyncStale', () => {
  it('uses a 5 minute threshold', () => {
    expect(SYNC_STALE_THRESHOLD_MS).toBe(300_000);
    expect(isSyncStale(minutesAgo(4), now)).toBe(false);
    expect(isSyncStale(minutesAgo(5), now)).toBe(false);
    expect(isSyncStale(minutesAgo(6), now)).toBe(true);
  });

  it('treats a route that never synced as stale', () => {
    expect(isSyncStale(null, now)).toBe(true);
    expect(isSyncStale(undefined, now)).toBe(true);
    expect(isSyncStale('not a date', now)).toBe(true);
  });
});

describe('formatSyncAge', () => {
  it('reads the elapsed time in Spanish', () => {
    expect(formatSyncAge(minutesAgo(0), now)).toBe('hace un momento');
    expect(formatSyncAge(minutesAgo(3), now)).toBe('hace 3 min');
    expect(formatSyncAge(minutesAgo(60), now)).toBe('hace 1 h');
    expect(formatSyncAge(minutesAgo(65), now)).toBe('hace 1 h 5 min');
    expect(formatSyncAge(null, now)).toBe('Sin sincronizaciones');
  });

  it('does not show a negative time when the phone clock is ahead', () => {
    expect(formatSyncAge(new Date(now + 120_000).toISOString(), now)).toBe('hace un momento');
  });
});

describe('reassignWarningMessage', () => {
  it('names the time since the last sync', () => {
    expect(reassignWarningMessage(minutesAgo(12), now)).toBe(
      'El conductor no sincroniza desde hace 12 min. Puede tener entregas o fotos sin enviar; si reasignas, quedarán como acciones no sincronizadas para revisar.'
    );
  });

  it('explains when the route never synced', () => {
    expect(reassignWarningMessage(null, now)).toMatch(/^El conductor todavía no ha sincronizado/);
  });
});
