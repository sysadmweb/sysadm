import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { User } from "../../shared/types";
import { createSupabase } from "../lib/supabase";

export const SESSION_COOKIE_NAME = "session_token";

// Extend Hono context to include user
type Variables = {
  user: User;
};

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    const guest = {
      id: 0,
      username: "guest",
      name: "Guest",
      is_super_user: true,
      unit_id: null,
      is_active: true,
    } as User;
    c.set("user", guest);
    await next();
    return;
  }

  const supabase = createSupabase(c.env);
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("user_id, expires_at")
    .eq("token", sessionToken)
    .single();

  if (sessionError || !session || new Date(session.expires_at as string) < new Date()) {
    const guest = {
      id: 0,
      username: "guest",
      name: "Guest",
      is_super_user: true,
      unit_id: null,
      is_active: true,
    } as User;
    c.set("user", guest);
    await next();
    return;
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, username, name, is_super_user, unit_id, is_active")
    .eq("id", session.user_id as number)
    .eq("is_active", true)
    .single();

  if (userError || !user) {
    const guest = {
      id: 0,
      username: "guest",
      name: "Guest",
      is_super_user: true,
      unit_id: null,
      is_active: true,
    } as User;
    c.set("user", guest);
    await next();
    return;
  }

  c.set("user", user as User);
  await next();
}

export async function superUserMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const user = c.get("user");

  if (!user || !user.is_super_user) {
    return c.json({ error: "Forbidden - Super user access required" }, 403);
  }

  await next();
}

export async function logAudit(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  tableName: string,
  recordId: number,
  operation: string,
  oldData?: Record<string, unknown> | null,
  newData?: Record<string, unknown> | null
) {
  const user = c.get("user");
  const supabase = createSupabase(c.env);
  await supabase
    .from("audit_log")
    .insert({
      user_id: user.id,
      table_name: tableName,
      record_id: recordId,
      operation,
      old_data: oldData ?? null,
      new_data: newData ?? null,
    });
}
