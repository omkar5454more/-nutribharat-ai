import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ProfileForm } from '@/components/ProfileForm';
import { Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { useProfile } from '@/lib/data';
import { useSession } from '@/state/session';

export default function EditProfile() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const profile = useProfile(session?.user.id).data;
  return (
    <Screen>
      <ProfileForm
        userId={session!.user.id}
        initial={profile}
        submitLabel={t('common.save')}
        onSaved={async () => {
          await qc.invalidateQueries({ queryKey: ['profile'] });
          router.back();
        }}
      />
    </Screen>
  );
}
