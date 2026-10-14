import { View } from 'react-native';
import type { RoutinePrefs } from '@/core/routine';
import { useT } from '@/i18n';
import { TimeField } from './TimeField';
import { Chips, Muted } from './ui';
import { Text } from 'react-native';
import { colors } from '@/lib/theme';

/** Wake/bedtime, work hours, shift pattern, cooking time and fitness. Exercise intensity is always capped by the person's health settings. */
export function RoutineSettingsForm({ value, onChange }: { value: RoutinePrefs; onChange: (v: RoutinePrefs) => void }) {
  const t = useT();
  const label = (k: string) => <Text style={{ fontWeight: '600', color: colors.text }}>{k}</Text>;
  return (
    <View style={{ gap: 12 }}>
      <TimeField label={t('h4.set.wake')} value={value.wakeMinute} onChange={(m) => m !== null && onChange({ ...value, wakeMinute: m })} />
      <TimeField label={t('h4.set.sleep')} value={value.sleepMinute} onChange={(m) => m !== null && onChange({ ...value, sleepMinute: m })} />
      <TimeField label={t('h4.set.workStart')} value={value.workStart} optional onChange={(m) => onChange({ ...value, workStart: m })} />
      <TimeField label={t('h4.set.workEnd')} value={value.workEnd} optional onChange={(m) => onChange({ ...value, workEnd: m })} />
      {label(t('h4.set.shift'))}
      <Chips value={value.shift} onChange={(v) => onChange({ ...value, shift: v })} options={(['none', 'day', 'night', 'rotating'] as const).map((s) => ({ value: s, label: t(`h4.shift.${s}` as const) }))} />
      {label(t('h4.set.cooking'))}
      <Chips value={value.cooking} onChange={(v) => onChange({ ...value, cooking: v })} options={(['quick', 'normal', 'long'] as const).map((s) => ({ value: s, label: t(`h4.cooking.${s}` as const) }))} />
      {label(t('h4.set.fitness'))}
      <Chips value={value.fitness} onChange={(v) => onChange({ ...value, fitness: v })} options={(['beginner', 'moderate', 'active'] as const).map((s) => ({ value: s, label: t(`h4.fit.${s}` as const) }))} />
      <Muted>{t('h4.set.safetyNote')}</Muted>
    </View>
  );
}
