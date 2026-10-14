import { Text, View } from 'react-native';
import { CONDITION_DEFS, CONDITION_IDS, RESTRICTIONS, type ConditionId, type HealthCondition, type HealthProfile } from '@/core/health/conditions';
import { useT, type Key } from '@/i18n';
import { colors, radius, space } from '@/lib/theme';
import { Chips, Field, MultiChips, Muted, Notice } from './ui';

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

const fresh = (id: ConditionId): HealthCondition => ({ id, status: 'diagnosed', restrictions: [], medicationFlags: [], symptoms: [], wantsAware: true });

/**
 * Private, optional health editor. The person picks conditions; for each one they say whether a doctor diagnosed it or they only suspect it.
 * Nothing is ever pre-selected or inferred.
 */
export function HealthEditor({ value, onChange }: { value: { conditions: HealthCondition[]; instructions: string[] }; onChange: (v: HealthProfile) => void }) {
  const t = useT();
  const has = (id: ConditionId) => value.conditions.some((c) => c.id === id);
  const set = (id: ConditionId, patch: Partial<HealthCondition>) => onChange({ ...value, conditions: value.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const flip = (id: ConditionId) => onChange({ ...value, conditions: has(id) ? value.conditions.filter((c) => c.id !== id) : [...value.conditions, fresh(id)] });

  return (
    <View style={{ gap: space.md }}>
      <Muted>{t('h4.cond.choose')}</Muted>
      <MultiChips options={CONDITION_IDS.map((id) => ({ value: id, label: t(`h4.cond.${id}` as Key) }))} values={value.conditions.map((c) => c.id)} onToggle={flip} />

      {value.conditions.map((c) => {
        const def = CONDITION_DEFS[c.id];
        return (
          <View key={c.id} style={{ backgroundColor: '#fff', borderRadius: radius.md, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>{t(`h4.cond.${c.id}` as Key)}</Text>
            {c.id === 'other' ? <Field label={t('h4.cond.otherLabel')} value={c.otherLabel ?? ''} maxLength={60} onChangeText={(v) => set(c.id, { otherLabel: v })} /> : null}
            <Text style={{ fontWeight: '600', color: colors.text }}>{t('h4.status.label')}</Text>
            <Chips value={c.status} onChange={(v) => set(c.id, { status: v })} options={[{ value: 'diagnosed', label: t('h4.status.diagnosed') }, { value: 'concern', label: t('h4.status.concern') }]} />
            {c.status === 'concern' ? (
              <Notice tone="info">{t('h4.concern.note')}</Notice>
            ) : (
              <>
                <MultiChips options={[{ value: 'aware', label: t('h4.aware') }]} values={c.wantsAware ? ['aware'] : []} onToggle={() => set(c.id, { wantsAware: !c.wantsAware })} />
                <Text style={{ fontWeight: '600', color: colors.text }}>{t('h4.restrictions')}</Text>
                <MultiChips options={RESTRICTIONS.map((r) => ({ value: r, label: t(`h4.restr.${r}` as Key) }))} values={c.restrictions} onToggle={(r) => set(c.id, { restrictions: toggle(c.restrictions, r) })} />
                {def.medicationFlags.length ? (
                  <>
                    <Text style={{ fontWeight: '600', color: colors.text }}>{t('h4.meds')}</Text>
                    <MultiChips options={def.medicationFlags.map((m) => ({ value: m, label: t(`h4.med.${m}` as Key) }))} values={c.medicationFlags} onToggle={(m) => set(c.id, { medicationFlags: toggle(c.medicationFlags, m) })} />
                    <Muted>{t('h4.meds.note')}</Muted>
                  </>
                ) : null}
                {def.symptoms.length ? (
                  <>
                    <Text style={{ fontWeight: '600', color: colors.text }}>{t('h4.symptoms')}</Text>
                    <MultiChips options={def.symptoms.map((s) => ({ value: s, label: t(`h4.sym.${s}` as Key) }))} values={c.symptoms} onToggle={(s) => set(c.id, { symptoms: toggle(c.symptoms, s) })} />
                  </>
                ) : null}
              </>
            )}
          </View>
        );
      })}

      <Field
        label={t('h4.instructions')}
        multiline
        numberOfLines={3}
        value={value.instructions.join('\n')}
        onChangeText={(v) => onChange({ ...value, instructions: v.split('\n').map((l) => l.slice(0, 500)).slice(0, 10) })}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
      <Muted>{t('h4.instructions.hint')}</Muted>
    </View>
  );
}
