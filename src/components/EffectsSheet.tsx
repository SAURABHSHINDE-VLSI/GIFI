"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icons";
import EffectsControls from "./EffectsControls";
import type { EffectsPrefs } from "@/lib/effects";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  prefs: EffectsPrefs;
  onPrefsChange: (prefs: EffectsPrefs) => void;
  blurSupported: boolean;
  autoPipEnabled?: boolean;
  onToggleAutoPip?: (enabled: boolean) => void;
};

export default function EffectsSheet({
  isOpen,
  onClose,
  prefs,
  onPrefsChange,
  blurSupported,
  autoPipEnabled,
  onToggleAutoPip,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="effects-sheet-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="effects-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Call Audio & Video Effects"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="effects-sheet-header">
          <div className="effects-sheet-title-wrap">
            <span className="effects-header-icon">
              <Icon name="sliders" size={18} />
            </span>
            <h2 className="effects-sheet-title">Effects & Audio</h2>
          </div>
          <button
            type="button"
            className="effects-close-btn"
            onClick={onClose}
            aria-label="Close effects menu"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="effects-sheet-body">
          <EffectsControls
            prefs={prefs}
            onPrefsChange={onPrefsChange}
            blurSupported={blurSupported}
            autoPipEnabled={autoPipEnabled}
            onToggleAutoPip={onToggleAutoPip}
          />
        </div>
      </div>
    </div>
  );
}
