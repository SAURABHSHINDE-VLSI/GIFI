import { NextResponse } from "next/server";

/**
 * Validates that a state-changing request originates from the same origin as the host server.
 * Returns a 403 response if cross-origin, or null if the origin check passes.
 */
export function checkSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!host) {
    return NextResponse.json(
      { message: "Forbidden: missing host header." },
      { status: 403 },
    );
  }

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host.toLowerCase() !== host) {
        return NextResponse.json(
          { message: "Forbidden: cross-origin request rejected." },
          { status: 403 },
        );
      }
      return null;
    } catch {
      return NextResponse.json(
        { message: "Forbidden: invalid origin header." },
        { status: 403 },
      );
    }
  }

  // Fallback to referer header if origin is omitted by client
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host.toLowerCase() !== host) {
        return NextResponse.json(
          { message: "Forbidden: cross-origin request rejected." },
          { status: 403 },
        );
      }
      return null;
    } catch {
      return NextResponse.json(
        { message: "Forbidden: invalid referer header." },
        { status: 403 },
      );
    }
  }

  return NextResponse.json(
    { message: "Forbidden: cross-origin request rejected." },
    { status: 403 },
  );
}
