"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiDelete } from "../lib/api";
import { clearToken, getToken } from "../lib/auth";
import { useRouter } from "next/navigation";

type Session = {
  id: string;
  status: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
};

type Lab = { slug: string; title: string };

export default function DashboardPage() {
  const router = useRouter();
  const token = useMemo(() => getToken(), []);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  async function refresh() {
    setError(null);
    try {
      const s = await apiGet("/sessions");
      setSessions(s.sessions ?? []);
      const l = await apiGet("/labs");
      setLabs(l.labs ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    }
  }

  useEffect(() => {
    refresh().catch(() => void 0);
  }, []);

  async function createNew() {
    setBusy(true);
    setError(null);
    try {
      const created = await apiPost("/sessions", {});
      router.push(`/sessions/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create session");
    } finally {
      setBusy(false);
    }
  }

  async function end(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/sessions/${id}`);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to end session");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Sessions, labs, and your workspace containers.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
          <button className="btn btn-primary" onClick={createNew} disabled={busy}>
            {busy ? "Starting..." : "New Session"}
          </button>
        </div>
      </div>

      {error ? <div className="card p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Sessions</h2>
            <button className="btn btn-ghost" onClick={() => refresh()} disabled={busy}>
              Refresh
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {sessions.length === 0 ? <div className="text-sm text-slate-600">No sessions yet.</div> : null}
            {sessions.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs text-slate-500">{s.id}</div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium">{s.status}</span>{" "}
                      <span className="text-slate-600">
                        expires {new Date(s.expires_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a className="btn btn-primary" href={`/sessions/${s.id}`}>
                      Open
                    </a>
                    <button className="btn btn-ghost" onClick={() => end(s.id)} disabled={busy}>
                      End
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Labs</h2>
          <div className="mt-4 grid gap-3">
            {labs.length === 0 ? <div className="text-sm text-slate-600">No labs found.</div> : null}
            {labs.map((lab) => (
              <a
                key={lab.slug}
                className="rounded-2xl border border-slate-200 bg-white/60 p-4 hover:bg-white"
                href={`/labs/${lab.slug}`}
              >
                <div className="text-sm font-medium">{lab.title}</div>
                <div className="mt-1 font-mono text-xs text-slate-500">{lab.slug}</div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

