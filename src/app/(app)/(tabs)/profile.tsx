import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Text } from 'react-native';
import { LanguagePicker, Notes } from '@/components/common';
import { FamilyLink } from '@/components/MemberSwitcher';
import { Button, Card, H1, H2, Muted, Notice, Screen } from '@/components/ui';
import { useT, type Key } from '@/i18n';
import { useInstall } from '@/lib/pwa';
import { ageFrom, targetsFor, useProfile } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';

export default function Profile() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const p = useProfile(session?.user.id).data!;
  const tg = targetsFor(p);
  const [error, setError] = useState('');
  const install = useInstall();

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
  }

  async function deleteAccount() {
    setError('');
    const { error: e } = await supabase.rpc('delete_my_account');
    if (e) return setError(t('prof.deleteFail'));
    await supabase.auth.signOut();
    qc.clear();
  }

  function confirmDelete() {
    const msg = t('prof.deleteBody');
    if (Platform.OS === 'web') return void (window.confirm(msg) && deleteAccount());
    Alert.alert(t('prof.deleteTitle'), msg, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('prof.deleteConfirm'), style: 'destructive', onPress: deleteAccount }]);
  }

  return (
    <Screen>
      <H1>{t('prof.title')}</H1>
      <Card>
        <Text style={{ fontWeight: '700' }}>{session?.user.email}</Text>
        <Muted>{t('prof.line1', { age: ageFrom(p.birth_date), h: p.height_cm, w: p.weight_kg, bmi: tg.bmi })}</Muted>
        <Muted>{t(`act.${p.activity}` as Key)} — {t(`act.${p.activity}.d` as Key)}</Muted>
        <Muted>{t('prof.goalLine', { goal: t(`form.goal.${p.goal}` as Key), diet: t(`form.diet.${p.diet}` as Key) })}</Muted>
      </Card>
      <Card>
        <H2>{t('prof.targets')}</H2>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>{tg.kcal} kcal</Text>
        <Muted>
          {t('macro.protein')} {tg.protein_g} {t('common.g')} · {t('macro.carbs')} {tg.carbs_g} {t('common.g')} · {t('macro.fat')} {tg.fat_g} {t('common.g')} · {t('macro.water')} {(tg.water_ml / 1000).toFixed(1)} L
        </Muted>
        <Notes notes={tg.notes} />
      </Card>
      {install.show ? (
        <Card>
          <H2>{t('pwa.title')}</H2>
          {install.canPrompt ? (
            <>
              <Muted>{t('pwa.android')}</Muted>
              <Button title={t('pwa.install')} onPress={install.install} />
            </>
          ) : install.isIos ? (
            <Muted>{t('pwa.ios')}</Muted>
          ) : (
            <Muted>{t('pwa.android')}</Muted>
          )}
        </Card>
      ) : null}
      <H2>{t('common.language')}</H2>
      <LanguagePicker />
      <FamilyLink />
      <Button title={t('h4.prof.health')} variant="secondary" onPress={() => router.push('/health')} />
      <Button title={t('h4.prof.routine')} variant="secondary" onPress={() => router.push('/routine-settings')} />
      <Button title={t('h4.prof.contacts')} variant="secondary" onPress={() => router.push('/contacts')} />
      <Button title={t('h4.prof.journey')} variant="secondary" onPress={() => router.push('/journey')} />
      <Button title={t('h4.prof.reports')} variant="secondary" onPress={() => router.push('/report')} />
      <Button title={t('h4.prof.women')} variant="secondary" onPress={() => router.push('/womens')} />
      <Button title={t('h4.prof.gym')} variant="secondary" onPress={() => router.push('/gym')} />
      <Button title={t('h4.prof.flex')} variant="secondary" onPress={() => router.push('/flex')} />
      <Button title={t('prof.edit')} variant="secondary" onPress={() => router.push('/edit-profile')} />
      <Button title={t('prof.signOut')} variant="secondary" onPress={signOut} />
      <H2>{t('prof.data')}</H2>
      <Muted>{t('prof.dataNote')}</Muted>
      {error ? <Notice>{error}</Notice> : null}
      <Button title={t('prof.delete')} variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}
