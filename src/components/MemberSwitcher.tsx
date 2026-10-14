import { useRouter } from 'expo-router';
import { useT } from '@/i18n';
import { useActive } from '@/lib/active';
import { useActiveMember } from '@/state/active';
import { Button, Chips } from './ui';

/** "Whose data is this?" — shown on the main tabs once the account has at least one family member. */
export function MemberSwitcher() {
  const t = useT();
  const { members, memberId } = useActive();
  const setMemberId = useActiveMember((s) => s.setMemberId);
  if (!members.length) return null;
  return (
    <Chips
      value={memberId ?? 'me'}
      onChange={(v) => setMemberId(v === 'me' ? null : v)}
      options={[{ value: 'me', label: t('fam.me') }, ...members.map((m) => ({ value: m.id, label: m.display_name }))]}
    />
  );
}

export function FamilyLink() {
  const t = useT();
  const router = useRouter();
  return <Button title={t('fam.manage')} variant="secondary" onPress={() => router.push('/family')} />;
}
