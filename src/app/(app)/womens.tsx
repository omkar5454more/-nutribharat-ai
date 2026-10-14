import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { Button, Card, Chips, Field, H1, H2, Muted, Notice, Screen } from '@/components/ui';
import { daysToWindow, summarizeCycles } from '@/core/cycle';
import { ymd } from '@/core/flexday';
import { useT, type Key } from '@/i18n';
import { addCycle, deleteCycle, useCycles } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { colors } from '@/lib/theme';

const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(`${d}T00:00:00`).getTime()) && ymd(new Date(`${d}T00:00:00`)) === d;

/** A private cycle diary. Estimates come only from the person's entries; irregular patterns just suggest mentioning it to a doctor. */
export default function Womens() {
  const t = useT();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const cycles = useCycles(ctx.uid, ctx.memberId);
  const [start, setStart] = useState(ymd(new Date()));
  const [end, setEnd] = useState('');
  const [flow, setFlow] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [pain, setPain] = useState('');
  const [error, setError] = useState('');
  const consented = ctx.consents.condition_tracking;
  const today = ymd(new Date());
  const summary = summarizeCycles((cycles.data ?? []).map((c) => ({ start: c.start, end: c.end, flow: c.flow, pain: c.pain })), today);
  const toWindow = daysToWindow(summary, today);

  async function save() {
    setError('');
    const p = pain === '' ? null : Number(pain);
    if (!validDate(start) || (end && (!validDate(end) || end < start)) || (p !== null && !(p >= 0 && p <= 10))) return setError(t('h4.wh.badDate'));
    try {
      await addCycle(ctx.uid!, ctx.memberId, { start, end: end || null, flow, pain: p });
      setEnd(''); setPain('');
      await qc.invalidateQueries({ queryKey: ['cycles'] });
    } catch { setError(t('h4.fail')); }
  }

  return (
    <Screen>
      <H1>{t('h4.wh.title')}</H1>
      <MemberSwitcher />
      <Muted>{t('h4.wh.intro')}</Muted>
      {!consented ? <Notice tone="info">{t('h4.consent.needed')}</Notice> : null}
      {toWindow !== null && toWindow <= 3 && toWindow >= -7 ? <Notice tone="info">{t('h4.wh.soon', { n: Math.max(0, toWindow) })}</Notice> : null}

      <Card>
        <H2>{t('h4.wh.save')}</H2>
        <Field label={t('h4.wh.start')} value={start} onChangeText={setStart} maxLength={10} />
        <Field label={t('h4.wh.end')} value={end} onChangeText={setEnd} maxLength={10} />
        <Text style={{ fontWeight: '700', color: colors.text }}>{t('h4.wh.flow')}</Text>
        <Chips value={flow} onChange={setFlow} options={(['light', 'medium', 'heavy'] as const).map((f) => ({ value: f, label: t(`h4.wh.flow.${f}` as Key) }))} />
        <Field label={t('h4.wh.pain')} value={pain} onChangeText={setPain} keyboardType="number-pad" maxLength={2} />
        {error ? <Notice>{error}</Notice> : null}
        <Button title={t('h4.wh.save')} onPress={save} disabled={!consented} />
      </Card>

      <Card>
        <H2>{t('h4.wh.history')}</H2>
        {summary.avgLength !== null ? <Text style={{ fontWeight: '800', fontSize: 18, color: colors.text }}>{t('h4.wh.avg', { n: summary.avgLength })}</Text> : <Muted>{t('h4.wh.need')}</Muted>}
        {summary.avgPeriodDays ? <Muted>{t('h4.wh.period', { n: summary.avgPeriodDays })}</Muted> : null}
        {summary.nextWindow ? <Muted>{t('h4.wh.next', { from: summary.nextWindow.from, to: summary.nextWindow.to })}</Muted> : null}
        {summary.note !== 'ok' && summary.note !== 'need_more' ? <Notice tone="info">{t(`h4.wh.${summary.note}` as Key)}</Notice> : null}
        {(cycles.data ?? []).slice(0, 8).map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.text, flex: 1 }}>{c.start}{c.end ? ` → ${c.end}` : ''}{c.flow ? ` · ${t(`h4.wh.flow.${c.flow}` as Key)}` : ''}{c.pain !== null ? ` · ${c.pain}/10` : ''}</Text>
            <Button title={t('h4.remove')} variant="link" onPress={async () => { await deleteCycle(c.id); await qc.invalidateQueries({ queryKey: ['cycles'] }); }} />
          </View>
        ))}
      </Card>

      <Card>
        <H2>{t('h4.wh.tipsTitle')}</H2>
        {(['h4.wh.tip1', 'h4.wh.tip2', 'h4.wh.tip3', 'h4.wh.tip4'] as const).map((k) => <Text key={k} style={{ color: colors.text }}>• {t(k)}</Text>)}
        <Muted>{t('h4.wh.disclaimer')}</Muted>
      </Card>
    </Screen>
  );
}
