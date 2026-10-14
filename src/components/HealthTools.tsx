import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, Platform, Share, Text, View } from 'react-native';
import { evaluateBp, evaluateGlucose, type GlucoseContext, type ReadingEval } from '@/core/health/safety';
import { useT, type Key } from '@/i18n';
import { addMeasurement, addTrigger, deleteAllHealthData, deleteMeasurement, deleteTrigger, exportHealthData, logSafetyEvent, purgeOldHealthLogs, useMeasurements, useTriggers } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { colors } from '@/lib/theme';
import { Button, Card, Chips, Field, H2, Muted, Notice } from './ui';

const tone = (e: ReadingEval) => (e.level === 'urgent' ? 'urgent' : e.level === 'warning' ? 'warn' : 'info');
const evalOf = (r: { kind: string; systolic?: number | null; diastolic?: number | null; glucose_mg_dl?: number | null; glucose_context?: string | null }): ReadingEval | null =>
  r.kind === 'bp' && r.systolic && r.diastolic ? evaluateBp(r.systolic, r.diastolic)
  : r.kind === 'glucose' && r.glucose_mg_dl ? evaluateGlucose(Number(r.glucose_mg_dl), (r.glucose_context as GlucoseContext) ?? 'random') : null;

function Call112() {
  const t = useT();
  return <Button title={t('h4.emergency.call')} variant="danger" onPress={() => { Linking.openURL('tel:112').catch(() => {}); }} />;
}

/** Blood pressure and blood sugar notes. The app only records and explains ranges; it never diagnoses. Dangerous values get an emergency message first. */
export function ReadingsCard() {
  const t = useT();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const list = useMeasurements(ctx.uid, ctx.memberId);
  const [kind, setKind] = useState<'bp' | 'glucose'>('bp');
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [pulse, setPulse] = useState('');
  const [glu, setGlu] = useState('');
  const [when, setWhen] = useState<GlucoseContext>('fasting');
  const [result, setResult] = useState<ReadingEval | null>(null);
  const [error, setError] = useState('');
  const consented = ctx.consents.condition_tracking;

  async function save() {
    setError('');
    setResult(null);
    const s = Number(sys), d = Number(dia), g = Number(glu), p = pulse ? Number(pulse) : undefined;
    if (kind === 'bp' && !(s >= 50 && s <= 300 && d >= 30 && d <= 200 && s > d && (p === undefined || (p >= 20 && p <= 250)))) return setError(t('h4.log.invalid'));
    if (kind === 'glucose' && !(g >= 20 && g <= 800)) return setError(t('h4.log.invalid'));
    const ev = kind === 'bp' ? evaluateBp(s, d) : evaluateGlucose(g, when);
    setResult(ev);                                                    // shown straight away, even if saving fails
    if (ev.level !== 'normal' && ev.level !== 'info') await logSafetyEvent(ctx.uid!, ctx.memberId, ev.emergency ? 'emergency_reading' : 'conflict_detected', ev.level === 'urgent' ? 'urgent' : 'warning', { code: ev.code });
    try {
      await addMeasurement(ctx.uid!, ctx.memberId, kind === 'bp' ? { kind, systolic: s, diastolic: d, pulse: p } : { kind, glucose: g, context: when });
      await qc.invalidateQueries({ queryKey: ['measurements'] });
      setSys(''); setDia(''); setPulse(''); setGlu('');
    } catch {
      setError(t('h4.fail'));
    }
  }

  return (
    <Card>
      <H2>{t('h4.log.title')}</H2>
      <Chips value={kind} onChange={setKind} options={[{ value: 'bp', label: t('h4.log.bp') }, { value: 'glucose', label: t('h4.log.glucose') }]} />
      {kind === 'bp' ? (
        <>
          <Field label={t('h4.log.sys')} value={sys} onChangeText={setSys} keyboardType="number-pad" maxLength={3} />
          <Field label={t('h4.log.dia')} value={dia} onChangeText={setDia} keyboardType="number-pad" maxLength={3} />
          <Field label={t('h4.log.pulse')} value={pulse} onChangeText={setPulse} keyboardType="number-pad" maxLength={3} />
        </>
      ) : (
        <>
          <Field label={t('h4.log.mgdl')} value={glu} onChangeText={setGlu} keyboardType="number-pad" maxLength={3} />
          <Text style={{ fontWeight: '600', color: colors.text }}>{t('h4.log.ctx')}</Text>
          <Chips value={when} onChange={setWhen} options={(['fasting', 'post_meal', 'bedtime', 'random'] as const).map((c) => ({ value: c, label: t(`h4.log.ctx.${c}` as Key) }))} />
        </>
      )}
      {error ? <Notice>{error}</Notice> : null}
      {result ? (
        <>
          <Notice tone={tone(result)}>{t(`h4.read.${result.code}` as Key)}</Notice>
          {result.emergency ? <Call112 /> : null}
        </>
      ) : null}
      <Button title={t('h4.log.add')} onPress={save} disabled={!consented} />
      {!consented ? <Muted>{t('h4.consent.needed')}</Muted> : null}
      <Muted>{t('h4.log.note')}</Muted>

      {list.data?.length === 0 ? <Muted>{t('h4.log.empty')}</Muted> : null}
      {list.data?.slice(0, 8).map((r) => {
        const e = evalOf(r);
        return (
          <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {r.kind === 'bp' ? `${r.systolic}/${r.diastolic}` : `${r.glucose_mg_dl} mg/dL`}  <Text style={{ color: colors.muted, fontWeight: '500' }}>{new Date(r.measured_at).toLocaleDateString()}</Text>
              </Text>
              {e && e.level !== 'normal' ? <Muted>{t(`h4.read.${e.code}` as Key)}</Muted> : null}
            </View>
            <Button title={t('h4.remove')} variant="link" onPress={async () => { await deleteMeasurement(r.id); await qc.invalidateQueries({ queryKey: ['measurements'] }); }} />
          </View>
        );
      })}
    </Card>
  );
}

/** The person's own observations about what brings on symptoms. Never pre-filled with foods "known to trigger" anything. */
export function TriggerCard() {
  const t = useT();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const list = useTriggers(ctx.uid, ctx.memberId);
  const [text, setText] = useState('');
  const consented = ctx.consents.condition_tracking;
  const refresh = () => qc.invalidateQueries({ queryKey: ['triggers'] });
  return (
    <Card>
      <H2>{t('h4.trig.title')}</H2>
      <Muted>{t('h4.trig.hint')}</Muted>
      <Field label={t('h4.add')} value={text} onChangeText={setText} placeholder={t('h4.trig.placeholder')} maxLength={80} />
      <Button title={t('h4.add')} variant="secondary" disabled={!consented || !text.trim()} onPress={async () => { await addTrigger(ctx.uid!, ctx.memberId, text); setText(''); await refresh(); }} />
      {list.data?.length === 0 ? <Muted>{t('h4.trig.empty')}</Muted> : null}
      {list.data?.map((x) => (
        <View key={x.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, flex: 1 }}>• {x.label}</Text>
          <Button title={t('h4.remove')} variant="link" onPress={async () => { await deleteTrigger(x.id); await refresh(); }} />
        </View>
      ))}
    </Card>
  );
}

/** Download, retention and deletion controls. */
export function PrivacyCard() {
  const t = useT();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);

  async function download() {
    setMsg('');
    try {
      const data = JSON.stringify(await exportHealthData(ctx.uid!), null, 2);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nutribharat-health-data.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: data });
      }
      setMsg(t('h4.priv.exported'));
    } catch {
      setMsg(t('h4.fail'));
    }
  }

  async function purge() {
    setMsg('');
    try {
      const n = await purgeOldHealthLogs(180);
      await qc.invalidateQueries();
      setMsg(t('h4.priv.purged', { n }));
    } catch {
      setMsg(t('h4.fail'));
    }
  }

  async function wipe() {
    setMsg('');
    try {
      await deleteAllHealthData();
      setConfirm(false);
      await qc.invalidateQueries();
      setMsg(t('h4.priv.deleted'));
    } catch {
      setMsg(t('h4.fail'));
    }
  }

  return (
    <Card>
      <H2>{t('h4.priv.title')}</H2>
      <Muted>{t('h4.priv.ai')}</Muted>
      <Button title={t('h4.priv.export')} variant="secondary" onPress={download} />
      <Button title={t('h4.priv.purge')} variant="secondary" onPress={purge} />
      {confirm ? (
        <>
          <Notice tone="urgent">{t('h4.priv.deleteConfirm')}</Notice>
          <Button title={t('h4.priv.yes')} variant="danger" onPress={wipe} />
          <Button title={t('h4.cancel')} variant="link" onPress={() => setConfirm(false)} />
        </>
      ) : (
        <Button title={t('h4.priv.deleteAll')} variant="danger" onPress={() => setConfirm(true)} />
      )}
      {msg ? <Notice tone="info">{msg}</Notice> : null}
    </Card>
  );
}
