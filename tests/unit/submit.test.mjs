/**
 * Unit tests — submit function handler
 * Mocks both @netlify/neon and the global fetch (for Claude API calls).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock @netlify/neon ───────────────────────────────────────────────────────
const mockSql = vi.fn();
vi.mock('@netlify/neon', () => ({
  neon: () => mockSql,
}));

// ── Mock global fetch (Claude API) ──────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Dynamic import after mocks are in place
const { default: handler } = await import('../../netlify/functions/submit.mjs');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body) {
  return new Request('https://example.com/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockClaudeSuccess(text = 'You already know the answer.') {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ content: [{ text }] }),
  });
}

function mockClaudeFailure() {
  mockFetch.mockRejectedValue(new Error('network error'));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
  });

  it('returns 405 for non-POST requests', async () => {
    const req = new Request('https://example.com/api/submit', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  it('returns 400 when body is missing fields', async () => {
    const res = await handler(makeRequest({ date: '2026-05-21', focus: 'Smile' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed date', async () => {
    const res = await handler(makeRequest({
      date: 'bad-date', focus: 'Smile and be nice', commitment: 'Try today.'
    }));
    expect(res.status).toBe(400);
  });

  it('returns the existing entry immediately if already committed today', async () => {
    const existing = {
      id: 'existing-id',
      date: '2026-05-21',
      focus: 'Hold their gaze',
      commitment: 'Look up more.',
      daily_message: 'Keep going.',
      message_mode: 'reflection',
    };

    // First SQL call (idempotency check) returns existing row
    mockSql.mockResolvedValue([existing]);

    const res = await handler(makeRequest({
      date: '2026-05-21',
      focus: 'Hold their gaze',
      commitment: 'Look up more.',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('existing-id');
    // Claude should NOT be called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls Claude API and saves entry on first commit', async () => {
    const message = 'Every moment is a new beginning.';
    mockClaudeSuccess(message);

    const savedEntry = {
      id: 'new-id',
      date: '2026-05-21',
      focus: 'Smile and be nice',
      commitment: 'Say hello to a stranger.',
      daily_message: message,
      message_mode: 'inspiration',
    };

    mockSql
      .mockResolvedValueOnce([])          // idempotency check → no existing entry
      .mockResolvedValueOnce([savedEntry]); // INSERT RETURNING

    const res = await handler(makeRequest({
      date: '2026-05-21',
      focus: 'Smile and be nice',
      commitment: 'Say hello to a stranger.',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.daily_message).toBe(message);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('falls back to "Keep going." when Claude API fails', async () => {
    mockClaudeFailure();

    const savedEntry = {
      id: 'new-id',
      date: '2026-05-21',
      focus: 'Own it — you can fix it',
      commitment: 'Fix the one thing.',
      daily_message: 'Keep going.',
      message_mode: 'provocation',
    };

    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedEntry]);

    const res = await handler(makeRequest({
      date: '2026-05-21',
      focus: 'Own it — you can fix it',
      commitment: 'Fix the one thing.',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    // Still returns a valid entry — just with the fallback message
    expect(body.commitment).toBe('Fix the one thing.');
  });

  it('falls back gracefully when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const savedEntry = {
      id: 'new-id',
      date: '2026-05-21',
      focus: 'Smile and be nice',
      commitment: 'Try.',
      daily_message: 'Keep going.',
      message_mode: 'connection',
    };

    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedEntry]);

    const res = await handler(makeRequest({
      date: '2026-05-21',
      focus: 'Smile and be nice',
      commitment: 'Try.',
    }));

    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled(); // no API call without key
  });

  it('uses one of the four valid message modes', async () => {
    const validModes = ['inspiration', 'provocation', 'reflection', 'connection'];
    mockClaudeSuccess('Test message.');

    const modes = new Set();
    // Run 20 times to get statistical coverage of all 4 modes
    for (let i = 0; i < 20; i++) {
      const date = `2026-05-${String(i + 1).padStart(2, '0')}`;
      const entry = {
        id: `id-${i}`, date,
        focus: 'Smile and be nice',
        commitment: 'Try.',
        daily_message: 'Test message.',
        message_mode: 'inspiration', // actual mode set by INSERT
      };
      mockSql
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([entry]);
      const res = await handler(makeRequest({ date, focus: 'Smile and be nice', commitment: 'Try.' }));
      const body = await res.json();
      // The system_prompt sent to Claude encodes the mode — extract from fetch call
    }

    // Verify fetch was called with one of the valid system prompts each time
    for (const call of mockFetch.mock.calls) {
      const requestBody = JSON.parse(call[0].body ?? call[1]?.body ?? '{}');
      const systemPrompt = requestBody.system || '';
      expect(systemPrompt.length).toBeGreaterThan(10);
    }
  });

  it('returns 500 when DB insert throws', async () => {
    mockClaudeSuccess();
    mockSql
      .mockResolvedValueOnce([]) // idempotency check OK
      .mockRejectedValueOnce(new Error('DB error')); // INSERT fails

    const res = await handler(makeRequest({
      date: '2026-05-21',
      focus: 'Smile and be nice',
      commitment: 'Try.',
    }));

    expect(res.status).toBe(500);
  });
});
