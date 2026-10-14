import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { fmtMinute } from '@/core/routine';
import type { Response } from '@/core/health/symptoms';
import { useT, type Key } from '@/i18n';
import { answerFollowUp, useNotifPrefs, usePendingFollowUps, useSymptomLogs, type PendingFollowUp } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { showNotification } from '@/lib/notify';
import { colors } from '@/lib/theme';
import { Card, Button, H2, Muted, Notice, Badge } from './ui';

/** "How are you feeling right now?" with one-tap entry points. Nothing is scheduled or saved until the person goes through the check-in. */
export function FeelingCard() {
  const t = useT();
  const router = useRouter();
  const [okay, setOkay] = useState(false);
  return (
    <Card>
      <H2>{t('h4.ci.title')}</H2>
      <Muted>{t('h4.ci.sub')}</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flexGrow: 1 }}><Button title={t('h4.ci.headache')} onPress={() => router.push({ pathname: '/check-in', params: { type: 'headache' } })} /></View>
        <Button title={t('h4.ci.okay')} variant="secondary" onPress={() => setOkay(true)} />
      </View>
      <Button title={t('h4.ci.other')} variant="link" onPress={() => router.push({ pathname: '/check-in', params: { type: 'other' } })} />
      {okay ? <Notice tone="info">{t('h4.ci.okayReply')}</Notice> : null}
    </Card>
  );
}

/** A follow-up the person asked for, once it is due. Four one-tap answers; the rules for what happens next live in core/health/symptoms.ts. */
export function FollowUpCard() {
  const t = useT();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const pending = usePendingFollowUps(ctx.uid);
  const prefs = useNotifPrefs(ctx.uid);
  const [reply, setReply] = useState<{ text: string; urgent: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(id); }, []);
  const due: PendingFollowUp | undefined = (pending.data ?? []).filter((f) => f.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt)[0];

  async function answer(r: Response) {
    if (!due) return;
    const step = await answerFollowUp(ctx.uid!, due, r, prefs.data?.quiet ?? null);
    setReply({ text: t(`h4.ci.after.${step.kind === 'rescreen' ? 'worse' : step.kind}` as Key), urgent: step.kind === 'rescreen' });
    await qc.invalidateQueries({ queryKey: ['followups'] });
    await qc.invalidateQueries({ queryKey: ['symptoms'] });
  }

  if (reply) {
    return (
      <>
        <Notice tone={reply.urgent ? 'urgent' : 'info'}>{reply.text}</Notice>
        {reply.urgent ? <Button title={t('h4.emergency.call')} variant="danger" onPress={() => { Linking.openURL('tel:112').catch(() => {}); }} /> : null}
      </>
    );
  }
  if (!due || prefs.data?.followups === false) return null;
  return (
    <Card style={{ borderWidth: 1, borderColor: colors.primary }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{t('h4.ci.fu.prompt', { symptom: t(`h4.ci.type.${due.type}` as Key).toLowerCase() })}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button title={t('h4.ci.r.better')} onPress={() => answer('better')} />
        <Button title={t('h4.ci.r.same')} variant="secondary" onPress={() => answer('same')} />
        <Button title={t('h4.ci.r.worse')} variant="secondary" onPress={() => answer('worse')} />
        <Button title={t('h4.ci.r.stop')} variant="link" onPress={() => answer('stop')} />
      </View>
    </Card>
  );
}

/** Raises one in-app / browser notification per follow-up when it becomes due (only while the app is open). Mounted once in the signed-in layout. */
export function FollowUpWatcher() {
  const t = useT();
  const ctx = useHealthContext();
  const pending = usePendingFollowUps(ctx.uid);
  const prefs = useNotifPrefs(ctx.uid);
  const told = useRef(new Set<string>());
  useEffect(() => {
    const id = setInterval(() => {
      if (prefs.data?.followups === false) return;
      for (const f of pending.data ?? []) {
        if (f.dueAt <= Date.now() && !told.current.has(f.id)) {
          told.current.add(f.id);
          showNotification(t('h4.ci.fu.prompt', { symptom: t(`h4.ci.type.${f.type}` as Key).toLowerCase() }), '');
        }
      }
    }, 15000);
    return () => clearInterval(id);
  }, [pending.data, prefs.data?.followups]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Past check-ins as a simple, private diary. */
export function CheckInHistory() {
  const t = useT();
  const ctx = useHealthContext();
  const logs = useSymptomLogs(ctx.uid, ctx.memberId);
  if (!logs.data?.length) return null;
  return (
    <Card>
      <H2>{t('h4.ci.history')}</H2>
      {logs.data.slice(0, 6).map((l) => (
        <View key={l.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.text, flex: 1 }}>{t(`h4.ci.type.${l.type}` as Key)} · {l.severity}/10 · {new Date(l.startedAt).toLocaleDateString()} {fmtMinute(new Date(l.startedAt).getHours() * 60 + new Date(l.startedAt).getMinutes())}</Text>
          <Badge label={t(`h4.ci.status.${l.status}` as Key)} />
        </View>
      ))}
      <Muted>{t('h4.ci.disclaimer')}</Muted>
    </Card>
  );
}

export function HistoryLink() {
  const t = useT();
  const router = useRouter();
  return <Button title={t('h4.sh.open')} variant="secondary" onPress={() => router.push('/symptoms')} />;
}
