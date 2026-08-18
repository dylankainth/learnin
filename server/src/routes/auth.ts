import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db/index.js";
import { env } from "../env.js";

export const authRouter = Router();

const signupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  goal: z.string().max(200).optional(),
});

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, email, password, goal } = parsed.data;

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, name, goal) VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, goal`,
    [email, passwordHash, name, goal ?? null],
  );
  const user = result.rows[0];
  await pool.query("INSERT INTO notification_prefs (user_id) VALUES ($1)", [user.id]);

  const token = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: "30d" });
  res.status(201).json({ token, user });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  const result = await pool.query(
    "SELECT id, email, name, goal, password_hash FROM users WHERE email = $1",
    [email],
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: "30d" });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, goal: user.goal },
  });
});
