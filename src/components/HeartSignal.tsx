"use client";

import { useState, useCallback, useRef } from "react";
import { formatTime } from "@/lib/ui";

type Signal = {
  id: string;
  fromMe: boolean;
  fromName: string;
  at: number;
};

type Props = {
  myName: string;
  partnerName: string;
  signals: Signal[];
  onSendSignal: () => Promise<void>;
};

function playHeartbeatSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Two low-frequency pulses resembling a heartbeat: lub-dub
    const now = ctx.currentTime;

    const playThump = (time: number, freq: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(35, time + duration);

      gain.gain.setValueAtTime(0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + duration);
    };

    playThump(now, 110, 0.12);
    playThump(now + 0.16, 95, 0.18);
  } catch {
    // ignore audio failure
  }
}

export default function HeartSignal({
  partnerName,
  signals,
  onSendSignal,
}: Props) {
  const [sending, setSending] = useState(false);
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest signal received from partner
  const latestPartnerSignal = signals.find((s) => !s.fromMe);

  // Total signals today
  const todayCount = signals.length;

  const handleTap = useCallback(async () => {
    if (sending) return;
    setSending(true);

    // Play heartbeat audio
    playHeartbeatSound();

    // Haptic pulse on mobile phones
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([80, 50, 120]);
      } catch {
        // ignore
      }
    }

    try {
      await onSendSignal();
      setSentNotice(`Heart signal sent to ${partnerName}! 💓`);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setSentNotice(null), 3500);
    } catch {
      setSentNotice("Could not send signal.");
    } finally {
      setSending(false);
    }
  }, [sending, onSendSignal, partnerName]);

  return (
    <div className="heart-signal-widget">
      <div className="signal-head">
        <div className="widget-title-wrap">
          <span className="widget-icon">⚡</span>
          <div>
            <h3>Thinking of You</h3>
            <p className="widget-sub">Instant haptic heart signal across the distance</p>
          </div>
        </div>
        <span className="signal-count-badge">
          ♥ {todayCount} {todayCount === 1 ? "pulse" : "pulses"} today
        </span>
      </div>

      {latestPartnerSignal && (
        <div className="partner-signal-banner">
          <span className="signal-ping-dot" />
          <div className="signal-ping-text">
            <strong>{partnerName}</strong> is thinking of you right now
            <span className="signal-time"> · {formatTime(latestPartnerSignal.at)}</span>
          </div>
        </div>
      )}

      <div className="signal-action-area">
        <button
          type="button"
          className={`signal-heart-trigger ${sending ? "sending" : ""}`}
          onClick={handleTap}
          disabled={sending}
          aria-label={`Send heart signal to ${partnerName}`}
        >
          <div className="signal-heart-waves" aria-hidden="true">
            <span className="wave w1" />
            <span className="wave w2" />
            <span className="wave w3" />
          </div>
          <div className="signal-heart-core">
            <span className="signal-emoji">💓</span>
          </div>
          <span className="signal-label">Tap to send Heart Signal</span>
        </button>

        {sentNotice && <div className="signal-toast">{sentNotice}</div>}

        <p className="signal-tip">
          Zero typing needed · Sends an instant double-pulse vibration and golden heart glow to {partnerName}&apos;s screen.
        </p>
      </div>
    </div>
  );
}

