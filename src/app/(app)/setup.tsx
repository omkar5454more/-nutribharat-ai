import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlexPlanner } from '@/components/FlexPlanner';
import { HealthSetup } from '@/components/HealthSetup';
import { GymForm } from '@/components/Gym';
import { RoutineSettingsForm } from '@/components/RoutineSettingsForm';
import { Badge, Button, Card, H1, Muted, Notice, Screen } from '@/components/ui';
import { ymd } from '@/core/flexday';
import { DEFAULT_PREFS, generateRoutine, type RoutinePrefs } from '@/core/routine';
import { useT } from '@/i18n';
import { saveRoutine, saveRoutinePrefs } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';

/** Steps 4-7 of 7 (1-3 are account, language and profile): health (optional) → daily rhythm → Flex Day → done. Every step can be skipped. */
export default function Setup() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const [step, setStep] = useState(4);
  const [prefs, setPrefs] = useState<RoutinePrefs>(DEFAULT_PREFS);
  const [error, setError] = useState('');
  const loaded = useRef(false);
  useEffect(() => {
    if (!ctx.loading && ctx.prefs && !loaded.current) { loaded.current = true; setPrefs(ctx.prefs); }
  }, [ctx.loading, ctx.prefs]);

  const titles: Record<number, string> = { 4: t('h4.setup.health'), 5: t('h4.setup.routine'), 6: t('h4.setup.flex'), 7: t('h4.setup.review') };

  async function savePrefs() {
    setError('');
    try {
      await saveRoutinePrefs(ctx.uid!, ctx.memberId, prefs);
      await saveRoutine(ctx.uid!, ctx.memberId, ymd(new Date()), generateRoutine(prefs, ctx.constraints, ctx.meds));
      await qc.invalidateQueries();
      setStep(6);
    } catch {
      setError(t('h4.fail'));
    }
  }

  return (
    <Screen>
      <Badge label={t('h4.step', { n: step })} tone="good" />
      <H1>{titles[step]}</H1>

      {step === 4 ? (
        <>
          <HealthSetup onSaved={() => setStep(5)} saveLabel={t('h4.next')} />
          <Button title={t('h4.setup.skipHealth')} variant="link" onPress={() => setStep(5)} />
        </>
      ) : null}

      {step === 5 ? (
        <>
          <Card><RoutineSettingsForm value={prefs} onChange={setPrefs} /></Card>
          <Card><GymForm compact /></Card>
          {error ? <Notice>{error}</Notice> : null}
          <Button title={t('h4.next')} onPress={savePrefs} />
          <Button title={t('h4.skip')} variant="link" onPress={() => setStep(6)} />
        </>
      ) : null}

      {step === 6 ? (
        <>
          <FlexPlanner onPlanned={() => setStep(7)} />
          <Button title={t('h4.skip')} variant="link" onPress={() => setStep(7)} />
        </>
      ) : null}

      {step === 7 ? (
        <>
          <Muted>{t('h4.setup.reviewBody')}</Muted>
          <Button title={t('h4.setup.finish')} onPress={() => router.replace('/')} />
        </>
      ) : null}
    </Screen>
  );
}
