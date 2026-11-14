export type YouTubeItem = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  thumbnail: string;
};

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Extracts the first `ytInitialData = {...}` object out of a YouTube page. */
function extractInitialData(html: string): unknown | null {
  const marker = /ytInitialData"?\]?\s*=\s*/.exec(html);
  if (!marker) return null;

  const start = html.indexOf("{", marker.index + marker[0].length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const char = html[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function collectRenderers(node: unknown, out: Record<string, any>[], cap: number) {
  if (out.length >= cap) return;

  if (Array.isArray(node)) {
    for (const item of node) collectRenderers(item, out, cap);
    return;
  }

  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  if (record.videoRenderer && typeof record.videoRenderer === "object") {
    out.push(record.videoRenderer as Record<string, any>);
  }

  for (const value of Object.values(record)) {
    if (out.length >= cap) return;
    if (value && typeof value === "object") collectRenderers(value, out, cap);
  }
}

function textOf(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, any>;
  if (typeof record.simpleText === "string") return record.simpleText;
  if (Array.isArray(record.runs)) {
    return record.runs.map((run: any) => (typeof run?.text === "string" ? run.text : "")).join("");
  }
  return "";
}

function toItems(raw: Record<string, any>[], limit: number): YouTubeItem[] {
  const seen = new Set<string>();
  const items: YouTubeItem[] = [];

  for (const renderer of raw) {
    const id = renderer?.videoId;
    if (typeof id !== "string" || !YOUTUBE_ID_REGEX.test(id) || seen.has(id)) continue;

    const title = textOf(renderer.title).trim();
    if (!title) continue;

    seen.add(id);
    items.push({
      id,
      title,
      channel: textOf(renderer.ownerText).trim() || textOf(renderer.longBylineText).trim(),
      duration: textOf(renderer.lengthText).trim(),
      views: textOf(renderer.viewCountText).trim(),
      thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    });

    if (items.length >= limit) break;
  }

  return items;
}

/**
 * Reads YouTube's public search pages server-side.
 *
 * YouTube's /feed/trending page no longer ships its video list in the initial
 * HTML (it loads through InnerTube after hydration), so the "home" view uses a
 * broad "trending" search instead, which returns the same kind of content.
 */
const HOME_QUERY = "trending";

export async function fetchYouTubeFeed(query: string | null, limit = 18): Promise<YouTubeItem[]> {
  const search = query ?? HOME_QUERY;
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(search)}&sp=EgIQAQ%253D%253D&hl=en`;

  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9" },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("youtube_unreachable");

  const data = extractInitialData(await response.text());
  if (!data) throw new Error("youtube_unparsable");

  const raw: Record<string, any>[] = [];
  collectRenderers(data, raw, limit * 4);

  return toItems(raw, limit);
}
