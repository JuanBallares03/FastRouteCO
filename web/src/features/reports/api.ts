import { api } from '@/services/http';

export const reportApi = {
  getDashboard: () => api.get('/company/reports/dashboard'),
  getSummary: (params?: { from?: string; to?: string; branchId?: string }) =>
    api.get('/company/reports/summary', { params }),
  getRoutes: (params?: { from?: string; to?: string; branchId?: string }) =>
    api.get('/company/reports/routes', { params }),
};
