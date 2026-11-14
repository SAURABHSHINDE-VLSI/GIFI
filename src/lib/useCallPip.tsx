"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Room } from "livekit-client";
import type { TrackReference } from "@livekit/components-react";
import { Icon } from "@/components/Icons";

type ExtendedMediaAction =
  | MediaSessionAction
  | "enterpictureinpicture"
  | "togglemicrophone"
  | "togglecamera"
  | "hangup";

function setMediaAction(
  action: ExtendedMediaAction,
  handler: MediaSessionActionHandler | null,
) {
  try {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
    }
  } catch {
    // Unsupported action in this browser
  }
}

export type PipMode = "document" | "video" | "none";

interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
}

interface DocumentPictureInPictureAPI {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  window?: Window;
  onenter?: (event: Event) => void;
}

export type UseCallPipOptions = {
  room: Room;
  partnerCam: TrackReference | undefined;
  screenShare: TrackReference | undefined;
  watchStatus: {
    active: boolean;
    title: string;
    playing: boolean;
    toggle: () => void;
  };
  localMic: {
    micOn: boolean;
    toggleMic: () => void;
  };
  localCam: {
    camOn: boolean;
    toggleCam: () => void;
  };
  partnerLabel: string;
  onEndCall: () => void;
  autoPipEnabled: boolean;
};

export type UseCallPipResult = {
  supported: PipMode;
  isOpen: boolean;
  open: () => Promise<void>;
  close: () => void;
  PipPortal: React.ReactNode;
};

function copyStylesToWindow(targetDoc: Document) {
  // 1. Copy stylesheet link elements
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    targetDoc.head.appendChild(link.cloneNode(true));
  });

  // 2. Copy inline style tags & css rules
  document.querySelectorAll("style").forEach((style) => {
    const newStyle = targetDoc.createElement("style");
    try {
      if (style.sheet && style.sheet.cssRules) {
        let cssText = "";
        for (let i = 0; i < style.sheet.cssRules.length; i++) {
          cssText += style.sheet.cssRules[i].cssText + "\n";
        }
        newStyle.textContent = cssText;
      } else {
        newStyle.textContent = style.textContent;
      }
    } catch {
      newStyle.textContent = style.textContent;
    }
    targetDoc.head.appendChild(newStyle);
  });

  // 3. Base styles for the PiP window viewport
  const baseStyle = targetDoc.createElement("style");
  baseStyle.textContent = `
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #0a0408;
      color: #f5eff3;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
      user-select: none;
    }
    * {
      box-sizing: border-box;
    }
  `;
  targetDoc.head.appendChild(baseStyle);
}

export function useCallPip({
  partnerCam,
  screenShare,
  watchStatus,
  localMic,
  localCam,
  partnerLabel,
  onEndCall,
  autoPipEnabled,
}: UseCallPipOptions): UseCallPipResult {
  const [supported, setSupported] = useState<PipMode>("none");
  const [isOpen, setIsOpen] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const fallbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const openedAutomaticallyRef = useRef(false);

  // Detect supported mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("documentPictureInPicture" in window) {
      setSupported("document");
    } else if (
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document &&
      Boolean(document.pictureInPictureEnabled)
    ) {
      setSupported("video");
    } else {
      setSupported("none");
    }
  }, []);

  const close = useCallback(() => {
    if (pipWindow && !pipWindow.closed) {
      try {
        pipWindow.close();
      } catch {
        // ignore
      }
    }
    setPipWindow(null);
    setIsOpen(false);
    openedAutomaticallyRef.current = false;

    if (
      typeof document !== "undefined" &&
      document.pictureInPictureElement &&
      document.exitPictureInPicture
    ) {
      document.exitPictureInPicture().catch(() => undefined);
    }
  }, [pipWindow]);

  const open = useCallback(async () => {
    if (supported === "document") {
      try {
        const dpip = (window as unknown as { documentPictureInPicture: DocumentPictureInPictureAPI })
          .documentPictureInPicture;
        const win = await dpip.requestWindow({ width: 380, height: 280 });
        copyStylesToWindow(win.document);

        win.addEventListener("pagehide", () => {
          setPipWindow(null);
          setIsOpen(false);
          openedAutomaticallyRef.current = false;
        });

        setPipWindow(win);
        setIsOpen(true);
        openedAutomaticallyRef.current = false;
      } catch (err) {
        console.warn("Could not open Document PiP window:", err);
      }
    } else if (supported === "video") {
      const vid = fallbackVideoRef.current;
      if (vid && typeof vid.requestPictureInPicture === "function") {
        try {
          await vid.requestPictureInPicture();
          setIsOpen(true);
          openedAutomaticallyRef.current = false;
        } catch (err) {
          console.warn("Could not request standard video PiP:", err);
        }
      }
    }
  }, [supported]);

  const openAutomatically = useCallback(async () => {
    if (!autoPipEnabled) return;

    if (supported === "document") {
      if (pipWindow && !pipWindow.closed) return;
      try {
        const dpip = (window as unknown as { documentPictureInPicture: DocumentPictureInPictureAPI })
          .documentPictureInPicture;
        const win = await dpip.requestWindow({ width: 380, height: 280 });
        copyStylesToWindow(win.document);

        win.addEventListener("pagehide", () => {
          setPipWindow(null);
          setIsOpen(false);
          openedAutomaticallyRef.current = false;
        });

        openedAutomaticallyRef.current = true;
        setPipWindow(win);
        setIsOpen(true);
      } catch {
        // Requires user gesture in some browsers; handled gracefully
      }
    } else if (supported === "video") {
      const vid = fallbackVideoRef.current;
      if (vid && !document.pictureInPictureElement && typeof vid.requestPictureInPicture === "function") {
        try {
          await vid.requestPictureInPicture();
          openedAutomaticallyRef.current = true;
          setIsOpen(true);
        } catch {
          // Handled gracefully
        }
      }
    }
  }, [autoPipEnabled, supported, pipWindow]);

  // Tab switch visibility listener
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibility = () => {
      if (document.hidden) {
        openAutomatically();
      } else {
        // Tab returned: if opened automatically, close it
        if (openedAutomaticallyRef.current) {
          close();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [openAutomatically, close]);

  // Document PiP mediaSession action handler for enterpictureinpicture
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator) ||
      supported !== "document" ||
      !autoPipEnabled
    ) {
      return;
    }

    setMediaAction("enterpictureinpicture", () => {
      openAutomatically();
    });

    return () => {
      setMediaAction("enterpictureinpicture", null);
    };
  }, [supported, autoPipEnabled, openAutomatically]);

  // Standard video PiP mediaSession handlers (microphone, camera, hangup)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    setMediaAction("togglemicrophone", () => {
      localMic.toggleMic();
    });
    setMediaAction("togglecamera", () => {
      localCam.toggleCam();
    });
    setMediaAction("hangup", () => {
      onEndCall();
    });

    return () => {
      setMediaAction("togglemicrophone", null);
      setMediaAction("togglecamera", null);
      setMediaAction("hangup", null);
    };
  }, [localMic, localCam, onEndCall]);

  // Sync fallback video track for standard video PiP (Mode B)
  useEffect(() => {
    const video = fallbackVideoRef.current;
    if (!video) return;

    const activeTrackRef = screenShare || partnerCam;
    const tr = activeTrackRef?.publication?.track?.mediaStreamTrack;

    if (!tr || tr.readyState === "ended") {
      if (video.srcObject) {
        try {
          video.pause();
          video.srcObject = null;
        } catch {
          // ignore
        }
      }
      return;
    }

    video.srcObject = new MediaStream([tr]);
    video.play().catch(() => undefined);

    return () => {
      try {
        video.pause();
        video.srcObject = null;
      } catch {
        // ignore
      }
    };
  }, [screenShare, partnerCam]);

  // Cleanup on complete unmount
  useEffect(() => {
    return () => {
      if (pipWindow && !pipWindow.closed) {
        try {
          pipWindow.close();
        } catch {
          // ignore
        }
      }
    };
  }, [pipWindow]);

  let PipPortal: React.ReactNode = null;

  if (supported === "document" && pipWindow && !pipWindow.closed) {
    PipPortal = createPortal(
      <DocumentPipView
        partnerCam={partnerCam}
        screenShare={screenShare}
        watchStatus={watchStatus}
        localMic={localMic}
        localCam={localCam}
        partnerLabel={partnerLabel}
        onEndCall={onEndCall}
        onClose={close}
      />,
      pipWindow.document.body,
    );
  } else if (supported === "video") {
    PipPortal = (
      <video
        ref={fallbackVideoRef}
        autoPlay
        muted
        playsInline
        className="auto-pip-video"
        aria-hidden="true"
      />
    );
  }

  return {
    supported,
    isOpen,
    open,
    close,
    PipPortal,
  };
}

type DocumentPipViewProps = {
  partnerCam: TrackReference | undefined;
  screenShare: TrackReference | undefined;
  watchStatus: {
    active: boolean;
    title: string;
    playing: boolean;
    toggle: () => void;
  };
  localMic: {
    micOn: boolean;
    toggleMic: () => void;
  };
  localCam: {
    camOn: boolean;
    toggleCam: () => void;
  };
  partnerLabel: string;
  onEndCall: () => void;
  onClose: () => void;
};

function DocumentPipView({
  partnerCam,
  screenShare,
  watchStatus,
  localMic,
  localCam,
  partnerLabel,
  onEndCall,
  onClose,
}: DocumentPipViewProps) {
  const partnerVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Attach partner camera track
  useEffect(() => {
    const el = partnerVideoRef.current;
    const track = partnerCam?.publication?.track;
    if (el && track) {
      track.attach(el);
      return () => {
        track.detach(el);
      };
    }
  }, [partnerCam]);

  // Attach screen share track
  useEffect(() => {
    const el = screenVideoRef.current;
    const track = screenShare?.publication?.track;
    if (el && track) {
      track.attach(el);
      return () => {
        track.detach(el);
      };
    }
  }, [screenShare]);

  function handleEndClick() {
    if (confirmEnd) {
      onEndCall();
      onClose();
    } else {
      setConfirmEnd(true);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = setTimeout(() => {
        setConfirmEnd(false);
      }, 3000);
    }
  }

  return (
    <div className="dpip-container">
      {/* Video Area */}
      <div className="dpip-video-stage">
        {screenShare ? (
          <>
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="dpip-video-screen"
            />
            {partnerCam && (
              <div className="dpip-corner-tile">
                <video
                  ref={partnerVideoRef}
                  autoPlay
                  playsInline
                  className="dpip-video-corner"
                />
              </div>
            )}
          </>
        ) : (
          <video
            ref={partnerVideoRef}
            autoPlay
            playsInline
            className="dpip-video-main"
          />
        )}

        <div className="dpip-partner-tag">{partnerLabel}</div>
      </div>

      {/* Watch Together Bar if active */}
      {watchStatus.active && (
        <div className="dpip-watch-bar">
          <div className="dpip-watch-info">
            <span className="dpip-watch-title">{watchStatus.title}</span>
            <span className="dpip-watch-sub">
              {watchStatus.playing ? "Playing" : "Paused"} · Video in main tab
            </span>
          </div>
          <button
            type="button"
            className="dpip-watch-play-btn"
            onClick={watchStatus.toggle}
            aria-label={watchStatus.playing ? "Pause video" : "Play video"}
          >
            <Icon name={watchStatus.playing ? "pause" : "play"} size={14} />
          </button>
        </div>
      )}

      {/* Control Dock */}
      <div className="dpip-controls">
        <button
          type="button"
          className={`dpip-btn ${localMic.micOn ? "" : "off"}`}
          onClick={localMic.toggleMic}
          aria-label={localMic.micOn ? "Mute microphone" : "Unmute microphone"}
          title={localMic.micOn ? "Mute" : "Unmute"}
        >
          <Icon name={localMic.micOn ? "mic" : "mic-off"} size={16} />
        </button>

        <button
          type="button"
          className={`dpip-btn ${localCam.camOn ? "" : "off"}`}
          onClick={localCam.toggleCam}
          aria-label={localCam.camOn ? "Turn camera off" : "Turn camera on"}
          title={localCam.camOn ? "Camera off" : "Camera on"}
        >
          <Icon name={localCam.camOn ? "camera" : "camera-off"} size={16} />
        </button>

        <button
          type="button"
          className={`dpip-btn dpip-btn-end ${confirmEnd ? "confirm" : ""}`}
          onClick={handleEndClick}
          aria-label={confirmEnd ? "Confirm end call" : "End call"}
          title={confirmEnd ? "Confirm end call" : "End call"}
        >
          <Icon name="hangup" size={16} />
          {confirmEnd && <span className="dpip-confirm-label">End?</span>}
        </button>
      </div>
    </div>
  );
}
