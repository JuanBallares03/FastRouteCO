import { isAxiosError } from 'axios';
import type {
  Coordinates,
  DriverRoute,
  EvidenceUpload,
  LocationSample,
} from '@/features/route/types';
import { api } from '@/services/http';

interface TodayRouteResponse {
  route: DriverRoute | null;
}

interface LocationsResponse {
  accepted: number;
  inserted: number;
}

export interface CompleteStopPayload {
  evidence: { photoUrl: string; capturedAt?: string }[];
  notes?: string;
  recipientName?: string;
}

/** Report of an offline action the server rejected (RF07, HU-36 CA04). */
export interface SyncRejectionReportPayload {
  clientActionId: string;
  routeId: string;
  stopId?: string;
  actionType: 'start' | 'arrival' | 'completion' | 'finish';
  capturedAt: string;
  reason: string;
  errorCode?: string;
  photos: { photoUrl: string; capturedAt?: string }[];
}

export function isOfflineError(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}

export function getApiErrorCode(error: unknown): string | null {
  if (!isAxiosError(error)) return null;
  const body = error.response?.data as { code?: string } | undefined;
  return body?.code ?? null;
}

export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const body = error.response?.data as { message?: string } | undefined;
    if (body?.message) return body.message;
    if (!error.response) return 'Sin conexión a internet. Guardaremos los datos para sincronizarlos.';
  }
  return 'No pudimos completar la acción. Intenta de nuevo.';
}

export const routesApi = {
  async getTodayRoute(): Promise<DriverRoute | null> {
    const { data } = await api.get<TodayRouteResponse>('/routes/driver/today');
    return data.route;
  },

  async getRoute(routeId: string): Promise<DriverRoute> {
    const { data } = await api.get<DriverRoute>(`/routes/driver/${routeId}`);
    return data;
  },

  /** `capturedAt` is the ISO time of an offline start; online starts use the server time. */
  async startRoute(
    routeId: string,
    coordinates?: Coordinates,
    capturedAt?: string
  ): Promise<DriverRoute> {
    const { data } = await api.post<DriverRoute>(`/routes/driver/${routeId}/start`, {
      ...(coordinates ?? {}),
      ...(capturedAt ? { capturedAt } : {}),
    });
    return data;
  },

  async finishRoute(routeId: string): Promise<DriverRoute> {
    const { data } = await api.post<DriverRoute>(`/routes/driver/${routeId}/finish`);
    return data;
  },

  async sendLocations(
    routeId: string,
    locations: LocationSample[]
  ): Promise<LocationsResponse> {
    const { data } = await api.post<LocationsResponse>(
      `/routes/driver/${routeId}/locations`,
      { locations }
    );
    return data;
  },

  async arriveAtStop(
    routeId: string,
    stopId: string,
    body: { latitude?: number; longitude?: number; method: 'geofence' | 'manual' }
  ): Promise<DriverRoute> {
    const { data } = await api.post<DriverRoute>(
      `/routes/driver/${routeId}/stops/${stopId}/arrive`,
      body
    );
    return data;
  },

  async completeStop(
    routeId: string,
    stopId: string,
    payload: CompleteStopPayload
  ): Promise<DriverRoute> {
    const { data } = await api.post<DriverRoute>(
      `/routes/driver/${routeId}/stops/${stopId}/complete`,
      payload
    );
    return data;
  },

  async getEvidenceSignature(routeId: string, stopId: string): Promise<EvidenceUpload> {
    const { data } = await api.post<EvidenceUpload>(
      `/routes/driver/${routeId}/stops/${stopId}/evidence-signature`
    );
    return data;
  },

  /** Signature for the pending evidence of a rejected delivery (RF16, HU-36). */
  async getSyncRejectionSignature(routeId: string, stopId: string): Promise<EvidenceUpload> {
    const { data } = await api.post<EvidenceUpload>(
      '/routes/driver/sync-rejections/evidence-signature',
      { routeId, stopId }
    );
    return data;
  },

  async reportSyncRejection(payload: SyncRejectionReportPayload): Promise<void> {
    await api.post('/routes/driver/sync-rejections', payload);
  },
};
