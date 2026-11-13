"use client";

import { useEffect, useState } from "react";

/**
 * Whether the current device can switch between front and rear cameras.
 * Phones often only list the rear camera after permission is granted, so any
 * touch device gets the button.
 */
export function useCanFlipCamera() {
  const [canFlip, setCanFlip] = useState(false);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;

        const cameras = devices.filter((device) => device.kind === "videoinput");
        const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
        setCanFlip(cameras.length > 1 || touch);
      } catch {
        // enumeration can fail before permission; leave the button hidden
      }
    };

    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);

    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
    };
  }, []);

  return canFlip;
}
