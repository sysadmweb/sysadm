import { Hono } from "hono";
import { CreateFunctionSchema, UpdateFunctionSchema, User } from "@/shared/types";
import { authMiddleware, logAudit } from "../middleware/auth";
import { createSupabase } from "@/worker/lib/supabase";

type Variables = {
  user: User;
};

export const functionRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

functionRoutes.use("/*", authMiddleware);

// List functions
functionRoutes.get("/", async (c) => {
  const supabase = createSupabase(c.env);
  const { data, error } = await supabase
    .from("functions")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ functions: data ?? [] }, 200);
});

// Create function
functionRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const validatedData = CreateFunctionSchema.parse(body);

  const supabase = createSupabase(c.env);
  const { data, error } = await supabase
    .from("functions")
    .insert({ name: validatedData.name })
    .select("id")
    .single();
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  await logAudit(c, "functions", data!.id as number, "CREATE", null, validatedData);
  return c.json({ id: data!.id }, 201);
});

// Update function
functionRoutes.patch("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const validatedData = UpdateFunctionSchema.parse(body);
  const supabase = createSupabase(c.env);
  const { data: oldData } = await supabase.from("functions").select("*").eq("id", id).single();
  if (!oldData) {
    return c.json({ error: "Function not found" }, 404);
  }
  const updatePayload: Partial<{ name: string; is_active: boolean }> = {};
  if (validatedData.name !== undefined) updatePayload.name = validatedData.name;
  if (validatedData.is_active !== undefined) updatePayload.is_active = validatedData.is_active;
  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from("functions").update(updatePayload).eq("id", id);
    if (error) {
      return c.json({ error: error.message }, 500);
    }
    await logAudit(c, "functions", id, "UPDATE", oldData, validatedData);
  }
  return c.json({ success: true }, 200);
});

// Delete function - soft delete
functionRoutes.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const supabase = createSupabase(c.env);
  const { data: oldData } = await supabase.from("functions").select("*").eq("id", id).single();
  if (!oldData) {
    return c.json({ error: "Function not found" }, 404);
  }
  const { error } = await supabase.from("functions").update({ is_active: false }).eq("id", id);
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  await logAudit(c, "functions", id, "DELETE", oldData, null);
  return c.json({ success: true }, 200);
});
