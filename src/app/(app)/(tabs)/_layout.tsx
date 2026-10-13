import { Tabs } from 'expo-router';
import { useT } from '@/i18n';
import { colors } from '@/lib/theme';

// Label-only tabs: emoji icons were clipped by the tab bar on some browsers, and text labels are clearer anyway.
export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.border, height: 56 },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700', paddingBottom: 14 },
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.today') }} />
      <Tabs.Screen name="plan" options={{ title: t('tab.plan') }} />
      <Tabs.Screen name="chat" options={{ title: t('tab.chat') }} />
      <Tabs.Screen name="progress" options={{ title: t('tab.progress') }} />
      <Tabs.Screen name="profile" options={{ title: t('tab.profile') }} />
    </Tabs>
  );
}
