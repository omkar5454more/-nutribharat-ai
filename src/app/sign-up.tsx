import { Link } from 'expo-router';
import { useState } from 'react';
import { z } from 'zod';
import { Button, Field, H1, Muted, Notice, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const Schema = z
  .object({
    email: z.string().trim().email('Enter a valid email.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' });

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    setMessage('');
    const r = Schema.safeParse({ email, password, confirm });
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: r.data.email, password: r.data.password });
    setBusy(false);
    if (error) return setErrors({ form: error.message });
    // With email confirmation switched on in Supabase there is no session until the user clicks the link.
    if (!data.session) setMessage('Check your email and tap the confirmation link, then sign in.');
  }

  return (
    <Screen>
      <H1>Create your account</H1>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} />
      <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" error={errors.confirm} />
      <Muted>
        NutriBharat AI gives general food and wellness guidance. It is not medical advice and does not diagnose or treat any condition.
      </Muted>
      {errors.form ? <Notice>{errors.form}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}
      <Button title="Create account" onPress={submit} loading={busy} />
      <Link href="/sign-in" style={{ color: '#16693A', fontWeight: '600', paddingVertical: 8 }}>I already have an account</Link>
    </Screen>
  );
}
