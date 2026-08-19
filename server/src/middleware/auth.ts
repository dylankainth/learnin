import type { NextFunction, Request, Response } from "express";
import PocketBase from "pocketbase";
import { env } from "../env.js";

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/** Verifies the PocketBase auth token the app attaches after authWithPassword/create. */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);

  // A throwaway client per request — never touch the shared superuser
  // client's authStore, and each request's token is verified independently
  // by asking PocketBase itself, so it stays correct across PocketBase
  // versions regardless of its internal token signing details.
  const pb = new PocketBase(env.pocketbaseUrl);
  pb.authStore.save(token, null);
  try {
    const { record } = await pb.collection("users").authRefresh();
    req.userId = record.id;
    req.userEmail = record.email as string;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
