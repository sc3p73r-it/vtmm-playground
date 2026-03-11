import type { IncomingMessage } from "node:http";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import { verifyJwt } from "./crypto.js";
import { docker } from "./docker.js";
import { pool } from "./db.js";
import { config } from "./config.js";

type ClientMsg =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "ping" };

type ServerMsg =
  | { type: "output"; data: string }
  | { type: "error"; message: string }
  | { type: "ready" }
  | { type: "pong" };

const BLOCKED = [
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bhalt\b/i,
  /\brm\s+-rf\s+\/\b/i,
  /\bmkfs\./i,
  /\bdd\s+if=/i
];

function send(ws: WebSocket, msg: ServerMsg) {
  ws.send(JSON.stringify(msg));
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function attachTerminalWss(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: any, head: any) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    if (url.pathname !== "/ws/terminal") return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token") ?? "";
    const sessionId = url.searchParams.get("sessionId") ?? "";

    let auth: { userId: string; email: string };
    try {
      auth = verifyJwt(token);
    } catch {
      send(ws, { type: "error", message: "Unauthorized" });
      ws.close();
      return;
    }

    const sessionRes = await pool.query(
      `SELECT id, user_id, container_id, volume_name, status FROM sessions WHERE id = $1`,
      [sessionId]
    );
    const session = sessionRes.rows[0];
    if (!session || session.user_id !== auth.userId) {
      send(ws, { type: "error", message: "Session not found" });
      ws.close();
      return;
    }
    if (!session.container_id) {
      send(ws, { type: "error", message: "Session not ready" });
      ws.close();
      return;
    }

    const container = docker.getContainer(session.container_id);
    let stream: any;
    try {
      stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
    } catch (e: any) {
      send(ws, { type: "error", message: `Attach failed: ${e?.message ?? "unknown"}` });
      ws.close();
      return;
    }

    let lineBuffer = "";

    const touch = async () => {
      await pool.query(
        `UPDATE sessions SET last_activity_at = now(), expires_at = now() + make_interval(mins => $2) WHERE id = $1`,
        [sessionId, config.sessionTtlMinutes]
      );
    };

    stream.on("data", (chunk: Buffer) => {
      send(ws, { type: "output", data: chunk.toString("utf8") });
    });
    stream.on("error", (e: any) => {
      send(ws, { type: "error", message: `Stream error: ${e?.message ?? "unknown"}` });
    });
    stream.on("end", () => {
      ws.close();
    });

    send(ws, { type: "ready" });

    ws.on("message", async (raw) => {
      const msg = typeof raw === "string" ? safeJsonParse(raw) : safeJsonParse(raw.toString());
      if (!msg || typeof msg.type !== "string") return;

      const typed = msg as ClientMsg;
      if (typed.type === "ping") {
        send(ws, { type: "pong" });
        return;
      }

      if (typed.type === "resize") {
        const cols = Math.max(10, Math.min(300, typed.cols | 0));
        const rows = Math.max(5, Math.min(200, typed.rows | 0));
        try {
          await container.resize({ h: rows, w: cols });
        } catch {
          // ignore
        }
        return;
      }

      if (typed.type !== "input" || typeof typed.data !== "string") return;

      // Best-effort line-based filtering: only checks completed lines.
      for (const ch of typed.data) {
        if (ch === "\n" || ch === "\r") {
          const line = lineBuffer.trim();
          lineBuffer = "";
          if (line) {
            const blocked = BLOCKED.some((re) => re.test(line));
            await pool.query(
              `INSERT INTO command_logs (session_id, user_id, command_line, blocked) VALUES ($1, $2, $3, $4)`,
              [sessionId, auth.userId, line, blocked]
            );
            await touch();
            if (blocked) {
              send(ws, { type: "output", data: `\r\n[blocked] ${line}\r\n` });
              return;
            }
          }
        } else {
          lineBuffer += ch;
        }
      }

      stream.write(typed.data);
      await touch();
    });

    ws.on("close", () => {
      try {
        stream.end();
      } catch {
        // ignore
      }
    });
  });
}
