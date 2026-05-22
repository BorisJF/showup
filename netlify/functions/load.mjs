/**
 * GET /api/load?date=YYYY-MM-DD
 *
 * Returns:
 *   today   — the entry for the given date, or null
 *   streak  — consecutive days ending today or yesterday
 *   history — last 7 entries before today, newest first
 */
import { neon } from '@neondatabase/serverless';
import { computeStreak } from '../lib/streak.mjs';

export const config = { path: '/api/load' };

// ── Handler ─────────────────────────────────────────────────────────────────

export default async (req) => {
  const url  = new URL(req.url);
  const date = url.searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { error: 'A valid date query parameter is required (YYYY-MM-DD).' },
      { status: 400 }
    );
  }

  try {
    const sql = neon(process.env.NETLIFY_DB_URL);

    // 1. Today's entry (null if not yet committed)
    const todayRows = await sql`
      SELECT
        id,
        date::text  AS date,
        focus,
        commitment,
        daily_message,
        message_mode,
        created_at
      FROM entries
      WHERE date = ${date}
      LIMIT 1
    `;
    const today = todayRows[0] ?? null;

    // 2. All entries up to today for streak calculation (max 100 days back)
    const allRows = await sql`
      SELECT date::text AS date
      FROM entries
      WHERE date <= ${date}
      ORDER BY date DESC
      LIMIT 100
    `;
    const streak = computeStreak(allRows.map(r => r.date), date);

    // 3. Recent history — last 7 entries *before* today, newest first
    const history = await sql`
      SELECT
        date::text AS date,
        focus,
        commitment,
        daily_message,
        message_mode
      FROM entries
      WHERE date < ${date}
      ORDER BY date DESC
      LIMIT 7
    `;

    return Response.json({ today, streak, history });

  } catch (err) {
    console.error('[load] database error:', err);
    return Response.json(
      { error: 'Database error. Please try again.' },
      { status: 500 }
    );
  }
};
