import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: '#16693A', headerStyle: { backgroundColor: '#FAF8F3' } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="scan" options={{ title: 'Scan a meal' }} />
      <Stack.Screen name="review" options={{ title: 'Review your meal' }} />
      <Stack.Screen name="add-food" options={{ title: 'Add a food', presentation: 'modal' }} />
      <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
    </Stack>
  );
}
