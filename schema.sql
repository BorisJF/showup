-- SHOW UP — database schema
-- Run once against your Netlify DB (Neon Postgres 16+).
-- gen_random_uuid() is built-in in Postgres 13+; no extension needed.

CREATE TABLE IF NOT EXISTS entries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE        NOT NULL UNIQUE,
  focus        TEXT        NOT NULL,
  commitment   TEXT        NOT NULL,
  daily_message TEXT,
  message_mode  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast date-range queries (streak, history)
CREATE INDEX IF NOT EXISTS entries_date_desc ON entries (date DESC);
