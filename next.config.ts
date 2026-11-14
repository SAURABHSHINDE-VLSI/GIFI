import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

function getLiveKitOrigins(): string {
  const url = process.env.LIVEKIT_URL;
  if (!url) return "wss: https:";
  try {
    const parsed = new URL(url.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://"));
    const host = parsed.host;
    return `https://${host} wss://${host}`;
  } catch {
    return "wss: https:";
  }
}

const livekitOrigins = getLiveKitOrigins();

// MediaPipe gesture detection loads its wasm loader scripts and landmarker
// models from CDNs, so those hosts must be reachable under the CSP.
const mediapipeScriptOrigins = "https://cdn.jsdelivr.net";
const mediapipeConnectOrigins = "https://cdn.jsdelivr.net https://storage.googleapis.com";

const isDev = process.env.NODE_ENV === "development";
const scriptSrc = `script-src 'self' ${mediapipeScriptOrigins} https://open.spotify.com 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`;

const cspHeader = [
  "default-src 'self'",
  `connect-src 'self' ${livekitOrigins} ${mediapipeConnectOrigins} https://open.spotify.com`,
  "media-src 'self' blob:",
  "img-src 'self' data: blob: https://i.ytimg.com https://i.scdn.co",
  `worker-src 'self' blob: ${mediapipeScriptOrigins}`,
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://open.spotify.com",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), display-capture=(self)",
          },
        ],
      },
    ];
  },
};

initOpenNextCloudflareForDev({ configPath: "./wrangler.jsonc" });

export default nextConfig;
