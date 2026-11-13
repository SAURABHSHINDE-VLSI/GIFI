import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { currentUser, partnerFor, lastSeenLabel } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
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
