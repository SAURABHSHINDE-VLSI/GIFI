"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import CallChat from "./CallChat";
import CallControls from "./CallControls";
import VideoStage from "./VideoStage";
import PipView from "./PipView";
import WatchTogether from "./WatchTogether";
import LoveCanvas from "./LoveCanvas";
import MomentsScrapbook from "./MomentsScrapbook";
import { Icon } from "./Icons";
import { formatDuration } from "@/lib/ui";
import { useCallChat } from "@/lib/callChat";
import { useCanFlipCamera } from "@/lib/useCanFlipCamera";
import { useGestureReactions } from "@/lib/useGestures";
import type { GestureStatus } from "@/lib/useGestures";
import { useHearts } from "@/lib/useHearts";
import { getDefaultThought } from "@/lib/momentThoughts";

type Props = {
  selfName: string;
  partnerName: string;
  onLeave: () => void;
};

export default function CallUI({ selfName, partnerName, onLeave }: Props) {
  const room = useRoomContext();
  const connection = useConnectionState();
  const { cameraTrack: localCamera, isMicrophoneEnabled: micOn } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const partner = remotes[0];

  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [gestureFlash, setGestureFlash] = useState<string | null>(null);
  const canFlip = useCanFlipCamera();
  const chat = useCallChat(room, selfName);
  const [chatVisible, setChatVisible] = useState(false);
  const [watchActive, setWatchActive] = useState(false);
  const [, setWatchHasVideo] = useState(false);
  const [watchIsPlaying, setWatchIsPlaying] = useState(false);
  const watchTogglePlayRef = useRef<(() => void) | null>(null);
  const [watchSynced] = useState(true);
  const watchSyncRef = useRef<(() => void) | null>(null);
  const watchRewindRef = useRef<((seconds?: number) => void) | null>(null);
  const watchOpenPickerRef = useRef<(() => void) | null>(null);

  // Automatic Audio Ducking (Auto-reduces media and screen share volume to 20% when anyone speaks)
  const localParticipant = room.localParticipant;
  const speakingParticipants = useSpeakingParticipants();
  const isSomeoneSpeaking =
    speakingParticipants.length > 0 ||
    Boolean(localParticipant?.isSpeaking) ||
    Boolean(partner?.isSpeaking);

  const [isDucked, setIsDucked] = useState(false);
  const duckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isSomeoneSpeaking) {
      if (duckTimerRef.current) {
        clearTimeout(duckTimerRef.current);
        duckTimerRef.current = null;
      }
      setIsDucked(true);
    } else {
      duckTimerRef.current = setTimeout(() => {
        setIsDucked(false);
        duckTimerRef.current = null;
      }, 1200);
    }
  }, [isSomeoneSpeaking]);

  const [doodleActive, setDoodleActive] = useState(false);
  const [scrapbookOpen, setScrapbookOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [gesturesEnabled, setGesturesEnabled] = useState(false);
  const [callSoundMuted, setCallSoundMuted] = useState(false);
  const [focusMode, setFocusMode] = useState<"partner" | "self">("partner");

  const stageRef = useRef<HTMLDivElement | null>(null);

  // Hearts & Reactions
  const onKissReceived = useCallback(() => {
    setGestureFlash("💋 Kiss received");
    setTimeout(() => setGestureFlash(null), 2000);
  }, []);

  const { bursts, emojiBursts, sendHearts, sendEmojiBurst, sendKiss } = useHearts(
    room,
    onKissReceived,
  );

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { room },
  );

  const remoteScreen = tracks.find(
    (t): t is TrackReference =>
      Boolean(t.publication) &&
      t.source === Track.Source.ScreenShare &&
      t.participant.identity !== room.localParticipant.identity,
  );
  const localScreen = tracks.find(
    (t): t is TrackReference =>
      Boolean(t.publication) &&
      t.source === Track.Source.ScreenShare &&
      t.participant.identity === room.localParticipant.identity,
  );
  const remoteCam = tracks.find(
    (t): t is TrackReference =>
      Boolean(t.publication) &&
      t.source === Track.Source.Camera &&
      t.participant.identity !== room.localParticipant.identity,
  );
  const localCam = tracks.find(
    (t): t is TrackReference =>
      Boolean(t.publication) &&
      t.source === Track.Source.Camera &&
      t.participant.identity === room.localParticipant.identity,
  );

  const sharing = Boolean(localScreen?.publication);
  const screenStage = Boolean(remoteScreen?.publication || localScreen?.publication);

  const partnerLabel = useMemo(
    () => partner?.name || partnerName || "your person",
    [partner, partnerName],
  );

  useEffect(() => {
    if (connection !== ConnectionState.Connected) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [connection]);

  const toggleMic = useCallback(async () => {
    try {
      await room.localParticipant.setMicrophoneEnabled(!micOn);
    } catch {
      setNotice("Could not toggle microphone.");
      setTimeout(() => setNotice(null), 3000);
    }
  }, [micOn, room]);

  const toggleCam = useCallback(async () => {
    try {
      await room.localParticipant.setCameraEnabled(!localCamera?.track);
    } catch {
      setNotice("Could not toggle camera.");
      setTimeout(() => setNotice(null), 3000);
    }
  }, [localCamera, room]);

  const toggleShare = useCallback(async () => {
    try {
      await room.localParticipant.setScreenShareEnabled(!sharing);
    } catch {
      setNotice("Screen sharing was cancelled or unavailable.");
      setTimeout(() => setNotice(null), 3000);
    }
  }, [sharing, room]);

  const flipCamera = useCallback(async () => {
    const next = facing === "user" ? "environment" : "user";
    try {
      await room.localParticipant.setCameraEnabled(false);
      await room.localParticipant.setCameraEnabled(true, {
        facingMode: next,
      });
      setFacing(next);
    } catch {
      setNotice("Could not switch camera.");
      setTimeout(() => setNotice(null), 3000);
    }
  }, [facing, room]);

  const toggleCallSound = useCallback(() => {
    setCallSoundMuted((v) => !v);
  }, []);

  const flashGesture = useCallback((label: string) => {
    setGestureFlash(label);
    setTimeout(() => setGestureFlash(null), 2200);
  }, []);

  // Screenshot capture for scrapbook moment
  const captureMomentScreenshot = useCallback(async () => {
    flashGesture("📸 Capturing moment…");
    try {
      const videoElements = document.querySelectorAll("video");
      let activeVideo: HTMLVideoElement | null = null;
      for (const v of Array.from(videoElements)) {
        if (v.videoWidth > 0 && v.videoHeight > 0 && !v.classList.contains("mirror")) {
          activeVideo = v;
          break;
        }
      }
      if (!activeVideo && videoElements.length > 0) {
        activeVideo = videoElements[0];
      }

      let dataUrl = "";
      if (activeVideo && activeVideo.videoWidth > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(activeVideo.videoWidth, 800);
        canvas.height = Math.round((canvas.width / activeVideo.videoWidth) * activeVideo.videoHeight);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        }
      }

      if (dataUrl) {
        const thought = getDefaultThought();
        await fetch("/api/moments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_data: dataUrl,
            caption: "Captured with ✌️ Peace Sign",
            thought,
          }),
        });
        flashGesture("✨ Moment saved to scrapbook!");
      } else {
        flashGesture("✌️ Peace sign detected");
      }
    } catch {
      flashGesture("✌️ Peace sign detected");
    }
  }, [flashGesture]);

  const [, setGestures] = useState<GestureStatus>("idle");
  useGestureReactions({
    track: localCam?.publication?.track,
    enabled: gesturesEnabled,
    onPeace: () => {
      captureMomentScreenshot();
    },
    onHeart: () => {
      flashGesture("🫰 hearts");
      sendHearts();
    },
    onKiss: () => {
      flashGesture("💋 kiss sent");
      sendKiss();
    },
    onThumbsUp: () => {
      flashGesture("👍 thumbs up");
      sendEmojiBurst("👍");
    },
    onThumbsDown: () => {
      flashGesture("👎 thumbs down");
      sendEmojiBurst("👎");
    },
    onStatus: setGestures,
  });

  function leave() {
    room.disconnect();
    onLeave();
  }

  const connected = connection === ConnectionState.Connected;

  const stage = screenStage
    ? remoteScreen?.publication
      ? remoteScreen
      : localScreen
    : focusMode === "partner"
      ? remoteCam?.publication
        ? remoteCam
        : localCam
      : localCam?.publication
        ? localCam
        : remoteCam;

  return (
    <div className="call-wrap">
      <header className="call-top">
        <div className="call-top-left">
          <span className="call-meta">
            <span className={`dot ${connected ? "" : "warn"}`} />
            {connected
              ? formatDuration(seconds)
              : connection === ConnectionState.Reconnecting
                ? "reconnecting"
                : "connecting"}
          </span>
          {!screenStage && !watchActive && (
            <button
              className={`polaroid-top-btn ${scrapbookOpen ? "active" : ""}`}
              type="button"
              onClick={() => setScrapbookOpen(true)}
              aria-label="Our Moments Scrapbook"
              title="Our Moments Scrapbook"
            >
              <Icon name="gallery" size={22} />
            </button>
          )}
        </div>
        <div className="call-top-actions">
          {!screenStage && !watchActive && (
            <button
              className={`top-icon ${focusMode === "self" ? "chat-toggle-on" : ""}`}
              type="button"
              onClick={() => setFocusMode((m) => (m === "partner" ? "self" : "partner"))}
              aria-label={focusMode === "partner" ? "Enlarge your view" : `Enlarge ${partnerLabel}'s view`}
              title={focusMode === "partner" ? "Enlarge your view" : `Enlarge ${partnerLabel}'s view`}
            >
              <Icon name="flip" size={16} />
            </button>
          )}
          {/* Toggle at upper corner to mute sound from video call */}
          <button
            className={`top-icon call-audio-toggle ${callSoundMuted ? "muted" : ""}`}
            type="button"
            onClick={toggleCallSound}
            aria-label={callSoundMuted ? "Unmute call sound" : "Mute call sound"}
            title={callSoundMuted ? "Call sound: MUTED (click to unmute)" : "Call sound: ON (click to mute)"}
          >
            <Icon name={callSoundMuted ? "volume-x" : "volume-2"} size={16} />
          </button>
        </div>
      </header>

      {watchActive ? (
        <WatchTogether
          room={room}
          isActive={watchActive}
          onClose={() => {
            setWatchActive(false);
            setWatchHasVideo(false);
          }}
          onVideoStateChange={setWatchHasVideo}
          onPlayingChange={setWatchIsPlaying}
          togglePlayRef={watchTogglePlayRef}
          resyncRef={watchSyncRef}
          rewindRef={watchRewindRef}
          openPickerRef={watchOpenPickerRef}
          isDucked={isDucked}
          syncEnabled={watchSynced}
          onReact={sendEmojiBurst}
          remoteCam={remoteCam}
          localCam={localCam}
          partnerLabel={partnerLabel}
          selfName={selfName}
          partner={partner}
          micOn={micOn}
          chatVisible={chatVisible}
        />
      ) : (
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
          showHint={false}
          connected={connected}
          connection={connection}
          micOn={micOn}
          camOn={Boolean(localCamera?.track)}
          canFlip={canFlip}
          onFlipCamera={flipCamera}
          bursts={bursts}
        />
      )}

      <CallControls
        micOn={micOn}
        camOn={Boolean(localCamera?.track)}
        sharing={sharing}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleShare={toggleShare}
        onLeave={leave}
        watchActive={watchActive}
        onToggleWatch={() => setWatchActive((v) => !v)}
        watchIsPlaying={watchIsPlaying}
        onToggleWatchPlay={() => watchTogglePlayRef.current?.()}
        onWatchRewind={(sec) => {
          watchRewindRef.current?.(sec);
          setNotice("⏪ Rewound 10s together");
          setTimeout(() => setNotice(null), 2500);
        }}
        onWatchSwitch={() => watchOpenPickerRef.current?.()}
        doodleActive={doodleActive}
        onToggleDoodle={() => setDoodleActive((v) => !v)}
        emojiPickerOpen={emojiPickerOpen}
        onToggleEmojiPicker={() => setEmojiPickerOpen((v) => !v)}
        onSelectEmoji={(emoji) => {
          sendEmojiBurst(emoji);
          setEmojiPickerOpen(false);
        }}
        gesturesEnabled={gesturesEnabled}
        onToggleGestures={() => setGesturesEnabled((v) => !v)}
        chatVisible={chatVisible}
        onToggleChat={() => setChatVisible((v) => !v)}
        unreadCount={chat.unread}
      />

      <CallChat
        visible={chatVisible}
        soundOn={chat.soundEnabled}
        openPopups={chat.popups}
        partnerName={partnerName}
        items={chat.items}
        onSend={(text) => chat.sendText(text)}
        onMarkSeen={(id) => chat.markSeenFor(id)}
        onOpen={() => {
          setChatVisible(true);
          chat.clearPopups();
        }}
        onClose={() => setChatVisible(false)}
        onDismissPopup={chat.dismissPopup}
        onReact={sendEmojiBurst}
      />

      <LoveCanvas room={room} isActive={doodleActive} onClose={() => setDoodleActive(false)} />
      <MomentsScrapbook isOpen={scrapbookOpen} onClose={() => setScrapbookOpen(false)} />

      {/* Floating burst layer for hearts & emoji bursts */}
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
        {emojiBursts.map((item) => (
          <span
            key={item.id}
            className="burst-kiss"
            style={{
              left: `${item.left}%`,
              bottom: `${item.bottom}%`,
              fontSize: item.size,
              animationDelay: `${item.delay}s`,
              ["--drift" as string]: `${item.drift}px`,
              ["--rot" as string]: `${item.rotate}deg`,
            }}
          >
            {item.emoji}
          </span>
        ))}
      </div>

      {notice && <div className="toast">{notice}</div>}
      {gestureFlash && <div className="gesture-toast" aria-live="polite">{gestureFlash}</div>}

      <PipView
        remoteCam={remoteCam}
        localCam={localCam}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onLeave={leave}
      />

      <RoomAudioRenderer muted={callSoundMuted} volume={callSoundMuted ? 0 : 1} />
    </div>
  );
}
