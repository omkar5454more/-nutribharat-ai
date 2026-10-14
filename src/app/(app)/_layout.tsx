import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useSetupPending } from '@/state/setup';
import { FollowUpWatcher } from '@/components/CareCards';
import { CelebrationLayer } from '@/components/Celebrate';
import { useT } from '@/i18n';

export default function AppLayout() {
  const t = useT();
  const router = useRouter();
  const pending = useSetupPending((s) => s.pending);
  useEffect(() => {
    if (pending) { useSetupPending.getState().set(false); router.push('/setup'); }
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
    <FollowUpWatcher />
    <CelebrationLayer />
    <Stack screenOptions={{ headerTintColor: '#16693A', headerStyle: { backgroundColor: '#FAF8F3' } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="scan" options={{ title: t('scan.title') }} />
      <Stack.Screen name="review" options={{ title: t('review.title') }} />
      <Stack.Screen name="add-food" options={{ title: t('add.title'), presentation: 'modal' }} />
      <Stack.Screen name="edit-profile" options={{ title: t('prof.editTitle') }} />
      <Stack.Screen name="family" options={{ title: t('fam.title') }} />
      <Stack.Screen name="barcode" options={{ title: t('bc.title') }} />
      <Stack.Screen name="history" options={{ title: t('prog.seeMeals') }} />
      <Stack.Screen name="health" options={{ title: t('h4.prof.health') }} />
      <Stack.Screen name="flex" options={{ title: t('h4.flex.title') }} />
      <Stack.Screen name="routine-settings" options={{ title: t('h4.rt.settings') }} />
      <Stack.Screen name="routine-edit" options={{ title: t('h4.rt.edit') }} />
      <Stack.Screen name="check-in" options={{ title: t('h4.ci.title') }} />
      <Stack.Screen name="comfort" options={{ headerShown: false, gestureEnabled: false, animation: 'none' }} />
      <Stack.Screen name="gym" options={{ title: t('h4.gym.title') }} />
      <Stack.Screen name="symptoms" options={{ title: t('h4.sh.title') }} />
      <Stack.Screen name="womens" options={{ title: t('h4.wh.title') }} />
      <Stack.Screen name="week-plan" options={{ title: t('h4.wp.title') }} />
      <Stack.Screen name="report" options={{ title: t('h4.rp.title') }} />
      <Stack.Screen name="journey" options={{ title: t('h4.jy.title') }} />
      <Stack.Screen name="contacts" options={{ title: t('h4.ct.title') }} />
      <Stack.Screen name="setup" options={{ title: t('app.name'), headerBackVisible: false, gestureEnabled: false }} />
    </Stack>
    </>
  );
}
