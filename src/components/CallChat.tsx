"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import type { ChatItem, PopupMessage } from "@/lib/callChat";

type Props = {
  visible: boolean;
  openPopups: PopupMessage[];
  items: ChatItem[];
  partnerName?: string;
  onSend: (text: string) => void;
  onScreenshot?: () => void;
  onMarkSeen?: (id: string) => void;
  getReceipt?: (id: string) => { delivered?: boolean; seen?: boolean; seenAt?: number } | undefined;
  soundOn?: boolean;
  onToggleSound?: () => void;
  onOpen: () => void;
  onClose?: () => void;
};

function timeOf(at: number) {
  const d = new Date(at);
  const hour = d.getHours() % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  return `${pad(hour)}:${pad(d.getMinutes())} ${ampm}`;
}

function popupLabel(at: number) {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function WhatsAppTicks({ delivered, seen }: { delivered?: boolean; seen?: boolean }) {
  const strokeColor = seen ? "#53bdeb" : delivered ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.45)";
  return (
    <span
      className={`wa-ticks ${seen ? "seen" : delivered ? "delivered" : "sent"}`}
      aria-label={seen ? "Seen" : delivered ? "Delivered" : "Sent"}
    >
      <svg width="15" height="10" viewBox="0 0 16 11" fill="none">
        <path
          d="M1 5.5L4.5 9L11 2"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {(delivered || seen) && (
          <path
            d="M5 5.5L8.5 9L15 2"
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  );
}

const ROMANTIC_EMOJIS = ["❤️", "💖", "😘", "🥺", "✨", "🔥", "🌹", "🌙"];

export default function CallChat({
  visible,
  openPopups,
  items,
  partnerName,
  onSend,
  onMarkSeen,
  soundOn = true,
  onOpen,
  onClose,
}: Props) {
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLDivElement | null>(null);

  const markSeen = useCallback(
    (item: ChatItem) => {
      if (item.mine) return;
      onMarkSeen?.(item.id);
    },
    [onMarkSeen],
  );

  useEffect(() => {
    const element = list.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [items, visible]);

  if (typeof window === "undefined") return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  const showPopover = openPopups.length > 0;

  return (
    <>
      {showPopover && (
        <div className={`chat-popover ${soundOn ? "" : "mute"} ${visible ? "popover-visible" : ""}`} onClick={onOpen}>
          <div className="chat-popover-inner">
            {openPopups.slice(-1).map((popup) => (
              <div key={popup.id} className="popup-bubble">
                <div className="popup-head">
                  <span className="popup-from">{popup.from}</span>
                  <span className="popup-time">{popupLabel(popup.at)}</span>
                </div>
                <p className="popup-text">{popup.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {visible && (
        <div className="call-chat-box" onClick={(e) => e.stopPropagation()}>
          <div className="call-chat-head">
            <div className="call-chat-head-left">
              <span className="call-chat-heart-icon">♥</span>
              <div className="call-chat-head-meta">
                <span className="call-chat-partner">{partnerName || "my love"}</span>
                <span className="call-chat-status">
                  <span className="call-chat-status-dot" />
                  online
                </span>
              </div>
            </div>
            <button
              type="button"
              className="call-chat-close-btn"
              onClick={onClose}
              aria-label="Close chat"
              title="Close chat"
            >
              ×
            </button>
          </div>

          <div className="call-chat-list" ref={list}>
            {items.length === 0 && (
              <div className="call-chat-empty-wrap">
                <span className="call-chat-empty-heart">♥</span>
                <p className="call-chat-empty">
                  Whisper your thoughts, or show ✌️ for screenshot, 🫰 for hearts.
                </p>
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className={`call-chat-row ${item.mine ? "mine" : ""}`}
                onTouchStart={() => markSeen(item)}
                onMouseDown={() => markSeen(item)}
              >
                <div className="call-chat-bubble">
                  <div className="call-chat-bubble-inner">
                    {item.text && <p className="call-chat-text">{item.text}</p>}
                    {item.image && (
                      <img className="call-chat-img" src={item.image} alt={`Screenshot from ${item.name}`} loading="lazy" />
                    )}
                    <div className="call-chat-foot">
                      <span className="call-chat-time">{timeOf(item.at)}</span>
                      {item.mine && (
                        <WhatsAppTicks delivered={item.delivered} seen={item.seen} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="call-chat-emoji">
            {ROMANTIC_EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => onSend(emoji)}>
                {emoji}
              </button>
            ))}
          </div>

          <form className="call-chat-composer" onSubmit={submit}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="whisper something sweet…"
              maxLength={500}
            />
            <button type="submit" disabled={!draft.trim()} aria-label="Send message">
              <Icon name="heart" size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
