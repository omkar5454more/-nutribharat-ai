import { Text } from 'react-native';
import { scanConsiderations, COOKING_OIL_G, type CookingMethod } from '@/core/health/scan';
import { FOOD_BY_ID } from '@/core/foods';
import { excludedByAllergies } from '@/core/planner';
import type { MealItem } from '@/core/types';
import { useFoodLabel, useT, type Key } from '@/i18n';
import { useHealthContext } from '@/lib/healthCtx';
import { colors } from '@/lib/theme';
import { useDraft } from '@/state/draft';
import { Card, Chips, H2, Muted, Notice } from './ui';
import { useState } from 'react';

/** Under a scanned meal: allergy warnings, notes tied to the person's own health settings, and a way to add the cooking oil a photo cannot show. */
export function ScanConsiderations({ items }: { items: MealItem[] }) {
  const t = useT();
  const label = useFoodLabel();
  const ctx = useHealthContext();
  const add = useDraft((s) => s.add);
  const [cooked, setCooked] = useState<CookingMethod | null>(null);
  const name = (id: string) => (FOOD_BY_ID[id] ? label(id, FOOD_BY_ID[id].name) : id);
  const allergyFoods = excludedByAllergies(ctx.profile?.allergies ?? []).foods;
  const c = scanConsiderations(items.map((i) => i.foodId), ctx.constraints, allergyFoods);

  function pick(m: CookingMethod) {
    if (cooked) return;                       // the oil estimate is added once; after that the person edits it like any other item
    setCooked(m);
    if (COOKING_OIL_G[m] > 0) add(FOOD_BY_ID['ghee-oil'], COOKING_OIL_G[m]);
  }

  const hasNotes = c.allergy.length || c.tags.length || c.alternatives.length;
  return (
    <>
      {c.allergy.map((id) => <Notice key={`a-${id}`} tone="urgent">{t('h4.scan.allergy', { food: name(id) })}</Notice>)}
      {hasNotes ? (
        <Card>
          <H2>{t('h4.scan.title')}</H2>
          {c.tags.map((x) => <Text key={`${x.foodId}-${x.tag}`} style={{ color: colors.text }}>• {t('h4.scan.tag', { food: name(x.foodId), tag: t(`h4.tag.${x.tag}` as Key) })}</Text>)}
          {c.alternatives.map((a) => <Muted key={a.foodId}>{t('h4.scan.alts', { food: name(a.foodId), list: a.options.map(name).join(', ') })}</Muted>)}
          <Muted>{t('h4.scan.caveat')}</Muted>
        </Card>
      ) : null}
      {items.some((i) => i.source === 'ai') ? (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.text }}>{t('h4.cook.title')}</Text>
          <Chips<CookingMethod | 'none'>
            value={cooked ?? 'none'}
            onChange={(v) => v !== 'none' && pick(v)}
            options={(['deep', 'shallow', 'roasted', 'boiled'] as const).map((m) => ({ value: m, label: t(`h4.cook.${m}` as Key) }))}
          />
          {cooked && COOKING_OIL_G[cooked] > 0 ? <Muted>{t('h4.cook.added')}</Muted> : null}
        </Card>
      ) : null}
    </>
  );
}
