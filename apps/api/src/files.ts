import type { Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "./auth.js";
import { docker } from "./docker.js";
import { pool } from "./db.js";
import { config } from "./config.js";

function normalizeWorkspacePath(p: string): string {
  const raw = p.trim();
  const rel = raw.startsWith("/") ? raw.slice(1) : raw;
  const parts = rel.split("/").filter(Boolean);
  if (parts.some((x) => x === "." || x === "..")) throw new Error("invalid_path");
  return "/workspace/" + parts.join("/");
}

async function getSessionContainerId(sessionId: string, userId: string): Promise<string> {
  const r = await pool.query(`SELECT container_id FROM sessions WHERE id = $1 AND user_id = $2`, [sessionId, userId]);
  const row = r.rows[0];
  if (!row?.container_id) throw new Error("session_not_ready");
  return row.container_id;
}

async function execInContainer(containerId: string, cmd: string[], env?: Record<string, string>): Promise<string> {
  const container = docker.getContainer(containerId);
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Env: env ? Object.entries(env).map(([k, v]) => `${k}=${v}`) : undefined
  });
  const stream: any = await exec.start({ hijack: true, stdin: false });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (d: Buffer) => chunks.push(d));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return Buffer.concat(chunks).toString("utf8");
}

export async function listFiles(req: AuthedRequest, res: Response) {
  const schema = z.object({ sessionId: z.string().uuid(), path: z.string().optional().default("") });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const { sessionId, path } = parsed.data;
  const userId = req.auth!.userId;

  try {
    const containerId = await getSessionContainerId(sessionId, userId);
    const dir = normalizeWorkspacePath(path);
    const out = await execInContainer(containerId, [
      "bash",
      "-lc",
      `set -e; DIR="$1"; test -d "$DIR"; find "$DIR" -maxdepth 1 -mindepth 1 -printf '%f\\t%y\\t%s\\t%T@\\n' | sort`,
      "bash",
      dir
    ]);
    const entries = out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, kind, size, mtime] = line.split("\t");
        return {
          name,
          type: kind === "d" ? "dir" : "file",
          size: Number(size ?? 0),
          mtimeEpoch: Number(mtime ?? 0)
        };
      });
    await pool.query(
      `UPDATE sessions SET last_activity_at = now(), expires_at = now() + make_interval(mins => $2) WHERE id = $1`,
      [sessionId, config.sessionTtlMinutes]
    );
    return res.json({ path: dir.replace("/workspace/", ""), entries });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message ?? "failed" });
  }
}

export async function readFile(req: AuthedRequest, res: Response) {
  const schema = z.object({ sessionId: z.string().uuid(), path: z.string().min(1) });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const { sessionId, path } = parsed.data;
  const userId = req.auth!.userId;

  try {
    const containerId = await getSessionContainerId(sessionId, userId);
    const filePath = normalizeWorkspacePath(path);
    const b64 = await execInContainer(containerId, [
      "bash",
      "-lc",
      `set -e; FILE="$1"; test -f "$FILE"; base64 -w0 "$FILE"`,
      "bash",
      filePath
    ]);
    await pool.query(
      `UPDATE sessions SET last_activity_at = now(), expires_at = now() + make_interval(mins => $2) WHERE id = $1`,
      [sessionId, config.sessionTtlMinutes]
    );
    return res.json({ path: filePath.replace("/workspace/", ""), contentBase64: b64.trim() });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message ?? "failed" });
  }
}

export async function writeFile(req: AuthedRequest, res: Response) {
  const schema = z.object({
    sessionId: z.string().uuid(),
    path: z.string().min(1),
    contentBase64: z.string()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const { sessionId, path, contentBase64 } = parsed.data;
  const userId = req.auth!.userId;

  try {
    const containerId = await getSessionContainerId(sessionId, userId);
    const filePath = normalizeWorkspacePath(path);
    await execInContainer(
      containerId,
      [
        "bash",
        "-lc",
        `set -euo pipefail; TARGET="$TARGET"; mkdir -p "$(dirname "$TARGET")"; printf "%s" "$B64" | base64 -d > "$TARGET"`,
      ],
      { TARGET: filePath, B64: contentBase64 }
    );
    await pool.query(
      `UPDATE sessions SET last_activity_at = now(), expires_at = now() + make_interval(mins => $2) WHERE id = $1`,
      [sessionId, config.sessionTtlMinutes]
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message ?? "failed" });
  }
}
