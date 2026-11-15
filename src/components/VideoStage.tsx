"use client";

import { VideoTrack } from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import type { RemoteParticipant } from "livekit-client";
import { Icon } from "./Icons";
import { initialOf } from "@/lib/ui";

type Props = {
  stageRef: React.RefObject<HTMLDivElement | null>;
  stage: TrackReference | undefined;
  screenStage: boolean;
  chatVisible: boolean;
  remoteScreen: TrackReference | undefined;
  localScreen: TrackReference | undefined;
  remoteCam: TrackReference | undefined;
  localCam: TrackReference | undefined;
  partner: RemoteParticipant | undefined;
  partnerLabel: string;
  partnerName: string;
  selfName: string;
  showHint: boolean;
  connected: boolean;
  connection: ConnectionState;
  micOn: boolean;
  camOn: boolean;
  canFlip: boolean;
  onFlipCamera: () => void;
  effectsOpen?: boolean;
  onToggleEffects?: () => void;
  focusMode: "partner" | "self";
};

export default function VideoStage({
  stageRef,
  stage,
  screenStage,
  chatVisible,
  remoteScreen,
  localScreen,
  remoteCam,
  localCam,
  partner,
  partnerLabel,
  partnerName,
  selfName,
  showHint,
  connected,
  connection,
  micOn,
  camOn,
  canFlip,
  onFlipCamera,
  effectsOpen = false,
  onToggleEffects,
  focusMode,
}: Props) {
  return (
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
                  {remoteScreen
                    ? `${partnerLabel} is sharing their screen`
                    : "You are sharing your screen"}
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
                <div className="face-tile face-tile-self">
                  {localCam ? (
                    <VideoTrack trackRef={localCam} className="face-video mirror" playsInline />
                  ) : (
                    <div className="face-off">{initialOf(selfName)}</div>
                  )}
                  {onToggleEffects && (
                    <button
                      className={`tile-effects-btn ${effectsOpen ? "open" : ""}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleEffects();
                      }}
                      aria-label="Call settings"
                      aria-expanded={effectsOpen}
                      title="Call settings"
                    >
                      <span className="tile-effects-icon">
                        <Icon name="sliders" size={16} />
                      </span>
                    </button>
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
      ) : focusMode === "self" ? (
        <div className="stage-empty">
          <div className="avatar">{initialOf(selfName)}</div>
          <p className="stage-cap">Your camera is off</p>
          <p className="stage-sub">Tap the camera button to turn it on</p>
        </div>
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
          {localScreen
            ? "You are sharing your screen"
            : remoteScreen
              ? `${partnerLabel} is sharing their screen`
              : ""}
        </div>
      )}

      {showHint && (
        <div className="gesture-hint">
          ✌️ screenshot · 🫶 hearts
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
            <VideoTrack trackRef={localCam} className="local-video mirror" playsInline />
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
              onClick={onFlipCamera}
              aria-label="Switch camera"
              title="Switch camera"
            >
              <Icon name="flip" size={14} />
            </button>
          )}

          {onToggleEffects && (
            <button
              className={`tile-effects-btn ${effectsOpen ? "open" : ""}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEffects();
              }}
              aria-label="Call settings"
              aria-expanded={effectsOpen}
              title="Call settings"
            >
              <span className="tile-effects-icon">
                <Icon name="sliders" size={16} />
              </span>
            </button>
          )}

          <span className="tag">
            {selfName}
            {!micOn && <Icon name="mic-off" size={11} />}
          </span>
        </div>
      )}
    </div>
  );
}
