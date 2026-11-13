"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import type { ChatItem } from "@/lib/callChat";

const QUICK_EMOJI = ["❤️", "😘", "😂", "🥺", "🔥", "👍", "😴", "🌙"];

type Props = {
  open: boolean;
  items: ChatItem[];
  onClose: () => void;
  onSend: (text: string) => void;
  onScreenshot: () => void;
  onMarkSeen?: (id: string) => void;
  getReceipt?: (id: string) => { delivered?: boolean; seen?: boolean; seenAt?: number } | undefined;
};

function timeOf(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CallChat({
  open,
  items,
  onClose,
  onSend,
  onScreenshot,
  onMarkSeen,
  getReceipt,
}: Props) {
  const [draft, setDraft] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const list = useRef<HTMLDivElement | null>(null);

  const markSeenIfMine = useCallback(
    (item: ChatItem) => {
      if (!item.mine) return;
      onMarkSeen?.(item.id);
    },
    [onMarkSeen],
  );

  useEffect(() => {
    if (!open) return;
    const element = list.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [items, open]);

  const toggleSound = useCallback(() => setSoundOn((v) => !v), []);

  if (!open) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  return (
    <aside className={`chat-sheet ${soundOn ? "" : "mute"}`}>
      <header className="chat-head">
        <span>our chat</span>
        <div className="chat-head-actions">
          <button
            type="button"
            className={soundOn ? "chat-sounds-on" : "chat-sounds-off"}
            onClick={toggleSound}
            aria-label={soundOn ? "Mute chat sounds" : "Unmute chat sounds"}
            title={soundOn ? "Mute sounds" : "Unmute sounds"}
          >
            <Icon name={soundOn ? "mic" : "mic-off"} size={13} />
          </button>
          <button type="button" onClick={onScreenshot} aria-label="Send a screenshot" title="Send a screenshot">
            <Icon name="camera" size={16} />
          </button>
          <button type="button" onClick={onClose} aria-label="Close chat">
            <Icon name="hangup" size={15} />
          </button>
        </div>
      </header>

      <div className="chat-list" ref={list}>
        {items.length === 0 && (
          <p className="chat-empty">
            Nothing yet. Show ✌️ to send a screenshot, 🫰 for hearts, 👍 for thumbs up, 🙏 for folded hands.
          </p>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className={`chat-row ${item.mine ? "mine" : ""}`}
            onTouchStart={() => markSeenIfMine(item)}
            onMouseDown={() => markSeenIfMine(item)}
          >
            <div className="chat-bubble">
              <div className="chat-bubble-inner">
                {item.text && <p className="chat-text">{item.text}</p>}
                {item.image && (
                  <img className="chat-img" src={item.image} alt={`Screenshot from ${item.name}`} loading="lazy" />
                )}
                <div className="chat-foot">
                  <span className="chat-time">{timeOf(item.at)}</span>
                  {item.mine && (
                    <span className="chat-ticks" aria-label="message receipts">
                      <span className={item.delivered ? "tick tick-delivered" : "tick tick-pending"} />
                      <span className={item.seen ? "tick tick-seen" : "tick tick-pending"} />
                    </span>
                  )}
                </div>
              </div>
              {item.mine && (
                <span className="chat-mine-tag">{item.name}</span>
              )}
            </div>
            {!item.mine && item.name && (
              <span className="chat-other-tag">{item.name}</span>
            )}
          </div>
        ))}
      </div>

      <div className="chat-emoji">
        {QUICK_EMOJI.map((emoji) => (
          <button key={emoji} type="button" onClick={() => onSend(emoji)}>
            {emoji}
          </button>
        ))}
      </div>

      <form className="chat-composer" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="say something…"
          maxLength={500}
        />
        <button type="submit" disabled={!draft.trim()} aria-label="Send message">
          <Icon name="heart" size={16} />
        </button>
      </form>
    </aside>
  );
}
