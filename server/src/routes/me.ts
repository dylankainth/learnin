import { Router } from "express";
import { z } from "zod";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get("/", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();
  const user = await pb.collection("users").getOne(req.userId!);
  res.json({ user: { id: user.id, email: user.email, name: user.name, goal: user.goal ?? null } });
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
  await ensureSuperuserAuth();
  const { name, goal } = parsed.data;
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (goal !== undefined) patch.goal = goal;
  await pb.collection("users").update(req.userId!, patch);
  res.status(204).send();
});
