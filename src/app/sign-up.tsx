import { Link } from 'expo-router';
import { useState } from 'react';
import { Button, Field, H1, Muted, Notice, Screen } from '@/components/ui';
import { useT } from '@/i18n';
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
    const { data, error } = await supabase.auth.signUp({ email: mail, password });
    setBusy(false);
    if (error) return setErrors({ form: error.message });
    // With email confirmation switched on in Supabase there is no session until the user clicks the link.
    if (!data.session) setMessage(t('auth.checkEmail'));
  }

  return (
    <Screen>
      <H1>{t('auth.createTitle')}</H1>
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} />
      <Field label={t('auth.confirm')} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" error={errors.confirm} />
      <Muted>{t('auth.disclaimer')}</Muted>
      {errors.form ? <Notice>{errors.form}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}
      <Button title={t('auth.createAccount')} onPress={submit} loading={busy} />
      <Link href="/sign-in" style={{ color: '#16693A', fontWeight: '600', paddingVertical: 8 }}>{t('auth.haveAccount')}</Link>
    </Screen>
  );
}
