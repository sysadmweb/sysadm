import { Hono } from "hono";
import { User } from "@/shared/types";
import { authMiddleware } from "../middleware/auth";
import { createSupabase } from "@/worker/lib/supabase";

type Variables = {
  user: User;
};

export const dashboardRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

dashboardRoutes.use("/*", authMiddleware);

// Get dashboard statistics
dashboardRoutes.get("/stats", async (c) => {
  const user = c.get("user");
  const supabase = createSupabase(c.env);

  const unitFilter = !user.is_super_user && user.unit_id ? user.unit_id : null;
  let totalEmployees = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (unitFilter) {
    totalEmployees = await supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("unit_id", unitFilter);
  }
  let activeEmployees = await supabase
    .from("employees")
    .select("room_id", { count: "exact", head: true })
    .eq("is_active", true)
    .not("room_id", "is", null);
  if (unitFilter) {
    activeEmployees = await supabase
      .from("employees")
      .select("room_id", { count: "exact", head: true })
      .eq("is_active", true)
      .not("room_id", "is", null)
      .eq("unit_id", unitFilter);
  }
  // Total beds capacity
  let totalBeds = 0;
  if (unitFilter) {
    const { data: accs } = await supabase.from("accommodations").select("id").eq("unit_id", unitFilter);
    const ids = (accs ?? []).map((a) => a.id);
    const { data: rooms } = await supabase
      .from("rooms")
      .select("bed_count")
      .in("accommodation_id", ids.length ? ids : [-1])
      .eq("is_active", true);
    totalBeds = (rooms ?? []).reduce((sum, r) => sum + (r.bed_count as number), 0);
  } else {
    const { data: rooms } = await supabase
      .from("rooms")
      .select("bed_count")
      .eq("is_active", true);
    totalBeds = (rooms ?? []).reduce((sum, r) => sum + (r.bed_count as number), 0);
  }
  let employeesForRoomsQuery = supabase
    .from("employees")
    .select("room_id, unit_id")
    .eq("is_active", true)
    .not("room_id", "is", null);
  if (unitFilter) {
    employeesForRoomsQuery = employeesForRoomsQuery.eq("unit_id", unitFilter);
  }
  const { data: employeesForRooms } = await employeesForRoomsQuery;
  const occupiedBeds = (employeesForRooms ?? []).length;
  let employeesQuery = supabase
    .from("employees")
    .select("function_id, unit_id")
    .eq("is_active", true);
  if (unitFilter) {
    employeesQuery = employeesQuery.eq("unit_id", unitFilter);
  }
  const { data: employees } = await employeesQuery;
  const { data: functions } = await supabase
    .from("functions")
    .select("id, name")
    .eq("is_active", true);
  const funcMap = new Map((functions ?? []).map((f) => [f.id, f.name]));
  const agg = new Map<string, number>();
  (employees ?? []).forEach((e) => {
    const name = e.function_id ? funcMap.get(e.function_id) || "Sem função" : "Sem função";
    agg.set(name, (agg.get(name) || 0) + 1);
  });
  const employeesByFunction = Array.from(agg.entries()).map(([function_name, count]) => ({ function_name, count })).sort((a, b) => b.count - a.count);

  const stats = {
    total_employees: totalEmployees.count || 0,
    active_employees: activeEmployees.count || 0,
    total_beds: totalBeds,
    occupied_beds: occupiedBeds,
    available_beds: Math.max(totalBeds - occupiedBeds, 0),
    employees_by_function: employeesByFunction,
  };

  return c.json({ stats }, 200);
});
