import { Router } from "express";
import { pool } from "../db/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get("/", async (req: AuthedRequest, res) => {
  const { rows } = await pool.query("SELECT id, email, name, goal, created_at FROM users WHERE id = $1", [
    req.userId,
  ]);
  const user = rows[0];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user });
});
