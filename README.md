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
- **Local Background Blur**: Privacy blur (Off / Light / Strong) powered by client-side MediaPipe WASM segmentation.
- **Microphone Noise Suppression**: Browser-native audio noise filtering with persistent echo cancellation.
- **Picture-in-Picture & Auto-Minimize**: Floating Document PiP window with camera/screen tiles, in-PiP controls, and auto-minimize on tab switch.

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

## Effects (Blur and Noise Suppression)

HERZ provides real-time local camera background blur and microphone noise suppression. Both effects can be configured during the pre-join preview and dynamically toggled during an active call via the in-call Effects dock button.

### 1. Camera Background Blur
- **Local Device Processing**: Segmentation is computed client-side using `@livekit/track-processors` (pinned to `0.8.2`) powered by Google MediaPipe's Selfie Segmentation model via WebAssembly. Video frames never leave your local device for effect processing.
- **Modes**:
  - `Off`: Processor is stopped and detached to preserve CPU/GPU resources.
  - `Light`: Blur radius 10px for subtle background softening.
  - `Strong`: Blur radius 20px for complete background privacy.
- **Self-Hosted Assets**:
  - MediaPipe Tasks Vision WASM files: `/mediapipe/wasm/` (`vision_wasm_internal.wasm`, `vision_wasm_internal.js`, `vision_wasm_nosimd_internal.wasm`, `vision_wasm_nosimd_internal.js`).
  - Selfie Segmentation TFLite Model: `/models/selfie_segmenter.tflite` (~249 KB).
  - Assets and models are licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
- **Browser & Device Support Limits**:
  - Requires WebAssembly and SIMD support in the browser. Checked at runtime via `supportsBackgroundProcessors()`.
  - If unsupported, the blur controls gracefully degrade and remain hidden.
  - Devices with 4 or fewer logical CPU cores (`navigator.hardwareConcurrency <= 4`) display an advisory notice ("May slow older devices.").
  - When the browser tab is hidden, background processing is paused automatically to conserve battery and CPU.

### 2. Microphone Noise Suppression
- **Browser-Native Audio Processing**: Utilizes standard browser audio constraints (`noiseSuppression: true | false`, `echoCancellation: true`, `autoGainControl: true`) without external paid services or cloud audio processing.
- **Echo Cancellation**: Permanently enabled to ensure echo-free audio during Watch Together sessions played over device speakers.
- **Seamless Re-acquisition**: Toggling noise suppression restarts the local microphone track (`audioTrack.restartTrack()`) with the updated constraints while preserving the active mute state without audible clicks or unmuting flashes.

### 3. Preferences Persistence
- User selections are strictly validated and stored locally in browser storage (`herz:effects` key in `localStorage`), automatically remembered across sessions and reloaded upon joining.

---

## Minimize (Picture-in-Picture)

HERZ allows users to multitask while keeping the video call alive in a floating window.

### 1. Document Picture-in-Picture (Mode A)
- Available on Chromium browsers supporting the Document Picture-in-Picture API (Chrome / Edge 116+).
- Opens an interactive, always-on-top window that renders a custom floating call interface with cloned stylesheets.
- **Adaptive Multi-Track Layout**:
  - Video Call view: Displays the partner's camera feed with local user corner tile.
  - Screen Share view: Elevates the partner's screen share to full width with partner camera tile overlaid.
- **Interactive Controls**: Non-blocking in-PiP mic toggle, camera toggle, Watch Together playback controls, and a safe two-step "End Call" confirmation.

### 2. Standard Video Picture-in-Picture Fallback (Mode B)
- On browsers that do not support Document PiP (such as Safari and Firefox), the app falls back to HTMLVideoElement Picture-in-Picture (`video.requestPictureInPicture()`) on the remote video stream.

### 3. Auto-Minimize on Tab Switch
- Configurable toggle in the Effects popover ("Auto-minimize when I switch tabs"), remembered in `localStorage` under `herz:autopip` (defaults to `true`).
- Automatically transitions the active call to Picture-in-Picture when switching away from the tab (`visibilitychange` listener), provided Document PiP permission is granted.

### 4. Watch Together in PiP
- Cross-origin iframe restrictions prevent the YouTube video player itself from floating inside the PiP window.
- However, YouTube audio continues streaming seamlessly in the background, and the PiP window provides synchronized playback controls (Play/Pause, Rewind, title display) to control the shared session without returning to the main tab.

---

## Screen-Share Audio & Watch Together Synchronization

### 1. Screen-Share Audio
- **High-Fidelity Audio Streaming**: When a partner shares content, screen audio is published alongside the video track as a dedicated `ScreenShareAudio` WebRTC stream.
- **How to Use**:
  - In Google Chrome or Microsoft Edge, click the **Share Screen** button.
  - In the browser dialog, select the **Chrome Tab** or **Edge Tab** tab.
  - Check the checkbox labeled **"Also share tab audio"** at the bottom-left before confirming.
  - If sharing starts without audio, HERZ displays a helpful advisory toast reminding you how to include sound.
- **Audio Capture Optimization**: Voice filters (`echoCancellation`, `noiseSuppression`, `autoGainControl`) are disabled on screen audio capture so shared music and video audio retain full dynamic range and fidelity. `restrictOwnAudio: true` keeps call participant voices out of the captured stream.
- **Known Browser Limits**:
  - **macOS Desktop/Window Share**: macOS restricts system-wide audio capture from the browser. To share sound on macOS, you must share a browser tab rather than an entire screen or external application window.
  - **Mobile Browsers**: iOS Safari and Android Chrome do not support tab or system audio sharing via `getDisplayMedia`.
  - **Receiving Audio Autoplay**: If browser autoplay policies temporarily block remote screen audio, HERZ displays a discrete floating "Tap to enable sound" button.

### 2. Watch Together Synchronization Protocol
- **Shared Server Clock (`/api/time`)**: To eliminate local device clock skew, clients synchronize with server time using lightweight NTP-style round-trip time (RTT) measurements, maintaining accurate offsets via `serverNow()`.
- **Leader-Laggard Sync Logic (`decideSync`)**:
  - Rather than ping-ponging positions, the client furthest along in playback is recognized as the "leader".
  - If the "laggard" drifts behind the leader by more than the **1.5-second deadband**, only the laggard smoothly seeks forward to the leader's projected position.
  - The leader never jumps backward, completely eliminating stutter and feedback loops.
- **Stability Guards**:
  - **User-Action Guard**: Automatic sync pauses for 6 seconds following any manual user seek, play, or pause to allow smooth player buffering.
  - **Cooldown**: A 5-second cooldown enforces spacing between automated correction seeks.
- **Green Sync Toggle**:
  - Stage controls feature an accessible sync toggle with a pulsing green indicator (`#5fd08a`) showing "Synced" when active.
  - Toggling turns off automatic drift correction (e.g. for partners on different network speeds), while manual play/pause controls remain synchronized.
  - Sync state is remembered in local storage under `herz:watchsync`.
- **Spotify Streaming Note**: Spotify widgets operate inside cross-origin sandboxed iframes that do not expose player playback timestamps or programmatic seek APIs to host pages. HERZ synchronizes track selection and playback start between partners, but millisecond frame-sync is physically limited by the Spotify embed SDK.

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
