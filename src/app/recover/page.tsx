"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icons";

export default function RecoverPage() {
  const [username, setUsername] = useState("");
  const [key, setKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, key, newPassword }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data?.message ?? "Could not reset the password.");

      setDone(true);
      setNewPassword("");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <section className="home-card">
        <div className="brand">
          <div className="brand-heart">
            <Icon name="heart" size={20} />
          </div>
          <h1>HERZ</h1>
          <p>reset your password</p>
        </div>

        {done ? (
          <div className="recover-done">
            <p>Password updated. You can sign in with the new one now.</p>
            <Link className="btn btn-primary" href="/">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && <p className="form-error">{error}</p>}

            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="username">your id</label>
                <input
                  id="username"
                  name="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="the id you forgot the password for"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={20}
                  enterKeyHint="next"
                />
              </div>

              <div className="field">
                <label htmlFor="key">recovery key</label>
                <input
                  id="key"
                  name="key"
                  type="password"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="owner recovery key"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                />
              </div>

              <div className="field">
                <label htmlFor="newPassword">new password</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="at least 8 characters"
                  autoComplete="new-password"
                  enterKeyHint="go"
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "One moment…" : "Set new password"}
              </button>
            </form>

            <p className="hint">
              The recovery key is set in Sites → Secrets as HERZ_RECOVERY_KEY ·{" "}
              <Link href="/">back to sign in</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
