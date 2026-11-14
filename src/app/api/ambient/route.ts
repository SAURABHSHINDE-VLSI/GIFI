import { NextResponse } from "next/server";
import { getDb } from "@/lib/d1";
import { currentUser } from "@/lib/auth";
import { checkSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_DATE_TS = 946684800000; // 2000-01-01
const MAX_DATE_TS = 4102444800000; // 2100-01-01

function isValidTimeZone(tz: string): boolean {
  if (typeof tz !== "string" || !tz || tz.length > 60) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function isValidTimestamp(val: unknown): val is number {
  return typeof val === "number" && Number.isFinite(val) && val >= MIN_DATE_TS && val <= MAX_DATE_TS;
}

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

  // 1. Couple Meta (No fake seeding: if not found, return null)
  const meta = await db
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

  // 2. Love Signals (last 24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const signalsResult = await db
    .prepare(
      "SELECT id, pair_id, from_user_id, from_name, created_at FROM love_signals WHERE pair_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 50",
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
      "SELECT id, pair_id, from_user_id, from_name, content, fold_type, paper_style, is_opened, opened_at, created_at FROM origami_notes WHERE pair_id = ? ORDER BY created_at DESC LIMIT 40",
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

  // 4. Milestones (No fake seeding: return actual rows)
  const milestonesResult = await db
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

  return NextResponse.json({
    userId: user.id,
    userName: user.display_name,
    meta: meta ?? null,
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

type HeartSignalAction = {
  action: "heart_signal";
};

type SendOrigamiAction = {
  action: "send_origami";
  content: string;
  foldType?: string;
  paperStyle?: string;
};

type OpenOrigamiAction = {
  action: "open_origami";
  id: string;
};

type UpdateMetaAction = {
  action: "update_meta";
  anniversaryDate?: number | null;
  reunionDate?: number | null;
  reunionDestination?: string | null;
  user1City?: string | null;
  user1Tz?: string | null;
  user2City?: string | null;
  user2Tz?: string | null;
  addCallSeconds?: number;
};

type AddMilestoneAction = {
  action: "add_milestone";
  title: string;
  date?: number;
  emoji?: string;
  note?: string | null;
};

type DeleteMilestoneAction = {
  action: "delete_milestone";
  id: string;
};

type AmbientActionPayload =
  | HeartSignalAction
  | SendOrigamiAction
  | OpenOrigamiAction
  | UpdateMetaAction
  | AddMilestoneAction
  | DeleteMilestoneAction;

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
  let body: AmbientActionPayload;
  try {
    body = (await request.json()) as AmbientActionPayload;
  } catch {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("action" in body)) {
    return NextResponse.json({ message: "Action required." }, { status: 400 });
  }

  const now = Date.now();

  // ACTION 1: Send Heart Signal ("Thinking of You")
  if (body.action === "heart_signal") {
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
  if (body.action === "send_origami") {
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 500) : "";
    if (!content) {
      return NextResponse.json({ message: "Note cannot be empty." }, { status: 400 });
    }

    const foldType = typeof body.foldType === "string" && ["plane", "heart", "crane"].includes(body.foldType)
      ? body.foldType
      : "plane";

    const paperStyle = typeof body.paperStyle === "string" && ["sakura", "vintage", "midnight", "mint"].includes(body.paperStyle)
      ? body.paperStyle
      : "sakura";

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO origami_notes (id, pair_id, from_user_id, from_name, content, fold_type, paper_style, is_opened, opened_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
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
  if (body.action === "open_origami") {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ message: "Note ID is required." }, { status: 400 });
    }

    const note = await db
      .prepare("SELECT id, from_user_id, is_opened FROM origami_notes WHERE id = ? AND pair_id = ?")
      .bind(id, pairId)
      .first<{ id: string; from_user_id: string; is_opened: number }>();

    if (!note) {
      return NextResponse.json({ message: "Note not found." }, { status: 404 });
    }

    // Only the recipient can open a surprise origami note, not the sender
    if (note.from_user_id === user.id) {
      return NextResponse.json(
        { message: "You cannot open your own note. It is a surprise for your partner!" },
        { status: 403 },
      );
    }

    await db
      .prepare("UPDATE origami_notes SET is_opened = 1, opened_at = ? WHERE id = ? AND pair_id = ?")
      .bind(now, id, pairId)
      .run();

    return NextResponse.json({ ok: true, openedAt: now });
  }

  // ACTION 4: Update Couple Meta (Dates, Locations, Call Time)
  if (body.action === "update_meta") {
    // Validate time zones
    if (body.user1Tz !== undefined && body.user1Tz !== null) {
      if (typeof body.user1Tz !== "string" || !isValidTimeZone(body.user1Tz)) {
        return NextResponse.json({ message: "Invalid user1 time zone." }, { status: 400 });
      }
    }
    if (body.user2Tz !== undefined && body.user2Tz !== null) {
      if (typeof body.user2Tz !== "string" || !isValidTimeZone(body.user2Tz)) {
        return NextResponse.json({ message: "Invalid user2 time zone." }, { status: 400 });
      }
    }

    // Validate timestamps (clamp between year 2000 and 2100)
    let anniversaryDate: number | null = null;
    if (body.anniversaryDate !== undefined && body.anniversaryDate !== null) {
      if (!isValidTimestamp(body.anniversaryDate)) {
        return NextResponse.json({ message: "Anniversary date must be between year 2000 and 2100." }, { status: 400 });
      }
      anniversaryDate = body.anniversaryDate;
    }

    let reunionDate: number | null = null;
    if (body.reunionDate !== undefined && body.reunionDate !== null) {
      if (!isValidTimestamp(body.reunionDate)) {
        return NextResponse.json({ message: "Reunion date must be between year 2000 and 2100." }, { status: 400 });
      }
      reunionDate = body.reunionDate;
    }

    // Validate addCallSeconds
    let callSeconds = 0;
    if (body.addCallSeconds !== undefined) {
      if (
        typeof body.addCallSeconds !== "number" ||
        !Number.isInteger(body.addCallSeconds) ||
        body.addCallSeconds < 0 ||
        body.addCallSeconds > 86400
      ) {
        return NextResponse.json(
          { message: "addCallSeconds must be an integer between 0 and 86400 (up to 24 hours)." },
          { status: 400 },
        );
      }
      callSeconds = body.addCallSeconds;
    }

    // Enforce string lengths
    const reunionDestination =
      typeof body.reunionDestination === "string" ? body.reunionDestination.trim().slice(0, 100) : null;
    const user1City = typeof body.user1City === "string" ? body.user1City.trim().slice(0, 50) : null;
    const user1Tz = typeof body.user1Tz === "string" ? body.user1Tz.trim() : null;
    const user2City = typeof body.user2City === "string" ? body.user2City.trim().slice(0, 50) : null;
    const user2Tz = typeof body.user2Tz === "string" ? body.user2Tz.trim() : null;

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
           updated_at = ?`,
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
        now,
      )
      .run();

    return NextResponse.json({ ok: true });
  }

  // ACTION 5: Add Milestone
  if (body.action === "add_milestone") {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
    if (!title) {
      return NextResponse.json({ message: "Title is required." }, { status: 400 });
    }

    let date = now;
    if (body.date !== undefined) {
      if (!isValidTimestamp(body.date)) {
        return NextResponse.json({ message: "Milestone date must be between year 2000 and 2100." }, { status: 400 });
      }
      date = body.date;
    }

    // Safely parse emoji without splitting surrogate pairs
    const rawEmoji = typeof body.emoji === "string" ? body.emoji.trim() : "❤️";
    const emoji = Array.from(rawEmoji).slice(0, 2).join("") || "❤️";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";

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
  if (body.action === "delete_milestone") {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ message: "Milestone ID required." }, { status: 400 });
    }
    await db.prepare("DELETE FROM milestones WHERE id = ? AND pair_id = ?").bind(id, pairId).run();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Unknown action." }, { status: 400 });
}
