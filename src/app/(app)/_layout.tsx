import { Stack } from 'expo-router';
import { useT } from '@/i18n';

export default function AppLayout() {
  const t = useT();
  return (
    <Stack screenOptions={{ headerTintColor: '#16693A', headerStyle: { backgroundColor: '#FAF8F3' } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="scan" options={{ title: t('scan.title') }} />
      <Stack.Screen name="review" options={{ title: t('review.title') }} />
      <Stack.Screen name="add-food" options={{ title: t('add.title'), presentation: 'modal' }} />
      <Stack.Screen name="edit-profile" options={{ title: t('prof.editTitle') }} />
      <Stack.Screen name="family" options={{ title: t('fam.title') }} />
      <Stack.Screen name="barcode" options={{ title: t('bc.title') }} />
      <Stack.Screen name="history" options={{ title: t('prog.seeMeals') }} />
    </Stack>
  );
}
