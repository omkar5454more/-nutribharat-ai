import { Link } from 'expo-router';
import { useState } from 'react';
import { AuthShell, PasswordField } from '@/components/AuthShell';
import { AuthTabs } from '@/components/AuthTabs';
import { Button, Field, Notice } from '@/components/ui';
import { useT } from '@/i18n';
import { appUrl } from '@/lib/pwa';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [sent, setSent] = useState('');

  async function submit() {
    setError('');
    if (!email.trim() || !password) return setError(t('auth.enterBoth'));
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) {
      const m = e.message.toLowerCase();
      setNeedsConfirm(m.includes('not confirmed'));
      setError(m.includes('invalid login') ? t('auth.wrongCreds') : m.includes('not confirmed') ? t('h4.auth.notConfirmed') : e.message);
    }
  }

  async function resend() {
    const { error: e } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: appUrl() } });
    setSent(e ? (e.message.toLowerCase().includes('rate') ? t('h4.auth.rate') : e.message) : t('h4.auth.resent'));
  }

  return (
    <AuthShell title={t('h4.auth.welcome')} subtitle={t('h4.auth.welcomeSub')}>
      <AuthTabs active="in" />
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <PasswordField label={t('auth.password')} value={password} onChangeText={setPassword} autoComplete="password" onSubmitEditing={submit} />
      {error ? <Notice>{error}</Notice> : null}
      {needsConfirm ? <Button title={t('h4.auth.resend')} variant="secondary" onPress={resend} /> : null}
      {sent ? <Notice tone="info">{sent}</Notice> : null}
      <Button title={t('auth.signIn')} onPress={submit} loading={busy} />
      <Link href="/forgot-password" style={{ color: '#16693A', fontWeight: '600', paddingVertical: 4, textAlign: 'center' }}>{t('auth.forgot')}</Link>
    </AuthShell>
  );
}
