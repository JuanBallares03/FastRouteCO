import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import {
  TRACKING_NOTIFICATION_NOTICE,
  TrackingNotificationNotice,
} from '../TrackingNotificationNotice';

describe('TrackingNotificationNotice', () => {
  it('explains that the location is still recorded and opens the app settings', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);

    await render(<TrackingNotificationNotice />);

    expect(screen.getByText(TRACKING_NOTIFICATION_NOTICE)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Abrir ajustes' }));
    expect(openSettings).toHaveBeenCalledTimes(1);

    openSettings.mockRestore();
  });
});
