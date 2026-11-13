"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icons";
import { copyText, initialOf } from "@/lib/ui";

type Me = {
  user: { username: string; displayName: string; paired: boolean };
  partner: { displayName: string } | null;
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

  async function load() {
    const response = await fetch("/api/me");
    if (!response.ok) {
      router.replace("/");
      return;
    }
    setMe(await response.json());
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
      <section className="home-card wide">
        <div className="brand compact">
          <div className="brand-heart">
            <Icon name="heart" size={18} />
          </div>
          <h1>HERZ</h1>
          <p>your private space</p>
        </div>

        {error && <p className="form-error">{error}</p>}

        {me?.user.paired && me.partner ? (
          <>
            <div className="partner">
              <div className="avatar small partner-avatar">{initialOf(me.partner.displayName)}</div>
              <div>
                <div className="partner-name">{me.partner.displayName}</div>
                <div className="partner-sub">connected with you</div>
              </div>
            </div>

            <button className="btn btn-primary" onClick={() => router.push("/app/call")}>
              <Icon name="heart" size={16} />
              Start our call
            </button>

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

            <div className="divider">or she sends you one</div>

            <div className="field">
              <label htmlFor="pair-code">her code</label>
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
              Connect with her
            </button>

            <p className="hint">codes work once and expire in 7 days</p>
          </>
        )}

        <button className="signout" type="button" onClick={signOut}>
          sign out
        </button>

        {notice && <div className="toast">{notice}</div>}
      </section>
    </main>
  );
}
