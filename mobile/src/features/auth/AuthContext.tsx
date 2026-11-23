import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from './api';
import { isAuthenticationError, setSessionExpiredHandler } from '@/services/http';
import { NON_DRIVER_MESSAGE, LoginBlockedError, isDriverRole } from './auth-errors';
import { clearSession, loadSession, saveSession } from './session-storage';
import { stopBackgroundTracking } from '../route/background-location';
import { clearOwnerOfflineData, setOfflineOwner } from '../route/offline-owner';
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

export const SESSION_EXPIRED_MESSAGE =
  'Tu sesión venció. Inicia sesión de nuevo para enviar las acciones pendientes.';

// Makes the driver the owner of offline actions. When another driver owned
// them, the background tracking of that driver's route is stopped so new GPS
// samples are not stored under the wrong driver (RF17).
async function claimOfflineData(userId: string): Promise<void> {
  const { changed } = await setOfflineOwner(userId).catch(() => ({ changed: false }));
  if (changed) {
    await stopBackgroundTracking().catch(() => undefined);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Ends the session on this phone without touching the offline queue or the
  // evidence photos: they wait for their driver to sign in again.
  const resetSession = useCallback(async () => {
    await stopBackgroundTracking().catch(() => undefined);
    tokenStore.clear();
    await clearSession().catch(() => undefined);
    setUser(null);
  }, []);

  const expireSession = useCallback(async () => {
    await resetSession();
    setNotice(SESSION_EXPIRED_MESSAGE);
  }, [resetSession]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      void expireSession();
    });

    return () => setSessionExpiredHandler(null);
  }, [expireSession]);

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

      await claimOfflineData(storedSession.user.id);

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
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isAuthenticationError(error)) {
          await expireSession();
        } else {
          setUser(storedSession.user);
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
  }, [expireSession, resetSession]);

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

      await claimOfflineData(response.user.id);
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

    // Manual sign-out removes this driver's offline data; the profile screen
    // asks for confirmation first when there is any (HU-36).
    await clearOwnerOfflineData().catch(() => undefined);
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
