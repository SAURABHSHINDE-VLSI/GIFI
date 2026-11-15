"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import styles from "./HeartShower.module.css";

interface HeartItem {
  id: string;
  leftVw: number;
  sizePx: number;
  durationS: number;
  delayS: number;
  swayPx: number;
  rotY: number;
  rotX: number;
}

export interface HeartShowerProps {
  trigger?: number;
}

export function HeartShower({ trigger = 0 }: HeartShowerProps) {
  const [hearts, setHearts] = useState<HeartItem[]>([]);
  const prevTriggerRef = useRef<number>(trigger);

  const removeHeart = useCallback((id: string) => {
    setHearts((prev) => prev.filter((h) => h.id !== id));
  }, []);

  // Clear all on visibility hidden
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      if (document.hidden) {
        setHearts([]);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
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

    // 8-10 hearts for reduced motion, 28-40 for full 3D shower
    const count = prefersReducedMotion
      ? 8 + Math.floor(Math.random() * 3)
      : 28 + Math.floor(Math.random() * 13);

    const now = Date.now();
    const newBatch: HeartItem[] = [];

    for (let i = 0; i < count; i++) {
      // Sizes 28px to 96px
      const sizePx = 28 + Math.random() * 68;
      // Larger hearts float slightly slower, small ones rise faster
      const sizeNorm = (sizePx - 28) / (96 - 28);
      const durationS = 3.2 + sizeNorm * 1.6 + (Math.random() * 0.4 - 0.2);

      // Staggered delays over ~2.5s
      const delayS = (i / count) * 2.1 + Math.random() * 0.4;

      // Positions in vw (10vw to 90vw) with side-to-side sway so none clip off-screen
      const leftVw = 10 + Math.random() * 80;
      let swayPx: number;
      if (leftVw < 25) {
        swayPx = 12 + Math.random() * 30; // sway right
      } else if (leftVw > 75) {
        swayPx = -(12 + Math.random() * 30); // sway left
      } else {
        swayPx = (Math.random() - 0.5) * 60;
      }

      // 3D tilt
      const rotY = Math.random() * 30 - 15; // -15deg to +15deg
      const rotX = Math.random() * 16 - 8; // -8deg to +8deg

      newBatch.push({
        id: `${trigger}-${i}-${now}-${Math.random().toString(36).slice(2, 7)}`,
        leftVw,
        sizePx,
        durationS,
        delayS,
        swayPx,
        rotY,
        rotX,
      });
    }

    // Cap total simultaneous hearts at 60
    setHearts((prev) => {
      const combined = [...prev, ...newBatch];
      return combined.length > 60 ? combined.slice(combined.length - 60) : combined;
    });
  }, [trigger]);

  if (hearts.length === 0) return null;

  return (
    <div className={styles.showerContainer} aria-hidden="true">
      <svg
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id="glossyHeartGrad" cx="35%" cy="30%" r="65%" fx="30%" fy="25%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="18%" stopColor="#ff9ec1" />
            <stop offset="45%" stopColor="#ef5f86" />
            <stop offset="78%" stopColor="#e05375" />
            <stop offset="100%" stopColor="#8c1d40" />
          </radialGradient>
          <filter id="glossyHeartShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#8c1d40" floodOpacity="0.45" />
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>
      </svg>
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className={styles.heartWrapper}
          onAnimationEnd={() => removeHeart(heart.id)}
          style={{
            ["--start-x" as string]: `${heart.leftVw}vw`,
            ["--size" as string]: `${heart.sizePx}px`,
            ["--duration" as string]: `${heart.durationS}s`,
            ["--delay" as string]: `${heart.delayS}s`,
            ["--sway" as string]: `${heart.swayPx}px`,
            ["--rot-y" as string]: `${heart.rotY}deg`,
            ["--rot-x" as string]: `${heart.rotX}deg`,
          }}
        >
          <svg
            viewBox="0 0 100 90"
            className={styles.heartSvg}
            xmlns="http://www.w3.org/2000/svg"
          >
            <g filter="url(#glossyHeartShadow)">
              <path
                d="M 50 85 C 22 58 8 40 8 25 C 8 12 18 3 31 3 C 39 3 46 7 50 14 C 54 7 61 3 69 3 C 82 3 92 12 92 25 C 92 40 78 58 50 85 Z"
                fill="url(#glossyHeartGrad)"
              />
              <path
                d="M 50 82 C 24 56 11 39 11 25 C 11 14 20 6 31 6 C 38 6 45 9 49 16 C 50 17 50 17 51 16 C 55 9 62 6 69 6 C 80 6 89 14 89 25 C 89 39 76 56 50 82 Z"
                fill="none"
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth="1.5"
              />
              <path
                d="M 18 24 C 18 16 23 10 32 8 C 36 7 40 9 43 12"
                fill="none"
                stroke="rgba(255, 255, 255, 0.85)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <ellipse
                cx="68"
                cy="15"
                rx="5"
                ry="3"
                transform="rotate(-25 68 15)"
                fill="rgba(255, 255, 255, 0.55)"
              />
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}

export default HeartShower;
