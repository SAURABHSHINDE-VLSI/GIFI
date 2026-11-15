"use client";

import { useEffect, useState } from "react";

export default function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    const handleStatus = () => setIsOffline(!navigator.onLine);
    handleStatus();

    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);

    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="network-offline-banner" role="status" aria-live="polite">
      <span className="network-offline-dot" />
      <span>You are offline. Reconnecting…</span>
    </div>
  );
}
