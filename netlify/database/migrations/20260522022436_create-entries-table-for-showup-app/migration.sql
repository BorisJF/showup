CREATE TABLE IF NOT EXISTS entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE        NOT NULL UNIQUE,
  focus       TEXT        NOT NULL,
  commitment  TEXT        NOT NULL,
  daily_message TEXT,
  message_mode  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS entries_date_desc ON entries (date DESC);
