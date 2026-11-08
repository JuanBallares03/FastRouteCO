import { api } from './http';

export type IncidentCategory = 'incident' | 'question';
export type IncidentStatus = 'open' | 'in_progress' | 'resolved';

export interface IncidentSender {
  id: string;
  fullName: string;
  role: string;
}

export interface IncidentMessage {
  id: string;
  incidentId: string;
  senderId: string;
  message: string;
  sentAt: string;
  sender?: IncidentSender | null;
}

export interface DriverIncident {
  id: string;
  routeId: string;
  stopId: string | null;
  category: IncidentCategory;
  description: string;
  status: IncidentStatus;
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
  messages: IncidentMessage[];
}

export interface CreateIncidentPayload {
  routeId: string;
  stopId?: string;
  category: IncidentCategory;
  description: string;
}

export const incidentsApi = {
  async list(): Promise<DriverIncident[]> {
    const { data } = await api.get<DriverIncident[]>('/incidents/driver');
    return data;
  },

  async create(payload: CreateIncidentPayload): Promise<DriverIncident> {
    const { data } = await api.post<DriverIncident>('/incidents', payload);
    return data;
  },

  async addMessage(
    incidentId: string,
    message: string
  ): Promise<{ message: IncidentMessage; incident: DriverIncident }> {
    const { data } = await api.post<{
      message: IncidentMessage;
      incident: DriverIncident;
    }>(`/incidents/${incidentId}/messages`, { message });
    return data;
  },
};
