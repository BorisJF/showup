/**
 * GET /api/weekly-summary
 *
 * Returns the last 7 entries before today (focus, commitment, rating,
 * daily_message, message_mode), newest first.
 * Used by the Sunday weekly-letter scheduled task.
 */
import { neon } from '@neondatabase/serverless';

export const config = { path: '/api/weekly-summary' };

export default async (req) => {
  try {
    const sql = neon(process.env.NETLIFY_DB_URL);

    const rows = await sql`
      SELECT
        date::text      AS date,
        focus,
        commitment,
        rating,
        daily_message,
        message_mode,
        meditated,
        moved
      FROM entries
      WHERE date < CURRENT_DATE
      ORDER BY date DESC
      LIMIT 7
    `;

    // Habit tallies over the window, for the recap letter ("meditated 5/7").
    // Counted out of the number of entries present, not a hard 7 — a week with
    // 4 entries reports out of 4, so a quiet week doesn't read as failure.
    const habits = {
      days:      rows.length,
      meditated: rows.filter(r => r.meditated).length,
      moved:     rows.filter(r => r.moved).length,
    };

    return Response.json({ entries: rows, habits });

  } catch (err) {
    console.error('[weekly-summary] error:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }
};
