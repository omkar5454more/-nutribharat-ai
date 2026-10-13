import { Link } from 'expo-router';
import { useState } from 'react';
import { Button, Field, H1, Muted, Notice, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!email.trim()) return;
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    // same message whether or not the email exists, so accounts cannot be probed
    setMessage('If that email has an account, a reset link is on its way.');
  }

  return (
    <Screen>
      <H1>Reset password</H1>
      <Muted>Enter your email and we will send you a reset link.</Muted>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {message ? <Notice tone="info">{message}</Notice> : null}
      <Button title="Send reset link" onPress={submit} loading={busy} />
      <Link href="/sign-in" style={{ color: '#16693A', fontWeight: '600', paddingVertical: 8 }}>Back to sign in</Link>
    </Screen>
  );
}
