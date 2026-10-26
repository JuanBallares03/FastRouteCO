export const DRIVER_ROLE = 'driver' as const;

export type UserRole = 'driver' | 'company_admin' | 'supervisor' | 'platform_admin';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
  companyName: string | null;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface StoredSession {
  tokens: AuthTokens;
  user: AuthUser;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}
