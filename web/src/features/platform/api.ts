import { api } from '@/services/http';

export const platformApi = {
  getCompanies: (params?: {
    page?: number;
    pageSize?: number;
    companyStatus?: string;
    subscriptionStatus?: string;
    planId?: string;
    search?: string;
  }) => api.get('/platform/companies', { params }),

  getCompany: (id: string) =>
    api.get(`/platform/companies/${id}`),

  createCompany: (data: {
    legalName: string;
    taxId: string;
    email: string;
    phone?: string;
    address?: string;
    hasOwnFleet: boolean;
  }) => api.post('/platform/companies', data),

  updateCompanyStatus: (id: string, isActive: boolean) =>
    api.patch(`/platform/companies/${id}/status`, { isActive }),

  createCompanyAdmin: (companyId: string, data: {
    fullName: string;
    email: string;
    phone?: string;
  }) => api.post(`/platform/companies/${companyId}/admins`, data),

  updateAdminStatus: (companyId: string, adminId: string, isActive: boolean) =>
    api.patch(`/platform/companies/${companyId}/admins/${adminId}/status`, { isActive }),

  getPlans: (includeInactive = true) =>
    api.get('/platform/plans', { params: { includeInactive: String(includeInactive) } }),
  createPlan: (data: Record<string, unknown>) => api.post('/platform/plans', data),
  updatePlan: (id: string, data: Record<string, unknown>) =>
    api.patch(`/platform/plans/${id}`, data),

  getModules: (includeInactive = true) =>
    api.get('/platform/modules', { params: { includeInactive: String(includeInactive) } }),
  createModule: (data: Record<string, unknown>) => api.post('/platform/modules', data),
  updateModule: (id: string, data: Record<string, unknown>) =>
    api.patch(`/platform/modules/${id}`, data),

  getCreditPackages: (includeInactive = true) =>
    api.get('/platform/credit-packages', {
      params: { includeInactive: String(includeInactive) },
    }),
  createCreditPackage: (data: Record<string, unknown>) =>
    api.post('/platform/credit-packages', data),
  updateCreditPackage: (id: string, data: Record<string, unknown>) =>
    api.patch(`/platform/credit-packages/${id}`, data),
};
