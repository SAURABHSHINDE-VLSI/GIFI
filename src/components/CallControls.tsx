"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";

const REACTION_EMOJIS = ["❤️", "💖", "💋", "🫶", "🔥", "😂", "😍", "🥺", "👍", "🎉"];

type Props = {
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleShare: () => void;
  onLeave: () => void;
  watchActive: boolean;
  onToggleWatch: () => void;
  watchIsPlaying?: boolean;
  onToggleWatchPlay?: () => void;
  onWatchRewind?: (seconds: number) => void;
  onWatchSwitch?: () => void;
  doodleActive: boolean;
  onToggleDoodle: () => void;
  emojiPickerOpen: boolean;
  onToggleEmojiPicker: () => void;
  onSelectEmoji: (emoji: string) => void;
  gesturesEnabled: boolean;
  onToggleGestures: () => void;
  chatVisible: boolean;
  onToggleChat: () => void;
  unreadCount: number;
};

export default function CallControls({
  micOn,
  camOn,
  sharing,
  onToggleMic,
  onToggleCam,
  onToggleShare,
  onLeave,
  watchActive,
  onToggleWatch,
  doodleActive,
  onToggleDoodle,
  emojiPickerOpen,
  onToggleEmojiPicker,
  onSelectEmoji,
  gesturesEnabled,
  onToggleGestures,
  chatVisible,
  onToggleChat,
  unreadCount,
}: Props) {
  const [canShare, setCanShare] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      setCanShare(typeof navigator.mediaDevices.getDisplayMedia === "function");
    }
  }, []);

  useEffect(() => {
    if (!moreOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (moreWrapRef.current && !moreWrapRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  return (
    <div className="call-controls">
      <div className="dock">
        {/* Left Group: Core Call Controls (Mic, Camera, End) */}
        <div className="dock-group dock-group-left">
          <button
            className={`ctrl ${micOn ? "" : "off"}`}
            type="button"
            onClick={onToggleMic}
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
            onClick={onToggleCam}
            aria-label={camOn ? "Turn camera off" : "Turn camera on"}
          >
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name={camOn ? "camera" : "camera-off"} size={20} />
              </span>
            </span>
            <span className="ctrl-label">{camOn ? "camera" : "camera off"}</span>
          </button>

          <button className="ctrl end" type="button" onClick={onLeave} aria-label="End call">
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name="hangup" size={21} />
              </span>
            </span>
            <span className="ctrl-label">end</span>
          </button>
        </div>

        <div className="dock-divider" role="separator" aria-orientation="vertical" />

        {/* Center Group: Shared Activities (Share, Watching, Doodle) */}
        <div className="dock-group dock-group-center">
          {(canShare || sharing) && (
            <button
              className={`ctrl ${sharing ? "active" : ""}`}
              type="button"
              onClick={onToggleShare}
              aria-label={sharing ? "Stop sharing screen" : "Share screen"}
              title={sharing ? "Stop sharing screen" : "Share screen"}
            >
              <span className="ctrl-slot">
                <span className="ctrl-orb">
                  <Icon name="screen" size={20} />
                </span>
              </span>
              <span className="ctrl-label">{sharing ? "sharing" : "share"}</span>
            </button>
          )}

          <button
            className={`ctrl ${watchActive ? "active" : ""}`}
            type="button"
            onClick={onToggleWatch}
            aria-label={watchActive ? "Close Watch Together" : "Watch & Listen Together"}
            title="Watch & Listen Together"
          >
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name="tv" size={19} />
              </span>
            </span>
            <span className="ctrl-label">{watchActive ? "watching" : "watch"}</span>
          </button>

          {/* Doodle button: desktop view (hidden on narrow mobile) */}
          <button
            className={`ctrl ctrl-desktop-secondary ${doodleActive ? "active" : ""}`}
            type="button"
            onClick={onToggleDoodle}
            aria-label={doodleActive ? "Close Doodle" : "Love Canvas Doodle"}
            title="Love Canvas"
          >
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name="pen" size={17} />
              </span>
            </span>
            <span className="ctrl-label">{doodleActive ? "doodling" : "doodle"}</span>
          </button>
        </div>

        <div className="dock-divider" role="separator" aria-orientation="vertical" />

        {/* Social Group: Emojis & Chat */}
        <div className="dock-group dock-group-social">
          {/* Reaction trigger: desktop view (hidden on narrow mobile) */}
          <div className="reaction-trigger-wrap ctrl-desktop-secondary" onClick={(e) => e.stopPropagation()}>
            {emojiPickerOpen && (
              <div className="dock-emoji-bar" role="dialog" aria-label="Pick an emoji reaction">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="dock-emoji-item"
                    onClick={() => onSelectEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
                <div className="dock-emoji-divider" />
                <button
                  type="button"
                  className={`dock-gesture-toggle ${gesturesEnabled ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleGestures();
                  }}
                  title={
                    gesturesEnabled
                      ? "Camera Hand Gestures: ON (click to disable)"
                      : "Camera Hand Gestures: OFF (click to enable)"
                  }
                >
                  <Icon name="sparkles" size={12} />
                  <span>{gesturesEnabled ? "AI: ON" : "AI: OFF"}</span>
                </button>
              </div>
            )}

            <button
              className={`ctrl reaction-ctrl ${emojiPickerOpen ? "active" : ""}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEmojiPicker();
              }}
              aria-label="Send Reaction Emoji"
              title="Send Reaction Emoji"
            >
              <span className="ctrl-slot">
                <span className="ctrl-orb">
                  <Icon name="sparkles" size={17} />
                </span>
                {gesturesEnabled && <span className="orb-live-dot" />}
              </span>
              <span className="ctrl-label">react</span>
            </button>
          </div>

          <button
            className={`ctrl chat-ctrl ${chatVisible ? "active" : ""}`}
            type="button"
            onClick={onToggleChat}
            aria-label={chatVisible ? "Close chat" : "Open chat"}
            title={chatVisible ? "Close chat" : "Open chat"}
          >
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name="chat" size={18} />
              </span>
              {unreadCount > 0 && <span className="ctrl-badge">{unreadCount}</span>}
            </span>
            <span className="ctrl-label">chat</span>
          </button>

          {/* More popover: mobile view (<= 420px) */}
          <div className="dock-more-wrap ctrl-mobile-more" ref={moreWrapRef} onClick={(e) => e.stopPropagation()}>
            <button
              className={`ctrl ${moreOpen || doodleActive ? "active" : ""}`}
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-label="More actions"
              aria-expanded={moreOpen}
            >
              <span className="ctrl-slot">
                <span className="ctrl-orb">
                  <Icon name="more" size={20} />
                </span>
                {(doodleActive || gesturesEnabled) && <span className="orb-live-dot" />}
              </span>
              <span className="ctrl-label">more</span>
            </button>

            {moreOpen && (
              <div className="dock-more-popover" role="dialog" aria-label="More actions">
                <button
                  type="button"
                  className={`dock-more-action-btn ${doodleActive ? "active" : ""}`}
                  onClick={() => {
                    onToggleDoodle();
                    setMoreOpen(false);
                  }}
                >
                  <Icon name="pen" size={16} />
                  <span>{doodleActive ? "Close Doodle Canvas" : "Love Canvas (Doodle)"}</span>
                </button>

                <div className="dock-more-divider" />

                <div className="dock-more-emojis">
                  <div className="dock-more-emojis-row">
                    {REACTION_EMOJIS.slice(0, 5).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="dock-emoji-item"
                        onClick={() => {
                          onSelectEmoji(emoji);
                          setMoreOpen(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="dock-more-emojis-row">
                    {REACTION_EMOJIS.slice(5, 10).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="dock-emoji-item"
                        onClick={() => {
                          onSelectEmoji(emoji);
                          setMoreOpen(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`dock-gesture-toggle ${gesturesEnabled ? "active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleGestures();
                    }}
                    title="Camera Hand Gestures"
                  >
                    <Icon name="sparkles" size={12} />
                    <span>{gesturesEnabled ? "AI Gestures: ON" : "AI Gestures: OFF"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
