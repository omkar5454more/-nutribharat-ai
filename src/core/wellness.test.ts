import { describe, expect, it } from 'vitest';
import { STEP_GOAL, sleepAdvice, summarizeWellness, validMinutes, validSleep, validSteps } from './wellness';

const days = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'];

describe('sleep advice', () => {
  it.each([[null, 'not_enough_data'], [4.5, 'very_short'], [5.9, 'very_short'], [6, 'short'], [6.9, 'short'], [7, 'good'], [9, 'good'], [9.5, 'long']] as const)('%s h -> %s', (h, a) => {
    expect(sleepAdvice(h)).toBe(a);
  });
});

describe('weekly wellness summary', () => {
  it('averages only logged days and ignores days outside the window', () => {
    const w = summarizeWellness(
      days,
      [{ date: '2026-10-13', hours: 8 }, { date: '2026-10-12', hours: 6 }, { date: '2026-10-01', hours: 3 }],
      [{ date: '2026-10-13', steps: 9000, exercise_min: 30 }, { date: '2026-10-12', steps: 5000, exercise_min: 0 }, { date: '2026-09-01', steps: 20000, exercise_min: 90 }]
    );
    expect(w.sleepNights).toBe(2);
    expect(w.avgSleep).toBe(7);
    expect(w.nightsInRange).toBe(1);
    expect(w.activityDays).toBe(2);
    expect(w.avgSteps).toBe(7000);
    expect(w.daysAtStepGoal).toBe(1);
    expect(w.exerciseMinutes).toBe(30);
  });

  it('returns nulls rather than zeros when nothing was logged', () => {
    const w = summarizeWellness(days, [], []);
    expect(w.avgSleep).toBeNull();
    expect(w.avgSteps).toBeNull();
    expect(w.sleepNights + w.activityDays + w.daysAtStepGoal + w.exerciseMinutes).toBe(0);
  });

  it('counts the step goal inclusively', () => {
    expect(summarizeWellness(days, [], [{ date: days[0], steps: STEP_GOAL, exercise_min: 0 }]).daysAtStepGoal).toBe(1);
    expect(summarizeWellness(days, [], [{ date: days[0], steps: STEP_GOAL - 1, exercise_min: 0 }]).daysAtStepGoal).toBe(0);
  });
});

describe('input validation', () => {
  it('rejects impossible values', () => {
    expect(validSleep(7.5)).toBe(true);
    expect(validSleep(0)).toBe(false);
    expect(validSleep(20)).toBe(false);
    expect(validSleep(NaN)).toBe(false);
    expect(validSteps(8000)).toBe(true);
    expect(validSteps(-1)).toBe(false);
    expect(validSteps(1.5)).toBe(false);
    expect(validSteps(1_000_000)).toBe(false);
    expect(validMinutes(45)).toBe(true);
    expect(validMinutes(601)).toBe(false);
  });
});
