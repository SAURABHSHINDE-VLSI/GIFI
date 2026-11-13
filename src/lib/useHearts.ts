"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent } from "livekit-client";
import type { Room } from "livekit-client";

export type Burst = { id: number; left: number; size: number; drift: number };

export function useHearts(room: Room) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = burstTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const burst = useCallback(() => {
    const batch: Burst[] = Array.from({ length: 7 }, (_, index) => ({
      id: Date.now() + index,
      left: 12 + Math.random() * 72,
      size: 18 + Math.random() * 20,
      drift: Math.random() * 60 - 30,
    }));
    setBursts((current) => [...current, ...batch]);
    const timer = setTimeout(() => {
      setBursts((current) =>
        current.filter((heart) => !batch.some((item) => item.id === heart.id)),
      );
    }, 2800);
    burstTimers.current.push(timer);
  }, []);

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message?.t === "hearts") burst();
      } catch {
        // ignore malformed messages
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, burst]);

  const sendHearts = useCallback(() => {
    burst();
    if (!room) return;
    room.localParticipant
      .publishData(new TextEncoder().encode(JSON.stringify({ t: "hearts" })), { reliable: true })
      .catch(() => undefined);
  }, [burst, room]);

  return { bursts, burst, sendHearts };
}
