import { Outlet, NavLink, useNavigate } from "react-router";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  Home,
  Bed,
  UserCircle,
  LogOut,
} from "lucide-react";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dbStatus, setDbStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/health", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setDbStatus({ ok: d.ok, message: d.message }))
      .catch(() => setDbStatus({ ok: false, message: "Sem conexão" }));
  }, []);

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/employees", icon: UserCircle, label: "Funcionários" },
    { path: "/accommodations", icon: Home, label: "Alojamentos" },
    { path: "/rooms", icon: Bed, label: "Quartos" },
    { path: "/functions", icon: Briefcase, label: "Funções" },
    ...(user?.is_super_user ? [{ path: "/units", icon: Building2, label: "Unidades" }] : []),
    ...(user?.is_super_user ? [{ path: "/users", icon: Users, label: "Usuários" }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-64 bg-slate-900/50 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl">
        <div className="p-6 border-b border-slate-700/50">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            WorkSpace
          </h1>
          <p className="text-sm text-slate-400 mt-1">Gestão de Alojamentos</p>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 shadow-lg shadow-blue-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.username}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
          {dbStatus && (
            <div className="mt-3 flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${dbStatus.ok ? "bg-green-400" : "bg-red-400"}`}
                title={dbStatus.message}
              />
              <span className="text-xs text-slate-400">{dbStatus.message}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">
        <Outlet />
      </main>
    </div>
  );
}
