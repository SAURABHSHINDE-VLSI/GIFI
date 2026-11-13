"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import { initialOf } from "@/lib/ui";
import { useCanFlipCamera } from "@/lib/useCanFlipCamera";

type Props = {
  displayName: string;
  partnerName: string;
  connecting: boolean;
  error: string | null;
  onJoin: (options: { audio: boolean; video: boolean }) => void;
};

export default function PreJoin({
  displayName,
  partnerName,
  connecting,
  error,
  onJoin,
}: Props) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const canFlip = useCanFlipCamera();
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!camOn) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    setCamError(null);

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((nextStream) => {
        if (cancelled) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = nextStream;
        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
          videoRef.current.play().catch(() => undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setCamError("Camera is blocked. You can still join with it off.");
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [camOn, facing]);

  function submit() {
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
    onJoin({ audio: micOn, video: camOn });
  }

  return (
    <main className="room">
      <div className="prejoin-wrap">
        <section className="prejoin">
          <div className="prejoin-stage">
            {camOn && !camError ? (
              <video
                ref={videoRef}
                className={`prejoin-video ${facing === "environment" ? "rear" : ""}`}
                playsInline
                muted
                autoPlay
              />
            ) : (
              <div className="prejoin-empty">
                <div className="avatar">{initialOf(displayName)}</div>
                <span>camera off</span>
              </div>
            )}

            {camOn && canFlip && !camError && (
              <button
                className="flip-btn prejoin-flip"
                type="button"
                onClick={() => setFacing((value) => (value === "user" ? "environment" : "user"))}
                aria-label="Switch camera"
                title="Switch camera"
              >
                <Icon name="flip" size={16} />
              </button>
            )}

            <div className="prejoin-badges">
              <span className={`chip ${micOn ? "" : "chip-off"}`}>
                <Icon name={micOn ? "mic" : "mic-off"} size={13} />
                {micOn ? "mic on" : "muted"}
              </span>
              <span className={`chip ${camOn ? "" : "chip-off"}`}>
                <Icon name={camOn ? "camera" : "camera-off"} size={13} />
                {camOn ? "camera on" : "camera off"}
              </span>
            </div>
          </div>

          <div className="prejoin-body">
            <p className="prejoin-eyebrow">calling · {partnerName}</p>
            <h1 className="prejoin-title">Ready when you are</h1>

            <div className="prejoin-actions">
              <button
                type="button"
                className={`pill ${micOn ? "" : "pill-off"}`}
                onClick={() => setMicOn((value) => !value)}
              >
                <Icon name={micOn ? "mic" : "mic-off"} size={16} />
                {micOn ? "Microphone" : "Muted"}
              </button>
              <button
                type="button"
                className={`pill ${camOn ? "" : "pill-off"}`}
                onClick={() => setCamOn((value) => !value)}
              >
                <Icon name={camOn ? "camera" : "camera-off"} size={16} />
                {camOn ? "Camera" : "Camera off"}
              </button>
            </div>

            {camError && <p className="note">{camError}</p>}
            {error && <p className="form-error">{error}</p>}

            <button className="btn btn-primary" onClick={submit} disabled={connecting}>
              {connecting ? "Connecting…" : "Join the call"}
              {!connecting && <Icon name="heart" size={16} />}
            </button>
          </div>
        </section>

        <p className="hint">signed in as {displayName}</p>
      </div>
    </main>
  );
}
