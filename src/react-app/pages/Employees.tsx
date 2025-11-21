import { useEffect, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { Employee, Unit, Accommodation, Room, Function } from "@/shared/types";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Plus, Edit, Trash2, Loader2, UserCircle, ChevronUp, ChevronDown, Search } from "lucide-react";

export default function Employees() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [functions, setFunctions] = useState<Function[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<"registration_number" | "full_name" | "function" | "unit" | "room" | "status">("full_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [formData, setFormData] = useState({
    registration_number: "",
    full_name: "",
    arrival_date: "",
    departure_date: "",
    observation: "",
    unit_id: 0,
    accommodation_id: null as number | null,
    room_id: null as number | null,
    function_id: null as number | null,
    status: "",
  });
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const showToast = (text: string, kind: "success" | "error") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchEmployees();
    fetchUnits();
    fetchAccommodations();
    fetchRooms();
    fetchFunctions();
  }, []);

  const fetchEmployees = async () => {
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
      const base = supabase
        .from("employees")
        .select(
          "id, registration_number, full_name, arrival_date, departure_date, observation, unit_id, accommodation_id, room_id, function_id, status, is_active, created_at, updated_at"
        )
        .eq("is_active", true)
      ;
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
      const { data, error } = await supabase
        .from("units")
        .select("id, name, is_active, created_at, updated_at");
      if (!error && Array.isArray(data)) {
        const list = (data as Unit[]).filter((u) => u.is_active);
        setUnits(isSuper ? list : list.filter((u) => unitIds.includes(u.id)));
      } else {
        setUnits([]);
      }
    } catch (error) {
      console.error("Error fetching units:", error);
    }
  };

  const fetchAccommodations = async () => {
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
      const base = supabase
        .from("accommodations")
        .select("id, name, unit_id, is_active, created_at, updated_at")
        .eq("is_active", true);
      const { data, error } = isSuper || unitIds.length === 0 ? await base : await base.in("unit_id", unitIds);
      if (!error && Array.isArray(data)) {
        setAccommodations(data as Accommodation[]);
      } else {
        setAccommodations([]);
      }
    } catch (error) {
      console.error("Error fetching accommodations:", error);
    }
  };

  const fetchRooms = async () => {
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
      const accBase = supabase
        .from("accommodations")
        .select("id")
        .eq("is_active", true);
      const { data: accRows } = isSuper || unitIds.length === 0 ? await accBase : await accBase.in("unit_id", unitIds);
      const accIds = Array.isArray(accRows) ? (accRows as { id: number }[]).map((a) => a.id) : [];
      const { data, error } = await supabase
        .from("rooms")
        .select("id, accommodation_id, bed_count, is_active, created_at, updated_at")
        .eq("is_active", true)
        .in("accommodation_id", accIds.length ? accIds : [-1]);
      if (!error && Array.isArray(data)) {
        setRooms(data as Room[]);
      } else {
        setRooms([]);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
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

    try {
      const payload = {
        registration_number: formData.registration_number.toUpperCase(),
        full_name: formData.full_name.toUpperCase(),
        arrival_date: formData.arrival_date || null,
        departure_date: formData.departure_date || null,
        observation: (formData.observation || "").toUpperCase(),
        unit_id: formData.unit_id,
        accommodation_id: formData.accommodation_id,
        room_id: formData.room_id,
        function_id: formData.function_id,
        status: (formData.status || "").toUpperCase(),
      };
      if (editingEmployee) {
        const { error } = await supabase
          .from("employees")
          .update({
            registration_number: payload.registration_number,
            full_name: payload.full_name,
            arrival_date: payload.arrival_date,
            departure_date: payload.departure_date,
            observation: payload.observation,
            unit_id: payload.unit_id,
            accommodation_id: payload.accommodation_id,
            room_id: payload.room_id,
            function_id: payload.function_id,
            status: payload.status,
          })
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
            registration_number: payload.registration_number,
            full_name: payload.full_name,
            arrival_date: payload.arrival_date,
            departure_date: payload.departure_date,
            observation: payload.observation,
            unit_id: payload.unit_id,
            accommodation_id: payload.accommodation_id,
            room_id: payload.room_id,
            function_id: payload.function_id,
            status: payload.status,
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
    } catch (error) {
      console.error("Error saving employee:", error);
      showToast("Falha ao salvar funcionário", "error");
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
    } catch (error) {
      console.error("Error deleting employee:", error);
      showToast("Falha ao desativar funcionário", "error");
    }
  };

  const resetFormData = () => {
    setFormData({
      registration_number: "",
      full_name: "",
      arrival_date: "",
      departure_date: "",
      observation: "",
      unit_id: units[0]?.id || 0,
      accommodation_id: null,
      room_id: null,
      function_id: null,
      status: "",
    });
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      registration_number: employee.registration_number,
      full_name: employee.full_name,
      arrival_date: employee.arrival_date || "",
      departure_date: employee.departure_date || "",
      observation: employee.observation || "",
      unit_id: employee.unit_id,
      accommodation_id: employee.accommodation_id,
      room_id: employee.room_id,
      function_id: employee.function_id,
      status: employee.status || "",
    });
    setShowModal(true);
  };

  const filteredRooms = formData.accommodation_id
    ? rooms.filter((r) => r.accommodation_id === formData.accommodation_id)
    : [];

  const displayedEmployees = (() => {
    const term = (searchTerm || "").toUpperCase();
    const filtered = employees.filter((e) => (e.full_name || "").toUpperCase().includes(term));
    const getFunctionName = (id: number | null) => functions.find((f) => f.id === id)?.name || "";
    const getUnitName = (id: number | null | undefined) => units.find((u) => u.id === (id ?? -1))?.name || "";
    const compare = (a: Employee, b: Employee) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortKey === "registration_number") {
        va = a.registration_number || "";
        vb = b.registration_number || "";
      } else if (sortKey === "full_name") {
        va = a.full_name || "";
        vb = b.full_name || "";
      } else if (sortKey === "function") {
        va = getFunctionName(a.function_id);
        vb = getFunctionName(b.function_id);
      } else if (sortKey === "unit") {
        va = getUnitName(a.unit_id);
        vb = getUnitName(b.unit_id);
      } else if (sortKey === "room") {
        va = a.room_id ?? 0;
        vb = b.room_id ?? 0;
      } else if (sortKey === "status") {
        va = a.status || "";
        vb = b.status || "";
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
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg ${
            toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"
          }`}
        >
          {toast.text}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Funcionários</h1>
          <p className="text-slate-400 mt-1">Gerencie os funcionários das obras</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingEmployee(null);
              resetFormData();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-5 h-5" />
            Novo Funcionário
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700 w-fit">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
          className="bg-transparent border-none text-slate-200 placeholder-slate-500 focus:outline-none w-64"
          placeholder="Buscar por nome"
        />
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700/50">
              <tr>
                {[
                  { key: "registration_number", label: "Matrícula" },
                  { key: "full_name", label: "Nome" },
                  { key: "function", label: "Função" },
                  { key: "unit", label: "Unidade" },
                  { key: "room", label: "Quarto" },
                  { key: "status", label: "Status" },
                ].map((col) => (
                  <th key={col.key} className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
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
                      className="flex items-center gap-1 hover:text-slate-100"
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
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {displayedEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-slate-400 font-mono text-sm">
                      {employee.registration_number}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-5 h-5 text-blue-400" />
                      <span className="text-slate-200 font-medium">{employee.full_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {functions.find((f) => f.id === employee.function_id)?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {units.find((u) => u.id === employee.unit_id)?.name || "-"}
                  </td>
                  <td className="px-6 py-4">
                    {employee.room_id ? (
                      <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-sm">
                        Quarto {employee.room_id}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-sm">Sem quarto</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-300">{employee.status || "-"}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-2xl shadow-2xl my-8">
            <h2 className="text-xl font-bold text-slate-100 mb-4">
              {editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Matrícula
                  </label>
                  <input
                    type="text"
                    value={formData.registration_number}
                    onChange={(e) =>
                      setFormData({ ...formData, registration_number: e.target.value.toUpperCase() })
                    }
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                </div>
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
                    onChange={(e) => setFormData({ ...formData, arrival_date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data de Saída
                  </label>
                  <input
                    type="date"
                    value={formData.departure_date}
                    onChange={(e) =>
                      setFormData({ ...formData, departure_date: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Unidade
                  </label>
                  <select
                    value={formData.unit_id}
                    onChange={(e) =>
                      setFormData({ ...formData, unit_id: parseInt(e.target.value) })
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
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        function_id: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        accommodation_id: e.target.value ? parseInt(e.target.value) : null,
                        room_id: null,
                      })
                    }
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Nenhum</option>
                    {accommodations.map((accommodation) => (
                      <option key={accommodation.id} value={accommodation.id}>
                        {accommodation.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Quarto</label>
                  <select
                    value={formData.room_id || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        room_id: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    disabled={!formData.accommodation_id}
                  >
                    <option value="">Nenhum</option>
                    {filteredRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        Quarto {room.id} ({room.bed_count} cama
                        {room.bed_count > 1 ? "s" : ""})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <input
                  type="text"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ex: Ativo, Férias, etc."
                />
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
    </div>
  );
}
