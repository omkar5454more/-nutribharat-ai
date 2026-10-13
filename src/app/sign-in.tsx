import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, H1, Muted, Notice, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) setError(e.message === 'Invalid login credentials' ? 'Wrong email or password.' : e.message);
  }

  return (
    <Screen>
      <View style={{ height: 24 }} />
      <H1>NutriBharat AI</H1>
      <Muted>Eat smart. Stay fit. Live healthy.</Muted>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Sign in" onPress={submit} loading={busy} />
      <Link href="/forgot-password" style={{ color: '#16693A', fontWeight: '600', paddingVertical: 8 }}>Forgot password?</Link>
      <Link href="/sign-up" style={{ color: '#16693A', fontWeight: '600', paddingVertical: 8 }}>New here? Create an account</Link>
    </Screen>
  );
}
