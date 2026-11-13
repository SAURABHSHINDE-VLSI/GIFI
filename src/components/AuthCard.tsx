"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icons";

type Mode = "login" | "signup";

export default function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((response) => {
        if (response.ok) router.replace("/app");
      })
      .catch(() => undefined);
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup"
          ? { username, displayName, password }
          : { username, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Something went wrong.");
      }

      router.replace("/app");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
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
          <p>just the two of us</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
          >
            Create id
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}

        <form onSubmit={submit}>
          {mode === "signup" && (
            <div className="field">
              <label htmlFor="displayName">your name</label>
              <input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="what she calls you"
                maxLength={24}
                autoComplete="nickname"
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="username">your id</label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. saurabh_07"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
            />
          </div>

          <div className="field">
            <label htmlFor="password">password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "signup" ? "at least 6 characters" : "your password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "One moment…" : mode === "signup" ? "Create our id" : "Sign in"}
            {!busy && <Icon name="heart" size={16} />}
          </button>
        </form>

        <p className="hint">private · no email needed · only the two of you</p>
      </section>
    </main>
  );
}
