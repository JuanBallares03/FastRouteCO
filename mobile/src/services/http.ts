import { create, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { clearSession, saveTokens } from '@/features/auth/session-storage';
import { tokenStore } from '@/features/auth/token-store';
import type { AuthTokens } from '@/features/auth/types';

const FALLBACK_API_URL = 'http://10.0.2.2:3000/api/v1';
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

export function normalizeApiUrl(value: string | undefined): string {
  const base = (value?.trim() || FALLBACK_API_URL).replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

export const API_BASE_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);

export const api = create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = create({
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

async function expireSession(): Promise<void> {
  tokenStore.clear();
  await clearSession().catch(() => undefined);
  sessionExpiredHandler?.();
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await refreshClient.post<AuthTokens>(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      const tokens = response.data;
      if (!tokens?.accessToken || !tokens?.refreshToken) {
        return null;
      }

      tokenStore.set(tokens);
      await saveTokens(tokens);
      return tokens.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const accessToken = tokenStore.getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry ||
      isAuthEndpoint(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const accessToken = await refreshAccessToken();

    if (!accessToken) {
      await expireSession();
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
    return api(originalRequest);
  }
);
