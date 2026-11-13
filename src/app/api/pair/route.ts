import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { currentUser, partnerFor } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_DAYS = 7;

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes)
    .map((byte) => ALPHABET[byte % ALPHABET.length])
    .join("");
}

function normalizeCode(input: string) {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function prettyCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function POST(request: Request) {
  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  let body: { action?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  if (body.action === "create") {
    if (user.pair_id) {
      return NextResponse.json({ message: "You are already connected." }, { status: 409 });
    }

    await db.prepare("DELETE FROM invites WHERE user_id = ?").bind(user.id).run();

    const now = Date.now();
    let code = makeCode();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const clash = await db.prepare("SELECT code FROM invites WHERE code = ?").bind(code).first();
      if (!clash) break;
      code = makeCode();
    }

    await db
      .prepare(
        "INSERT INTO invites (code, user_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)",
      )
      .bind(code, user.id, now, now + INVITE_DAYS * 24 * 60 * 60 * 1000)
      .run();

    return NextResponse.json({ code: prettyCode(code) });
  }

  if (body.action === "unpair") {
    if (!user.pair_id) {
      return NextResponse.json({ ok: true, paired: false });
    }

    const pairId = user.pair_id;

    await db.batch([
      db.prepare("UPDATE users SET pair_id = NULL WHERE pair_id = ?").bind(pairId),
      db.prepare("DELETE FROM pairs WHERE id = ?").bind(pairId),
      db.prepare("DELETE FROM invites WHERE user_id = ?").bind(user.id),
    ]);

    return NextResponse.json({ ok: true, paired: false });
  }

  if (body.action === "join") {
    if (user.pair_id) {
      return NextResponse.json({ message: "You are already connected." }, { status: 409 });
    }

    const code = normalizeCode(String(body.code ?? ""));
    if (code.length !== 8) {
      return NextResponse.json({ message: "That code doesn't look right." }, { status: 400 });
    }

    const invite = await db
      .prepare("SELECT code, user_id, expires_at, used_at FROM invites WHERE code = ?")
      .bind(code)
      .first<{ code: string; user_id: string; expires_at: number; used_at: number | null }>();

    if (!invite || invite.used_at) {
      return NextResponse.json({ message: "That code has already been used." }, { status: 410 });
    }
    if (invite.expires_at < Date.now()) {
      return NextResponse.json({ message: "That code expired — ask for a new one." }, { status: 410 });
    }
    if (invite.user_id === user.id) {
      return NextResponse.json({ message: "You can't pair with yourself." }, { status: 400 });
    }

    const inviter = await db
      .prepare("SELECT id, display_name, pair_id FROM users WHERE id = ?")
      .bind(invite.user_id)
      .first<{ id: string; display_name: string; pair_id: string | null }>();

    if (!inviter || inviter.pair_id) {
      return NextResponse.json(
        { message: "That person is already connected with someone else." },
        { status: 409 },
      );
    }

    const pairId = crypto.randomUUID();
    const now = Date.now();

    await db.batch([
      db.prepare("INSERT INTO pairs (id, created_at) VALUES (?, ?)").bind(pairId, now),
      db
        .prepare("UPDATE users SET pair_id = ? WHERE id = ? AND pair_id IS NULL")
        .bind(pairId, inviter.id),
      db.prepare("UPDATE users SET pair_id = ? WHERE id = ? AND pair_id IS NULL").bind(pairId, user.id),
      db.prepare("UPDATE invites SET used_at = ? WHERE code = ?").bind(now, code),
    ]);

    const refreshed = await db
      .prepare("SELECT pair_id FROM users WHERE id = ?")
      .bind(user.id)
      .first<{ pair_id: string | null }>();

    if (!refreshed?.pair_id) {
      return NextResponse.json({ message: "Could not connect. Try again." }, { status: 409 });
    }

    return NextResponse.json({ partner: { displayName: inviter.display_name } });
  }

  return NextResponse.json({ message: "Unknown action." }, { status: 400 });
}

export async function GET(request: Request) {
  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  const partner = await partnerFor(db, user);
  return NextResponse.json(
    { paired: Boolean(user.pair_id), partner: partner ? { displayName: partner.display_name } : null },
    { headers: { "cache-control": "no-store" } },
  );
}
