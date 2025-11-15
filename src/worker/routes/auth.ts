import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import * as bcrypt from "bcryptjs";
import { LoginSchema, User } from "@/shared/types";
import { authMiddleware, SESSION_COOKIE_NAME } from "../middleware/auth";
import { createSupabase } from "@/worker/lib/supabase";

type Variables = {
  user: User;
};

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Login
authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const validatedData = LoginSchema.parse(body);

  const supabase = createSupabase(c.env);
  const { data: user, error } = await supabase
    .from("users")
    .select("id, username, password_hash, name, is_super_user, unit_id, is_active")
    .eq("username", validatedData.username)
    .eq("is_active", true)
    .single();

  if (error || !user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Verify password
  const isValid = await bcrypt.compare(
    validatedData.password,
    user.password_hash as string
  );

  if (!isValid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Generate session token
  const sessionToken = globalThis.crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 8); // 8 hours

  await supabase
    .from("sessions")
    .insert({ user_id: user.id, token: sessionToken, expires_at: expiresAt.toISOString() });

  // Set cookie
  setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    maxAge: 8 * 60 * 60, // 8 hours
  });

  // Return user without password
  const userWithoutPassword = {
    id: user.id,
    username: user.username,
    name: user.name,
    is_super_user: user.is_super_user,
    unit_id: user.unit_id,
    is_active: user.is_active,
  };

  return c.json({ user: userWithoutPassword }, 200);
});

// Get current user
authRoutes.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  return c.json({ user }, 200);
});

// Logout
authRoutes.post("/logout", authMiddleware, async (c) => {
  const sessionToken = c.req.header("cookie")?.split("session_token=")[1]?.split(";")[0];

  if (sessionToken) {
    const supabase = createSupabase(c.env);
    await supabase.from("sessions").delete().eq("token", sessionToken);
  }

  deleteCookie(c, SESSION_COOKIE_NAME);

  return c.json({ success: true }, 200);
});
