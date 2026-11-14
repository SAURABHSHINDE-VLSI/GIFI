"use client";

import { useEffect, useState } from "react";
import type { EffectsPrefs } from "@/lib/effects";

type Props = {
  prefs: EffectsPrefs;
  onPrefsChange: (prefs: EffectsPrefs) => void;
  blurSupported: boolean;
  autoPipEnabled?: boolean;
  onToggleAutoPip?: (enabled: boolean) => void;
};

export default function EffectsControls({
  prefs,
  onPrefsChange,
  blurSupported,
  autoPipEnabled,
  onToggleAutoPip,
}: Props) {
  const [isLowConcurrency, setIsLowConcurrency] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      setIsLowConcurrency(navigator.hardwareConcurrency <= 4);
    }
  }, []);

  function setBackground(mode: EffectsPrefs["background"]) {
    onPrefsChange({ ...prefs, background: mode });
  }

  function toggleNoise() {
    onPrefsChange({ ...prefs, noiseSuppression: !prefs.noiseSuppression });
  }

  return (
    <div className="effects-content">
      {blurSupported && (
        <div className="effects-group">
          <div className="effects-group-header">
            <span className="effects-group-title">Background Blur</span>
            {isLowConcurrency && (
              <span className="effects-group-hint">May slow older devices.</span>
            )}
          </div>
          <div
            className="effects-segmented"
            role="group"
            aria-label="Background blur level"
          >
            <button
              type="button"
              className={`effects-seg-btn ${prefs.background === "off" ? "active" : ""}`}
              onClick={() => setBackground("off")}
              aria-label="Background blur off"
              aria-pressed={prefs.background === "off"}
            >
              Off
            </button>
            <button
              type="button"
              className={`effects-seg-btn ${prefs.background === "blur-light" ? "active" : ""}`}
              onClick={() => setBackground("blur-light")}
              aria-label="Light background blur"
              aria-pressed={prefs.background === "blur-light"}
            >
              Light
            </button>
            <button
              type="button"
              className={`effects-seg-btn ${prefs.background === "blur-strong" ? "active" : ""}`}
              onClick={() => setBackground("blur-strong")}
              aria-label="Strong background blur"
              aria-pressed={prefs.background === "blur-strong"}
            >
              Strong
            </button>
          </div>
        </div>
      )}

      <div className="effects-group">
        <div className="effects-row-between">
          <div className="effects-text-wrap">
            <span className="effects-group-title">Noise Suppression</span>
            <span className="effects-sub-hint">Filter background noise & hum</span>
          </div>
          <button
            type="button"
            role="switch"
            className={`effects-toggle-switch ${prefs.noiseSuppression ? "on" : "off"}`}
            onClick={toggleNoise}
            aria-checked={prefs.noiseSuppression}
            aria-label={
              prefs.noiseSuppression
                ? "Microphone noise suppression on"
                : "Microphone noise suppression off"
            }
          >
            <span className="effects-toggle-track">
              <span className="effects-toggle-thumb" />
            </span>
          </button>
        </div>
      </div>

      {typeof autoPipEnabled === "boolean" && onToggleAutoPip && (
        <div className="effects-group">
          <div className="effects-row-between">
            <div className="effects-text-wrap">
              <span className="effects-group-title">Auto-minimize</span>
              <span className="effects-sub-hint">Float video when I switch tabs</span>
            </div>
            <button
              type="button"
              role="switch"
              className={`effects-toggle-switch ${autoPipEnabled ? "on" : "off"}`}
              onClick={() => onToggleAutoPip(!autoPipEnabled)}
              aria-checked={autoPipEnabled}
              aria-label={
                autoPipEnabled
                  ? "Auto-minimize when switching tabs on"
                  : "Auto-minimize when switching tabs off"
              }
            >
              <span className="effects-toggle-track">
                <span className="effects-toggle-thumb" />
              </span>
            </button>
          </div>
          <p className="effects-sub-hint" style={{ marginTop: "4px", fontSize: "10.5px" }}>
            If nothing happens, check that Automatic picture-in-picture is allowed for this site in your browser&apos;s site settings.
          </p>
        </div>
      )}
    </div>
  );
}
