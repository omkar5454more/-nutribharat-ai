import { useState } from 'react';
import { GymForm, GymPlanView } from '@/components/Gym';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { Button, H1, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { useGymPrefs } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';

export default function Gym() {
  const t = useT();
  const ctx = useHealthContext();
  const prefs = useGymPrefs(ctx.uid, ctx.memberId);
  const [editing, setEditing] = useState(false);
  const has = prefs.data?.exists && prefs.data.goes;
  return (
    <Screen>
      <H1>{t('h4.gym.title')}</H1>
      <MemberSwitcher />
      {has && !editing ? (
        <>
          <GymPlanView />
          <Button title={t('h4.gym.edit')} variant="secondary" onPress={() => setEditing(true)} />
        </>
      ) : (
        <GymForm onSaved={() => setEditing(false)} />
      )}
    </Screen>
  );
}
