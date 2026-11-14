"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { formatTime } from "@/lib/ui";

export type OrigamiItem = {
  id: string;
  fromMe: boolean;
  fromName: string;
  content: string;
  foldType: "plane" | "heart" | "crane" | string;
  paperStyle: "sakura" | "vintage" | "midnight" | "mint" | string;
  isOpened: boolean;
  openedAt: number | null;
  at: number;
};

type Props = {
  myName: string;
  partnerName: string;
  notes: OrigamiItem[];
  onSendNote: (data: { content: string; foldType: string; paperStyle: string }) => Promise<void>;
  onOpenNote: (id: string) => Promise<void>;
};

// Web Audio API synthesized paper sound effects (zero external files required)
function playPaperSound(type: "crease" | "rustle" | "flick") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    const dur = type === "flick" ? 0.35 : 0.18;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = type === "flick" ? "highpass" : "bandpass";
    filter.frequency.setValueAtTime(type === "flick" ? 1400 : 900, now);
    if (type === "flick") {
      filter.frequency.exponentialRampToValueAtTime(300, now + dur);
    }
    filter.Q.setValueAtTime(2.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
  } catch {
    // AudioContext blocked or unsupported
  }
}

const FOLD_TYPES = [
  { id: "plane", name: "Paper Airplane", icon: "✈️", desc: "Glides across continents straight to her hands" },
  { id: "heart", name: "Origami Heart", icon: "💌", desc: "Folded three times with pure affection" },
  { id: "crane", name: "Peace Crane", icon: "🕊️", desc: "Japanese Senbazuru symbol of eternal devotion" },
];

const PAPER_STYLES = [
  { id: "sakura", name: "Cherry Blossom", color: "#fce7f3", accent: "#f472b6", border: "#fbcfe8" },
  { id: "vintage", name: "Vintage Parchment", color: "#fef3c7", accent: "#d97706", border: "#fde68a" },
  { id: "midnight", name: "Midnight Starlight", color: "#1e1b4b", accent: "#a855f7", border: "#3730a3" },
  { id: "mint", name: "Sage Botanical", color: "#dcfce7", accent: "#16a34a", border: "#bbf7d0" },
];

export default function OrigamiNotes({
  myName,
  partnerName,
  notes,
  onSendNote,
  onOpenNote,
}: Props) {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [composerOpen, setComposerOpen] = useState(false);
  const [content, setContent] = useState("");
  const [foldType, setFoldType] = useState<"plane" | "heart" | "crane">("plane");
  const [paperStyle, setPaperStyle] = useState<"sakura" | "vintage" | "midnight" | "mint">("sakura");
  const [sending, setSending] = useState(false);
  const [foldingAnim, setFoldingAnim] = useState(false);

  // Active note in unfold modal
  const [readingNote, setReadingNote] = useState<OrigamiItem | null>(null);

  const receivedNotes = notes.filter((n) => !n.fromMe);
  const sentNotes = notes.filter((n) => n.fromMe);
  const unreadCount = receivedNotes.filter((n) => !n.isOpened).length;

  const handleOpenReader = useCallback(
    (note: OrigamiItem) => {
      playPaperSound("rustle");
      setReadingNote(note);
      if (!note.fromMe && !note.isOpened) {
        onOpenNote(note.id).catch(() => undefined);
      }
    },
    [onOpenNote]
  );

  const handleSend = useCallback(async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    setFoldingAnim(true);
    playPaperSound("crease");

    // Give visual fold animation time
    setTimeout(() => {
      playPaperSound("flick");
    }, 450);

    try {
      await onSendNote({
        content: content.trim(),
        foldType,
        paperStyle,
      });
      setTimeout(() => {
        setFoldingAnim(false);
        setSending(false);
        setContent("");
        setComposerOpen(false);
        setTab("sent");
      }, 900);
    } catch {
      setFoldingAnim(false);
      setSending(false);
    }
  }, [content, sending, onSendNote, foldType, paperStyle]);

  const activeFold = FOLD_TYPES.find((f) => f.id === foldType) || FOLD_TYPES[0];

  return (
    <div className="origami-widget">
      {/* Widget Header */}
      <div className="origami-head">
        <div className="widget-title-wrap">
          <span className="widget-icon">🕊️</span>
          <div>
            <h3>Origami Secret Notes</h3>
            <p className="widget-sub">
              Fold whispered words into 3D origami and flick them across the distance
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn-fold-new"
          onClick={() => {
            playPaperSound("crease");
            setComposerOpen(true);
          }}
        >
          <span>✍️</span> Fold a Note
        </button>
      </div>

      {/* Tabs */}
      <div className="origami-tabs">
        <button
          type="button"
          className={`origami-tab ${tab === "received" ? "active" : ""}`}
          onClick={() => setTab("received")}
        >
          From {partnerName}
          {unreadCount > 0 && <span className="origami-badge">{unreadCount} new</span>}
        </button>
        <button
          type="button"
          className={`origami-tab ${tab === "sent" ? "active" : ""}`}
          onClick={() => setTab("sent")}
        >
          Sent by Me ({sentNotes.length})
        </button>
      </div>

      {/* List / Keepsake Grid */}
      <div className="origami-grid">
        {(tab === "received" ? receivedNotes : sentNotes).length === 0 ? (
          <div className="origami-empty">
            <span className="origami-empty-icon">{tab === "received" ? "💌" : "🕊️"}</span>
            <p className="origami-empty-title">
              {tab === "received"
                ? `No secret origami from ${partnerName} yet`
                : "You haven't folded any whisper notes yet"}
            </p>
            <p className="origami-empty-hint">
              {tab === "received"
                ? "When they flick an origami paper airplane or heart to you, it will rest here unopened."
                : "Write something tender, fold it into a paper airplane or crane, and flick it over!"}
            </p>
          </div>
        ) : (
          (tab === "received" ? receivedNotes : sentNotes).map((note) => {
            const isUnread = !note.fromMe && !note.isOpened;
            const foldMeta = FOLD_TYPES.find((f) => f.id === note.foldType) || FOLD_TYPES[0];

            return (
              <div
                key={note.id}
                className={`origami-card paper-${note.paperStyle} ${isUnread ? "unread-glow" : ""}`}
                onClick={() => handleOpenReader(note)}
                role="button"
                tabIndex={0}
              >
                <div className="card-origami-graphic">
                  <div className="folded-icon">{foldMeta.icon}</div>
                  {isUnread && <span className="seal-pulse">NEW</span>}
                </div>

                <div className="card-origami-meta">
                  <div className="card-fold-title">{foldMeta.name}</div>
                  <div className="card-origami-author">
                    {note.fromMe ? "To " + partnerName : "From " + note.fromName}
                  </div>
                  <div className="card-origami-time">{formatTime(note.at)}</div>
                </div>

                <div className="card-origami-cta">
                  <span>{isUnread ? "Tap to Unfold ✨" : "Read note"}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* COMPOSER MODAL */}
      {composerOpen && typeof document !== "undefined" && createPortal(
        <div className="origami-modal-backdrop" onClick={() => !sending && setComposerOpen(false)}>
          <div
            className={`origami-composer-modal ${foldingAnim ? "flicking" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="composer-header">
              <div className="composer-title-row">
                <span className="origami-symbol">{activeFold.icon}</span>
                <div>
                  <h4>Fold a Secret Note</h4>
                  <p>Whisper something gentle to {partnerName}</p>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                disabled={sending}
                onClick={() => setComposerOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Fold & Style Selectors */}
            <div className="fold-selectors">
              <label className="section-label">1. Choose Origami Fold</label>
              <div className="fold-chips">
                {FOLD_TYPES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`fold-chip ${foldType === f.id ? "selected" : ""}`}
                    onClick={() => {
                      playPaperSound("crease");
                      setFoldType(f.id as any);
                    }}
                  >
                    <span className="chip-icon">{f.icon}</span>
                    <span className="chip-name">{f.name}</span>
                  </button>
                ))}
              </div>

              <label className="section-label" style={{ marginTop: 12 }}>
                2. Choose Paper Texture
              </label>
              <div className="paper-chips">
                {PAPER_STYLES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`paper-chip ${paperStyle === p.id ? "selected" : ""}`}
                    style={{ borderColor: paperStyle === p.id ? p.accent : undefined }}
                    onClick={() => {
                      playPaperSound("rustle");
                      setPaperStyle(p.id as any);
                    }}
                  >
                    <span className="paper-swatch" style={{ background: p.color, borderColor: p.accent }} />
                    <span className="paper-name">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Note Paper Sheet */}
            <div className={`virtual-paper-sheet paper-${paperStyle}`}>
              <div className="paper-folds-guide">
                <span className="crease-line horizontal" />
                <span className="crease-line diagonal-left" />
                <span className="crease-line diagonal-right" />
              </div>
              <textarea
                className="handwritten-input"
                placeholder={`Dear ${partnerName}...\nWrite a tender whisper that will fold into your origami.`}
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 500))}
                rows={5}
                disabled={sending}
                autoFocus
              />
              <div className="paper-footer">
                <span className="char-count">{500 - content.length} chars left</span>
                <span className="signature">With love, {myName} ♥</span>
              </div>
            </div>

            {/* Actions */}
            <div className="composer-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={sending}
                onClick={() => setComposerOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-flick"
                disabled={!content.trim() || sending}
                onClick={handleSend}
              >
                {sending ? (
                  <span>Folding & Flicking... {activeFold.icon}</span>
                ) : (
                  <>
                    <span>Fold & Flick to {partnerName}</span>
                    <span>{activeFold.icon}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* READING / UNFOLD VIEWER MODAL */}
      {readingNote && typeof document !== "undefined" && createPortal(
        <div className="origami-modal-backdrop" onClick={() => setReadingNote(null)}>
          <div
            className={`origami-unfold-modal paper-${readingNote.paperStyle}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Stamp & Ribbon */}
            <div className="unfold-header">
              <div className="unfold-stamp">
                <span className="stamp-emblem">
                  {FOLD_TYPES.find((f) => f.id === readingNote.foldType)?.icon || "💌"}
                </span>
                <div className="stamp-text">
                  <span className="stamp-top">HERZ AIR MAIL</span>
                  <span className="stamp-bot">{formatTime(readingNote.at)}</span>
                </div>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() => setReadingNote(null)}
              >
                ✕
              </button>
            </div>

            <div className="unfold-body">
              <div className="unfold-recipient">
                {readingNote.fromMe ? `To my dearest ${partnerName},` : `Dearest ${myName},`}
              </div>

              <div className="unfold-letter-content">{readingNote.content}</div>

              <div className="unfold-signoff">
                <p className="always-yours">Always yours,</p>
                <p className="signoff-name">{readingNote.fromName} ♥</p>
              </div>
            </div>

            <div className="unfold-footer">
              <span className="unfold-meta-tag">
                Folded as {FOLD_TYPES.find((f) => f.id === readingNote.foldType)?.name || "Origami"}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setReadingNote(null)}
              >
                Keep in Chest
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
