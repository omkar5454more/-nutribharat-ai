import { Link } from 'expo-router';
import { useState } from 'react';
import { AuthShell, PasswordField } from '@/components/AuthShell';
import { Button, Field, Notice } from '@/components/ui';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!email.trim() || !password) return setError(t('auth.enterBoth'));
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) setError(e.message === 'Invalid login credentials' ? t('auth.wrongCreds') : e.message);
  }

  return (
    <AuthShell title={t('h4.auth.welcome')} subtitle={t('h4.auth.welcomeSub')}>
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <PasswordField label={t('auth.password')} value={password} onChangeText={setPassword} autoComplete="password" onSubmitEditing={submit} />
      {error ? <Notice>{error}</Notice> : null}
      <Button title={t('auth.signIn')} onPress={submit} loading={busy} />
      <Link href="/forgot-password" style={{ color: '#16693A', fontWeight: '600', paddingVertical: 4, textAlign: 'center' }}>{t('auth.forgot')}</Link>
      <Link href="/sign-up" style={{ color: '#16693A', fontWeight: '700', paddingVertical: 4, textAlign: 'center' }}>{t('auth.newHere')}</Link>
    </AuthShell>
  );
}
