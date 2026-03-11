"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

type Entry = { name: string; type: "dir" | "file"; size: number; mtimeEpoch: number };

export default function FileExplorer({
  sessionId,
  onSelectPath
}: {
  sessionId: string;
  onSelectPath: (path: string) => void;
}) {
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh(p: string) {
    setError(null);
    try {
      const r = await apiGet(`/files?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(p)}`);
      setPath(r.path ?? "");
      setEntries(r.entries ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to list files");
    }
  }

  useEffect(() => {
    refresh("").catch(() => void 0);
  }, [sessionId]);

  function up() {
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    refresh(parts.join("/")).catch(() => void 0);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-xs text-slate-600">/workspace/{path}</div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={up}>
            Up
          </button>
          <button className="btn btn-ghost" onClick={() => refresh(path)}>
            Refresh
          </button>
        </div>
      </div>
      {error ? <div className="text-sm text-red-700">{error}</div> : null}
      <div className="max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-white/60">
        {entries.length === 0 ? <div className="p-3 text-sm text-slate-600">Empty.</div> : null}
        {entries.map((e) => (
          <button
            key={e.name}
            className="flex w-full items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 text-left hover:bg-white"
            onClick={() => {
              if (e.type === "dir") {
                const next = [path, e.name].filter(Boolean).join("/");
                refresh(next).catch(() => void 0);
              } else {
                const next = [path, e.name].filter(Boolean).join("/");
                onSelectPath(next);
              }
            }}
          >
            <div className="font-mono text-xs">
              <span className="text-slate-600">{e.type === "dir" ? "d" : "f"}</span>{" "}
              <span>{e.name}</span>
            </div>
            <div className="font-mono text-[11px] text-slate-500">{e.type === "file" ? `${e.size}b` : ""}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

