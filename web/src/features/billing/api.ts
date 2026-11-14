import { api } from '@/services/http';

export const billingApi = {
  getBilling: () => api.get('/company/billing'),
  getOfferings: () => api.get('/company/billing/offerings'),
  getTransactions: (params?: { page?: number; pageSize?: number }) =>
    api.get('/company/billing/transactions', { params }),
  getPayments: (params?: { page?: number; pageSize?: number }) =>
    api.get('/company/billing/payments', { params }),
  getUsageCharges: (params?: { page?: number; pageSize?: number }) =>
    api.get('/company/billing/usage-charges', { params }),
  subscribe: (planId: string, billingCycle: 'monthly' | 'annual') =>
    api.post('/company/billing/subscription', { planId, billingCycle }),
  purchaseCredits: (packageId: string) =>
    api.post('/company/billing/credits/purchase', { packageId }),
  purchaseModule: (moduleId: string) =>
    api.post('/company/billing/modules/purchase', { moduleId }),
  createCardSetup: () => api.post('/company/billing/pay-per-use/setup'),
  updateSpendingLimit: (limit: number | null) =>
    api.patch('/company/billing/spending-limit', { limit }),
};
