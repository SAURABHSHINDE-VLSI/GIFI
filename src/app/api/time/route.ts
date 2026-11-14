import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) {
    return NextResponse.json(
      { message: "Unauthorized" },
      {
        status: 401,
        headers: { "cache-control": "no-store, no-cache, must-revalidate" },
      },
    );
  }

  return NextResponse.json(
    { now: Date.now() },
    { headers: { "cache-control": "no-store" } },
  );
}
