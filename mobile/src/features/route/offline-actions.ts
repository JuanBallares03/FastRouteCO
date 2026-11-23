import type { Coordinates, LocationSample } from './types';

// Actions the driver performs while offline (RF17, RNF07). They are stored in
// the SQLite `offline_queue` table and sent when the connection returns.

interface PendingActionBase {
  id: string;
  routeId: string;
}

export interface StartAction extends PendingActionBase {
  type: 'start';
  coordinates?: Coordinates;
  /** ISO time when the driver tapped start. Older stored actions do not have it. */
  capturedAt?: string;
}

export interface FinishAction extends PendingActionBase {
  type: 'finish';
}

export interface LocationAction extends PendingActionBase {
  type: 'location';
  locations: LocationSample[];
}

export interface ArrivalAction extends PendingActionBase {
  type: 'arrival';
  stopId: string;
  body: { latitude?: number; longitude?: number; method: 'geofence' | 'manual' };
}

export interface CompletionAction extends PendingActionBase {
  type: 'completion';
  stopId: string;
  notes?: string;
  recipientName?: string;
  photos: { uri: string; capturedAt: string }[];
}

export type PendingAction =
  | StartAction
  | FinishAction
  | LocationAction
  | ArrivalAction
  | CompletionAction;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type NewPendingAction = DistributiveOmit<PendingAction, 'id'>;

/** GPS samples travel in their own lane so other actions never block them. */
export type QueueKind = 'action' | 'location';

export function queueKindOf(action: { type: PendingAction['type'] }): QueueKind {
  return action.type === 'location' ? 'location' : 'action';
}
