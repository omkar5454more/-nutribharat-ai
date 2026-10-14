import { useEffect, useState } from 'react';
import { fmtMinute, parseTime } from '@/core/routine';
import { useT } from '@/i18n';
import { Field } from './ui';

/** HH:MM text box that reports minutes since midnight (or null when empty and `optional`). Shows an error until the text is a valid time. */
export function TimeField({ label, value, onChange, optional = false }: { label: string; value: number | null; onChange: (m: number | null) => void; optional?: boolean }) {
  const t = useT();
  const [text, setText] = useState(value === null ? '' : fmtMinute(value));
  useEffect(() => {
    setText((cur) => (parseTime(cur) === value || (value === null && cur.trim() === '') ? cur : value === null ? '' : fmtMinute(value)));
  }, [value]);
  const invalid = text.trim() !== '' && parseTime(text) === null;
  return (
    <Field
      label={label}
      value={text}
      placeholder="HH:MM"
      keyboardType="numbers-and-punctuation"
      error={invalid ? t('h4.rt.timeBad') : undefined}
      onChangeText={(v) => {
        setText(v);
        const m = parseTime(v);
        if (m !== null) onChange(m);
        else if (v.trim() === '' && optional) onChange(null);
      }}
    />
  );
}
