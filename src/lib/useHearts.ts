"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent } from "livekit-client";
import type { Room } from "livekit-client";

export type Burst = { id: number; left: number; size: number; drift: number };
export type KissBurst = {
  id: number;
  left: number;
  bottom: number;
  size: number;
  drift: number;
  emoji: string;
  rotate: number;
  delay: number;
};

function playKissSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(780, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch {
    // ignore audio failure
  }
}

function shouldSkipAnimation() {
  if (typeof document !== "undefined" && document.hidden) return true;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return false;
}

export function useHearts(room: Room, onKissReceived?: () => void) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [heartShowerTrigger, setHeartShowerTrigger] = useState<number>(0);
  const [emojiBursts, setEmojiBursts] = useState<KissBurst[]>([]);
  const burstTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastHeartReceivedRef = useRef<number>(0);

  useEffect(() => {
    const timers = burstTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      if (document.hidden) {
        setBursts([]);
        setEmojiBursts([]);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const burst = useCallback(() => {
    if (shouldSkipAnimation()) return;
    setHeartShowerTrigger((prev) => prev + 1);
  }, []);

  const burstEmoji = useCallback((emoji: string) => {
    if (emoji === "💋") {
      playKissSound();
    }
    if (shouldSkipAnimation()) return;
    const count = emoji === "💋" ? 14 : 9;
    const batch: KissBurst[] = Array.from({ length: count }, (_, index) => ({
      id: Date.now() + index + Math.random(),
      left: 10 + Math.random() * 80,
      bottom: 10 + Math.random() * 30,
      size: 32 + Math.random() * 28,
      drift: Math.random() * 120 - 60,
      emoji,
      rotate: Math.random() * 40 - 20,
      delay: index * 0.08,
    }));

    setEmojiBursts((current) => [...current, ...batch]);

    const timer = setTimeout(() => {
      setEmojiBursts((current) =>
        current.filter((item) => !batch.some((b) => b.id === item.id)),
      );
    }, 4200);

    burstTimers.current.push(timer);
  }, []);

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message?.t === "hearts") {
          const now = Date.now();
          if (now - lastHeartReceivedRef.current < 1500) {
            return;
          }
          lastHeartReceivedRef.current = now;
          burst();
        }
        if (message?.t === "kiss") {
          burstEmoji("💋");
          onKissReceived?.();
        }
        if (message?.t === "emoji_burst" && typeof message.emoji === "string") {
          burstEmoji(message.emoji);
        }
      } catch {
        // ignore malformed messages
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, burst, burstEmoji, onKissReceived]);

  const sendHearts = useCallback(() => {
    burst();
    if (!room) return;
    room.localParticipant
      .publishData(new TextEncoder().encode(JSON.stringify({ t: "hearts" })), { reliable: true })
      .catch(() => undefined);
  }, [burst, room]);

  const sendEmojiBurst = useCallback(
    (emoji: string) => {
      burstEmoji(emoji);
      if (!room) return;
      room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify({ t: "emoji_burst", emoji })), {
          reliable: true,
        })
        .catch(() => undefined);
    },
    [burstEmoji, room],
  );

  const sendKiss = useCallback(() => {
    burstEmoji("💋");
    if (!room) return;
    room.localParticipant
      .publishData(new TextEncoder().encode(JSON.stringify({ t: "kiss" })), { reliable: true })
      .catch(() => undefined);
  }, [burstEmoji, room]);

  return {
    bursts,
    heartShowerTrigger,
    emojiBursts,
    burst,
    burstEmoji,
    sendHearts,
    sendEmojiBurst,
    sendKiss,
  };
}
