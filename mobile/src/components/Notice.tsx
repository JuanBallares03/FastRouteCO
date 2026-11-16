import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

interface NoticeProps {
  message: string;
  variant?: 'error' | 'success' | 'warning';
}

export function Notice({ message, variant = 'error' }: NoticeProps) {
  const variantStyle =
    variant === 'success'
      ? styles.success
      : variant === 'warning'
        ? styles.warning
        : styles.error;
  const textStyle =
    variant === 'success'
      ? styles.successText
      : variant === 'warning'
        ? styles.warningText
        : styles.errorText;

  return (
    <View accessibilityRole="alert" style={[styles.base, variantStyle]}>
      <Text style={[styles.text, textStyle]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  error: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
  },
  success: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successText,
  },
  warning: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FACC15',
  },
  text: {
    fontSize: typography.label,
    fontWeight: '600',
    lineHeight: 22,
  },
  errorText: {
    color: colors.danger,
  },
  successText: {
    color: colors.successText,
  },
  warningText: {
    color: '#713F12',
  },
});
