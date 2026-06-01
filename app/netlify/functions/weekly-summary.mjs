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
        message_mode
      FROM entries
      WHERE date < CURRENT_DATE
      ORDER BY date DESC
      LIMIT 7
    `;

    return Response.json({ entries: rows });

  } catch (err) {
    console.error('[weekly-summary] error:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }
};
