"use client";

import { useState } from "react";
import { apiPost } from "../lib/api";
import { useRouter } from "next/navigation";
import { setToken } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await apiPost("/auth/login", { email, password });
      setToken(token);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Linux Playground</h1>
        <p className="mt-2 text-sm text-slate-600">
          Spin up an isolated Ubuntu container, practice commands, and work through labs.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-slate-100">
          <div className="text-slate-400">$ whoami</div>
          <div>play</div>
          <div className="mt-3 text-slate-400">$ pwd</div>
          <div>/workspace</div>
        </div>
      </div>

      <div className="card p-8">
        <h2 className="text-lg font-semibold">Log in</h2>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
          <a className="text-sm text-slate-700 underline" href="/register">
            Create an account
          </a>
        </form>
      </div>
    </div>
  );
}
