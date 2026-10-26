import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { Notice } from '@/components/Notice';
import { useAuth } from '@/features/auth/AuthContext';
import { getLoginErrorMessage } from '@/features/auth/auth-errors';
import {
  hasErrors,
  validateLoginForm,
  type LoginFormErrors,
} from '@/features/auth/login-validation';
import { colors, layout, radius, spacing, typography } from '@/theme';

export default function LoginScreen() {
  const { signIn, notice, clearNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const message = formError ?? notice;

  const handleSubmit = async () => {
    const nextErrors = validateLoginForm(email, password);
    setErrors(nextErrors);
    setFormError(null);
    clearNotice();

    if (hasErrors(nextErrors)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.brand}>
              FastRouteCO
            </Text>
            <Text accessibilityRole="header" style={styles.title}>
              Inicia sesión
            </Text>
            <Text style={styles.subtitle}>
              Ingresa con el correo y la contraseña de tu cuenta de conductor.
            </Text>

            <View style={styles.form}>
              {message ? <Notice message={message} /> : null}

              <AppTextInput
                label="Correo electrónico"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (errors.email) {
                    setErrors((current) => ({ ...current, email: undefined }));
                  }
                }}
                error={errors.email}
                placeholder="correo@empresa.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />

              <AppTextInput
                label="Contraseña"
                isPassword
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (errors.password) {
                    setErrors((current) => ({ ...current, password: undefined }));
                  }
                }}
                error={errors.password}
                placeholder="Tu contraseña"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              <AppButton title="Ingresar" onPress={handleSubmit} loading={isSubmitting} />
            </View>

            <Text style={styles.help}>
              Si no puedes entrar, comunícate con la empresa para la que trabajas.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  brand: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 24,
  },
  form: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  help: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 20,
    textAlign: 'center',
  },
});
