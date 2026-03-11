import type { NextFunction, Request, Response } from "express";
import { verifyJwt } from "./crypto.js";

export type AuthedRequest = Request & { auth?: { userId: string; email: string } };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) return res.status(401).json({ error: "missing_token" });

  try {
    req.auth = verifyJwt(token);
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

