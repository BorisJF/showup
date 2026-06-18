/**
 * POST /api/submit
 * Body: { date: "YYYY-MM-DD", focus: string, commitment: string }
 *
 * 1. Checks for an existing entry (idempotent — returns it if found)
 * 2. Picks a random message mode
 * 3. Calls Claude Haiku for a short daily message
 * 4. Saves entry to DB
 * 5. Returns the complete entry
 */
import { neon } from '@neondatabase/serverless';

export const config = { path: '/api/submit' };

// ── Message modes ────────────────────────────────────────────────────────────

const MODES = ['inspiration', 'provocation', 'reflection', 'connection'];

const MODE_SYSTEM_PROMPTS = {
  inspiration:
    'You are a morning companion. The user has just committed to their day. ' +
    'Respond with a single sentence of genuine, specific inspiration — ' +
    'personal, not corporate. Reference what they wrote. Under 40 words.',

  provocation:
    'You are a morning companion. The user has just committed to their day. ' +
    'Respond with a single honest, slightly challenging observation or question ' +
    'about their focus or commitment. Be direct, not harsh. Under 40 words.',

  reflection:
    'You are a morning companion. The user has just committed to their day. ' +
    'Offer a single quiet reframe — something that invites them to look at ' +
    'what they wrote from a different angle. Calm and perceptive. Under 40 words.',

  connection:
    'You are a morning companion. The user has just committed to their day. ' +
    'Write a single sentence that makes them feel less alone — connecting ' +
    'their work to something universal. Warm and specific. Under 40 words.',
};

// ── Handler ──────────────────────────────────────────────────────────────────

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { date, focus, commitment, lang } = body;

  if (!date || !focus || !commitment) {
    return Response.json(
      { error: 'date, focus, and commitment are all required.' },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { error: 'date must be in YYYY-MM-DD format.' },
      { status: 400 }
    );
  }

  const sql = neon(process.env.NETLIFY_DB_URL);

  // 1. Idempotency check — return existing entry if this date is already committed
  const existing = await sql`
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
  if (existing.length > 0) {
    return Response.json(existing[0]);
  }

  // 2. Pick a random message mode
  const mode = MODES[Math.floor(Math.random() * MODES.length)];

  // 3. Call Claude for the daily message (graceful fallback if API fails)
  let dailyMessage = (lang === 'fr') ? 'Continue.' : 'Keep going.';
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-api-key':       apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 100,
          system:     MODE_SYSTEM_PROMPTS[mode]
            + (lang === 'fr'
                ? ' Write your entire response in French, addressing the user informally with "tu" (tutoiement).'
                : ''),
          messages: [{
            role:    'user',
            content: `My focus today: ${focus}\nMy commitment: ${commitment}`,
          }],
        }),
      });

      if (claudeRes.ok) {
        const claudeData = await claudeRes.json();
        const text = claudeData.content?.[0]?.text?.trim();
        if (text) dailyMessage = text;
      } else {
        console.error('[submit] Claude API HTTP error:', claudeRes.status, await claudeRes.text());
      }
    } else {
      console.warn('[submit] ANTHROPIC_API_KEY not set — using fallback message');
    }
  } catch (err) {
    console.error('[submit] Claude API call failed:', err);
    // Continue with fallback message
  }

  // 4. Save to DB
  try {
    const inserted = await sql`
      INSERT INTO entries (date, focus, commitment, daily_message, message_mode)
      VALUES (${date}, ${focus}, ${commitment}, ${dailyMessage}, ${mode})
      ON CONFLICT (date) DO NOTHING
      RETURNING
        id,
        date::text  AS date,
        focus,
        commitment,
        daily_message,
        message_mode,
        created_at
    `;

    // ON CONFLICT DO NOTHING means if a concurrent request beat us,
    // inserted will be empty — fetch the winner row instead
    if (inserted.length > 0) {
      return Response.json(inserted[0]);
    }

    const winner = await sql`
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
    return Response.json(winner[0] ?? { date, focus, commitment, daily_message: dailyMessage, message_mode: mode });

  } catch (err) {
    console.error('[submit] database error:', err);
    return Response.json(
      { error: 'Database error. Please try again.' },
      { status: 500 }
    );
  }
};
