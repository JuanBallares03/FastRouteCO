import { Linking, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { radius, spacing, typography } from '@/theme';

export const TRACKING_NOTIFICATION_NOTICE =
  'Las notificaciones de FastRouteCO están desactivadas. Tu ubicación se sigue registrando mientras la ruta está en curso, aunque no veas el aviso en la barra de notificaciones.';

// Shown while a route is in progress and the tracking notification cannot be displayed, so
// the driver still knows that their location is being recorded (RF13, RNF10).
export function TrackingNotificationNotice() {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Text style={styles.text}>{TRACKING_NOTIFICATION_NOTICE}</Text>
      <AppButton title="Abrir ajustes" onPress={() => void Linking.openSettings()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 2,
    borderRadius: radius.md,
    backgroundColor: '#FEF9C3',
    borderColor: '#FACC15',
  },
  text: {
    color: '#713F12',
    fontSize: typography.label,
    fontWeight: '600',
    lineHeight: 22,
  },
});
