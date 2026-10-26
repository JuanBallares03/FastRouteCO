import * as SecureStore from 'expo-secure-store';
import {
  clearSession,
  loadSession,
  saveSession,
  saveTokens,
} from '../session-storage';
import type { StoredSession } from '../types';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const secureStore = jest.mocked(SecureStore);

const session: StoredSession = {
  tokens: {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  },
  user: {
    id: 'user-1',
    email: 'driver@example.com',
    fullName: 'Carlos Pérez',
    role: 'driver',
    companyId: 'company-1',
    companyName: 'Transportes del Tolima',
    isActive: true,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('session storage', () => {
  it('stores tokens and the user in secure storage', async () => {
    await saveSession(session);

    expect(secureStore.setItemAsync).toHaveBeenCalledWith('fastroute.accessToken', 'access-token');
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('fastroute.refreshToken', 'refresh-token');
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      'fastroute.user',
      JSON.stringify(session.user)
    );
  });

  it('updates only the tokens after a refresh', async () => {
    await saveTokens({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    expect(secureStore.setItemAsync).toHaveBeenCalledWith('fastroute.accessToken', 'new-access');
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('fastroute.refreshToken', 'new-refresh');
    expect(secureStore.setItemAsync).not.toHaveBeenCalledWith(
      'fastroute.user',
      expect.anything()
    );
  });

  it('restores a complete session', async () => {
    secureStore.getItemAsync.mockImplementation(async (key: string) => {
      if (key === 'fastroute.accessToken') return 'access-token';
      if (key === 'fastroute.refreshToken') return 'refresh-token';
      if (key === 'fastroute.user') return JSON.stringify(session.user);
      return null;
    });

    await expect(loadSession()).resolves.toEqual(session);
  });

  it('ignores corrupted user data', async () => {
    secureStore.getItemAsync.mockImplementation(async (key: string) => {
      if (key === 'fastroute.accessToken') return 'access-token';
      if (key === 'fastroute.refreshToken') return 'refresh-token';
      if (key === 'fastroute.user') return 'not-json';
      return null;
    });

    await expect(loadSession()).resolves.toBeNull();
  });

  it('clears all stored values', async () => {
    await clearSession();

    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('fastroute.accessToken');
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('fastroute.refreshToken');
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('fastroute.user');
  });
});
