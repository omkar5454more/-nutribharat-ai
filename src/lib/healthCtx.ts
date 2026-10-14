import { useMemo } from 'react';
import { EMPTY_HEALTH, type HealthProfile } from '@/core/health/conditions';
import { buildConstraints, type Constraints } from '@/core/health/safety';
import { useActive } from './active';
import { healthOrEmpty, medsFrom, useConsents, useHealth, useReminders, useRoutinePrefs } from './health';

/**
 * Everything the screens need about the active person's health picture.
 * Saved health information is used for coaching ONLY while 'condition_tracking' consent is active: withdrawing consent switches every health rule off.
 */
export function useHealthContext() {
  const a = useActive();
  const consents = useConsents(a.uid, a.memberId);
  const health = useHealth(a.uid, a.memberId);
  const prefs = useRoutinePrefs(a.uid, a.memberId);
  const reminders = useReminders(a.uid, a.memberId);
  const consented = !!consents.data?.condition_tracking;
  const profile: HealthProfile = consented ? healthOrEmpty(health.data) : EMPTY_HEALTH;
  const constraints: Constraints = useMemo(() => buildConstraints(profile), [consented, health.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ...a,
    consents: consents.data ?? { condition_tracking: false, coaching: false, ai_processing: false },
    consentsLoading: consents.isLoading,
    stored: healthOrEmpty(health.data),
    health: profile,
    constraints,
    prefs: prefs.data,
    meds: medsFrom(reminders.data ?? []),
    reminders: reminders.data ?? [],
    loading: consents.isLoading || health.isLoading || prefs.isLoading,
  };
}
