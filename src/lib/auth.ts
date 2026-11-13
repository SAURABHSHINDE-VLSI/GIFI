import type { D1Database } from "./d1";

export const SESSION_COOKIE = "herz_session";
const SESSION_DAYS = 30;
// workerd rejects PBKDF2 above 100k iterations; stay at the platform ceiling.
const ITERATIONS = 100_000;
const encoder = new TextEncoder();

export type UserRow = {
  id: string;
  username: string;
  display_name: string;
  pair_id: string | null;
  created_at: number;
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !hash) return false;

  const candidate = await derive(password, fromBase64(salt), Number(iterations));
  const expected = fromBase64(hash);
  if (candidate.length !== expected.length) return false;

  let diff = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    diff |= candidate[index] ^ expected[index];
  }
  return diff === 0;
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function sessionCookie(token: string, maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearedSessionCookie() {
  return sessionCookie("", 0);
}

export async function createSession(db: D1Database, userId: string) {
  const token = randomToken();
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(await sha256(token), userId, now, now + SESSION_DAYS * 24 * 60 * 60 * 1000)
    .run();
  return token;
}

export async function currentUser(db: D1Database, request: Request): Promise<UserRow | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.pair_id, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(await sha256(token), Date.now())
    .first<UserRow>();

  return row ?? null;
}

export async function partnerFor(db: D1Database, user: UserRow) {
  if (!user.pair_id) return null;

  return db
    .prepare("SELECT id, display_name FROM users WHERE pair_id = ? AND id != ? LIMIT 1")
    .bind(user.pair_id, user.id)
    .first<{ id: string; display_name: string }>();
}
