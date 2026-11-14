import { api } from '@/services/http';

export const supportApi = {
  listCompany: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get('/company/support', { params }),
  create: (data: { subject: string; description: string }) =>
    api.post('/company/support', data),
  listPlatform: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get('/platform/support', { params }),
  respond: (id: string, response: string) =>
    api.post(`/platform/support/${id}/respond`, { response }),
  close: (id: string) => api.post(`/platform/support/${id}/close`),
};
