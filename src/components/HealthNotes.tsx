import { Text } from 'react-native';
import type { Constraints } from '@/core/health/safety';
import { useT, type Key } from '@/i18n';
import { colors } from '@/lib/theme';
import { Card, Notice } from './ui';

/** Gentle, plain-language notes that come from the person's own health settings. Clinician notes are shown first, exactly as entered. */
export function HealthNotes({ constraints, compact = false }: { constraints: Constraints; compact?: boolean }) {
  const t = useT();
  const notes = compact ? constraints.notes.filter((n) => ['clinician_first', 'combined_plan', 'medication_boundary', 'fluid_clinician'].includes(n.code)) : constraints.notes;
  if (!constraints.notes.length && !constraints.instructions.length && !constraints.conflicts.length) return null;
  return (
    <>
      {constraints.instructions.length ? (
        <Card>
          <Text style={{ fontWeight: '800', color: colors.text }}>{t('h4.instructions.yours')}</Text>
          {constraints.instructions.map((line, i) => <Text key={i} style={{ color: colors.text }}>• {line}</Text>)}
        </Card>
      ) : null}
      {constraints.conflicts.map((c) => <Notice key={c.code} tone="info">{t(`h4.conflict.${c.code}` as Key)}</Notice>)}
      {notes.map((n) => <Notice key={n.code} tone={n.code === 'clinician_first' || n.code === 'medication_boundary' ? 'info' : 'info'}>{t(`h4.note.${n.code}` as Key)}</Notice>)}
    </>
  );
}
