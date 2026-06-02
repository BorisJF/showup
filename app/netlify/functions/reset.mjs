/**
 * DELETE /api/reset
 * Body: { date: "YYYY-MM-DD", yesterday: "YYYY-MM-DD" }
 *
 * Clears today's entry AND yesterday's rating in one shot.
 * Used by the "Reset today" button when a mistake was made.
 */
import { neon } from '@neondatabase/serverless';

export const config = { path: '/api/reset' };

export default async (req) => {
  if (req.method !== 'DELETE') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }); }

  const { date, yesterday } = body;

  if (!date     || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !yesterday || !/^\d{4}-\d{2}-\d{2}$/.test(yesterday)) {
    return Response.json({ error: 'date and yesterday must be YYYY-MM-DD.' }, { status: 400 });
  }

  const sql = neon(process.env.NETLIFY_DB_URL);

  // Delete today's entry
  const deleted = await sql`
    DELETE FROM entries WHERE date = ${date} RETURNING date
  `;

  // Clear yesterday's rating (set to null)
  await sql`
    UPDATE entries SET rating = NULL WHERE date = ${yesterday}
  `;

  return Response.json({
    ok: true,
    deleted: deleted.length,
    ratingCleared: yesterday,
  });
};
