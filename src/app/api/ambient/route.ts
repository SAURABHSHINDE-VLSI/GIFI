import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { currentUser } from "@/lib/auth";
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
    return NextResponse.json({ meta: null, signals: [], origami: [], milestones: [] });
  }

  const pairId = user.pair_id;

  // 1. Couple Meta
  let meta = await db
    .prepare("SELECT * FROM couple_meta WHERE pair_id = ?")
    .bind(pairId)
    .first<{
      pair_id: string;
      anniversary_date: number | null;
      reunion_date: number | null;
      reunion_destination: string | null;
      user1_city: string | null;
      user1_tz: string | null;
      user2_city: string | null;
      user2_tz: string | null;
      total_call_seconds: number | null;
      updated_at: number;
    }>();

  // If no meta exists yet, initialize sensible defaults
  if (!meta) {
    const defaultAnniversary = Date.now() - 1000 * 60 * 60 * 24 * 180; // 180 days ago
    const defaultReunion = Date.now() + 1000 * 60 * 60 * 24 * 14; // in 14 days
    await db
      .prepare(
        `INSERT INTO couple_meta (pair_id, anniversary_date, reunion_date, reunion_destination, user1_city, user1_tz, user2_city, user2_tz, total_call_seconds, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        pairId,
        defaultAnniversary,
        defaultReunion,
        "Airport Terminal reunion ✈️",
        "New York",
        "America/New_York",
        "Paris",
        "Europe/Paris",
        7200,
        Date.now()
      )
      .run();

    meta = {
      pair_id: pairId,
      anniversary_date: defaultAnniversary,
      reunion_date: defaultReunion,
      reunion_destination: "Airport Terminal reunion ✈️",
      user1_city: "New York",
      user1_tz: "America/New_York",
      user2_city: "Paris",
      user2_tz: "Europe/Paris",
      total_call_seconds: 7200,
      updated_at: Date.now(),
    };
  }

  // 2. Love Signals (last 24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const signalsResult = await db
    .prepare(
      "SELECT id, pair_id, from_user_id, from_name, created_at FROM love_signals WHERE pair_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 50"
    )
    .bind(pairId, oneDayAgo)
    .all<{
      id: string;
      pair_id: string;
      from_user_id: string;
      from_name: string;
      created_at: number;
    }>();

  // 3. Origami Notes
  const origamiResult = await db
    .prepare(
      "SELECT id, pair_id, from_user_id, from_name, content, fold_type, paper_style, is_opened, opened_at, created_at FROM origami_notes WHERE pair_id = ? ORDER BY created_at DESC LIMIT 40"
    )
    .bind(pairId)
    .all<{
      id: string;
      pair_id: string;
      from_user_id: string;
      from_name: string;
      content: string;
      fold_type: string;
      paper_style: string;
      is_opened: number;
      opened_at: number | null;
      created_at: number;
    }>();

  // 4. Milestones
  let milestonesResult = await db
    .prepare("SELECT id, pair_id, title, date, emoji, note, created_at FROM milestones WHERE pair_id = ? ORDER BY date ASC")
    .bind(pairId)
    .all<{
      id: string;
      pair_id: string;
      title: string;
      date: number;
      emoji: string;
      note: string | null;
      created_at: number;
    }>();

  // Seed initial milestones if empty
  if (milestonesResult.results.length === 0) {
    const m1 = crypto.randomUUID();
    const m2 = crypto.randomUUID();
    const t1 = meta.anniversary_date || Date.now() - 1000 * 60 * 60 * 24 * 180;
    const t2 = t1 + 1000 * 60 * 60 * 24 * 30;

    await db
      .prepare("INSERT INTO milestones (id, pair_id, title, date, emoji, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(m1, pairId, "The Day We First Talked", t1, "✨", "The late night conversation that changed everything.", Date.now())
      .run();

    await db
      .prepare("INSERT INTO milestones (id, pair_id, title, date, emoji, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(m2, pairId, "Our First Official Date", t2, "🥂", "Butterflies, endless smiles and soft music.", Date.now())
      .run();

    milestonesResult = await db
      .prepare("SELECT id, pair_id, title, date, emoji, note, created_at FROM milestones WHERE pair_id = ? ORDER BY date ASC")
      .bind(pairId)
      .all();
  }

  return NextResponse.json({
    userId: user.id,
    userName: user.display_name,
    meta,
    signals: signalsResult.results.map((s) => ({
      id: s.id,
      fromMe: s.from_user_id === user.id,
      fromName: s.from_name,
      at: s.created_at,
    })),
    origami: origamiResult.results.map((o) => ({
      id: o.id,
      fromMe: o.from_user_id === user.id,
      fromName: o.from_name,
      content: o.content,
      foldType: o.fold_type,
      paperStyle: o.paper_style,
      isOpened: Boolean(o.is_opened),
      openedAt: o.opened_at,
      at: o.created_at,
    })),
    milestones: milestonesResult.results.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.date,
      emoji: m.emoji,
      note: m.note ?? "",
      at: m.created_at,
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
    return NextResponse.json({ message: "No partner paired." }, { status: 400 });
  }

  const pairId = user.pair_id;
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const now = Date.now();

  // ACTION 1: Send Heart Signal ("Thinking of You")
  if (action === "heart_signal") {
    const id = crypto.randomUUID();
    await db
      .prepare("INSERT INTO love_signals (id, pair_id, from_user_id, from_name, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, pairId, user.id, user.display_name, now)
      .run();

    return NextResponse.json({
      ok: true,
      signal: {
        id,
        fromMe: true,
        fromName: user.display_name,
        at: now,
      },
    });
  }

  // ACTION 2: Send Origami Secret Note
  if (action === "send_origami") {
    const content = String(body.content ?? "").trim().slice(0, 500);
    if (!content) {
      return NextResponse.json({ message: "Note cannot be empty." }, { status: 400 });
    }

    const foldType = ["plane", "heart", "crane"].includes(body.foldType) ? body.foldType : "plane";
    const paperStyle = ["sakura", "vintage", "midnight", "mint"].includes(body.paperStyle)
      ? body.paperStyle
      : "sakura";

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO origami_notes (id, pair_id, from_user_id, from_name, content, fold_type, paper_style, is_opened, opened_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`
      )
      .bind(id, pairId, user.id, user.display_name, content, foldType, paperStyle, now)
      .run();

    return NextResponse.json({
      ok: true,
      origami: {
        id,
        fromMe: true,
        fromName: user.display_name,
        content,
        foldType,
        paperStyle,
        isOpened: false,
        at: now,
      },
    });
  }

  // ACTION 3: Open Origami Note
  if (action === "open_origami") {
    const id = String(body.id ?? "");
    await db
      .prepare("UPDATE origami_notes SET is_opened = 1, opened_at = ? WHERE id = ? AND pair_id = ?")
      .bind(now, id, pairId)
      .run();

    return NextResponse.json({ ok: true, openedAt: now });
  }

  // ACTION 4: Update Couple Meta (Dates, Locations, Call Time)
  if (action === "update_meta") {
    const anniversaryDate = typeof body.anniversaryDate === "number" ? body.anniversaryDate : null;
    const reunionDate = typeof body.reunionDate === "number" ? body.reunionDate : null;
    const reunionDestination = body.reunionDestination ? String(body.reunionDestination).slice(0, 100) : null;
    const user1City = body.user1City ? String(body.user1City).slice(0, 50) : null;
    const user1Tz = body.user1Tz ? String(body.user1Tz).slice(0, 50) : null;
    const user2City = body.user2City ? String(body.user2City).slice(0, 50) : null;
    const user2Tz = body.user2Tz ? String(body.user2Tz).slice(0, 50) : null;
    const callSeconds = typeof body.addCallSeconds === "number" ? body.addCallSeconds : 0;

    await db
      .prepare(
        `INSERT INTO couple_meta (pair_id, anniversary_date, reunion_date, reunion_destination, user1_city, user1_tz, user2_city, user2_tz, total_call_seconds, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (pair_id) DO UPDATE SET
           anniversary_date = COALESCE(?, couple_meta.anniversary_date),
           reunion_date = COALESCE(?, couple_meta.reunion_date),
           reunion_destination = COALESCE(?, couple_meta.reunion_destination),
           user1_city = COALESCE(?, couple_meta.user1_city),
           user1_tz = COALESCE(?, couple_meta.user1_tz),
           user2_city = COALESCE(?, couple_meta.user2_city),
           user2_tz = COALESCE(?, couple_meta.user2_tz),
           total_call_seconds = couple_meta.total_call_seconds + ?,
           updated_at = ?`
      )
      .bind(
        pairId,
        anniversaryDate,
        reunionDate,
        reunionDestination,
        user1City,
        user1Tz,
        user2City,
        user2Tz,
        callSeconds,
        now,
        anniversaryDate,
        reunionDate,
        reunionDestination,
        user1City,
        user1Tz,
        user2City,
        user2Tz,
        callSeconds,
        now
      )
      .run();

    return NextResponse.json({ ok: true });
  }

  // ACTION 5: Add Milestone
  if (action === "add_milestone") {
    const title = String(body.title ?? "").trim().slice(0, 80);
    const date = typeof body.date === "number" ? body.date : now;
    const emoji = String(body.emoji ?? "❤️").slice(0, 4);
    const note = body.note ? String(body.note).trim().slice(0, 200) : "";

    if (!title) {
      return NextResponse.json({ message: "Title is required." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db
      .prepare("INSERT INTO milestones (id, pair_id, title, date, emoji, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, pairId, title, date, emoji, note, now)
      .run();

    return NextResponse.json({
      ok: true,
      milestone: { id, title, date, emoji, note, at: now },
    });
  }

  // ACTION 6: Delete Milestone
  if (action === "delete_milestone") {
    const id = String(body.id ?? "");
    await db.prepare("DELETE FROM milestones WHERE id = ? AND pair_id = ?").bind(id, pairId).run();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Unknown action." }, { status: 400 });
}

