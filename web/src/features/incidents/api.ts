import { api } from '@/services/http';

export interface IncidentMessagePayload {
  id: string;
  incidentId: string;
  senderId: string;
  message: string;
  sentAt: string;
  sender?: { id: string; fullName: string; role: string } | null;
}

export interface IncidentPayload {
  id: string;
  routeId: string;
  stopId: string | null;
  category: 'incident' | 'question';
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  resolutionNotes: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  route: {
    id: string;
    routeDate: string;
    status: string;
    driver?: { user?: { id: string; fullName: string; phone?: string | null } | null } | null;
  };
  stop?: { id: string; sequence: number; status: string } | null;
  messages: IncidentMessagePayload[];
}

export const incidentApi = {
  list: (params?: { routeId?: string; status?: string; category?: string }) =>
    api.get<IncidentPayload[]>('/incidents', { params }),

  get: (id: string) => api.get<IncidentPayload>(`/incidents/${id}`),

  addMessage: (id: string, message: string) =>
    api.post<{ message: IncidentMessagePayload; incident: IncidentPayload }>(
      `/incidents/${id}/messages`,
      { message }
    ),

  update: (id: string, data: { status?: string; resolutionNotes?: string }) =>
    api.patch<IncidentPayload>(`/incidents/${id}`, data),
};
