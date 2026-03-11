import type { Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "./auth.js";
import { pool } from "./db.js";

export async function listLabs(_req: AuthedRequest, res: Response) {
  const r = await pool.query(`SELECT slug, title FROM labs ORDER BY title ASC`);
  return res.json({ labs: r.rows });
}

export async function getLab(req: AuthedRequest, res: Response) {
  const schema = z.object({ slug: z.string().min(1) });
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

  const r = await pool.query(`SELECT slug, title, content_md FROM labs WHERE slug = $1`, [parsed.data.slug]);
  if (!r.rowCount) return res.status(404).json({ error: "not_found" });
  return res.json({ lab: r.rows[0] });
}

