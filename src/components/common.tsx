import type { Note } from '@/core/types';
import { LANGS, useLang, useT, type Key } from '@/i18n';
import { Chips, Notice } from './ui';

export function LanguagePicker() {
  const { lang, setLang } = useLang();
  return <Chips value={lang} onChange={setLang} options={LANGS.map((l) => ({ value: l.code, label: l.label }))} />;
}

/** Safety notes from the goal calculator, in the user's language. */
export function Notes({ notes }: { notes: Note[] }) {
  const t = useT();
  return (
    <>
      {notes.map((n) => (
        <Notice key={n.code}>{t(`note.${n.code}` as Key, n.params)}</Notice>
      ))}
    </>
  );
}
