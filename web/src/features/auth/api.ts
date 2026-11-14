import { api } from '@/services/http';

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  acceptInvitation: (token: string, password: string) =>
    api.post('/auth/accept-invitation', { token, password }),

  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }),

  me: () =>
    api.get('/auth/me'),
};
