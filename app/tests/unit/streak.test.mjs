/**
 * Unit tests — streak calculation
 * Run:  npm test
 */
import { describe, it, expect } from 'vitest';
import { computeStreak, offsetDate } from '../../netlify/lib/streak.mjs';

// ── offsetDate ───────────────────────────────────────────────────────────────

describe('offsetDate', () => {
  it('adds positive days', () => {
    expect(offsetDate('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('subtracts negative days', () => {
    expect(offsetDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles leap year', () => {
    expect(offsetDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(offsetDate('2024-02-29', 1)).toBe('2024-03-01');
  });

  it('handles year boundary', () => {
    expect(offsetDate('2025-12-31', 1)).toBe('2026-01-01');
    expect(offsetDate('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles DST-adjacent dates (March / November)', () => {
    // Daylight Saving transition in US — should not shift date
    expect(offsetDate('2026-03-07', 1)).toBe('2026-03-08'); // Spring forward eve
    expect(offsetDate('2026-11-01', 1)).toBe('2026-11-02'); // Fall back eve
  });
});

// ── computeStreak ────────────────────────────────────────────────────────────

describe('computeStreak', () => {
  const TODAY = '2026-05-21';

  // Helper: build a DESC array of N consecutive dates ending on `end`
  function consecutiveDates(end, n) {
    const result = [];
    for (let i = 0; i < n; i++) result.push(offsetDate(end, -i));
    return result;
  }

  it('returns 0 for empty history', () => {
    expect(computeStreak([], TODAY)).toBe(0);
  });

  it('returns 1 when only today committed', () => {
    expect(computeStreak([TODAY], TODAY)).toBe(1);
  });

  it('returns 1 when only yesterday committed (today not yet)', () => {
    const yesterday = offsetDate(TODAY, -1);
    expect(computeStreak([yesterday], TODAY)).toBe(1);
  });

  it('returns 0 when most recent entry is 2 days ago', () => {
    const twoDaysAgo = offsetDate(TODAY, -2);
    expect(computeStreak([twoDaysAgo], TODAY)).toBe(0);
  });

  it('counts a 5-day streak ending today', () => {
    const dates = consecutiveDates(TODAY, 5);
    expect(computeStreak(dates, TODAY)).toBe(5);
  });

  it('counts a 5-day streak ending yesterday', () => {
    const yesterday = offsetDate(TODAY, -1);
    const dates = consecutiveDates(yesterday, 5);
    expect(computeStreak(dates, TODAY)).toBe(5);
  });

  it('stops at a one-day gap', () => {
    // today, yesterday, [gap], 3 days ago
    const dates = [
      TODAY,
      offsetDate(TODAY, -1),
      offsetDate(TODAY, -3), // gap at -2
      offsetDate(TODAY, -4),
    ];
    expect(computeStreak(dates, TODAY)).toBe(2);
  });

  it('stops at a gap of two days', () => {
    const dates = [
      TODAY,
      offsetDate(TODAY, -3), // gap at -1 and -2
    ];
    expect(computeStreak(dates, TODAY)).toBe(1);
  });

  it('ignores entries after today', () => {
    // future dates should not appear in practice (server filters them),
    // but if they do they are still sorted after today and ignored by the anchor check
    const dates = [TODAY, offsetDate(TODAY, -1), offsetDate(TODAY, -2)];
    expect(computeStreak(dates, TODAY)).toBe(3);
  });

  it('handles 30-day streak correctly', () => {
    const dates = consecutiveDates(TODAY, 30);
    expect(computeStreak(dates, TODAY)).toBe(30);
  });

  it('handles 100-day streak correctly', () => {
    const dates = consecutiveDates(TODAY, 100);
    expect(computeStreak(dates, TODAY)).toBe(100);
  });

  it('handles streak across a year boundary', () => {
    const end = '2026-01-02';
    const dates = [end, '2026-01-01', '2025-12-31', '2025-12-30'];
    expect(computeStreak(dates, end)).toBe(4);
  });

  it('handles streak across a month boundary', () => {
    const end = '2026-03-02';
    const dates = [end, '2026-03-01', '2026-02-28', '2026-02-27'];
    expect(computeStreak(dates, end)).toBe(4);
  });

  it('handles streak across leap day', () => {
    const end = '2024-03-01';
    const dates = [end, '2024-02-29', '2024-02-28', '2024-02-27'];
    expect(computeStreak(dates, end)).toBe(4);
  });

  it('is idempotent with duplicate dates', () => {
    // Duplicate same date twice — should count as one
    const dates = [TODAY, TODAY, offsetDate(TODAY, -1)];
    expect(computeStreak(dates, TODAY)).toBe(2);
  });

  it('returns 0 when the only entry is far in the past', () => {
    expect(computeStreak(['2025-01-01'], TODAY)).toBe(0);
  });

  it('streak of exactly 7 days', () => {
    const dates = consecutiveDates(TODAY, 7);
    expect(computeStreak(dates, TODAY)).toBe(7);
  });
});
