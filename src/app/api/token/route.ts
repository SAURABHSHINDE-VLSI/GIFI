import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/d1";
import { currentUser } from "@/lib/auth";
import { checkSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originCheck = checkSameOrigin(request);
  if (originCheck) return originCheck;

  let cfEnv: Record<string, string | undefined> = {};
  try {
    const ctx = await getCloudflareContext({ async: true });
    if (ctx && ctx.env) {
      cfEnv = ctx.env as Record<string, string | undefined>;
    }
  } catch {
    // Local / standard Node runtime
  }

  const apiKey = process.env.LIVEKIT_API_KEY || cfEnv.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET || cfEnv.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL || cfEnv.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json(
      { error: "not_configured", message: "Calling isn't configured yet." },
      { status: 503 },
    );
  }

  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!user.pair_id) {
    return NextResponse.json(
      { message: "Connect with your person before starting a call." },
      { status: 403 },
    );
  }

  // The room is derived from the couple, never from the browser.
  const room = `couple-${user.pair_id}`;

  const identity = `${user.username}-${crypto.randomUUID().slice(0, 8)}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: user.display_name,
    ttl: "6h",
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json(
    { token: await token.toJwt(), url, room },
    { headers: { "cache-control": "no-store" } },
  );
}
