"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icons";
import MomentsScrapbook from "./MomentsScrapbook";
import { copyText, initialOf } from "@/lib/ui";

type Me = {
  user: { username: string; displayName: string; paired: boolean; lastSeen: string };
  partner: { displayName: string; lastSeen: string } | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [scrapbookOpen, setScrapbookOpen] = useState(false);

  async function load() {
    const response = await fetch("/api/me");
    if (!response.ok) {
      router.replace("/");
      return;
    }
    const data: Me = await response.json();
    setMe(data);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => router.replace("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  async function createCode() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message ?? "Could not create a code.");
      setCode(data.code);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create a code.");
    } finally {
      setBusy(false);
    }
  }

  async function joinWithCode() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "join", code: joinCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message ?? "Could not connect.");
      await load();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not connect.");
    } finally {
      setBusy(false);
    }
  }

  async function unpair() {
    if (!confirmUnpair) {
      setConfirmUnpair(true);
      setNotice("This removes the pairing for both of you");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "unpair" }),
      });
      if (!response.ok) throw new Error("Could not disconnect. Try again.");
      setConfirmUnpair(false);
      setCode(null);
      setJoinCode("");
      await load();
      setNotice("Disconnected — create a new code");
    } catch (unpairError) {
      setError(unpairError instanceof Error ? unpairError.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    setNotice((await copyText(code)) ? "Code copied" : "Copy failed");
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/");
  }

  if (loading) {
    return (
      <main className="room">
        <div className="boot">
          <span className="boot-heart">♥</span>
        </div>
      </main>
    );
  }

  return (
    <main className="home">
      <section className="home-card wide clean-dashboard">
        <div className="brand compact">
          <div className="brand-heart">
            <Icon name="heart" size={18} />
          </div>
          <h1>HERZ</h1>
          <p>your private sanctuary</p>
        </div>

        {error && <p className="form-error">{error}</p>}

        {me?.user.paired && me.partner ? (
          <>
            <div className="partner-clean-card">
              <div className="avatar partner-clean-avatar">
                {initialOf(me.partner.displayName)}
                <span className="partner-online-dot" />
              </div>
              <div className="partner-clean-info">
                <div className="partner-clean-name">{me.partner.displayName}</div>
                <div className="partner-clean-sub">connected with you</div>
                <div className="partner-clean-lastseen">{me.partner.lastSeen}</div>
              </div>
            </div>

            <div className="dashboard-clean-actions">
              <button className="btn btn-primary btn-call-hero" onClick={() => router.push("/app/call")}>
                <Icon name="heart" size={18} />
                <span>Start our call</span>
              </button>

              <button
                className="btn btn-outline btn-moments-clean"
                type="button"
                onClick={() => setScrapbookOpen(true)}
              >
                <Icon name="gallery" size={16} />
                <span>Moments Scrapbook</span>
              </button>
            </div>

            <p className="hint">private room · only the two of you can enter</p>

            <button className="danger-link" type="button" onClick={unpair} disabled={busy}>
              {confirmUnpair ? "Tap again to disconnect" : "Disconnect & start over"}
            </button>
            <p className="hint">use this if you connected with the wrong code</p>
          </>
        ) : (
          <>
            <h2 className="panel-title">Connect your hearts</h2>
            <p className="panel-sub">
              One of you creates a code, the other enters it. After that your room is locked to
              just the two of you — nobody else can join, ever.
            </p>

            <button className="btn btn-primary" onClick={createCode} disabled={busy}>
              <Icon name="link" size={16} />
              Create our code
            </button>

            {code && (
              <div className="code-box">
                <span className="code-value">{code}</span>
                <button className="code-copy" type="button" onClick={copyCode}>
                  copy
                </button>
              </div>
            )}

            <div className="divider">or your partner sends you one</div>

            <div className="field">
              <label htmlFor="pair-code">partner's code</label>
              <input
                id="pair-code"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="ABCD-2345"
                autoCapitalize="characters"
                maxLength={9}
                spellCheck={false}
              />
            </div>

            <button
              className="btn btn-outline"
              onClick={joinWithCode}
              disabled={busy || joinCode.trim().length < 5}
            >
              Connect with your partner
            </button>

            <p className="hint">codes work once and expire in 7 days</p>
          </>
        )}

        <button className="signout" type="button" onClick={signOut}>
          sign out
        </button>

        {notice && <div className="toast">{notice}</div>}
      </section>

      <MomentsScrapbook isOpen={scrapbookOpen} onClose={() => setScrapbookOpen(false)} />
    </main>
  );
}
