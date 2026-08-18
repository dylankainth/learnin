import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

interface SupabaseAccessTokenPayload {
  sub: string;
  email?: string;
  aud?: string;
}

/** Verifies the Supabase Auth access token the app attaches after signInWithPassword/signUp. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.supabaseJwtSecret, {
      algorithms: ["HS256"],
    }) as SupabaseAccessTokenPayload;
    if (payload.aud !== "authenticated") {
      res.status(401).json({ error: "Invalid token audience" });
      return;
    }
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
