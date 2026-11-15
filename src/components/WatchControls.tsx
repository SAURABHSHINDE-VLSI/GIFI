"use client";

import React from "react";
import { Icon } from "./Icons";
import styles from "./WatchControls.module.css";

export type WatchControlsProps = {
  isYouTube: boolean;
  isPlaying: boolean;
  currentTime: number;
  syncOn: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onRewind10?: () => void;
  onForward10?: () => void;
  onPlayPause?: () => void;
  onSyncToggle?: () => void;
  onClose: () => void;
};

function formatWatchTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  }
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export default function WatchControls({
  isYouTube,
  isPlaying,
  currentTime,
  syncOn,
  onPrev,
  onNext,
  onRewind10,
  onForward10,
  onPlayPause,
  onSyncToggle,
  onClose,
}: WatchControlsProps) {
  return (
    <div className={styles.watchBar} role="group" aria-label="Playback controls">
      {isYouTube ? (
        <>
          <div className={styles.playbackGroup}>
            {onPrev && (
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.navBtn}`}
                onClick={onPrev}
                aria-label="Previous video"
                title="Previous video"
              >
                <Icon name="skip-back" size={18} />
              </button>
            )}

            {onRewind10 && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onRewind10}
                aria-label="Back 10 seconds"
                title="Back 10 seconds"
              >
                <Icon name="replay-10" size={18} />
              </button>
            )}

            {onPlayPause && (
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.primaryBtn}`}
                onClick={onPlayPause}
                aria-label={isPlaying ? "Pause" : "Play"}
                title={isPlaying ? "Pause" : "Play"}
              >
                <Icon name={isPlaying ? "pause" : "play"} size={20} />
              </button>
            )}

            {onForward10 && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onForward10}
                aria-label="Forward 10 seconds"
                title="Forward 10 seconds"
              >
                <Icon name="forward-10" size={18} />
              </button>
            )}

            {onNext && (
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.navBtn}`}
                onClick={onNext}
                aria-label="Next video"
                title="Next video"
              >
                <Icon name="skip-forward" size={18} />
              </button>
            )}
          </div>

          <div className={styles.metaGroup}>
            <span className={styles.timeDisplay}>{formatWatchTime(currentTime)}</span>

            <button
              type="button"
              className={`${styles.syncPill} ${syncOn ? styles.syncOn : styles.syncOff}`}
              onClick={onSyncToggle}
              aria-pressed={syncOn}
              aria-label={syncOn ? "Synced" : "Sync off"}
              title={
                syncOn
                  ? "Automatic sync is active (click to turn off)"
                  : "Automatic sync is off (click to turn on)"
              }
            >
              <span className={styles.syncDot} aria-hidden="true" />
              <span className={styles.syncLabel}>{syncOn ? "Synced" : "Sync off"}</span>
            </button>

            <button
              type="button"
              className={`${styles.iconBtn} ${styles.closeBtn}`}
              onClick={onClose}
              aria-label="Stop watching"
              title="Stop watching"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </>
      ) : (
        <div className={styles.metaGroup}>
          <span className={styles.spotifyNote}>Playing via Spotify</span>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.closeBtn}`}
            onClick={onClose}
            aria-label="Stop playback"
            title="Stop playback"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
