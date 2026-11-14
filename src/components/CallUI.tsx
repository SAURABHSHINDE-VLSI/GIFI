"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RoomAudioRenderer,
  useAudioPlayback,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";
import { ConnectionState, Track, LocalVideoTrack } from "livekit-client";
import CallChat from "./CallChat";
import CallDock from "./CallDock";
import CallControls from "./CallControls";
import VideoStage from "./VideoStage";
import { useCallPip } from "@/lib/useCallPip";
import {
  loadAutoPipPref,
  saveAutoPipPref,
  loadPrefs,
  savePrefs,
  loadWatchSyncPref,
  saveWatchSyncPref,
  type EffectsPrefs,
} from "@/lib/effects";
import WatchTogether from "./WatchTogether";
import LoveCanvas from "./LoveCanvas";
import MomentsScrapbook from "./MomentsScrapbook";
import EffectsSheet from "./EffectsSheet";
import { applyNoiseSuppression } from "@/lib/audioEffects";
import { useBackgroundEffect } from "@/lib/useBackgroundEffect";
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
  const { canPlayAudio, startAudio } = useAudioPlayback(room);

  // Enable audio playback automatically on any user gesture in the call
  useEffect(() => {
    if (canPlayAudio) return;
    const unlockAudio = () => {
      startAudio().catch(() => undefined);
      room.startAudio().catch(() => undefined);
    };
    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    window.addEventListener("touchstart", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, [canPlayAudio, room, startAudio]);
  const {
    cameraTrack: localCamera,
    isCameraEnabled,
    isMicrophoneEnabled: micOn,
  } = useLocalParticipant();
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
  const [watchSynced, setWatchSynced] = useState<boolean>(() => loadWatchSyncPref());
  const handleWatchSyncChange = useCallback((enabled: boolean) => {
    setWatchSynced(enabled);
    saveWatchSyncPref(enabled);
  }, []);
  const watchSyncRef = useRef<(() => void) | null>(null);
  const watchRewindRef = useRef<((seconds?: number) => void) | null>(null);
  const watchOpenPickerRef = useRef<(() => void) | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

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
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [autoPipEnabled, setAutoPipEnabled] = useState(() => loadAutoPipPref());
  const [watchTitle, setWatchTitle] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<EffectsPrefs>(() => loadPrefs());

  const stageRef = useRef<HTMLDivElement | null>(null);

  // The emoji bar is a quick picker, not a permanent toolbar: it hides itself after
  // a few seconds, and also on picking an emoji, tapping outside or pressing Escape.
  useEffect(() => {
    if (!emojiPickerOpen) return;

    const timer = window.setTimeout(() => setEmojiPickerOpen(false), 4000);
    return () => window.clearTimeout(timer);
  }, [emojiPickerOpen]);

  useEffect(() => {
    if (!emojiPickerOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target.closest(".reaction-trigger-wrap")) return;
      setEmojiPickerOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEmojiPickerOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [emojiPickerOpen]);

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
      Boolean(t.publication && !t.publication.isMuted) &&
      t.source === Track.Source.Camera &&
      t.participant.identity !== room.localParticipant.identity,
  );
  const localCam = tracks.find(
    (t): t is TrackReference =>
      Boolean(t.publication && !t.publication.isMuted) &&
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

  const cameraOn = Boolean(isCameraEnabled && (!localCamera || !localCamera.isMuted));

  const localVideoTrack = localCam?.publication?.track as LocalVideoTrack | undefined;
  const { supported: blurSupported } = useBackgroundEffect({
    track: cameraOn ? localVideoTrack : undefined,
    mode: prefs.background,
    onModeChange: (nextMode) => {
      setPrefs((curr) => {
        const next = { ...curr, background: nextMode };
        savePrefs(next);
        return next;
      });
    },
    onError: (msg) => {
      setNotice(msg);
      setTimeout(() => setNotice(null), 3500);
    },
  });

  const handlePrefsChange = useCallback(
    async (nextPrefs: EffectsPrefs) => {
      const prevNoise = prefs.noiseSuppression;
      setPrefs(nextPrefs);
      savePrefs(nextPrefs);

      if (prevNoise !== nextPrefs.noiseSuppression) {
        try {
          await applyNoiseSuppression(room, nextPrefs.noiseSuppression);
        } catch (err) {
          console.warn("Could not apply noise suppression:", err);
        }
      }
    },
    [prefs.noiseSuppression, room],
  );

  // A watch session arriving from the partner should open the player on this side.
  const handleWatchVideoState = useCallback((hasVideo: boolean) => {
    setWatchHasVideo(hasVideo);
    if (hasVideo) setWatchActive(true);
  }, []);

  const toggleCam = useCallback(async () => {
    const enabling = !cameraOn;

    try {
      if (enabling) {
        const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        const existingTrack = pub?.track as LocalVideoTrack | undefined;
        const trackEnded = Boolean(existingTrack?.mediaStreamTrack && existingTrack.mediaStreamTrack.readyState === "ended");

        if (trackEnded && pub?.track) {
          // Track is in ended state; unpublish stale track so LiveKit creates a fresh one
          await room.localParticipant.unpublishTrack(pub.track, true).catch(() => undefined);
          await room.localParticipant.setCameraEnabled(true, { facingMode: facing });
        } else {
          await room.localParticipant.setCameraEnabled(true, { facingMode: facing });
          // Verify track is live; if not, restart it
          const currentPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
          const currentTrack = currentPub?.track as LocalVideoTrack | undefined;
          if (currentTrack && currentTrack.mediaStreamTrack?.readyState === "ended") {
            await currentTrack.restartTrack({ facingMode: facing });
          }
        }
      } else {
        await room.localParticipant.setCameraEnabled(false);
      }
    } catch (err) {
      console.warn("Direct camera toggle failed, attempting clean recovery:", err);
      if (enabling) {
        try {
          const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (pub?.track) {
            await room.localParticipant.unpublishTrack(pub.track, true).catch(() => undefined);
          }
          await room.localParticipant.setCameraEnabled(true, { facingMode: facing });
          return;
        } catch (recoveryErr) {
          console.error("Camera recovery failed:", recoveryErr);
        }
      }
      setNotice(enabling ? "Camera could not start. Please check camera permissions." : "Could not turn camera off.");
      setTimeout(() => setNotice(null), 3500);
    }
  }, [cameraOn, facing, room]);

  const toggleShare = useCallback(async () => {
    if (sharing) {
      try {
        const screenVideoPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        const screenAudioPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
        if (screenVideoPub?.track) {
          screenVideoPub.track.stop();
          await room.localParticipant.unpublishTrack(screenVideoPub.track, true).catch(() => undefined);
        }
        if (screenAudioPub?.track) {
          screenAudioPub.track.stop();
          await room.localParticipant.unpublishTrack(screenAudioPub.track, true).catch(() => undefined);
        }
        await room.localParticipant.setScreenShareEnabled(false);
      } catch {
        setNotice("Could not stop screen share.");
        setTimeout(() => setNotice(null), 3000);
      }
      return;
    }

    let seenHint = false;
    try {
      seenHint = typeof window !== "undefined" && Boolean(localStorage.getItem("herz:sharehint"));
    } catch {
      // ignore
    }
    if (!seenHint) {
      try {
        localStorage.setItem("herz:sharehint", "1");
      } catch {
        // ignore
      }
      setNotice("To share sound, pick a Chrome or Edge tab and tick 'Also share tab audio'.");
      setTimeout(() => setNotice(null), 5000);
    }

    const captureOptions: Parameters<typeof room.localParticipant.setScreenShareEnabled>[1] = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        restrictOwnAudio: true,
      },
      systemAudio: "include",
      surfaceSwitching: "include",
      selfBrowserSurface: "exclude",
    };

    try {
      await room.localParticipant.setScreenShareEnabled(true, captureOptions);
      const screenAudioPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
      if (!screenAudioPub) {
        setNotice("Sharing without sound. Next time choose a browser tab and tick 'Also share tab audio'.");
        setTimeout(() => setNotice(null), 6000);
      }
    } catch {
      setNotice("Screen sharing was cancelled or unavailable.");
      setTimeout(() => setNotice(null), 3000);
    }
  }, [sharing, room]);

  // Clean up any lingering screen share audio track when screen sharing ends
  useEffect(() => {
    if (!sharing) {
      const audioPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
      if (audioPub?.track) {
        audioPub.track.stop();
        room.localParticipant.unpublishTrack(audioPub.track, true).catch(() => undefined);
      }
    }
  }, [sharing, room]);

  const flipCamera = useCallback(async () => {
    const next = facing === "user" ? "environment" : "user";
    try {
      await room.localParticipant.setCameraEnabled(false);
      await new Promise((resolve) => setTimeout(resolve, 150));
      await room.localParticipant.setCameraEnabled(true, {
        facingMode: next,
      });
      setFacing(next);
    } catch {
      setNotice("Could not switch camera.");
      setTimeout(() => setNotice(null), 3000);
    }
  }, [facing, room]);

  const {
    supported: pipSupported,
    open: openPip,
    PipPortal,
  } = useCallPip({
    room,
    partnerCam: remoteCam,
    screenShare: screenStage ? (remoteScreen || localScreen) : undefined,
    watchStatus: {
      active: watchActive && Boolean(watchTitle),
      title: watchTitle ?? "Watch Together",
      playing: watchIsPlaying,
      toggle: () => watchTogglePlayRef.current?.(),
    },
    localMic: {
      micOn,
      toggleMic,
    },
    localCam: {
      camOn: cameraOn,
      toggleCam,
    },
    partnerLabel,
    onEndCall: onLeave,
    autoPipEnabled,
  });

  // Preserve openPip and pipSupported references for programmatic/gesture access
  void openPip;
  void pipSupported;

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
        const maxSide = 1280;
        let w = activeVideo.videoWidth;
        let h = activeVideo.videoHeight;
        if (w > maxSide || h > maxSide) {
          if (w >= h) {
            h = Math.round((h * maxSide) / w);
            w = maxSide;
          } else {
            w = Math.round((w * maxSide) / h);
            h = maxSide;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL("image/jpeg", 0.8);
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
    track: cameraOn && localCam?.publication && !localCam.publication.isMuted ? localCam.publication.track : undefined,
    enabled: Boolean(gesturesEnabled && cameraOn && localCam?.publication && !localCam.publication.isMuted && !sharing),
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

  // Never silently swap in your own feed when the partner's camera is off — that
  // made the enlarged view look like a mirror when it was supposed to be them.
  const stage = screenStage
    ? remoteScreen?.publication && !remoteScreen.publication.isMuted
      ? remoteScreen
      : localScreen?.publication && !localScreen.publication.isMuted
        ? localScreen
        : undefined
    : focusMode === "partner"
      ? remoteCam?.publication && !remoteCam.publication.isMuted
        ? remoteCam
        : undefined
      : localCam?.publication && !localCam.publication.isMuted
        ? localCam
        : undefined;

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

      <main className="call-main-stage">
        {/* Always mounted: its LiveKit data listener must exist on BOTH sides so a
            session started by one partner opens on the other one too. */}
        <WatchTogether
          room={room}
          isActive={watchActive}
          onClose={() => {
            setWatchActive(false);
            setWatchHasVideo(false);
          }}
          onVideoStateChange={handleWatchVideoState}
          onPlayingChange={setWatchIsPlaying}
          onTitleChange={setWatchTitle}
          togglePlayRef={watchTogglePlayRef}
          resyncRef={watchSyncRef}
          rewindRef={watchRewindRef}
          openPickerRef={watchOpenPickerRef}
          isDucked={isDucked}
          syncEnabled={watchSynced}
          onSyncChange={handleWatchSyncChange}
          effectsOpen={effectsOpen}
          onToggleEffects={() => setEffectsOpen((prev) => !prev)}
          onReact={sendEmojiBurst}
          remoteCam={remoteCam}
          localCam={localCam}
          partnerLabel={partnerLabel}
          selfName={selfName}
          partner={partner}
          micOn={micOn}
          chatVisible={chatVisible}
          doodleActive={doodleActive}
          dockRef={dockRef}
        />

        {!watchActive && (
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
            camOn={cameraOn}
            canFlip={canFlip}
            onFlipCamera={flipCamera}
            effectsOpen={effectsOpen}
            onToggleEffects={() => setEffectsOpen((prev) => !prev)}
            bursts={bursts}
            focusMode={focusMode}
          />
        )}
      </main>

      <CallDock ref={dockRef}>
        <CallControls
          micOn={micOn}
          camOn={cameraOn}
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
          onToggleGestures={() => {
            const next = !gesturesEnabled;
            setGesturesEnabled(next);
            setNotice(next ? "✋ Hand gestures ON" : "Hand gestures OFF");
            setTimeout(() => setNotice(null), 2500);
          }}
          chatVisible={chatVisible}
          onToggleChat={() => setChatVisible((v) => !v)}
          unreadCount={chat.unread}
        />
      </CallDock>

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

      <LoveCanvas room={room} isActive={doodleActive} onClose={() => setDoodleActive(false)} watchActive={watchActive} />
      <MomentsScrapbook isOpen={scrapbookOpen} onClose={() => setScrapbookOpen(false)} />
      <EffectsSheet
        isOpen={effectsOpen}
        onClose={() => setEffectsOpen(false)}
        prefs={prefs}
        onPrefsChange={handlePrefsChange}
        blurSupported={blurSupported}
        autoPipEnabled={autoPipEnabled}
        onToggleAutoPip={(enabled) => {
          setAutoPipEnabled(enabled);
          saveAutoPipPref(enabled);
        }}
      />
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
      {!canPlayAudio && (
        <button
          type="button"
          className="toast audio-permission-toast"
          onClick={() => {
            startAudio().catch(() => undefined);
            room.startAudio().catch(() => undefined);
          }}
          style={{
            cursor: "pointer",
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
          aria-label="Tap to enable sound"
        >
          <Icon name="mic" size={16} />
          <span>Tap to enable sound</span>
        </button>
      )}

      {PipPortal}

      <RoomAudioRenderer muted={callSoundMuted} volume={callSoundMuted ? 0 : 1} />
    </div>
  );
}
