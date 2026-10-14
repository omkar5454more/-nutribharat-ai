import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { Muted, Notice } from '@/components/ui';
import { useLang, useT, type Key } from '@/i18n';
import { useActive } from '@/lib/active';
import { askAssistant, startOfDay, targetsFor, totalsOf, useMeals, type ChatMessage } from '@/lib/data';
import { colors, radius } from '@/lib/theme';
import { aiHealthSummary } from '@/core/health/aiSummary';
import { checkRequest, detectRedFlags } from '@/core/health/safety';
import { logSafetyEvent } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { Linking } from 'react-native';
import { Button } from '@/components/ui';

const MAX_LEN = 1000;

export default function Chat() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const { uid, memberId, profile } = useActive();
  const health = useHealthContext();
  const [emergency, setEmergency] = useState(false);
  const targets = targetsFor(profile);
  const from = startOfDay();
  const meals = useMeals(uid, memberId, from, new Date(from.getTime() + 24 * 3600 * 1000));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef<ScrollView>(null);

  async function send(raw: string) {
    const content = raw.trim().slice(0, MAX_LEN);
    if (!content || busy) return;
    setError('');
    setText('');
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setEmergency(false);
    // safety first, on the device, before anything is sent: emergencies and unsafe requests never reach the AI
    const flag = detectRedFlags(content);
    if (flag.urgent) {
      setMessages([...next, { role: 'assistant', content: t(flag.code === 'self_harm' ? 'h4.emergency.selfharm' : 'h4.emergency.symptom') }]);
      setEmergency(true);
      logSafetyEvent(uid!, memberId, 'red_flag_symptom', 'urgent', { code: flag.code });
      return;
    }
    const req = checkRequest(content);
    if (req.blocked) {
      setMessages([...next, { role: 'assistant', content: t(`h4.blocked.${req.code}` as Key) }]);
      logSafetyEvent(uid!, memberId, req.code === 'medication_boundary' ? 'medication_boundary' : 'blocked_request', 'warning', { code: req.code });
      return;
    }
    setBusy(true);
    const eaten = totalsOf(meals.data ?? []);
    try {
      // only what the assistant needs: no name, email or exact age is sent
      const reply = await askAssistant(
        next.slice(-12),
        {
          goal: profile.goal, diet: profile.diet, allergies: profile.allergies, reproductive: profile.reproductive, age_band: 'adult',
          kcal_target: targets.kcal, kcal_eaten: eaten.kcal, protein_target: targets.protein_g, protein_eaten: Math.round(eaten.protein_g),
        },
        lang,
        aiHealthSummary(health.health, health.consents.ai_processing && health.consents.condition_tracking)
      );
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e instanceof Error && e.message && e.message !== 'unavailable' ? e.message : t('chat.error'));
    } finally {
      setBusy(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }} accessibilityRole="header">{t('chat.title')}</Text>
          <MemberSwitcher />
          {messages.length === 0 ? (
            <>
              <Muted>{t('chat.empty')}</Muted>
              {(['chat.s1', 'chat.s2', 'chat.s3', 'chat.s4'] as Key[]).map((k) => (
                <Pressable key={k} onPress={() => send(t(k))} accessibilityRole="button" style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
                  <Text style={{ color: colors.primaryDark, fontWeight: '600' }}>{t(k)}</Text>
                </Pressable>
              ))}
            </>
          ) : null}
          {messages.map((m, i) => (
            <View
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: 12, borderRadius: radius.md,
                backgroundColor: m.role === 'user' ? colors.primary : '#fff', borderWidth: m.role === 'user' ? 0 : 1, borderColor: colors.border,
              }}
            >
              <Text selectable style={{ color: m.role === 'user' ? '#fff' : colors.text, lineHeight: 22 }}>{m.content}</Text>
            </View>
          ))}
          {busy ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
              <Muted>{t('chat.thinking')}</Muted>
            </View>
          ) : null}
          {emergency ? <Button title={t('h4.emergency.call')} variant="danger" onPress={() => { Linking.openURL('tel:112').catch(() => {}); }} /> : null}
          {health.consents.ai_processing && health.consents.condition_tracking && health.health.conditions.length ? <Muted style={{ fontSize: 12 }}>{t('h4.chat.sharing')}</Muted> : null}
          {error ? <Notice>{error}</Notice> : null}
          <Muted style={{ fontSize: 12 }}>{t('chat.disclaimer')}</Muted>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#fff' }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('chat.placeholder')}
            maxLength={MAX_LEN}
            multiline
            onSubmitEditing={() => send(text)}
            style={{ flex: 1, minHeight: 46, maxHeight: 110, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text }}
          />
          <Pressable
            onPress={() => send(text)}
            disabled={busy || !text.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
            style={{ minHeight: 46, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', opacity: busy || !text.trim() ? 0.5 : 1 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t('chat.send')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
