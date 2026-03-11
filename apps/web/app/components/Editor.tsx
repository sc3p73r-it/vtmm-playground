"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

function decodeBase64ToText(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeTextToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export default function Editor({ sessionId, path }: { sessionId: string; path: string }) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string>("idle");
  const filePath = useMemo(() => path || "README.txt", [path]);

  useEffect(() => {
    (async () => {
      setStatus("loading");
      try {
        const r = await apiGet(`/file?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(filePath)}`);
        setContent(decodeBase64ToText(r.contentBase64 ?? ""));
        setStatus("loaded");
      } catch {
        setContent(`# ${filePath}\n`);
        setStatus("new");
      }
    })();
  }, [sessionId, filePath]);

  async function save() {
    setStatus("saving");
    try {
      await apiPost("/file", {
        sessionId,
        path: filePath,
        contentBase64: encodeTextToBase64(content)
      });
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 800);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-xs text-slate-600">{filePath}</div>
        <div className="flex items-center gap-3">
          <div className="font-mono text-[11px] text-slate-500">{status}</div>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
      <textarea
        className="h-56 w-full resize-none rounded-2xl border border-slate-200 bg-white/60 p-3 font-mono text-xs outline-none focus:border-slate-400"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}

