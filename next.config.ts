import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

function getLiveKitOrigins(): string {
  const url = process.env.LIVEKIT_URL;
  let specificOrigin = "";
  if (url) {
    try {
      const parsed = new URL(url.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://"));
      specificOrigin = `https://${parsed.host} wss://${parsed.host} `;
    } catch {
      // ignore
    }
  }
  return `${specificOrigin}https://*.livekit.cloud wss://*.livekit.cloud https://*.sslip.io wss://*.sslip.io https://129.225.107.71.sslip.io wss://129.225.107.71.sslip.io`.trim();
}

const livekitOrigins = getLiveKitOrigins();

// MediaPipe gesture detection loads its wasm loader scripts and landmarker
// models from CDNs, so those hosts must be reachable under the CSP.
const mediapipeScriptOrigins = "https://cdn.jsdelivr.net";
const mediapipeConnectOrigins = "https://cdn.jsdelivr.net https://storage.googleapis.com";

const scriptSrc = `script-src 'self' ${mediapipeScriptOrigins} https://open.spotify.com 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'`;

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
  devIndicators: false,
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
