import { api } from '@/services/http';

export const monitoringApi = {
  getOverview: () => api.get('/platform/monitoring'),
  listAlerts: (params?: { resolved?: string; page?: number; pageSize?: number }) =>
    api.get('/platform/alerts', { params }),
  resolveAlert: (id: string) => api.post(`/platform/alerts/${id}/resolve`),
};
