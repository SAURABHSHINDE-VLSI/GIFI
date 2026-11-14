import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { clearedSessionCookie, currentUser } from "@/lib/auth";
import { checkSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originCheck = checkSameOrigin(request);
  if (originCheck) return originCheck;

  const db = await getDb();
  const user = await currentUser(db, request);

  if (user) {
    try {
      await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
    } catch {
      // non-fatal if database session delete encounters an issue
    }
  }

  return NextResponse.json(
    { ok: true, message: "Logged out from all devices." },
    { headers: { "set-cookie": clearedSessionCookie() } },
  );
}
