"use client";

import { useState } from "react";
import { apiPost } from "../lib/api";
import { useRouter } from "next/navigation";
import { setToken } from "../lib/auth";

export default function RegisterPage() {
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
      const { token } = await apiPost("/auth/register", { email, password });
      setToken(token);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-8">
        <h1 className="text-lg font-semibold">Create account</h1>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            className="input"
            placeholder="Password (min 8 chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Creating..." : "Create"}
          </button>
          <a className="text-sm text-slate-700 underline" href="/login">
            Back to login
          </a>
        </form>
      </div>
    </div>
  );
}
