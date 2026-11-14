"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatTime } from "@/lib/ui";

export type Milestone = {
  id: string;
  title: string;
  date: number;
  emoji: string;
  note: string;
  at: number;
};

export type TimelineMoment = {
  id: string;
  by: string;
  mine: boolean;
  image: string;
  caption: string;
  thought: string;
  at: number;
};

type Props = {
  myName: string;
  partnerName: string;
  anniversaryDate: number | null;
  reunionDate: number | null;
  reunionDestination: string | null;
  totalCallSeconds: number;
  milestones: Milestone[];
  moments?: TimelineMoment[];
  onUpdateMeta: (data: { anniversaryDate?: number; reunionDate?: number; reunionDestination?: string }) => Promise<void>;
  onAddMilestone: (data: { title: string; date: number; emoji: string; note?: string }) => Promise<void>;
  onDeleteMilestone: (id: string) => Promise<void>;
  onOpenScrapbook: () => void;
};

const EMOJI_OPTIONS = ["❤️", "✨", "🥂", "✈️", "💍", "🏠", "🎂", "🌴", "💌", "🎶", "🌸", "⭐"];

export default function LoveStoryTimeline({
  partnerName: _partnerName,
  anniversaryDate,
  reunionDate,
  reunionDestination,
  totalCallSeconds,
  milestones,
  moments = [],
  onUpdateMeta,
  onAddMilestone,
  onDeleteMilestone,
  onOpenScrapbook,
}: Props) {
  // Modal states
  const [annivModalOpen, setAnnivModalOpen] = useState(false);
  const [reunionModalOpen, setReunionModalOpen] = useState(false);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);

  // Form states
  const [tempAnnivDate, setTempAnnivDate] = useState(() => {
    const d = anniversaryDate ? new Date(anniversaryDate) : new Date();
    return d.toISOString().slice(0, 10);
  });

  const [tempReunionDate, setTempReunionDate] = useState(() => {
    const d = reunionDate ? new Date(reunionDate) : new Date(Date.now() + 14 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [tempReunionDest, setTempReunionDest] = useState(reunionDestination || "");

  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEmoji, setNewEmoji] = useState("❤️");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  // 1. Days together
  const daysTogether = useMemo(() => {
    if (!anniversaryDate) return null;
    const diff = Date.now() - anniversaryDate;
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }, [anniversaryDate]);

  const annivFormatted = useMemo(() => {
    if (!anniversaryDate) return "Tap to set your anniversary";
    try {
      return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
        new Date(anniversaryDate)
      );
    } catch {
      return new Date(anniversaryDate).toLocaleDateString();
    }
  }, [anniversaryDate]);

  // 2. Flight / Reunion countdown
  const reunionStatus = useMemo(() => {
    if (!reunionDate) return null;
    const diff = reunionDate - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days > 1) return { days, label: `${days} days until we reunite` };
    if (days === 1) return { days, label: "Tomorrow we reunite!" };
    if (days === 0) return { days, label: "Today is Reunion Day! 🎉" };
    return { days: 0, label: "Reunited & in love ❤️" };
  }, [reunionDate]);

  // 3. Call Hours
  const callHoursFormatted = useMemo(() => {
    const hours = Math.floor(totalCallSeconds / 3600);
    const mins = Math.floor((totalCallSeconds % 3600) / 60);
    if (hours === 0 && mins === 0) return "Starting our story";
    if (hours === 0) return `${mins}m in calls`;
    return `${hours}h ${mins}m`;
  }, [totalCallSeconds]);

  // 4. Combined Chronological Timeline (Milestones + Polaroids)
  const timelineItems = useMemo(() => {
    type CombinedItem =
      | { type: "milestone"; data: Milestone; date: number }
      | { type: "polaroid"; data: TimelineMoment; date: number };

    const items: CombinedItem[] = [
      ...milestones.map((m) => ({ type: "milestone" as const, data: m, date: m.date })),
      ...moments.slice(0, 12).map((p) => ({ type: "polaroid" as const, data: p, date: p.at })),
    ];

    return items.sort((a, b) => b.date - a.date); // newest first
  }, [milestones, moments]);

  // Handlers
  const handleSaveAnniversary = async () => {
    setSaving(true);
    try {
      const parsed = new Date(tempAnnivDate).getTime();
      await onUpdateMeta({ anniversaryDate: parsed });
      setAnnivModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReunion = async () => {
    setSaving(true);
    try {
      const parsed = new Date(tempReunionDate).getTime();
      await onUpdateMeta({ reunionDate: parsed, reunionDestination: tempReunionDest.trim() });
      setReunionModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMilestone = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const parsed = new Date(newDate).getTime();
      await onAddMilestone({
        title: newTitle.trim(),
        date: parsed,
        emoji: newEmoji,
        note: newNote.trim(),
      });
      setNewTitle("");
      setNewNote("");
      setAddMilestoneOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="love-timeline-widget">
      {/* Header */}
      <div className="timeline-head">
        <div className="widget-title-wrap">
          <span className="widget-icon">📖</span>
          <div>
            <h3>Our Love Story Timeline</h3>
            <p className="widget-sub">Chronicles of our journey, reunions, and unforgettable moments</p>
          </div>
        </div>

        <button
          type="button"
          className="btn-add-milestone"
          onClick={() => setAddMilestoneOpen(true)}
        >
          <span>✨</span> Add Milestone
        </button>
      </div>

      {/* Hero Stats Row: 4 key couple milestones */}
      <div className="timeline-stats-row">
        {/* Days Together */}
        <div className="stat-card" onClick={() => setAnnivModalOpen(true)} role="button" tabIndex={0}>
          <div className="stat-top">
            <span className="stat-badge-icon">🗓️</span>
            <span className="stat-edit-tag">{anniversaryDate ? "Edit" : "Set"}</span>
          </div>
          <div className="stat-number">{daysTogether !== null ? `Day ${daysTogether}` : "Our Start"}</div>
          <div className="stat-label">of Our Love Story</div>
          <div className="stat-detail">{annivFormatted}</div>
        </div>

        {/* Reunion Flight Countdown */}
        <div className="stat-card flight-card" onClick={() => setReunionModalOpen(true)} role="button" tabIndex={0}>
          <div className="stat-top">
            <span className="stat-badge-icon">✈️</span>
            <span className="stat-edit-tag">{reunionDate ? "Edit" : "Set"}</span>
          </div>
          <div className="stat-number">
            {reunionStatus ? (reunionStatus.days > 0 ? `${reunionStatus.days} Days` : "Reunited!") : "Next Meet"}
          </div>
          <div className="stat-label">{reunionStatus ? reunionStatus.label : "Set reunion date"}</div>
          <div className="stat-detail">{reunionDestination || "Tap to set destination"}</div>
        </div>

        {/* Call Hours Spent Together */}
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-badge-icon">📞</span>
            <span className="stat-pulse-dot" />
          </div>
          <div className="stat-number">{callHoursFormatted}</div>
          <div className="stat-label">Together in Video Calls</div>
          <div className="stat-detail">Every conversation etched in time</div>
        </div>

        {/* Polaroids Pinned */}
        <div className="stat-card" onClick={onOpenScrapbook} role="button" tabIndex={0}>
          <div className="stat-top">
            <span className="stat-badge-icon">📷</span>
            <span className="stat-edit-tag">View All</span>
          </div>
          <div className="stat-number">{moments.length} Polaroids</div>
          <div className="stat-label">Pinned Scrapbook Memories</div>
          <div className="stat-detail">Snapped during live calls</div>
        </div>
      </div>

      {/* Chronological Timeline Stream */}
      <div className="timeline-stream-wrap">
        <h4 className="stream-heading">Our Timeline & Memories</h4>

        <div className="timeline-stream">
          <div className="timeline-spine-line" />

          {timelineItems.length === 0 ? (
            <div className="timeline-empty">
              <span>🌱</span>
              <p>Your story is just beginning. Add your first memory above!</p>
            </div>
          ) : (
            timelineItems.map((item, _idx) => {
              if (item.type === "milestone") {
                const m = item.data;
                let dStr = "";
                try {
                  dStr = new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(m.date));
                } catch {
                  dStr = new Date(m.date).toLocaleDateString();
                }

                return (
                  <div key={`m-${m.id}`} className="timeline-node milestone-node">
                    <div className="node-marker">
                      <span className="node-emoji">{m.emoji}</span>
                    </div>

                    <div className="node-card">
                      <div className="node-header">
                        <span className="node-date">{dStr}</span>
                        <button
                          type="button"
                          className="node-delete-btn"
                          title="Remove milestone"
                          onClick={() => onDeleteMilestone(m.id)}
                        >
                          ✕
                        </button>
                      </div>
                      <h5 className="node-title">{m.title}</h5>
                      {m.note && <p className="node-note">{m.note}</p>}
                    </div>
                  </div>
                );
              } else {
                const p = item.data;
                const dStr = formatTime(p.at);

                return (
                  <div key={`p-${p.id}`} className="timeline-node polaroid-node">
                    <div className="node-marker polaroid-marker">
                      <span className="node-emoji">📷</span>
                    </div>

                    <div className="node-card polaroid-card-preview" onClick={onOpenScrapbook}>
                      <div className="polaroid-photo-frame">
                        <img src={p.image} alt={p.caption || "Scrapbook moment"} className="polaroid-thumb" />
                        <span className="polaroid-tape" />
                      </div>
                      <div className="polaroid-info">
                        <span className="node-date">{dStr} · Call Polaroid</span>
                        <div className="polaroid-caption">"{p.caption || "Unspoken moment"}"</div>
                        {p.thought && <div className="polaroid-thought">💭 {p.thought}</div>}
                      </div>
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      </div>

      {/* EDIT ANNIVERSARY MODAL */}
      {annivModalOpen && typeof document !== "undefined" && createPortal(
        <div className="origami-modal-backdrop" onClick={() => !saving && setAnnivModalOpen(false)}>
          <div className="ambient-dialog-modal" onClick={(e) => e.stopPropagation()}>
            <h4>🗓️ Our Anniversary Date</h4>
            <p className="dialog-sub">When did your beautiful story begin?</p>

            <div className="field" style={{ marginTop: 16 }}>
              <label>Anniversary Date</label>
              <input
                type="date"
                value={tempAnnivDate}
                onChange={(e) => setTempAnnivDate(e.target.value)}
              />
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={saving}
                onClick={() => setAnnivModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={handleSaveAnniversary}
              >
                {saving ? "Saving..." : "Save Anniversary"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* EDIT REUNION MODAL */}
      {reunionModalOpen && typeof document !== "undefined" && createPortal(
        <div className="origami-modal-backdrop" onClick={() => !saving && setReunionModalOpen(false)}>
          <div className="ambient-dialog-modal" onClick={(e) => e.stopPropagation()}>
            <h4>✈️ Reunion Flight Countdown</h4>
            <p className="dialog-sub">Set the date and place for your next reunion hug</p>

            <div className="field" style={{ marginTop: 16 }}>
              <label>Reunion Date</label>
              <input
                type="date"
                value={tempReunionDate}
                onChange={(e) => setTempReunionDate(e.target.value)}
              />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Destination / Note</label>
              <input
                type="text"
                placeholder="e.g. JFK Airport Terminal 4 ✈️"
                value={tempReunionDest}
                maxLength={60}
                onChange={(e) => setTempReunionDest(e.target.value)}
              />
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={saving}
                onClick={() => setReunionModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={handleSaveReunion}
              >
                {saving ? "Saving..." : "Save Reunion"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ADD MILESTONE MODAL */}
      {addMilestoneOpen && typeof document !== "undefined" && createPortal(
        <div className="origami-modal-backdrop" onClick={() => !saving && setAddMilestoneOpen(false)}>
          <div className="ambient-dialog-modal" onClick={(e) => e.stopPropagation()}>
            <h4>✨ Add Love Milestone</h4>
            <p className="dialog-sub">Record a special moment in your timeline</p>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Milestone Title</label>
              <input
                type="text"
                placeholder="e.g. The first time we cooked together"
                value={newTitle}
                maxLength={80}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Icon</label>
              <div className="emoji-picker-row">
                {EMOJI_OPTIONS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    className={`emoji-pick-btn ${newEmoji === em ? "active" : ""}`}
                    onClick={() => setNewEmoji(em)}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Memory Note (optional)</label>
              <textarea
                rows={3}
                placeholder="What made this moment unforgettable?"
                value={newNote}
                maxLength={200}
                onChange={(e) => setNewNote(e.target.value)}
              />
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={saving}
                onClick={() => setAddMilestoneOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!newTitle.trim() || saving}
                onClick={handleCreateMilestone}
              >
                {saving ? "Adding..." : "Add to Timeline"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
