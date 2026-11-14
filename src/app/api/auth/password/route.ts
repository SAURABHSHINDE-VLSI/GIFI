import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import {
  currentUser,
  hashPassword,
  readCookie,
  SESSION_COOKIE,
  sha256,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { checkSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originCheck = checkSameOrigin(request);
  if (originCheck) return originCheck;

  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { message: "Current password and new password are required." },
      { status: 400 },
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { message: "New password needs at least 8 characters." },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);
  const rateLimitKey = `pwd_change:${user.id}:${ip}`;
  const rateLimit = await checkRateLimit(db, rateLimitKey, 5, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many password attempts. Please wait a few minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) },
      },
    );
  }

  const dbUser = await db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ password_hash: string }>();

  if (!dbUser || !(await verifyPassword(currentPassword, dbUser.password_hash))) {
    return NextResponse.json({ message: "Wrong current password." }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  const currentToken = readCookie(request, SESSION_COOKIE);
  const currentTokenHash = currentToken ? await sha256(currentToken) : null;

  if (currentTokenHash) {
    await db.batch([
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(newHash, user.id),
      db
        .prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?")
        .bind(user.id, currentTokenHash),
    ]);
  } else {
    await db.batch([
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(newHash, user.id),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    ]);
  }

  return NextResponse.json({ ok: true, message: "Password updated successfully." });
}
