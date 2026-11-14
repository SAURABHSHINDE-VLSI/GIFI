"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icons";
import MomentsScrapbook from "./MomentsScrapbook";
import HeartSignal from "./HeartSignal";
import DualClockArc from "./DualClockArc";
import OrigamiNotes, { OrigamiItem } from "./OrigamiNotes";
import LoveStoryTimeline, { Milestone } from "./LoveStoryTimeline";
import { copyText, initialOf } from "@/lib/ui";

type Me = {
  user: { username: string; displayName: string; paired: boolean; lastSeen: string };
  partner: { displayName: string; lastSeen: string } | null;
};

type CoupleMeta = {
  pair_id: string;
  anniversary_date: number | null;
  reunion_date: number | null;
  reunion_destination: string | null;
  user1_city: string | null;
  user1_tz: string | null;
  user2_city: string | null;
  user2_tz: string | null;
  total_call_seconds: number | null;
  updated_at: number;
};

type AmbientData = {
  meta: CoupleMeta | null;
  signals: Array<{ id: string; fromMe: boolean; fromName: string; at: number }>;
  origami: OrigamiItem[];
  milestones: Milestone[];
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
  const [ambientData, setAmbientData] = useState<AmbientData | null>(null);

  const loadAmbient = useCallback(async () => {
    try {
      const res = await fetch("/api/ambient");
      if (res.ok) {
        const data = await res.json();
        setAmbientData(data);
      }
    } catch {
      // ignore
    }
  }, []);

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
    if (me?.user.paired) {
      loadAmbient();
    }
  }, [me?.user.paired, loadAmbient]);

  const pairedRef = useRef(false);
  pairedRef.current = Boolean(me?.user.paired);

  // While waiting for the other partner to enter the code, keep checking whether the
  // pairing landed so this screen switches over by itself — no manual refresh needed.
  useEffect(() => {
    if (loading || !me || me.user.paired) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!response.ok || cancelled) return;

        const data: Me = await response.json();
        if (cancelled || !data.user?.paired || pairedRef.current) return;

        setMe(data);
        setNotice(`Connected with ${data.partner?.displayName ?? "your partner"}`);
      } catch {
        // transient failure — the next tick retries
      }
    };

    const timer = window.setInterval(poll, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loading, me]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const sendHeartSignal = async () => {
    try {
      const res = await fetch("/api/ambient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heart_signal" }),
      });
      if (res.ok) {
        await loadAmbient();
        setNotice(`Heart sent to ${me?.partner?.displayName ?? "your partner"}!`);
      }
    } catch {
      setError("Could not send heart signal.");
    }
  };

  const sendOrigamiNote = async (data: { content: string; foldType: string; paperStyle: string }) => {
    try {
      const res = await fetch("/api/ambient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_origami", ...data }),
      });
      if (res.ok) {
        await loadAmbient();
        setNotice("Origami note folded and sent!");
      }
    } catch {
      setError("Could not send origami note.");
    }
  };

  const openOrigamiNote = async (id: string) => {
    try {
      const res = await fetch("/api/ambient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_origami", id }),
      });
      if (res.ok) {
        await loadAmbient();
      }
    } catch {
      // ignore
    }
  };

  const updateMeta = async (data: {
    anniversaryDate?: number;
    reunionDate?: number;
    reunionDestination?: string;
    user1City?: string;
    user1Tz?: string;
    user2City?: string;
    user2Tz?: string;
  }) => {
    try {
      const res = await fetch("/api/ambient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_meta", ...data }),
      });
      if (res.ok) {
        await loadAmbient();
        setNotice("Preferences saved.");
      }
    } catch {
      setError("Could not save preferences.");
    }
  };

  const updateLocations = (u1City: string, u1Tz: string, u2City: string, u2Tz: string) => {
    updateMeta({
      user1City: u1City,
      user1Tz: u1Tz,
      user2City: u2City,
      user2Tz: u2Tz,
    });
  };

  const addMilestone = async (data: { title: string; date: number; emoji: string; note?: string }) => {
    try {
      const res = await fetch("/api/ambient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_milestone", ...data }),
      });
      if (res.ok) {
        await loadAmbient();
        setNotice("Milestone added to your timeline!");
      }
    } catch {
      setError("Could not add milestone.");
    }
  };

  const deleteMilestone = async (id: string) => {
    try {
      const res = await fetch("/api/ambient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_milestone", id }),
      });
      if (res.ok) {
        await loadAmbient();
      }
    } catch {
      // ignore
    }
  };

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
      <section
        className="home-card wide clean-dashboard"
        style={me?.user.paired ? { width: "min(680px, 100%)", maxWidth: "680px" } : undefined}
      >
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

            {/* Ambient Sanctuary Suite */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "24px", marginBottom: "20px" }}>
              <HeartSignal
                myName={me.user.displayName}
                partnerName={me.partner.displayName}
                signals={ambientData?.signals ?? []}
                onSendSignal={sendHeartSignal}
              />

              <DualClockArc
                myName={me.user.displayName}
                partnerName={me.partner.displayName}
                user1City={ambientData?.meta?.user1_city ?? null}
                user1Tz={ambientData?.meta?.user1_tz ?? null}
                user2City={ambientData?.meta?.user2_city ?? null}
                user2Tz={ambientData?.meta?.user2_tz ?? null}
                reunionDate={ambientData?.meta?.reunion_date ?? null}
                onUpdateLocations={updateLocations}
              />

              <OrigamiNotes
                myName={me.user.displayName}
                partnerName={me.partner.displayName}
                notes={ambientData?.origami ?? []}
                onSendNote={sendOrigamiNote}
                onOpenNote={openOrigamiNote}
              />

              <LoveStoryTimeline
                myName={me.user.displayName}
                partnerName={me.partner.displayName}
                anniversaryDate={ambientData?.meta?.anniversary_date ?? null}
                reunionDate={ambientData?.meta?.reunion_date ?? null}
                reunionDestination={ambientData?.meta?.reunion_destination ?? null}
                totalCallSeconds={ambientData?.meta?.total_call_seconds ?? 0}
                milestones={ambientData?.milestones ?? []}
                onUpdateMeta={updateMeta}
                onAddMilestone={addMilestone}
                onDeleteMilestone={deleteMilestone}
                onOpenScrapbook={() => setScrapbookOpen(true)}
              />
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
