/**
 * Menstrual-cycle diary maths. Everything is an ESTIMATE from the person's own entries and never a diagnosis or a fertility prediction.
 * Irregular or very long/short cycles only produce a gentle "worth mentioning to a doctor" note.
 */
export type CycleEntry = { start: string; end?: string | null; flow?: 'light' | 'medium' | 'heavy' | null; pain?: number | null };

const DAY = 86400000;
const t = (d: string) => new Date(`${d}T00:00:00`).getTime();
export const addDays = (d: string, n: number) => { const x = new Date(t(d) + n * DAY); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const daysBetween = (a: string, b: string) => Math.round((t(b) - t(a)) / DAY);

export type CycleSummary = {
  cycles: number;
  /** average days from one period start to the next, from gaps of 15–90 days only */
  avgLength: number | null;
  /** longest minus shortest gap */
  spread: number | null;
  avgPeriodDays: number | null;
  avgPain: number | null;
  /** rough window for the next period start (needs 3+ recorded cycle gaps ≥ 2 entries) */
  nextWindow: { from: string; to: string } | null;
  note: 'need_more' | 'ok' | 'irregular' | 'long_gap' | 'short_or_long_average';
};

export function summarizeCycles(entries: CycleEntry[], today: string): CycleSummary {
  const e = [...entries].sort((a, b) => a.start.localeCompare(b.start));
  const gaps: number[] = [];
  for (let i = 1; i < e.length; i++) {
    const g = daysBetween(e[i - 1].start, e[i].start);
    if (g >= 15 && g <= 90) gaps.push(g);
  }
  const avg = gaps.length >= 2 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;   // needs 3 periods (2 gaps) before an average means anything
  const spread = gaps.length >= 2 ? Math.max(...gaps) - Math.min(...gaps) : null;
  const lens = e.filter((x) => x.end).map((x) => daysBetween(x.start, x.end!) + 1).filter((n) => n >= 1 && n <= 14);
  const pains = e.map((x) => x.pain).filter((p): p is number => typeof p === 'number');
  const last = e[e.length - 1];
  const sinceLast = last ? daysBetween(last.start, today) : 0;
  let note: CycleSummary['note'] = 'ok';
  if (gaps.length < 2) note = 'need_more';
  else if (spread !== null && spread > 9) note = 'irregular';
  else if (avg !== null && (avg < 21 || avg > 38)) note = 'short_or_long_average';
  if (last && sinceLast > 90) note = 'long_gap';
  const nextWindow = avg !== null && gaps.length >= 2 && last ? { from: addDays(last.start, Math.round(avg - Math.max(2, (spread ?? 4) / 2))), to: addDays(last.start, Math.round(avg + Math.max(2, (spread ?? 4) / 2))) } : null;
  return {
    cycles: e.length, avgLength: avg === null ? null : Math.round(avg), spread,
    avgPeriodDays: lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : null,
    avgPain: pains.length ? Math.round((pains.reduce((a, b) => a + b, 0) / pains.length) * 10) / 10 : null,
    nextWindow, note,
  };
}

/** Days until the estimated window opens (negative = already inside or past it). Null without an estimate. */
export function daysToWindow(s: CycleSummary, today: string): number | null {
  return s.nextWindow ? daysBetween(today, s.nextWindow.from) : null;
}
