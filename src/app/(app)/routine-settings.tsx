import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { RoutineSettingsForm } from '@/components/RoutineSettingsForm';
import { TimeField } from '@/components/TimeField';
import { Button, Card, Field, H1, H2, MultiChips, Muted, Notice, Screen } from '@/components/ui';
import { DEFAULT_REMINDERS } from '@/components/RoutineView';
import { DEFAULT_PREFS, fmtMinute, generateRoutine, type ActivityKind, type RoutinePrefs } from '@/core/routine';
import { ymd } from '@/core/flexday';
import { useT, type Key } from '@/i18n';
import { deleteReminder, saveNotifPrefs, saveReminder, saveRoutine, saveRoutinePrefs, useNotifPrefs, type NotifPrefs } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { askNotificationPermission, notificationsAllowed, notificationsSupported } from '@/lib/notify';
import { colors } from '@/lib/theme';

const KINDS: ActivityKind[] = ['breakfast', 'lunch', 'snack', 'dinner', 'hydration', 'exercise', 'relax', 'sleep'];

export default function RoutineSettings() {
  const t = useT();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const [prefs, setPrefs] = useState<RoutinePrefs>(DEFAULT_PREFS);
  const loaded = useRef('');
  const [msg, setMsg] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [medLabel, setMedLabel] = useState('');
  const [medTime, setMedTime] = useState<number | null>(8 * 60);
  const [kinds, setKinds] = useState<ActivityKind[] | null>(null);
  const [notif, setNotif] = useState(notificationsAllowed());
  const np = useNotifPrefs(ctx.uid);
  const [npDraft, setNpDraft] = useState<NotifPrefs | null>(null);
  const npv = npDraft ?? np.data ?? null;
  const who = `${ctx.uid}:${ctx.memberId}`;

  useEffect(() => {
    if (!ctx.loading && ctx.prefs && loaded.current !== who) {
      loaded.current = who;
      setPrefs(ctx.prefs);
      const rows = ctx.reminders.filter((r) => r.kind !== 'medication' && r.minute === null);
      setKinds(rows.length ? (rows.filter((r) => r.enabled).map((r) => r.kind) as ActivityKind[]) : DEFAULT_REMINDERS.filter((k) => k !== 'medication'));
    }
  }, [ctx.loading, ctx.prefs, ctx.reminders, who]);

  async function save() {
    setMsg(null);
    try {
      await saveRoutinePrefs(ctx.uid!, ctx.memberId, prefs);
      if (npDraft) await saveNotifPrefs(ctx.uid!, npDraft);
      for (const r of ctx.reminders.filter((x) => x.kind !== 'medication' && x.minute === null)) await deleteReminder(r.id);
      for (const k of KINDS) await saveReminder(ctx.uid!, ctx.memberId, { kind: k, minute: null, enabled: (kinds ?? []).includes(k) });
      // today's routine is rebuilt from the new settings
      await saveRoutine(ctx.uid!, ctx.memberId, ymd(new Date()), generateRoutine(prefs, ctx.constraints, ctx.meds));
      await qc.invalidateQueries();
      setMsg({ tone: 'info', text: t('h4.saved') });
    } catch {
      setMsg({ tone: 'warn', text: t('h4.fail') });
    }
  }

  async function addMed() {
    if (!medLabel.trim() || medTime === null) return;
    try {
      await saveReminder(ctx.uid!, ctx.memberId, { kind: 'medication', minute: medTime, enabled: true, label: medLabel.trim().slice(0, 80) });
      setMedLabel('');
      await qc.invalidateQueries({ queryKey: ['reminders'] });
      setMsg({ tone: 'info', text: t('h4.saved') });
    } catch {
      setMsg({ tone: 'warn', text: t('h4.fail') });
    }
  }

  const meds = ctx.reminders.filter((r) => r.kind === 'medication');
  return (
    <Screen>
      <H1>{t('h4.set.title')}</H1>
      <MemberSwitcher />
      <Card>
        <RoutineSettingsForm value={prefs} onChange={setPrefs} />
      </Card>

      <Card>
        <H2>{t('h4.set.reminders')}</H2>
        <MultiChips
          options={KINDS.map((k) => ({ value: k, label: t(`h4.routine.${k}` as Key) }))}
          values={kinds ?? []}
          onToggle={(k) => setKinds((cur) => ((cur ?? []).includes(k) ? (cur ?? []).filter((x) => x !== k) : [...(cur ?? []), k]))}
        />
        {notificationsSupported() ? (
          notif ? <Muted>{t('h4.notif.on')}</Muted> : <Button title={t('h4.notif.enable')} variant="secondary" onPress={async () => setNotif(await askNotificationPermission())} />
        ) : null}
        <Muted>{t('h4.notif.note')}</Muted>
      </Card>

      {npv ? (
        <Card>
          <H2>{t('h4.np.title')}</H2>
          <MultiChips
            options={[{ value: 'followups', label: t('h4.np.followups') }, { value: 'meals', label: t('h4.np.meals') }, { value: 'routine', label: t('h4.np.routine') }, { value: 'wellness', label: t('h4.np.wellness') }]}
            values={(['followups', 'meals', 'routine', 'wellness'] as const).filter((k) => npv[k])}
            onToggle={(k) => setNpDraft({ ...npv, [k]: !npv[k as 'followups'] })}
          />
          <H2>{t('h4.np.quiet')}</H2>
          <TimeField label={t('h4.np.start')} value={npv.quiet?.startMinute ?? 22 * 60} onChange={(m) => m !== null && setNpDraft({ ...npv, quiet: { startMinute: m, endMinute: npv.quiet?.endMinute ?? 7 * 60 } })} />
          <TimeField label={t('h4.np.end')} value={npv.quiet?.endMinute ?? 7 * 60} onChange={(m) => m !== null && setNpDraft({ ...npv, quiet: { startMinute: npv.quiet?.startMinute ?? 22 * 60, endMinute: m } })} />
        </Card>
      ) : null}

      <Card>
        <H2>{t('h4.med.title')}</H2>
        <Muted>{t('h4.med.hint')}</Muted>
        {!ctx.consents.condition_tracking ? <Notice tone="info">{t('h4.med.needConsent')}</Notice> : null}
        {meds.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, flex: 1 }}>{fmtMinute(m.minute ?? 0)}  {m.label}</Text>
            <Button title={t('h4.remove')} variant="link" onPress={async () => { await deleteReminder(m.id); await qc.invalidateQueries({ queryKey: ['reminders'] }); }} />
          </View>
        ))}
        <Field label={t('h4.med.label')} value={medLabel} onChangeText={setMedLabel} maxLength={80} />
        <TimeField label={t('h4.med.time')} value={medTime} onChange={setMedTime} />
        <Button title={t('h4.med.add')} variant="secondary" onPress={addMed} disabled={!ctx.consents.condition_tracking || !medLabel.trim()} />
      </Card>

      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Button title={t('h4.save')} onPress={save} />
    </Screen>
  );
}
