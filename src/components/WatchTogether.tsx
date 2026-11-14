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

  // Rewind helper
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

  // Request sync on join
  useEffect(() => {
    if (isActive && !clockRef.current) {
      broadcastWatch({ t: "watch_clock_req" });
    }
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
              placeholder="Paste YouTube or Spotify link (e.g. https://youtu.be/...)"
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
            <h4>Or choose video & music together:</h4>
            <div className="suggestions-grid">
              {ROMANTIC_SUGGESTIONS.map((item) => (
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
        </div>
      </div>
    </div>
  );

  if (!isActive) return null;

  // When video/music is loaded: render Full Stage layout
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
            {clock.mediaType === "spotify" ? (
              <>
                <div className="stage-banner watch-stage-banner">
                  <Icon name="tv" size={14} />
                  <span>{clock.title}</span>
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
                  src={buildSpotifyEmbedUrl(clock.videoId)}
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
                  <span>{clock.title}</span>
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
                  src={buildYouTubeEmbedUrl(
                    clock.videoId,
                    initialStartSecondRef.current,
                    typeof window !== "undefined" ? window.location.origin : "",
                  )}
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
