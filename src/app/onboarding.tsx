import { useQueryClient } from '@tanstack/react-query';
import { LanguagePicker } from '@/components/common';
import { ProfileForm } from '@/components/ProfileForm';
import { H1, Muted, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { useSetupPending } from '@/state/setup';

export default function Onboarding() {
  const t = useT();
  const { session } = useSession();
  const qc = useQueryClient();
  return (
    <Screen>
      <H1>{t('onb.title')}</H1>
      <LanguagePicker />
      <Muted>{t('onb.body')}</Muted>
      <ProfileForm userId={session!.user.id} submitLabel={t('onb.continue')} onSaved={() => { useSetupPending.getState().set(true); qc.invalidateQueries({ queryKey: ['profile'] }); }} />
    </Screen>
  );
}
