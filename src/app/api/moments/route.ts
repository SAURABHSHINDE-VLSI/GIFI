import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { currentUser } from "@/lib/auth";
import { getDefaultThought } from "@/lib/momentThoughts";
import { checkSameOrigin } from "@/lib/security";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = Math.floor(1.5 * 1024 * 1024); // ~1.5 MB string length cap
const IMAGE_DATA_REGEX = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function GET(request: Request) {
  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!user.pair_id) {
    return NextResponse.json({ moments: [], hasMore: false });
  }

  const url = new URL(request.url);
  const beforeParam = url.searchParams.get("before");
  const before = beforeParam ? parseInt(beforeParam, 10) : null;

  let query =
    "SELECT id, pair_id, user_id, user_name, image_data, caption, thought, created_at FROM moments WHERE pair_id = ?";
  const params: unknown[] = [user.pair_id];

  if (before && Number.isFinite(before) && before > 0) {
    query += " AND created_at < ?";
    params.push(before);
  }

  query += " ORDER BY created_at DESC LIMIT 20";

  const statement = db.prepare(query);
  const results = await statement.bind(...params).all<{
    id: string;
    pair_id: string;
    user_id: string;
    user_name: string;
    image_data: string;
    caption: string | null;
    thought: string | null;
    created_at: number;
  }>();

  return NextResponse.json({
    moments: results.results.map((row) => ({
      id: row.id,
      by: row.user_name,
      mine: row.user_id === user.id,
      image: row.image_data,
      caption: row.caption ?? "",
      thought: row.thought || getDefaultThought(row.caption ?? "", row.id),
      at: row.created_at,
    })),
    hasMore: results.results.length === 20,
  });
}

export async function POST(request: Request) {
  const originCheck = checkSameOrigin(request);
  if (originCheck) return originCheck;

  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!user.pair_id) {
    return NextResponse.json({ message: "You are not connected to a partner." }, { status: 400 });
  }

  // Rate-limit POST (30 per hour per user)
  const rateLimit = await checkRateLimit(db, `moments-post:${user.id}`, 30, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "You are uploading moments too quickly. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 3600) },
      },
    );
  }

  let body: { image?: unknown; image_data?: unknown; caption?: unknown; thought?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const rawImage = typeof body.image === "string" ? body.image : typeof body.image_data === "string" ? body.image_data : "";

  if (!rawImage) {
    return NextResponse.json({ message: "Image is required." }, { status: 400 });
  }

  if (rawImage.length > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { message: "Image size exceeds the 1.5 MB limit." },
      { status: 413 },
    );
  }

  if (!IMAGE_DATA_REGEX.test(rawImage)) {
    return NextResponse.json(
      { message: "Invalid image format. Only JPEG, PNG, and WebP images are allowed." },
      { status: 400 },
    );
  }

  const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, 100) : "";
  const id = crypto.randomUUID();
  const now = Date.now();
  const thought = typeof body.thought === "string" ? body.thought.trim().slice(0, 250) : getDefaultThought(caption, id);

  await db
    .prepare(
      "INSERT INTO moments (id, pair_id, user_id, user_name, image_data, caption, thought, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id, user.pair_id, user.id, user.display_name, rawImage, caption, thought, now)
    .run();

  return NextResponse.json({
    ok: true,
    moment: {
      id,
      by: user.display_name,
      mine: true,
      image: rawImage,
      caption,
      thought,
      at: now,
    },
  });
}

export async function PATCH(request: Request) {
  const originCheck = checkSameOrigin(request);
  if (originCheck) return originCheck;

  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user || !user.pair_id) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: { id?: unknown; caption?: unknown; thought?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ message: "ID required." }, { status: 400 });
  }

  const existing = await db
    .prepare("SELECT id FROM moments WHERE id = ? AND pair_id = ?")
    .bind(id, user.pair_id)
    .first();

  if (!existing) {
    return NextResponse.json({ message: "Moment not found." }, { status: 404 });
  }

  if (body.caption !== undefined) {
    if (typeof body.caption !== "string") {
      return NextResponse.json({ message: "Caption must be a string." }, { status: 400 });
    }
    await db.prepare("UPDATE moments SET caption = ? WHERE id = ?").bind(body.caption.slice(0, 100), id).run();
  }

  if (body.thought !== undefined) {
    if (typeof body.thought !== "string") {
      return NextResponse.json({ message: "Thought must be a string." }, { status: 400 });
    }
    await db.prepare("UPDATE moments SET thought = ? WHERE id = ?").bind(body.thought.slice(0, 250), id).run();
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const originCheck = checkSameOrigin(request);
  if (originCheck) return originCheck;

  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user || !user.pair_id) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ message: "ID required." }, { status: 400 });
  }

  const existing = await db
    .prepare("SELECT id FROM moments WHERE id = ? AND pair_id = ?")
    .bind(id, user.pair_id)
    .first();

  if (!existing) {
    return NextResponse.json({ message: "Moment not found." }, { status: 404 });
  }

  await db
    .prepare("DELETE FROM moments WHERE id = ? AND pair_id = ?")
    .bind(id, user.pair_id)
    .run();

  return NextResponse.json({ ok: true });
}
