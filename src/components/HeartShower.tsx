"use client";

import { useEffect, useState, useRef, memo } from "react";
import styles from "./HeartShower.module.css";

interface HeartItem {
  id: string;
  leftVw: number;
  sizePx: number;
  durationS: number;
  delayS: number;
  swayPx: number;
  tilt: number;
}

export interface HeartShowerProps {
  trigger?: number;
}

const HEART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90">
  <defs>
    <radialGradient id="ghg" cx="35%" cy="30%" r="65%" fx="30%" fy="25%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="18%" stop-color="#ff9ec1"/>
      <stop offset="45%" stop-color="#ef5f86"/>
      <stop offset="78%" stop-color="#e05375"/>
      <stop offset="100%" stop-color="#8c1d40"/>
    </radialGradient>
    <filter id="ghs" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#8c1d40" flood-opacity="0.45"/>
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#ghs)">
    <path d="M 50 85 C 22 58 8 40 8 25 C 8 12 18 3 31 3 C 39 3 46 7 50 14 C 54 7 61 3 69 3 C 82 3 92 12 92 25 C 92 40 78 58 50 85 Z" fill="url(#ghg)"/>
    <path d="M 50 82 C 24 56 11 39 11 25 C 11 14 20 6 31 6 C 38 6 45 9 49 16 C 50 17 50 17 51 16 C 55 9 62 6 69 6 C 80 6 89 14 89 25 C 89 39 76 56 50 82 Z" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5"/>
    <path d="M 18 24 C 18 16 23 10 32 8 C 36 7 40 9 43 12" fill="none" stroke="rgba(255, 255, 255, 0.85)" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="68" cy="15" rx="5" ry="3" transform="rotate(-25 68 15)" fill="rgba(255, 255, 255, 0.55)"/>
  </g>
</svg>`;

let cachedSpriteUrl: string | null = null;

function getHeartSpriteUrl(): string {
  if (cachedSpriteUrl) return cachedSpriteUrl;
  if (typeof document === "undefined") return "";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      cachedSpriteUrl = `data:image/svg+xml;utf8,${encodeURIComponent(HEART_SVG)}`;
      return cachedSpriteUrl;
    }

    const img = new Image();
    const svgBlob = new Blob([HEART_SVG], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, 128, 128);
      try {
        cachedSpriteUrl = canvas.toDataURL("image/png");
      } catch {
        // keep svg fallback
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;

    // Use SVG data URL until canvas rasterization completes
    cachedSpriteUrl = `data:image/svg+xml;utf8,${encodeURIComponent(HEART_SVG)}`;
    return cachedSpriteUrl;
  } catch {
    cachedSpriteUrl = `data:image/svg+xml;utf8,${encodeURIComponent(HEART_SVG)}`;
    return cachedSpriteUrl;
  }
}

export const HeartShower = memo(function HeartShower({ trigger = 0 }: HeartShowerProps) {
  const [hearts, setHearts] = useState<HeartItem[]>([]);
  const prevTriggerRef = useRef<number>(trigger);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear all on visibility hidden
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      if (document.hidden) {
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        setHearts([]);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Only spawn when trigger increments and > 0
    if (trigger <= 0 || trigger === prevTriggerRef.current) {
      prevTriggerRef.current = trigger;
      return;
    }
    prevTriggerRef.current = trigger;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const isMobile =
      typeof window !== "undefined" &&
      (window.innerWidth < 640 || window.matchMedia("(max-width: 639px)").matches);

    // Particle counts: 8-10 for reduced motion, 14-18 on mobile, 20-24 on desktop
    const count = prefersReducedMotion
      ? 8 + Math.floor(Math.random() * 3)
      : isMobile
        ? 14 + Math.floor(Math.random() * 5)
        : 20 + Math.floor(Math.random() * 5);

    const now = Date.now();
    const newBatch: HeartItem[] = [];
    let maxTotalDuration = 0;

    for (let i = 0; i < count; i++) {
      // Sizes 32px to 96px
      const sizePx = 32 + Math.random() * 64;
      const sizeNorm = (sizePx - 32) / (96 - 32);
      const durationS = 3.0 + sizeNorm * 1.4 + (Math.random() * 0.4 - 0.2);

      // Staggered delays over ~2.5s
      const delayS = (i / count) * 2.1 + Math.random() * 0.4;
      const totalS = durationS + delayS;
      if (totalS > maxTotalDuration) maxTotalDuration = totalS;

      // Positions in vw (10vw to 90vw) with sway so none clip off-screen
      const leftVw = 10 + Math.random() * 80;
      let swayPx: number;
      if (leftVw < 25) {
        swayPx = 12 + Math.random() * 30; // sway right
      } else if (leftVw > 75) {
        swayPx = -(12 + Math.random() * 30); // sway left
      } else {
        swayPx = (Math.random() - 0.5) * 60;
      }

      // Gentle horizontal scale tilt factor: 0.85 to 1.0 (creates 3D turn effect cheaply)
      const tilt = 0.85 + Math.random() * 0.15;

      newBatch.push({
        id: `${trigger}-${i}-${now}`,
        leftVw,
        sizePx,
        durationS,
        delayS,
        swayPx,
        tilt,
      });
    }

    setHearts(newBatch);

    // Single timer cleanup: batch removes all hearts once the wave finishes
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setHearts([]);
      clearTimerRef.current = null;
    }, (maxTotalDuration + 0.3) * 1000);
  }, [trigger]);

  if (hearts.length === 0) return null;

  const spriteUrl = getHeartSpriteUrl();

  return (
    <div className={styles.showerContainer} aria-hidden="true">
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className={styles.heartWrapper}
          style={{
            ["--start-x" as string]: `${heart.leftVw}vw`,
            ["--size" as string]: `${heart.sizePx}px`,
            ["--duration" as string]: `${heart.durationS}s`,
            ["--delay" as string]: `${heart.delayS}s`,
            ["--sway" as string]: `${heart.swayPx}px`,
            ["--tilt" as string]: `${heart.tilt}`,
          }}
        >
          <img
            src={spriteUrl}
            alt=""
            className={styles.heartImg}
            width={heart.sizePx}
            height={Math.round(heart.sizePx * 0.9)}
            loading="eager"
            decoding="sync"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
});

export default HeartShower;
