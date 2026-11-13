import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { clearedSessionCookie, readCookie, SESSION_COOKIE, sha256 } from "@/lib/auth";
import { checkSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originCheck = checkSameOrigin(request);
  if (originCheck) return originCheck;
  const token = readCookie(request, SESSION_COOKIE);

  if (token) {
    try {
      const db = await getDb();
      await db
        .prepare("DELETE FROM sessions WHERE token_hash = ?")
        .bind(await sha256(token))
        .run();
    } catch {
      // clearing the cookie still signs the user out on this device
    }
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "set-cookie": clearedSessionCookie() } },
  );
}
