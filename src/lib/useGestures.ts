"use client";

import { useEffect } from "react";
import type { Track } from "livekit-client";

// Filter out benign TensorFlow Lite / XNNPACK C++ informational banners that Emscripten flushes to stderr (console.error)
if (typeof window !== "undefined") {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map((a) => (typeof a === "string" ? a : "")).join(" ");
    if (
      msg.includes("INFO:") ||
      msg.includes("TensorFlow Lite") ||
      msg.includes("XNNPACK") ||
      msg.includes("landmark_projection_calculator") ||
      msg.includes("NORM_RECT") ||
      msg.includes("delegate")
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

function safeVisionDetect<T>(fn: () => T): T | null {
  if (typeof window === "undefined") return null;
  const origError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map((a) => (typeof a === "string" ? a : "")).join(" ");
    if (
      msg.includes("INFO:") ||
      msg.includes("TensorFlow Lite") ||
      msg.includes("XNNPACK") ||
      msg.includes("landmark_projection_calculator") ||
      msg.includes("NORM_RECT") ||
      msg.includes("delegate")
    ) {
      return;
    }
    origError.apply(console, args);
  };
  try {
    return fn();
  } catch {
    return null;
  } finally {
    console.error = origError;
  }
}

type Landmark = { x: number; y: number; z: number };

export type GestureStatus = "idle" | "loading" | "ready" | "unavailable";

type Options = {
  track?: Track;
  enabled: boolean;
  onPeace: () => void;
  onHeart: () => void;
  onKiss?: () => void;
  onThumbsUp?: () => void;
  onThumbsDown?: () => void;
  onStatus?: (status: GestureStatus) => void;
};

// MediaPipe vision assets are fetched from a CDN rather than bundled as static
// files: the wasm binaries plus landmarker models total ~41 MB, which is over
// the site upload limit. Point NEXT_PUBLIC_MEDIAPIPE_WASM_BASE and
// NEXT_PUBLIC_MEDIAPIPE_MODEL_BASE at self-hosted copies to load them locally.
const WASM_URL =
  process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_BASE ??
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL_BASE =
  process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_BASE ??
  "https://storage.googleapis.com/mediapipe-models";
const HAND_MODEL_URL = `${MODEL_BASE}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`;
const FACE_MODEL_URL = `${MODEL_BASE}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`;

// Fast 140ms detection interval for swift responsiveness
const DETECT_INTERVAL = 140;
// Sliding window: must detect the gesture in 3 out of the last 4 frames (~420ms)
const WINDOW_SIZE = 4;
const REQUIRED_MATCHES = 3;
const COOLDOWN = 3000; // 3 seconds cooldown between reactions

let filesetLoader: Promise<{ vision: any; fileset: any }> | null = null;
let handLoader: Promise<any> | null = null;
let faceLoader: Promise<any> | null = null;

function getVisionFileset() {
  if (!filesetLoader) {
    filesetLoader = (async () => {
      const vision: any = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      return { vision, fileset };
    })().catch((error) => {
      filesetLoader = null;
      throw error;
    });
  }
  return filesetLoader;
}

function loadHandLandmarker() {
  if (!handLoader) {
    handLoader = (async () => {
      const { vision, fileset } = await getVisionFileset();
      try {
        return await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch {
        return vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      }
    })().catch((error) => {
      handLoader = null;
      throw error;
    });
  }

  return handLoader;
}

function loadFaceLandmarker() {
  if (!faceLoader) {
    faceLoader = (async () => {
      const { vision, fileset } = await getVisionFileset();
      try {
        return await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      } catch {
        return vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      }
    })().catch((error) => {
      faceLoader = null;
      console.warn("FaceLandmarker unavailable:", error);
      return null;
    });
  }

  return faceLoader;
}

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isExtended(hand: Landmark[], tip: number, joint: number) {
  return hand[tip].y < hand[joint].y;
}

function readGesture(hand?: Landmark[]) {
  if (!hand || hand.length < 21) return null;

  const wrist = hand[0];
  const thumbTip = hand[4];
  const indexTip = hand[8];
  const middleTip = hand[12];

  // Upright finger check: tip is above the PIP joint
  const indexUp = isExtended(hand, 8, 6);
  const middleUp = isExtended(hand, 12, 10);
  const ringUp = isExtended(hand, 16, 14);
  const pinkyUp = isExtended(hand, 20, 18);

  // ✌️ Peace sign: index and middle up, spread apart, ring and pinky folded
  if (indexUp && middleUp && !ringUp && !pinkyUp && distance(indexTip, middleTip) > 0.04) {
    return "peace";
  }

  // 🫰 Finger heart: thumb tip and index tip touching, other fingers folded, hand above wrist
  if (
    distance(thumbTip, indexTip) < 0.055 &&
    !middleUp &&
    !ringUp &&
    !pinkyUp &&
    indexTip.y < wrist.y
  ) {
    return "heart";
  }

  // 👍 Thumbs up: all 4 fingers folded, thumb pointing UP above wrist
  const otherFingersFolded = !indexUp && !middleUp && !ringUp && !pinkyUp;
  if (
    otherFingersFolded &&
    thumbTip.y < hand[3].y &&
    hand[3].y < hand[2].y &&
    thumbTip.y < wrist.y - 0.03
  ) {
    return "thumbs_up";
  }

  // 👎 Thumbs down: all 4 fingers folded, thumb pointing DOWN below wrist
  if (
    otherFingersFolded &&
    thumbTip.y > hand[3].y &&
    hand[3].y > hand[2].y &&
    thumbTip.y > wrist.y + 0.03
  ) {
    return "thumbs_down";
  }

  return null;
}

/**
 * Watches your camera for deliberate gestures:
 * - ✌️ peace: snap screenshot & save moment
 * - 🫰 finger heart: glowing hearts burst
 * - 👍 thumbs up: thumbs up burst
 * - 👎 thumbs down: thumbs down burst
 * - 💋 lip kiss: tight lip pucker with closed jaw
 */
export function useGestureReactions({
  track,
  enabled,
  onPeace,
  onHeart,
  onKiss,
  onThumbsUp,
  onThumbsDown,
  onStatus,
}: Options) {
  useEffect(() => {
    if (!enabled || !track || track.isMuted || track.mediaStreamTrack?.readyState === "ended") {
      onStatus?.("idle");
      return;
    }

    let stopped = false;
    let handLandmarker: any = null;
    let faceLandmarker: any = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastFrame = -1;
    let lastFaceTime = 0;
    let lastHandTime = 0;
    const history: (string | null)[] = [];
    let lastFired = 0;

    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.srcObject = new MediaStream([track.mediaStreamTrack]);
    video.play().catch(() => undefined);

    const onTrackEnded = () => {
      stopped = true;
      if (timer) clearInterval(timer);
      try {
        video.pause();
        video.srcObject = null;
      } catch {
        // ignore
      }
      onStatus?.("idle");
    };
    track.mediaStreamTrack?.addEventListener("ended", onTrackEnded);

    onStatus?.("loading");

    const detect = () => {
      if (
        stopped ||
        (typeof document !== "undefined" && document.hidden) ||
        (!handLandmarker && !faceLandmarker) ||
        video.readyState < 2 ||
        video.paused ||
        video.videoWidth === 0 ||
        video.videoHeight === 0 ||
        video.currentTime === lastFrame
      ) {
        return;
      }

      lastFrame = video.currentTime;
      let now = performance.now();

      let gesture: string | null = null;

      // 1. Check face strictly for deliberate lip kiss / pucker only (speech-proof & movement-proof)
      if (faceLandmarker) {
        if (now <= lastFaceTime) now = lastFaceTime + 1;
        lastFaceTime = now;
        const faceResult = safeVisionDetect(() => faceLandmarker.detectForVideo(video, now));
        const blendshapes = faceResult?.faceBlendshapes?.[0]?.categories;
        const landmarks = faceResult?.faceLandmarks?.[0];

        if (blendshapes && Array.isArray(blendshapes)) {
          let pucker = 0;
          let jawOpen = 0;
          let funnel = 0;
          let pressLeft = 0;
          let pressRight = 0;
          for (let i = 0; i < blendshapes.length; i++) {
            const cat = blendshapes[i];
            if (cat.categoryName === "mouthPucker") pucker = cat.score;
            else if (cat.categoryName === "jawOpen") jawOpen = cat.score;
            else if (cat.categoryName === "mouthFunnel") funnel = cat.score;
            else if (cat.categoryName === "mouthPressLeft") pressLeft = cat.score;
            else if (cat.categoryName === "mouthPressRight") pressRight = cat.score;
          }

          let isTrueKiss = false;

          if (landmarks && landmarks.length >= 455) {
            const faceWidth = distance(landmarks[234], landmarks[454]);
            const mouthWidth = distance(landmarks[61], landmarks[291]);
            const mouthHeight = distance(landmarks[0], landmarks[17]);
            const mouthRatio = faceWidth > 0 ? mouthWidth / faceWidth : 1;
            const aspect = mouthHeight > 0 ? mouthWidth / mouthHeight : 10;

            // Intentional kiss pucker:
            // 1. Mouth corners physically pull inward (mouthRatio < 0.32)
            // 2. Lips form a puckered circle/oval rather than a wide line (aspect < 2.5)
            // 3. High deliberate pucker score (pucker > 0.54)
            // 4. Closed jaw (not speaking: jawOpen < 0.14)
            // 5. Not pressing flat lips together (pressLeft < 0.35)
            if (
              pucker > 0.54 &&
              mouthRatio < 0.32 &&
              aspect < 2.5 &&
              jawOpen < 0.14 &&
              pressLeft < 0.35 &&
              pressRight < 0.35
            ) {
              isTrueKiss = true;
            }
          } else {
            // Fallback if landmarks are not directly accessible
            if (pucker > 0.65 && jawOpen < 0.10 && funnel < 0.35 && pressLeft < 0.30) {
              isTrueKiss = true;
            }
          }

          if (isTrueKiss) {
            gesture = "kiss";
          }
        }
      }

      // 2. Check hands for peace, finger heart, thumbs up, thumbs down
      if (!gesture && handLandmarker) {
        if (now <= lastHandTime) now = lastHandTime + 1;
        lastHandTime = now;
        const handResult = safeVisionDetect(() => handLandmarker.detectForVideo(video, now));
        gesture = readGesture(handResult?.landmarks?.[0]);
      }

      // Append to sliding window history
      history.push(gesture);
      if (history.length > WINDOW_SIZE) history.shift();

      // Enforce cooldown
      if (Date.now() - lastFired < COOLDOWN) return;

      // Check if any gesture reached REQUIRED_MATCHES (3 out of 4 frames = ~420ms)
      const GESTURES = ["peace", "heart", "kiss", "thumbs_up", "thumbs_down"];
      for (const g of GESTURES) {
        const matches = history.filter((item) => item === g).length;
        if (matches >= REQUIRED_MATCHES) {
          lastFired = Date.now();
          history.length = 0; // Clear window so it fires once cleanly

          if (g === "peace") onPeace();
          else if (g === "heart") onHeart();
          else if (g === "kiss") onKiss?.();
          else if (g === "thumbs_up") onThumbsUp?.();
          else if (g === "thumbs_down") onThumbsDown?.();
          break;
        }
      }
    };

    Promise.allSettled([loadHandLandmarker(), loadFaceLandmarker()])
      .then(([handRes, faceRes]) => {
        if (stopped) return;
        if (handRes.status === "fulfilled") handLandmarker = handRes.value;
        if (faceRes.status === "fulfilled") faceLandmarker = faceRes.value;

        if (handLandmarker || faceLandmarker) {
          onStatus?.("ready");
          timer = setInterval(detect, DETECT_INTERVAL);
        } else {
          onStatus?.("unavailable");
        }
      })
      .catch(() => {
        if (!stopped) onStatus?.("unavailable");
      });

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      track.mediaStreamTrack?.removeEventListener("ended", onTrackEnded);
      try {
        video.pause();
        video.srcObject = null;
      } catch {
        // ignore
      }
    };
  }, [track, enabled, onPeace, onHeart, onKiss, onThumbsUp, onThumbsDown, onStatus]);
}
