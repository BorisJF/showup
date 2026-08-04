/**
 * PATCH /api/habits
 * Body: { date: "YYYY-MM-DD", meditated?: boolean, moved?: boolean }
 *
 * Toggles the two daily habits for a date that already has an entry.
 * Either field may be omitted — omitted fields are left untouched, so the
 * client can send a single toggle without clobbering the other.
 *
 * Idempotent. Deliberately does NOT touch the streak: showing up is the
 * streak, habits are recorded alongside it.
 */
import { neon } from '@neondatabase/serverless';

export const config = { path: '/api/habits' };

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

  const { date, meditated, moved } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'date must be in YYYY-MM-DD format.' }, { status: 400 });
  }

  const hasMeditated = meditated !== undefined;
  const hasMoved     = moved     !== undefined;

  if (!hasMeditated && !hasMoved) {
    return Response.json(
      { error: 'At least one of meditated or moved is required.' },
      { status: 400 }
    );
  }
  if ((hasMeditated && typeof meditated !== 'boolean') ||
      (hasMoved     && typeof moved     !== 'boolean')) {
    return Response.json({ error: 'meditated and moved must be booleans.' }, { status: 400 });
  }

  try {
    const sql = neon(process.env.NETLIFY_DB_URL);

    // COALESCE against NULL lets a single statement handle either or both
    // fields — an omitted field is passed as null and keeps its current value.
    const updated = await sql`
      UPDATE entries
      SET
        meditated = COALESCE(${hasMeditated ? meditated : null}, meditated),
        moved     = COALESCE(${hasMoved     ? moved     : null}, moved)
      WHERE date = ${date}
      RETURNING
        date::text AS date,
        meditated,
        moved
    `;

    if (updated.length === 0) {
      return Response.json({ error: 'No entry found for that date.' }, { status: 404 });
    }

    return Response.json(updated[0]);

  } catch (err) {
    console.error('[habits] database error:', err);
    return Response.json({ error: 'Database error. Please try again.' }, { status: 500 });
  }
};
