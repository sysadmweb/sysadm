import { useEffect, useState } from "react";
import { Room, Accommodation } from "@/shared/types";
import { Plus, Edit, Trash2, Loader2, Bed } from "lucide-react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";

export default function Rooms() {
  const { user: currentUser } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    accommodation_id: 0,
    bed_count: 1,
  });
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const showToast = (text: string, kind: "success" | "error") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchAccommodations();
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch("/api/rooms", { credentials: "include" });
      if (!response.ok) {
        const { data: accRows } = await supabase
          .from("accommodations")
          .select("id")
          .eq("is_active", true)
          .match(
            currentUser?.is_super_user || !currentUser?.unit_id
              ? {}
              : { unit_id: currentUser.unit_id }
          );
        const accIds = Array.isArray(accRows) ? (accRows as { id: number }[]).map((a) => a.id) : [];
        const { data, error } = await supabase
          .from("rooms")
          .select("id, accommodation_id, bed_count, name, is_active, created_at, updated_at")
          .eq("is_active", true)
          .in("accommodation_id", accIds.length ? accIds : [-1]);
        if (!error && Array.isArray(data)) {
          setRooms(data as Room[]);
        } else {
          setRooms([]);
        }
        return;
      }
      const data = (await response.json()) as { rooms: Room[] };
      const list = Array.isArray(data.rooms) ? data.rooms : [];
      const allowedAccIds = accommodations
        .filter((a) => (currentUser?.is_super_user || !currentUser?.unit_id ? true : a.unit_id === currentUser.unit_id))
        .map((a) => a.id);
      setRooms(
        currentUser?.is_super_user || !currentUser?.unit_id
          ? list
          : list.filter((r) => allowedAccIds.includes(r.accommodation_id))
      );
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccommodations = async () => {
    try {
      const response = await fetch("/api/accommodations", { credentials: "include" });
      if (!response.ok) {
        const { data, error } = await supabase
          .from("accommodations")
          .select("id, name, unit_id, is_active, created_at, updated_at")
          .eq("is_active", true)
          .match(
            currentUser?.is_super_user || !currentUser?.unit_id
              ? {}
              : { unit_id: currentUser.unit_id }
          );
        if (!error && Array.isArray(data)) {
          setAccommodations(data as Accommodation[]);
        } else {
          setAccommodations([]);
        }
        return;
      }
      const data = (await response.json()) as { accommodations: Accommodation[] };
      const list = Array.isArray(data.accommodations) ? data.accommodations : [];
      setAccommodations(
        currentUser?.is_super_user || !currentUser?.unit_id
          ? list
          : list.filter((a) => a.unit_id === currentUser.unit_id)
      );
    } catch (error) {
      console.error("Error fetching accommodations:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = { ...formData, name: (formData.name || "").toUpperCase() };
      if (editingRoom) {
        const res = await fetch(`/api/rooms/${editingRoom.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const { error } = await supabase
            .from("rooms")
            .update({ name: payload.name, accommodation_id: payload.accommodation_id, bed_count: payload.bed_count })
            .eq("id", editingRoom.id);
          if (error) {
            showToast("Falha ao salvar quarto", "error");
            return;
          }
        }
        showToast("Quarto atualizado com sucesso", "success");
      } else {
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const { error } = await supabase
            .from("rooms")
            .insert({ name: payload.name, accommodation_id: payload.accommodation_id, bed_count: payload.bed_count, is_active: true });
          if (error) {
            showToast("Falha ao cadastrar quarto", "error");
            return;
          }
        }
        showToast("Quarto cadastrado com sucesso", "success");
      }

      setShowModal(false);
      setEditingRoom(null);
      setFormData({ name: "", accommodation_id: 0, bed_count: 1 });
      fetchRooms();
    } catch (error) {
      console.error("Error saving room:", error);
      showToast("Falha ao salvar quarto", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja desativar este quarto?")) return;

    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const { error } = await supabase
          .from("rooms")
          .update({ is_active: false })
          .eq("id", id);
        if (error) {
          showToast("Falha ao desativar quarto", "error");
          return;
        }
      }
      showToast("Quarto desativado", "success");
      fetchRooms();
    } catch (error) {
      console.error("Error deleting room:", error);
      showToast("Falha ao desativar quarto", "error");
    }
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name ?? "",
      accommodation_id: room.accommodation_id,
      bed_count: room.bed_count,
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
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg ${
            toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"
          }`}
        >
          {toast.text}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Quartos</h1>
          <p className="text-slate-400 mt-1">Gerencie os quartos dos alojamentos</p>
        </div>
        <button
          onClick={() => {
            setEditingRoom(null);
            setFormData({name:"", accommodation_id: accommodations[0]?.id || 0, bed_count: 1 });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Novo Quarto
        </button>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Quarto</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Alojamento</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Quantidade de Camas</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Data de Criação</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {rooms.map((room) => (
              <tr key={room.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Bed className="w-5 h-5 text-purple-400" />
                    <span className="text-slate-200 font-medium">{room.name || `Quarto ${room.id}`}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-300">
                  {accommodations.find((a) => a.id === room.accommodation_id)?.name || "-"}
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm font-medium">
                    {room.bed_count} cama{room.bed_count > 1 ? "s" : ""}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400">
                  {new Date(room.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(room)}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-slate-100 mb-4">
              {editingRoom ? "Editar Quarto" : "Novo Quarto"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome do Quarto
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Alojamento
                </label>
                <select
                  value={formData.accommodation_id}
                  onChange={(e) =>
                    setFormData({ ...formData, accommodation_id: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                >
                  <option value="">Selecione um alojamento</option>
                  {accommodations.map((accommodation) => (
                    <option key={accommodation.id} value={accommodation.id}>
                      {accommodation.name}
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
                  min="1"
                  value={formData.bed_count}
                  onChange={(e) =>
                    setFormData({ ...formData, bed_count: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
