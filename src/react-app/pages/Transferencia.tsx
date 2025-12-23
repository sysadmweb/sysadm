import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Employee, Unit, Function } from "@/shared/types";
import { Users, CalendarClock, Loader2, Search, CheckSquare, X } from "lucide-react";

export default function Transferencia() {
  const { user: currentUser } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [functions, setFunctions] = useState<Function[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const [transferDate, setTransferDate] = useState("");
  const [transferTime, setTransferTime] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [targetUnitId, setTargetUnitId] = useState<number | "">("");
  const [transferObservation, setTransferObservation] = useState("");

  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [functionFilter, setFunctionFilter] = useState<number | "">("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);
  type TransferLog = { id: number; name: string; fromUnit: string; toUnit: string; dateTime: string; observation: string };
  const [dbTransferLogs, setDbTransferLogs] = useState<TransferLog[]>([]);

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
          const { data: links } = await supabase
            .from("user_units")
            .select("unit_id")
            .eq("user_id", currentUser.id);
          unitIds = Array.isArray(links) ? (links as { unit_id: number }[]).map((l) => l.unit_id) : [];
        }

        const [unitsRes, employeesRes, functionsRes] = await Promise.all([
          supabase.from("units").select("id, name").eq("is_active", true),
          supabase
            .from("employees")
            .select("id, full_name, unit_id, arrival_date, departure_date, status_id, observation, function_id")
            .eq("is_active", true)
            .order("full_name"),
          supabase.from("functions").select("id, name").eq("is_active", true)
        ]);

        if (unitsRes.error) throw unitsRes.error;
        if (employeesRes.error) throw employeesRes.error;
        if (functionsRes.error) throw functionsRes.error;

        let unitsData = (unitsRes.data || []) as Unit[];
        let employeesData = (employeesRes.data || []) as Employee[];
        let functionsData = (functionsRes.data || []) as Function[];

        if (!isSuper && unitIds.length > 0) {
          employeesData = employeesData.filter(e => unitIds.includes(e.unit_id));
          // Unidades: sempre listar todas as ativas para destino
        } else if (!isSuper && unitIds.length === 0) {
          employeesData = [];
          // Unidades: sempre listar todas as ativas para destino
        }

        const activeEmployees = employeesData.filter(e => e.arrival_date && !e.departure_date);
        setUnits(unitsData);
        setEmployees(activeEmployees);
        setFunctions(functionsData);
      } catch (error) {
        console.error("Error loading transfer data:", error);
        showToast("Falha ao carregar dados", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    fetchTransferHistory();
  }, [currentUser]);

  const displayedEmployees = useMemo(() => {
    const term = (searchTerm || "").toUpperCase();
    return employees.filter((e) => {
      const nameMatch = (e.full_name || "").toUpperCase().includes(term);
      const functionMatch = functionFilter === "" || e.function_id === functionFilter;
      return nameMatch && functionMatch;
    });
  }, [employees, searchTerm, functionFilter]);

  const fetchTransferHistory = async () => {
    try {
      // First, get all statuses that start with "TRANSFERIDO PARA"
      const { data: statuses } = await supabase
        .from("statuses")
        .select("id, name")
        .eq("is_active", true)
        .ilike("name", "TRANSFERIDO PARA%");

      if (!statuses || statuses.length === 0) {
        setDbTransferLogs([]);
        return;
      }

      const transferStatusIds = statuses.map((s: any) => s.id);
      const statusMap = new Map<number, string>();
      statuses.forEach((s: any) => statusMap.set(s.id, s.name));

      // Fetch employees with transfer status and departure_date
      const { data: employeesData } = await supabase
        .from("employees")
        .select("id, full_name, unit_id, departure_date, status_id, observation, transferred_to_unit_id")
        .eq("is_active", true)
        .in("status_id", transferStatusIds)
        .not("departure_date", "is", null)
        .order("departure_date", { ascending: false });

      const { data: unitsData } = await supabase
        .from("units")
        .select("id, name")
        .eq("is_active", true);

      const unitMap = new Map<number, string>();
      (unitsData || []).forEach((u: any) => unitMap.set(u.id, u.name));

      const logs: TransferLog[] = (employeesData || []).map((e: any) => {
        const toStatus = statusMap.get(e.status_id) || "";
        const toUnit = toStatus.replace(/^TRANSFERIDO PARA\s*/, "");
        const obs: string = e.observation || "";
        let fromUnit = unitMap.get(e.unit_id) || "-";

        // Try to extract fromUnit from observation
        const m = obs.match(/DE\s+(.+?)\s+PARA\s+(.+?)(\s|$)/i);
        if (m && m[1]) fromUnit = m[1];

        const dt = e.departure_date ? new Date(e.departure_date).toLocaleString("pt-BR", { timeZone: "UTC" }) : "-";
        return { id: e.id, name: e.full_name, fromUnit, toUnit, dateTime: dt, observation: obs };
      });

      setDbTransferLogs(logs);
    } catch (error) {
      console.error("Error fetching transfer history:", error);
    }
  };

  const toggleEmployee = (id: number) => {
    setSelectedEmployeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => setSelectedEmployeeIds(displayedEmployees.map((e) => e.id));
  const clearAll = () => setSelectedEmployeeIds([]);

  const ensureTransferStatus = async (unitName: string) => {
    const statusName = `TRANSFERIDO PARA ${unitName}`;
    const { data: found } = await supabase.from("statuses").select("id").eq("name", statusName).single();
    if (found?.id) return found.id as number;
    const { data, error } = await supabase.from("statuses").insert({ name: statusName, is_active: true }).select("id").single();
    if (error || !data) throw error || new Error("Falha ao criar status de transferência");
    return (data as { id: number }).id;
  };

  const handleTransfer = async () => {
    if (!transferDate || !transferTime || !arrivalDate || !arrivalTime || !targetUnitId || selectedEmployeeIds.length === 0) {
      showToast("Preencha data/hora de saída, data/hora de chegada, unidade e selecione colaboradores", "error");
      return;
    }
    setLoadingAction(true);
    try {
      const unit = units.find((u) => u.id === targetUnitId);
      if (!unit) throw new Error("Unidade destino inválida");
      const statusId = await ensureTransferStatus(unit.name);
      const departureIso = new Date(`${transferDate}T${transferTime}:00`).toISOString();
      const arrivalIso = new Date(`${arrivalDate}T${arrivalTime}:00`).toISOString();
      const updates = selectedEmployeeIds.map(async (empId) => {
        const emp = employees.find((e) => e.id === empId);
        if (!emp) return;
        const fromUnit = units.find((u) => u.id === emp.unit_id)?.name || "-";
        const toUnit = unit.name;
        const fmtDateTime = new Date(`${transferDate}T${transferTime}:00`).toLocaleString("pt-BR");
        const prevObs = (emp as any).observation ? String((emp as any).observation) : "";
        const addition = `TRANSFERÊNCIA EM ${fmtDateTime} DE ${fromUnit} PARA ${toUnit}${transferObservation ? ` | OBS: ${transferObservation.toUpperCase()}` : ""}`;
        const newObs = [prevObs.toUpperCase(), addition].filter(Boolean).join(" | ");
        const { error: upError } = await supabase
          .from("employees")
          .update({
            unit_id: targetUnitId as number,
            departure_date: departureIso,
            status_id: statusId,
            accommodation_id: null,
            observation: newObs,
            transferred_to_unit_id: targetUnitId as number,
            transferred_arrival_date: arrivalIso
          })
          .eq("id", empId);
        if (upError) throw upError;
        setDbTransferLogs((prev: TransferLog[]) => [{ id: empId, name: emp.full_name, fromUnit, toUnit, dateTime: fmtDateTime, observation: transferObservation }, ...prev]);
      });
      await Promise.all(updates);
      showToast("Transferência realizada", "success");
      setSelectedEmployeeIds([]);
      fetchTransferHistory();
    } catch (error) {
      console.error("Transfer error:", error);
      showToast("Falha ao transferir colaboradores", "error");
    } finally {
      setLoadingAction(false);
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
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"}`}>
          {toast.text}
        </div>
      )}

      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Transferência</h1>
        <p className="text-sm md:text-base text-slate-400 mt-1">Transfira colaboradores entre unidades</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Data de Saída</label>
          <input
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Hora de Saída</label>
          <input
            type="time"
            value={transferTime}
            onChange={(e) => setTransferTime(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Data de Chegada</label>
          <input
            type="date"
            value={arrivalDate}
            onChange={(e) => setArrivalDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Hora de Chegada</label>
          <input
            type="time"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Unidade de Destino</label>
        <select
          value={targetUnitId}
          onChange={(e) => setTargetUnitId(e.target.value ? parseInt(e.target.value) : "")}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          required
        >
          <option value="">Selecione</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Observação da Transferência</label>
        <textarea
          value={transferObservation}
          onChange={(e) => setTransferObservation(e.target.value)}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          rows={3}
          placeholder="Ex.: motivo, responsável, observações"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowEmployeesModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-all"
        >
          <Users className="w-5 h-5 text-blue-400" />
          Selecionar Colaboradores ({selectedEmployeeIds.length})
        </button>
        <button
          type="button"
          onClick={handleTransfer}
          disabled={loadingAction}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50"
        >
          {loadingAction ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarClock className="w-5 h-5" />}
          <span className="ml-2">Transferir</span>
        </button>
      </div>

      {
        showEmployeesModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-100">Selecionar Colaboradores</h2>
                <button onClick={() => setShowEmployeesModal(false)} className="p-2 text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Buscar por nome"
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-400 mb-1">Filtrar por Função</label>
                <select
                  value={functionFilter}
                  onChange={(e) => setFunctionFilter(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Todas as funções</option>
                  {functions.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <button onClick={selectAll} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-all flex items-center gap-2"><CheckSquare className="w-4 h-4" /> Selecionar todos</button>
                <button onClick={clearAll} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-all">Limpar</button>
              </div>
              <div className="overflow-y-auto max-h-80 space-y-2">
                {displayedEmployees.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">Nenhum colaborador encontrado.</div>
                ) : (
                  displayedEmployees.map((emp) => (
                    <label key={emp.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedEmployeeIds.includes(emp.id) ? "bg-blue-500/10 border-blue-500/50" : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"}`}>
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                        className="accent-blue-500"
                      />
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-slate-200 text-sm">{emp.full_name}</span>
                      <span className="ml-auto text-xs text-slate-400">{units.find((u) => u.id === emp.unit_id)?.name || "-"}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEmployeesModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmployeesModal(false)}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                >
                  Confirmar Seleção
                </button>
              </div>
            </div>
          </div>
        )
      }
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl mt-6">
        <div className="p-4 border-b border-slate-700/50">
          <h2 className="text-lg font-bold text-slate-100">Transferências</h2>
          <p className="text-slate-400 text-sm">Últimas transferências registradas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Data/Hora</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Colaborador</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">De</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Para</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {dbTransferLogs.length === 0 ? (
                <tr>
                  <td className="px-6 py-3 text-slate-400" colSpan={5}>Nenhuma transferência encontrada.</td>
                </tr>
              ) : (
                dbTransferLogs.map((log) => (
                  <tr key={`${log.id}-${log.dateTime}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3 text-slate-200 font-mono text-sm">{log.dateTime}</td>
                    <td className="px-6 py-3 text-slate-200">{log.name}</td>
                    <td className="px-6 py-3 text-slate-400">{log.fromUnit}</td>
                    <td className="px-6 py-3 text-slate-400">{log.toUnit}</td>
                    <td className="px-6 py-3 text-slate-400">{log.observation || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div >
  );
}
