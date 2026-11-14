-- Migration number: 0003 	 2026-11-14T00:00:02.000Z
CREATE TABLE IF NOT EXISTS moments (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  image_data TEXT NOT NULL,
  caption TEXT,
  thought TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS love_signals (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  from_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS origami_notes (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  from_name TEXT NOT NULL,
  content TEXT NOT NULL,
  fold_type TEXT NOT NULL,
  paper_style TEXT NOT NULL,
  is_opened INTEGER NOT NULL DEFAULT 0,
  opened_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS couple_meta (
  pair_id TEXT PRIMARY KEY,
  anniversary_date INTEGER,
  reunion_date INTEGER,
  reunion_destination TEXT,
  user1_city TEXT,
  user1_tz TEXT,
  user2_city TEXT,
  user2_tz TEXT,
  total_call_seconds INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moments_pair ON moments (pair_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_pair ON love_signals (pair_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_origami_pair ON origami_notes (pair_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_milestones_pair ON milestones (pair_id, date ASC);
