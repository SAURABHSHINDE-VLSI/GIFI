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
  onBrowse?: () => void;
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
  onBrowse,
  onClose,
}: WatchControlsProps) {
  return (
    <div className={styles.watchPill} role="group" aria-label="Playback controls">
      {isYouTube ? (
        <>
          <div className={styles.playbackGroup}>
            {onPrev && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onPrev}
                aria-label="Previous video"
                title="Previous video"
              >
                <Icon name="skip-back" size={20} />
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
                <Icon name="replay-10" size={20} />
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
                <Icon name={isPlaying ? "pause" : "play"} size={22} />
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
                <Icon name="forward-10" size={20} />
              </button>
            )}

            {onNext && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onNext}
                aria-label="Next video"
                title="Next video"
              >
                <Icon name="skip-forward" size={20} />
              </button>
            )}
          </div>

          <div className={styles.divider} role="separator" aria-orientation="vertical" />

          <span className={styles.timeDisplay}>{formatWatchTime(currentTime)}</span>

          <div className={styles.divider} role="separator" aria-orientation="vertical" />

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

          {onBrowse && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onBrowse}
              aria-label="Minimise and browse"
              title="Minimise & browse"
            >
              <Icon name="pip" size={20} />
            </button>
          )}

          <button
            type="button"
            className={`${styles.iconBtn} ${styles.closeBtn}`}
            onClick={onClose}
            aria-label="Stop watching"
            title="Stop watching"
          >
            <Icon name="close" size={20} />
          </button>
        </>
      ) : (
        <>
          <span className={styles.spotifyNote}>
            Same track on both screens · use Spotify&apos;s own controls
          </span>

          <div className={styles.divider} role="separator" aria-orientation="vertical" />

          <button
            type="button"
            className={`${styles.syncPill} ${styles.syncDisabled}`}
            disabled
            aria-label="Spotify can't be synced"
            title="Spotify can't be synced"
          >
            <span className={`${styles.syncDot} ${styles.syncDotDisabled}`} aria-hidden="true" />
            <span className={styles.syncLabel}>Spotify can&apos;t be synced</span>
          </button>

          <button
            type="button"
            className={`${styles.iconBtn} ${styles.closeBtn}`}
            onClick={onClose}
            aria-label="Stop watching"
            title="Stop watching"
          >
            <Icon name="close" size={20} />
          </button>
        </>
      )}
    </div>
  );
}
