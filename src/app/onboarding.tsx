import { useQueryClient } from '@tanstack/react-query';
import { ProfileForm } from '@/components/ProfileForm';
import { H1, Muted, Screen } from '@/components/ui';
import { useSession } from '@/state/session';

export default function Onboarding() {
  const { session } = useSession();
  const qc = useQueryClient();
  return (
    <Screen>
      <H1>Tell us about you</H1>
      <Muted>This sets your daily calorie and protein targets. You can change it any time, and you can delete all your data from the Profile tab.</Muted>
      <ProfileForm userId={session!.user.id} submitLabel="Save and continue" onSaved={() => qc.invalidateQueries({ queryKey: ['profile'] })} />
    </Screen>
  );
}
