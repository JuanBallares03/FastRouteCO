import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthContext';
import { colors, radius, spacing, typography } from '@/theme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Screen scroll>
      <Text accessibilityRole="header" style={styles.title}>
        Perfil
      </Text>
      <Text style={styles.subtitle}>Estos son los datos de tu cuenta.</Text>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Nombre</Text>
          <Text style={styles.value}>{user.fullName}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.field}>
          <Text style={styles.label}>Empresa</Text>
          <Text style={styles.value}>{user.companyName ?? 'Sin empresa asignada'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.field}>
          <Text style={styles.label}>Correo</Text>
          <Text style={styles.value}>{user.email}</Text>
        </View>
      </View>

      <AppButton
        title="Cerrar sesión"
        variant="danger"
        loading={isSigningOut}
        onPress={handleSignOut}
        style={styles.signOut}
      />
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
  card: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  field: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '700',
  },
  value: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  signOut: {
    marginTop: spacing.xl,
  },
});
