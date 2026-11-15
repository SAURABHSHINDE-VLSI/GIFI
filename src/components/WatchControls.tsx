"use client";

import React from "react";
import { Icon } from "./Icons";
import styles from "./WatchControls.module.css";

export type WatchControlsProps = {
  variant?: "pill" | "bar";
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

function formatWatchTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? "0" : ""}${rem}`;
}

export default function WatchControls({
  variant = "pill",
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
  if (variant === "pill") {
    return (
      <div className={styles.watchPill} role="group" aria-label="Playback controls">
        {isYouTube ? (
          <>
            <div className={styles.pillPlaybackGroup}>
              {onPrev && (
                <button
                  type="button"
                  className={styles.pillIconBtn}
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
                  className={styles.pillIconBtn}
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
                  className={styles.pillPrimaryBtn}
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
                  className={styles.pillIconBtn}
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
                  className={styles.pillIconBtn}
                  onClick={onNext}
                  aria-label="Next video"
                  title="Next video"
                >
                  <Icon name="skip-forward" size={20} />
                </button>
              )}
            </div>

            <div className={styles.divider} role="separator" aria-orientation="vertical" />

            <div className={styles.pillMetaGroup}>
              <span className={styles.pillTimeDisplay}>{formatWatchTime(currentTime)}</span>

              <div className={styles.divider} role="separator" aria-orientation="vertical" />

              <button
                type="button"
                className={`${styles.pillSyncPill} ${syncOn ? styles.pillSyncOn : styles.pillSyncOff}`}
                onClick={onSyncToggle}
                aria-label={syncOn ? "Sync on" : "Sync off"}
                title={syncOn ? "Sync is active across both screens" : "Sync is paused"}
              >
                <span className={styles.pillSyncDot} aria-hidden="true" />
                <span className={styles.pillSyncLabel}>{syncOn ? "Synced" : "Sync off"}</span>
              </button>

              <button
                type="button"
                className={`${styles.pillIconBtn} ${styles.pillCloseBtn}`}
                onClick={onClose}
                aria-label="Stop watching"
                title="Stop watching"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
          </>
        ) : (
          <>
            <span className={styles.pillSpotifyNote}>
              Same track on both screens · use Spotify&apos;s own controls
            </span>

            <div className={styles.divider} role="separator" aria-orientation="vertical" />

            <button
              type="button"
              className={`${styles.pillSyncPill} ${styles.pillSyncDisabled}`}
              disabled
              aria-label="Spotify can't be synced"
              title="Spotify can't be synced"
            >
              <span className={`${styles.pillSyncDot} ${styles.pillSyncDotDisabled}`} aria-hidden="true" />
              <span className={styles.pillSyncLabel}>Spotify can&apos;t be synced</span>
            </button>

            <button
              type="button"
              className={`${styles.pillIconBtn} ${styles.pillCloseBtn}`}
              onClick={onClose}
              aria-label="Stop playback"
              title="Stop playback"
            >
              <Icon name="close" size={20} />
            </button>
          </>
        )}
      </div>
    );
  }

  // variant === "bar" (Phone attached transport bar)
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
              aria-label={syncOn ? "Sync on" : "Sync off"}
              title={syncOn ? "Sync is active across both screens" : "Sync is paused"}
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
