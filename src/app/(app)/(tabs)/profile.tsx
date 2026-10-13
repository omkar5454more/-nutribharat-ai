import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Text } from 'react-native';
import { Button, Card, H1, H2, Muted, Notice, Screen } from '@/components/ui';
import { ACTIVITY_LABEL } from '@/core/goals';
import { ageFrom, targetsFor, useProfile } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';

export default function Profile() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const p = useProfile(session?.user.id).data!;
  const t = targetsFor(p);
  const [error, setError] = useState('');

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
  }

  async function deleteAccount() {
    setError('');
    const { error: e } = await supabase.rpc('delete_my_account');
    if (e) return setError('Could not delete your account. Please try again.');
    await supabase.auth.signOut();
    qc.clear();
  }

  function confirmDelete() {
    const msg = 'This permanently deletes your account, profile and every meal you logged. It cannot be undone.';
    if (Platform.OS === 'web') return void (window.confirm(msg) && deleteAccount());
    Alert.alert('Delete account and all data?', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete everything', style: 'destructive', onPress: deleteAccount }]);
  }

  return (
    <Screen>
      <H1>Profile</H1>
      <Card>
        <Text style={{ fontWeight: '700' }}>{session?.user.email}</Text>
        <Muted>Age {ageFrom(p.birth_date)} · {p.height_cm} cm · {p.weight_kg} kg · BMI {t.bmi}</Muted>
        <Muted>{ACTIVITY_LABEL[p.activity]}</Muted>
        <Muted>Goal: {p.goal === 'lose' ? 'lose weight' : p.goal === 'gain' ? 'gain weight' : 'stay the same'} · Food: {p.diet}</Muted>
      </Card>
      <Card>
        <H2>Daily targets</H2>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>{t.kcal} kcal</Text>
        <Muted>Protein {t.protein_g} g · Carbs {t.carbs_g} g · Fat {t.fat_g} g · Water {(t.water_ml / 1000).toFixed(1)} L</Muted>
        {t.notes.map((n) => <Notice key={n}>{n}</Notice>)}
      </Card>
      <Button title="Edit profile" variant="secondary" onPress={() => router.push('/edit-profile')} />
      <Button title="Sign out" variant="secondary" onPress={signOut} />
      <H2>Your data</H2>
      <Muted>Meal photos are analysed and then discarded; only the foods and amounts you confirm are saved.</Muted>
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Delete my account and data" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}
