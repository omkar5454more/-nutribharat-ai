import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { activityTitle } from '@/components/RoutineView';
import { TimeField } from '@/components/TimeField';
import { Button, Card, Field, H1, H2, Muted, Notice, Screen } from '@/components/ui';
import { ymd } from '@/core/flexday';
import { addCustom, fmtMinute } from '@/core/routine';
import { useT } from '@/i18n';
import { saveRoutine, updateActivity, useRoutine } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { colors } from '@/lib/theme';

/** Add your own items, remove entries, or set exact times. Everything here is the person's choice; nothing is forced. */
export default function RoutineEdit() {
  const t = useT();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const today = ymd(new Date());
  const routine = useRoutine(ctx.uid, ctx.memberId, today);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState<number | null>(18 * 60);
  const [dur, setDur] = useState('15');
  const [error, setError] = useState('');
  const wake = ctx.prefs?.wakeMinute ?? 420;
  const acts = routine.data?.activities ?? [];

  const replace = async (next: typeof acts) => {
    setError('');
    try {
      await saveRoutine(ctx.uid!, ctx.memberId, today, next, routine.data?.status ?? {});
      await qc.invalidateQueries({ queryKey: ['routine'] });
    } catch { setError(t('h4.fail')); }
  };

  return (
    <Screen>
      <H1>{t('h4.rt.edit')}</H1>
      {error ? <Notice>{error}</Notice> : null}
      <Card>
        <H2>{t('h4.rt.addCustom')}</H2>
        <Field label={t('h4.rt.customTitle')} value={title} onChangeText={setTitle} maxLength={120} />
        <TimeField label={t('h4.rt.customTime')} value={time} onChange={setTime} />
        <Field label="min" value={dur} onChangeText={setDur} keyboardType="number-pad" maxLength={3} />
        <Button title={t('h4.add')} disabled={!title.trim() || time === null} onPress={async () => { await replace(addCustom(acts, title, time!, Number(dur) || 0, wake)); setTitle(''); }} />
      </Card>
      {acts.length === 0 ? <Muted>{t('h4.rt.empty')}</Muted> : null}
      {acts.map((a) => (
        <Card key={a.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }}>{fmtMinute(a.start)}  {activityTitle(t, a)}</Text>
            {a.kind !== 'wake' && a.kind !== 'sleep' ? <Button title={t('h4.remove')} variant="link" onPress={() => replace(acts.filter((x) => x.id !== a.id))} /> : null}
          </View>
          {a.kind !== 'wake' && a.kind !== 'sleep' ? (
            <TimeField label={t('h4.rt.customTime')} value={a.start} onChange={async (m) => { if (m !== null && m !== a.start) { await updateActivity(a.id, { start: m }); await qc.invalidateQueries({ queryKey: ['routine'] }); } }} />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
