import type { FlushResult } from '../offline-queue';
import { shouldRefreshAfterSync } from '../sync-refresh';

function flushResult(overrides: Partial<FlushResult> = {}): FlushResult {
  return { synced: 0, pending: 0, failed: 0, lastError: null, ...overrides };
}

describe('shouldRefreshAfterSync', () => {
  it('reloads after synced actions when requested', () => {
    expect(shouldRefreshAfterSync(flushResult({ synced: 2 }), true)).toBe(true);
  });

  it('does not reload after synced actions when not requested', () => {
    expect(shouldRefreshAfterSync(flushResult({ synced: 2 }), false)).toBe(false);
  });

  it('reloads when actions were dropped even if nothing synced', () => {
    const result = flushResult({ failed: 1, lastError: 'Ruta no encontrada' });

    expect(shouldRefreshAfterSync(result, true)).toBe(true);
    expect(shouldRefreshAfterSync(result, false)).toBe(true);
  });

  it('does not reload when nothing synced or dropped', () => {
    expect(shouldRefreshAfterSync(flushResult(), true)).toBe(false);
  });

  it('does not reload while an action is still stuck in the queue', () => {
    const result = flushResult({ pending: 3, lastError: 'Sin conexión' });

    expect(shouldRefreshAfterSync(result, true)).toBe(false);
  });
});
