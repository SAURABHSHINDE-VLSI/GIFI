-- Migration number: 0002 	 2026-11-14T00:00:01.000Z
ALTER TABLE users ADD COLUMN last_seen_at INTEGER;

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
