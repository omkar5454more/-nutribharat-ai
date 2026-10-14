import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, daysToWindow, summarizeCycles } from './cycle';

const starts = (...d: string[]) => d.map((start) => ({ start }));

describe('dates', () => {
  it('adds and counts days across month ends', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(daysBetween('2026-10-01', '2026-10-29')).toBe(28);
  });
});

describe('summarizeCycles', () => {
  it('needs at least two gaps before saying anything about length', () => {
    const s = summarizeCycles(starts('2026-08-01', '2026-08-29'), '2026-09-05');
    expect(s.note).toBe('need_more');
    expect(s.nextWindow).toBeNull();
  });
  it('regular cycles give an average and a rough window', () => {
    const s = summarizeCycles(starts('2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23'), '2026-10-01');
    expect(s.avgLength).toBe(28);
    expect(s.note).toBe('ok');
    expect(s.nextWindow).toEqual({ from: '2026-10-19', to: '2026-10-23' });
    expect(daysToWindow(s, '2026-10-01')).toBe(18);
  });
  it('very different gaps are called irregular, gently', () => {
    expect(summarizeCycles(starts('2026-05-01', '2026-05-26', '2026-07-10', '2026-08-04'), '2026-08-10').note).toBe('irregular');
  });
  it('an average outside 21–38 days is flagged for a doctor conversation, not diagnosed', () => {
    expect(summarizeCycles(starts('2026-01-01', '2026-02-15', '2026-04-01', '2026-05-16'), '2026-05-20').note).toBe('short_or_long_average');
  });
  it('no period for over 90 days is flagged', () => {
    expect(summarizeCycles(starts('2026-01-01', '2026-01-29', '2026-02-26'), '2026-07-01').note).toBe('long_gap');
  });
  it('ignores gaps that are really missed entries (outside 15–90 days)', () => {
    const s = summarizeCycles(starts('2026-01-01', '2026-01-05', '2026-02-02', '2026-03-02'), '2026-03-10');
    expect(s.avgLength).toBe(28);
  });
  it('period length and pain averages come only from what was entered', () => {
    const s = summarizeCycles([{ start: '2026-08-01', end: '2026-08-05', pain: 4 }, { start: '2026-08-29', end: '2026-09-02', pain: 2 }, { start: '2026-09-26' }], '2026-10-01');
    expect(s.avgPeriodDays).toBe(5);
    expect(s.avgPain).toBe(3);
  });
  it('no entries is handled', () => {
    const s = summarizeCycles([], '2026-10-01');
    expect(s).toMatchObject({ cycles: 0, avgLength: null, nextWindow: null, note: 'need_more' });
  });
});
