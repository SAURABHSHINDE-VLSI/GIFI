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
import { useRouter } from "next/navigation";
import CallChat from "./CallChat";
import { Icon } from "./Icons";
import { formatDuration, initialOf, partnerChip } from "@/lib/ui";
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
  const router = useRouter();
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
  const [chatOpen, setChatOpen] = useState(false);
  const [gestures, setGestures] = useState<GestureStatus>("idle");
  const [showHint, setShowHint] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [partnerListOpen, setPartnerListOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

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

  const sendThumbsUp = useCallback(() => {
    room.localParticipant
      .publishData(new TextEncoder().encode(JSON.stringify({ t: "thumbs_up" })), { reliable: true })
      .catch(() => undefined);
    flashGesture("👍 thumbs up");
  }, [room]);

  const sendFoldedHands = useCallback(() => {
    room.localParticipant
      .publishData(new TextEncoder().encode(JSON.stringify({ t: "folded_hands" })), { reliable: true })
      .catch(() => undefined);
    flashGesture("🙏 folded hands");
  }, [room]);

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
    onPeace: sendScreenshot,
    onHeart: sendHearts,
    onThumbsUp: sendThumbsUp,
    onFoldedHands: sendFoldedHands,
    onStatus: setGestures,
  });

  async function logOut() {
    if (!confirmLogout) {
      setConfirmLogout(true);
      setNotice("Tap again to log out");
      setTimeout(() => setConfirmLogout(false), 3000);
      return;
    }

    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    room.disconnect();
    window.location.href = "/";
  }

  /** Change partner while in a call.
   * Leaves the current LiveKit room (which is bound to the current pair id)
   * and routes back to the app so the user can pick or refresh the partner,
   * then rejoin with the new partner's token.
   */
  async function changePartner() {
    room.disconnect();
    setNotice("Choosing a new partner…");
    setPartnerListOpen(false);
    router.push("/app");
    router.refresh();
  }

  function leave() {
    room.disconnect();
    onLeave();
  }

  const connected = connection === ConnectionState.Connected;
  const partnerLabel = partner?.name || partnerName;

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
                  <div className="call-actions">
            <button
              className="call-partner-chip"
              type="button"
              onClick={() => setPartnerListOpen((v) => !v)}
              aria-label="Partner info and change partner"
              title="Partner info"
            >
              <span dangerouslySetInnerHTML={{ __html: partnerChip(partnerLabel, selfName) }} />
              <span className="call-switch-hint">change partner</span>
            </button>
            <button
              className="top-icon"
              type="button"
              onClick={() => {
                chat.clearUnread();
                setChatOpen(true);
              }}
              aria-label="Open chat"
              title="Chat"
            >
              <Icon name="chat" size={17} />
              {chat.unread > 0 && !chatOpen && <span className="top-badge">{chat.unread}</span>}
            </button>

            <button
              className={`top-icon ${confirmLogout ? "warn" : ""}`}
              type="button"
              onClick={logOut}
              aria-label="Log out"
              title="Log out"
            >
              <Icon name="logout" size={17} />
            </button>
          </div>
          {partnerListOpen && (
            <div className="partner-list" role="dialog" aria-label="Change partner">
              <div className="partner-list-head">
                <span>who's on the call</span>
                <button
                  className="top-icon"
                  type="button"
                  onClick={() => setPartnerListOpen(false)}
                  aria-label="Close partner list"
                >
                  <Icon name="hangup" size={15} />
                </button>
              </div>
              <p className="partner-list-name">{partnerLabel}</p>
              <p className="partner-list-sub">Connected as a couple. To call someone else, leave and pick a new partner.</p>
              <button className="btn btn-ghost" type="button" onClick={changePartner}>
                Leave this partner
              </button>
              <p className="partner-list-note">Your place in the call will end. You can then make or accept a new invite on the home screen.</p>
            </div>

          )}
      </header>

      <div className="call-stage" ref={stageRef}>
        {stage ? (
          screenStage ? (
            <div className="stage-with-faces">
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
            ✌️ screenshot · 🫰 hearts · 👍 thumbs up · 🙏 folded hands
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
        open={chatOpen}
        items={chat.items}
        onClose={() => setChatOpen(false)}
        onSend={chat.sendText}
        onScreenshot={sendScreenshot}
        onMarkSeen={chat.markSeenFor}
        getReceipt={chat.getReceipt}
      />

      {notice && <div className="toast">{notice}</div>}
      {gestureFlash && <div className="gesture-toast" aria-live="polite">{gestureFlash}</div>}
      <RoomAudioRenderer />
    </div>
  );
}
