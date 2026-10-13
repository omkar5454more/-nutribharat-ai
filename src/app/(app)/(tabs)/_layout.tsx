import { Tabs } from 'expo-router';
import { colors } from '@/lib/theme';

// Label-only tabs: emoji icons were clipped by the tab bar on some browsers, and text labels are clearer anyway.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.border, height: 56 },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '700', paddingBottom: 14 },
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
