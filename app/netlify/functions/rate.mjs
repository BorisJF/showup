/**
 * PATCH /api/rate
 * Body: { date: "YYYY-MM-DD", rating: 0–5 }
 *
 * Saves the self-rating for a past entry.
 * Idempotent — re-rating the same date overwrites the previous value.
 */
import { neon } from '@neondatabase/serverless';

export const config = { path: '/api/rate' };

export default async (req) => {
  if (req.method !== 'PATCH') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { date, rating } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'date must be in YYYY-MM-DD format.' }, { status: 400 });
  }
  const clearRating = rating === null;
  if (!clearRating && (!Number.isInteger(rating) || rating < 0 || rating > 5)) {
    return Response.json({ error: 'rating must be an integer from 0 to 5, or null to clear.' }, { status: 400 });
  }

  const sql = neon(process.env.NETLIFY_DB_URL);

  const updated = await sql`
    UPDATE entries
    SET rating = ${rating}
    WHERE date = ${date}
    RETURNING
      id,
      date::text AS date,
      focus,
      commitment,
      daily_message,
      message_mode,
      rating,
      created_at
  `;

  if (updated.length === 0) {
    return Response.json({ error: 'No entry found for that date.' }, { status: 404 });
  }

  return Response.json(updated[0]);
};
