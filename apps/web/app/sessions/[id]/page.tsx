"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPost } from "../../lib/api";
import { getToken } from "../../lib/auth";
import TerminalPane from "../../components/TerminalPane";
import FileExplorer from "../../components/FileExplorer";
import Editor from "../../components/Editor";
import CommandHistory from "../../components/CommandHistory";

export default function SessionPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const token = useMemo(() => getToken(), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>("README.txt");

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  useEffect(() => {
    (async () => {
      try {
        await apiGet("/sessions");
      } catch (e: any) {
        setError(e?.message ?? "Failed to load session");
      }
    })();
  }, [params.id]);

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/sessions/${params.id}/reset`, {});
    } catch (e: any) {
      setError(e?.message ?? "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/sessions/${params.id}`);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "End failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <a className="btn btn-ghost" href="/dashboard">
          Back
        </a>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={reset} disabled={busy}>
            Reset
          </button>
          <button className="btn btn-primary" onClick={end} disabled={busy}>
            End Session
          </button>
        </div>
      </div>

      {error ? <div className="card p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="card lg:col-span-7">
          <TerminalPane sessionId={params.id} />
        </div>
        <div className="grid gap-4 lg:col-span-5">
          <div className="card p-4">
            <FileExplorer sessionId={params.id} onSelectPath={setSelectedPath} />
          </div>
          <div className="card p-4">
            <Editor sessionId={params.id} path={selectedPath} />
          </div>
          <div className="card p-4">
            <CommandHistory sessionId={params.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
