import { useActiveMember } from '@/state/active';
import { useSession } from '@/state/session';
import { useMembers, useProfile, type MemberRow, type ProfileRow } from './data';

/**
 * Everything a screen needs to know about "who am I looking at": the signed-in user, the active person (me or a family member),
 * their profile, and the list of family members. Falls back to "me" if the selected member no longer exists.
 */
export function useActive() {
  const { session } = useSession();
  const uid = session?.user.id;
  const own = useProfile(uid);
  const members = useMembers(uid);
  const selected = useActiveMember((s) => s.memberId);
  const member: MemberRow | undefined = selected ? members.data?.find((m) => m.id === selected) : undefined;
  const profile = (member ?? own.data) as ProfileRow;
  return {
    uid,
    memberId: member ? member.id : null,
    isSelf: !member,
    profile,
    ownProfile: own.data as ProfileRow,
    members: members.data ?? [],
    /** name to show for the active person (empty for me) */
    activeName: member ? member.display_name : '',
  };
}
