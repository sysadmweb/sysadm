import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { unitRoutes } from "./routes/units";
import { functionRoutes } from "./routes/functions";
import { accommodationRoutes } from "./routes/accommodations";
import { roomRoutes } from "./routes/rooms";
import { employeeRoutes } from "./routes/employees";
import { dashboardRoutes } from "./routes/dashboard";
import { API, KEY } from "./lib/supabase";

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

app.onError((err, c) => {
  void err;
  return c.json({ error: "Internal Server Error" }, 500);
});

// Health check endpoint
app.get("/api/health", async (c) => {
  try {
    const res = await fetch(`${API}/rest/v1/units?select=id&limit=1`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
      },
    });
    if (!res.ok) throw new Error("bad");
    c.header("Cache-Control", "no-store");
    return c.json({ ok: true, message: "Conexão ativa" }, 200);
  } catch {
    c.header("Cache-Control", "no-store");
    return c.json({ ok: false, message: "Sem conexão" }, 200);
  }
});

// Mount routes
app.route("/api/auth", authRoutes);
app.route("/api/users", userRoutes);
app.route("/api/units", unitRoutes);
app.route("/api/functions", functionRoutes);
app.route("/api/accommodations", accommodationRoutes);
app.route("/api/rooms", roomRoutes);
app.route("/api/employees", employeeRoutes);
app.route("/api/dashboard", dashboardRoutes);

export default app;
