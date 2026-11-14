# HERZ — Private Two-Person Sanctuary & Video-Call App

HERZ is an intimate, private two-person video-calling app built for couples. Each couple pairs once using a secure one-time code, permanently locking the room to only the two of them.

## Features
- **Locked Sanctuary**: End-to-end access control; only the paired couple can enter the call room.
- **HD Video & Audio**: Real-time WebRTC media powered by LiveKit.
- **Screen Sharing**: Ultra-clean full-view screen sharing with system audio.
- **Watch Together**: Synchronized YouTube playback with in-dock controls (play/pause, -10s rewind, video switcher).
- **In-Call Chat & Photo Sharing**: Real-time messaging with delivered/seen receipts and image chunking.
- **Expressive Reactions**: Floating heart bursts and flying kisses with sound effects.
- **Smart Voice Ducking**: Media automatically lowers to 20% volume when either partner speaks so voices stay crystal clear.

## The Stack
- **Framework**: Next.js 16 (App Router)
- **Edge Deployment**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Database**: Cloudflare D1 (serverless SQLite)
- **Media Engine**: LiveKit WebRTC (LiveKit Cloud or self-hosted)

---

## Getting Started

### 1. Prerequisites
- Node.js 22.12.0+ (required by Wrangler).
- A Cloudflare account with Wrangler CLI.
- A [LiveKit Cloud](https://cloud.livekit.io) project (or self-hosted LiveKit server).

### 2. Installation
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your LiveKit credentials in `.env.local`:
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

### 4. Database Setup (Cloudflare D1)
1. Create a D1 database:
   ```bash
   npx wrangler d1 create herz
   ```
2. Note the `database_id` printed in the terminal and update it in `wrangler.jsonc`:
   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "herz",
       "database_id": "<your-database-id-here>"
     }
   ]
   ```
3. Run database migrations:
   - **For local development**:
     ```bash
     npx wrangler d1 migrations apply herz --local
     ```
   - **For production**:
     ```bash
     npx wrangler d1 migrations apply herz --remote
     ```
   - **To inspect migration status**:
     ```bash
     npx wrangler d1 migrations list herz --local
     npx wrangler d1 migrations list herz --remote
     ```
   Migrations are located in `migrations/`:
   - `0001_init.sql`: Core tables (`users`, `pairs`, `invites`, `sessions`) and indexes.
   - `0002_rate_limits_and_last_seen.sql`: Rate limiting table and `last_seen_at` column.

---

## Running Locally
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment (Cloudflare Workers via OpenNext)
1. Build the production OpenNext worker bundle:
   ```bash
   npm run build:worker
   ```
2. Deploy to Cloudflare Workers:
   ```bash
   npx wrangler deploy
   ```

---

## Utility Scripts
- **Kick / Reset Active Room**:
  Disconnects all active participants in a specific LiveKit room:
  ```bash
  node scripts/kick-room.js <roomName>
  ```

---

## Security Notes

- **Content Security Policy (CSP)**:
  Configured in `next.config.ts` via response headers.
  - `default-src 'self'`
  - `script-src`: Restricts script execution. In production, `'unsafe-eval'` is completely removed; `'wasm-unsafe-eval'` is permitted for self-hosted MediaPipe WASM hand gesture tracking, and `'unsafe-inline'` is retained for OpenNext client bootstrap scripts.
  - `frame-src`: Restricted strictly to verified embed origins: `https://www.youtube.com`, `https://www.youtube-nocookie.com`, and `https://open.spotify.com`. Third-party proxy domains (e.g. Netmirror) are completely disallowed.
  - `img-src`: Restricted to `'self' data: blob: https://i.ytimg.com https://i.scdn.co`.
  - `connect-src`: Restricted to `'self'` and the validated LiveKit WebSocket/HTTPS origins configured in environment variables.
  - `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

- **Rate Limiting**:
  Stored in Cloudflare D1 via the `rate_limits` table:
  - **Login**: Max 10 attempts per 15 minutes per username + IP.
  - **Sign-up**: Max 5 registrations per hour per IP.
  - **Pairing (Join)**: Max 10 attempts per 15 minutes per user + IP.
  - **Password Change**: Max 5 attempts per 15 minutes per user + IP.
  - **Moments Upload**: Max 30 photos per hour per user.
  - **Ambient Actions**: Max 60 interactions per hour per user.
  - All rate-limited routes return HTTP `429 Too Many Requests` with friendly guidance and a standard `Retry-After` header.

- **Origin & Session Protection**:
  - Mutating API endpoints require matching `Origin` and `Host` headers (`checkSameOrigin`).
  - Session cookies use the prefix `__Host-herz_session` with `Path=/`, `HttpOnly`, `SameSite=Lax`, and `Secure` in production environments.

- **LiveKit WebRTC & SFU Privacy**:
  - Audio, video, and data channel messages are relayed through the **LiveKit SFU (Selective Forwarding Unit)**. While encrypted in transit using standard WebRTC DTLS-SRTP, streams pass through the LiveKit server infrastructure and are **not end-to-end encrypted (E2EE)** peer-to-peer.
  - Room access tokens are cryptographically signed on the server and scoped exclusively to the paired couple's room ID.
