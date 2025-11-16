import { useEffect, useState } from "react";
import { Unit } from "@/shared/types";
import { supabase } from "@/react-app/supabase";
import { Plus, Edit, Trash2, Loader2, Building2 } from "lucide-react";
import { usePagePermissions } from "@/react-app/hooks/usePermissions";

export default function Units() {
  const perms = usePagePermissions("units");
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("id, name, is_active, created_at, updated_at")
        .eq("is_active", true)
        .order("name");
      if (error || !Array.isArray(data)) {
        setUnits([]);
        return;
      }
      setUnits(data as Unit[]);
    } catch {
      setUnits([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (editingUnit) {
        const { error } = await supabase
          .from("units")
          .update({ name: formData.name })
          .eq("id", editingUnit.id);
        if (error) {
          setError(error.message || "Erro ao salvar unidade");
          return;
        }
      } else {
        const { error } = await supabase
          .from("units")
          .insert({ name: formData.name, is_active: true });
        if (error) {
          setError(error.message || "Erro ao salvar unidade");
          return;
        }
      }
      setShowModal(false);
      setEditingUnit(null);
      setFormData({ name: "" });
      fetchUnits();
    } catch (error) {
      console.error("Error saving unit:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja desativar esta unidade?")) return;
    try {
      const { error } = await supabase
        .from("units")
        .update({ is_active: false })
        .eq("id", id);
      if (error) {
        alert(error.message || "Erro ao desativar unidade");
        return;
      }
      fetchUnits();
    } catch (error) {
      console.error("Error deleting unit:", error);
    }
  };

  const openEditModal = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({ name: unit.name });
    setShowModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!perms.can_view) {
    return <div className="flex items-center justify-center h-96 text-slate-300">Sem acesso</div>;
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Unidades</h1>
          <p className="text-slate-400 mt-1">Gerencie as unidades do sistema</p>
        </div>
        {perms.can_create && (
        <button
          onClick={() => {
            setEditingUnit(null);
            setFormData({ name: "" });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Nova Unidade
        </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {units.map((unit) => (
          <div
            key={unit.id}
            className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex gap-2">
                    {perms.can_update && (
                    <button
                      onClick={() => openEditModal(unit)}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    )}
                    {perms.can_delete && (
                    <button
                      onClick={() => handleDelete(unit.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    )}
              </div>
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">{unit.name}</h3>
            <p className="text-sm text-slate-400">
              Criado em {new Date(unit.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-slate-100 mb-4">
              {editingUnit ? "Editar Unidade" : "Nova Unidade"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome da Unidade
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
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
