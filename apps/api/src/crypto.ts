import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signJwt(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
}

export function verifyJwt(token: string): { userId: string; email: string } {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded !== "object" || decoded === null) throw new Error("Invalid token");
  const userId = (decoded as any).userId;
  const email = (decoded as any).email;
  if (typeof userId !== "string" || typeof email !== "string") throw new Error("Invalid token payload");
  return { userId, email };
}

