import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { createSession, DUMMY_PASSWORD_HASH, sessionCookie, verifyPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const failure = NextResponse.json({ message: "Wrong id or password." }, { status: 401 });

  if (!username || !password) return failure;

  const db = await getDb();

  const ip = getClientIp(request);
  const rateLimitKey = `login:${username}:${ip}`;
  const rateLimit = await checkRateLimit(db, rateLimitKey, 10, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many login attempts. Please wait a few minutes and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) },
      },
    );
  }

  const user = await db
    .prepare(
      "SELECT id, username, display_name, password_hash, pair_id FROM users WHERE username = ?",
    )
    .bind(username)
    .first<{
      id: string;
      username: string;
      display_name: string;
      password_hash: string;
      pair_id: string | null;
    }>();

  // If user not found, run verifyPassword against fixed dummy hash so response timing is identical.
  const hashToVerify = user ? user.password_hash : DUMMY_PASSWORD_HASH;
  const valid = await verifyPassword(password, hashToVerify);

  if (!user || !valid) return failure;

  const token = await createSession(db, user.id);

  return NextResponse.json(
    {
      user: {
        username: user.username,
        displayName: user.display_name,
        paired: Boolean(user.pair_id),
      },
    },
    { headers: { "set-cookie": sessionCookie(token) } },
  );
}
