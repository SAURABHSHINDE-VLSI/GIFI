import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { createSession, sessionCookie, verifyPassword } from "@/lib/auth";

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

  if (!user) return failure;

  const trimmed = password.trim();
  let valid = await verifyPassword(password, user.password_hash);
  if (!valid && trimmed !== password) {
    valid = await verifyPassword(trimmed, user.password_hash);
  }
  if (!valid) {
    valid = await verifyPassword(trimmed.toLowerCase(), user.password_hash);
  }
  if (!valid) return failure;

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
