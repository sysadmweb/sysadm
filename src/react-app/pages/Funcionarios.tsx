import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  UserCircle,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

import { Employee, Unit, Status, Function, Accommodation } from "../../shared/types";

export default function Funcionarios() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [functions, setFunctions] = useState<Function[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<keyof Employee | "unit" | "status" | "function" | "accommodation">("full_name");
  const [sortAsc, setSortAsc] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    arrival_date: "",
    departure_date: "",
    integration_date: "",
    observation: "",
    unit_id: 0,
    accommodation_id: null as number | null,
    status_id: null as number | null,
    function_id: null as number | null,
  });

  // Validation state
  const [validationError, setValidationError] = useState<{ message: string } | null>(null);
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);

  // Helper to clear highlight
  const clearHighlight = (field: string) => {
    setHighlightedFields(prev => prev.filter(f => f !== field));
  };

  // Approve Modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvingEmployee, setApprovingEmployee] = useState<Employee | null>(null);
  const [approveType, setApproveType] = useState<"INTEGRATING" | "INTEGRATED">("INTEGRATING");
  const [approveDate, setApproveDate] = useState("");

  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const showToast = (text: string, kind: "success" | "error") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const [occupancy, setOccupancy] = useState<Record<number, number>>({});

  useEffect(() => {
    fetchUnits();
    fetchStatuses();
    fetchFunctions();
    fetchAccommodations();
    fetchOccupancy();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (currentUser) {
        fetchEmployees();
      } else {
        setIsLoading(false);
      }
    }
  }, [currentUser, authLoading]);

  const fetchEmployees = async () => {
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


      // Get status ID for "AGUARDANDO INTEGRAÇÃO"
      const { data: statusData } = await supabase
        .from("statuses")
        .select("id")
        .eq("name", "AGUARDANDO INTEGRAÇÃO")
        .single();

      if (!statusData) {
        console.error("Status 'AGUARDANDO INTEGRAÇÃO' not found");
        setEmployees([]);
        return;
      }

      const base = supabase
        .from("employees")
        .select(
          "id, full_name, arrival_date, departure_date, integration_date, observation, unit_id, accommodation_id, status_id, function_id, is_active, created_at, updated_at"
        )
        .eq("is_active", true)
        .eq("status_id", statusData.id);

      const { data, error } = isSuper || unitIds.length === 0 ? await base : await base.in("unit_id", unitIds);
      if (!error && Array.isArray(data)) {
        setEmployees(data as Employee[]);
      } else {
        setEmployees([]);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOccupancy = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("accommodation_id")
        .eq("is_active", true)
        .not("accommodation_id", "is", null);

      if (!error && data) {
        const counts: Record<number, number> = {};
        data.forEach((emp) => {
          if (emp.accommodation_id) {
            counts[emp.accommodation_id] = (counts[emp.accommodation_id] || 0) + 1;
          }
        });
        setOccupancy(counts);
      }
    } catch (error) {
      console.error("Error fetching occupancy:", error);
    }
  };

  const fetchUnits = async () => {
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

      const base = supabase.from("units").select("id, name").eq("is_active", true);
      const { data, error } = isSuper || unitIds.length === 0 ? await base : await base.in("id", unitIds);

      if (!error && Array.isArray(data)) {
        setUnits(data as Unit[]);
        // If only one unit is available, select it automatically
        if (data.length === 1 && !editingEmployee) {
          setFormData(prev => ({ ...prev, unit_id: data[0].id }));
        }
      }
    } catch (error) {
      console.error("Error fetching units:", error);
    }
  };

  const fetchStatuses = async () => {
    try {
      const { data } = await supabase.from("statuses").select("id, name").eq("is_active", true);
      if (Array.isArray(data)) setStatuses(data as Status[]);
    } catch (error) {
      console.error("Error fetching statuses:", error);
    }
  };

  const fetchAccommodations = async () => {
    try {
      const { data } = await supabase.from("accommodations").select("id, name, unit_id, bed_count").eq("is_active", true);
      if (Array.isArray(data)) setAccommodations(data as Accommodation[]);
    } catch (error) {
      console.error("Error fetching accommodations:", error);
    }
  };

  const fetchFunctions = async () => {
    try {
      const { data, error } = await supabase
        .from("functions")
        .select("id, name, is_active, created_at, updated_at")
        .eq("is_active", true);
      if (!error && Array.isArray(data)) {
        setFunctions(data as Function[]);
      } else {
        setFunctions([]);
      }
    } catch (error) {
      console.error("Error fetching functions:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation (with Alert Modal)
    if (!formData.function_id) {
      setValidationError({ message: "A função é obrigatória" });
      setHighlightedFields((prev) => [...new Set([...prev, "function_id"])]);
      return;
    }

    if (formData.arrival_date && !formData.accommodation_id) {
      setValidationError({ message: "Ao informar a Data de Chegada, o Alojamento é obrigatório" });
      setHighlightedFields((prev) => [...new Set([...prev, "accommodation_id"])]);
      return;
    }

    if (formData.accommodation_id && !formData.arrival_date) {
      setValidationError({ message: "Ao informar o Alojamento, a Data de Chegada é obrigatória" });
      setHighlightedFields((prev) => [...new Set([...prev, "arrival_date"])]);
      return;
    }

    try {
      // Find default status if creating
      let statusId = formData.status_id;
      if (!editingEmployee) {
        const defaultStatus = statuses.find(s => s.name === "AGUARDANDO INTEGRAÇÃO");
        if (defaultStatus) {
          statusId = defaultStatus.id;
        }
      }

      const payload = {
        full_name: formData.full_name.toUpperCase(),
        arrival_date: formData.arrival_date || null,
        departure_date: formData.departure_date || null,
        integration_date: formData.integration_date || null,
        observation: (formData.observation || "").toUpperCase(),
        unit_id: formData.unit_id,
        accommodation_id: formData.accommodation_id,
        status_id: statusId,
        function_id: formData.function_id,
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", editingEmployee.id);
        if (error) {
          showToast("Falha ao salvar funcionário", "error");
          return;
        }
        showToast("Funcionário atualizado", "success");
      } else {
        const { error } = await supabase
          .from("employees")
          .insert({
            ...payload,
            is_active: true,
          });
        if (error) {
          showToast("Falha ao cadastrar funcionário", "error");
          return;
        }
        showToast("Funcionário criado", "success");
      }

      setShowModal(false);
      setEditingEmployee(null);
      resetFormData();
      fetchEmployees();
      fetchOccupancy();
    } catch (error) {
      console.error("Error saving employee:", error);
      showToast("Falha ao salvar funcionário", "error");
    }
  };

  const handleApprove = async () => {
    if (!approvingEmployee) return;

    try {
      const targetStatus = statuses.find(s => s.name === "TRABALHANDO DISPONIVEL");
      if (!targetStatus) {
        showToast("Status 'TRABALHANDO DISPONIVEL' não encontrado", "error");
        return;
      }

      const { data: mealStatusData } = await supabase
        .from("meal_statuses")
        .select("id")
        .eq("name", "OBRA")
        .single();

      const payload = {
        status_id: targetStatus.id,
        integration_date: approveType === "INTEGRATING" ? (approveDate || null) : approvingEmployee.integration_date,
        refeicao_status_id: mealStatusData?.id || null,
      };

      const { error } = await supabase
        .from("employees")
        .update(payload)
        .eq("id", approvingEmployee.id);

      if (error) {
        showToast("Falha ao aprovar funcionário", "error");
        return;
      }

      showToast("Funcionário aprovado com sucesso", "success");
      setShowApproveModal(false);
      setApprovingEmployee(null);
      setApproveDate("");
      fetchEmployees();
    } catch (error) {
      console.error("Error approving employee:", error);
      showToast("Falha ao aprovar funcionário", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja desativar este funcionário?")) return;

    try {
      const { error } = await supabase
        .from("employees")
        .update({ is_active: false })
        .eq("id", id);
      if (error) {
        showToast("Falha ao desativar funcionário", "error");
        return;
      }
      showToast("Funcionário desativado", "success");
      fetchEmployees();
      fetchOccupancy();
    } catch (error) {
      console.error("Error deleting employee:", error);
      showToast("Falha ao desativar funcionário", "error");
    }
  };

  const resetFormData = () => {
    const defaultStatus = statuses.find(s => s.name === "AGUARDANDO INTEGRAÇÃO");
    setFormData({
      full_name: "",
      arrival_date: "",
      departure_date: "",
      integration_date: "",
      observation: "",
      unit_id: units.length === 1 ? units[0].id : 0,
      accommodation_id: null,
      status_id: defaultStatus?.id || null,
      function_id: null,
    });
  };

  const openEditModal = (employee: Employee) => {
    setHighlightedFields([]); // Clear any previous highlights
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      arrival_date: employee.arrival_date || "",
      departure_date: employee.departure_date || "",
      integration_date: employee.integration_date || "",
      observation: employee.observation || "",
      unit_id: employee.unit_id,
      accommodation_id: employee.accommodation_id,
      status_id: employee.status_id,
      function_id: employee.function_id,
    });
    setShowModal(true);
  };

  const openApproveModal = (employee: Employee) => {
    if (!employee.arrival_date) {
      openEditModal(employee);
      setValidationError({ message: "Preencher data de Chegada" });
      setHighlightedFields((prev) => [...new Set([...prev, "arrival_date"])]);
      return;
    }
    setApprovingEmployee(employee);
    setApproveType("INTEGRATING");
    setApproveDate("");
    setShowApproveModal(true);
  };




  const displayedEmployees = (() => {
    const term = (searchTerm || "").toUpperCase();
    const filtered = employees.filter((e) => (e.full_name || "").toUpperCase().includes(term));
    const getFunctionName = (id: number | null) => functions.find((f) => f.id === id)?.name || "";
    const getUnitName = (id: number | null | undefined) => units.find((u) => u.id === (id ?? -1))?.name || "";
    const compare = (a: Employee, b: Employee) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortKey === "full_name") {
        va = a.full_name || "";
        vb = b.full_name || "";
      } else if (sortKey === "function") {
        va = getFunctionName(a.function_id);
        vb = getFunctionName(b.function_id);
      } else if (sortKey === "unit") {
        va = getUnitName(a.unit_id);
        vb = getUnitName(b.unit_id);
      } else if (sortKey === "status") {
        const getStatusName = (id: number | null) => statuses.find((s) => s.id === id)?.name || "";
        va = getStatusName(a.status_id);
        vb = getStatusName(b.status_id);
      } else if (sortKey === "integration_date") {
        va = a.integration_date || "";
        vb = b.integration_date || "";
      }
      if (typeof va === "number" && typeof vb === "number") {
        return sortAsc ? va - vb : vb - va;
      }
      const sa = String(va).toUpperCase();
      const sb = String(vb).toUpperCase();
      if (sa < sb) return sortAsc ? -1 : 1;
      if (sa > sb) return sortAsc ? 1 : -1;
      return 0;
    };
    return filtered.slice().sort(compare);
  })();

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
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"
            }`}
        >
          {toast.text}
        </div>
      )}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Integração</h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie os funcionários das obras</p>
        </div>
        <div className="w-full md:w-auto flex items-center gap-3">
          <button
            onClick={() => {
              setEditingEmployee(null);
              resetFormData();
              setHighlightedFields([]);
              setShowModal(true);
            }}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-5 h-5" />
            Nova Integração
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700 w-full md:w-fit">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
          className="bg-transparent border-none text-slate-200 placeholder-slate-500 focus:outline-none w-full md:w-64"
          placeholder="Buscar por nome"
        />
      </div>


      {/* Desktop View */}
      <div className="hidden md:block bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700/50">
              <tr>
                {[
                  { key: "arrival_date", label: "Data Chegada" },
                  { key: "full_name", label: "Nome" },
                  { key: "function", label: "Função" },
                  { key: "unit", label: "Unidade" },
                  { key: "accommodation", label: "Alojamento" },
                  { key: "status", label: "Status" },
                ].map((col) => (
                  <th key={col.key} className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortKey === col.key) {
                          setSortAsc(!sortAsc);
                        } else {
                          setSortKey(col.key as typeof sortKey);
                          setSortAsc(true);
                        }
                      }}
                      className="flex items-center justify-center gap-1 hover:text-slate-100 w-full"
                    >
                      <span>{col.label}</span>
                      {sortKey === col.key ? (
                        sortAsc ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : null}
                    </button>
                  </th>
                ))}
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {displayedEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-slate-400 font-mono text-sm">
                      {employee.arrival_date ? new Date(employee.arrival_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-5 h-5 text-blue-400" />
                      <span className="text-slate-200 font-medium">{employee.full_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300 whitespace-nowrap">
                    {functions.find((f) => f.id === employee.function_id)?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {units.find((u) => u.id === employee.unit_id)?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {accommodations.find((a) => a.id === employee.accommodation_id)?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {statuses.find((s) => s.id === employee.status_id)?.name || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openApproveModal(employee)}
                        className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-all"
                        title="Aprovar"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(employee)}
                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(employee.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {displayedEmployees.map((employee) => (
          <div key={employee.id} className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
            {/* Header Section */}
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-slate-800 rounded-lg shrink-0">
                    <UserCircle className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-slate-100 font-semibold text-base truncate">{employee.full_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded">
                        {employee.arrival_date ? new Date(employee.arrival_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Função</p>
                <p className="text-slate-200 text-sm font-medium truncate">
                  {functions.find((f) => f.id === employee.function_id)?.name || "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Unidade</p>
                <p className="text-slate-200 text-sm font-medium truncate">
                  {units.find((u) => u.id === employee.unit_id)?.name || "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Alojamento</p>
                <p className="text-slate-200 text-sm font-medium truncate">
                  {accommodations.find((a) => a.id === employee.accommodation_id)?.name || "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Status</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statuses.find((s) => s.id === employee.status_id)?.name === "TRABALHANDO DISPONIVEL"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-slate-700/50 text-slate-300 border border-slate-600/50"
                  }`}>
                  {statuses.find((s) => s.id === employee.status_id)?.name || "-"}
                </span>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="px-4 py-3 bg-slate-800/20 border-t border-slate-700/50 flex justify-end gap-2">
              <button
                onClick={() => openApproveModal(employee)}
                className="flex-1 flex items-center justify-center gap-2 p-2 text-green-400 bg-green-500/5 hover:bg-green-500/10 border border-green-500/20 rounded-lg transition-all active:scale-95"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Aprovar</span>
              </button>
              <button
                onClick={() => openEditModal(employee)}
                className="flex-1 flex items-center justify-center gap-2 p-2 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 rounded-lg transition-all active:scale-95"
              >
                <Edit className="w-4 h-4" />
                <span className="text-xs font-medium">Editar</span>
              </button>
              <button
                onClick={() => handleDelete(employee.id)}
                className="flex-1 flex items-center justify-center gap-2 p-2 text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-xs font-medium">Excluir</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-2xl shadow-2xl my-8">
            <h2 className="text-xl font-bold text-slate-100 mb-4">
              {editingEmployee ? "Editar Funcionário" : "Nova Integração"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data de Chegada
                  </label>
                  <input
                    type="date"
                    value={formData.arrival_date}
                    onChange={(e) => {
                      setFormData({ ...formData, arrival_date: e.target.value });
                      clearHighlight("arrival_date");
                    }}
                    className={`w-full px-4 py-2 bg-slate-800 border rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${highlightedFields.includes("arrival_date") ? "border-red-500 ring-1 ring-red-500" : "border-slate-700"}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data Integração
                  </label>
                  <input
                    type="date"
                    value={formData.integration_date}
                    onChange={(e) =>
                      setFormData({ ...formData, integration_date: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={true}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Unidade
                  </label>
                  <select
                    value={formData.unit_id || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, unit_id: parseInt(e.target.value), accommodation_id: null })
                    }
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  >
                    <option value="">Selecione uma unidade</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Função</label>
                  <select
                    value={formData.function_id || ""}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        function_id: e.target.value ? parseInt(e.target.value) : null,
                      });
                      clearHighlight("function_id");
                    }}
                    className={`w-full px-4 py-2 bg-slate-800 border rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${highlightedFields.includes("function_id") ? "border-red-500 ring-1 ring-red-500" : "border-slate-700"}`}
                  >
                    <option value="">Nenhuma</option>
                    {functions.map((func) => (
                      <option key={func.id} value={func.id}>
                        {func.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Alojamento
                  </label>
                  <select
                    value={formData.accommodation_id || ""}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        accommodation_id: e.target.value ? parseInt(e.target.value) : null,
                      });
                      clearHighlight("accommodation_id");
                    }}
                    className={`w-full px-4 py-2 bg-slate-800 border rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${highlightedFields.includes("accommodation_id") ? "border-red-500 ring-1 ring-red-500" : "border-slate-700"}`}
                  >
                    <option value="">Nenhum</option>
                    {accommodations
                      .filter(acc => {
                        // Filter by unit
                        if (formData.unit_id && acc.unit_id !== formData.unit_id) return false;

                        // Filter by capacity (unless it's the currently selected one for this employee)
                        const currentOccupancy = occupancy[acc.id] || 0;
                        const isFull = currentOccupancy >= (acc.bed_count || 0);
                        const isCurrentSelection = acc.id === formData.accommodation_id;

                        return !isFull || isCurrentSelection;
                      })
                      .map((accommodation) => (
                        <option key={accommodation.id} value={accommodation.id}>
                          {accommodation.name} ({(occupancy[accommodation.id] || 0)}/{accommodation.bed_count || 0})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                  <select
                    value={formData.status_id || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status_id: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={true}
                  >
                    {statuses
                      .filter((s) => s.name === "AGUARDANDO INTEGRAÇÃO")
                      .map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Observação
                </label>
                <textarea
                  value={formData.observation}
                  onChange={(e) => setFormData({ ...formData, observation: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-slate-100 mb-4">Aprovar Funcionário</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="approveType"
                    value="INTEGRATING"
                    checked={approveType === "INTEGRATING"}
                    onChange={() => setApproveType("INTEGRATING")}
                    className="text-blue-500 focus:ring-blue-500"
                  />
                  INTEGRANDO
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="approveType"
                    value="INTEGRATED"
                    checked={approveType === "INTEGRATED"}
                    onChange={() => setApproveType("INTEGRATED")}
                    className="text-blue-500 focus:ring-blue-500"
                  />
                  JÁ INTEGRADO
                </label>
              </div>

              {approveType === "INTEGRATING" && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data Integração
                  </label>
                  <input
                    type="date"
                    value={approveDate}
                    onChange={(e) => setApproveDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Alert Modal */}
      {validationError && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-500/50 p-6 rounded-xl shadow-2xl w-full max-w-sm text-center relative animate-in fade-in zoom-in duration-300">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mb-4">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Atenção Necessária</h3>
            <p className="text-slate-300 mb-6">{validationError.message}</p>
            <button
              onClick={() => setValidationError(null)}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all"
            >
              OK, Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
