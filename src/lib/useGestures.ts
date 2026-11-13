"use client";

import { useEffect } from "react";
import type { Track } from "livekit-client";

type Landmark = { x: number; y: number; z: number };

export type GestureStatus = "idle" | "loading" | "ready" | "unavailable";

type Options = {
  track?: Track;
  enabled: boolean;
  onPeace: () => void;
  onHeart: () => void;
  onStatus?: (status: GestureStatus) => void;
};

const WASM_URL = "/mediapipe/wasm";
const MODEL_URL = "/mediapipe/hand_landmarker.task";

const DETECT_INTERVAL = 200;
const COOLDOWN = 3500;

let loader: Promise<any> | null = null;

function loadHandLandmarker() {
  if (!loader) {
    loader = (async () => {
      const vision: any = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);

      try {
        return await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch {
        return vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      }
    })().catch((error) => {
      loader = null;
      throw error;
    });
  }

  return loader;
}

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isExtended(hand: Landmark[], tip: number, joint: number) {
  return hand[tip].y < hand[joint].y;
}

function readGesture(hand?: Landmark[]) {
  if (!hand || hand.length < 21) return null;

  const indexUp = isExtended(hand, 8, 6);
  const middleUp = isExtended(hand, 12, 10);
  const ringUp = isExtended(hand, 16, 14);
  const pinkyUp = isExtended(hand, 20, 18);

  // ✌️ peace: index and middle up, spread apart, ring and pinky folded
  if (indexUp && middleUp && !ringUp && !pinkyUp && distance(hand[8], hand[12]) > 0.05) {
    return "peace";
  }

  // finger heart: thumb tip and index tip touching, other fingers folded
  if (distance(hand[4], hand[8]) < 0.055 && !middleUp && !ringUp && !pinkyUp) {
    return "heart";
  }

  return null;
}

/**
 * Watches your own camera for hand gestures and fires callbacks once each
 * gesture has been held for two detections in a row.
 */
export function useGestureReactions({
  track,
  enabled,
  onPeace,
  onHeart,
  onStatus,
}: Options) {
  useEffect(() => {
    if (!enabled || !track) {
      onStatus?.("idle");
      return;
    }

    let stopped = false;
    let landmarker: any = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastFrame = -1;
    let heldGesture: string | null = null;
    let heldCount = 0;
    let lastFired = 0;

    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.srcObject = new MediaStream([track.mediaStreamTrack]);
    video.play().catch(() => undefined);

    onStatus?.("loading");

    const detect = () => {
      if (stopped || !landmarker) return;
      if (video.readyState < 2 || video.currentTime === lastFrame) return;

      lastFrame = video.currentTime;

      let gesture: string | null = null;
      try {
        const result = landmarker.detectForVideo(video, performance.now());
        gesture = readGesture(result?.landmarks?.[0]);
      } catch {
        return;
      }

      if (gesture === heldGesture) {
        heldCount += 1;
      } else {
        heldGesture = gesture;
        heldCount = 1;
      }

      if (!gesture || heldCount !== 2) return;
      if (Date.now() - lastFired < COOLDOWN) return;

      lastFired = Date.now();
      if (gesture === "peace") onPeace();
      if (gesture === "heart") onHeart();
    };

    loadHandLandmarker()
      .then((loaded) => {
        if (stopped) return;
        landmarker = loaded;
        onStatus?.("ready");
        timer = setInterval(detect, DETECT_INTERVAL);
      })
      .catch(() => {
        if (!stopped) onStatus?.("unavailable");
      });

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      video.srcObject = null;
    };
  }, [track, enabled, onPeace, onHeart, onStatus]);
}
