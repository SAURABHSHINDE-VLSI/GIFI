"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { VideoTrack } from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";
import { initialOf } from "@/lib/ui";
import { Icon } from "./Icons";

export type MediaType = "youtube" | "spotify" | "web" | "video";

export interface SharedWatchClock {
  videoId: string;
  title: string;
  baseTime: number;         // Anchored video position in seconds
  epochTimestamp: number;   // Date.now() when baseTime was anchored
  isPlaying: boolean;       // True if advancing, false if paused
  version: number;          // Monotonic timestamp to discard stale messages
  mediaType?: MediaType;
}

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

const ROMANTIC_SUGGESTIONS = [
  { title: "Netmirror Movies & Shows", id: "https://netmirror.app", desc: "Watch Netflix series, movies & shows together with full interactive clicks", type: "web" as const },
  { title: "Cozy Lofi Beats", id: "5yx6BWlEVcY", desc: "Late-night soft beats to relax together", type: "youtube" as const },
  { title: "Candlelight Jazz", id: "Dx5qFachd3A", desc: "Warm romantic jazz coffee vibes", type: "youtube" as const },
  { title: "Rain & Fireplace", id: "mPZkdNFkNps", desc: "Gentle rain sounds & cozy crackling fire", type: "youtube" as const },
  { title: "Spotify: Romantic Love", id: "playlist/37i9dQZF1DXcBWIGoYBM5M", desc: "Curated Spotify acoustic love songs", type: "spotify" as const },
  { title: "Spotify: Lofi & Chill", id: "playlist/37i9dQZF1DXdLEN7aqioXM", desc: "Mellow vibes for late night conversations", type: "spotify" as const },
];

export function extractMediaInfo(url: string): { type: MediaType; id: string; title?: string } | null {
  if (!url) return null;
  const trimmed = url.trim();

  // 1. Spotify URI format (e.g. spotify:track:..., spotify:playlist:...)
  const uriMatch = trimmed.match(/^spotify:(track|playlist|album|artist|episode):([a-zA-Z0-9]+)/);
  if (uriMatch) {
    const kind = uriMatch[1];
    const id = uriMatch[2];
    const kindCap = kind.charAt(0).toUpperCase() + kind.slice(1);
    return {
      type: "spotify",
      id: `${kind}/${id}`,
      title: `Spotify ${kindCap}`,
    };
  }

  // 2. Spotify URL with optional user path (e.g. open.spotify.com/user/xyz/playlist/...)
  const spotifyUserMatch = trimmed.match(/open\.spotify\.com\/user\/[^/]+\/playlist\/([a-zA-Z0-9]+)/);
  if (spotifyUserMatch) {
    return {
      type: "spotify",
      id: `playlist/${spotifyUserMatch[1]}`,
      title: "Spotify Playlist",
    };
  }

  // 3. Standard Spotify web URL (open.spotify.com/track/...)
  const spotifyMatch = trimmed.match(/open\.spotify\.com\/(track|playlist|album|artist|episode)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) {
    const kind = spotifyMatch[1];
    const id = spotifyMatch[2];
    const kindCap = kind.charAt(0).toUpperCase() + kind.slice(1);
    return {
      type: "spotify",
      id: `${kind}/${id}`,
      title: `Spotify ${kindCap}`,
    };
  }

  // 4. YouTube
  const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const ytMatch = trimmed.match(ytRegExp);
  if (ytMatch && ytMatch[2].length === 11) {
    return {
      type: "youtube",
      id: ytMatch[2],
      title: "Shared YouTube Video",
    };
  }

  // 5. Direct video files (.mp4, .webm, .m3u8, .ogg)
  if (trimmed.match(/\.(mp4|webm|m3u8|ogg)(\?.*)?$/i)) {
    return {
      type: "video",
      id: trimmed,
      title: "Shared Web Video",
    };
  }

  // 6. Any web streaming URL (e.g. https://netmirror.app, https://..., or netmirror.app)
  if (trimmed.match(/^https?:\/\//i) || trimmed.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)) {
    const fullUrl = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    let domain = "Web";
    try {
      domain = new URL(fullUrl).hostname.replace(/^www\./, "");
    } catch {
      // Fallback domain on invalid URL parsing
    }
    return {
      type: "web",
      id: fullUrl,
      title: domain.toLowerCase().includes("netmirror") ? "Netmirror Movies & Shows" : `${domain} Stream`,
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
export function computeClockTime(clock: SharedWatchClock | null): number {
  if (!clock || !clock.videoId) return 0;
  if (!clock.isPlaying) return Math.max(0, clock.baseTime);
  const elapsed = Math.max(0, (Date.now() - clock.epochTimestamp) / 1000);
  return Math.max(0, clock.baseTime + elapsed);
}

/**
 * Resolves the sync target timestamp between local and remote partners.
 * Per user design requirement:
 * 1. Whichever YouTube video is behind (smaller timestamp), sync starts from there (Math.min),
 *    so neither partner misses any content.
 * 2. If one partner has just started/joined (<= 2s) while the other is already watching (> 2s),
 *    NEVER restart the video from 0:00! Instead, catch up to the active watchhead.
 */
export function resolveBehindSyncTime(localTime: number, remoteTime: number): number {
  const l = Math.max(0, localTime || 0);
  const r = Math.max(0, remoteTime || 0);

  // If one partner has just started (<= 2s) and the other is further along (> 2s),
  // sync to the active position (do NOT reset the video to 0:00)
  if (l <= 2 && r > 2) return r;
  if (r <= 2 && l > 2) return l;

  // If both have played into the video (> 2s), sync to whichever video is BEHIND
  if (l > 0 && r > 0) {
    return Math.min(l, r);
  }

  // Otherwise take non-zero progress
  return Math.max(l, r);
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
  clockRef.current = clock;

  const [pickerModalOpen, setPickerModalOpen] = useState(false);

  const [urlInput, setUrlInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoElemRef = useRef<HTMLVideoElement | null>(null);
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

  // Tell parent whether a video is actively loaded
  useEffect(() => {
    onVideoStateChange?.(Boolean(clock?.videoId));
  }, [clock?.videoId, onVideoStateChange]);

  // Tell parent whether playback is playing or paused
  useEffect(() => {
    onPlayingChange?.(Boolean(clock?.isPlaying));
  }, [clock?.isPlaying, onPlayingChange]);

  // Apply a new clock state and synchronize YouTube iframe
  const applyClock = useCallback(
    (newClock: SharedWatchClock, forceSeek = false) => {
      const cur = clockRef.current;
      const targetTime = computeClockTime(newClock);

      // If video changed, reset initial start position
      if (!cur || cur.videoId !== newClock.videoId) {
        initialStartSecondRef.current = Math.floor(targetTime);
        lastReportedIframeTimeRef.current = targetTime;
        setClock(newClock);
        clockRef.current = newClock;
        return;
      }

      setClock(newClock);
      clockRef.current = newClock;

      // Ensure play/pause state is reflected in iframe
      if (newClock.isPlaying) {
        postIframeCommand("playVideo");
      } else {
        postIframeCommand("pauseVideo");
      }

      // If forced seek (from Behind-Sync) or drift > 2s, align iframe position
      const iframeTime = lastReportedIframeTimeRef.current;
      const drift = Math.abs((iframeTime > 0 ? iframeTime : targetTime) - targetTime);
      if (forceSeek || drift > 2) {
        lastReportedIframeTimeRef.current = targetTime;
        postIframeCommand("seekTo", [targetTime, true]);
      }
    },
    [postIframeCommand],
  );

  // Load a new video/music into the Master Clock system
  const loadMedia = useCallback(
    (id: string, title?: string, mediaType: MediaType = "youtube", broadcast = true, startTime = 0) => {
      const newClock: SharedWatchClock = {
        videoId: id,
        title: title || (mediaType === "spotify" ? "Spotify Music" : mediaType === "web" ? "Interactive Web Screen" : "YouTube Video"),
        baseTime: startTime,
        epochTimestamp: Date.now(),
        isPlaying: true,
        version: Date.now(),
        mediaType,
      };

      initialStartSecondRef.current = Math.floor(startTime);
      lastReportedIframeTimeRef.current = startTime;
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
          title: newClock.title,
          startTime,
          mediaType,
        });
      }
    },
    [broadcastWatch],
  );

  const loadVideo = useCallback(
    (id: string, title?: string, broadcast = true, startTime = 0) => {
      loadMedia(id, title, "youtube", broadcast, startTime);
    },
    [loadMedia],
  );

  // Play / Pause Toggle anchored to Master Clock
  const togglePlay = useCallback(() => {
    const cur = clockRef.current;
    if (!cur || !cur.videoId) return;

    const curTime = computeClockTime(cur);
    const nextIsPlaying = !cur.isPlaying;

    const updatedClock: SharedWatchClock = {
      videoId: cur.videoId,
      title: cur.title,
      baseTime: curTime,
      epochTimestamp: Date.now(),
      isPlaying: nextIsPlaying,
      version: Date.now(),
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

  // Request Behind-Sync with partner:
  // Evaluates both positions and resets to whichever partner is BEHIND (Math.min)
  const resyncVideo = useCallback(() => {
    const cur = clockRef.current;
    if (!cur || !cur.videoId) return;

    const localCalculated = computeClockTime(cur);
    const localActual =
      lastReportedIframeTimeRef.current > 0 ? lastReportedIframeTimeRef.current : localCalculated;

    // Request partner's current position so Behind-Sync can resolve
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

  // Synchronized 10s Rewind
  const rewind = useCallback(
    (seconds = 10) => {
      const cur = clockRef.current;
      if (!cur || !cur.videoId) return;

      const curTime = computeClockTime(cur);
      const targetTime = Math.max(0, curTime - seconds);

      const updatedClock: SharedWatchClock = {
        videoId: cur.videoId,
        title: cur.title,
        baseTime: targetTime,
        epochTimestamp: Date.now(),
        isPlaying: cur.isPlaying,
        version: Date.now(),
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

  // Automatic Audio Ducking (Auto-reduces YouTube & Video volume to 20% when anyone speaks)
  useEffect(() => {
    if (clock) {
      postIframeCommand("setVolume", [isDucked ? 20 : 100]);
    }
    if (videoElemRef.current) {
      videoElemRef.current.volume = isDucked ? 0.2 : 1.0;
    }
  }, [isDucked, clock, postIframeCommand]);

  // Open Video Picker Modal without leaving stage
  const openPicker = useCallback(() => {
    setPickerModalOpen(true);
  }, []);

  useEffect(() => {
    if (openPickerRef) {
      openPickerRef.current = openPicker;
    }
    return () => {
      if (openPickerRef) {
        openPickerRef.current = null;
      }
    };
  }, [openPickerRef, openPicker]);

  // Close the Watch Together session
  const closePlayer = useCallback(
    (broadcast = true) => {
      setClock(null);
      clockRef.current = null;
      lastReportedIframeTimeRef.current = 0;
      if (broadcast) {
        broadcastWatch({ t: "watch_close" });
      }
      onClose();
    },
    [broadcastWatch, onClose],
  );

  // Close when parent marks inactive
  useEffect(() => {
    if (!isActive && clockRef.current) {
      closePlayer(true);
    }
  }, [isActive, closePlayer]);

  // When room becomes active, check if partner is already playing a video
  useEffect(() => {
    if (isActive && !clockRef.current) {
      broadcastWatch({ t: "watch_clock_req" });
    }
  }, [isActive, broadcastWatch]);

  // Periodically send "listening" command to YouTube iframe to request infoDelivery events
  useEffect(() => {
    if (!clock?.videoId || !iframeRef.current) return;
    const sendListening = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "listening", id: 1 }),
          "*",
        );
      }
    };
    sendListening();
    const interval = setInterval(sendListening, 1500);
    return () => clearInterval(interval);
  }, [clock?.videoId]);

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
    if (!clock?.isPlaying || !clock?.videoId) return;

    const driftInterval = setInterval(() => {
      if (!syncEnabled) return;
      const expected = computeClockTime(clockRef.current);
      const actual = lastReportedIframeTimeRef.current;

      // Only adjust if actual playback is running and drift exceeds 3 seconds
      if (actual > 2 && expected > 2 && Math.abs(expected - actual) > 3) {
        postIframeCommand("seekTo", [expected, true]);
      }
    }, 3500);

    return () => clearInterval(driftInterval);
  }, [clock?.isPlaying, clock?.videoId, syncEnabled, postIframeCommand]);

  // Handle LiveKit data channel events from partner
  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));

        // 1. Clock Request from newly connected or catch-up partner
        if (msg?.t === "watch_clock_req") {
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
            };
            broadcastWatch({
              t: "watch_clock_sync",
              clock: snapshotClock,
              reason: "catchup",
            });
          }
        }

        // 2. Behind-Sync Request: Partner wants to synchronize to whichever video is BEHIND
        else if (msg?.t === "watch_behind_sync_req") {
          const cur = clockRef.current;
          if (!cur || !cur.videoId) return;

          const remoteTime = typeof msg.localTime === "number" ? msg.localTime : 0;
          const myCalculated = computeClockTime(cur);
          const myActual =
            lastReportedIframeTimeRef.current > 0 ? lastReportedIframeTimeRef.current : myCalculated;

          // Resolve to whichever video is behind, with protection against resetting to 0:00
          const behindTarget = resolveBehindSyncTime(myActual, remoteTime);

          const syncedClock: SharedWatchClock = {
            videoId: cur.videoId,
            title: cur.title,
            baseTime: behindTarget,
            epochTimestamp: Date.now(),
            isPlaying: cur.isPlaying,
            version: Date.now(),
          };

          // Apply locally
          applyClock(syncedClock, true);

          // Broadcast agreed clock to partner so both lock to the exact behind point
          broadcastWatch({
            t: "watch_clock_sync",
            clock: syncedClock,
            reason: "behind_sync_resolved",
          });
        }

        // 3. Shared Clock Synchronization event
        else if (msg?.t === "watch_clock_sync" && msg.clock) {
          const incomingClock: SharedWatchClock = msg.clock;
          const cur = clockRef.current;

          // If user paused sync, do not accept remote playhead unless it's a completely new video
          if (!syncEnabled && cur && cur.videoId === incomingClock.videoId) {
            return;
          }

          // Discard stale clock messages
          if (cur && incomingClock.version && cur.version && incomingClock.version < cur.version) {
            return;
          }

          const forceSeek =
            msg.reason === "behind_sync_resolved" ||
            msg.reason === "seek" ||
            msg.reason === "catchup";

          applyClock(incomingClock, forceSeek);
        }

        // 4. Legacy watch_load event fallback
        else if (msg?.t === "watch_load" && typeof msg.videoId === "string") {
          const startAt = typeof msg.startTime === "number" ? msg.startTime : 0;
          loadMedia(msg.videoId, msg.title, msg.mediaType || "youtube", false, startAt);
        }

        // 5. Watch session closed by partner
        else if (msg?.t === "watch_close") {
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
  }, [room, applyClock, loadMedia, loadVideo, closePlayer, syncEnabled, broadcastWatch]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    const media = extractMediaInfo(urlInput);
    if (!media) {
      setInputError("Please enter a valid movie link, Netmirror, YouTube, Spotify, or website URL");
      return;
    }
    loadMedia(media.id, media.title, media.type);
    setUrlInput("");
  };

  const renderPicker = (isModal: boolean) => (
    <div
      className="watch-picker-overlay"
      onClick={() => (isModal ? setPickerModalOpen(false) : closePlayer(true))}
    >
      <div className="watch-picker-container" onClick={(e) => e.stopPropagation()}>
        <div className="watch-header">
          <div className="watch-title-wrap">
            <span className="watch-heart-icon">🎬</span>
            <h3>{isModal ? "Switch Media" : "Watch & Listen Together"}</h3>
          </div>
          <button
            type="button"
            className="watch-close-btn"
            onClick={() => (isModal ? setPickerModalOpen(false) : closePlayer(true))}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="watch-picker">
          <form className="watch-url-form" onSubmit={handleUrlSubmit}>
            <input
              type="text"
              placeholder="Paste Netmirror link, movie website, YouTube or Spotify (e.g. netmirror.app)..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="watch-input"
              autoFocus
            />
            <button type="submit" className="watch-start-btn">
              {isModal ? "Switch Media" : "Start Watching"}
            </button>
          </form>
          {inputError && <p className="watch-input-error">{inputError}</p>}

          <div className="watch-suggestions">
            <h4>Or choose movie, video & music together:</h4>
            <div className="suggestions-grid">
              {ROMANTIC_SUGGESTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="suggestion-card"
                  onClick={() => loadMedia(item.id, item.title, item.type)}
                >
                  <span className="suggestion-play">{item.type === "spotify" ? "🎵" : item.type === "web" ? "🌐" : "▶"}</span>
                  <div>
                    <p className="suggestion-title">{item.title}</p>
                    <span className="suggestion-desc">{item.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isActive) return null;

  // When a video/music is loaded: render Full Stage layout with partner and your camera tiles
  if (clock?.videoId) {
    return (
      <div className={`stage-with-faces watch-together-stage ${chatVisible ? "chat-open" : ""}`}>
        <div className="stage-with-faces-inner">
          <div className="stage-video-wrap watch-video-wrap">
            {isDucked && (
              <div className="watch-ducked-badge" aria-live="polite">
                <span>🎧 Voice Priority (Media ducked to 20%)</span>
              </div>
            )}
            {clock.mediaType === "web" ? (
              <div className="watch-web-container">
                <div className="watch-web-bar">
                  <div className="watch-web-bar-left">
                    <span className="watch-web-dot" />
                    <span className="watch-web-title">{clock.title || "Interactive Web Screen"}</span>
                    <span className="watch-web-badge">Interactive Mode (Full Click & Browse)</span>
                  </div>
                  <div className="watch-web-bar-right">
                    <button
                      type="button"
                      className="watch-web-btn"
                      onClick={() => setPickerModalOpen(true)}
                      title="Switch Movie or Website"
                    >
                      Switch Site
                    </button>
                    <button
                      type="button"
                      className="watch-web-btn close"
                      onClick={() => closePlayer(true)}
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <iframe
                  key={clock.videoId}
                  className="watch-stage-iframe web-interactive-frame"
                  src={clock.videoId}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-downloads allow-modals"
                  allowFullScreen
                />
              </div>
            ) : clock.mediaType === "video" ? (
              <>
                <div className="stage-banner watch-stage-banner">
                  <Icon name="tv" size={14} />
                  <span>{clock.title || "Watching Together"}</span>
                  <button
                    type="button"
                    className="stage-banner-btn"
                    onClick={() => setPickerModalOpen(true)}
                    title="Switch Video or Music"
                  >
                    Switch
                  </button>
                  <button
                    type="button"
                    className="stage-banner-stop"
                    onClick={() => closePlayer(true)}
                    title="Close Watch Together"
                  >
                    Close
                  </button>
                </div>
                <video
                  ref={videoElemRef}
                  src={clock.videoId}
                  controls
                  autoPlay
                  playsInline
                  className="watch-stage-video"
                />
              </>
            ) : clock.mediaType === "spotify" ? (
              <>
                <div className="stage-banner watch-stage-banner">
                  <Icon name="tv" size={14} />
                  <span>{clock.title || "Listening Together"}</span>
                  <button
                    type="button"
                    className="stage-banner-btn"
                    onClick={() => setPickerModalOpen(true)}
                    title="Switch Music"
                  >
                    Switch
                  </button>
                  <button
                    type="button"
                    className="stage-banner-stop"
                    onClick={() => closePlayer(true)}
                    title="Close Watch Together"
                  >
                    Close
                  </button>
                </div>
                <iframe
                  key={clock.videoId}
                  className="watch-stage-iframe spotify-player"
                  src={`https://open.spotify.com/embed/${clock.videoId}?utm_source=generator&theme=0`}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </>
            ) : (
              <>
                <div className="stage-banner watch-stage-banner">
                  <Icon name="tv" size={14} />
                  <span>{clock.title || "Shared YouTube Video"}</span>
                  <button
                    type="button"
                    className="stage-banner-btn"
                    onClick={() => setPickerModalOpen(true)}
                    title="Switch Video"
                  >
                    Switch
                  </button>
                  <button
                    type="button"
                    className="stage-banner-stop"
                    onClick={() => closePlayer(true)}
                    title="Close Watch Together"
                  >
                    Close
                  </button>
                </div>
                <iframe
                  key={clock.videoId}
                  ref={iframeRef}
                  className="watch-stage-iframe"
                  src={`https://www.youtube.com/embed/${clock.videoId}?enablejsapi=1&autoplay=1&start=${initialStartSecondRef.current}&origin=${typeof window !== "undefined" ? window.location.origin : ""}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </>
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

        {/* Modal for switching video while watching */}
        {pickerModalOpen && renderPicker(true)}
      </div>
    );
  }

  // When picking a video: display clean centered picker dialog
  return renderPicker(false);
}
