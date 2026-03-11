"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

export default function LabPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const token = useMemo(() => getToken(), []);
  const [lab, setLab] = useState<{ title: string; content_md: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const r = await apiGet(`/labs/${params.slug}`);
        setLab(r.lab);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load lab");
      }
    })();
  }, [params.slug]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <a className="btn btn-ghost" href="/dashboard">
          Back
        </a>
        <a className="btn btn-primary" href="/dashboard">
          Start a session
        </a>
      </div>

      {error ? <div className="card p-4 text-sm text-red-700">{error}</div> : null}

      {lab ? (
        <div className="card p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{lab.title}</h1>
          <div className="mt-6 text-sm leading-7 text-slate-800">
            <ReactMarkdown>{lab.content_md}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="card p-6 text-sm text-slate-600">Loading...</div>
      )}
    </div>
  );
}
