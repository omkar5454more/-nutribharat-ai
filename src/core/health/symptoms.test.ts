import { describe, expect, it } from 'vitest';
import { firstFollowUp, nextStep, respectQuietHours, screenGeneral, screenHeadache, suppressNonEssential } from './symptoms';

describe('headache screening', () => {
  it.each([
    [{ suddenSevere: true }], [{ neurological: true }], [{ feverStiffNeck: true }], [{ afterInjury: true }],
    [{ knownMigraine: true, neurological: true }],
  ])('%o is an emergency, even for a known migraine', (a) => {
    expect(screenHeadache(a)).toBe('emergency');
  });
  it('new or different, or no known migraine, means see a doctor (never a routine reminder)', () => {
    expect(screenHeadache({ knownMigraine: true, newOrDifferent: true })).toBe('see_doctor');
    expect(screenHeadache({})).toBe('see_doctor');
  });
  it('only a usual, known migraine with no danger sign gets the gentle self-care path', () => {
    expect(screenHeadache({ knownMigraine: true })).toBe('usual');
  });
  it('other symptoms: danger sign is urgent, a very high score advises care', () => {
    expect(screenGeneral(3, true)).toBe('emergency');
    expect(screenGeneral(9, false)).toBe('see_doctor');
    expect(screenGeneral(5, false)).toBe('usual');
  });
});

describe('quiet hours', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 14, h, m).getTime();
  const q = { startMinute: 22 * 60, endMinute: 7 * 60 };
  it('keeps a daytime reminder as is', () => expect(respectQuietHours(at(14), q)).toBe(at(14)));
  it('moves a night reminder to the end of quiet hours (across midnight)', () => {
    expect(respectQuietHours(at(23, 30), q)).toBe(at(31)); // 07:00 next day
    expect(respectQuietHours(at(3), q)).toBe(at(7));
  });
  it('no quiet hours means no change', () => expect(respectQuietHours(at(3), null)).toBe(at(3)));
});

describe('follow-ups never nag', () => {
  const now = new Date(2026, 9, 14, 15).getTime();
  it('the first follow-up is scheduled at the delay chosen', () => {
    expect(firstFollowUp(now, 60, null)).toEqual({ dueAt: now + 3600000, attempt: 1 });
  });
  it('better closes the episode', () => expect(nextStep('better', 1, now, null).kind).toBe('celebrate'));
  it('stop cancels everything', () => expect(nextStep('stop', 1, now, null)).toEqual({ kind: 'stopped', status: 'stopped' }));
  it('worse re-runs the safety screen and does not schedule more routine reminders', () => {
    const s = nextStep('worse', 1, now, null);
    expect(s.kind).toBe('rescreen');
    expect('follow' in s).toBe(false);
  });
  it('"about the same" gets one more check, then a suggestion to see a clinician, then silence', () => {
    const a = nextStep('same', 1, now, null);
    expect(a.kind).toBe('check_again');
    const b = nextStep('same', 2, now, null);
    expect(b.kind).toBe('suggest_care');
    expect('follow' in b).toBe(false);
  });
});

describe('comfort mode', () => {
  it('mutes everything except follow-ups the person asked for', () => {
    expect(suppressNonEssential(true, 'meal')).toBe(true);
    expect(suppressNonEssential(true, 'wellness')).toBe(true);
    expect(suppressNonEssential(true, 'followup')).toBe(false);
    expect(suppressNonEssential(false, 'meal')).toBe(false);
  });
});
