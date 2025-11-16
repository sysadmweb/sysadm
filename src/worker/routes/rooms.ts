import { Hono } from "hono";
import { CreateRoomSchema, UpdateRoomSchema, User } from "../../shared/types";
import { authMiddleware, logAudit } from "../middleware/auth";
import { createSupabase } from "../lib/supabase";

type Variables = {
  user: User;
};

export const roomRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

roomRoutes.use("/*", authMiddleware);

// List rooms
roomRoutes.get("/", async (c) => {
  const user = c.get("user");
  const supabase = createSupabase(c.env);
  let q = supabase.from("rooms").select("*").eq("is_active", true).order("id", { ascending: true });
  if (!user.is_super_user && user.unit_id) {
    const { data: accs } = await supabase
      .from("accommodations")
      .select("id")
      .eq("unit_id", user.unit_id);
    const ids = (accs ?? []).map((a) => a.id);
    q = supabase.from("rooms").select("*").in("accommodation_id", ids.length ? ids : [-1]).eq("is_active", true).order("id", { ascending: true });
  }
  const { data, error } = await q;
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ rooms: data ?? [] }, 200);
});

// Create room
roomRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const validatedData = CreateRoomSchema.parse(body);
  const supabase = createSupabase(c.env);
  const { data: accommodation } = await supabase
    .from("accommodations")
    .select("unit_id")
    .eq("id", validatedData.accommodation_id)
    .single();
  if (!accommodation) {
    return c.json({ error: "Accommodation not found" }, 404);
  }
  if (!user.is_super_user && user.unit_id && accommodation.unit_id !== user.unit_id) {
    return c.json({ error: "Cannot create room in different unit" }, 403);
  }
  const { data, error } = await supabase
    .from("rooms")
    .insert({ name: validatedData.name, accommodation_id: validatedData.accommodation_id, bed_count: validatedData.bed_count })
    .select("id")
    .single();
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  await logAudit(c, "rooms", data!.id as number, "CREATE", null, validatedData);
  return c.json({ id: data!.id }, 201);
});

// Update room
roomRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const validatedData = UpdateRoomSchema.parse(body);
  const supabase = createSupabase(c.env);
  const { data: oldData } = await supabase
    .from("rooms")
    .select("id, accommodation_id, bed_count, is_active")
    .eq("id", id)
    .single();
  let unitId: number | null = null;
  if (oldData) {
    const { data: acc } = await supabase.from("accommodations").select("unit_id").eq("id", oldData.accommodation_id).single();
    unitId = acc?.unit_id ?? null;
  }

  if (!oldData) {
    return c.json({ error: "Room not found" }, 404);
  }

  if (!user.is_super_user && user.unit_id && unitId !== user.unit_id) {
    return c.json({ error: "Cannot update room from different unit" }, 403);
  }
  const updatePayload: Partial<{ name: string; accommodation_id: number; bed_count: number; is_active: boolean }> = {};
  if (validatedData.name !== undefined) updatePayload.name = validatedData.name;
  if (validatedData.accommodation_id !== undefined) updatePayload.accommodation_id = validatedData.accommodation_id;
  if (validatedData.bed_count !== undefined) updatePayload.bed_count = validatedData.bed_count;
  if (validatedData.is_active !== undefined) updatePayload.is_active = validatedData.is_active;
  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from("rooms").update(updatePayload).eq("id", id);
    if (error) {
      return c.json({ error: error.message }, 500);
    }
    await logAudit(c, "rooms", id, "UPDATE", oldData, validatedData);
  }
  return c.json({ success: true }, 200);
});

// Delete room - soft delete
roomRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"));
  const supabase = createSupabase(c.env);
  const { data: oldData } = await supabase
    .from("rooms")
    .select("id, accommodation_id, bed_count, is_active")
    .eq("id", id)
    .single();
  let unitId: number | null = null;
  if (oldData) {
    const { data: acc } = await supabase.from("accommodations").select("unit_id").eq("id", oldData.accommodation_id).single();
    unitId = acc?.unit_id ?? null;
  }

  if (!oldData) {
    return c.json({ error: "Room not found" }, 404);
  }

  if (!user.is_super_user && user.unit_id && unitId !== user.unit_id) {
    return c.json({ error: "Cannot delete room from different unit" }, 403);
  }
  const { error } = await supabase.from("rooms").update({ is_active: false }).eq("id", id);
  if (error) {
    return c.json({ error: error.message }, 500);
  }

  await logAudit(c, "rooms", id, "DELETE", oldData, null);

  return c.json({ success: true }, 200);
});
