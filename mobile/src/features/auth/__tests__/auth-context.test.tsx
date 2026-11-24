import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { AuthProvider, SESSION_EXPIRED_MESSAGE, useAuth } from '../AuthContext';
import { authApi } from '../api';
import { clearSession, loadSession } from '../session-storage';
import { tokenStore } from '../token-store';
import { setSessionExpiredHandler } from '@/services/http';
import { stopBackgroundTracking } from '../../route/background-location';
import { clearOwnerOfflineData, setOfflineOwner } from '../../route/offline-owner';
import type { AuthUser } from '../types';

jest.mock('@/services/http', () => ({
  ...jest.requireActual('@/services/http'),
  setSessionExpiredHandler: jest.fn(),
}));

jest.mock('../api', () => ({
  authApi: { login: jest.fn(), me: jest.fn(), logout: jest.fn() },
}));

jest.mock('../session-storage', () => ({
  loadSession: jest.fn(),
  saveSession: jest.fn(),
  clearSession: jest.fn(),
}));

jest.mock('../../route/background-location', () => ({
  stopBackgroundTracking: jest.fn(),
}));

jest.mock('../../route/offline-owner', () => ({
  setOfflineOwner: jest.fn(),
  clearOwnerOfflineData: jest.fn(),
}));

const driver: AuthUser = {
  id: 'driver-a',
  email: 'a@fastrouteco.test',
  fullName: 'Conductor A',
  role: 'driver',
  companyId: 'c1',
  companyName: 'Empresa',
  isActive: true,
};

const tokens = { accessToken: 'access', refreshToken: 'refresh' };

function unauthorized(): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status: 401, data: {}, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, {}, response);
}

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  tokenStore.clear();
  jest.mocked(loadSession).mockResolvedValue(null);
  jest.mocked(clearSession).mockResolvedValue(undefined);
  jest.mocked(stopBackgroundTracking).mockResolvedValue(undefined);
  jest.mocked(setOfflineOwner).mockResolvedValue({ changed: false });
  jest.mocked(clearOwnerOfflineData).mockResolvedValue(undefined);
  jest.mocked(authApi.logout).mockResolvedValue(undefined);
  jest.mocked(authApi.login).mockResolvedValue({ ...tokens, user: driver });
});

async function renderSignedIn() {
  const view = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  await act(async () => {
    await view.result.current.signIn('a@fastrouteco.test', 'secret-password');
  });
  return view;
}

describe('AuthProvider offline data', () => {
  it('keeps the offline queue when the session expires', async () => {
    const view = await renderSignedIn();
    const expire = jest.mocked(setSessionExpiredHandler).mock.calls.at(-1)?.[0];

    await act(async () => {
      expire?.();
    });

    await waitFor(() => expect(view.result.current.user).toBeNull());
    expect(view.result.current.notice).toBe(SESSION_EXPIRED_MESSAGE);
    expect(stopBackgroundTracking).toHaveBeenCalled();
    expect(clearOwnerOfflineData).not.toHaveBeenCalled();
  });

  it('keeps the offline queue when the stored session is no longer valid', async () => {
    jest.mocked(loadSession).mockResolvedValue({ tokens, user: driver });
    jest.mocked(authApi.me).mockRejectedValue(unauthorized());

    const view = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    expect(view.result.current.user).toBeNull();
    expect(view.result.current.notice).toBe(SESSION_EXPIRED_MESSAGE);
    expect(setOfflineOwner).toHaveBeenCalledWith('driver-a');
    expect(clearOwnerOfflineData).not.toHaveBeenCalled();
  });

  it('claims the offline data for the driver who signs in', async () => {
    await renderSignedIn();

    expect(setOfflineOwner).toHaveBeenCalledWith('driver-a');
    expect(stopBackgroundTracking).not.toHaveBeenCalled();
  });

  it('stops the previous driver tracking when another driver signs in', async () => {
    jest.mocked(setOfflineOwner).mockResolvedValue({ changed: true });

    await renderSignedIn();

    expect(stopBackgroundTracking).toHaveBeenCalled();
  });

  it('removes only the driver data on a manual sign-out', async () => {
    const view = await renderSignedIn();

    await act(async () => {
      await view.result.current.signOut();
    });

    expect(clearOwnerOfflineData).toHaveBeenCalledTimes(1);
    expect(view.result.current.user).toBeNull();
    expect(view.result.current.notice).toBeNull();
  });
});
