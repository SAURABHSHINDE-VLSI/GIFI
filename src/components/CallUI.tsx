"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isTrackReference,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import CallChat from "./CallChat";
import { Icon } from "./Icons";
import { formatDuration, initialOf } from "@/lib/ui";
import { useCallChat } from "@/lib/callChat";
import { useCanFlipCamera } from "@/lib/useCanFlipCamera";
import { useGestureReactions } from "@/lib/useGestures";
import type { GestureStatus } from "@/lib/useGestures";

type Props = {
  selfName: string;
  partnerName: string;
  onLeave: () => void;
};

type Burst = { id: number; left: number; size: number; drift: number };

export default function CallUI({ selfName, partnerName, onLeave }: Props) {
  const room = useRoomContext();
  const connection = useConnectionState();
  const partners = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [gestureFlash, setGestureFlash] = useState<string | null>(null);
  const burstTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const canFlip = useCanFlipCamera();
  const chat = useCallChat(room, selfName);
  const [chatVisible, setChatVisible] = useState(false);
  const [gestures, setGestures] = useState<GestureStatus>("idle");
  const [showHint, setShowHint] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!chatVisible) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest(".call-chat-box") && !target.closest(".chat-toggle")) {
        setChatVisible(false);
      }
    };
    const id = setTimeout(() => {
      window.addEventListener("click", handleOutside);
      window.addEventListener("touchstart", handleOutside);
    }, 50);
    return () => {
      clearTimeout(id);
      window.removeEventListener("click", handleOutside);
      window.removeEventListener("touchstart", handleOutside);
    };
  }, [chatVisible]);

  useEffect(() => {
    if (gestures !== "ready") return;
    setShowHint(true);
    const timer = setTimeout(() => setShowHint(false), 8000);
    return () => clearTimeout(timer);
  }, [gestures]);

  useEffect(() => {
    const timers = burstTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const burst = useCallback(() => {
    const batch: Burst[] = Array.from({ length: 7 }, (_, index) => ({
      id: Date.now() + index,
      left: 12 + Math.random() * 72,
      size: 18 + Math.random() * 20,
      drift: Math.random() * 60 - 30,
    }));
    setBursts((current) => [...current, ...batch]);
    const timer = setTimeout(() => {
      setBursts((current) => current.filter((heart) => !batch.some((item) => item.id === heart.id)));
    }, 2800);
    burstTimers.current.push(timer);
  }, []);

  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message?.t === "hearts") burst();
      } catch {
        // ignore malformed messages
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, burst]);

  const partner = partners[0];

  const pick = (isLocal: boolean, source: Track.Source) =>
    tracks.find(
      (track): track is TrackReference =>
        isTrackReference(track) && track.participant.isLocal === isLocal && track.source === source,
    );

  // Her camera comes from her own publication, so nothing happening to my
  // local tracks can take her video off screen.
  const partnerCamera = partner?.getTrackPublication(Track.Source.Camera);
  const remoteCam =
    pick(false, Track.Source.Camera) ??
    (partner && partnerCamera?.track && !partnerCamera.isMuted
      ? { participant: partner, publication: partnerCamera, source: Track.Source.Camera }
      : undefined);

  const remoteScreen = pick(false, Track.Source.ScreenShare);
  const localCam = pick(true, Track.Source.Camera);
  const localScreen = pick(true, Track.Source.ScreenShare);

  const stage = remoteScreen ?? localScreen ?? remoteCam;

  const screenStage = Boolean(remoteScreen || localScreen);

  const micOn = localParticipant.isMicrophoneEnabled;
  const camOn = localParticipant.isCameraEnabled;
  const sharing = localParticipant.isScreenShareEnabled;

  async function toggleMic() {
    try {
      await localParticipant.setMicrophoneEnabled(!micOn);
    } catch {
      setNotice("Could not reach your microphone.");
    }
  }

  async function toggleCam() {
    try {
      await localParticipant.setCameraEnabled(!camOn);
    } catch {
      setNotice("Could not reach your camera.");
    }
  }

  async function toggleShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setNotice("Screen sharing isn't supported on this device.");
      return;
    }

    if (sharing) {
      await localParticipant.setScreenShareEnabled(false).catch(() => undefined);
      return;
    }

    try {
      // Without audio:true the shared tab or video stays silent for her.
      await localParticipant.setScreenShareEnabled(true, { audio: true });
    } catch {
      setNotice("Screen share was cancelled.");
    }
  }

  async function flipCamera() {
    const publication = localParticipant.getTrackPublication(Track.Source.Camera);
    const settings = publication?.track?.mediaStreamTrack.getSettings();

    try {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === "videoinput",
      );

      if (devices.length > 1) {
        const index = devices.findIndex((device) => device.deviceId === settings?.deviceId);
        const next = devices[(index + 1) % devices.length];
        await room.switchActiveDevice("videoinput", next.deviceId);
        return;
      }

      const next = facing === "user" ? "environment" : "user";
      await localParticipant.setCameraEnabled(false);
      await localParticipant.setCameraEnabled(true, { facingMode: next });
      setFacing(next);
    } catch {
      setNotice("Could not switch camera.");
    }
  }

  const sendHearts = useCallback(() => {
    burst();
    room.localParticipant
      .publishData(new TextEncoder().encode(JSON.stringify({ t: "hearts" })), { reliable: true })
      .catch(() => undefined);
  }, [burst, room]);

  const sendScreenshot = useCallback(async () => {
    const video = stageRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (!video || !video.videoWidth) {
      setNotice("Nothing to capture yet.");
      return;
    }

    const width = Math.min(640, video.videoWidth);
    const height = Math.round((video.videoHeight / video.videoWidth) * width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Mirror the screenshot so it matches what you see on screen (face view is mirrored).
    if (video.classList.contains("mirror")) {
      context.translate(width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0, width, height);
    await chat.sendImage(canvas.toDataURL("image/jpeg", 0.6));
    setNotice("Screenshot sent");
  }, [chat]);

  const flashGesture = useCallback((label: string) => {
    setGestureFlash(label);
    setTimeout(() => setGestureFlash(null), 1800);
  }, []);

  useGestureReactions({
    track: localCam?.publication.track,
    enabled: true,
    onPeace: () => {
      flashGesture("✌️ screenshot");
      sendScreenshot();
    },
    onHeart: () => {
      flashGesture("🫰 hearts");
      sendHearts();
    },
    onStatus: setGestures,
  });

  function leave() {
    room.disconnect();
    onLeave();
  }

  const connected = connection === ConnectionState.Connected;
  const partnerLabel = partner?.name || partnerName;

  // Google Meet-style Picture-in-Picture: Opens an OS-level floating window that
  // stays on top of all other tabs and desktop apps when switching tabs or clicking pop-out.
  const pipWindowRef = useRef<any>(null);

  const openDocumentPip = useCallback(async () => {
    // Document Picture-in-Picture API (Chrome 116+):
    if (typeof window !== "undefined" && "documentPictureInPicture" in window) {
      if ((window as any).documentPictureInPicture.window) {
        (window as any).documentPictureInPicture.window.close();
        return;
      }

      try {
        const pipWin = await (window as any).documentPictureInPicture.requestWindow({
          width: 340,
          height: 410,
        });
        pipWindowRef.current = pipWin;

        // Copy all stylesheets from main document
        [...document.styleSheets].forEach((sheet) => {
          try {
            const cssRules = [...sheet.cssRules].map((r) => r.cssText).join("");
            const style = pipWin.document.createElement("style");
            style.textContent = cssRules;
            pipWin.document.head.appendChild(style);
          } catch {
            const link = pipWin.document.createElement("link");
            link.rel = "stylesheet";
            link.href = sheet.href;
            pipWin.document.head.appendChild(link);
          }
        });

        pipWin.document.title = `HERZ — ${partnerLabel}`;
        pipWin.document.body.className = "pip-window-body";

        // Video Stage
        const container = pipWin.document.createElement("div");
        container.className = "pip-video-container";

        const video = pipWin.document.createElement("video");
        video.className = "pip-video-el";
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;

        const activeCam = remoteCam || localCam;
        const tr =
          activeCam && "track" in activeCam
            ? (activeCam.track as { mediaStreamTrack?: MediaStreamTrack })?.mediaStreamTrack
            : undefined;

        if (tr) {
          video.srcObject = new MediaStream([tr]);
          video.play().catch(() => undefined);
        }

        const tag = pipWin.document.createElement("div");
        tag.className = "pip-name-tag";
        tag.textContent = partnerLabel;

        container.appendChild(video);
        container.appendChild(tag);
        pipWin.document.body.appendChild(container);

        // Control bar
        const bar = pipWin.document.createElement("div");
        bar.className = "pip-controls-bar";

        const micSvg = (active: boolean) =>
          active
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5a3 3 0 0 1 5.9-.7"/><path d="M15 9.4V11a3 3 0 0 1-4.9 2.3"/><path d="M5 10v1a7 7 0 0 0 10.5 6.1"/><path d="M19 10v1a7 7 0 0 1-.9 3.4"/><path d="M12 18v4"/><path d="M8 22h8"/><path d="M3 3l18 18"/></svg>`;

        const camSvg = (active: boolean) =>
          active
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M22 7.5 15 11v2l7 3.5v-9z"/></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 15.5V18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2"/><path d="M9.5 5H14a1 1 0 0 1 1 1v4.5"/><path d="M22 7.5 15 11v2l7 3.5v-9z"/><path d="M3 3l18 18"/></svg>`;

        const hangupSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(135 12 12)"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2.1z"/></g></svg>`;

        const micBtn = pipWin.document.createElement("button");
        micBtn.className = `pip-ctrl-btn ${micOn ? "" : "off"}`;
        micBtn.title = micOn ? "Mute microphone" : "Unmute microphone";
        micBtn.innerHTML = micSvg(Boolean(micOn));
        micBtn.onclick = async () => {
          await toggleMic();
          micBtn.className = `pip-ctrl-btn ${!micOn ? "" : "off"}`;
          micBtn.innerHTML = micSvg(!micOn);
        };

        const camBtn = pipWin.document.createElement("button");
        camBtn.className = `pip-ctrl-btn ${camOn ? "" : "off"}`;
        camBtn.title = camOn ? "Turn camera off" : "Turn camera on";
        camBtn.innerHTML = camSvg(Boolean(camOn));
        camBtn.onclick = async () => {
          await toggleCam();
          camBtn.className = `pip-ctrl-btn ${!camOn ? "" : "off"}`;
          camBtn.innerHTML = camSvg(!camOn);
        };

        const endBtn = pipWin.document.createElement("button");
        endBtn.className = "pip-ctrl-btn end";
        endBtn.title = "End call";
        endBtn.innerHTML = hangupSvg;
        endBtn.onclick = () => {
          pipWin.close();
          leave();
        };

        bar.appendChild(micBtn);
        bar.appendChild(camBtn);
        bar.appendChild(endBtn);
        pipWin.document.body.appendChild(bar);

        pipWin.addEventListener("pagehide", () => {
          pipWindowRef.current = null;
        });

        return;
      } catch (err) {
        console.warn("Document PiP request failed, falling back to standard PiP:", err);
      }
    }

    // Standard HTML5 video PiP fallback
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (pipVideoRef.current) {
        await pipVideoRef.current.requestPictureInPicture();
      }
    } catch {
      // ignore
    }
  }, [remoteCam, localCam, partnerLabel, micOn, camOn, toggleMic, toggleCam, leave]);

  // Automatically pop out floating window when the user switches to another tab
  useEffect(() => {
    const onVisibility = async () => {
      if (document.hidden) {
        if (!document.pictureInPictureElement) {
          const video = pipVideoRef.current || stageRef.current?.querySelector("video");
          if (video && typeof video.requestPictureInPicture === "function") {
            try {
              await video.requestPictureInPicture();
            } catch {
              // autoPictureInPicture handles browsers where requestPictureInPicture requires user gesture
            }
          }
        }
      } else {
        // Returned to tab: return video back to page
        if (document.pictureInPictureElement) {
          try {
            await document.exitPictureInPicture();
          } catch {
            // ignore
          }
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // MediaSession actions for OS / Chrome PiP toolbar
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      (navigator.mediaSession as any).setActionHandler?.("togglemicrophone", () => {
        toggleMic();
      });
      (navigator.mediaSession as any).setActionHandler?.("togglecamera", () => {
        toggleCam();
      });
      (navigator.mediaSession as any).setActionHandler?.("hangup", () => {
        leave();
      });
    } catch {
      // ignore
    }
  }, [toggleMic, toggleCam, leave]);

  useEffect(() => {
    if (!pipVideoRef.current) return;
    try {
      (pipVideoRef.current as any).autoPictureInPicture = true;
      pipVideoRef.current.setAttribute("autopictureinpicture", "true");
    } catch {
      // ignore
    }
    pipVideoRef.current.srcObject = null;
    pipVideoRef.current.play().catch(() => undefined);
    const activeCam = remoteCam || localCam;
    if (!activeCam) return;
    const tr =
      "track" in activeCam
        ? (activeCam.track as { mediaStreamTrack?: MediaStreamTrack })?.mediaStreamTrack
        : undefined;
    if (!tr) return;
    pipVideoRef.current.srcObject = new MediaStream([tr]);
    pipVideoRef.current.play().catch(() => undefined);
    return () => {
      if (pipVideoRef.current) {
        pipVideoRef.current.pause();
        pipVideoRef.current.srcObject = null;
      }
    };
  }, [remoteCam, localCam]);

  useEffect(() => {
    const vids = stageRef.current?.querySelectorAll("video");
    vids?.forEach((v) => {
      try {
        (v as any).autoPictureInPicture = true;
        v.setAttribute("autopictureinpicture", "true");
      } catch {
        // ignore
      }
    });
  }, [stage, remoteCam, localCam]);

  return (
    <div className="call">
      <header className="call-top">
        <span className="call-brand">HERZ</span>
        <span className="call-meta">
          <span className={`dot ${connected ? "" : "warn"}`} />
          {connected
            ? formatDuration(seconds)
            : connection === ConnectionState.Reconnecting
              ? "reconnecting"
              : "connecting"}
        </span>
        <div className="call-top-actions">
          <button
            className={`top-icon chat-toggle ${chatVisible ? "chat-toggle-on" : ""} ${chat.unread > 0 ? "has-badge" : ""}`}
            type="button"
            onClick={() => setChatVisible((v) => !v)}
            aria-label={chatVisible ? "Close chat" : "Open chat"}
            title="Chat"
          >
            <Icon name="chat" size={15} />
            {chat.unread > 0 && <span className="top-badge">{chat.unread}</span>}
          </button>
        </div>
      </header>

      <div className="call-stage" ref={stageRef}>
        {stage ? (
          screenStage ? (
            <div className={`stage-with-faces ${chatVisible ? "chat-open" : ""}`}>
              <div className="stage-with-faces-inner">
                <div className="stage-video-wrap">
                  <VideoTrack
                    trackRef={stage}
                    className="stage-video contain"
                    playsInline
                  />
                  <div className="stage-banner">
                    <Icon name="screen" size={14} />
                    {remoteScreen ? `${partnerLabel} is sharing their screen` : "You are sharing your screen"}
                  </div>
                </div>
                <div className="face-tiles">
                  <div className="face-tile">
                    {remoteCam ? (
                      <VideoTrack trackRef={remoteCam} className="face-video mirror" playsInline />
                    ) : (
                      <div className="face-off">{initialOf(partner?.name || partnerName)}</div>
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
          ) : (
            <VideoTrack
              trackRef={stage}
              className="stage-video mirror"
              playsInline
            />
          )
        ) : partner ? (
          <div className="stage-empty">
            <div className="avatar remote">{initialOf(partner.name || partner.identity)}</div>
            <p className="stage-cap">{partnerLabel}</p>
            <p className="stage-sub">voice call</p>
          </div>
        ) : (
          <div className="stage-empty">
            <div className="waiting">
              <div className="waiting-heart">
                <Icon name="heart" size={26} />
              </div>
              <h2>Waiting for {partnerName}</h2>
              <p className="stage-sub">The call begins the moment they join.</p>
            </div>
          </div>
        )}

        {!screenStage && (
          <div className="stage-banner">
            <Icon name="screen" size={14} />
            {localScreen ? "You are sharing your screen" : remoteScreen ? `${partnerLabel} is sharing their screen` : ""}
          </div>
        )}

        {showHint && (
          <div className="gesture-hint">
            ✌️ screenshot · 🫰 hearts
          </div>
        )}

        {!connected && (
          <div className="stage-veil">
            <span className="boot-heart">♥</span>
            <span>
              {connection === ConnectionState.Reconnecting ? "reconnecting…" : "connecting…"}
            </span>
          </div>
        )}

        {!screenStage && (
          <div className={`local-tile ${micOn ? "" : "muted"}`}>
            {localCam ? (
              <VideoTrack trackRef={localCam} className="local-video" playsInline />
            ) : (
              <div className="local-off">
                <div className="avatar small">{initialOf(selfName)}</div>
                <span>camera off</span>
              </div>
            )}

            {canFlip && camOn && (
              <button
                className="flip-btn"
                type="button"
                onClick={flipCamera}
                aria-label="Switch camera"
                title="Switch camera"
              >
                <Icon name="flip" size={14} />
              </button>
            )}

            <span className="tag">
              {selfName}
              {!micOn && <Icon name="mic-off" size={11} />}
            </span>
          </div>
        )}

        <div className="burst-layer" aria-hidden="true">
          {bursts.map((heart) => (
            <span
              key={heart.id}
              className="burst-heart"
              style={{
                left: `${heart.left}%`,
                fontSize: heart.size,
                ["--drift" as string]: `${heart.drift}px`,
              }}
            >
              ♥
            </span>
          ))}
        </div>
      </div>

      <div className="call-controls">
        <div className="dock">
          <button
            className={`ctrl ${micOn ? "" : "off"}`}
            type="button"
            onClick={toggleMic}
            aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
          >
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name={micOn ? "mic" : "mic-off"} size={20} />
              </span>
            </span>
            <span className="ctrl-label">{micOn ? "mic" : "muted"}</span>
          </button>
          <button
            className={`ctrl ${camOn ? "" : "off"}`}
            type="button"
            onClick={toggleCam}
            aria-label={camOn ? "Turn camera off" : "Turn camera on"}
          >
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name={camOn ? "camera" : "camera-off"} size={20} />
              </span>
            </span>
            <span className="ctrl-label">{camOn ? "camera" : "camera off"}</span>
          </button>
          <button
            className={`ctrl ${sharing ? "active" : ""}`}
            type="button"
            onClick={toggleShare}
            aria-label={sharing ? "Stop sharing screen" : "Share screen"}
          >
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name="screen" size={20} />
              </span>
            </span>
            <span className="ctrl-label">{sharing ? "sharing" : "share"}</span>
          </button>
          <button
            className="ctrl heart-btn"
            type="button"
            onClick={sendHearts}
            aria-label="Send hearts"
          >
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name="heart" size={19} />
              </span>
            </span>
            <span className="ctrl-label">hearts</span>
          </button>
          <button className="ctrl end" type="button" onClick={leave} aria-label="End call">
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name="hangup" size={21} />
              </span>
            </span>
            <span className="ctrl-label">end</span>
          </button>
        </div>
      </div>

      <CallChat
        visible={chatVisible}
        openPopups={chat.popups}
        items={chat.items}
        partnerName={partnerLabel}
        onSend={chat.sendText}
        onScreenshot={sendScreenshot}
        onMarkSeen={chat.markSeenFor}
        getReceipt={chat.getReceipt}
        soundOn={chat.soundEnabled}
        onToggleSound={chat.toggleSound}
        onOpen={() => setChatVisible(true)}
        onClose={() => setChatVisible(false)}
      />

      {notice && <div className="toast">{notice}</div>}
      {gestureFlash && <div className="gesture-toast" aria-live="polite">{gestureFlash}</div>}
      {chat.popups.length > 0 && <div className="popup-layer" aria-live="polite">{/* popups render inside CallChat */}</div>}
      <video
        ref={pipVideoRef}
        autoPlay
        muted
        playsInline
        className="auto-pip-video"
        aria-hidden="true"
      />
      <RoomAudioRenderer />
    </div>
  );
}
