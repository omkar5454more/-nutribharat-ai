import { HealthSetup } from '@/components/HealthSetup';
import { PrivacyCard, ReadingsCard, TriggerCard } from '@/components/HealthTools';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { H1, Screen } from '@/components/ui';
import { useT } from '@/i18n';

export default function Health() {
  const t = useT();
  return (
    <Screen>
      <H1>{t('h4.health.title')}</H1>
      <MemberSwitcher />
      <HealthSetup />
      <ReadingsCard />
      <TriggerCard />
      <PrivacyCard />
    </Screen>
  );
}
