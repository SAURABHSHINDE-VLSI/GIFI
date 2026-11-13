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

const cspHeader = [
  "default-src 'self'",
  `connect-src 'self' ${livekitOrigins}`,
  "media-src 'self' blob:",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
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
