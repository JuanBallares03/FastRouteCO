import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthTokens, AuthUser, StoredSession } from './types';

const ACCESS_TOKEN_KEY = 'fastroute.accessToken';
const REFRESH_TOKEN_KEY = 'fastroute.refreshToken';
const USER_KEY = 'fastroute.user';

function canUseWebStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

async function setValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (canUseWebStorage()) {
      localStorage.setItem(key, value);
    }
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return canUseWebStorage() ? localStorage.getItem(key) : null;
  }

  return SecureStore.getItemAsync(key);
}

async function deleteValue(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (canUseWebStorage()) {
      localStorage.removeItem(key);
    }
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    setValue(ACCESS_TOKEN_KEY, tokens.accessToken),
    setValue(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    saveTokens(session.tokens),
    setValue(USER_KEY, JSON.stringify(session.user)),
  ]);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, rawUser] = await Promise.all([
    getValue(ACCESS_TOKEN_KEY),
    getValue(REFRESH_TOKEN_KEY),
    getValue(USER_KEY),
  ]);

  if (!accessToken || !refreshToken || !rawUser) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as AuthUser;
    if (!user?.id || !user?.role) {
      return null;
    }

    return {
      tokens: { accessToken, refreshToken },
      user,
    };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    deleteValue(ACCESS_TOKEN_KEY),
    deleteValue(REFRESH_TOKEN_KEY),
    deleteValue(USER_KEY),
  ]);
}
