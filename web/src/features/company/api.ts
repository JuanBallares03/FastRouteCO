import { api } from '@/services/http';

export const companyApi = {
  getProfile: () => api.get('/company'),
  updateProfile: (data: {
    email?: string;
    phone?: string;
    address?: string;
    settings?: Record<string, unknown>;
  }) => api.patch('/company', data),

  getBranches: () => api.get('/company/branches'),
  createBranch: (data: { name: string; address?: string }) =>
    api.post('/company/branches', data),
  updateBranch: (id: string, data: { name?: string; address?: string }) =>
    api.patch(`/company/branches/${id}`, data),

  getSupervisors: () => api.get('/company/supervisors'),
  createSupervisor: (data: { fullName: string; email: string; phone?: string }) =>
    api.post('/company/supervisors', data),
  updateSupervisorStatus: (id: string, isActive: boolean) =>
    api.patch(`/company/supervisors/${id}/status`, { isActive }),

  getDrivers: () => api.get('/company/drivers'),
  createDriver: (data: { fullName: string; email: string; phone?: string }) =>
    api.post('/company/drivers', data),
  updateDriver: (id: string, data: { fullName?: string; email?: string; phone?: string }) =>
    api.patch(`/company/drivers/${id}`, data),
  updateDriverStatus: (id: string, isActive: boolean) =>
    api.patch(`/company/drivers/${id}/status`, { isActive }),
  updateDriverAvailability: (id: string, status: 'available' | 'on_route' | 'unavailable') =>
    api.patch(`/company/drivers/${id}/availability`, { status }),
};
