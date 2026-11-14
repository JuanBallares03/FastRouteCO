import { api } from '@/services/http';

export const studentApi = {
  getEntitlement: () => api.get('/company/students/entitlement'),
  list: (params?: { active?: string }) => api.get('/company/students', { params }),
  create: (data: { fullName: string; pickupAddress: string }) =>
    api.post('/company/students', data),
  update: (id: string, data: { fullName?: string; pickupAddress?: string }) =>
    api.patch(`/company/students/${id}`, data),
  updateStatus: (id: string, isActive: boolean) =>
    api.patch(`/company/students/${id}/status`, { isActive }),
};
