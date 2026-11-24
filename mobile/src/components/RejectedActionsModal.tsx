import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import type { RejectedActionItem } from '@/features/route/rejected-actions';
import { colors, radius, spacing, typography } from '@/theme';

interface RejectedActionsModalProps {
  visible: boolean;
  items: RejectedActionItem[];
  retryingKey: string | null;
  onRetry: (item: RejectedActionItem) => void;
  onClose: () => void;
}

function formatRejectedAt(value: number): string {
  return new Date(value).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Lists the offline actions that could not be sent, with their real reason.
// The driver can retry them but not delete them: the evidence stays on the phone.
export function RejectedActionsModal({
  visible,
  items,
  retryingKey,
  onRetry,
  onClose,
}: RejectedActionsModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Acciones no enviadas
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar detalle"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>Cerrar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {items.length === 0 ? (
            <Text style={styles.empty}>No hay acciones rechazadas.</Text>
          ) : null}

          {items.map((item) => (
            <View key={item.key} style={styles.card}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDate}>{formatRejectedAt(item.rejectedAt)}</Text>
              <Text style={styles.itemReason}>{item.reason || 'Sin motivo informado.'}</Text>
              <AppButton
                title="Reintentar"
                loading={retryingKey === item.key}
                disabled={retryingKey !== null && retryingKey !== item.key}
                onPress={() => onRetry(item)}
              />
            </View>
          ))}

          <Text style={styles.footer}>
            La información se conserva en el teléfono. Avísale a tu supervisor.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  closeText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  empty: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.surface,
  },
  itemTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  itemDate: {
    fontSize: typography.small,
    color: colors.textMuted,
  },
  itemReason: {
    fontSize: typography.label,
    lineHeight: 22,
    color: colors.danger,
  },
  footer: {
    fontSize: typography.label,
    lineHeight: 22,
    color: colors.textSecondary,
  },
});
