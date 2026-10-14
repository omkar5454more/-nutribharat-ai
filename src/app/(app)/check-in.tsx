import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { FOLLOW_UP_DELAYS_MIN, SYMPTOM_TYPES, screenGeneral, screenHeadache, type HeadacheAnswers, type Screening, type SymptomType } from '@/core/health/symptoms';
import { fmtMinute } from '@/core/routine';
import { Button, Card, Chips, Field, H1, H2, MultiChips, Muted, Notice, Screen } from '@/components/ui';
import { ContactAlert } from '@/components/ContactAlert';
import { Mascot } from '@/components/Mascot';
import { cancelScheduled, scheduleOnce } from '@/lib/notify';
import { useT, type Key } from '@/i18n';
import { createCheckIn, logSafetyEvent, useNotifPrefs } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { useComfort } from '@/state/comfort';

type Q = keyof HeadacheAnswers;
const HEADACHE_QS: Q[] = ['suddenSevere', 'neurological', 'feverStiffNeck', 'afterInjury', 'newOrDifferent', 'knownMigraine'];

/**
 * A caring, structured check-in: what it is → how strong → safety questions → an honest answer. Emergencies and "see a doctor" results never
 * offer a routine reminder. A follow-up is only scheduled if the person asks, and only fires while the app is open.
 */
export default function CheckIn() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ type?: string }>();
  const ctx = useHealthContext();
  const prefs = useNotifPrefs(ctx.uid);
  const comfort = useComfort((s) => s.enter);
  const [type, setType] = useState<SymptomType>(SYMPTOM_TYPES.includes(params.type as SymptomType) ? (params.type as SymptomType) : 'headache');
  const [severity, setSeverity] = useState(5);
  const [answers, setAnswers] = useState<Q[]>([]);
  const [danger, setDanger] = useState(false);
  const [label, setLabel] = useState('');
  const [result, setResult] = useState<Screening | null>(null);
  const [follow, setFollow] = useState<number | 'no'>('no');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  const has = (q: Q) => answers.includes(q);
  const toggle = (q: Q) => setAnswers((a) => (a.includes(q) ? a.filter((x) => x !== q) : [...a, q]));

  async function screen() {
    const a: Partial<HeadacheAnswers> = Object.fromEntries(HEADACHE_QS.map((q) => [q, has(q)]));
    const r = type === 'headache' ? screenHeadache(a) : screenGeneral(severity, danger);
    setResult(r);
    if (r === 'emergency') await logSafetyEvent(ctx.uid!, ctx.memberId, 'red_flag_symptom', 'urgent', { type });
  }

  async function save() {
    setError('');
    try {
      const delay = follow === 'no' ? null : (follow as (typeof FOLLOW_UP_DELAYS_MIN)[number]);
      const quiet = prefs.data?.quiet ?? null;
      const logId = await createCheckIn(ctx.uid!, ctx.memberId, { type, severity, screening: result!, followDelayMin: delay, quiet, customLabel: label.trim() || undefined });
      await qc.invalidateQueries({ queryKey: ['symptoms'] });
      await qc.invalidateQueries({ queryKey: ['followups'] });
      const due = delay && result === 'usual' ? Date.now() + delay * 60000 : 0;
      if (due) scheduleOnce(`fu-${logId}`, t('h4.nt.followup'), due);   // a real phone notification on Android / iOS (generic text)
      setSaved(due ? t('h4.ci.savedFollow', { time: fmtMinute(new Date(due).getHours() * 60 + new Date(due).getMinutes()) }) : t('h4.ci.saved'));
    } catch {
      setError(t('h4.ci.consentNeeded'));
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center' }}><Mascot mood="care" size={96} /></View>
      <H1>{t('h4.ci.sorry')}</H1>
      {result === null ? (
        <>
          <Chips value={type} onChange={setType} options={SYMPTOM_TYPES.map((s) => ({ value: s, label: t(`h4.ci.type.${s}` as Key) }))} />
          <H2>{t('h4.ci.severity')}</H2>
          <Chips value={String(severity)} onChange={(v) => setSeverity(Number(v))} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
          <Muted>{t('h4.ci.q.intro')}</Muted>
          {type === 'headache' ? (
            <MultiChips options={HEADACHE_QS.map((q) => ({ value: q, label: t(`h4.ci.q.${q}` as Key) }))} values={answers} onToggle={toggle} />
          ) : (
            <>
              {type === 'other' ? <Field label={t('h4.ci.customLabel')} value={label} onChangeText={setLabel} maxLength={60} /> : null}
              <MultiChips options={[{ value: 'danger', label: t(type === 'digestive' ? 'h4.ci.q.dangerDigestive' : 'h4.ci.q.danger') }]} values={danger ? ['danger'] : []} onToggle={() => setDanger((d) => !d)} />
            </>
          )}
          <Button title={t('h4.ci.continue')} onPress={screen} />
        </>
      ) : (
        <>
          {result === 'emergency' ? (
            <>
              <Notice tone="urgent">{t('h4.ci.emergency')}</Notice>
              <Button title={t('h4.emergency.call')} variant="danger" onPress={() => { Linking.openURL('tel:112').catch(() => {}); }} />
              <ContactAlert kind="emergency" />
            </>
          ) : result === 'see_doctor' ? (
            <Notice tone="warn">{t('h4.ci.seeDoctor')}</Notice>
          ) : (
            <>
              <Notice tone="info">{t(type === 'headache' ? 'h4.ci.usual' : 'h4.ci.generalUsual')}</Notice>
              <Muted>{t('h4.ci.later')}</Muted>
              <Chips<string>
                value={String(follow)}
                onChange={(v) => setFollow(v === 'no' ? 'no' : Number(v))}
                options={[...FOLLOW_UP_DELAYS_MIN.map((m) => ({ value: String(m), label: t('h4.ci.in', { n: m }) })), { value: 'no', label: t('h4.ci.no') }]}
              />
              <Button title={t('h4.ci.comfort')} variant="secondary" onPress={() => { comfort(); router.replace('/comfort'); }} />
            </>
          )}
          {saved ? <Notice tone="info">{saved}</Notice> : <Button title={t('h4.ci.save')} variant={result === 'usual' ? 'primary' : 'secondary'} onPress={save} />}
          {error ? <Notice>{error}</Notice> : null}
          <View><Muted>{t('h4.ci.disclaimer')}</Muted></View>
          <Card><Button title={t('h4.back')} variant="link" onPress={() => router.back()} /></Card>
        </>
      )}
    </Screen>
  );
}
