import { getCloudflareContext } from "@opennextjs/cloudflare";

export type D1Row = Record<string, unknown>;

export type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T = D1Row>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
  all<T = D1Row>(): Promise<{ results: T[] }>;
};

export type D1Database = {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    pair_id TEXT,
    last_seen_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pairs (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_pair ON users (pair_id)`,
];

let migration: Promise<void> | null = null;

async function migrate(db: D1Database) {
  for (const statement of SCHEMA) {
    await db.prepare(statement).run();
  }

  // Add the last_seen_at column to any pre-existing users table.
  // CREATE TABLE IF NOT EXISTS does not alter an existing table, so this
  // ensures older deployments get the column without losing data.
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN last_seen_at INTEGER").run();
  } catch {
    // Column may already exist; ignore.
  }
}

export async function getDb(): Promise<D1Database> {
  const context = await getCloudflareContext({ async: true });
  const db = (context.env as { DB?: D1Database }).DB;

  if (!db) throw new Error("DB_NOT_CONFIGURED");

  if (!migration) {
    migration = migrate(db).catch((error) => {
      migration = null;
      throw error;
    });
  }
  await migration;

  return db;
}
