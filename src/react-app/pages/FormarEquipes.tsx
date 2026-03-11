import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Employee } from "@/shared/types";
import { Search, Users, Loader2, CheckSquare, Clock, ShieldCheck, Save } from "lucide-react";

interface ExtendedEmployee extends Employee {
  category: string | null;
  function_name: string | null;
}

export default function FormarEquipe() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<ExtendedEmployee[]>([]);
  const [statuses, setStatuses] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterShift, setFilterShift] = useState<string>("TODOS");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [updating, setUpdating] = useState(false);
  const [teamInput, setTeamInput] = useState("");
  const [sortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

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

        const [employeesRes, statusRes] = await Promise.all([
          supabase
            .from("funcionarios")
            .select("id, full_name, unit_id, status_id, arrival_date, is_active, shift, team, funcoes(name, type)")
            .eq("is_active", true)
            .order("full_name"),
          supabase.from("status").select("id, name")
        ]);

        if (employeesRes.error) throw employeesRes.error;
        if (statusRes.error) throw statusRes.error;

        setStatuses(statusRes.data || []);

        let filteredEmps = (employeesRes.data || []) as any[];

        if (!isSuper) {
          if (unitIds.length > 0) {
            filteredEmps = filteredEmps.filter((e) => unitIds.includes(e.unit_id));
          } else {
            filteredEmps = [];
          }
        }

        const formattedEmps = filteredEmps.map((e) => ({
          ...e,
          category: e.funcoes?.type || null,
          function_name: e.funcoes?.name || null,
        }));

        setEmployees(formattedEmps as any[]);

      } catch (error) {
        console.error("Formar Equipe page load error:", error);
        showToast("Falha ao carregar dados", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const inactiveStatusId = useMemo(() => statuses.find(s => s.name === "INATIVO")?.id, [statuses]);

  const { activeEmployees, inactiveEmployees } = useMemo(() => {
    const term = (searchTerm || "").toUpperCase();
    const filtered = employees.filter((e) => {
      const nameOk = (e.full_name || "").toUpperCase().includes(term);
      const isShiftOk = filterShift === "TODOS" || e.shift === filterShift;
      return nameOk && isShiftOk;
    });

    if (sortConfig !== null) {
      filtered.sort((a: any, b: any) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return {
      activeEmployees: filtered.filter(e => e.status_id !== inactiveStatusId),
      inactiveEmployees: filtered.filter(e => e.status_id === inactiveStatusId)
    };
  }, [employees, searchTerm, filterShift, sortConfig, inactiveStatusId]);

  const toggle = (id: number) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAll = () => setSelectedIds(activeEmployees.map((e) => e.id));
  const clearAll = () => setSelectedIds([]);

  const allUniqueTeams = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.team || "Sem Equipe"))).sort();
  }, [employees]);

  const updateShift = async (shift: string) => {
    if (selectedIds.length === 0) {
      showToast("Selecione pelo menos um colaborador", "error");
      return;
    }
    setUpdating(true);
    try {
      const { error } = await supabase.from("funcionarios").update({ shift }).in("id", selectedIds);
      if (error) throw error;
      setEmployees((prev) => prev.map((e) => (selectedIds.includes(e.id) ? { ...e, shift } : e)));
      showToast("Turno atualizado", "success");
      clearAll();
    } catch (error) {
      console.error("Shift update error:", error);
      showToast("Falha ao atualizar turno", "error");
    } finally {
      setUpdating(false);
    }
  };

  const updateTeam = async () => {
    if (selectedIds.length === 0) {
      showToast("Selecione pelo menos um colaborador", "error");
      return;
    }
    if (!teamInput.trim()) {
      showToast("Insira o nome da equipe", "error");
      return;
    }
    setUpdating(true);
    try {
      const team = teamInput.trim().toUpperCase();
      const { error } = await supabase.from("funcionarios").update({ team }).in("id", selectedIds);
      if (error) throw error;
      setEmployees((prev) => prev.map((e) => (selectedIds.includes(e.id) ? { ...e, team } : e)));
      showToast("Equipe atualizada", "success");
      setTeamInput("");
      clearAll();
    } catch (error) {
      console.error("Team update error:", error);
      showToast("Falha ao atualizar equipe", "error");
    } finally {
      setUpdating(false);
    }
  };

  const clearTeam = async () => {
    if (selectedIds.length === 0) {
      showToast("Selecione pelo menos um colaborador", "error");
      return;
    }
    setUpdating(true);
    try {
      const { error } = await supabase.from("funcionarios").update({ team: null }).in("id", selectedIds);
      if (error) throw error;
      setEmployees((prev) => prev.map((e) => (selectedIds.includes(e.id) ? { ...e, team: null } : e)));
      showToast("Equipe removida", "success");
      clearAll();
    } catch (error) {
      console.error("Team clear error:", error);
      showToast("Falha ao remover equipe", "error");
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Formar Equipe</h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie os turnos e equipes dos colaboradores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Section - Employee List */}
        <div className="lg:col-span-3 space-y-4">
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

          {/* Filter Buttons */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {["MANHÃ", "NOITE", "TODOS"].map((shift) => (
                <button
                  key={shift}
                  onClick={() => setFilterShift(shift)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${filterShift === shift
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50"
                    : "bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700"
                    }`}
                >
                  {shift}: {shift === "TODOS" ? employees.length : employees.filter(e => e.shift === shift).length}
                </button>
              ))}
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

          {/* Active Employees Table */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 px-2">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              Funcionários Ativos
              <span className="text-xs font-normal text-slate-500 ml-2">({activeEmployees.length})</span>
            </h2>
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50 border-b border-slate-700/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">Colaborador</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">Cat.</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">Função</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">Turno</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">Equipe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {activeEmployees.map((e) => (
                      <tr key={e.id} className={`hover:bg-slate-800/30 transition-colors ${selectedIds.includes(e.id) ? 'bg-blue-500/5' : ''}`}>
                        <td className="px-4 py-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" className="accent-blue-500 w-4 h-4 rounded" checked={selectedIds.includes(e.id)} onChange={() => toggle(e.id)} />
                            <span className="text-slate-200 font-medium text-sm">{e.full_name}</span>
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded border ${e.category === 'MOD' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-purple-500/10 border-purple-500/30 text-purple-400'}`}>
                            {e.category || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{e.function_name || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-[11px] font-bold border ${e.shift === 'MANHÃ' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                            e.shift === 'NOITE' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                              'bg-slate-500/10 border-slate-500/30 text-slate-500'}`}>
                            {e.shift || "NÃO DEF."}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {e.team ? (
                            <span className="text-blue-400 font-bold text-sm tracking-wider uppercase">{e.team}</span>
                          ) : (
                            <span className="text-slate-600 text-xs italic">Sem Equipe</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {activeEmployees.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-500 font-medium">Nenhum colaborador ativo encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Inactive Employees Table */}
          <div className="space-y-4 pt-4">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 px-2">
              <ShieldCheck className="w-5 h-5 text-red-400" />
              Funcionários Desativados
              <span className="text-xs font-normal text-slate-500 ml-2">({inactiveEmployees.length})</span>
            </h2>
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50 border-b border-slate-700/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">Colaborador</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">Cat.</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">Função</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">Equipe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30 text-slate-500">
                    {inactiveEmployees.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-800/20 transition-colors grayscale opacity-60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 font-medium text-sm line-through">{e.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-1 rounded border border-slate-700 text-slate-500">
                            {e.category || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-sm">{e.function_name || "-"}</td>
                        <td className="px-4 py-3">
                          {e.team ? (
                            <span className="text-slate-600 font-bold text-sm tracking-wider uppercase">{e.team}</span>
                          ) : (
                            <span className="text-slate-600 text-xs italic">Sem Equipe</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {inactiveEmployees.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-600 italic">Nenhum funcionário desativado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Shift Management */}
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Atribuir Turno
            </h3>
            <p className="text-xs text-slate-500 italic">Selecione colaboradores na lista e escolha o turno.</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => updateShift("MANHÃ")}
                disabled={updating || selectedIds.length === 0}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-orange-500/10 border border-slate-700 hover:border-orange-500/50 rounded-xl transition-all group disabled:opacity-50"
              >
                <span className="text-slate-300 group-hover:text-orange-400 font-bold uppercase tracking-wider text-sm">Manhã</span>
                <Clock className="w-4 h-4 text-slate-500 group-hover:text-orange-400" />
              </button>
              <button
                onClick={() => updateShift("NOITE")}
                disabled={updating || selectedIds.length === 0}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-blue-500/10 border border-slate-700 hover:border-blue-500/50 rounded-xl transition-all group disabled:opacity-50"
              >
                <span className="text-slate-300 group-hover:text-blue-400 font-bold uppercase tracking-wider text-sm">Noite</span>
                <Clock className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
              </button>
            </div>
          </div>

          {/* Team Management */}
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Atribuir Equipe
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={teamInput}
                onChange={(e) => setTeamInput(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Ex: Equipe 1, Equipe A..."
              />
              <button
                onClick={updateTeam}
                disabled={updating || selectedIds.length === 0 || !teamInput.trim()}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> ATRIBUIR EQUIPE
              </button>
              <button
                onClick={clearTeam}
                disabled={updating || selectedIds.length === 0}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 font-bold rounded-xl transition-all disabled:opacity-50"
              >
                REMOVER EQUIPE
              </button>
            </div>
          </div>

          {/* Stat Card */}
          <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-xl rounded-xl border border-blue-500/20 p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wider">Equipes Ativas</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Total de Equipes:</span>
                <span className="text-blue-400 font-bold">{allUniqueTeams.filter(t => t !== "Sem Equipe").length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Sem Equipe:</span>
                <span className="text-red-400 font-bold">{employees.filter(e => !e.team).length}</span>
              </div>
              <div className="pt-3 border-t border-slate-700/50">
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Resumo por Turno</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="text-[10px] text-orange-400 font-bold">MANHÃ</p>
                    <p className="text-lg font-black text-slate-200">{employees.filter(e => e.shift === "MANHÃ").length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-blue-400 font-bold">NOITE</p>
                    <p className="text-lg font-black text-slate-200">{employees.filter(e => e.shift === "NOITE").length}</p>
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
