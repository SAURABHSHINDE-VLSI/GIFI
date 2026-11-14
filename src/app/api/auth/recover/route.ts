import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { hashPassword, sha256 } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { checkSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner-only password recovery. The app has no email, so the site owner holds a
 * recovery key (HERZ_RECOVERY_KEY secret) that authorises a password reset.
 * Without that secret configured the endpoint reports 404, i.e. it is off.
 */
async function keysMatch(candidate: string, expected: string) {
  const [a, b] = [await sha256(candidate), await sha256(expected)];
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export async function POST(request: Request) {
  const expectedKey = process.env.HERZ_RECOVERY_KEY;

  if (!expectedKey) {
    return NextResponse.json({ message: "Recovery is not enabled on this site." }, { status: 404 });
  }

  const originCheck = checkSameOrigin(request);
  if (originCheck) return originCheck;

  let body: { username?: string; key?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "bad_request" }, { status: 400 });
  }

  const db = await getDb();
  const rateLimit = await checkRateLimit(db, `recover:${getClientIp(request)}`, 5, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) } },
    );
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const key = String(body.key ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ message: "Enter a valid id (3–20 letters, numbers or underscores)." }, { status: 400 });
  }
  if (!key) {
    return NextResponse.json({ message: "Recovery key is required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ message: "New password needs at least 8 characters." }, { status: 400 });
  }

  if (!(await keysMatch(key, expectedKey))) {
    return NextResponse.json({ message: "Wrong recovery key." }, { status: 401 });
  }

  const user = await db
    .prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first<{ id: string }>();

  if (!user) {
    return NextResponse.json({ message: "No account with that id." }, { status: 404 });
  }

  await db
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(await hashPassword(newPassword), user.id)
    .run();

  // Any old session for this account becomes invalid immediately.
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();

  return NextResponse.json({ ok: true, message: "Password updated. Sign in with the new one." });
}
