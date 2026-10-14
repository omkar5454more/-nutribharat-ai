import { Link } from 'expo-router';
import { useState } from 'react';
import { AuthShell, PasswordField, StrengthMeter } from '@/components/AuthShell';
import { Button, Field, Muted, Notice } from '@/components/ui';
import { useT } from '@/i18n';
import { appUrl } from '@/lib/pwa';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    setMessage('');
    const errs: Record<string, string> = {};
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) errs.email = t('auth.invalidEmail');
    if (password.length < 8) errs.password = t('auth.pwShort');
    if (password !== confirm) errs.confirm = t('auth.pwMismatch');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { emailRedirectTo: appUrl() } });
    setBusy(false);
    if (error) return setErrors({ form: error.message });
    // With email confirmation switched on in Supabase there is no session until the user clicks the link.
    if (!data.session) setMessage(t('auth.checkEmail'));
  }

  return (
    <AuthShell title={t('h4.auth.join')} subtitle={t('h4.auth.joinSub')}>
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
      <PasswordField label={t('auth.password')} value={password} onChangeText={setPassword} autoComplete="new-password" error={errors.password} />
      <StrengthMeter password={password} />
      <PasswordField label={t('auth.confirm')} value={confirm} onChangeText={setConfirm} autoComplete="new-password" error={errors.confirm} />
      <Muted>{t('auth.disclaimer')}</Muted>
      {errors.form ? <Notice>{errors.form}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}
      <Button title={t('auth.createAccount')} onPress={submit} loading={busy} />
      <Link href="/sign-in" style={{ color: '#16693A', fontWeight: '700', paddingVertical: 4, textAlign: 'center' }}>{t('auth.haveAccount')}</Link>
    </AuthShell>
  );
}
