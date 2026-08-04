/**
 * Unit tests — load function handler
 * The @neondatabase/serverless module is mocked so no real DB is touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock @neondatabase/serverless before importing the handler ──────────────────────────
const mockSql = vi.fn();
vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
}));

// Dynamic import so the mock is in place first
const { default: handler } = await import('../../netlify/functions/load.mjs');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(date) {
  return new Request(`https://example.com/api/load?date=${date}`);
}

/** Set up mockSql to return different rows per call (in call order). */
function mockDbResponses(...responses) {
  let call = 0;
  mockSql.mockImplementation(() => responses[call++ % responses.length]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/load', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when date is missing', async () => {
    const req = new Request('https://example.com/api/load');
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed date', async () => {
    const req = makeRequest('not-a-date');
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('returns today=null and streak=0 when no entries exist', async () => {
    mockDbResponses(
      [],   // today query
      [],   // all entries for streak
      [],   // history
    );

    const res = await handler(makeRequest('2026-05-21'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.today).toBeNull();
    expect(body.streak).toBe(0);
    expect(body.history).toEqual([]);
  });

  it('returns the existing entry for today and streak=1', async () => {
    const fakeEntry = {
      id: 'abc',
      date: '2026-05-21',
      focus: 'Smile and be nice',
      commitment: 'Say hello to a stranger.',
      daily_message: 'Keep going.',
      message_mode: 'inspiration',
      created_at: new Date().toISOString(),
    };

    mockDbResponses(
      [fakeEntry],           // today query
      [{ date: '2026-05-21' }], // all entries (streak=1)
      [],                    // history (no prior entries)
    );

    const res = await handler(makeRequest('2026-05-21'));
    const body = await res.json();

    expect(body.today).toMatchObject({ focus: 'Smile and be nice' });
    expect(body.streak).toBe(1);
    expect(body.history).toEqual([]);
  });

  it('returns streak=3 when 3 consecutive days exist', async () => {
    mockDbResponses(
      [], // no entry today
      [{ date: '2026-05-20' }, { date: '2026-05-19' }, { date: '2026-05-18' }],
      [],
    );

    const res = await handler(makeRequest('2026-05-21'));
    const body = await res.json();
    expect(body.streak).toBe(3);
  });

  it('returns streak=0 when most recent entry has a gap', async () => {
    mockDbResponses(
      [],
      [{ date: '2026-05-18' }, { date: '2026-05-17' }], // gap: missing 19, 20
      [],
    );

    const res = await handler(makeRequest('2026-05-21'));
    const body = await res.json();
    expect(body.streak).toBe(0);
  });

  it('returns at most 7 history entries', async () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(14 - i).padStart(2, '0')}`,
      focus: 'Hold their gaze',
      commitment: 'Look up more.',
      daily_message: null,
      message_mode: null,
    }));

    mockDbResponses([], [], history);

    const res = await handler(makeRequest('2026-05-21'));
    const body = await res.json();
    expect(body.history.length).toBe(7);
  });

  it('returns 500 when DB throws', async () => {
    mockSql.mockRejectedValue(new Error('connection refused'));
    const res = await handler(makeRequest('2026-05-21'));
    expect(res.status).toBe(500);
  });
});
