"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalVideoTrack } from "livekit-client";
import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
} from "@livekit/track-processors";
import {
  getBlurRadius,
  loadPrefs,
  savePrefs,
  type BackgroundMode,
} from "./effects";

export type UseBackgroundEffectOptions = {
  track: LocalVideoTrack | null | undefined;
  mode: BackgroundMode;
  onModeChange: (mode: BackgroundMode) => void;
  onError?: (message: string) => void;
};

export type UseBackgroundEffectResult = {
  supported: boolean;
  loading: boolean;
  error: string | null;
};

export function useBackgroundEffect({
  track,
  mode,
  onModeChange,
  onError,
}: UseBackgroundEffectOptions): UseBackgroundEffectResult {
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processorRef = useRef<BackgroundProcessorWrapper | null>(null);
  const currentTrackRef = useRef<LocalVideoTrack | null>(null);
  const operationSeqRef = useRef(0);

  // Check processor support on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && supportsBackgroundProcessors()) {
        setSupported(true);
      } else {
        setSupported(false);
      }
    } catch {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    // If not supported or no window, do nothing
    if (!supported || typeof window === "undefined") {
      return;
    }

    const opId = ++operationSeqRef.current;
    let isCancelled = false;

    async function applyEffect() {
      // 1. If the camera track changed (e.g., flipped, camera off/on, device switch),
      // tear down the previous processor cleanly.
      if (currentTrackRef.current !== (track ?? null)) {
        if (processorRef.current) {
          const oldProcessor = processorRef.current;
          processorRef.current = null;
          try {
            await oldProcessor.destroy();
          } catch {
            // ignore destruction error on stale processor
          }
        }
        currentTrackRef.current = track ?? null;
      }

      // If there is no active track, nothing to apply to
      if (!track) {
        return;
      }

      // If mode is "off"
      if (mode === "off") {
        if (processorRef.current) {
          try {
            await processorRef.current.switchTo({ mode: "disabled" });
          } catch {
            try {
              await track.stopProcessor();
            } catch {
              // ignore
            }
          }
        }
        return;
      }

      // Mode is "blur-light" or "blur-strong"
      const blurRadius = getBlurRadius(mode);

      try {
        setLoading(true);
        setError(null);

        if (!processorRef.current) {
          // Create processor once for this track with self-hosted MediaPipe assets
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          const processor = BackgroundProcessor({
            mode: "background-blur",
            blurRadius,
            assetPaths: {
              tasksVisionFileSet: `${origin}/mediapipe/wasm`,
              modelAssetPath: `${origin}/models/selfie_segmenter.tflite`,
            },
          });

          if (isCancelled || opId !== operationSeqRef.current) {
            await processor.destroy().catch(() => undefined);
            return;
          }

          processorRef.current = processor;
          await track.setProcessor(processor);
        } else {
          // Processor already exists on this track: switch mode smoothly
          await processorRef.current.switchTo({
            mode: "background-blur",
            blurRadius,
          });
        }
      } catch {
        if (isCancelled || opId !== operationSeqRef.current) return;

        // Fail gracefully: revert mode to "off", save preferences, notify user,
        // and ensure the camera is never left black or frozen.
        const failureMessage = "Background blur isn't available on this device";
        setError(failureMessage);
        onError?.(failureMessage);

        try {
          if (processorRef.current) {
            const p = processorRef.current;
            processorRef.current = null;
            await p.destroy().catch(() => undefined);
          }
          await track.stopProcessor().catch(() => undefined);
        } catch {
          // ignore cleanup failures
        }

        onModeChange("off");
        try {
          const existing = loadPrefs();
          savePrefs({ ...existing, background: "off" });
        } catch {
          // ignore
        }
      } finally {
        if (!isCancelled && opId === operationSeqRef.current) {
          setLoading(false);
        }
      }
    }

    applyEffect();

    return () => {
      isCancelled = true;
    };
  }, [supported, track, mode, onModeChange, onError]);

  // Keep outgoing video streaming without freezing while the tab is hidden
  useEffect(() => {
    if (!supported || typeof document === "undefined") return;

    const handleVisibility = () => {
      const proc = processorRef.current;
      if (!proc || mode === "off") return;

      if (document.hidden) {
        // Disable blur while tab is hidden so video doesn't freeze in background tabs
        proc.switchTo({ mode: "disabled" }).catch(() => undefined);
      } else {
        // Restore blur when tab becomes visible again
        const radius = getBlurRadius(mode);
        proc.switchTo({ mode: "background-blur", blurRadius: radius }).catch(() => undefined);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [supported, mode]);

  // Clean up processor on complete unmount of the hook
  useEffect(() => {
    return () => {
      if (processorRef.current) {
        const p = processorRef.current;
        processorRef.current = null;
        p.destroy().catch(() => undefined);
      }
      if (currentTrackRef.current) {
        const t = currentTrackRef.current;
        currentTrackRef.current = null;
        t.stopProcessor().catch(() => undefined);
      }
    };
  }, []);

  return {
    supported,
    loading,
    error,
  };
}
