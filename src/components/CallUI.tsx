"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isTrackReference,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import CallChat from "./CallChat";
import CallControls from "./CallControls";
import VideoStage from "./VideoStage";
import PipView from "./PipView";
import { Icon } from "./Icons";
import { formatDuration } from "@/lib/ui";
import { useCallChat } from "@/lib/callChat";
import { useCanFlipCamera } from "@/lib/useCanFlipCamera";
import { useGestureReactions } from "@/lib/useGestures";
import type { GestureStatus } from "@/lib/useGestures";
import { useHearts } from "@/lib/useHearts";

type Props = {
  selfName: string;
  partnerName: string;
  onLeave: () => void;
};

export default function CallUI({ selfName, partnerName, onLeave }: Props) {
  const room = useRoomContext();
  const connection = useConnectionState();
  const partners = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [gestureFlash, setGestureFlash] = useState<string | null>(null);
  const canFlip = useCanFlipCamera();
  const chat = useCallChat(room, selfName);
  const [chatVisible, setChatVisible] = useState(false);
  const [gestures, setGestures] = useState<GestureStatus>("idle");
  const [showHint, setShowHint] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const { bursts, sendHearts } = useHearts(room);

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

  const partner = partners[0];

  const pick = useCallback(
    (isLocal: boolean, source: Track.Source) =>
      tracks.find(
        (track): track is TrackReference =>
          isTrackReference(track) && track.participant.isLocal === isLocal && track.source === source,
      ),
    [tracks],
  );

  // Partner's camera publication
  const partnerCamera = partner?.getTrackPublication(Track.Source.Camera);
  const remoteCam = useMemo(
    () =>
      pick(false, Track.Source.Camera) ??
      (partner && partnerCamera?.track && !partnerCamera.isMuted
        ? { participant: partner, publication: partnerCamera, source: Track.Source.Camera }
        : undefined),
    [pick, partner, partnerCamera],
  );

  const remoteScreen = pick(false, Track.Source.ScreenShare);
  const localCam = pick(true, Track.Source.Camera);
  const localScreen = pick(true, Track.Source.ScreenShare);

  const stage = remoteScreen ?? localScreen ?? remoteCam;
  const screenStage = Boolean(remoteScreen || localScreen);

  const micOn = localParticipant.isMicrophoneEnabled;
  const camOn = localParticipant.isCameraEnabled;
  const sharing = localParticipant.isScreenShareEnabled;

  const toggleMic = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!micOn);
    } catch {
      setNotice("Could not reach your microphone.");
    }
  }, [localParticipant, micOn]);

  const toggleCam = useCallback(async () => {
    try {
      await localParticipant.setCameraEnabled(!camOn);
    } catch {
      setNotice("Could not reach your camera.");
    }
  }, [localParticipant, camOn]);

  const toggleShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setNotice("Screen sharing isn't supported on this device.");
      return;
    }

    if (sharing) {
      await localParticipant.setScreenShareEnabled(false).catch(() => undefined);
      return;
    }

    try {
      await localParticipant.setScreenShareEnabled(true, { audio: true });
    } catch {
      setNotice("Screen share was cancelled.");
    }
  }, [localParticipant, sharing]);

  const flipCamera = useCallback(async () => {
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
  }, [localParticipant, facing, room]);

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

  const leave = useCallback(() => {
    room.disconnect();
    onLeave();
  }, [room, onLeave]);

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

      <VideoStage
        stageRef={stageRef}
        stage={stage}
        screenStage={screenStage}
        chatVisible={chatVisible}
        remoteScreen={remoteScreen}
        localScreen={localScreen}
        remoteCam={remoteCam}
        localCam={localCam}
        partner={partner}
        partnerLabel={partnerLabel}
        partnerName={partnerName}
        selfName={selfName}
        showHint={showHint}
        connected={connected}
        connection={connection}
        micOn={micOn}
        camOn={camOn}
        canFlip={canFlip}
        onFlipCamera={flipCamera}
        bursts={bursts}
      />

      <CallControls
        micOn={micOn}
        camOn={camOn}
        sharing={sharing}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleShare={toggleShare}
        onSendHearts={sendHearts}
        onLeave={leave}
      />

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

      <PipView
        remoteCam={remoteCam}
        localCam={localCam}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onLeave={leave}
      />

      <RoomAudioRenderer />
    </div>
  );
}
