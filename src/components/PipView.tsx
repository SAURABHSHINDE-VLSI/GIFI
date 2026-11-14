"use client";

import { useEffect, useRef } from "react";
import type { TrackReference } from "@livekit/components-react";

type Props = {
  remoteCam: TrackReference | undefined;
  localCam: TrackReference | undefined;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onLeave: () => void;
};

export default function PipView({
  remoteCam,
  localCam,
  onToggleMic,
  onToggleCam,
  onLeave,
}: Props) {
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  // Sync active camera stream to PiP video element
  useEffect(() => {
    const video = pipVideoRef.current;
    if (!video) return;

    try {
      (video as unknown as { autoPictureInPicture: boolean }).autoPictureInPicture = true;
      video.setAttribute("autopictureinpicture", "true");
    } catch {
      // ignore unsupported attribute
    }

    const activeCam = remoteCam || localCam;
    if (!activeCam) {
      video.srcObject = null;
      return;
    }

    const tr =
      "track" in activeCam
        ? (activeCam.track as { mediaStreamTrack?: MediaStreamTrack })?.mediaStreamTrack
        : undefined;

    if (!tr) {
      video.srcObject = null;
      return;
    }

    video.srcObject = new MediaStream([tr]);
    video.play().catch(() => undefined);

    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [remoteCam, localCam]);

  // Automatically pop out floating window when the user switches to another tab
  useEffect(() => {
    const onVisibility = async () => {
      if (document.hidden) {
        if (!document.pictureInPictureElement) {
          const video = pipVideoRef.current;
          if (video && typeof video.requestPictureInPicture === "function") {
            try {
              await video.requestPictureInPicture();
            } catch {
              // autoPictureInPicture handles browsers where requestPictureInPicture requires user gesture
            }
          }
        }
      } else {
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
      (navigator.mediaSession as unknown as { setActionHandler?: (action: string, handler: () => void) => void })
        .setActionHandler?.("togglemicrophone", () => {
          onToggleMic();
        });
      (navigator.mediaSession as unknown as { setActionHandler?: (action: string, handler: () => void) => void })
        .setActionHandler?.("togglecamera", () => {
          onToggleCam();
        });
      (navigator.mediaSession as unknown as { setActionHandler?: (action: string, handler: () => void) => void })
        .setActionHandler?.("hangup", () => {
          onLeave();
        });
    } catch {
      // ignore
    }
  }, [onToggleMic, onToggleCam, onLeave]);

  return (
    <video
      ref={pipVideoRef}
      autoPlay
      muted
      playsInline
      className="auto-pip-video"
      aria-hidden="true"
    />
  );
}
