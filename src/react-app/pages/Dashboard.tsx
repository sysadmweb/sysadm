import { useEffect, useState } from "react";
import { DashboardStats } from "@/shared/types";
import { supabase } from "@/react-app/supabase";
import { usePagePermissions } from "@/react-app/hooks/usePermissions";
import { Users, Bed, CheckCircle, XCircle, Loader2, BedSingleIcon, LucideBadgePoundSterling, BedDouble, BellDot, BedIcon, Circle, User2Icon, UserCheck, HouseIcon, ParkingCircleIcon, CheckCheckIcon, CheckCircle2 } from "lucide-react";

export default function Dashboard() {
  const perms = usePagePermissions("dashboard");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      type RoomLite = { id: number; bed_count: number };
      type EmployeeLite = { id: number; function_id: number | null; room_id: number | null; is_active: boolean };
      type FunctionLite = { id: number; name: string };

      const [{ count: totalEmployees }, { data: activeEmployeesRows }, { data: rooms }, { data: employees }, { data: functions }] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("employees").select("id").eq("is_active", true),
        supabase.from("rooms").select("id, bed_count"),
        supabase.from("employees").select("id, function_id, room_id, is_active"),
        supabase.from("functions").select("id, name"),
      ]);

      const roomsList = Array.isArray(rooms) ? (rooms as RoomLite[]) : [];
      const employeesList = Array.isArray(employees) ? (employees as EmployeeLite[]) : [];
      const functionsList = Array.isArray(functions) ? (functions as FunctionLite[]) : [];

      const total_beds = roomsList.reduce((sum, r) => sum + r.bed_count, 0);
      const occupied_beds = employeesList.filter((e) => e.is_active && e.room_id != null).length;
      const available_beds = Math.max(total_beds - occupied_beds, 0);
      const active_employees = Array.isArray(activeEmployeesRows) ? activeEmployeesRows.length : 0;

      const employees_by_function = functionsList.map((f) => ({
        function_name: f.name,
        count: employeesList.filter((e) => e.function_id === f.id && e.is_active).length,
      }));

      setStats({
        total_employees: totalEmployees ?? 0,
        active_employees,
        total_beds,
        occupied_beds,
        available_beds,
        employees_by_function,
      });
    } catch {
      setStats({
        total_employees: 0,
        active_employees: 0,
        total_beds: 0,
        occupied_beds: 0,
        available_beds: 0,
        employees_by_function: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!perms.can_view) {
    return <div className="flex items-center justify-center h-96 text-slate-300">Sem acesso</div>;
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const statCards = [
 
    {
      label: "Funcionários Ativos",
      value: stats?.active_employees || 0,
      icon: UserCheck,
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Camas Ocupadas",
      value: stats?.occupied_beds || 0,
      icon: Bed,
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Vagas Disponíveis",
      value: stats?.available_beds || 0,
      icon: HouseIcon,
      color: "from-gray-500 to-green-500",
      bgColor: "bg-green-500/10",
    },
       {
      label: "Total de Funcionários",
      value: stats?.total_employees || 0,
      icon: Users,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Dashboard</h1>
        <p className="text-slate-400">Visão geral do sistema de gestão</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-6 h-6 bg-gradient-to-r ${card.color} `} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-100 mb-1">{card.value}</p>
              <p className="text-sm text-slate-400">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Functions Chart */}
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-100 mb-6">
          Funcionários por Função
        </h2>
        {stats?.employees_by_function && stats.employees_by_function.length > 0 ? (
          <div className="space-y-4">
            {stats.employees_by_function.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 font-medium">{item.function_name}</span>
                  <span className="text-slate-400">{item.count}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        (item.count / (stats.total_employees || 1)) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-center py-8">
            Nenhum funcionário cadastrado ainda
          </p>
        )}
      </div>
    </div>
  );
}
