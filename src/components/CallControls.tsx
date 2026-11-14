"use client";

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
  effectsOpen: boolean;
  onToggleEffects: () => void;
  pipSupported?: boolean;
  onTogglePip?: () => void;
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
  effectsOpen,
  onToggleEffects,
  pipSupported = false,
  onTogglePip,
  chatVisible,
  onToggleChat,
  unreadCount,
}: Props) {
  return (
    <div className={`call-controls ${watchActive ? "watch-layout" : ""}`}>
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

          <button
            className={`ctrl ${doodleActive ? "active" : ""}`}
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

          {pipSupported && (
            <button
              className="ctrl"
              type="button"
              onClick={onTogglePip}
              aria-label="Minimize call to floating window"
              title="Minimize (Picture in Picture)"
            >
              <span className="ctrl-slot">
                <span className="ctrl-orb">
                  <Icon name="pip" size={19} />
                </span>
              </span>
              <span className="ctrl-label">minimize</span>
            </button>
          )}
        </div>

        <div className="dock-divider" role="separator" aria-orientation="vertical" />

        {/* Bottom Group: Emojis & Chat */}
        <div className="dock-group dock-group-social">
          <div className="reaction-trigger-wrap" onClick={(e) => e.stopPropagation()}>
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
            className={`ctrl ${effectsOpen ? "active" : ""}`}
            type="button"
            onClick={onToggleEffects}
            aria-label="Call audio and video effects"
            title="Effects & Audio"
          >
            <span className="ctrl-slot">
              <span className="ctrl-orb">
                <Icon name="sliders" size={18} />
              </span>
            </span>
            <span className="ctrl-label">effects</span>
          </button>

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
        </div>
      </div>
    </div>
  );
}
