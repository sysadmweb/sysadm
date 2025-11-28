import { useEffect, useState } from "react";
import { Accommodation, Unit } from "@/shared/types";
import { Plus, Edit, Trash2, Loader2, Home } from "lucide-react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";

export default function Accommodations() {
  const { user: currentUser } = useAuth();
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [employeeCounts, setEmployeeCounts] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    unit_id: number;
    bed_count: number | string;
  }>({
    name: "",
    unit_id: 0,
    bed_count: "",
  });
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const showToast = (text: string, kind: "success" | "error") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchAccommodations();
    fetchUnits();
    fetchEmployeeCounts();
  }, []);

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
        .select("id, name, unit_id, bed_count, is_active, created_at, updated_at")
        .eq("is_active", true);
      const { data, error } = isSuper || unitIds.length === 0 ? await base : await base.in("unit_id", unitIds);
      if (!error && Array.isArray(data)) {
        setAccommodations(data as Accommodation[]);
      } else {
        setAccommodations([]);
      }
    } catch (error) {
      console.error("Error fetching accommodations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployeeCounts = async () => {
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
        setEmployeeCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching employee counts:", error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = { name: formData.name.toUpperCase(), unit_id: formData.unit_id, bed_count: Number(formData.bed_count) || 0 };
      if (editingAccommodation) {
        const { error } = await supabase
          .from("accommodations")
          .update({ name: payload.name, unit_id: payload.unit_id, bed_count: payload.bed_count })
          .eq("id", editingAccommodation.id);
        if (error) {
          showToast("Falha ao salvar alojamento", "error");
          return;
        }
        showToast("Alojamento atualizado", "success");
      } else {
        const { error } = await supabase
          .from("accommodations")
          .insert({ name: payload.name, unit_id: payload.unit_id, bed_count: payload.bed_count, is_active: true });
        if (error) {
          showToast("Falha ao cadastrar alojamento", "error");
          return;
        }
        showToast("Alojamento criado", "success");
      }

      setShowModal(false);
      setEditingAccommodation(null);
      setFormData({ name: "", unit_id: 0, bed_count: "" });
      fetchAccommodations();
    } catch (error) {
      console.error("Error saving accommodation:", error);
      showToast("Falha ao salvar alojamento", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja desativar este alojamento?")) return;

    try {
      const { error } = await supabase
        .from("accommodations")
        .update({ is_active: false })
        .eq("id", id);
      if (error) {
        showToast("Falha ao desativar alojamento", "error");
        return;
      }
      showToast("Alojamento desativado", "success");
      fetchAccommodations();
    } catch (error) {
      console.error("Error deleting accommodation:", error);
      showToast("Falha ao desativar alojamento", "error");
    }
  };

  const openEditModal = (accommodation: Accommodation) => {
    setEditingAccommodation(accommodation);
    setFormData({
      name: accommodation.name,
      unit_id: accommodation.unit_id,
      bed_count: accommodation.bed_count || 0,
    });
    setShowModal(true);
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
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"
            }`}
        >
          {toast.text}
        </div>
      )}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Alojamentos</h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie os alojamentos das unidades</p>
        </div>
        <button
          onClick={() => {
            setEditingAccommodation(null);
            setFormData({ name: "", unit_id: units[0]?.id || 0, bed_count: "" });
            setShowModal(true);
          }}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Novo Alojamento
        </button>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-x-auto shadow-xl">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Nome</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Unidade</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Camas</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Quantidade Funcionario</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {accommodations.map((accommodation) => (
              <tr key={accommodation.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-green-400" />
                    <span className="text-slate-200 font-medium">{accommodation.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-300">
                  {units.find((u) => u.id === accommodation.unit_id)?.name || "-"}
                </td>
                <td className="px-6 py-4 text-center text-slate-400">
                  {accommodation.bed_count || 0}
                </td>
                <td className="px-6 py-4 text-center text-slate-400">
                  {employeeCounts[accommodation.id] || 0}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(accommodation)}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(accommodation.id)}
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

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {accommodations.map((accommodation) => (
          <div key={accommodation.id} className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 shadow-xl">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg">
                  <Home className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-slate-200 font-medium text-sm">{accommodation.name}</h3>
                  <p className="text-slate-400 text-xs">
                    {units.find((u) => u.id === accommodation.unit_id)?.name || "-"}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {accommodation.bed_count} camas
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEditModal(accommodation)}
                  className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(accommodation.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
              <span className="text-slate-400 text-xs">Funcionários</span>
              <span className="text-slate-200 font-medium text-sm">
                {employeeCounts[accommodation.id] || 0}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-slate-100 mb-4">
              {editingAccommodation ? "Editar Alojamento" : "Novo Alojamento"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome do Alojamento
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>
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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Quantidade de Camas
                </label>
                <input
                  type="number"
                  value={formData.bed_count}
                  onChange={(e) => setFormData({ ...formData, bed_count: e.target.value === "" ? "" : parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="0"
                  required
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
