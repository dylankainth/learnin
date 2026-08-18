import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get("/", async (req: AuthedRequest, res) => {
  const { rows } = await pool.query("SELECT id, name, goal, created_at FROM profiles WHERE id = $1", [
    req.userId,
  ]);
  const profile = rows[0];
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json({ user: { ...profile, email: req.userEmail } });
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  goal: z.string().max(200).nullable().optional(),
});

meRouter.patch("/", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, goal } = parsed.data;
  await pool.query(
    `UPDATE profiles SET name = COALESCE($1, name), goal = CASE WHEN $2::boolean THEN $3 ELSE goal END WHERE id = $4`,
    [name ?? null, goal !== undefined, goal ?? null, req.userId],
  );
  res.status(204).send();
});
