import { Hono } from "hono";
import { CreateAccommodationSchema, UpdateAccommodationSchema, User } from "@/shared/types";
import { authMiddleware, logAudit } from "../middleware/auth";
import { createSupabase } from "@/worker/lib/supabase";

type Variables = {
  user: User;
};

export const accommodationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

accommodationRoutes.use("/*", authMiddleware);

// List accommodations
accommodationRoutes.get("/", async (c) => {
  const user = c.get("user");
  const supabase = createSupabase(c.env);
  let q = supabase.from("accommodations").select("*").eq("is_active", true).order("name", { ascending: true });
  if (!user.is_super_user && user.unit_id) {
    q = supabase.from("accommodations").select("*").eq("unit_id", user.unit_id).eq("is_active", true).order("name", { ascending: true });
  }
  const { data, error } = await q;
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ accommodations: data ?? [] }, 200);
});

// Create accommodation
accommodationRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const validatedData = CreateAccommodationSchema.parse(body);
  if (!user.is_super_user && user.unit_id && validatedData.unit_id !== user.unit_id) {
    return c.json({ error: "Cannot create accommodation in different unit" }, 403);
  }
  const supabase = createSupabase(c.env);
  const { data, error } = await supabase
    .from("accommodations")
    .insert({ name: validatedData.name, unit_id: validatedData.unit_id })
    .select("id")
    .single();
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  await logAudit(c, "accommodations", data!.id as number, "CREATE", null, validatedData);
  return c.json({ id: data!.id }, 201);
});

// Update accommodation
accommodationRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const validatedData = UpdateAccommodationSchema.parse(body);
  const supabase = createSupabase(c.env);
  const { data: oldData } = await supabase.from("accommodations").select("*").eq("id", id).single();
  if (!oldData) {
    return c.json({ error: "Accommodation not found" }, 404);
  }
  if (!user.is_super_user && user.unit_id && oldData.unit_id !== user.unit_id) {
    return c.json({ error: "Cannot update accommodation from different unit" }, 403);
  }
  const updatePayload: Partial<{ name: string; unit_id: number; is_active: boolean }> = {};
  if (validatedData.name !== undefined) updatePayload.name = validatedData.name;
  if (validatedData.unit_id !== undefined) updatePayload.unit_id = validatedData.unit_id;
  if (validatedData.is_active !== undefined) updatePayload.is_active = validatedData.is_active;
  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from("accommodations").update(updatePayload).eq("id", id);
    if (error) {
      return c.json({ error: error.message }, 500);
    }
    await logAudit(c, "accommodations", id, "UPDATE", oldData, validatedData);
  }
  return c.json({ success: true }, 200);
});

// Delete accommodation - soft delete
accommodationRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"));
  const supabase = createSupabase(c.env);
  const { data: oldData } = await supabase.from("accommodations").select("*").eq("id", id).single();
  if (!oldData) {
    return c.json({ error: "Accommodation not found" }, 404);
  }
  if (!user.is_super_user && user.unit_id && oldData.unit_id !== user.unit_id) {
    return c.json({ error: "Cannot delete accommodation from different unit" }, 403);
  }
  const { error } = await supabase.from("accommodations").update({ is_active: false }).eq("id", id);
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  await logAudit(c, "accommodations", id, "DELETE", oldData, null);
  return c.json({ success: true }, 200);
});
