import type { LocalAudioTrack, Room } from "livekit-client";
import { Track } from "livekit-client";

export type AudioOptions = Parameters<LocalAudioTrack["restartTrack"]>[0];

export function getAudioCaptureOptions(noiseSuppression: boolean): AudioOptions {
  return {
    noiseSuppression,
    echoCancellation: true,
    autoGainControl: true,
  };
}

export async function applyNoiseSuppression(
  room: Room,
  noiseSuppression: boolean,
): Promise<void> {
  const options = getAudioCaptureOptions(noiseSuppression);

  if (room.options) {
    room.options.audioCaptureDefaults = options;
  }

  const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  const audioTrack = pub?.track as LocalAudioTrack | undefined;

  if (audioTrack) {
    await audioTrack.restartTrack(options);
  }
}
