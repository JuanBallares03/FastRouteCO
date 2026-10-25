import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, clearTokens, getAccessToken } from '@/services/api';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'platform_admin' | 'company_admin' | 'supervisor' | 'driver';
  company_id?: string;
  company_name?: string;
  phone?: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  setPassword: (token: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await authApi.me();
      setUser(response.data);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    const { access_token, refresh_token, user: userData } = response.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setUser(userData);
  };

  const setPassword = async (token: string, password: string) => {
    await authApi.setPassword(token, password);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      console.error('Logout error:');
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, setPassword, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}