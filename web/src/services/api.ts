import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

const getAccessToken = (): string | null => {
  return localStorage.getItem('access_token');
};

const getRefreshToken = (): string | null => {
  return localStorage.getItem('refresh_token');
};

const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
};

const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        setTokens(accessToken, newRefreshToken);
        processQueue(null, accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  acceptInvitation: (token: string, password: string) =>
    api.post('/auth/accept-invitation', { token, password }),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }),

  me: () =>
    api.get('/auth/me'),
};

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

  getCompanyAdmins: (companyId: string) =>
    api.get(`/platform/companies/${companyId}/admins`),

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

export interface OrderPayload {
  type: 'delivery' | 'pickup';
  address?: string;
  priority?: 'normal' | 'urgent';
  customerName?: string;
  customerPhone?: string;
  description?: string;
  channel?: 'whatsapp' | 'phone_call' | 'in_person';
  branchId?: string;
}

export const orderApi = {
  getOrders: (params?: {
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => api.get('/orders', { params }),

  getOrder: (id: string) => api.get(`/orders/${id}`),

  createOrder: (data: OrderPayload) => api.post('/orders', data),

  updateOrder: (id: string, data: Partial<OrderPayload>) =>
    api.patch(`/orders/${id}`, data),

  cancelOrder: (id: string) => api.post(`/orders/${id}/cancel`),

  suggestDrivers: (id: string) => api.get(`/orders/${id}/driver-suggestions`),

  assignOrder: (id: string, data: { driverId: string; routeDate?: string }) =>
    api.post(`/orders/${id}/assign`, data),
};

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

  createRoute: (data: { driverId: string; routeDate: string; orderIds: string[] }) =>
    api.post('/routes', data),

  optimizeRoute: (id: string) => api.post(`/routes/${id}/optimize`),

  reassignRoute: (id: string, driverId: string) =>
    api.patch(`/routes/${id}/driver`, { driverId }),

  reassignStop: (id: string, stopId: string, driverId: string) =>
    api.post(`/routes/${id}/stops/${stopId}/reassign`, { driverId }),
};

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

export const billingApi = {
  getBilling: () => api.get('/company/billing'),
  getOfferings: () => api.get('/company/billing/offerings'),
  getUsage: () => api.get('/company/billing/usage'),
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

export { clearTokens, getAccessToken, getRefreshToken };