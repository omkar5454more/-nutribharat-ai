import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT, type Key } from '@/i18n';
import { answerFollowUp, useNotifPrefs, usePendingFollowUps } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { useComfort } from '@/state/comfort';
import type { Response } from '@/core/health/symptoms';

// A deliberately plain, low-brightness screen: no gradients, no motion, big tap targets, one obvious way out.
const BG = '#1B1F1C', CARD = '#262B27', TEXT = '#D9E2DA', SOFT = '#A9B5AB';

function Big({ label, onPress, tone = 'card' }: { label: string; onPress: () => void; tone?: 'card' | 'quiet' }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ minHeight: 64, borderRadius: 16, backgroundColor: tone === 'card' ? CARD : 'transparent', borderWidth: tone === 'card' ? 0 : 1, borderColor: '#3A413B', justifyContent: 'center', paddingHorizontal: 20 }}>
      <Text style={{ color: TEXT, fontSize: 20, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export default function Comfort() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const exit = useComfort((s) => s.exit);
  const ctx = useHealthContext();
  const pending = usePendingFollowUps(ctx.uid);
  const prefs = useNotifPrefs(ctx.uid);
  const [reply, setReply] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(id); }, []);
  const due = (pending.data ?? []).filter((f) => f.dueAt <= now)[0];

  const leave = () => { exit(); router.back(); };
  async function answer(r: Response) {
    if (!due) return;
    const step = await answerFollowUp(ctx.uid!, due, r, prefs.data?.quiet ?? null);
    setReply(t(`h4.ci.after.${step.kind === 'rescreen' ? 'worse' : step.kind}` as Key));
    await qc.invalidateQueries({ queryKey: ['followups'] });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ flex: 1, padding: 24, gap: 16 }}>
        <Text style={{ color: TEXT, fontSize: 28, fontWeight: '700' }} accessibilityRole="header">{t('h4.comfort.title')}</Text>
        <Text style={{ color: SOFT, fontSize: 16, lineHeight: 24 }}>{t('h4.comfort.body')}</Text>
        {due ? <Text style={{ color: TEXT, fontSize: 20, lineHeight: 28 }}>{t('h4.ci.fu.prompt', { symptom: t(`h4.ci.type.${due.type}` as Key).toLowerCase() })}</Text> : null}
        {due ? (
          <>
            <Big label={t('h4.ci.r.better')} onPress={() => answer('better')} />
            <Big label={t('h4.ci.r.same')} onPress={() => answer('same')} />
            <Big label={t('h4.ci.r.worse')} onPress={() => answer('worse')} />
            <Big label={t('h4.ci.r.stop')} tone="quiet" onPress={() => answer('stop')} />
          </>
        ) : null}
        {reply ? <Text style={{ color: TEXT, fontSize: 18, lineHeight: 26 }}>{reply}</Text> : null}
        <View style={{ flex: 1 }} />
        <Big label={t('h4.comfort.log')} onPress={() => router.push({ pathname: '/check-in', params: { type: 'headache' } })} />
        <Big label={t('h4.comfort.exit')} tone="quiet" onPress={leave} />
      </View>
    </SafeAreaView>
  );
}
