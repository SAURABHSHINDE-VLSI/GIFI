import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { currentUser, partnerFor, lastSeenLabel, clearedSessionCookie } from "@/lib/auth";
import { checkSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) {
    return NextResponse.json(
      { user: null },
      {
        status: 401,
        headers: { "cache-control": "no-store, no-cache, must-revalidate" },
      },
    );
  }

  const partner = await partnerFor(db, user);

  return NextResponse.json(
    {
      user: {
        username: user.username,
        displayName: user.display_name,
        paired: Boolean(user.pair_id),
        lastSeen: lastSeenLabel(user.last_seen_at),
      },
      partner: partner
        ? {
            displayName: partner.display_name,
            lastSeen: lastSeenLabel(partner.last_seen_at),
          }
        : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  const originCheck = checkSameOrigin(request);
  if (originCheck) return originCheck;

  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const statements = [
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM invites WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ];

  if (user.pair_id) {
    statements.unshift(
      db.prepare("UPDATE users SET pair_id = NULL WHERE pair_id = ?").bind(user.pair_id),
      db.prepare("DELETE FROM pairs WHERE id = ?").bind(user.pair_id),
    );
  }

  await db.batch(statements);

  return NextResponse.json(
    { ok: true, message: "Account and data deleted." },
    { headers: { "set-cookie": clearedSessionCookie() } },
  );
}
