import { Hono } from "hono";
import * as bcrypt from "bcryptjs";
import {
  CreateUserSchema,
  UpdateUserSchema,
  ChangePasswordSchema,
  AdminChangePasswordSchema,
  User,
} from "@/shared/types";
import { authMiddleware, superUserMiddleware, logAudit } from "../middleware/auth";
import { createSupabase } from "@/worker/lib/supabase";

type Variables = {
  user: User;
};

export const userRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
userRoutes.use("/*", authMiddleware);

// List users (super user only)
userRoutes.get("/", superUserMiddleware, async (c) => {
  const supabase = createSupabase(c.env);
  const { data, error } = await supabase
    .from("users")
    .select("id, username, name, is_super_user, unit_id, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ users: data ?? [] }, 200);
});

// Create user (super user only)
userRoutes.post("/", superUserMiddleware, async (c) => {
  const body = await c.req.json();
  const validatedData = CreateUserSchema.parse(body);

  const supabase = createSupabase(c.env);
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("username", validatedData.username)
    .maybeSingle();

  if (existing) {
    return c.json({ error: "Username already exists" }, 400);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(validatedData.password, 10);

  const { data, error } = await supabase
    .from("users")
    .insert({
      username: validatedData.username,
      password_hash: passwordHash,
      name: validatedData.name,
      unit_id: validatedData.unit_id ?? null,
      is_super_user: !!validatedData.is_super_user,
    })
    .select("id")
    .single();
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  await logAudit(c, "users", data!.id as number, "CREATE", null, validatedData);
  return c.json({ id: data!.id }, 201);
});

// Update user (super user only)
userRoutes.patch("/:id", superUserMiddleware, async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const validatedData = UpdateUserSchema.parse(body);

  // Get old data for audit
  const supabase = createSupabase(c.env);
  const { data: oldData } = await supabase.from("users").select("*").eq("id", id).single();

  if (!oldData) {
    return c.json({ error: "User not found" }, 404);
  }

  // Build update query
  const updatePayload: Partial<{
    name: string;
    unit_id: number | null;
    is_active: boolean;
  }> = {};
  if (validatedData.name !== undefined) updatePayload.name = validatedData.name;
  if (validatedData.unit_id !== undefined) updatePayload.unit_id = validatedData.unit_id;
  if (validatedData.is_active !== undefined) updatePayload.is_active = validatedData.is_active;
  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from("users").update(updatePayload).eq("id", id);
    if (error) {
      return c.json({ error: error.message }, 500);
    }
    await logAudit(c, "users", id, "UPDATE", oldData, validatedData);
  }
  return c.json({ success: true }, 200);
});

// Delete user (super user only) - soft delete
userRoutes.delete("/:id", superUserMiddleware, async (c) => {
  const id = parseInt(c.req.param("id"));

  const supabase = createSupabase(c.env);
  const { data: oldData } = await supabase.from("users").select("*").eq("id", id).single();

  if (!oldData) {
    return c.json({ error: "User not found" }, 404);
  }

  const { error } = await supabase.from("users").update({ is_active: false }).eq("id", id);
  if (error) {
    return c.json({ error: error.message }, 500);
  }

  await logAudit(c, "users", id, "DELETE", oldData, null);

  return c.json({ success: true }, 200);
});

// Change own password
userRoutes.post("/change-password", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const validatedData = ChangePasswordSchema.parse(body);

  const supabase = createSupabase(c.env);
  const { data: userData } = await supabase
    .from("users")
    .select("password_hash")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return c.json({ error: "User not found" }, 404);
  }

  // Verify old password
  const isValid = await bcrypt.compare(
    validatedData.old_password,
    userData.password_hash as string
  );

  if (!isValid) {
    return c.json({ error: "Invalid old password" }, 400);
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(validatedData.new_password, 10);

  const { error } = await supabase
    .from("users")
    .update({ password_hash: newPasswordHash })
    .eq("id", user.id);
  if (error) {
    return c.json({ error: error.message }, 500);
  }

  await logAudit(c, "users", user.id, "CHANGE_PASSWORD", null, null);

  return c.json({ success: true }, 200);
});

// Reset user password (super user only)
userRoutes.post("/:id/reset-password", superUserMiddleware, async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const validatedData = AdminChangePasswordSchema.parse(body);

  const supabase = createSupabase(c.env);
  const { data: user } = await supabase.from("users").select("id").eq("id", id).single();
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const newPasswordHash = await bcrypt.hash(validatedData.new_password, 10);
  const { error } = await supabase.from("users").update({ password_hash: newPasswordHash }).eq("id", id);
  if (error) {
    return c.json({ error: error.message }, 500);
  }

  await logAudit(c, "users", id, "RESET_PASSWORD", null, null);
  return c.json({ success: true }, 200);
});
