/**
 * Unit tests — habits function handler
 * The @neondatabase/serverless module is mocked so no real DB is touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
}));

const { default: handler } = await import('../../netlify/functions/habits.mjs');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body, method = 'PATCH') {
  return new Request('https://example.com/api/habits', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** The values interpolated into the tagged template, in order. */
function lastSqlValues() {
  return mockSql.mock.calls.at(-1).slice(1);
}

beforeEach(() => {
  mockSql.mockReset();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PATCH /api/habits', () => {
  it('rejects non-PATCH methods', async () => {
    const res = await handler(makeRequest({ date: '2026-08-04', moved: true }, 'POST'));
    expect(res.status).toBe(405);
  });

  it('rejects a malformed date', async () => {
    const res = await handler(makeRequest({ date: '04/08/2026', moved: true }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/YYYY-MM-DD/);
  });

  it('rejects a body with neither habit', async () => {
    const res = await handler(makeRequest({ date: '2026-08-04' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least one/i);
  });

  it('rejects non-boolean values', async () => {
    const res = await handler(makeRequest({ date: '2026-08-04', moved: 'yes' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/boolean/i);
  });

  it('updates a single habit and leaves the other untouched', async () => {
    mockSql.mockResolvedValue([{ date: '2026-08-04', meditated: false, moved: true }]);

    const res = await handler(makeRequest({ date: '2026-08-04', moved: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ date: '2026-08-04', meditated: false, moved: true });

    // meditated is passed as null so COALESCE keeps the stored value —
    // this is what stops one toggle from clobbering the other.
    const [meditated, moved] = lastSqlValues();
    expect(meditated).toBeNull();
    expect(moved).toBe(true);
  });

  it('updates both habits when both are supplied', async () => {
    mockSql.mockResolvedValue([{ date: '2026-08-04', meditated: true, moved: true }]);

    const res = await handler(makeRequest({ date: '2026-08-04', meditated: true, moved: true }));
    expect(res.status).toBe(200);

    const [meditated, moved] = lastSqlValues();
    expect(meditated).toBe(true);
    expect(moved).toBe(true);
  });

  it('can turn a habit back off', async () => {
    mockSql.mockResolvedValue([{ date: '2026-08-04', meditated: false, moved: false }]);

    const res = await handler(makeRequest({ date: '2026-08-04', meditated: false }));
    expect(res.status).toBe(200);

    // false must survive as false, not be coerced to null by the COALESCE guard
    const [meditated] = lastSqlValues();
    expect(meditated).toBe(false);
  });

  it('returns 404 when no entry exists for that date', async () => {
    mockSql.mockResolvedValue([]);
    const res = await handler(makeRequest({ date: '2026-08-04', moved: true }));
    expect(res.status).toBe(404);
  });

  it('returns 500 when the database throws', async () => {
    mockSql.mockRejectedValue(new Error('connection lost'));
    const res = await handler(makeRequest({ date: '2026-08-04', moved: true }));
    expect(res.status).toBe(500);
  });
});
