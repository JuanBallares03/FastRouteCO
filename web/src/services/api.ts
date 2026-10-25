import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

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
        const response = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });
        const { access_token, refresh_token } = response.data;
        setTokens(access_token, refresh_token);
        processQueue(null, access_token);
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
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
  
  setPassword: (token: string, password: string) => 
    api.post('/auth/set-password', { token, password }),
  
  refresh: (refreshToken: string) => 
    api.post('/auth/refresh', { refresh_token: refreshToken }),
  
  logout: () => 
    api.post('/auth/logout'),
  
  me: () => 
    api.get('/auth/me'),
};

export const platformApi = {
  getCompanies: (params?: { page?: number; limit?: number; status?: string; subscription_status?: string; plan?: string; search?: string }) =>
    api.get('/platform/companies', { params }),
  
  getCompany: (id: string) =>
    api.get(`/platform/companies/${id}`),
  
  createCompany: (data: {
    legal_name: string;
    nit: string;
    email: string;
    phone: string;
    address: string;
    has_own_drivers: boolean;
  }) => api.post('/platform/companies', data),
  
  updateCompanyStatus: (id: string, status: 'active' | 'inactive') =>
    api.patch(`/platform/companies/${id}/status`, { status }),
  
  getCompanyAdmins: (companyId: string) =>
    api.get(`/platform/companies/${companyId}/admins`),
  
  createCompanyAdmin: (companyId: string, data: {
    full_name: string;
    email: string;
    phone: string;
  }) => api.post(`/platform/companies/${companyId}/admins`, data),
  
  updateAdminStatus: (companyId: string, adminId: string, status: 'active' | 'inactive') =>
    api.patch(`/platform/companies/${companyId}/admins/${adminId}/status`, { status }),
};

export const companyApi = {
  getProfile: () => api.get('/company/profile'),
  updateProfile: (data: Record<string, unknown>) => api.patch('/company/profile', data),
  getSubscription: () => api.get('/company/subscription'),
  getCredits: () => api.get('/company/credits'),
  getBranches: () => api.get('/company/branches'),
  createBranch: (data: Record<string, unknown>) => api.post('/company/branches', data),
  getSupervisors: () => api.get('/company/supervisors'),
  createSupervisor: (data: Record<string, unknown>) => api.post('/company/supervisors', data),
  getDrivers: () => api.get('/company/drivers'),
  createDriver: (data: Record<string, unknown>) => api.post('/company/drivers', data),
};

export const supervisorApi = {
  getDashboard: () => api.get('/supervisor/dashboard'),
  getDrivers: () => api.get('/supervisor/drivers'),
  getOrders: () => api.get('/supervisor/orders'),
  getRoutes: () => api.get('/supervisor/routes'),
};

export { clearTokens, getAccessToken, getRefreshToken };