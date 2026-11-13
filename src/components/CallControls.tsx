"use client";

import { Icon } from "./Icons";

type Props = {
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleShare: () => void;
  onSendHearts: () => void;
  onLeave: () => void;
};

export default function CallControls({
  micOn,
  camOn,
  sharing,
  onToggleMic,
  onToggleCam,
  onToggleShare,
  onSendHearts,
  onLeave,
}: Props) {
  return (
    <div className="call-controls">
      <div className="dock">
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
        <button
          className={`ctrl ${sharing ? "active" : ""}`}
          type="button"
          onClick={onToggleShare}
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
          onClick={onSendHearts}
          aria-label="Send hearts"
        >
          <span className="ctrl-slot">
            <span className="ctrl-orb">
              <Icon name="heart" size={19} />
            </span>
          </span>
          <span className="ctrl-label">hearts</span>
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
    </div>
  );
}
