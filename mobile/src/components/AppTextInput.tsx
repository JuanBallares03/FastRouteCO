import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, layout, radius, spacing, typography } from '@/theme';

interface AppTextInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  isPassword?: boolean;
}

export function AppTextInput({
  label,
  error,
  isPassword = false,
  onFocus,
  onBlur,
  ...rest
}: AppTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          isFocused && styles.inputRowFocused,
          error ? styles.inputRowError : null,
        ]}
      >
        <TextInput
          {...rest}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword && !isPasswordVisible}
          style={styles.input}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={8}
            onPress={() => setIsPasswordVisible((visible) => !visible)}
            style={styles.toggle}
          >
            <Text style={styles.toggleLabel}>{isPasswordVisible ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  inputRow: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  inputRowFocused: {
    borderColor: colors.focus,
  },
  inputRowError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: layout.touchTarget,
  },
  toggle: {
    minHeight: layout.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  toggleLabel: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '600',
  },
});
