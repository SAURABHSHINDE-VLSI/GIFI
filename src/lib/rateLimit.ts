import type { D1Database } from "./d1";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
};

export function getClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "127.0.0.1";
}

/**
 * Sliding/fixed-window rate limiter backed by D1.
 * Table schema: rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    const row = await db
      .prepare("SELECT window_start, count FROM rate_limits WHERE key = ?")
      .bind(key)
      .first<{ window_start: number; count: number }>();

    if (!row) {
      try {
        await db
          .prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)")
          .bind(key, now)
          .run();
      } catch {
        await db
          .prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?")
          .bind(key)
          .run();
      }
      return { allowed: true, remaining: limit - 1 };
    }

    if (now - row.window_start >= windowMs) {
      // Window expired, reset counter and window start
      await db
        .prepare("UPDATE rate_limits SET window_start = ?, count = 1 WHERE key = ?")
        .bind(now, key)
        .run();
      return { allowed: true, remaining: limit - 1 };
    }

    if (row.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((row.window_start + windowMs - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    await db
      .prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?")
      .bind(key)
      .run();

    return { allowed: true, remaining: limit - (row.count + 1) };
  } catch (error) {
    console.error("Rate limit check error:", error);
    return { allowed: true, remaining: limit };
  }
}
