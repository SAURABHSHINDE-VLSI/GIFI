export type PeerWatchState = {
  videoId: string;
  pos: number;
  at: number;
  playing: boolean;
};

export type SyncDecision =
  | { action: "in-sync" }
  | {
      action: "seek";
      target: number;
      playing: boolean;
      laggard: "local" | "remote";
    };

/**
 * Projects a peer's playback position to the given server timestamp.
 * If the peer was playing, advances position by elapsed seconds;
 * otherwise leaves position unchanged.
 */
export function projectPosition(state: PeerWatchState, nowServer: number): number {
  if (!state.playing) {
    return Math.max(0, state.pos);
  }
  const deltaSeconds = Math.max(0, (nowServer - state.at) / 1000);
  return Math.max(0, state.pos + deltaSeconds);
}

/**
 * Pure helper comparing local and remote playback positions projected to nowServer.
 * Identifies LEADER (greater projected position) and LAGGARD (lesser projected position).
 * If the absolute gap is within deadbandSeconds, returns "in-sync".
 * Otherwise returns seek instructions directing the laggard to jump to the leader.
 */
export function decideSync(
  local: PeerWatchState,
  remote: PeerWatchState,
  nowServer: number,
  deadbandSeconds = 1.5,
): SyncDecision {
  // If videos don't match, sync is not applicable
  if (!local.videoId || !remote.videoId || local.videoId !== remote.videoId) {
    return { action: "in-sync" };
  }

  const localProjected = projectPosition(local, nowServer);
  const remoteProjected = projectPosition(remote, nowServer);

  const diff = Math.abs(localProjected - remoteProjected);
  if (diff <= deadbandSeconds) {
    return { action: "in-sync" };
  }

  if (localProjected >= remoteProjected) {
    // Local is the LEADER, Remote is the LAGGARD
    return {
      action: "seek",
      target: localProjected,
      playing: local.playing,
      laggard: "remote",
    };
  } else {
    // Remote is the LEADER, Local is the LAGGARD
    return {
      action: "seek",
      target: remoteProjected,
      playing: remote.playing,
      laggard: "local",
    };
  }
}
