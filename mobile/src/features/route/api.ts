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

export function isOfflineError(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}

export function isQueueableError(error: unknown): boolean {
  return isOfflineError(error) || !isAxiosError(error);
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

  async startRoute(routeId: string, coordinates?: Coordinates): Promise<DriverRoute> {
    const { data } = await api.post<DriverRoute>(
      `/routes/driver/${routeId}/start`,
      coordinates ?? {}
    );
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
};
