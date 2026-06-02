/**
 * POST /api/hint
 * Body: { commitment: string }
 *
 * Asks Claude Haiku to rate the commitment's specificity.
 * Returns: { quality: "vague" | "specific" | "exceptional" }
 *
 * Called as the user types, debounced on the frontend.
 * One lightweight call per morning — minimal token cost.
 */
export const config = { path: '/api/hint' };

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }); }

  const { commitment } = body;
  if (!commitment || commitment.trim().length < 10) {
    return Response.json({ error: 'commitment too short.' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ quality: 'specific' }); // graceful fallback
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 5,
        system: `You assess the specificity of a morning commitment.
Reply with exactly one word — nothing else:
- "vague" if the commitment is abstract or generic (e.g. "be better", "work harder")
- "specific" if it names a concrete action, person, place, or situation
- "exceptional" if it is vivid, concrete, and shows genuine personal intention`,
        messages: [{
          role:    'user',
          content: `Commitment: "${commitment.trim()}"`,
        }],
      }),
    });

    if (!res.ok) return Response.json({ quality: 'specific' });

    const data  = await res.json();
    const raw   = (data.content?.[0]?.text || '').trim().toLowerCase();
    const valid = ['vague', 'specific', 'exceptional'];
    const quality = valid.find(v => raw.includes(v)) || 'specific';

    return Response.json({ quality });

  } catch {
    return Response.json({ quality: 'specific' }); // silent fallback
  }
};
