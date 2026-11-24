import { getOfflineDatabase } from './offline-db';
import { CURRENT_OWNER_SQL } from './offline-owner';
import type { NewPendingAction, PendingAction, QueueKind } from './offline-actions';

// Reads and writes the `offline_queue` table for the queue logic in
// offline-queue.ts. Every query is scoped to the current owner, so actions of
// another driver are never read, sent or counted.

export type QueueStatus = 'pending' | 'rejected';

export interface QueueEntry {
  id: string;
  kind: QueueKind;
  createdAt: number;
  action: PendingAction;
}

export interface RejectionDetails {
  reason: string;
  code: string | null;
  status: number | null;
}

export interface RejectedEntry extends QueueEntry, RejectionDetails {
  rejectedAt: number;
  /** Set when the supervisor was notified (reassignment branch). */
  reportedAt: number | null;
}

interface QueueRow {
  id: string;
  payload: string;
  created_at: number;
  kind: string;
  rejected_at: number | null;
  reject_reason: string | null;
  reject_code: string | null;
  reject_status: number | null;
  reported_at: number | null;
}

const SELECT_COLUMNS =
  'id, payload, created_at, kind, rejected_at, reject_reason, reject_code, reject_status, reported_at';

function toEntry(row: QueueRow): QueueEntry | null {
  try {
    const parsed = JSON.parse(row.payload) as Partial<PendingAction> | null;
    if (!parsed || typeof parsed.type !== 'string' || typeof parsed.routeId !== 'string') {
      return null;
    }
    // The row id is the source of truth: payloads stored by enqueueAction
    // never carried an id of their own.
    return {
      id: row.id,
      kind: row.kind === 'location' ? 'location' : 'action',
      createdAt: row.created_at,
      action: { ...parsed, id: row.id } as PendingAction,
    };
  } catch {
    return null;
  }
}

export async function insertEntry(
  id: string,
  action: NewPendingAction,
  kind: QueueKind,
  createdAt: number
): Promise<void> {
  const db = await getOfflineDatabase();
  await db.runAsync(
    `INSERT INTO offline_queue (id, payload, created_at, kind, owner_user_id)
     VALUES (?, ?, ?, ?, ${CURRENT_OWNER_SQL})`,
    id,
    JSON.stringify(action),
    createdAt,
    kind
  );
}

export async function readEntries(status: 'pending', kind?: QueueKind): Promise<QueueEntry[]>;
export async function readEntries(status: 'rejected', kind?: QueueKind): Promise<RejectedEntry[]>;
export async function readEntries(
  status: QueueStatus,
  kind?: QueueKind
): Promise<QueueEntry[] | RejectedEntry[]> {
  const db = await getOfflineDatabase();
  const filters = [`owner_user_id = ${CURRENT_OWNER_SQL}`, 'status = ?'];
  const params: (string | number)[] = [status];
  if (kind) {
    filters.push('kind = ?');
    params.push(kind);
  }

  const rows = await db.getAllAsync<QueueRow>(
    `SELECT ${SELECT_COLUMNS} FROM offline_queue
     WHERE ${filters.join(' AND ')}
     ORDER BY created_at ASC, rowid ASC`,
    ...params
  );

  return rows.flatMap((row) => {
    const entry = toEntry(row);
    if (!entry) return [];
    if (status === 'pending') return [entry];
    return [
      {
        ...entry,
        rejectedAt: row.rejected_at ?? row.created_at,
        reason: row.reject_reason ?? '',
        code: row.reject_code,
        status: row.reject_status,
        reportedAt: row.reported_at,
      } satisfies RejectedEntry,
    ];
  });
}

export async function removeEntry(id: string): Promise<void> {
  const db = await getOfflineDatabase();
  await db.runAsync('DELETE FROM offline_queue WHERE id = ?', id);
}

export async function markRejected(
  id: string,
  details: RejectionDetails,
  rejectedAt: number
): Promise<void> {
  const db = await getOfflineDatabase();
  await db.runAsync(
    `UPDATE offline_queue
     SET status = 'rejected', rejected_at = ?, reject_reason = ?, reject_code = ?, reject_status = ?
     WHERE id = ? AND owner_user_id = ${CURRENT_OWNER_SQL}`,
    rejectedAt,
    details.reason,
    details.code,
    details.status,
    id
  );
}

/** Moves a rejected entry back to pending; it keeps its created_at position. */
export async function restoreRejected(id: string): Promise<void> {
  const db = await getOfflineDatabase();
  await db.runAsync(
    `UPDATE offline_queue
     SET status = 'pending', rejected_at = NULL, reject_reason = NULL,
         reject_code = NULL, reject_status = NULL
     WHERE id = ? AND status = 'rejected' AND owner_user_id = ${CURRENT_OWNER_SQL}`,
    id
  );
}

export async function countEntries(): Promise<{ pending: number; rejected: number }> {
  const db = await getOfflineDatabase();
  const rows = await db.getAllAsync<{ status: string; count: number }>(
    `SELECT status, COUNT(*) AS count FROM offline_queue
     WHERE owner_user_id = ${CURRENT_OWNER_SQL}
     GROUP BY status`
  );
  const counts = { pending: 0, rejected: 0 };
  for (const row of rows) {
    if (row.status === 'pending' || row.status === 'rejected') {
      counts[row.status] = row.count;
    }
  }
  return counts;
}
