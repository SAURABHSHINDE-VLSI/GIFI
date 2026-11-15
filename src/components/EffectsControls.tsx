"use client";

import type { EffectsPrefs } from "@/lib/effects";

type Props = {
  prefs: EffectsPrefs;
  onPrefsChange: (prefs: EffectsPrefs) => void;
  autoPipEnabled?: boolean;
  onToggleAutoPip?: (enabled: boolean) => void;
};

export default function EffectsControls({
  prefs,
  onPrefsChange,
  autoPipEnabled,
  onToggleAutoPip,
}: Props) {
  function toggleNoise() {
    onPrefsChange({ ...prefs, noiseSuppression: !prefs.noiseSuppression });
  }

  return (
    <div className="effects-content">
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
        <div className="effects-section-call">
          <div className="effects-divider" />
          <div className="effects-group">
            <span className="effects-section-title">Call</span>
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
        </div>
      )}
    </div>
  );
}
