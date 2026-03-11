"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { getToken } from "../lib/auth";

function wsBase() {
  if (typeof window !== "undefined") {
    return ((window as any).__linuxpg?.apiWsUrl as string) ?? "ws://localhost:8080";
  }
  return process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:8080";
}

export default function TerminalPane({ sessionId }: { sessionId: string }) {
  const token = useMemo(() => getToken(), []);
  const ref = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    if (!ref.current || !token) return;

    const term = new Terminal({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: { background: "#0b1220", foreground: "#e2e8f0" }
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(ref.current);
    fit.fit();
    term.focus();
    term.writeln("Connecting...");

    termRef.current = term;
    fitRef.current = fit;

    const ws = new WebSocket(`${wsBase()}/ws/terminal?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as any);
        if (msg.type === "output") term.write(msg.data);
        if (msg.type === "ready") term.writeln("\r\nReady.\r\n");
        if (msg.type === "error") term.writeln(`\r\n[error] ${msg.message}\r\n`);
      } catch {
        // ignore
      }
    };

    const disposeOnData = term.onData((data) => {
      ws.send(JSON.stringify({ type: "input", data }));
    });

    function sendResize() {
      try {
        fit.fit();
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      } catch {
        // ignore
      }
    }

    const ro = new ResizeObserver(() => sendResize());
    ro.observe(ref.current);

    const t = window.setInterval(() => {
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        // ignore
      }
    }, 20_000);

    return () => {
      window.clearInterval(t);
      ro.disconnect();
      disposeOnData.dispose();
      ws.close();
      term.dispose();
    };
  }, [sessionId, token]);

  return (
    <div className="flex h-[520px] flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-medium">Terminal</div>
        <div className="text-xs text-slate-600">status: {status}</div>
      </div>
      <div className="flex-1 rounded-b-2xl bg-slate-950">
        <div ref={ref} className="h-full w-full" />
      </div>
    </div>
  );
}
