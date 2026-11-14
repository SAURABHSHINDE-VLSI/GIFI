import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { currentUser } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { fetchYouTubeFeed } from "@/lib/youtubeFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * YouTube browsing for Watch Together.
 * `?q=<query>` → search results, `?topic=All` (or no params) → trending feed.
 */
export async function GET(request: Request) {
  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const rawQuery = (params.get("q") ?? "").trim().replace(/\s+/g, " ");
  const isHome = !rawQuery;

  if (!isHome && (rawQuery.length < 2 || rawQuery.length > 80)) {
    return NextResponse.json({ message: "Search for something between 2 and 80 characters." }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(db, `watch-feed:${user.id}:${getClientIp(request)}`, 30, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Give it a few seconds." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 30) } },
    );
  }

  try {
    const items = await fetchYouTubeFeed(isHome ? null : rawQuery);
    return NextResponse.json({ items, query: isHome ? null : rawQuery }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "YouTube is not answering right now. Try again." }, { status: 502 });
  }
}
