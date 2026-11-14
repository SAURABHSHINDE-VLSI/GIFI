"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { Icon } from "./Icons";

type Props = {
  room: Room;
  isActive: boolean;
  onClose: () => void;
};

const DOODLE_COLORS = [
  { name: "Neon Rose", hex: "#ff2e88" },
  { name: "Ruby Passion", hex: "#ff3344" },
  { name: "Sunset Orange", hex: "#ff7a45" },
  { name: "Golden Glow", hex: "#ffd166" },
  { name: "Neon Lime", hex: "#70e000" },
  { name: "Magic Cyan", hex: "#06d6a0" },
  { name: "Electric Blue", hex: "#00b4d8" },
  { name: "Royal Purple", hex: "#9d4edd" },
  { name: "Sweet Lavender", hex: "#d68cff" },
  { name: "Bubblegum Pink", hex: "#ff8fab" },
  { name: "Pure White", hex: "#ffffff" },
];

export default function LoveCanvas({ room, isActive, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [selectedColor, setSelectedColor] = useState(DOODLE_COLORS[0].hex);
  const [penSize, setPenSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(28);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const drawLine = useCallback(
    (x0: number, y0: number, x1: number, y1: number, color: string, size: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      ctx.save();
      if (color === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = size;
        ctx.shadowBlur = 0;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.shadowColor = color;
        ctx.shadowBlur = size * 2.5;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(x0 * w, y0 * h);
      ctx.lineTo(x1 * w, y1 * h);
      ctx.stroke();
      ctx.restore();
    },
    [],
  );

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const sendClear = useCallback(() => {
    clearCanvas();
    room.localParticipant
      .publishData(new TextEncoder().encode(JSON.stringify({ t: "doodle_clear" })), {
        reliable: true,
      })
      .catch(() => undefined);
  }, [clearCanvas, room]);

  const sendStroke = useCallback(
    (x0: number, y0: number, x1: number, y1: number, color: string, size: number) => {
      drawLine(x0, y0, x1, y1, color, size);
      room.localParticipant
        .publishData(
          new TextEncoder().encode(
            JSON.stringify({
              t: "doodle_stroke",
              x0: Number(x0.toFixed(4)),
              y0: Number(y0.toFixed(4)),
              x1: Number(x1.toFixed(4)),
              y1: Number(y1.toFixed(4)),
              color,
              size,
            }),
          ),
          { reliable: false },
        )
        .catch(() => undefined);
    },
    [drawLine, room],
  );

  // Handle Escape key to close doodle
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onClose]);

  // Resize canvas to match container dimensions
  useEffect(() => {
    const updateSize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isActive]);

  // Listen for remote partner's doodle strokes
  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.t === "doodle_stroke") {
          drawLine(msg.x0, msg.y0, msg.x1, msg.y1, msg.color, msg.size);
        } else if (msg?.t === "doodle_clear") {
          clearCanvas();
        }
      } catch {
        // ignore
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, drawLine, clearCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (!e.touches[0]) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const pos = getPos(e);
    if (!pos) return;
    isDrawing.current = true;
    lastPoint.current = pos;
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !lastPoint.current) return;
    e.stopPropagation();
    const pos = getPos(e);
    if (!pos) return;

    sendStroke(
      lastPoint.current.x,
      lastPoint.current.y,
      pos.x,
      pos.y,
      tool === "eraser" ? "eraser" : selectedColor,
      tool === "eraser" ? eraserSize : penSize,
    );
    lastPoint.current = pos;
  };

  const handleEnd = () => {
    isDrawing.current = false;
    lastPoint.current = null;
  };

  if (!isActive) return null;

  return (
    <div className="love-canvas-container">
      <canvas
        ref={canvasRef}
        className={`love-canvas-el ${
          tool === "eraser"
            ? `eraser-mode eraser-${eraserSize <= 16 ? "sm" : eraserSize <= 32 ? "md" : "lg"}`
            : ""
        }`}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />

      {/* Floating Toolbar */}
      <div className="love-canvas-toolbar" onClick={(e) => e.stopPropagation()}>
        {/* Tool Selector: Pen vs Eraser */}
        <div className="canvas-tools">
          <button
            type="button"
            className={`tool-btn ${tool === "pen" ? "active" : ""}`}
            onClick={() => setTool("pen")}
            aria-label="Draw with pen"
            title="Pen"
          >
            <Icon name="pen" size={14} />
          </button>
          <button
            type="button"
            className={`tool-btn ${tool === "eraser" ? "active" : ""}`}
            onClick={() => setTool("eraser")}
            aria-label="Erase doodle"
            title="Eraser"
          >
            <Icon name="eraser" size={14} />
          </button>
        </div>

        <div className="canvas-colors">
          {DOODLE_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              className={`color-btn ${tool === "pen" && selectedColor.toLowerCase() === c.hex.toLowerCase() ? "active" : ""}`}
              style={{ backgroundColor: c.hex }}
              onClick={() => {
                setSelectedColor(c.hex);
                setTool("pen");
              }}
              title={c.name}
            />
          ))}

          {/* Custom color picker */}
          <label
            className={`color-picker-btn ${
              tool === "pen" && !DOODLE_COLORS.some((c) => c.hex.toLowerCase() === selectedColor.toLowerCase())
                ? "active"
                : ""
            }`}
            title="Custom color wheel"
            style={{
              ["--active-color" as string]: selectedColor,
            }}
          >
            <input
              type="color"
              className="color-picker-input"
              value={selectedColor.startsWith("#") ? selectedColor : "#ff2e88"}
              onChange={(e) => {
                setSelectedColor(e.target.value);
                setTool("pen");
              }}
              title="Pick any color"
            />
            <span className="color-picker-rainbow" />
          </label>
        </div>

        <div className="canvas-sizes">
          {tool === "pen" ? (
            <>
              <button
                type="button"
                className={`size-btn ${penSize === 3 ? "active" : ""}`}
                onClick={() => setPenSize(3)}
                title="Fine pen (3px)"
              >
                <span style={{ width: 4, height: 4 }} />
              </button>
              <button
                type="button"
                className={`size-btn ${penSize === 6 ? "active" : ""}`}
                onClick={() => setPenSize(6)}
                title="Medium glow pen (6px)"
              >
                <span style={{ width: 8, height: 8 }} />
              </button>
              <button
                type="button"
                className={`size-btn ${penSize === 10 ? "active" : ""}`}
                onClick={() => setPenSize(10)}
                title="Bold neon pen (10px)"
              >
                <span style={{ width: 12, height: 12 }} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`size-btn eraser-size ${eraserSize === 14 ? "active" : ""}`}
                onClick={() => setEraserSize(14)}
                title="Precision eraser (14px)"
              >
                <span style={{ width: 6, height: 6 }} />
              </button>
              <button
                type="button"
                className={`size-btn eraser-size ${eraserSize === 28 ? "active" : ""}`}
                onClick={() => setEraserSize(28)}
                title="Medium eraser (28px)"
              >
                <span style={{ width: 10, height: 10 }} />
              </button>
              <button
                type="button"
                className={`size-btn eraser-size ${eraserSize === 56 ? "active" : ""}`}
                onClick={() => setEraserSize(56)}
                title="Large eraser (56px)"
              >
                <span style={{ width: 15, height: 15 }} />
              </button>
            </>
          )}
        </div>

        <div className="canvas-actions">
          <button type="button" className="canvas-action-btn" onClick={sendClear} title="Clear board">
            Clear
          </button>
          {onClose && (
            <button
              type="button"
              className="canvas-action-btn close"
              onClick={onClose}
              title="Close Doodle"
              aria-label="Close Doodle"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

