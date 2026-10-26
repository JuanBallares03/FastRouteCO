import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

interface NoticeProps {
  message: string;
  variant?: 'error' | 'success';
}

export function Notice({ message, variant = 'error' }: NoticeProps) {
  const isError = variant === 'error';

  return (
    <View
      accessibilityRole="alert"
      style={[styles.base, isError ? styles.error : styles.success]}
    >
      <Text style={[styles.text, isError ? styles.errorText : styles.successText]}>
        {message}
      </Text>
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
});
