"use client";

import React, { useLayoutEffect, useRef, useState } from "react";

interface WatchPillWrapperProps {
  children: React.ReactNode;
  closing?: boolean;
  onClosed?: () => void;
}

export default function WatchPillWrapper({
  children,
  closing = false,
  onClosed,
}: WatchPillWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const [entered, setEntered] = useState(false);

  useLayoutEffect(() => {
    if (ref.current) {
      const scrollW = ref.current.scrollWidth;
      if (scrollW > 0) {
        setNaturalWidth(scrollW);
      }
    }
  }, []);

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== ref.current) return;
    if (closing) {
      onClosed?.();
    } else {
      setEntered(true);
    }
  };

  const animClass = closing
    ? "pill-exit"
    : entered
      ? "pill-idle"
      : "pill-enter";

  return (
    <div
      ref={ref}
      className={`watch-pill-wrapper ${animClass}`}
      style={{
        ["--pill-width" as string]: naturalWidth ? `${naturalWidth}px` : "516px",
      }}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}
