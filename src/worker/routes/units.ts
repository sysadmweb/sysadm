import { Hono } from "hono";
import { CreateUnitSchema, UpdateUnitSchema, User } from "../../shared/types";
import { authMiddleware, superUserMiddleware, logAudit } from "../middleware/auth";
import { createSupabase } from "../lib/supabase";

type Variables = {
  user: User;
};

export const unitRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

unitRoutes.use("/*", authMiddleware);

// List units
unitRoutes.get("/", async (c) => {
  const user = c.get("user");

  const supabase = createSupabase(c.env);

  let q = supabase.from("units").select("*").eq("is_active", true).order("name", { ascending: true });
  if (!user.is_super_user && user.unit_id) {
    q = supabase.from("units").select("*").eq("id", user.unit_id).eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ units: data ?? [] }, 200);
});

// Create unit (super user only)
unitRoutes.post("/", superUserMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = CreateUnitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Dados inválidos",
        details: parsed.error.errors.map((e) => ({ path: e.path, message: e.message })),
      },
      400
    );
  }
  const validatedData = parsed.data;

  const supabase = createSupabase(c.env);

  const { data, error } = await supabase
    .from("units")
    .insert({ name: validatedData.name })
    .select("id")
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  await logAudit(c, "units", data!.id as number, "CREATE", null, validatedData);
  return c.json({ id: data!.id }, 201);
});

// Update unit (super user only)
unitRoutes.patch("/:id", superUserMiddleware, async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const parsed = UpdateUnitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Dados inválidos",
        details: parsed.error.errors.map((e) => ({ path: e.path, message: e.message })),
      },
      400
    );
  }
  const validatedData = parsed.data;

  const supabase = createSupabase(c.env);

  const { data: oldData, error: oldErr } = await supabase
    .from("units")
    .select("*")
    .eq("id", id)
    .single();
  if (oldErr || !oldData) {
    return c.json({ error: "Unit not found" }, 404);
  }

  const updateObj: Partial<{ name: string; is_active: boolean; updated_at: string }> = {};
  if (validatedData.name !== undefined) updateObj.name = validatedData.name;
  if (validatedData.is_active !== undefined) updateObj.is_active = validatedData.is_active;
  if (Object.keys(updateObj).length > 0) updateObj.updated_at = new Date().toISOString();

  if (Object.keys(updateObj).length > 0) {
    const { error } = await supabase.from("units").update(updateObj).eq("id", id);
    if (error) {
      return c.json({ error: error.message }, 500);
    }
    await logAudit(c, "units", id, "UPDATE", oldData, validatedData);
  }

  return c.json({ success: true }, 200);
});

// Delete unit (super user only) - soft delete
unitRoutes.delete("/:id", superUserMiddleware, async (c) => {
  const id = parseInt(c.req.param("id"));

  const supabase = createSupabase(c.env);

  const { data: oldData, error: oldErr } = await supabase
    .from("units")
    .select("*")
    .eq("id", id)
    .single();
  if (oldErr || !oldData) {
    return c.json({ error: "Unit not found" }, 404);
  }

  const { error } = await supabase
    .from("units")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return c.json({ error: error.message }, 500);
  }

  await logAudit(c, "units", id, "DELETE", oldData, null);

  return c.json({ success: true }, 200);
});
