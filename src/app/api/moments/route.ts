import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { currentUser } from "@/lib/auth";
import { getDefaultThought } from "@/lib/momentThoughts";
import { checkSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = await getDb();
  const user = await currentUser(db, request);

  if (!user) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!user.pair_id) {
    return NextResponse.json({ moments: [] });
  }

  const results = await db
    .prepare(
      "SELECT id, pair_id, user_id, user_name, image_data, caption, thought, created_at FROM moments WHERE pair_id = ? ORDER BY created_at DESC LIMIT 60",
    )
    .bind(user.pair_id)
    .all<{
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

  let body: { image?: string; caption?: string; thought?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const image = String(body.image ?? "");
  if (!image.startsWith("data:image/")) {
    return NextResponse.json({ message: "Invalid image." }, { status: 400 });
  }

  const caption = String(body.caption ?? "").slice(0, 100);
  const id = crypto.randomUUID();
  const now = Date.now();
  const thought = String(body.thought ?? getDefaultThought(caption, id)).slice(0, 250);

  await db
    .prepare(
      "INSERT INTO moments (id, pair_id, user_id, user_name, image_data, caption, thought, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id, user.pair_id, user.id, user.display_name, image, caption, thought, now)
    .run();

  return NextResponse.json({
    ok: true,
    moment: {
      id,
      by: user.display_name,
      mine: true,
      image,
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

  let body: { id?: string; caption?: string; thought?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const id = String(body.id ?? "");
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
    await db.prepare("UPDATE moments SET caption = ? WHERE id = ?").bind(body.caption.slice(0, 100), id).run();
  }
  if (body.thought !== undefined) {
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

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ message: "ID required." }, { status: 400 });
  }

  await db
    .prepare("DELETE FROM moments WHERE id = ? AND pair_id = ?")
    .bind(id, user.pair_id)
    .run();

  return NextResponse.json({ ok: true });
}
