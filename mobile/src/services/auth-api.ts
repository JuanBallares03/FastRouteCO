import type {
  AuthTokens,
  AuthUser,
  LoginResponse,
  UserRole,
} from '@/features/auth/types';
import { api } from './http';

interface WireUser {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
  companyId: string | null;
  companyName?: string | null;
  isActive?: boolean;
}

interface WireLoginResponse extends AuthTokens {
  user: WireUser;
}

function toAuthUser(user: WireUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName?.trim() || user.email,
    role: user.role,
    companyId: user.companyId ?? null,
    companyName: user.companyName?.trim() || null,
    isActive: user.isActive ?? true,
  };
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<WireLoginResponse>('/auth/login', { email, password });

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: toAuthUser(data.user),
    };
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<WireUser>('/auth/me');
    return toAuthUser(data);
  },

  async logout(refreshToken?: string): Promise<void> {
    await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
  },
};
