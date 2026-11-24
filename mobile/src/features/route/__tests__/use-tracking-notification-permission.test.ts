import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { hasTrackingNotificationPermission } from '../notification-permission';
import { useTrackingNotificationPermission } from '../use-tracking-notification-permission';

jest.mock('../notification-permission', () => ({
  hasTrackingNotificationPermission: jest.fn(),
}));

let appStateHandlers: ((state: AppStateStatus) => void)[];

beforeEach(() => {
  jest.clearAllMocks();
  appStateHandlers = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type: string, handler: (state: AppStateStatus) => void) => {
      appStateHandlers.push(handler);
      return { remove: jest.fn() } as never;
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useTrackingNotificationPermission', () => {
  it('reports a denied permission', async () => {
    jest.mocked(hasTrackingNotificationPermission).mockResolvedValue(false);

    const { result } = await renderHook(() => useTrackingNotificationPermission());

    await waitFor(() => expect(result.current.state).toBe('denied'));
  });

  it('checks again when the driver comes back from the system settings', async () => {
    jest.mocked(hasTrackingNotificationPermission).mockResolvedValue(false);
    const { result } = await renderHook(() => useTrackingNotificationPermission());
    await waitFor(() => expect(result.current.state).toBe('denied'));

    jest.mocked(hasTrackingNotificationPermission).mockResolvedValue(true);
    await act(async () => {
      appStateHandlers.forEach((handler) => handler('active'));
    });

    await waitFor(() => expect(result.current.state).toBe('granted'));
  });

  it('updates the state on demand after the permission is requested', async () => {
    jest.mocked(hasTrackingNotificationPermission).mockResolvedValue(false);
    const { result } = await renderHook(() => useTrackingNotificationPermission());
    await waitFor(() => expect(result.current.state).toBe('denied'));

    jest.mocked(hasTrackingNotificationPermission).mockResolvedValue(true);
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state).toBe('granted');
  });
});
