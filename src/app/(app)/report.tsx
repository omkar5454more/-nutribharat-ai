import { useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import { BarChart } from '@/components/Charts';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { Badge, Button, Card, Chips, H1, H2, Muted, Notice, Screen } from '@/components/ui';
import { summarizeDays } from '@/core/insights';
import { useT } from '@/i18n';
import { useActive } from '@/lib/active';
import { targetsFor } from '@/lib/data';
import { useDayRecords } from '@/lib/reports';
import { colors } from '@/lib/theme';

/** Weekly / monthly report from what was logged. Averages use only logged days; nothing is invented and nothing is diagnosed. */
export default function Report() {
  const t = useT();
  const { uid, memberId, profile } = useActive();
  const [range, setRange] = useState<'7' | '30'>('7');
  const n = Number(range);
  const r = useDayRecords(uid, memberId, n);
  const goal = targetsFor(profile).water_ml;
  const s = summarizeDays(r.days, goal);
  const lines: string[] = [];
  const nl = t('h4.rp.notLogged');
  lines.push(t('h4.rp.logged', { n: s.loggedDays, total: s.days }));
  lines.push(s.kcal.value !== null ? t('h4.rp.kcal', { n: Math.round(s.kcal.value), d: s.kcal.n }) : `${t('today.calories')}: ${nl}`);
  if (s.protein.value !== null) lines.push(t('h4.rp.protein', { n: Math.round(s.protein.value) }));
  lines.push(s.water.value !== null ? t('h4.rp.water', { n: Math.round(s.water.value), d: s.water.goalDays }) : `${t('water.title')}: ${nl}`);
  lines.push(s.sleep.value !== null ? t('h4.rp.sleep', { n: s.sleep.value, d: s.sleep.n }) : `${t('h4.quick.sleep')}: ${nl}`);
  lines.push(s.steps.value !== null ? t('h4.rp.steps', { n: Math.round(s.steps.value), d: s.steps.n }) : `${t('h4.rp.steps', { n: '–', d: 0 })}`.split('(')[0].trim() + `: ${nl}`);
  lines.push(t('h4.rp.workouts', { n: s.workouts }));
  if (s.mood.value !== null) lines.push(t('h4.rp.mood', { n: s.mood.value, d: s.mood.n }));
  lines.push(t('h4.rp.symptoms', { n: s.symptomDays }));
  if (r.weightStart !== null && r.weightEnd !== null) lines.push(t('h4.rp.weight', { a: r.weightStart, b: r.weightEnd }));

  async function pdf() {
    if (Platform.OS === 'web') {
      // a clean printable page in a new window (the app screen itself scrolls inside a container and would print cut off)
      const esc = (x: string) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<!doctype html><meta charset="utf-8"><title>NutriBharat AI</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#16231B}h1{font-size:22px}li{margin:6px 0}small{color:#667369}</style><h1>NutriBharat AI — ${esc(t(range === '7' ? 'h4.rp.title' : 'h4.rp.month'))}</h1><p><small>${esc(new Date().toLocaleDateString())}</small></p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p><small>${esc(t('h4.rp.legend'))}</small></p>`);
      w.document.close();
      w.focus();
      w.print();
    }
    else await Share.share({ message: `${t(range === '7' ? 'h4.rp.title' : 'h4.rp.month')}\n\n${lines.join('\n')}\n\n${t('h4.rp.legend')}` });
  }

  return (
    <Screen>
      <H1>{t(range === '7' ? 'h4.rp.title' : 'h4.rp.month')}</H1>
      <MemberSwitcher />
      <Chips value={range} onChange={setRange} options={[{ value: '7', label: t('h4.rp.week') }, { value: '30', label: t('h4.rp.m30') }]} />
      <Card>
        <H2>{t('today.calories')}</H2>
        <BarChart bars={r.days.map((d) => ({ label: d.date.slice(8), value: d.kcal ?? 0, color: '#7C6FD0' }))} />
        <H2>{t('water.title')}</H2>
        <BarChart bars={r.days.map((d) => ({ label: d.date.slice(8), value: d.waterMl ?? 0, color: '#3B9AD9' }))} max={Math.max(goal, ...r.days.map((d) => d.waterMl ?? 0))} />
      </Card>
      <Card>
        {lines.map((l, i) => <Text key={i} style={{ color: colors.text, lineHeight: 22 }}>• {l}</Text>)}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Badge label={s.kcal.n ? t('h4.rp.logged', { n: s.loggedDays, total: s.days }) : nl} /></View>
      </Card>
      <Notice tone="info">{t('h4.rp.legend')}</Notice>
      <Button title={t('h4.rp.pdf')} onPress={pdf} />
      {Platform.OS === 'web' ? <Muted>{t('h4.rp.pdfHelp')}</Muted> : null}
    </Screen>
  );
}
