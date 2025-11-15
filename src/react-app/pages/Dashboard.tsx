import { useEffect, useState } from "react";
import { DashboardStats } from "@/shared/types";
import { Users, Bed, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/dashboard/stats", { credentials: "include" });
      if (!response.ok) {
        setStats({
          total_employees: 0,
          active_employees: 0,
          total_beds: 0,
          occupied_beds: 0,
          available_beds: 0,
          employees_by_function: [],
        });
        return;
      }
      const data = (await response.json()) as { stats: DashboardStats };
      setStats(data?.stats || null);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Total de Funcionários",
      value: stats?.total_employees || 0,
      icon: Users,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Funcionários Ativos",
      value: stats?.active_employees || 0,
      icon: CheckCircle,
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
      label: "Camas Disponíveis",
      value: stats?.available_beds || 0,
      icon: XCircle,
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-500/10",
    },
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
                <card.icon className={`w-6 h-6 bg-gradient-to-r ${card.color} bg-clip-text text-transparent`} />
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
