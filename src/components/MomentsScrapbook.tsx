"use client";

import { useEffect, useState } from "react";
import { getDefaultThought, getThoughtsForMoment } from "@/lib/momentThoughts";

export type Moment = {
  id: string;
  by: string;
  mine: boolean;
  image: string;
  caption: string;
  thought?: string;
  at: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onMomentSaved?: (moment: Moment) => void;
};

function formatMomentDate(at: number) {
  const d = new Date(at);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hour = d.getHours() % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${pad(hour)}:${pad(d.getMinutes())} ${ampm}`;
}

async function renderAndDownloadPolaroid(moment: Moment, thoughtText: string) {
  const thought = thoughtText.trim() || getDefaultThought(moment.caption, moment.id);

  // 1. Load image
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = moment.image;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cardWidth = 1200;
  const sideMargin = 64;
  const topMargin = 64;
  const photoW = cardWidth - sideMargin * 2; // 1072px

  // Keep full aspect ratio so nothing is cut off
  const imgRatio = (img.naturalHeight || 3) / (img.naturalWidth || 4);
  const photoH = Math.round(photoW * imgRatio);

  // Setup font for measuring thought lines
  ctx.font = 'italic 500 28px "Playfair Display", Georgia, "Segoe UI Emoji", serif';
  const maxThoughtW = photoW - 40;
  const quoteText = `“${thought}”`;
  const words = quoteText.split(" ");
  const thoughtLines: string[] = [];
  let currentLine = "";

  for (let n = 0; n < words.length; n++) {
    const testLine = currentLine ? currentLine + " " + words[n] : words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxThoughtW && currentLine) {
      thoughtLines.push(currentLine);
      currentLine = words[n];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) thoughtLines.push(currentLine);

  const thoughtLineHeight = 40;
  const thoughtBlockH = thoughtLines.length * thoughtLineHeight;

  // Calculate bottom card area height
  // 40px top gap + 44px title + 10px + 24px date + 24px + 1px divider + 26px + thoughtBlockH + 28px + 24px brand + 54px bottom pad
  const bottomSectionHeight = 40 + 44 + 10 + 24 + 24 + 1 + 26 + thoughtBlockH + 28 + 24 + 54;
  const cardHeight = topMargin + photoH + bottomSectionHeight;

  canvas.width = cardWidth;
  canvas.height = cardHeight;

  // 1. Polaroid cardstock background (warm cream vintage photographic paper)
  ctx.fillStyle = "#faf7f2";
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // Fine edge border
  ctx.strokeStyle = "#e8e1d5";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, cardWidth - 3, cardHeight - 3);

  // 2. Photo pocket background & recessed shadow
  ctx.fillStyle = "#12060c";
  ctx.fillRect(sideMargin, topMargin, photoW, photoH);

  // Draw the photo
  ctx.drawImage(img, sideMargin, topMargin, photoW, photoH);

  // Fine photo outline
  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(sideMargin, topMargin, photoW, photoH);

  // 3. Caption Title
  let curY = topMargin + photoH + 52;
  ctx.font = 'bold 42px "Playfair Display", Georgia, "Segoe UI Emoji", serif';
  ctx.fillStyle = "#1c141a";
  ctx.textAlign = "left";
  ctx.fillText(moment.caption || `Captured by ${moment.by}`, sideMargin, curY);

  // 4. Timestamp
  curY += 34;
  ctx.font = '500 21px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = "#7c6f77";
  ctx.fillText(formatMomentDate(moment.at), sideMargin, curY);

  // 5. Delicate decorative line
  curY += 24;
  ctx.strokeStyle = "rgba(239, 95, 134, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sideMargin, curY);
  ctx.lineTo(sideMargin + photoW, curY);
  ctx.stroke();

  // 6. Romantic Thought
  curY += 38;
  ctx.font = 'italic 500 28px "Playfair Display", Georgia, "Segoe UI Emoji", serif';
  ctx.fillStyle = "#341f2c";
  thoughtLines.forEach((line) => {
    ctx.fillText(line, sideMargin, curY);
    curY += thoughtLineHeight;
  });

  // 7. Watermark / Couple Brand Signature
  curY += 16;
  ctx.font = '600 16px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = "#b89fa9";
  const brand = "HERZ · just the two of us ♡";
  const brandW = ctx.measureText(brand).width;
  ctx.fillText(brand, sideMargin + photoW - brandW, curY);

  // 8. Download
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const a = document.createElement("a");
  const dateStr = new Date(moment.at).toISOString().slice(0, 10);
  a.href = dataUrl;
  a.download = `HERZ_Polaroid_${dateStr}_${moment.id.slice(0, 6)}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function MomentsScrapbook({ isOpen, onClose }: Props) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<Moment | null>(null);

  // Lightbox state
  const [activeThought, setActiveThought] = useState("");
  const [isEditingThought, setIsEditingThought] = useState(false);
  const [editingText, setEditingText] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/moments")
      .then((res) => res.json())
      .then((data) => {
        if (data?.moments) setMoments(data.moments);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (activePhoto) {
      const thought = activePhoto.thought || getDefaultThought(activePhoto.caption, activePhoto.id);
      setActiveThought(thought);
      setEditingText(thought);
      setIsEditingThought(false);
    }
  }, [activePhoto]);

  if (!isOpen) return null;

  async function deletePhoto(id: string) {
    if (!confirm("Remove this memory?")) return;
    try {
      await fetch("/api/moments", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setMoments((curr) => curr.filter((m) => m.id !== id));
      if (activePhoto?.id === id) setActivePhoto(null);
    } catch {
      // ignore
    }
  }

  function cycleNextThought() {
    if (!activePhoto) return;
    const list = getThoughtsForMoment(activePhoto.caption);
    const currIdx = list.indexOf(activeThought);
    const nextIdx = (currIdx + 1) % list.length;
    const newThought = list[nextIdx];
    setActiveThought(newThought);
    setEditingText(newThought);

    // Save thought change to server
    fetch("/api/moments", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: activePhoto.id, thought: newThought }),
    }).catch(() => undefined);

    setMoments((curr) =>
      curr.map((m) => (m.id === activePhoto.id ? { ...m, thought: newThought } : m)),
    );
  }

  async function saveCustomThought(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!activePhoto) return;
    const finalThought = editingText.trim() || activeThought;
    setActiveThought(finalThought);
    setIsEditingThought(false);

    try {
      await fetch("/api/moments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: activePhoto.id, thought: finalThought }),
      });
      setMoments((curr) =>
        curr.map((m) => (m.id === activePhoto.id ? { ...m, thought: finalThought } : m)),
      );
    } catch {
      // ignore
    }
  }

  async function handleDownloadPolaroid() {
    if (!activePhoto || isDownloading) return;
    setIsDownloading(true);
    try {
      await renderAndDownloadPolaroid(activePhoto, activeThought);
    } catch (err) {
      console.error("Failed to generate Polaroid download", err);
    } finally {
      setIsDownloading(false);
    }
  }

  function downloadRawPhoto(image: string, date: number) {
    const a = document.createElement("a");
    a.href = image;
    a.download = `HERZ_Raw_Photo_${date}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="moments-overlay" onClick={onClose}>
      <div className="moments-modal" onClick={(e) => e.stopPropagation()}>
        <div className="moments-header">
          <div className="moments-title-wrap">
            <span className="moments-heart-icon">♥</span>
            <h2>Our Moments</h2>
            <span className="moments-count">{moments.length} memories</span>
          </div>
          <button
            type="button"
            className="moments-close-btn"
            onClick={onClose}
            aria-label="Close Scrapbook"
          >
            ×
          </button>
        </div>

        <div className="moments-body">
          {loading ? (
            <div className="moments-loading">
              <span className="boot-heart">♥</span>
              <p>Opening our scrapbook…</p>
            </div>
          ) : moments.length === 0 ? (
            <div className="moments-empty">
              <span className="moments-empty-heart">📷</span>
              <h3>No moments captured yet</h3>
              <p>Hold up a ✌️ peace sign during any call to snap an instant memory into this scrapbook!</p>
            </div>
          ) : (
            <div className="polaroid-grid">
              {moments.map((moment, idx) => {
                const tilts = [-1.5, 1.2, -0.8, 2, -1.8, 0.9];
                const tilt = tilts[idx % tilts.length];
                const thought = moment.thought || getDefaultThought(moment.caption, moment.id);
                return (
                  <div
                    key={moment.id}
                    className="polaroid-card"
                    style={{ transform: `rotate(${tilt}deg)` }}
                    onClick={() => setActivePhoto(moment)}
                  >
                    <div className="polaroid-img-wrap">
                      <img src={moment.image} alt={moment.caption || "Couple Memory"} loading="lazy" />
                    </div>
                    <div className="polaroid-caption">
                      <p className="polaroid-text">{moment.caption || `Captured by ${moment.by}`}</p>
                      <span className="polaroid-date">{formatMomentDate(moment.at)}</span>
                      <p className="polaroid-thought">“{thought}”</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fullscreen Photo Lightbox */}
        {activePhoto && (
          <div className="polaroid-lightbox" onClick={() => setActivePhoto(null)}>
            <div className="polaroid-lightbox-card" onClick={(e) => e.stopPropagation()}>
              <div className="polaroid-lightbox-img-wrap">
                <img src={activePhoto.image} alt="Expanded memory" />
              </div>

              <div className="polaroid-lightbox-meta">
                <div>
                  <p className="lightbox-caption">{activePhoto.caption || `Captured by ${activePhoto.by}`}</p>
                  <span className="lightbox-date">{formatMomentDate(activePhoto.at)}</span>
                </div>
                <div className="lightbox-actions">
                  <button
                    type="button"
                    className="lightbox-btn primary"
                    onClick={handleDownloadPolaroid}
                    disabled={isDownloading}
                    title="Download complete Polaroid card with Photo, Date & Thought"
                  >
                    {isDownloading ? "Creating Polaroid…" : "📸 Download Polaroid"}
                  </button>
                  <button
                    type="button"
                    className="lightbox-btn secondary"
                    onClick={() => downloadRawPhoto(activePhoto.image, activePhoto.at)}
                    title="Download raw webcam snapshot"
                  >
                    ⬇ Raw photo
                  </button>
                  <button
                    type="button"
                    className="lightbox-btn danger"
                    onClick={() => deletePhoto(activePhoto.id)}
                    title="Delete Memory"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Romantic Thought Card */}
              <div className="lightbox-thought-box">
                <div className="lightbox-thought-header">
                  <span className="lightbox-thought-label">💭 Thought for this moment</span>
                  <div className="lightbox-thought-tools">
                    <button
                      type="button"
                      className="lightbox-thought-tool-btn"
                      onClick={cycleNextThought}
                      title="Cycle to another matching thought"
                    >
                      🎲 Next thought
                    </button>
                    <button
                      type="button"
                      className="lightbox-thought-tool-btn"
                      onClick={() => setIsEditingThought((prev) => !prev)}
                      title="Write a personal note"
                    >
                      {isEditingThought ? "Cancel" : "✎ Edit note"}
                    </button>
                  </div>
                </div>

                {isEditingThought ? (
                  <form onSubmit={saveCustomThought} className="lightbox-thought-edit-form">
                    <input
                      type="text"
                      className="lightbox-thought-input"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      maxLength={200}
                      placeholder="Write a sweet note..."
                      autoFocus
                    />
                    <button type="submit" className="lightbox-btn primary">
                      Save
                    </button>
                  </form>
                ) : (
                  <p className="lightbox-thought-text">“{activeThought}”</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
