let currentOffset = 0;
let isSyncing = false;

export type TimeSample = {
  t0: number;
  serverNow: number;
  t1: number;
  rtt: number;
};

/**
 * Pure helper to select the sample with the lowest round-trip time (RTT)
 * and calculate the clock offset between server and client.
 */
export function computeBestOffset(samples: TimeSample[]): number {
  if (samples.length === 0) return 0;
  let best = samples[0];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].rtt < best.rtt) {
      best = samples[i];
    }
  }
  // offset = serverNow + rtt / 2 - clientNow (where clientNow = best.t1)
  return Math.round(best.serverNow + best.rtt / 2 - best.t1);
}

/**
 * Takes 5 samples of /api/time, keeps the one with the smallest RTT,
 * and updates the module-level clock offset. Never throws.
 */
export async function syncServerTime(): Promise<number> {
  if (typeof window === "undefined") return currentOffset;
  if (isSyncing) return currentOffset;
  isSyncing = true;
  try {
    const samples: TimeSample[] = [];
    for (let i = 0; i < 5; i++) {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/time", {
          method: "GET",
          headers: { "cache-control": "no-store" },
        });
        const t1 = Date.now();
        if (res.ok) {
          const data = (await res.json()) as { now?: number };
          if (typeof data.now === "number" && Number.isFinite(data.now)) {
            const rtt = Math.max(0, t1 - t0);
            samples.push({ t0, serverNow: data.now, t1, rtt });
          }
        }
      } catch {
        // Individual sample network failure; continue to next sample
      }
    }

    if (samples.length > 0) {
      currentOffset = computeBestOffset(samples);
    }
  } catch (err) {
    console.warn("Failed to synchronize server time, retaining previous offset:", err);
  } finally {
    isSyncing = false;
  }
  return currentOffset;
}

/**
 * Returns current timestamp synchronized to the server clock.
 */
export function serverNow(): number {
  return Date.now() + currentOffset;
}

/**
 * Current offset in milliseconds between server and client clock.
 */
export function getServerOffset(): number {
  return currentOffset;
}

/**
 * Test helper to override the clock offset in simulations.
 */
export function setServerOffset(offset: number): void {
  currentOffset = offset;
}

/**
 * Alias for syncServerTime to be called periodically.
 */
export async function resyncServerTime(): Promise<number> {
  return syncServerTime();
}
