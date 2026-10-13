import { Link } from 'expo-router';
import { useState } from 'react';
import { Button, Field, H1, Muted, Notice, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!email.trim()) return;
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    // same message whether or not the email exists, so accounts cannot be probed
    setMessage(t('auth.resetSent'));
  }

  return (
    <Screen>
      <H1>{t('auth.resetTitle')}</H1>
      <Muted>{t('auth.resetBody')}</Muted>
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {message ? <Notice tone="info">{message}</Notice> : null}
      <Button title={t('auth.sendReset')} onPress={submit} loading={busy} />
      <Link href="/sign-in" style={{ color: '#16693A', fontWeight: '600', paddingVertical: 8 }}>{t('auth.back')}</Link>
    </Screen>
  );
}
