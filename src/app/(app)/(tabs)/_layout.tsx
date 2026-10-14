import { Tabs } from 'expo-router';
import { Icon, type IconName } from '@/components/icons';
import { useT } from '@/i18n';
import { colors } from '@/lib/theme';

const icon = (name: IconName) => ({ color, focused }: { color: unknown; focused: boolean }) => <Icon name={name} color={String(color)} size={24} stroke={focused ? 2.4 : 2} />;

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: '#8A958C',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.border, height: 64, paddingTop: 6, boxShadow: '0 -6px 20px rgba(22, 35, 27, 0.06)' } as object,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', paddingBottom: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.today'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="plan" options={{ title: t('tab.plan'), tabBarIcon: icon('plan') }} />
      <Tabs.Screen name="chat" options={{ title: t('tab.chat'), tabBarIcon: icon('chat') }} />
      <Tabs.Screen name="progress" options={{ title: t('tab.progress'), tabBarIcon: icon('progress') }} />
      <Tabs.Screen name="profile" options={{ title: t('tab.profile'), tabBarIcon: icon('profile') }} />
    </Tabs>
  );
}
