export type ValidMediaType = "youtube" | "spotify";

export const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
export const SPOTIFY_ID_REGEX = /^(track|playlist|album|artist|episode)\/[A-Za-z0-9]{10,32}$/;

export function isValidMediaType(type: unknown): type is ValidMediaType {
  return type === "youtube" || type === "spotify";
}

export function isValidYouTubeId(id: unknown): id is string {
  return typeof id === "string" && YOUTUBE_ID_REGEX.test(id);
}

export function isValidSpotifyId(id: unknown): id is string {
  return typeof id === "string" && SPOTIFY_ID_REGEX.test(id);
}

export function isValidMediaId(type: ValidMediaType, id: unknown): id is string {
  if (type === "youtube") return isValidYouTubeId(id);
  if (type === "spotify") return isValidSpotifyId(id);
  return false;
}

export function isValidTitle(title: unknown): title is string {
  return typeof title === "string" && title.length <= 100;
}

export function sanitizeTitle(title: unknown, fallback = "Media"): string {
  if (typeof title !== "string") return fallback;
  const trimmed = title.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 100);
}

export function isValidStartTime(time: unknown): time is number {
  return typeof time === "number" && Number.isFinite(time) && time >= 0 && time <= 86400;
}

export function buildYouTubeEmbedUrl(id: string, start = 0, origin = ""): string {
  if (!isValidYouTubeId(id)) return "";
  const safeStart = Math.max(0, Math.min(86400, Math.floor(start)));
  const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : "";
  return `https://www.youtube.com/embed/${id}?enablejsapi=1&autoplay=1&start=${safeStart}${originParam}`;
}

export function buildSpotifyEmbedUrl(id: string): string {
  if (!isValidSpotifyId(id)) return "";
  return `https://open.spotify.com/embed/${id}?utm_source=generator&theme=0`;
}

export type ValidWatchClock = {
  videoId: string;
  title: string;
  baseTime: number;
  epochTimestamp: number;
  isPlaying: boolean;
  version: number;
  mediaType: ValidMediaType;
};

export function validateWatchClock(clock: unknown): ValidWatchClock | null {
  if (!clock || typeof clock !== "object") return null;
  const c = clock as Record<string, unknown>;

  const mediaType: ValidMediaType = isValidMediaType(c.mediaType) ? c.mediaType : "youtube";
  if (!isValidMediaId(mediaType, c.videoId)) return null;

  if (typeof c.title !== "string" || c.title.length > 100) return null;
  if (typeof c.baseTime !== "number" || !Number.isFinite(c.baseTime) || c.baseTime < 0 || c.baseTime > 86400) {
    return null;
  }
  if (typeof c.epochTimestamp !== "number" || !Number.isFinite(c.epochTimestamp) || c.epochTimestamp <= 0) {
    return null;
  }
  if (typeof c.isPlaying !== "boolean") return null;
  if (typeof c.version !== "number" || !Number.isFinite(c.version)) return null;

  return {
    videoId: c.videoId as string,
    title: c.title,
    baseTime: c.baseTime,
    epochTimestamp: c.epochTimestamp,
    isPlaying: c.isPlaying,
    version: c.version,
    mediaType,
  };
}

export type ValidIncomingWatchMessage =
  | { t: "watch_clock_req" }
  | { t: "watch_behind_sync_req"; localTime: number }
  | { t: "watch_clock_sync"; clock: ValidWatchClock; reason?: string }
  | { t: "watch_load"; videoId: string; title: string; mediaType: ValidMediaType; startTime: number }
  | { t: "watch_close" };

export function validateIncomingWatchMessage(msg: unknown): ValidIncomingWatchMessage | null {
  if (!msg || typeof msg !== "object") return null;
  const m = msg as Record<string, unknown>;

  if (m.t === "watch_clock_req") {
    return { t: "watch_clock_req" };
  }

  if (m.t === "watch_behind_sync_req") {
    if (typeof m.localTime !== "number" || !Number.isFinite(m.localTime) || m.localTime < 0 || m.localTime > 86400) {
      return null;
    }
    return { t: "watch_behind_sync_req", localTime: m.localTime };
  }

  if (m.t === "watch_clock_sync") {
    const clock = validateWatchClock(m.clock);
    if (!clock) return null;
    const reason = typeof m.reason === "string" ? m.reason.slice(0, 50) : undefined;
    return { t: "watch_clock_sync", clock, reason };
  }

  if (m.t === "watch_load") {
    const mediaType: ValidMediaType = isValidMediaType(m.mediaType) ? m.mediaType : "youtube";
    if (!isValidMediaId(mediaType, m.videoId)) return null;
    const title = typeof m.title === "string" ? sanitizeTitle(m.title) : "Media";
    const startTime = isValidStartTime(m.startTime) ? m.startTime : 0;
    return { t: "watch_load", videoId: m.videoId, title, mediaType, startTime };
  }

  if (m.t === "watch_close") {
    return { t: "watch_close" };
  }

  return null;
}
