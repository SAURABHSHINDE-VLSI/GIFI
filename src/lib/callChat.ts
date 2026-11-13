"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent } from "livekit-client";
import type { Room } from "livekit-client";

export type ChatItem = {
  id: string;
  mine: boolean;
  name: string;
  at: number;
  text?: string;
  image?: string;
  delivered?: boolean;
  seen?: boolean;
  seenAt?: number;
};

export type ChatReceipt = {
  deliveredAt?: number;
  seenAt?: number;
};

export type PopupMessage = {
  id: string;
  from: string;
  text: string;
  at: number;
};

export type CallChatHandles = {
  items: ChatItem[];
  unread: number;
  clearUnread: () => void;
  sendText: (text: string) => void;
  sendImage: (dataUrl: string) => void;
  markSeenFor: (id: string) => void;
  getReceipt: (id: string) => ChatReceipt | undefined;
  toggleSound: () => void;
  soundEnabled: boolean;
  popups: PopupMessage[];
  clearPopups: () => void;
};

const CHUNK_SIZE = 6000;
const MAX_ITEMS = 120;
const MAX_IMAGE_CHUNKS = 400;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const PENDING_TIMEOUT_MS = 30_000; // 30 seconds

type Wire =
  | { t: "chat"; id: string; name: string; text: string; at: number }
  | { t: "img"; id: string; name: string; at: number; i: number; n: number; d: string }
  | { t: "receipt"; id: string; kind: "delivered" | "seen"; at: number }
  | { t: "ping" }
  | { t: "popup"; id: string; name: string; text: string; at: number };

type Incoming = {
  name: string;
  at: number;
  parts: string[];
  totalBytes: number;
  expiresAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
};

function chunk(value: string, size: number) {
  const parts: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    parts.push(value.slice(index, index + size));
  }
  return parts;
}

let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => undefined);
  }
  return sharedAudioCtx;
}

export function useCallChat(room: Room, selfName: string): CallChatHandles {
  const [items, setItems] = useState<ChatItem[]>([]);
  const itemsRef = useRef<ChatItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const [unread, setUnread] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const [popups, setPopups] = useState<PopupMessage[]>([]);
  const pending = useRef(new Map<string, Incoming>());
  const receipts = useRef(new Map<string, ChatReceipt>());

  // Clean up pending timeouts on unmount
  useEffect(() => {
    const pendingMap = pending.current;
    return () => {
      for (const entry of pendingMap.values()) {
        clearTimeout(entry.timeoutId);
      }
      pendingMap.clear();
    };
  }, []);

  const playTone = useCallback((freq: number, volume: number, durationSeconds: number) => {
    if (!soundEnabledRef.current) return;
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSeconds);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationSeconds);
    } catch {
      // Audio playback unavailable or blocked by autoplay policy
    }
  }, []);

  const push = useCallback((item: ChatItem) => {
    setItems((current) => {
      const filtered = current.filter((row) => row.id !== item.id);
      return [...filtered, item].slice(-MAX_ITEMS);
    });
  }, []);

  const updateReceipt = useCallback(
    (id: string, kind: "delivered" | "seen", at: number) => {
      const existing =
        receipts.current.get(id) ??
        ({ deliveredAt: undefined, seenAt: undefined } as ChatReceipt);
      receipts.current.set(
        id,
        kind === "delivered"
          ? { deliveredAt: existing.deliveredAt ?? at, seenAt: existing.seenAt }
          : { deliveredAt: existing.deliveredAt, seenAt: at },
      );
      setItems((current) =>
        current.map((row) =>
          row.id === id
            ? kind === "delivered"
              ? { ...row, delivered: true }
              : { ...row, seen: true, seenAt: at }
            : row,
        ),
      );
    },
    [],
  );

  const enqueuePopup = useCallback(
    (item: PopupMessage) => {
      setPopups((current) => {
        const pruned = current.filter((p) => p.id !== item.id);
        return [...pruned, item].slice(-3);
      });
      queueMicrotask(() => playTone(520, 0.05, 0.16));
    },
    [playTone],
  );

  const getReceipt = useCallback(
    (id: string): ChatReceipt | undefined => receipts.current.get(id),
    [],
  );

  const send = useCallback(
    (payload: Wire) =>
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true, topic: "herz-chat" },
      ),
    [room],
  );

  const markDelivered = useCallback(
    (id: string) => {
      const existing =
        receipts.current.get(id) ??
        ({ deliveredAt: undefined, seenAt: undefined } as ChatReceipt);
      receipts.current.set(id, {
        deliveredAt: existing.deliveredAt ?? Date.now(),
        seenAt: existing.seenAt,
      });
      setItems((current) =>
        current.map((row) => (row.id === id ? { ...row, delivered: true } : row)),
      );
      send({ t: "receipt", id, kind: "delivered", at: Date.now() }).catch(() => undefined);
    },
    [send],
  );

  const sendText = useCallback(
    async (value: string) => {
      const text = value.trim();
      if (!text) return;

      const id = crypto.randomUUID();
      const at = Date.now();
      push({ id, mine: true, name: selfName, at, text });

      await send({ t: "chat", id, name: selfName, text, at }).catch(() => undefined);
      queueMicrotask(() => playTone(880, 0.06, 0.12));
    },
    [push, send, selfName, playTone],
  );

  const sendImage = useCallback(
    async (dataUrl: string) => {
      const id = crypto.randomUUID();
      const at = Date.now();
      push({ id, mine: true, name: selfName, at, image: dataUrl });

      const parts = chunk(dataUrl, CHUNK_SIZE);
      for (let index = 0; index < parts.length; index += 1) {
        await send({
          t: "img",
          id,
          name: selfName,
          at,
          i: index,
          n: parts.length,
          d: parts[index],
        }).catch(() => undefined);
      }
      queueMicrotask(() => playTone(880, 0.06, 0.12));
    },
    [push, send, selfName, playTone],
  );

  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      let message: Wire;
      try {
        message = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }

      if (message?.t === "ping") {
        setUnread((value) => value + 1);
        return;
      }

      if (message?.t === "chat" && typeof message.text === "string" && typeof message.id === "string") {
        const incoming: ChatItem = {
          id: message.id,
          mine: false,
          name: message.name ?? "Partner",
          at: message.at ?? Date.now(),
          text: message.text,
          delivered: true,
        };
        push(incoming);
        setUnread((value) => value + 1);
        markDelivered(message.id);
        if (message.name !== selfName) {
          enqueuePopup({
            id: message.id,
            from: message.name ?? "Partner",
            text: message.text,
            at: message.at ?? Date.now(),
          });
        }
        return;
      }

      if (
        message?.t === "img" &&
        typeof message.id === "string" &&
        typeof message.d === "string" &&
        typeof message.i === "number" &&
        typeof message.n === "number" &&
        Number.isInteger(message.i) &&
        Number.isInteger(message.n) &&
        message.n > 0 &&
        message.n <= MAX_IMAGE_CHUNKS &&
        message.i >= 0 &&
        message.i < message.n
      ) {
        const now = Date.now();

        // Evict expired pending entries
        for (const [key, val] of pending.current.entries()) {
          if (val.expiresAt <= now) {
            clearTimeout(val.timeoutId);
            pending.current.delete(key);
          }
        }

        let entry = pending.current.get(message.id);
        if (!entry) {
          // Reject any transfer where the initial chunk does not begin with standard JPEG data URL prefix
          if (message.i === 0 && !message.d.startsWith("data:image/jpeg;base64,")) {
            return;
          }
          if (message.d.length > MAX_IMAGE_BYTES) {
            return;
          }
          const timeoutId = setTimeout(() => {
            pending.current.delete(message.id);
          }, PENDING_TIMEOUT_MS);

          entry = {
            name: message.name ?? "Partner",
            at: message.at ?? now,
            parts: new Array(message.n).fill(""),
            totalBytes: 0,
            expiresAt: now + PENDING_TIMEOUT_MS,
            timeoutId,
          };
          pending.current.set(message.id, entry);
        }

        const prevChunkBytes = entry.parts[message.i]?.length ?? 0;
        const newTotalBytes = entry.totalBytes - prevChunkBytes + message.d.length;
        if (newTotalBytes > MAX_IMAGE_BYTES) {
          // Reject payload exceeding total size limit
          clearTimeout(entry.timeoutId);
          pending.current.delete(message.id);
          return;
        }

        entry.parts[message.i] = message.d;
        entry.totalBytes = newTotalBytes;

        if (entry.parts.every((part) => part.length > 0)) {
          clearTimeout(entry.timeoutId);
          pending.current.delete(message.id);
          const fullImage = entry.parts.join("");
          // Only accept incoming image data that starts with "data:image/jpeg;base64," and stays under size cap
          if (fullImage.startsWith("data:image/jpeg;base64,") && fullImage.length <= MAX_IMAGE_BYTES) {
            push({
              id: message.id,
              mine: false,
              name: entry.name,
              at: entry.at,
              image: fullImage,
              delivered: true,
            });
            setUnread((value) => value + 1);
            markDelivered(message.id);
          }
        }
      }

      if (message?.t === "receipt" && typeof message.id === "string") {
        updateReceipt(message.id, message.kind, message.at);
        if (message.kind === "seen") {
          queueMicrotask(() => playTone(660, 0.05, 0.18));
        }
      }

      if (message?.t === "popup" && typeof message.text === "string" && message.name !== selfName) {
        enqueuePopup({
          id: message.id,
          from: message.name ?? "Partner",
          text: message.text,
          at: message.at ?? Date.now(),
        });
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, push, updateReceipt, selfName, enqueuePopup, markDelivered, playTone]);

  const clearUnread = useCallback(() => setUnread(0), []);

  const markSeenFor = useCallback(
    (id: string) => {
      if (!room || room.remoteParticipants.size === 0) return;
      const target = itemsRef.current.find((item) => item.id === id);
      if (!target || target.mine) return;
      updateReceipt(id, "seen", Date.now());
      send({ t: "receipt", id, kind: "seen", at: Date.now() }).catch(() => undefined);
    },
    [room, send, updateReceipt],
  );

  const toggleSound = useCallback(() => setSoundEnabled((v) => !v), []);
  const clearPopups = useCallback(() => setPopups([]), []);

  return {
    items,
    unread,
    clearUnread,
    sendText,
    sendImage,
    markSeenFor,
    getReceipt,
    toggleSound,
    soundEnabled,
    popups,
    clearPopups,
  };
}
