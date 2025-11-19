import { useEffect, useState } from "react";
import { Employee, Unit, Accommodation, Room, Function } from "@/shared/types";
import { Plus, Edit, Trash2, Loader2, UserCircle } from "lucide-react";

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [functions, setFunctions] = useState<Function[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
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

  useEffect(() => {
    fetchEmployees();
    fetchUnits();
    fetchAccommodations();
    fetchRooms();
    fetchFunctions();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/employees", { credentials: "include" });
      if (!response.ok) {
        setEmployees([]);
        return;
      }
      const data = (await response.json()) as { employees: Employee[] };
      setEmployees(Array.isArray(data.employees) ? data.employees : []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await fetch("/api/units", { credentials: "include" });
      if (!response.ok) {
        setUnits([]);
        return;
      }
      const unitsData = (await response.json()) as { units: Unit[] };
      setUnits(Array.isArray(unitsData.units) ? unitsData.units : []);
    } catch (error) {
      console.error("Error fetching units:", error);
    }
  };

  const fetchAccommodations = async () => {
    try {
      const response = await fetch("/api/accommodations", { credentials: "include" });
      if (!response.ok) {
        setAccommodations([]);
        return;
      }
      const accData = (await response.json()) as { accommodations: Accommodation[] };
      setAccommodations(Array.isArray(accData.accommodations) ? accData.accommodations : []);
    } catch (error) {
      console.error("Error fetching accommodations:", error);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await fetch("/api/rooms", { credentials: "include" });
      if (!response.ok) {
        setRooms([]);
        return;
      }
      const roomsData = (await response.json()) as { rooms: Room[] };
      setRooms(Array.isArray(roomsData.rooms) ? roomsData.rooms : []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchFunctions = async () => {
    try {
      const response = await fetch("/api/functions", { credentials: "include" });
      if (!response.ok) {
        setFunctions([]);
        return;
      }
      const funcData = (await response.json()) as { functions: Function[] };
      setFunctions(Array.isArray(funcData.functions) ? funcData.functions : []);
    } catch (error) {
      console.error("Error fetching functions:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingEmployee) {
        await fetch(`/api/employees/${editingEmployee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(formData),
        });
      } else {
        await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(formData),
        });
      }

      setShowModal(false);
      setEditingEmployee(null);
      resetFormData();
      fetchEmployees();
    } catch (error) {
      console.error("Error saving employee:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja desativar este funcionário?")) return;

    try {
      await fetch(`/api/employees/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Funcionários</h1>
          <p className="text-slate-400 mt-1">Gerencie os funcionários das obras</p>
        </div>
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

      <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Matrícula</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Nome</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Função</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Unidade</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Quarto</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {employees.map((employee) => (
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
                      setFormData({ ...formData, registration_number: e.target.value })
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
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
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
