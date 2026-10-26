import { Tabs } from 'expo-router';
import { colors } from '@/theme';

export default function AppTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          height: 72,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: colors.surface,
          borderTopWidth: 2,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '700',
        },
        tabBarItemStyle: {
          minHeight: 56,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Mi ruta' }} />
      <Tabs.Screen name="incidents" options={{ title: 'Incidencias' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
