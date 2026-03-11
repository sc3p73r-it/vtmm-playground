"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

type Log = { command_line: string; blocked: boolean; created_at: string };

export default function CommandHistory({ sessionId }: { sessionId: string }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const r = await apiGet(`/sessions/${encodeURIComponent(sessionId)}/commands`);
      setLogs(r.logs ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load commands");
    }
  }

  useEffect(() => {
    refresh().catch(() => void 0);
    const t = window.setInterval(() => refresh().catch(() => void 0), 5000);
    return () => window.clearInterval(t);
  }, [sessionId]);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Command History</div>
        <button className="btn btn-ghost" onClick={() => refresh()}>
          Refresh
        </button>
      </div>
      {error ? <div className="text-sm text-red-700">{error}</div> : null}
      <div className="max-h-52 overflow-auto rounded-2xl border border-slate-200 bg-white/60">
        {logs.length === 0 ? <div className="p-3 text-sm text-slate-600">No commands yet.</div> : null}
        {logs.map((l, idx) => (
          <div key={idx} className="border-b border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-xs">
                <span className={l.blocked ? "text-red-700" : "text-slate-700"}>{l.command_line}</span>
              </div>
              <div className="font-mono text-[11px] text-slate-500">{new Date(l.created_at).toLocaleTimeString()}</div>
            </div>
            {l.blocked ? <div className="mt-1 text-[11px] text-red-700">blocked</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

