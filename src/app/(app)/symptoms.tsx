import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { BarChart } from '@/components/Charts';
import { Mascot } from '@/components/Mascot';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { Badge, Button, Card, Chips, H1, H2, Muted, Screen } from '@/components/ui';
import { dayKey } from '@/core/progress';
import { lastDates, symptomSeries } from '@/core/insights';
import { startOfDay } from '@/lib/data';
import { useT, type Key } from '@/i18n';
import { useSymptomHistory } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { colors } from '@/lib/theme';

/** Weekly / monthly pattern of the person's own check-ins. Only what they entered; no interpretation. */
export default function Symptoms() {
  const t = useT();
  const router = useRouter();
  const ctx = useHealthContext();
  const [range, setRange] = useState<'7' | '30'>('7');
  const n = Number(range);
  const from = new Date(startOfDay().getTime() - 59 * 86400000);
  const hist = useSymptomHistory(ctx.uid, ctx.memberId, from.toISOString());
  const dates = lastDates(dayKey(new Date()), n);
  const logs = (hist.data ?? []).filter((l) => l.date >= dates[0]);
  const series = symptomSeries(logs.map((l) => ({ date: l.date, severity: l.severity })), dates);
  const avg = logs.length ? Math.round((logs.reduce((a, l) => a + l.severity, 0) / logs.length) * 10) / 10 : 0;
  const nameOf = (type: string, label: string | null) => label ?? t(`h4.ci.type.${type}` as Key);
  const counts: Record<string, number> = {};
  for (const l of logs) counts[nameOf(l.type, l.label)] = (counts[nameOf(l.type, l.label)] ?? 0) + 1;
  const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <Screen>
      <H1>{t('h4.sh.title')}</H1>
      <MemberSwitcher />
      <Chips value={range} onChange={setRange} options={[{ value: '7', label: t('h4.sh.week') }, { value: '30', label: t('h4.sh.month') }]} />
      {logs.length === 0 ? (
        <Card><View style={{ alignItems: 'center' }}><Mascot mood="sleepy" size={90} /></View><Muted>{t('h4.sh.empty')}</Muted><Button title={t('h4.ci.headache')} onPress={() => router.push({ pathname: '/check-in', params: { type: 'headache' } })} /></Card>
      ) : (
        <Card>
          <BarChart bars={series.map((p) => ({ label: p.date.slice(8), value: p.maxSeverity, color: p.maxSeverity >= 7 ? '#E0645C' : p.maxSeverity >= 4 ? '#F0A93B' : '#7C6FD0' }))} max={10} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Badge label={t('h4.sh.total', { n: logs.length })} />
            <Badge label={t('h4.sh.avg', { n: avg })} />
            {common ? <Badge label={t('h4.sh.common', { x: common })} /> : null}
          </View>
          <Muted>{t('h4.sh.note')}</Muted>
        </Card>
      )}
      {logs.length ? (
        <>
          <H2>{t('h4.sh.recent')}</H2>
          {logs.slice(0, 10).map((l) => (
            <Card key={l.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }}>{nameOf(l.type, l.label)}</Text>
                <Text style={{ color: colors.muted }}>{l.date}</Text>
              </View>
              <Muted>{l.severity} / 10 · {t(`h4.ci.status.${l.status}` as Key)}</Muted>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
