-- Add daily habit tracking: meditation + movement.
-- These are recorded alongside the entry but deliberately do NOT affect the
-- streak, which stays tied to showing up (focus + commitment) alone.

ALTER TABLE entries ADD COLUMN IF NOT EXISTS meditated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS moved     BOOLEAN NOT NULL DEFAULT FALSE;
