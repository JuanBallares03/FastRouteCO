import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, typography } from '@/theme';

export default function MyRouteScreen() {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Mi ruta
      </Text>
      <Text style={styles.subtitle}>Consulta aquí la ruta que tienes asignada para hoy.</Text>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No tienes ruta asignada hoy</Text>
        <Text style={styles.emptyText}>
          Cuando tu empresa te asigne una ruta, la verás en esta pantalla.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 24,
  },
  emptyCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 24,
  },
});
