import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { HealthProfile } from '@/core/health/conditions';
import { buildConstraints } from '@/core/health/safety';
import { useT } from '@/i18n';
import { logSafetyEvent, saveHealth, setConsent, type Purpose } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { HealthEditor } from './HealthEditor';
import { HealthNotes } from './HealthNotes';
import { Button, Card, H2, MultiChips, Muted, Notice } from './ui';

/** Consent + health editor + save. Used in the setup wizard and in Health & privacy. `onSaved` runs after a successful save. */
export function HealthSetup({ onSaved, saveLabel }: { onSaved?: () => void; saveLabel?: string }) {
  const t = useT();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const [draft, setDraft] = useState<HealthProfile>({ conditions: [], instructions: [] });
  const loaded = useRef('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const who = `${ctx.uid}:${ctx.memberId}`;

  // load what is stored once per person
  useEffect(() => {
    if (!ctx.loading && loaded.current !== who) {
      loaded.current = who;
      setDraft(ctx.stored);
    }
  }, [ctx.loading, ctx.stored, who]);

  async function toggleConsent(purpose: Purpose, on: boolean) {
    setMsg(null);
    try {
      await setConsent(ctx.uid!, ctx.memberId, purpose, on);
      await qc.invalidateQueries({ queryKey: ['consents'] });
      if (purpose === 'condition_tracking' && !on) setMsg({ tone: 'info', text: t('h4.consent.withdrawn') });
    } catch {
      setMsg({ tone: 'warn', text: t('h4.fail') });
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await saveHealth(ctx.uid!, ctx.memberId, draft);
      const rules = buildConstraints(draft);
      for (const c of rules.conflicts) await logSafetyEvent(ctx.uid!, ctx.memberId, 'conflict_detected', 'info', { code: c.code, between: c.between });
      if (rules.active.length >= 2) await logSafetyEvent(ctx.uid!, ctx.memberId, 'conservative_default', 'info', { conditions: rules.active.length });
      await qc.invalidateQueries({ queryKey: ['health'] });
      setMsg({ tone: 'info', text: t('h4.saved') });
      onSaved?.();
    } catch {
      setMsg({ tone: 'warn', text: t('h4.fail') });
    } finally {
      setBusy(false);
    }
  }

  const consented = ctx.consents.condition_tracking;
  return (
    <View style={{ gap: 12 }}>
      <Muted>{t('h4.health.intro')}</Muted>
      <Card>
        <H2>{t('h4.consent.what')}</H2>
        <Muted>{t('h4.consent.body')}</Muted>
        <MultiChips
          options={[{ value: 'condition_tracking', label: t('h4.consent.track') }]}
          values={consented ? ['condition_tracking'] : []}
          onToggle={() => toggleConsent('condition_tracking', !consented)}
        />
        <MultiChips
          options={[{ value: 'ai_processing', label: t('h4.consent.ai') }]}
          values={ctx.consents.ai_processing ? ['ai_processing'] : []}
          onToggle={() => toggleConsent('ai_processing', !ctx.consents.ai_processing)}
        />
        <Muted>{t('h4.privacy.draft')}</Muted>
      </Card>

      {!consented ? <Muted>{t('h4.consent.needed')}</Muted> : (
        <>
          <HealthEditor value={draft} onChange={setDraft} />
          <HealthNotes constraints={buildConstraints(draft)} />
          <Button title={saveLabel ?? t('h4.save')} onPress={save} loading={busy} />
        </>
      )}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </View>
  );
}
