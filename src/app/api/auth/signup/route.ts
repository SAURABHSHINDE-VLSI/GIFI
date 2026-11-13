import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { createSession, hashPassword, sessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { username?: string; displayName?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const displayName = String(body.displayName ?? "").trim().slice(0, 24);
  const password = String(body.password ?? "");

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { message: "Pick an id with 3–20 letters, numbers or underscores." },
      { status: 400 },
    );
  }
  if (!displayName) {
    return NextResponse.json({ message: "Tell us your name." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { message: "Password needs at least 8 characters." },
      { status: 400 },
    );
  }

  const db = await getDb();

  const ip = getClientIp(request);
  const rateLimitKey = `signup:${ip}`;
  const rateLimit = await checkRateLimit(db, rateLimitKey, 10, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many sign-up attempts. Please wait a few minutes and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) },
      },
    );
  }

  const existing = await db
    .prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first();

  if (existing) {
    return NextResponse.json({ message: "That id is already taken." }, { status: 409 });
  }

  const id = crypto.randomUUID();

  try {
    await db
      .prepare(
        "INSERT INTO users (id, username, display_name, password_hash, pair_id, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
      )
      .bind(id, username, displayName, await hashPassword(password), Date.now())
      .run();
  } catch {
    return NextResponse.json(
      { message: "Could not create your id. Try again." },
      { status: 500 },
    );
  }

  const token = await createSession(db, id);

  return NextResponse.json(
    { user: { username, displayName, paired: false } },
    { headers: { "set-cookie": sessionCookie(token) } },
  );
}
