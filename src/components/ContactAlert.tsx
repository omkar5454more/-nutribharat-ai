import { useRouter } from 'expo-router';
import { Linking, View } from 'react-native';
import { alertText, smsUrl, type AlertKind } from '@/core/contacts';
import { useLang, useT } from '@/i18n';
import { useActive } from '@/lib/active';
import { useContacts } from '@/lib/health';
import { Button } from './ui';

/**
 * "Alert my care contact": opens the phone's SMS app with a short pre-written message for each saved contact (the person taps Send).
 * Without a contact it offers to add one. The message holds only names, never health details.
 */
export function ContactAlert({ kind = 'emergency' }: { kind?: AlertKind }) {
  const t = useT();
  const router = useRouter();
  const lang = useLang((s) => s.lang);
  const { uid, memberId, profile } = useActive();
  const contacts = useContacts(uid, memberId);
  const l = (lang === 'hi' || lang === 'mr' ? lang : 'en') as 'en' | 'hi' | 'mr';
  const first = (profile?.display_name ?? '').trim().split(/\s+/)[0] ?? '';
  const list = (contacts.data ?? []).filter((c) => (kind === 'worse' ? c.alertWorse : c.alertEmergency));
  if (contacts.isLoading) return null;
  if (!list.length) return <Button title={t('h4.ct.alertNone')} variant="secondary" onPress={() => router.push('/contacts')} />;
  return (
    <View style={{ gap: 8 }}>
      {list.slice(0, 3).map((c) => (
        <Button key={c.id} title={t('h4.ct.alert', { name: c.name })} variant="danger" onPress={() => { Linking.openURL(smsUrl(c.phone, alertText(kind, l, first, c.name))).catch(() => {}); }} />
      ))}
    </View>
  );
}
