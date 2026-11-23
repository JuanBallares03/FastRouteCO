import type { FlushResult } from './offline-queue';

// Decides whether the route must be reloaded after flushing the offline queue.
// Rejected actions never reached the server, so the local optimistic state is
// stale even when nothing synced (HU-36 CA05). Actions still stuck in
// the queue do not change the server state and do not trigger a reload.
export function shouldRefreshAfterSync(
  result: FlushResult,
  refreshOnSynced: boolean
): boolean {
  return (refreshOnSynced && result.synced > 0) || result.rejected > 0;
}
