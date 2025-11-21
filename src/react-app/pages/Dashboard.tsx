import { useEffect, useState } from "react";
import { DashboardStats } from "@/shared/types";
import { supabase } from "@/react-app/supabase";
import { usePagePermissions } from "@/react-app/hooks/usePermissions";
import { Loader2, UserCheck, Home, DollarSign, TagIcon } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "@/react-app/contexts/AuthContext";

export default function Dashboard() {
  const perms = usePagePermissions("dashboard");
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [employeesData, setEmployeesData] = useState<{ registration_number: string; full_name: string; function_id: number | null; unit_id: number | null; is_active: boolean }[]>([]);
  const [functionsData, setFunctionsData] = useState<{ id: number; name: string }[]>([]);
  const [unitsData, setUnitsData] = useState<{ id: number; name: string }[]>([]);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      type RoomLite = { id: number; bed_count: number };
      type EmployeeLite = { id: number; registration_number: string; full_name: string; function_id: number | null; unit_id: number | null; room_id: number | null; is_active: boolean };
      type FunctionLite = { id: number; name: string };
      type UnitLite = { id: number; name: string };

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
        .select("id, registration_number, full_name, function_id, unit_id, room_id, is_active");
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

      const [{ count: totalEmployees }, { data: activeEmployeesRows }, { data: employees }, { data: functions }, { data: accRows }, { data: units }, { data: invoices }] = await Promise.all([
        isSuper || unitIds.length === 0 ? employeeCountQuery : employeeCountQuery.in("unit_id", unitIds),
        isSuper || unitIds.length === 0 ? employeeRowsQuery : employeeRowsQuery.in("unit_id", unitIds),
        isSuper || unitIds.length === 0 ? employeesQuery : employeesQuery.in("unit_id", unitIds),
        supabase.from("functions").select("id, name"),
        isSuper || unitIds.length === 0 ? accommodationsQuery : accommodationsQuery.in("unit_id", unitIds),
        isSuper || unitIds.length === 0 ? supabase.from("units").select("id, name") : supabase.from("units").select("id, name").in("id", unitIds),
        supabase.from("invoices").select("total_value"),
      ]);
      const activeAccommodations = Array.isArray(accRows) ? accRows.length : 0;

      const calculatedTotalCost = invoices?.reduce((sum, inv) => sum + (inv.total_value || 0), 0) || 0;
      setTotalCost(calculatedTotalCost);

      const accIds = Array.isArray(accRows) ? (accRows as { id: number }[]).map((a) => a.id) : [];
      const { data: roomsData } = await supabase
        .from("rooms")
        .select("id, bed_count, accommodation_id")
        .in("accommodation_id", accIds.length ? accIds : [-1]);
      const roomsList = Array.isArray(roomsData) ? (roomsData as RoomLite[]) : [];
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

      setEmployeesData(employeesList.map((e) => ({ registration_number: e.registration_number, full_name: e.full_name, function_id: e.function_id, unit_id: e.unit_id, is_active: e.is_active })));
      setFunctionsData(functionsList.map((f) => ({ id: f.id, name: f.name })));
      setUnitsData(Array.isArray(units) ? (units as UnitLite[]).map((u) => ({ id: u.id, name: u.name })) : []);

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
    },
    {
      label: "Vagas Disponíveis",
      value: stats?.available_beds || 0,
      icon: TagIcon,
      color: "from-purple-500 to-blue-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Total de Alojamentos",
      value: stats?.total_accommodations || 0,
      icon: Home,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Custo Total Obra",
      value: totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      icon: DollarSign,
      color: "from-yellow-500 to-orange-500",
      bgColor: "bg-yellow-500/10",
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
        <div className="flex justify-end mb-4">
          <button
            onClick={() => {
              const doc = new jsPDF();
              doc.setFontSize(14);
              doc.text("LISTA DE COLABORADORES", 14, 20);
              const activeEmployees = employeesData.filter((e) => e.is_active);
              const body = activeEmployees.map((e) => [
                e.registration_number || "-",
                e.full_name || "-",
                functionsData.find((f) => f.id === e.function_id)?.name || "-",
                unitsData.find((u) => u.id === (e.unit_id ?? -1))?.name || "-",
              ]);
              autoTable(doc, {
                head: [["Matricula", "Nome completo", "Função", "Obra"]],
                body,
                startY: 28,
              });
              const dateStr = new Date().toLocaleDateString("pt-BR");
              const pageHeight = doc.internal.pageSize.getHeight();
              doc.setFontSize(10);
              doc.text(`Gerado em ${dateStr}`, 14, pageHeight - 10);
              doc.save("lista-colaboradores.pdf");
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
          >
            Relatório
          </button>
        </div>
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
