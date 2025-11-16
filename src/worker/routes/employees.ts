import { Hono } from "hono";
import { CreateEmployeeSchema, UpdateEmployeeSchema, User } from "../../shared/types";
import { authMiddleware, logAudit } from "../middleware/auth";
import { createSupabase } from "../lib/supabase";

type Variables = {
  user: User;
};

export const employeeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

employeeRoutes.use("/*", authMiddleware);

// List employees
employeeRoutes.get("/", async (c) => {
  const user = c.get("user");
  const supabase = createSupabase(c.env);
  let q = supabase.from("employees").select("*").eq("is_active", true).order("full_name", { ascending: true });
  if (!user.is_super_user && user.unit_id) {
    q = supabase.from("employees").select("*").eq("unit_id", user.unit_id).eq("is_active", true).order("full_name", { ascending: true });
  }
  const { data, error } = await q;
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ employees: data ?? [] }, 200);
});

// Create employee
employeeRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const validatedData = CreateEmployeeSchema.parse(body);
  if (!user.is_super_user && user.unit_id && validatedData.unit_id !== user.unit_id) {
    return c.json({ error: "Cannot create employee in different unit" }, 403);
  }
  const supabase = createSupabase(c.env);

  if (validatedData.room_id) {
    const { data: room } = await supabase
      .from("rooms")
      .select("id, bed_count, is_active")
      .eq("id", validatedData.room_id)
      .eq("is_active", true)
      .single();
    if (!room) {
      return c.json({ error: "Room not found or inactive" }, 400);
    }
    const { count } = await supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("room_id", validatedData.room_id)
      .eq("is_active", true);
    if ((count || 0) >= (room.bed_count as number)) {
      return c.json({ error: "Room is full" }, 400);
    }
  }
  const { data, error } = await supabase
    .from("employees")
    .insert({
      registration_number: validatedData.registration_number,
      full_name: validatedData.full_name,
      arrival_date: validatedData.arrival_date === "" ? null : (validatedData.arrival_date ?? null),
      departure_date: validatedData.departure_date === "" ? null : (validatedData.departure_date ?? null),
      observation: validatedData.observation === "" ? null : (validatedData.observation ?? null),
      unit_id: validatedData.unit_id,
      accommodation_id: validatedData.accommodation_id ?? null,
      room_id: validatedData.room_id ?? null,
      function_id: validatedData.function_id ?? null,
      status: validatedData.status === "" ? null : (validatedData.status ?? null),
    })
    .select("id")
    .single();
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  await logAudit(c, "employees", data!.id as number, "CREATE", null, validatedData);
  return c.json({ id: data!.id }, 201);
});

// Update employee
employeeRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const validatedData = UpdateEmployeeSchema.parse(body);
  const supabase = createSupabase(c.env);
  const { data: oldData } = await supabase.from("employees").select("*").eq("id", id).single();

  if (!oldData) {
    return c.json({ error: "Employee not found" }, 404);
  }

  // Regular users can only update employees in their unit
  if (!user.is_super_user && user.unit_id && oldData.unit_id !== user.unit_id) {
    return c.json({ error: "Cannot update employee from different unit" }, 403);
  }

  // Capacity validation when changing room
  if (validatedData.room_id !== undefined && validatedData.room_id) {
    const { data: room } = await supabase
      .from("rooms")
      .select("id, bed_count, is_active")
      .eq("id", validatedData.room_id)
      .eq("is_active", true)
      .single();
    if (!room) {
      return c.json({ error: "Room not found or inactive" }, 400);
    }
    const { count } = await supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("room_id", validatedData.room_id)
      .eq("is_active", true)
      .neq("id", id);
    if ((count || 0) >= (room.bed_count as number)) {
      return c.json({ error: "Room is full" }, 400);
    }
  }

  const updatePayload: Partial<{
    registration_number: string;
    full_name: string;
    arrival_date: string | null;
    departure_date: string | null;
    observation: string | null;
    unit_id: number;
    accommodation_id: number | null;
    room_id: number | null;
    function_id: number | null;
    status: string | null;
    is_active: boolean;
  }> = {};
  if (validatedData.registration_number !== undefined) updatePayload.registration_number = validatedData.registration_number;
  if (validatedData.full_name !== undefined) updatePayload.full_name = validatedData.full_name;
  if (validatedData.arrival_date !== undefined) updatePayload.arrival_date = validatedData.arrival_date === "" ? null : validatedData.arrival_date;
  if (validatedData.departure_date !== undefined) updatePayload.departure_date = validatedData.departure_date === "" ? null : validatedData.departure_date;
  if (validatedData.observation !== undefined) updatePayload.observation = validatedData.observation === "" ? null : validatedData.observation;
  if (validatedData.unit_id !== undefined) updatePayload.unit_id = validatedData.unit_id;
  if (validatedData.accommodation_id !== undefined) updatePayload.accommodation_id = validatedData.accommodation_id;
  if (validatedData.room_id !== undefined) updatePayload.room_id = validatedData.room_id;
  if (validatedData.function_id !== undefined) updatePayload.function_id = validatedData.function_id;
  if (validatedData.status !== undefined) updatePayload.status = validatedData.status === "" ? null : validatedData.status;
  if (validatedData.is_active !== undefined) updatePayload.is_active = validatedData.is_active;
  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from("employees").update(updatePayload).eq("id", id);
    if (error) {
      return c.json({ error: error.message }, 500);
    }
    await logAudit(c, "employees", id, "UPDATE", oldData, validatedData);
  }
  return c.json({ success: true }, 200);
});

// Delete employee - soft delete
employeeRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"));
  const supabase = createSupabase(c.env);
  const { data: oldData } = await supabase.from("employees").select("*").eq("id", id).single();

  if (!oldData) {
    return c.json({ error: "Employee not found" }, 404);
  }

  // Regular users can only delete employees in their unit
  if (!user.is_super_user && user.unit_id && oldData.unit_id !== user.unit_id) {
    return c.json({ error: "Cannot delete employee from different unit" }, 403);
  }

  const { error } = await supabase.from("employees").update({ is_active: false }).eq("id", id);
  if (error) {
    return c.json({ error: error.message }, 500);
  }

  await logAudit(c, "employees", id, "DELETE", oldData, null);

  return c.json({ success: true }, 200);
});
