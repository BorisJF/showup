/**
 * GET /api/focus-history?days=60
 *
 * Returns how many times each focus was chosen in the last N days,
 * and when it was last used.
 * Used by the monthly focus-avoidance alert scheduled task.
 */
import { neon } from '@neondatabase/serverless';

export const config = { path: '/api/focus-history' };

export default async (req) => {
  const url  = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '60', 10), 365);

  try {
    const sql = neon(process.env.NETLIFY_DB_URL);

    const rows = await sql`
      SELECT
        focus,
        COUNT(*)::int          AS times_chosen,
        MAX(date)::text        AS last_used
      FROM entries
      WHERE date >= CURRENT_DATE - ${days}::int
      GROUP BY focus
      ORDER BY last_used DESC
    `;

    // Include principles that haven't been chosen at all in the window
    const allPrinciples = [
      'Smile and be nice',
      'Hold their gaze',
      'Own it — you can fix it',
      "Watch who you're around",
      'Use this moment to act',
      'Present is where you need to be',
    ];

    const chosen = new Set(rows.map(r => r.focus));
    const missing = allPrinciples
      .filter(p => !chosen.has(p))
      .map(p => ({ focus: p, times_chosen: 0, last_used: null }));

    return Response.json({ days, focuses: [...rows, ...missing] });

  } catch (err) {
    console.error('[focus-history] error:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }
};
