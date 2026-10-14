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
        tabBarActiveTintColor: '#1F1B3A',
        tabBarInactiveTintColor: '#8A8AA3',
        // a floating, rounded bar with a dark pill on the active tab
        tabBarStyle: { backgroundColor: '#fff', marginHorizontal: 14, marginBottom: 10, borderRadius: 30, height: 66, borderTopWidth: 0, paddingTop: 0, paddingBottom: 0, boxShadow: '0 10px 30px rgba(31, 27, 58, 0.16)' } as object,
        tabBarItemStyle: { marginHorizontal: 2, marginVertical: 6 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
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
