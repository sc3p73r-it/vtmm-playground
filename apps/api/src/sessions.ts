import type { Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "./auth.js";
import { createPlaygroundContainer, destroyPlaygroundContainer } from "./docker.js";
import { pool } from "./db.js";
import { config } from "./config.js";

export async function listSessions(req: AuthedRequest, res: Response) {
  const r = await pool.query(
    `SELECT id, status, created_at, last_activity_at, expires_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.auth!.userId]
  );
  return res.json({ sessions: r.rows });
}

export async function createSession(req: AuthedRequest, res: Response) {
  const ttlMs = config.sessionTtlMinutes * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);
  const created = await pool.query(
    `INSERT INTO sessions (user_id, status, expires_at) VALUES ($1, 'creating', $2) RETURNING id`,
    [req.auth!.userId, expiresAt]
  );
  const sessionId = created.rows[0].id as string;

  try {
    const { containerId, volumeName } = await createPlaygroundContainer(sessionId);
    await pool.query(
      `UPDATE sessions SET status = 'running', container_id = $2, volume_name = $3, last_activity_at = now() WHERE id = $1`,
      [sessionId, containerId, volumeName]
    );
    return res.status(201).json({ id: sessionId, status: "running" });
  } catch (e: any) {
    await pool.query(`UPDATE sessions SET status = 'error' WHERE id = $1`, [sessionId]);
    return res.status(500).json({ error: e?.message ?? "create_failed" });
  }
}

export async function endSession(req: AuthedRequest, res: Response) {
  const schema = z.object({ id: z.string().uuid() });
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const r = await pool.query(
    `SELECT container_id, volume_name FROM sessions WHERE id = $1 AND user_id = $2`,
    [parsed.data.id, req.auth!.userId]
  );
  const row = r.rows[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  await destroyPlaygroundContainer(row.container_id, row.volume_name);
  await pool.query(`UPDATE sessions SET status = 'ended', container_id = NULL WHERE id = $1`, [parsed.data.id]);
  return res.json({ ok: true });
}

export async function resetSession(req: AuthedRequest, res: Response) {
  const schema = z.object({ id: z.string().uuid() });
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const sessionId = parsed.data.id;
  const r = await pool.query(
    `SELECT container_id, volume_name FROM sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, req.auth!.userId]
  );
  const row = r.rows[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  await destroyPlaygroundContainer(row.container_id, row.volume_name);
  const { containerId, volumeName } = await createPlaygroundContainer(sessionId);
  await pool.query(
    `UPDATE sessions SET status = 'running', container_id = $2, volume_name = $3, last_activity_at = now() WHERE id = $1`,
    [sessionId, containerId, volumeName]
  );
  return res.json({ ok: true });
}

export async function listCommandLogs(req: AuthedRequest, res: Response) {
  const schema = z.object({ id: z.string().uuid() });
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const r = await pool.query(
    `SELECT command_line, blocked, created_at FROM command_logs WHERE session_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 200`,
    [parsed.data.id, req.auth!.userId]
  );
  return res.json({ logs: r.rows });
}

export async function cleanupExpiredSessions() {
  const r = await pool.query(
    `SELECT id, container_id, volume_name FROM sessions WHERE status = 'running' AND expires_at < now() LIMIT 50`
  );
  for (const row of r.rows) {
    await destroyPlaygroundContainer(row.container_id, row.volume_name);
    await pool.query(`UPDATE sessions SET status = 'expired', container_id = NULL WHERE id = $1`, [row.id]);
  }
}
