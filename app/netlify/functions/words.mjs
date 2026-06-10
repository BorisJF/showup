/**
 * GET /api/words
 *
 * Returns all commitment texts for word cloud generation.
 * Limited to 500 most recent entries.
 */
import { neon } from '@neondatabase/serverless';

export const config = { path: '/api/words' };

export default async (_req) => {
  try {
    const sql = neon(process.env.NETLIFY_DB_URL);
    const rows = await sql`
      SELECT commitment
      FROM entries
      WHERE commitment IS NOT NULL AND commitment <> ''
      ORDER BY date DESC
      LIMIT 500
    `;
    return Response.json({
      texts: rows.map(r => r.commitment),
      count: rows.length,
    });
  } catch (err) {
    console.error('[words] database error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
};
