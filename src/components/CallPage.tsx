"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom } from "@livekit/components-react";
import { VideoPresets } from "livekit-client";
import { loadPrefs } from "@/lib/effects";
import { getAudioCaptureOptions } from "@/lib/audioEffects";
import CallUI from "./CallUI";
import PreJoin from "./PreJoin";

type Me = {
  user: { displayName: string };
  partner: { displayName: string } | null;
};

type Credentials = { token: string; url: string; audio: boolean; video: boolean };

export default function CallPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then(async (response) => {
        if (!response.ok) {
          router.replace("/");
          return;
        }
        const data: Me = await response.json();
        if (!data.partner) {
          router.replace("/app");
          return;
        }
        setMe(data);
      })
      .catch(() => router.replace("/"))
      .finally(() => setReady(true));
  }, [router]);

  const join = useCallback(async ({ audio, video }: { audio: boolean; video: boolean }) => {
    setConnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/token", { method: "POST" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Could not start the call.");
      }

      setCredentials({ token: data.token, url: data.url, audio, video });
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not start the call.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const leave = useCallback(() => {
    setCredentials(null);
    router.replace("/app");
  }, [router]);

  if (!ready || !me) {
    return (
      <main className="room">
        <div className="boot">
          <span className="boot-heart">♥</span>
        </div>
      </main>
    );
  }

  if (credentials) {
    return (
      <LiveKitRoom
        token={credentials.token}
        serverUrl={credentials.url}
        connect
        audio={credentials.audio}
        video={credentials.video}
        options={{
          adaptiveStream: {
            pauseVideoInBackground: false,
          },
          dynacast: true,
          videoCaptureDefaults: { resolution: VideoPresets.h1080.resolution },
          audioCaptureDefaults: getAudioCaptureOptions(loadPrefs().noiseSuppression),
          publishDefaults: {
            simulcast: true,
            videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
            videoEncoding: { maxBitrate: 3_500_000, maxFramerate: 30 },
            screenShareEncoding: { maxBitrate: 3_500_000, maxFramerate: 30 },
          },
        }}
        onDisconnected={leave}
      >
        <CallUI
          selfName={me.user.displayName}
          partnerName={me.partner?.displayName ?? "Partner"}
          onLeave={leave}
        />
      </LiveKitRoom>
    );
  }

  return (
    <PreJoin
      displayName={me.user.displayName}
      partnerName={me.partner?.displayName ?? "Partner"}
      connecting={connecting}
      error={error}
      onJoin={join}
    />
  );
}
