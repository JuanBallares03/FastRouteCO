import { api } from '@/services/http';

export const routeApi = {
  getRoutes: (params?: {
    date?: string;
    driverId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) => api.get('/routes', { params }),

  getRoute: (id: string) => api.get(`/routes/${id}`),

  getLatestLocation: (id: string) => api.get(`/routes/${id}/locations/latest`),

  createRoute: (data: {
    driverId: string;
    routeDate: string;
    orderIds: string[];
    studentIds?: string[];
  }) => api.post('/routes', data),

  optimizeRoute: (id: string) => api.post(`/routes/${id}/optimize`),

  reassignRoute: (id: string, driverId: string) =>
    api.patch(`/routes/${id}/driver`, { driverId }),

  reassignStop: (id: string, stopId: string, driverId: string) =>
    api.post(`/routes/${id}/stops/${stopId}/reassign`, { driverId }),
};
