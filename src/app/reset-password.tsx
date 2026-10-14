import { useState } from 'react';
import { Button, Field, H1, Muted, Notice, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';

/** Opened from the "reset password" email link (the app is in recovery mode until a new password is saved). */
export default function ResetPassword() {
  const t = useT();
  const { endRecovery } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const errs: Record<string, string> = {};
    if (password.length < 8) errs.password = t('auth.pwShort');
    if (password !== confirm) errs.confirm = t('auth.pwMismatch');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErrors({ form: t('rec.fail') });
    endRecovery();
  }

  return (
    <Screen>
      <H1>{t('rec.title')}</H1>
      <Muted>{t('rec.body')}</Muted>
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} />
      <Field label={t('auth.confirm')} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" error={errors.confirm} onSubmitEditing={submit} />
      {errors.form ? <Notice>{errors.form}</Notice> : null}
      <Button title={t('rec.save')} onPress={submit} loading={busy} />
      <Button title={t('rec.skip')} variant="link" onPress={async () => { await supabase.auth.signOut(); endRecovery(); }} />
    </Screen>
  );
}
