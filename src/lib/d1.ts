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

export async function getDb(): Promise<D1Database> {
  const context = await getCloudflareContext({ async: true });
  const db = (context.env as { DB?: D1Database }).DB;

  if (!db) throw new Error("DB_NOT_CONFIGURED");

  return db;
}
