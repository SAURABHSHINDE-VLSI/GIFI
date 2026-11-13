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

const CHUNK_SIZE = 6000;
const MAX_ITEMS = 120;

type Wire =
  | { t: "chat"; id: string; name: string; text: string; at: number }
  | { t: "img"; id: string; name: string; at: number; i: number; n: number; d: string }
  | { t: "receipt"; id: string; kind: "delivered" | "seen"; at: number }
  | { t: "ping"; };

type Incoming = {
  name: string;
  at: number;
  parts: string[];
};

function chunk(value: string, size: number) {
  const parts: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    parts.push(value.slice(index, index + size));
  }
  return parts;
}

export function useCallChat(room: Room, selfName: string) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const pending = useRef(new Map<string, Incoming>());
  const receipts = useRef(new Map<string, ChatReceipt>());
  const otherIdentity = useRef<string | null>(null);

  const push = useCallback(
    (item: ChatItem) => {
      setItems((current) => {
        const filtered = current.filter((row) => row.id !== item.id);
        return [...filtered, item].slice(-MAX_ITEMS);
      });
    },
    [],
  );

  const updateReceipt = useCallback(
    (id: string, kind: "delivered" | "seen", at: number) => {
      const existing = receipts.current.get(id) ??
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

  const sendText = useCallback(
    async (value: string) => {
      const text = value.trim();
      if (!text) return;

      const id = crypto.randomUUID();
      const at = Date.now();
      push({ id, mine: true, name: selfName, at, text });

      await send({ t: "chat", id, name: selfName, text, at }).catch(() => undefined);
      queueMicrotask(() => playSentSound());
    },
    [push, send, selfName],
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
      queueMicrotask(() => playSentSound());
    },
    [push, send, selfName],
  );

  const markDelivered = useCallback(
    (id: string) => {
      const existing = receipts.current.get(id) ??
        ({ deliveredAt: undefined, seenAt: undefined } as ChatReceipt);
      receipts.current.set(
        id,
        { deliveredAt: existing.deliveredAt ?? Date.now(), seenAt: existing.seenAt },
      );
      setItems((current) =>
        current.map((row) => (row.id === id ? { ...row, delivered: true } : row)),
      );
      send({ t: "receipt", id, kind: "delivered", at: Date.now() }).catch(() => undefined);
    },
    [send],
  );

  const playSentSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // ignore when audio isn't available
    }
  }, [soundEnabled]);

  const playSeenSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 660;
      gain.gain.value = 0.05;
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // ignore when audio isn't available
    }
  }, [soundEnabled]);

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

      if (message?.t === "chat" && typeof message.text === "string") {
        push({
          id: message.id,
          mine: false,
          name: message.name ?? "Her",
          at: message.at ?? Date.now(),
          text: message.text,
        });
        setUnread((value) => value + 1);
        return;
      }

      if (message?.t === "img" && typeof message.d === "string") {
        const entry =
          pending.current.get(message.id) ??
          ({ name: message.name, at: message.at, parts: new Array(message.n).fill("") } as Incoming);

        entry.parts[message.i] = message.d;
        pending.current.set(message.id, entry);

        if (entry.parts.every((part) => part.length > 0)) {
          pending.current.delete(message.id);
          push({
            id: message.id,
            mine: false,
            name: entry.name,
            at: entry.at,
            image: entry.parts.join(""),
          });
          setUnread((value) => value + 1);
        }
      }

      if (message?.t === "receipt" && typeof message.id === "string") {
        updateReceipt(message.id, message.kind, message.at);
        if (message.kind === "seen" && message.id !== undefined) {
          queueMicrotask(() => playSeenSound());
        }
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, push, updateReceipt]);

  useEffect(() => {
    if (!room) return;

    const localIdentity = room.localParticipant.identity;
    let remoteIdentity: string | null = null;
    try {
      const participantsMap = (room as any).participants as Map<string, any> | undefined;
      const remote = participantsMap?.values
        ? Array.from(participantsMap.values()).find((p: any) => p.identity !== localIdentity)
        : undefined;
      remoteIdentity = remote?.identity ?? null;
    } catch {
      remoteIdentity = null;
    }
    otherIdentity.current = remoteIdentity;
  }, [room]);

  const clearUnread = useCallback(() => setUnread(0), []);

  const markSeenFor = useCallback(
    (id: string) => {
      if (!otherIdentity.current || id.startsWith(selfName)) return;
      updateReceipt(id, "seen", Date.now());
      send({ t: "receipt", id, kind: "seen", at: Date.now() }).catch(() => undefined);
    },
    [selfName, send, updateReceipt],
  );

  const toggleSound = useCallback(() => setSoundEnabled((v) => !v), []);

  return {
    items,
    unread,
    clearUnread,
    sendText,
    sendImage,
    markDelivered,
    markSeenFor,
    getReceipt,
    toggleSound,
    soundEnabled,
  };
}
