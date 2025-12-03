import { useEffect, useState } from "react";
import { DashboardStats } from "@/shared/types";
import { supabase } from "@/react-app/supabase";
import { usePagePermissions } from "@/react-app/hooks/usePermissions";
import { Loader2, UserCheck, Home, DollarSign, TagIcon } from "lucide-react";

import { useAuth } from "@/react-app/contexts/AuthContext";

export default function Dashboard() {
  const perms = usePagePermissions("dashboard");
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      type EmployeeLite = { id: number; full_name: string; function_id: number | null; unit_id: number | null; accommodation_id: number | null; is_active: boolean; arrival_date: string | null };
      type FunctionLite = { id: number; name: string };


      const employeeCountQuery = supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      const employeeRowsQuery = supabase
        .from("employees")
        .select("id")
        .eq("is_active", true);
      const employeesQuery = supabase
        .from("employees")
        .select("id, full_name, function_id, unit_id, accommodation_id, is_active, arrival_date");
      const accommodationsQuery = supabase
        .from("accommodations")
        .select("id")
        .eq("is_active", true);
      const isSuper = currentUser?.is_super_user;
      let unitIds: number[] = [];
      if (!isSuper && currentUser?.id) {
        const { data: links } = await supabase
          .from("user_units")
          .select("unit_id")
          .eq("user_id", currentUser.id);
        unitIds = Array.isArray(links) ? (links as { unit_id: number }[]).map((l) => l.unit_id) : [];
      }

      const [{ count: totalEmployees }, { data: activeEmployeesRows }, { data: employees }, { data: functions }, { data: accRows }, { data: invoices }, { data: manualPurchases }] = await Promise.all([
        isSuper || unitIds.length === 0 ? employeeCountQuery : employeeCountQuery.in("unit_id", unitIds),
        isSuper || unitIds.length === 0 ? employeeRowsQuery : employeeRowsQuery.in("unit_id", unitIds),
        isSuper || unitIds.length === 0 ? employeesQuery : employeesQuery.in("unit_id", unitIds),
        supabase.from("functions").select("id, name"),
        isSuper || unitIds.length === 0 ? accommodationsQuery : accommodationsQuery.in("unit_id", unitIds),
        supabase.from("invoices").select("total_value"),
        supabase.from("manual_purchases").select("total_value").eq("is_active", true),
      ]);
      const activeAccommodations = Array.isArray(accRows) ? accRows.length : 0;

      const invoicesTotal = invoices?.reduce((sum, inv) => sum + (inv.total_value || 0), 0) || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manualTotal = (manualPurchases as any[])?.reduce((sum, mp) => sum + (mp.total_value || 0), 0) || 0;
      setTotalCost(invoicesTotal + manualTotal);

      const accIds = Array.isArray(accRows) ? (accRows as { id: number }[]).map((a) => a.id) : [];
      const { data: accommodationsWithBeds } = await supabase
        .from("accommodations")
        .select("id, bed_count")
        .in("id", accIds.length ? accIds : [-1])
        .eq("is_active", true);
      const accommodationsList = Array.isArray(accommodationsWithBeds) ? (accommodationsWithBeds as { id: number; bed_count: number }[]) : [];
      const employeesList = Array.isArray(employees) ? (employees as EmployeeLite[]) : [];
      const functionsList = Array.isArray(functions) ? (functions as FunctionLite[]) : [];

      const total_beds = accommodationsList.reduce((sum, a) => sum + (a.bed_count || 0), 0);
      const occupied_beds = employeesList.filter((e) => e.is_active && e.accommodation_id != null).length;
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
        total_accommodations: activeAccommodations ?? 0,
        employees_by_function,
      });
    } catch {
      setStats({
        total_employees: 0,
        active_employees: 0,
        total_beds: 0,
        occupied_beds: 0,
        available_beds: 0,
        total_accommodations: 0,
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
      accentRing: "ring-green-400",
    },
    {
      label: "Vagas Ocupadas",
      value: `${stats?.occupied_beds || 0}/${stats?.total_beds || 0}`,
      icon: TagIcon,
      color: "from-purple-500 to-blue-500",
      bgColor: "bg-purple-500/10",
      accentRing: "ring-purple-400",
    },
    {
      label: "Total de Alojamentos",
      value: stats?.total_accommodations || 0,
      icon: Home,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      accentRing: "ring-blue-400",
    },
    {
      label: "Custo Total Obra",
      value: totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      icon: DollarSign,
      color: "from-yellow-500 to-orange-500",
      bgColor: "bg-yellow-500/10",
      accentRing: "ring-yellow-400",
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Dashboard</h1>
        <p className="text-slate-400">Visão geral do sistema de gestão</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 md:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`rounded-full p-2 bg-slate-800 border border-slate-700 ring-2 ring-offset-2 ring-offset-slate-900 ${card.accentRing}`}>
                <card.icon className="w-5 h-5 text-slate-100" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl md:text-3xl font-bold text-slate-100">{card.value}</p>
              <p className="text-xs sm:text-sm text-slate-400">{card.label}</p>
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
                      width: `${(item.count / (stats.total_employees || 1)) * 100
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
