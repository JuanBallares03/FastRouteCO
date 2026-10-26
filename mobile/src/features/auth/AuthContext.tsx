import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/services/auth-api';
import { setSessionExpiredHandler } from '@/services/http';
import { NON_DRIVER_MESSAGE, LoginBlockedError, isDriverRole } from './auth-errors';
import { clearSession, loadSession, saveSession } from './session-storage';
import { tokenStore } from './token-store';
import type { AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  notice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const resetSession = useCallback(async () => {
    tokenStore.clear();
    await clearSession().catch(() => undefined);
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      void resetSession();
    });

    return () => setSessionExpiredHandler(null);
  }, [resetSession]);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      const storedSession = await loadSession().catch(() => null);

      if (!isActive) {
        return;
      }

      if (!storedSession) {
        setIsLoading(false);
        return;
      }

      tokenStore.set(storedSession.tokens);

      if (!isDriverRole(storedSession.user.role)) {
        setNotice(NON_DRIVER_MESSAGE);
        await resetSession();
        if (isActive) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const profile = await authApi.me();

        if (!isActive) {
          return;
        }

        if (!isDriverRole(profile.role)) {
          setNotice(NON_DRIVER_MESSAGE);
          await resetSession();
          return;
        }

        setUser(profile);

        const accessToken = tokenStore.getAccessToken();
        const refreshToken = tokenStore.getRefreshToken();
        if (accessToken && refreshToken) {
          await saveSession({
            tokens: { accessToken, refreshToken },
            user: profile,
          });
        }
      } catch {
        if (isActive) {
          await resetSession();
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [resetSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setNotice(null);

      const response = await authApi.login(email.trim().toLowerCase(), password);

      if (!isDriverRole(response.user.role)) {
        await authApi.logout(response.refreshToken).catch(() => undefined);
        await resetSession();
        setNotice(NON_DRIVER_MESSAGE);
        throw new LoginBlockedError(NON_DRIVER_MESSAGE);
      }

      const tokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };

      tokenStore.set(tokens);
      await saveSession({ tokens, user: response.user });
      setUser(response.user);
    },
    [resetSession]
  );

  const signOut = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();

    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }

    setNotice(null);
    await resetSession();
  }, [resetSession]);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo(
    () => ({ user, isLoading, notice, signIn, signOut, clearNotice }),
    [user, isLoading, notice, signIn, signOut, clearNotice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }

  return context;
}
