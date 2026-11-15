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
  onMarkSeen?: (id: string) => void;
  soundOn?: boolean;
  onOpen: () => void;
  onClose?: () => void;
  onDismissPopup?: (id: string) => void;
  onReact?: (emoji: string) => void;
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
  onDismissPopup,
  onReact,
}: Props) {
  const [draft, setDraft] = useState("");
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const list = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible || typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;
    const handleViewportChange = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0));
      setKeyboardOffset(offset);
      if (list.current) {
        list.current.scrollTop = list.current.scrollHeight;
      }
    };

    vv.addEventListener("resize", handleViewportChange);
    vv.addEventListener("scroll", handleViewportChange);
    handleViewportChange();

    return () => {
      vv.removeEventListener("resize", handleViewportChange);
      vv.removeEventListener("scroll", handleViewportChange);
      setKeyboardOffset(0);
    };
  }, [visible]);

  const markSeen = useCallback(
    (item: ChatItem) => {
      if (item.mine) return;
      onMarkSeen?.(item.id);
    },
    [onMarkSeen],
  );

  // Automatically mark partner messages as seen when the chat dialog is open
  useEffect(() => {
    if (!visible) return;
    for (const item of items) {
      if (!item.mine && !item.seen) {
        onMarkSeen?.(item.id);
      }
    }
  }, [visible, items, onMarkSeen]);

  useEffect(() => {
    const element = list.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [items, visible]);

  const closeChat = useCallback(() => {
    onClose?.();
    requestAnimationFrame(() => {
      const toggleBtn = document.querySelector<HTMLButtonElement>("[data-chat-toggle]");
      toggleBtn?.focus();
    });
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeChat();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, closeChat]);

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
                  <div className="popup-meta-right">
                    <span className="popup-time">{popupLabel(popup.at)}</span>
                    <button
                      type="button"
                      className="popup-close-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissPopup?.(popup.id);
                      }}
                      aria-label="Dismiss notification"
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <p className="popup-text">{popup.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {visible && (
        <>
          <div
            className="call-chat-backdrop"
            onPointerDown={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("[data-chat-toggle]")) {
                return;
              }
              const under = document.elementFromPoint(e.clientX, e.clientY);
              if (under?.closest("[data-chat-toggle]")) {
                return;
              }
              closeChat();
            }}
            aria-hidden="true"
          />
          <div
            className="call-chat-box"
            style={keyboardOffset > 0 ? { bottom: `${keyboardOffset}px` } : undefined}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
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
                onClick={closeChat}
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
                  Whisper your thoughts, or show ✌️ for screenshot, 🫶 (both hands) for hearts.
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
                      <img className="call-chat-img" src={item.image} alt={`Screenshot from ${item.name}`} loading="lazy" decoding="async" />
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
              <button
                key={emoji}
                type="button"
                onClick={() => onReact?.(emoji)}
                title={`Send ${emoji} burst`}
              >
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
      </>
    )}
  </>
);
}
