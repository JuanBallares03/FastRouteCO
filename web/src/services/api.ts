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
};

export const companyApi = {
  getProfile: () => api.get('/company'),
  updateProfile: (data: {
    email?: string;
    phone?: string;
    address?: string;
    settings?: Record<string, unknown>;
  }) => api.patch('/company', data),
};

export { clearTokens, getAccessToken, getRefreshToken };