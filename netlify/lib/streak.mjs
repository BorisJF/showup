/**
 * Pure streak-calculation logic — no DB, no side-effects.
 * Importable by both the Netlify function and the unit tests.
 */

/**
 * Offset a YYYY-MM-DD string by `days` calendar days (positive or negative).
 * Uses UTC arithmetic to avoid DST surprises.
 */
export function offsetDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Compute the streak from an array of date strings.
 *
 * @param {string[]} dates   - ISO date strings (YYYY-MM-DD), sorted DESCENDING,
 *                             all on or before `targetDate`.
 * @param {string}   targetDate - The "today" date (YYYY-MM-DD).
 * @returns {number} streak length (0 if broken or no entries)
 *
 * Rules:
 *  - A streak is valid when the most recent entry is `targetDate` (committed
 *    today) or `targetDate - 1` (committed yesterday, today not yet committed).
 *  - Any gap breaks the streak back to 0.
 *  - Duplicate dates in the input are treated as one entry.
 */
export function computeStreak(dates, targetDate) {
  if (!dates || dates.length === 0) return 0;

  // De-duplicate while preserving DESC order
  const unique = [...new Set(dates)];

  const yesterday = offsetDate(targetDate, -1);

  // Streak must anchor on today or yesterday
  if (unique[0] !== targetDate && unique[0] !== yesterday) return 0;

  let streak = 0;
  let expected = unique[0];

  for (const d of unique) {
    if (d === expected) {
      streak++;
      expected = offsetDate(expected, -1);
    } else {
      break; // gap found
    }
  }

  return streak;
}
