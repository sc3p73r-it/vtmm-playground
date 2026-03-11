import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { config } from "./config.js";
import { pool, runMigrations } from "./db.js";
import { hashPassword, signJwt, verifyPassword } from "./crypto.js";
import { requireAuth, type AuthedRequest } from "./auth.js";
import { attachTerminalWss } from "./terminalWs.js";
import { createSession, endSession, listCommandLogs, listSessions, resetSession, cleanupExpiredSessions } from "./sessions.js";
import { listFiles, readFile, writeFile } from "./files.js";
import { getLab, listLabs } from "./labs.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/auth/register", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(8).max(200) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
  const { email, password } = parsed.data;

  const passwordHash = await hashPassword(password);
  try {
    const r = await pool.query(`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`, [
      email.toLowerCase(),
      passwordHash
    ]);
    const token = signJwt({ userId: r.rows[0].id, email });
    return res.status(201).json({ token });
  } catch (e: any) {
    if ((e?.code ?? "") === "23505") return res.status(409).json({ error: "email_taken" });
    return res.status(500).json({ error: "register_failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
  const { email, password } = parsed.data;

  const r = await pool.query(`SELECT id, email, password_hash FROM users WHERE email = $1`, [email.toLowerCase()]);
  const row = r.rows[0];
  if (!row) return res.status(401).json({ error: "invalid_credentials" });
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });
  const token = signJwt({ userId: row.id, email: row.email });
  return res.json({ token });
});

app.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  return res.json({ user: { id: req.auth!.userId, email: req.auth!.email } });
});

app.get("/sessions", requireAuth, listSessions);
app.post("/sessions", requireAuth, createSession);
app.delete("/sessions/:id", requireAuth, endSession);
app.post("/sessions/:id/reset", requireAuth, resetSession);
app.get("/sessions/:id/commands", requireAuth, listCommandLogs);

app.get("/files", requireAuth, listFiles);
app.get("/file", requireAuth, readFile);
app.post("/file", requireAuth, writeFile);

app.get("/labs", requireAuth, listLabs);
app.get("/labs/:slug", requireAuth, getLab);

const server = http.createServer(app);
attachTerminalWss(server);

async function main() {
  await runMigrations();
  server.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on :${config.port}`);
  });
  setInterval(() => {
    cleanupExpiredSessions().catch(() => void 0);
  }, 30_000);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

