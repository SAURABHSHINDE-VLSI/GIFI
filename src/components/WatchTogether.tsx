"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { VideoTrack } from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";
import { initialOf } from "@/lib/ui";
import { Icon } from "./Icons";
import {
  buildSpotifyEmbedUrl,
  buildYouTubeEmbedUrl,
  isValidMediaId,
  isValidMediaType,
  isValidSpotifyId,
  isValidStartTime,
  isValidYouTubeId,
  sanitizeTitle,
  validateIncomingWatchMessage,
  type ValidMediaType,
  type ValidWatchClock,
} from "@/lib/validate";

export type MediaType = ValidMediaType;
export type SharedWatchClock = ValidWatchClock;

type Props = {
  room: Room;
  isActive: boolean;
  onClose: () => void;
  onVideoStateChange?: (hasVideo: boolean) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  togglePlayRef?: React.MutableRefObject<(() => void) | null>;
  resyncRef?: React.MutableRefObject<(() => void) | null>;
  rewindRef?: React.MutableRefObject<((seconds?: number) => void) | null>;
  openPickerRef?: React.MutableRefObject<(() => void) | null>;
  isDucked?: boolean;
  syncEnabled?: boolean;
  onReact?: (emoji: string) => void;
  remoteCam?: TrackReference;
  localCam?: TrackReference;
  partnerLabel?: string;
  selfName?: string;
  partner?: any;
  micOn?: boolean;
  chatVisible?: boolean;
};

const ROMANTIC_SUGGESTIONS: { title: string; id: string; desc: string; type: MediaType }[] = [
  { title: "Cozy Lofi Beats", id: "5yx6BWlEVcY", desc: "Late-night soft beats to relax together", type: "youtube" },
  { title: "Candlelight Jazz", id: "Dx5qFachd3A", desc: "Warm romantic jazz coffee vibes", type: "youtube" },
  { title: "Rain & Fireplace", id: "mPZkdNFkNps", desc: "Gentle rain sounds & cozy crackling fire", type: "youtube" },
  { title: "Spotify: Romantic Love", id: "playlist/37i9dQZF1DXcBWIGoYBM5M", desc: "Curated Spotify acoustic love songs", type: "spotify" },
  { title: "Spotify: Lofi & Chill", id: "playlist/37i9dQZF1DXdLEN7aqioXM", desc: "Mellow vibes for late night conversations", type: "spotify" },
];

type WatchPlatform = "youtube" | "spotify" | "netflix" | "prime";

type WatchFeedItem = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  thumbnail: string;
};

const YOUTUBE_TOPICS = ["All", "Music", "Mixes", "Chill", "Comedy", "Romantic", "Lo-fi", "News", "Bollywood"];

const PLATFORM_TABS: { id: WatchPlatform; label: string }[] = [
  { id: "youtube", label: "YouTube" },
  { id: "spotify", label: "Spotify" },
  { id: "netflix", label: "Netflix" },
  { id: "prime", label: "Prime Video" },
];

const BROWSER_STATE_KEY = "herz:watch-browser";

function PlatformLogo({ id }: { id: WatchPlatform }) {
  if (id === "youtube") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1" y="4.6" width="22" height="14.8" rx="4.6" fill="#ff0033" />
        <path d="M10 9.1v5.8l5.2-2.9z" fill="#fff" />
      </svg>
    );
  }

  if (id === "spotify") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#1db954" />
        <path d="M6.6 9.3c3.7-1.1 7.8-.7 10.9 1.1" stroke="#0d1a10" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M7.4 12.5c3-.9 6.4-.5 8.9.9" stroke="#0d1a10" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M8.2 15.6c2.3-.7 4.8-.4 6.8.7" stroke="#0d1a10" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === "netflix") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.4 3h3.1l4.9 12.1V3h3.2v18h-3.2L9.6 8.7V21H6.4z" fill="#e50914" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16.1c3 0 5.4-1.7 6.1-2.5-1.8.9-3.9 1.4-6.1 1.4s-4.3-.5-6.1-1.4c.7.8 3.1 2.5 6.1 2.5z" fill="#00a8e1" />
      <path d="M5.4 7.4c2.2 1.2 4.3 1.8 6.6 1.8s4.4-.6 6.6-1.8v1.9c-2.2 1.2-4.3 1.8-6.6 1.8s-4.4-.6-6.6-1.8z" fill="#00a8e1" opacity="0.85" />
      <path d="M7.2 11.6c1.6.6 3.2.9 4.8.9s3.2-.3 4.8-.9v1.6c-1.6.6-3.2.9-4.8.9s-3.2-.3-4.8-.9z" fill="#00a8e1" opacity="0.55" />
    </svg>
  );
}

const EXTERNAL_PLATFORMS: Record<"netflix" | "prime", { name: string; url: string; note: string }> = {
  netflix: {
    name: "Netflix",
    url: "https://www.netflix.com",
    note: "Netflix blocks other sites from embedding its player, so it opens in its own tab. Leave the call running and press play in both tabs to watch together.",
  },
  prime: {
    name: "Prime Video",
    url: "https://www.primevideo.com",
    note: "Prime Video blocks other sites from embedding its player, so it opens in its own tab. Leave the call running and press play in both tabs to watch together.",
  },
};

export function extractMediaInfo(url: string): { type: MediaType; id: string; title: string } | null {
  if (!url) return null;
  const trimmed = url.trim();

  // 1. Spotify URI format (e.g. spotify:track:..., spotify:playlist:...)
  const uriMatch = trimmed.match(/^spotify:(track|playlist|album|artist|episode):([a-zA-Z0-9]+)/);
  if (uriMatch) {
    const kind = uriMatch[1];
    const id = uriMatch[2];
    const fullId = `${kind}/${id}`;
    if (!isValidSpotifyId(fullId)) return null;
    const kindCap = kind.charAt(0).toUpperCase() + kind.slice(1);
    return {
      type: "spotify",
      id: fullId,
      title: `Spotify ${kindCap}`,
    };
  }

  // 2. Spotify URL with optional user path (e.g. open.spotify.com/user/xyz/playlist/...)
  const spotifyUserMatch = trimmed.match(/open\.spotify\.com\/user\/[^/]+\/playlist\/([a-zA-Z0-9]+)/);
  if (spotifyUserMatch) {
    const fullId = `playlist/${spotifyUserMatch[1]}`;
    if (!isValidSpotifyId(fullId)) return null;
    return {
      type: "spotify",
      id: fullId,
      title: "Spotify Playlist",
    };
  }

  // 3. Standard Spotify web URL (open.spotify.com/track/...)
  const spotifyMatch = trimmed.match(/open\.spotify\.com\/(track|playlist|album|artist|episode)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) {
    const kind = spotifyMatch[1];
    const id = spotifyMatch[2];
    const fullId = `${kind}/${id}`;
    if (!isValidSpotifyId(fullId)) return null;
    const kindCap = kind.charAt(0).toUpperCase() + kind.slice(1);
    return {
      type: "spotify",
      id: fullId,
      title: `Spotify ${kindCap}`,
    };
  }

  // 4. YouTube URL
  const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const ytMatch = trimmed.match(ytRegExp);
  if (ytMatch && ytMatch[2] && isValidYouTubeId(ytMatch[2])) {
    return {
      type: "youtube",
      id: ytMatch[2],
      title: "Shared YouTube Video",
    };
  }

  // 5. Raw 11-char YouTube ID pasted directly
  if (isValidYouTubeId(trimmed)) {
    return {
      type: "youtube",
      id: trimmed,
      title: "Shared YouTube Video",
    };
  }

  return null;
}

export function extractYouTubeId(url: string) {
  const info = extractMediaInfo(url);
  return info?.type === "youtube" ? info.id : null;
}

/**
 * Computes current playback position from the epoch anchor master clock.
 * Independent of cross-origin iframe lag or CORS blocking.
 */
export function formatClockTime(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function computeClockTime(clock: SharedWatchClock | null): number {
  if (!clock || !clock.videoId) return 0;
  if (!clock.isPlaying) return Math.max(0, clock.baseTime);
  const elapsed = Math.max(0, (Date.now() - clock.epochTimestamp) / 1000);
  return Math.max(0, clock.baseTime + elapsed);
}

/**
 * Resolves the sync target timestamp between local and remote partners.
 * 1. Whichever YouTube video is behind (smaller timestamp), sync starts from there (Math.min),
 *    so neither partner misses any content.
 * 2. If one partner has just started/joined (<= 2s) while the other is already watching (> 2s),
 *    NEVER restart the video from 0:00! Instead, catch up to the active watchhead.
 */
export function resolveBehindSyncTime(localTime: number, remoteTime: number): number {
  const l = Math.max(0, localTime || 0);
  const r = Math.max(0, remoteTime || 0);

  if (l <= 2 && r > 2) return r;
  if (r <= 2 && l > 2) return l;

  return Math.min(l, r);
}

export default function WatchTogether({
  room,
  isActive,
  onClose,
  onVideoStateChange,
  onPlayingChange,
  togglePlayRef,
  resyncRef,
  rewindRef,
  openPickerRef,
  isDucked = false,
  syncEnabled = true,
  remoteCam,
  localCam,
  partnerLabel = "Partner",
  selfName = "You",
  partner,
  chatVisible = false,
}: Props) {
  const [clock, setClock] = useState<SharedWatchClock | null>(null);
  const clockRef = useRef<SharedWatchClock | null>(null);
  useEffect(() => {
    clockRef.current = clock;
    onVideoStateChange?.(Boolean(clock?.videoId));
    onPlayingChange?.(Boolean(clock?.isPlaying));
  }, [clock, onVideoStateChange, onPlayingChange]);

  const [pickerModalOpen, setPickerModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<WatchPlatform>("youtube");
  const [searchQuery, setSearchQuery] = useState("");
  const [topic, setTopic] = useState("All");
  const [feedItems, setFeedItems] = useState<WatchFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const restoredBrowserRef = useRef(false);
  const isLeaderRef = useRef(true);
  // Timestamp of the last play/pause/seek/load you started on this device.
  const lastLocalActionRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastReportedIframeTimeRef = useRef<number>(0);
  const initialStartSecondRef = useRef<number>(0);

  const broadcastWatch = useCallback(
    (payload: Record<string, any>) => {
      room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true })
        .catch(() => undefined);
    },
    [room],
  );

  const postIframeCommand = useCallback((command: string, args: any[] = []) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: command,
        args,
      }),
      "*",
    );
  }, []);

  const closePlayer = useCallback(
    (broadcast = true) => {
      lastLocalActionRef.current = Date.now();
      setClock(null);
      clockRef.current = null;
      lastReportedIframeTimeRef.current = 0;
      initialStartSecondRef.current = 0;
      setPickerModalOpen(false);
      if (broadcast) {
        broadcastWatch({ t: "watch_close" });
      }
      onClose();
    },
    [broadcastWatch, onClose],
  );

  const applyClock = useCallback(
    (newClock: SharedWatchClock, forceSeek = false) => {
      const cur = clockRef.current;
      const targetTime = computeClockTime(newClock);

      if (!cur || cur.videoId !== newClock.videoId) {
        initialStartSecondRef.current = Math.floor(targetTime);
        lastReportedIframeTimeRef.current = targetTime;
        setClock(newClock);
        clockRef.current = newClock;
        return;
      }

      setClock(newClock);
      clockRef.current = newClock;

      if (newClock.isPlaying) {
        postIframeCommand("playVideo");
      } else {
        postIframeCommand("pauseVideo");
      }

      const iframeTime = lastReportedIframeTimeRef.current;
      const drift = Math.abs((iframeTime > 0 ? iframeTime : targetTime) - targetTime);
      if (forceSeek || drift > 2) {
        lastReportedIframeTimeRef.current = targetTime;
        postIframeCommand("seekTo", [targetTime, true]);
      }
    },
    [postIframeCommand],
  );

  // Load a new video/music into the Master Clock system with validation
  const loadMedia = useCallback(
    (id: string, title?: string, mediaType: MediaType = "youtube", broadcast = true, startTime = 0) => {
      if (!isValidMediaType(mediaType) || !isValidMediaId(mediaType, id)) {
        return;
      }
      const safeTitle = sanitizeTitle(title, mediaType === "spotify" ? "Spotify Music" : "YouTube Video");
      const safeStart = isValidStartTime(startTime) ? startTime : 0;

      const newClock: SharedWatchClock = {
        videoId: id,
        title: safeTitle,
        baseTime: safeStart,
        epochTimestamp: Date.now(),
        isPlaying: true,
        version: Date.now(),
        mediaType,
      };

      lastLocalActionRef.current = Date.now();
      initialStartSecondRef.current = Math.floor(safeStart);
      lastReportedIframeTimeRef.current = safeStart;
      setClock(newClock);
      clockRef.current = newClock;
      setPickerModalOpen(false);

      if (broadcast) {
        broadcastWatch({
          t: "watch_clock_sync",
          clock: newClock,
          reason: "load",
        });
        broadcastWatch({
          t: "watch_load",
          videoId: id,
          title: safeTitle,
          startTime: safeStart,
          mediaType,
        });
      }
    },
    [broadcastWatch],
  );

  // Play / Pause Toggle anchored to Master Clock
  const togglePlay = useCallback(() => {
    const cur = clockRef.current;
    if (!cur || !cur.videoId) return;

    lastLocalActionRef.current = Date.now();
    const curTime = computeClockTime(cur);
    const nextIsPlaying = !cur.isPlaying;

    const updatedClock: SharedWatchClock = {
      videoId: cur.videoId,
      title: cur.title,
      baseTime: curTime,
      epochTimestamp: Date.now(),
      isPlaying: nextIsPlaying,
      version: Date.now(),
      mediaType: cur.mediaType,
    };

    applyClock(updatedClock, false);

    broadcastWatch({
      t: "watch_clock_sync",
      clock: updatedClock,
      reason: nextIsPlaying ? "play" : "pause",
    });
  }, [applyClock, broadcastWatch]);

  useEffect(() => {
    if (togglePlayRef) {
      togglePlayRef.current = togglePlay;
    }
    return () => {
      if (togglePlayRef) {
        togglePlayRef.current = null;
      }
    };
  }, [togglePlayRef, togglePlay]);

  // Request Behind-Sync with partner
  const resyncVideo = useCallback(() => {
    const cur = clockRef.current;
    if (!cur || !cur.videoId) return;

    const localCalculated = computeClockTime(cur);
    const localActual =
      lastReportedIframeTimeRef.current > 0 ? lastReportedIframeTimeRef.current : localCalculated;

    broadcastWatch({
      t: "watch_behind_sync_req",
      localTime: localActual,
      videoId: cur.videoId,
      senderEpoch: Date.now(),
    });
  }, [broadcastWatch]);

  useEffect(() => {
    if (resyncRef) {
      resyncRef.current = resyncVideo;
    }
    return () => {
      if (resyncRef) {
        resyncRef.current = null;
      }
    };
  }, [resyncRef, resyncVideo]);

  // Absolute seek helper — one Master Clock update keeps both sides together.
  const seekBy = useCallback(
    (delta: number) => {
      const cur = clockRef.current;
      if (!cur || !cur.videoId) return;

      lastLocalActionRef.current = Date.now();
      const curTime = computeClockTime(cur);
      const targetTime = Math.max(0, curTime + delta);

      const updatedClock: SharedWatchClock = {
        videoId: cur.videoId,
        title: cur.title,
        baseTime: targetTime,
        epochTimestamp: Date.now(),
        isPlaying: cur.isPlaying,
        version: Date.now(),
        mediaType: cur.mediaType,
      };

      applyClock(updatedClock, true);

      broadcastWatch({
        t: "watch_clock_sync",
        clock: updatedClock,
        reason: "seek",
      });
    },
    [applyClock, broadcastWatch],
  );

  // Rewind helper (kept for gestures and refs)
  const rewind = useCallback((seconds = 10) => seekBy(-seconds), [seekBy]);

  // Skip to the next / previous video in the feed, in sync for both sides.
  const skipAdjacent = useCallback(
    (direction: 1 | -1) => {
      const cur = clockRef.current;
      if (!cur || cur.mediaType !== "youtube") return;

      const list = feedItems;
      if (list.length === 0) return;

      const index = list.findIndex((item) => item.id === cur.videoId);
      const nextIndex = index === -1 ? 0 : (index + direction + list.length) % list.length;
      const item = list[nextIndex];
      if (!item) return;

      loadMedia(item.id, item.title, "youtube");
    },
    [feedItems, loadMedia],
  );

  // Live position readout for the control bar
  const [displayTime, setDisplayTime] = useState(0);
  useEffect(() => {
    if (!clock?.videoId) return;

    const update = () => setDisplayTime(Math.max(0, computeClockTime(clockRef.current)));

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [clock?.videoId, clock?.isPlaying, clock?.baseTime, clock?.epochTimestamp]);

  useEffect(() => {
    if (rewindRef) {
      rewindRef.current = rewind;
    }
    return () => {
      if (rewindRef) {
        rewindRef.current = null;
      }
    };
  }, [rewindRef, rewind]);

  useEffect(() => {
    if (openPickerRef) {
      openPickerRef.current = () => setPickerModalOpen(true);
    }
    return () => {
      if (openPickerRef) {
        openPickerRef.current = null;
      }
    };
  }, [openPickerRef]);

  // Automatic Audio Ducking (Auto-reduces YouTube volume to 20% when anyone speaks)
  useEffect(() => {
    if (clock && clock.mediaType === "youtube") {
      postIframeCommand("setVolume", [isDucked ? 20 : 100]);
    }
  }, [isDucked, clock, postIframeCommand]);

  // Who publishes the heartbeat? Deterministic: the first identity wins, so both
  // sides agree without exchanging extra messages.
  useEffect(() => {
    const refreshLeader = () => {
      const remote = Array.from(room.remoteParticipants.keys()).sort()[0] ?? "";
      isLeaderRef.current = !remote || room.localParticipant.identity < remote;
    };

    refreshLeader();
    room.on(RoomEvent.ParticipantConnected, refreshLeader);
    room.on(RoomEvent.ParticipantDisconnected, refreshLeader);

    return () => {
      room.off(RoomEvent.ParticipantConnected, refreshLeader);
      room.off(RoomEvent.ParticipantDisconnected, refreshLeader);
    };
  }, [room]);

  // Request sync on join
  useEffect(() => {
    if (isActive && !clockRef.current) {
      broadcastWatch({ t: "watch_clock_req" });
    }
  }, [isActive, broadcastWatch]);

  // Periodic clock heartbeat. One side (the lexicographically smaller identity)
  // re-publishes the authoritative clock so a dropped packet, a late join or a
  // reconnect can never leave the two players out of step.
  useEffect(() => {
    if (!isActive || !isLeaderRef.current) return;

    const timer = window.setInterval(() => {
      const cur = clockRef.current;
      if (!cur || !cur.videoId) return;

      broadcastWatch({
        t: "watch_clock_sync",
        clock: {
          videoId: cur.videoId,
          title: cur.title,
          baseTime: computeClockTime(cur),
          epochTimestamp: Date.now(),
          isPlaying: cur.isPlaying,
          version: Date.now(),
          mediaType: cur.mediaType,
        },
        reason: "heartbeat",
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isActive, broadcastWatch]);


  // Polling fallback to ask YouTube iframe for current time
  useEffect(() => {
    if (!clock?.videoId || clock.mediaType !== "youtube") return;
    const interval = setInterval(() => {
      postIframeCommand("getCurrentTime");
    }, 1000);
    return () => clearInterval(interval);
  }, [clock?.videoId, clock?.mediaType, postIframeCommand]);

  // Listen to YouTube postMessage events for accurate time tracking
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event === "infoDelivery" && data?.info) {
          if (typeof data.info.currentTime === "number" && data.info.currentTime > 0) {
            lastReportedIframeTimeRef.current = data.info.currentTime;
          }
        }
      } catch {
        // ignore non-json messages
      }
    };
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, []);

  // Gentle auto drift correction: every 3.5s, align iframe if drift > 3.0s
  useEffect(() => {
    if (!clock?.isPlaying || !clock?.videoId || clock.mediaType !== "youtube" || !syncEnabled) return;

    const driftInterval = setInterval(() => {
      const expected = computeClockTime(clockRef.current);
      const actual = lastReportedIframeTimeRef.current;

      if (actual > 2 && expected > 2 && Math.abs(expected - actual) > 3) {
        postIframeCommand("seekTo", [expected, true]);
      }
    }, 3500);

    return () => clearInterval(driftInterval);
  }, [clock?.isPlaying, clock?.videoId, clock?.mediaType, syncEnabled, postIframeCommand]);

  // Handle LiveKit data channel events from partner with strict validation
  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      try {
        const raw = JSON.parse(new TextDecoder().decode(payload));
        const msg = validateIncomingWatchMessage(raw);
        if (!msg) return; // Drop any message that fails validation

        // 1. Clock Request from newly connected or catch-up partner
        if (msg.t === "watch_clock_req") {
          const cur = clockRef.current;
          if (cur && cur.videoId) {
            const activeTime = computeClockTime(cur);
            const snapshotClock: SharedWatchClock = {
              videoId: cur.videoId,
              title: cur.title,
              baseTime: activeTime,
              epochTimestamp: Date.now(),
              isPlaying: cur.isPlaying,
              version: Date.now(),
              mediaType: cur.mediaType,
            };
            broadcastWatch({
              t: "watch_clock_sync",
              clock: snapshotClock,
              reason: "catchup",
            });
          }
        }

        // 2. Behind-Sync Request
        else if (msg.t === "watch_behind_sync_req") {
          const cur = clockRef.current;
          if (!cur || !cur.videoId) return;

          const remoteTime = msg.localTime;
          const myCalculated = computeClockTime(cur);
          const myActual =
            lastReportedIframeTimeRef.current > 0 ? lastReportedIframeTimeRef.current : myCalculated;

          const behindTarget = resolveBehindSyncTime(myActual, remoteTime);

          const syncedClock: SharedWatchClock = {
            videoId: cur.videoId,
            title: cur.title,
            baseTime: behindTarget,
            epochTimestamp: Date.now(),
            isPlaying: cur.isPlaying,
            version: Date.now(),
            mediaType: cur.mediaType,
          };

          applyClock(syncedClock, true);

          broadcastWatch({
            t: "watch_clock_sync",
            clock: syncedClock,
            reason: "behind_sync_resolved",
          });
        }

        // 3. Shared Clock Synchronization event
        else if (msg.t === "watch_clock_sync") {
          const incomingClock: SharedWatchClock = msg.clock;
          const cur = clockRef.current;

          if (!syncEnabled && cur && cur.videoId === incomingClock.videoId) {
            return;
          }

          // Heartbeats only re-anchor a player that is already idle-ish. A heartbeat
          // arriving right after you paused used to restart the video (and device
          // clock skew made version comparison useless across two phones).
          if (msg.reason === "heartbeat") {
            const actedRecently = Date.now() - lastLocalActionRef.current < 6000;
            if (actedRecently) return;
            if (
              cur &&
              cur.videoId === incomingClock.videoId &&
              incomingClock.version <= cur.version
            ) {
              return;
            }
          }

          const forceSeek =
            msg.reason === "behind_sync_resolved" ||
            msg.reason === "seek" ||
            msg.reason === "catchup";

          applyClock(incomingClock, forceSeek);
        }

        // 4. Legacy watch_load event fallback
        else if (msg.t === "watch_load") {
          loadMedia(msg.videoId, msg.title, msg.mediaType, false, msg.startTime);
        }

        // 5. Watch session closed by partner
        else if (msg.t === "watch_close") {
          closePlayer(false);
        }
      } catch {
        // ignore malformed messages
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, applyClock, loadMedia, closePlayer, syncEnabled, broadcastWatch]);

  const loadFeed = useCallback(async (query: string | null) => {
    setFeedLoading(true);
    setFeedError(null);

    try {
      const suffix = query ? `?q=${encodeURIComponent(query)}` : "?topic=All";
      const response = await fetch(`/api/watch/search${suffix}`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { items?: WatchFeedItem[]; message?: string };

      if (!response.ok) throw new Error(data?.message || "YouTube did not load.");

      const items = Array.isArray(data.items) ? data.items : [];
      setFeedItems(items);
      if (items.length === 0) setFeedError("Nothing found. Try different words.");
    } catch (error) {
      setFeedItems([]);
      setFeedError(error instanceof Error ? error.message : "YouTube did not load.");
    } finally {
      setFeedLoading(false);
    }
  }, []);

  // Restore the last YouTube browse session so returning from a video keeps your
  // topic, search text and results instead of starting over.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BROWSER_STATE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as { topic?: string; query?: string; items?: WatchFeedItem[] };
      const savedTopic = typeof saved.topic === "string" ? saved.topic : "";
      if (savedTopic) setTopic(savedTopic);
      if (typeof saved.query === "string") setSearchQuery(saved.query);

      if (Array.isArray(saved.items) && saved.items.length > 0) {
        setFeedItems(saved.items);
        restoredBrowserRef.current = true;
      }
    } catch {
      // ignore unreadable storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        BROWSER_STATE_KEY,
        JSON.stringify({ topic, query: searchQuery, items: feedItems }),
      );
    } catch {
      // ignore quota / private-mode failures
    }
  }, [topic, searchQuery, feedItems]);

  useEffect(() => {
    if (platform !== "youtube") return;

    if (restoredBrowserRef.current) {
      restoredBrowserRef.current = false;
      return;
    }

    void loadFeed(topic === "All" ? null : topic);
  }, [platform, topic, loadFeed]);

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();

    if (query.length < 2) {
      setFeedError("Type at least two characters to search.");
      return;
    }

    void loadFeed(query);
  };

  const openExternalPlatform = (id: "netflix" | "prime") => {
    window.open(EXTERNAL_PLATFORMS[id].url, "_blank", "noopener,noreferrer");
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    const media = extractMediaInfo(urlInput);
    if (!media) {
      setInputError("Please enter a valid YouTube or Spotify link.");
      return;
    }
    loadMedia(media.id, media.title, media.type);
    setUrlInput("");
  };

  const renderBrowser = () => (
    <div className={`stage-with-faces watch-together-stage ${chatVisible ? "chat-open" : ""}`}>
      <div className="stage-with-faces-inner">
        <div className="stage-video-wrap watch-video-wrap watch-browse-wrap">
          <div className="watch-browse">
            <div className="watch-browse-head">
              <div className="watch-title-wrap">
                <span className="watch-heart-icon">🎬</span>
                <h3>Watch &amp; Listen Together</h3>
              </div>
              <button
                type="button"
                className="watch-close-btn"
                onClick={() => (pickerModalOpen ? setPickerModalOpen(false) : closePlayer(true))}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="watch-picker watch-picker-inline">
          <div className="watch-platforms" role="tablist" aria-label="Choose a platform">
            {PLATFORM_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={platform === tab.id}
                className={`watch-platform-tab ${tab.id}${platform === tab.id ? " active" : ""}`}
                onClick={() => setPlatform(tab.id)}
              >
                <span className="watch-platform-mark" aria-hidden="true">
                  <PlatformLogo id={tab.id} />
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {platform === "youtube" && (
            <div className="watch-search-block">
              <form className="watch-search" onSubmit={runSearch}>
                <input
                  type="search"
                  className="watch-search-input"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search YouTube"
                />
                <button type="submit" className="watch-search-btn" aria-label="Search YouTube" disabled={feedLoading}>
                  {feedLoading ? "…" : "⌕"}
                </button>
              </form>

              <div className="yt-chips" role="tablist" aria-label="YouTube topics">
                {YOUTUBE_TOPICS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={topic === item}
                    className={`yt-chip${topic === item ? " active" : ""}`}
                    onClick={() => setTopic(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {feedError && <p className="watch-input-error">{feedError}</p>}

              {feedItems.length > 0 && (
                <div className="yt-grid">
                  {feedItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="yt-card"
                      onClick={() => loadMedia(item.id, item.title, "youtube")}
                    >
                      <span className="yt-thumb-wrap">
                        <img className="yt-thumb" src={item.thumbnail} alt="" loading="lazy" />
                        {item.duration && <span className="yt-duration">{item.duration}</span>}
                      </span>
                      <span className="yt-card-title">{item.title}</span>
                      <span className="yt-card-meta">
                        {[item.channel, item.views].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {platform === "spotify" && (
            <>
              <form className="watch-url-form" onSubmit={handleUrlSubmit}>
                <input
                  type="text"
                  placeholder="Paste a Spotify link (e.g. https://open.spotify.com/track/...)"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="watch-input"
                />
                <button type="submit" className="watch-start-btn">
                  Start Watching
                </button>
              </form>
              {inputError && <p className="watch-input-error">{inputError}</p>}

              <div className="watch-suggestions">
                <h4>Or choose video & music together:</h4>
                <div className="suggestions-grid">
                  {ROMANTIC_SUGGESTIONS.filter((item) => item.type === "spotify").map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="suggestion-card"
                      onClick={() => loadMedia(item.id, item.title, item.type)}
                    >
                      <span className="suggestion-play">{item.type === "spotify" ? "🎵" : "▶"}</span>
                      <div>
                        <p className="suggestion-title">{item.title}</p>
                        <span className="suggestion-desc">{item.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {(platform === "netflix" || platform === "prime") && (
            <div className="watch-external-card">
              <button
                type="button"
                className={`watch-external-btn ${platform}`}
                onClick={() => openExternalPlatform(platform)}
              >
                {platform === "netflix" ? "NETFLIX" : "prime video"}
              </button>
              <p className="watch-external-copy">{EXTERNAL_PLATFORMS[platform].note}</p>
              <span className="watch-external-tag">opens in a new tab · call stays connected</span>
            </div>
          )}
            </div>
          </div>
        </div>

        <div className="face-tiles">
          <div className="face-tile">
            {remoteCam ? (
              <VideoTrack trackRef={remoteCam} className="face-video" playsInline />
            ) : (
              <div className="face-off">{initialOf(partner?.name || partnerLabel)}</div>
            )}
            <span className="face-tag">{partnerLabel}</span>
          </div>

          <div className="face-tile">
            {localCam ? (
              <VideoTrack trackRef={localCam} className="face-video mirror" playsInline />
            ) : (
              <div className="face-off">{initialOf(selfName)}</div>
            )}
            <span className="face-tag">you</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderControls = () => {
    if (!clock) return null;
    const isYouTube = clock.mediaType === "youtube";

    return (
      <div className="watch-controls" role="group" aria-label="Playback controls">
        {isYouTube && (
          <button
            type="button"
            className="watch-ctrl"
            onClick={() => skipAdjacent(-1)}
            title="Previous video"
            aria-label="Previous video"
          >
            <Icon name="skip-back" size={18} />
          </button>
        )}
        {isYouTube ? (
          <>
            <button
              type="button"
              className="watch-ctrl"
              onClick={() => seekBy(-10)}
              title="Back 10 seconds"
              aria-label="Back 10 seconds"
            >
              <Icon name="replay-10" size={20} />
            </button>
            <button
              type="button"
              className="watch-ctrl primary"
              onClick={togglePlay}
              title={clock.isPlaying ? "Pause" : "Play"}
              aria-label={clock.isPlaying ? "Pause" : "Play"}
            >
              <Icon name={clock.isPlaying ? "pause" : "play"} size={20} />
            </button>
            <button
              type="button"
              className="watch-ctrl"
              onClick={() => seekBy(10)}
              title="Forward 10 seconds"
              aria-label="Forward 10 seconds"
            >
              <Icon name="forward-10" size={20} />
            </button>
          </>
        ) : (
          <span className="watch-ctrl-note">Same track on both screens · use Spotify&apos;s own controls</span>
        )}
        {isYouTube && (
          <button
            type="button"
            className="watch-ctrl"
            onClick={() => skipAdjacent(1)}
            title="Next video"
            aria-label="Next video"
          >
            <Icon name="skip-forward" size={18} />
          </button>
        )}
        <span className="watch-ctrl-time">{formatClockTime(displayTime)}</span>
        <button
          type="button"
          className="watch-ctrl"
          onClick={() => setPickerModalOpen(true)}
          title="Minimise & browse"
          aria-label="Minimise and browse"
        >
          <Icon name="pip" size={18} />
        </button>
        <button
          type="button"
          className="watch-ctrl danger"
          onClick={() => closePlayer(true)}
          title="Stop watching"
          aria-label="Stop watching"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    );
  };

  if (!isActive) return null;

  // When video/music is loaded: render Full Stage layout
  if (clock?.videoId) {
    return (
      <div className={`stage-with-faces watch-together-stage ${pickerModalOpen ? "browsing" : ""} ${chatVisible ? "chat-open" : ""}`}>
        <div className="stage-with-faces-inner">
          <div className={`stage-video-wrap watch-video-wrap${pickerModalOpen ? " mini" : ""}`}>
            {isDucked && (
              <div className="watch-ducked-badge" aria-live="polite">
                <span>🎧 Voice Priority (Media ducked to 20%)</span>
              </div>
            )}
            {clock.mediaType === "spotify" ? (
              <>
                <div className="stage-banner watch-stage-banner">
                  <Icon name="music" size={14} />
                  <span className="watch-banner-title">{clock.title}</span>
                </div>

                <div className="watch-iframe-slot">
                  <iframe
                    key={clock.videoId}
                    className="watch-stage-iframe spotify-player"
                    src={buildSpotifyEmbedUrl(clock.videoId)}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    title={clock.title}
                  />
                </div>

                {renderControls()}
              </>
            ) : (
              <>
                <div className="stage-banner watch-stage-banner">
                  <Icon name="tv" size={14} />
                  <span className="watch-banner-title">{clock.title}</span>
                </div>

                <div className="watch-iframe-slot">
                  <iframe
                    key={clock.videoId}
                    ref={iframeRef}
                    className="watch-stage-iframe"
                    src={buildYouTubeEmbedUrl(
                      clock.videoId,
                      initialStartSecondRef.current,
                      typeof window !== "undefined" ? window.location.origin : "",
                    )}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {renderControls()}
              </>
            )}

            {pickerModalOpen && (
              <div className="watch-mini-bar">
                <button
                  type="button"
                  onClick={() => setPickerModalOpen(false)}
                  title="Expand player"
                  aria-label="Expand player"
                >
                  <Icon name="chevron-up" size={16} />
                </button>
                <span className="watch-mini-title">{clock.title}</span>
                <button
                  type="button"
                  onClick={() => closePlayer(true)}
                  title="Stop watching"
                  aria-label="Stop watching"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Couple Camera Column */}
          <div className="face-tiles">
            {/* Partner's live camera */}
            <div className="face-tile">
              {remoteCam ? (
                <VideoTrack trackRef={remoteCam} className="face-video" playsInline />
              ) : (
                <div className="face-off">{initialOf(partner?.name || partnerLabel)}</div>
              )}
              <span className="face-tag">{partnerLabel}</span>
            </div>

            {/* Your live camera */}
            <div className="face-tile">
              {localCam ? (
                <VideoTrack trackRef={localCam} className="face-video mirror" playsInline />
              ) : (
                <div className="face-off">{initialOf(selfName)}</div>
              )}
              <span className="face-tag">you</span>
            </div>
          </div>
        </div>

        {/* In-stage browser for switching video while watching */}
        {pickerModalOpen && renderBrowser()}
      </div>
    );
  }

  // Nothing playing yet: browse YouTube full-stage, faces stay visible
  return renderBrowser();
}
