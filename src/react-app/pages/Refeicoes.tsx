import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Employee, Status } from "@/shared/types";
import { Search, Utensils, Loader2, CheckSquare, CreditCard, ChevronUp, ChevronDown, Filter, X } from "lucide-react";

// Calendar Component
function WorkDaysCalendar() {
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const saved = localStorage.getItem("workDays");
    if (saved) setSelectedDays(JSON.parse(saved));
  }, []);

  const toggleDay = (dateStr: string) => {
    const updated = selectedDays.includes(dateStr)
      ? selectedDays.filter((d) => d !== dateStr)
      : [...selectedDays, dateStr];
    setSelectedDays(updated);
    localStorage.setItem("workDays", JSON.stringify(updated));
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: { date: Date | null; dateStr: string }[] = [];

    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null, dateStr: "" });
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({ date, dateStr });
    }

    return days;
  };

  const changeMonth = (delta: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + delta);
    setCurrentMonth(newMonth);
  };

  const days = getDaysInMonth();
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100">Dias Trabalhado</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => changeMonth(-1)}
            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 transition-all"
          >
            ‹
          </button>
          <span className="text-slate-200 font-medium">
            {currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 transition-all"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-slate-400 py-2">
            {day}
          </div>
        ))}
        {days.map((day, idx) => (
          <button
            key={idx}
            onClick={() => day.date && toggleDay(day.dateStr)}
            disabled={!day.date}
            className={`aspect-square flex items-center justify-center text-sm rounded transition-all
              ${!day.date ? "invisible" : ""}
              ${selectedDays.includes(day.dateStr)
                ? "bg-green-500 text-white font-semibold hover:bg-green-600"
                : "bg-slate-800/50 text-slate-300 hover:bg-slate-700 border border-slate-700/50"
              }`}
          >
            {day.date?.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ExtendedEmployee extends Employee {
  category: string | null;
  function_name: string | null;
}

export default function Refeicoes() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<ExtendedEmployee[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "obra" | "alojamento" | "movimentacao">("todos");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [updating, setUpdating] = useState(false);
  const [mealConfig, setMealConfig] = useState({ targetDays: 0, stock: 0 });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const [isFunctionFilterOpen, setIsFunctionFilterOpen] = useState(false);
  const [selectedMealStatuses, setSelectedMealStatuses] = useState<number[]>([]);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);

  const showToast = (text: string, kind: "success" | "error") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const isSuper = currentUser?.is_super_user;
        let unitIds: number[] = [];
        if (!isSuper && currentUser?.id) {
          const { data: links } = await supabase.from("usuarios_unidades").select("unit_id").eq("user_id", currentUser.id);
          unitIds = Array.isArray(links) ? (links as { unit_id: number }[]).map((l) => l.unit_id) : [];
        }

        const [statusesRes, employeesRes, configRes] = await Promise.all([
          supabase.from("status").select("id, name, is_active"),
          supabase
            .from("funcionarios")
            .select("id, full_name, unit_id, status_id, refeicao_status_id, arrival_date, is_active, funcoes(name, type)")
            .eq("is_active", true)
            .order("full_name"),
          supabase.from("config").select("*"),
        ]);

        if (statusesRes.error) throw statusesRes.error;
        if (employeesRes.error) throw employeesRes.error;
        if (configRes.error) throw configRes.error;

        const configData = (configRes.data || []) as { key: string; value: string }[];
        const targetDays = Number(configData.find((c) => c.key === "meal_target_days")?.value || 0);
        const stock = Number(configData.find((c) => c.key === "meal_stock")?.value || 0);
        setMealConfig({ targetDays, stock });

        const sts = (statusesRes.data || []) as Status[];
        const inactiveId = sts.find((s) => s.name.toUpperCase() === "INATIVO")?.id;

        let filteredEmps = (employeesRes.data || []) as any[];

        // Filter by unit
        if (!isSuper) {
          if (unitIds.length > 0) {
            filteredEmps = filteredEmps.filter((e) => unitIds.includes(e.unit_id));
          } else {
            filteredEmps = [];
          }
        }

        // Filter inactive
        if (inactiveId) {
          filteredEmps = filteredEmps.filter((e) => e.status_id !== inactiveId);
        }

        const formattedEmps = filteredEmps.map((e) => ({
          ...e,
          category: e.funcoes?.type || null,
          function_name: e.funcoes?.name || null,
        }));

        setStatuses(sts);
        setEmployees(formattedEmps as any[]);

        // Initialize function filter with all unique functions
        const uniqueFuncs = Array.from(new Set(formattedEmps.map(e => e.function_name || "Sem Função")));
        setSelectedFunctions(uniqueFuncs);

        // Initialize meal status filter with all available statuses
        setSelectedMealStatuses(sts.map(s => s.id));
      } catch (error) {
        console.error("Meals page load error:", error);
        showToast("Falha ao carregar dados", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const obraStatusId = useMemo(() => statuses.find((s) => s.name.toUpperCase() === "OBRA")?.id || null, [statuses]);
  const alojStatusId = useMemo(() => statuses.find((s) => s.name.toUpperCase() === "ALOJAMENTO")?.id || null, [statuses]);
  const movimentacaoStatusId = useMemo(() => statuses.find((s) => s.name.toUpperCase().includes("MOVIMENTA"))?.id || null, [statuses]);

  const displayed = useMemo(() => {
    const term = (searchTerm || "").toUpperCase();
    let result = employees.filter((e) => {
      const nameOk = (e.full_name || "").toUpperCase().includes(term);
      const isStatusOk = filterStatus === "todos" ||
        (filterStatus === "obra" && e.refeicao_status_id === obraStatusId) ||
        (filterStatus === "alojamento" && e.refeicao_status_id === alojStatusId) ||
        (filterStatus === "movimentacao" && e.refeicao_status_id === movimentacaoStatusId);

      const funcName = e.function_name || "Sem Função";
      const isFuncOk = selectedFunctions.length === 0 || selectedFunctions.includes(funcName);

      const isMealStatusOk = selectedMealStatuses.length === 0 || selectedMealStatuses.includes(e.refeicao_status_id);

      return nameOk && isStatusOk && isFuncOk && isMealStatusOk;
    });

    if (sortConfig !== null) {
      result.sort((a: any, b: any) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null) return 1;
        if (bValue === null) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [employees, searchTerm, filterStatus, obraStatusId, alojStatusId, sortConfig, selectedFunctions, selectedMealStatuses]);

  const obraCount = useMemo(() => employees.filter((e) => e.refeicao_status_id === obraStatusId).length, [employees, obraStatusId]);
  const alojCount = useMemo(() => employees.filter((e) => e.refeicao_status_id === alojStatusId).length, [employees, alojStatusId]);
  const movimentacaoCount = useMemo(() => employees.filter((e) => e.refeicao_status_id === movimentacaoStatusId).length, [employees, movimentacaoStatusId]);

  const toggle = (id: number) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAll = () => setSelectedIds(displayed.map((e) => e.id));
  const clearAll = () => setSelectedIds([]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const allUniqueFunctions = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.function_name || "Sem Função"))).sort();
  }, [employees]);

  const toggleFunctionFilter = (func: string) => {
    setSelectedFunctions(prev =>
      prev.includes(func) ? prev.filter(f => f !== func) : [...prev, func]
    );
  };

  const toggleAllFunctions = () => {
    if (selectedFunctions.length === allUniqueFunctions.length) {
      setSelectedFunctions([]);
    } else {
      setSelectedFunctions(allUniqueFunctions);
    }
  };

  const toggleMealStatusFilter = (statusId: number) => {
    setSelectedMealStatuses(prev =>
      prev.includes(statusId) ? prev.filter(id => id !== statusId) : [...prev, statusId]
    );
  };

  const toggleAllMealStatuses = () => {
    if (selectedMealStatuses.length === statuses.length) {
      setSelectedMealStatuses([]);
    } else {
      setSelectedMealStatuses(statuses.map(s => s.id));
    }
  };

  const setMealStatus = async (target: "obra" | "alojamento" | "movimentacao") => {
    if (selectedIds.length === 0) {
      showToast("Selecione pelo menos um colaborador", "error");
      return;
    }
    const targetId = target === "obra" ? obraStatusId : target === "alojamento" ? alojStatusId : movimentacaoStatusId;
    if (!targetId) {
      showToast("Status não encontrado", "error");
      return;
    }
    setUpdating(true);
    try {
      const { error } = await supabase.from("funcionarios").update({ refeicao_status_id: targetId }).in("id", selectedIds);
      if (error) throw error;
      setEmployees((prev) => prev.map((e) => (selectedIds.includes(e.id) ? { ...e, refeicao_status_id: targetId } : e)));
      showToast("Atualizado", "success");
      clearAll();
    } catch (error) {
      console.error("Meal status update error:", error);
      showToast("Falha ao atualizar", "error");
    } finally {
      setUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-2 rounded-lg shadow-lg ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"}`}>
          {toast.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Refeição</h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie o status de refeição</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Section - Employee List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search Bar */}
          <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700 w-full">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
              className="bg-transparent border-none text-slate-200 placeholder-slate-500 focus:outline-none w-full"
              placeholder="Buscar por nome"
            />
          </div>

          {/* Filter Buttons and Action Buttons on Same Row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterStatus("todos")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${filterStatus === "todos"
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50"
                  : "bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
              >
                TODOS: {employees.length}
              </button>
              <button
                onClick={() => setFilterStatus("obra")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${filterStatus === "obra"
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50"
                  : "bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
              >
                OBRA: {obraCount}
              </button>
              <button
                onClick={() => setFilterStatus("alojamento")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${filterStatus === "alojamento"
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50"
                  : "bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
              >
                ALOJAMENTO: {alojCount}
              </button>
              <button
                onClick={() => setFilterStatus("movimentacao")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${filterStatus === "movimentacao"
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50"
                  : "bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
              >
                MOVIMENTAÇÃO: {movimentacaoCount}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-all flex items-center gap-2 text-sm">
                <CheckSquare className="w-4 h-4" /> Selecionar todos
              </button>
              <button onClick={clearAll} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-all text-sm">
                Limpar
              </button>
            </div>
          </div>

          {/* Table - Desktop */}
          <div className="hidden md:block bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-4 text-left text-sm font-semibold text-slate-300">Nome</th>
                    <th className="px-3 py-4 text-left text-sm font-semibold text-slate-300">Cat.</th>
                    <th className="px-3 py-4 text-left text-sm font-semibold text-slate-300">
                      <div className="flex items-center gap-2 relative">
                        Função
                        <button
                          onClick={() => setIsFunctionFilterOpen(!isFunctionFilterOpen)}
                          className={`p-1 rounded hover:bg-slate-700 transition-colors ${selectedFunctions.length !== allUniqueFunctions.length ? 'text-blue-400' : 'text-slate-400'}`}
                        >
                          <Filter className="w-3.5 h-3.5" />
                        </button>

                        {isFunctionFilterOpen && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setIsFunctionFilterOpen(false)} />
                            <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
                              <div className="p-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
                                <span className="text-xs font-bold text-slate-300 uppercase">Filtrar Funções</span>
                                <button onClick={() => setIsFunctionFilterOpen(false)} className="text-slate-500 hover:text-slate-300">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                                <label className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group">
                                  <input
                                    type="checkbox"
                                    className="accent-blue-500"
                                    checked={selectedFunctions.length === allUniqueFunctions.length}
                                    onChange={toggleAllFunctions}
                                  />
                                  <span className="text-xs text-slate-200 font-medium group-hover:text-blue-400">(Selecionar Tudo)</span>
                                </label>
                                <div className="h-px bg-slate-700 my-1 mx-2" />
                                {allUniqueFunctions.map(func => (
                                  <label key={func} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group">
                                    <input
                                      type="checkbox"
                                      className="accent-blue-500"
                                      checked={selectedFunctions.includes(func)}
                                      onChange={() => toggleFunctionFilter(func)}
                                    />
                                    <span className="text-xs text-slate-300 group-hover:text-slate-100">{func}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-3 py-4 text-left text-sm font-semibold text-slate-300 cursor-pointer hover:text-blue-400 transition-colors"
                      onClick={() => requestSort('arrival_date')}
                    >
                      <div className="flex items-center gap-1">
                        Chegada
                        {sortConfig?.key === 'arrival_date' && (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-4 text-left text-sm font-semibold text-slate-300">
                      <div className="flex items-center gap-2 relative">
                        Status Refeição
                        <button
                          onClick={() => setIsStatusFilterOpen(!isStatusFilterOpen)}
                          className={`p-1 rounded hover:bg-slate-700 transition-colors ${selectedMealStatuses.length !== statuses.length ? 'text-blue-400' : 'text-slate-400'}`}
                        >
                          <Filter className="w-3.5 h-3.5" />
                        </button>

                        {isStatusFilterOpen && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setIsStatusFilterOpen(false)} />
                            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden text-left">
                              <div className="p-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
                                <span className="text-xs font-bold text-slate-300 uppercase">Filtrar Status</span>
                                <button onClick={() => setIsStatusFilterOpen(false)} className="text-slate-500 hover:text-slate-300">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                                <label className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group">
                                  <input
                                    type="checkbox"
                                    className="accent-blue-500"
                                    checked={selectedMealStatuses.length === statuses.length}
                                    onChange={toggleAllMealStatuses}
                                  />
                                  <span className="text-xs text-slate-200 font-medium group-hover:text-blue-400">(Selecionar Tudo)</span>
                                </label>
                                <div className="h-px bg-slate-700 my-1 mx-2" />
                                {statuses.map(status => (
                                  <label key={status.id} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group">
                                    <input
                                      type="checkbox"
                                      className="accent-blue-500"
                                      checked={selectedMealStatuses.includes(status.id)}
                                      onChange={() => toggleMealStatusFilter(status.id)}
                                    />
                                    <span className="text-xs text-slate-300 group-hover:text-slate-100">{status.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-3 text-slate-200">
                        <label className="inline-flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" className="accent-blue-500" checked={selectedIds.includes(e.id)} onChange={() => toggle(e.id)} />
                          <span>{e.full_name}</span>
                        </label>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${e.category === 'MOD' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-purple-500/10 border-purple-500/30 text-purple-400'}`}>
                          {e.category || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-400 text-sm">{e.function_name || "-"}</td>
                      <td className="px-3 py-3 text-slate-400 text-sm">
                        {e.arrival_date ? new Date(e.arrival_date + 'T00:00:00').toLocaleDateString('pt-BR') : "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-300">{statuses.find((s) => s.id === e.refeicao_status_id)?.name || "-"}</td>
                    </tr>
                  ))}
                  {displayed.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-slate-400" colSpan={2}>Nenhum colaborador encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile List */}
          <div className="md:hidden space-y-2 max-h-[420px] overflow-y-auto">
            {displayed.map((e: any) => (
              <label key={e.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedIds.includes(e.id) ? "bg-blue-500/10 border-blue-500/50" : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"}`}>
                <input type="checkbox" className="accent-blue-500" checked={selectedIds.includes(e.id)} onChange={() => toggle(e.id)} />
                <Utensils className="w-4 h-4 text-blue-400" />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-slate-200 text-sm font-medium">{e.full_name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${e.category === 'MOD' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-purple-500/10 border-purple-500/30 text-purple-400'}`}>
                      {e.category || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">{e.function_name || "-"}</span>
                    <span className="text-slate-500">{e.arrival_date ? new Date(e.arrival_date + 'T00:00:00').toLocaleDateString('pt-BR') : "-"}</span>
                  </div>
                  <div className="text-blue-400 font-bold text-[10px] mt-1">{statuses.find((s) => s.id === e.refeicao_status_id)?.name || "-"}</div>
                </div>
              </label>
            ))}
            {displayed.length === 0 && <div className="text-center py-8 text-slate-500 font-medium bg-slate-800/20 rounded-xl border border-dashed border-slate-700">Nenhum colaborador encontrado com os filtros atuais.</div>}
          </div>

          {/* Action Buttons Bottom */}
          <div className="flex items-center gap-3 sticky bottom-0 bg-slate-900/60 backdrop-blur-sm py-3">
            <button
              type="button"
              onClick={() => setMealStatus("obra")}
              disabled={updating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
            >
              OBRA
            </button>
            <button
              type="button"
              onClick={() => setMealStatus("alojamento")}
              disabled={updating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              ALOJAMENTO
            </button>
            <button
              type="button"
              onClick={() => setMealStatus("movimentacao")}
              disabled={updating}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all disabled:opacity-50"
            >
              MOVIMENTAÇÃO
            </button>
          </div>
        </div>

        {/* Right Section - Calendar */}

        <div className="lg:col-span-1 space-y-6">
          <WorkDaysCalendar />

          {/* Meal Calculation Card */}
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <CreditCard className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Projeção de Vales</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">Funcionários Ativos</p>
                  <p className="text-xl font-bold text-slate-200">{employees.length}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">Estoque Atual</p>
                  <p className="text-xl font-bold text-blue-400">{mealConfig.stock}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-400">Dias de Cobertura:</span>
                  <span className={`font-bold ${(mealConfig.stock / (employees.length || 1)) < 5 ? "text-red-400" : "text-green-400"
                    }`}>
                    {Math.floor(mealConfig.stock / (employees.length || 1))} dias
                  </span>
                </div>
                {/* Calculation: Needed = (TargetDays * DailyUsage) - Stock */}
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Necessário Comprar</p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold text-slate-100">
                      {Math.max(0, (mealConfig.targetDays * employees.length) - mealConfig.stock)}
                    </p>
                    <span className="text-xs text-slate-500 mb-1">
                      para atingir {mealConfig.targetDays} dias
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
