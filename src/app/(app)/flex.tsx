import { FlexPlanner } from '@/components/FlexPlanner';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { H1, Screen } from '@/components/ui';
import { useT } from '@/i18n';

export default function Flex() {
  const t = useT();
  return (
    <Screen>
      <H1>{t('h4.flex.title')}</H1>
      <MemberSwitcher />
      <FlexPlanner />
    </Screen>
  );
}
