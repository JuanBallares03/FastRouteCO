import { Alert, PermissionsAndroid, Platform, type AlertButton } from 'react-native';
import {
  hasTrackingNotificationPermission,
  requestTrackingNotificationPermission,
} from '../notification-permission';

const originalOS = Object.getOwnPropertyDescriptor(Platform, 'OS');
const originalVersion = Object.getOwnPropertyDescriptor(Platform, 'Version');

function setPlatform(os: string, version: number) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
}

// Simulates the driver tapping one of the explanation buttons.
function answerAlert(buttonText: 'Continuar' | 'Ahora no') {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === buttonText)?.onPress?.();
  });
}

const check = jest.spyOn(PermissionsAndroid, 'check');
const request = jest.spyOn(PermissionsAndroid, 'request');

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android', 34);
  check.mockResolvedValue(false);
  request.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  answerAlert('Continuar');
});

afterAll(() => {
  if (originalOS) Object.defineProperty(Platform, 'OS', originalOS);
  if (originalVersion) Object.defineProperty(Platform, 'Version', originalVersion);
  jest.restoreAllMocks();
});

describe('requestTrackingNotificationPermission', () => {
  it('returns true without asking when the permission is already granted', async () => {
    check.mockResolvedValue(true);

    await expect(requestTrackingNotificationPermission()).resolves.toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('explains the permission and returns true when the driver grants it', async () => {
    await expect(requestTrackingNotificationPermission()).resolves.toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Aviso de recorrido',
      expect.stringContaining('registra tu ubicación'),
      expect.any(Array),
      expect.any(Object)
    );
    expect(request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  });

  it('returns false when the driver denies the permission', async () => {
    request.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    await expect(requestTrackingNotificationPermission()).resolves.toBe(false);
  });

  it('returns false when the driver chose not to be asked again', async () => {
    request.mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

    await expect(requestTrackingNotificationPermission()).resolves.toBe(false);
  });

  it('does not open the system dialog when the driver taps "Ahora no"', async () => {
    answerAlert('Ahora no');

    await expect(requestTrackingNotificationPermission()).resolves.toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('returns false instead of throwing when the permission request fails', async () => {
    request.mockRejectedValue(new Error('no activity'));

    await expect(requestTrackingNotificationPermission()).resolves.toBe(false);
  });

  it.each([
    ['android', 32],
    ['ios', 18],
  ])('does not ask on %s %i, where no runtime permission exists', async (os, version) => {
    setPlatform(os, version);

    await expect(requestTrackingNotificationPermission()).resolves.toBe(true);
    expect(check).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('hasTrackingNotificationPermission', () => {
  it('reports the current permission without asking', async () => {
    check.mockResolvedValue(false);

    await expect(hasTrackingNotificationPermission()).resolves.toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('returns true on Android 12', async () => {
    setPlatform('android', 32);

    await expect(hasTrackingNotificationPermission()).resolves.toBe(true);
  });
});
