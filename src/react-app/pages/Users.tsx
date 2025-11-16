import { useEffect, useState } from "react";
import { User, Unit } from "@/shared/types";
import { supabase } from "@/react-app/supabase";
import { Plus, Edit, Trash2, Loader2, Shield, User as UserIcon } from "lucide-react";
import { useAuth } from "@/react-app/contexts/AuthContext";
import * as bcrypt from "bcryptjs";
import { usePagePermissions } from "@/react-app/hooks/usePermissions";

export default function Users() {
  const { user: currentUser } = useAuth();
  const perms = usePagePermissions("users");
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    unit_id: null as number | null,
    is_super_user: false,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchUnits();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, username, name, is_super_user, unit_id, is_active, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error || !Array.isArray(data)) {
        setUsers([]);
        return;
      }
      setUsers(data as User[]);
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (editingUser) {
        const { error } = await supabase
          .from("users")
          .update({ name: formData.name, unit_id: formData.unit_id })
          .eq("id", editingUser.id);
        if (error) {
          setError(error.message || "Falha ao salvar");
          return;
        }
        if (currentUser?.is_super_user && formData.password) {
          const passwordHash = await bcrypt.hash(formData.password, 10);
          const { error: err2 } = await supabase
            .from("users")
            .update({ password_hash: passwordHash })
            .eq("id", editingUser.id);
          if (err2) {
            setError(err2.message || "Falha ao salvar");
            return;
          }
        }
      } else {
        const passwordHash = await bcrypt.hash(formData.password, 10);
        const { error } = await supabase
          .from("users")
          .insert({
            username: formData.username,
            password_hash: passwordHash,
            name: formData.name,
            unit_id: formData.unit_id,
            is_super_user: !!formData.is_super_user,
            is_active: true,
          });
        if (error) {
          setError(error.message || "Falha ao salvar");
          return;
        }
      }

      setShowModal(false);
      setEditingUser(null);
      setFormData({ username: "", password: "", name: "", unit_id: null, is_super_user: false });
      fetchUsers();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao salvar";
      setError(msg);
    }
    finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja desativar este usuário?")) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({ is_active: false })
        .eq("id", id);
      if (error) {
        alert(error.message || "Falha ao desativar usuário");
        return;
      }
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: "",
      name: user.name,
      unit_id: user.unit_id,
      is_super_user: !!user.is_super_user,
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

  if (!perms.can_view) {
    return <div className="flex items-center justify-center h-96 text-slate-300">Sem acesso</div>;
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Usuários</h1>
          <p className="text-slate-400 mt-1">Gerencie os usuários do sistema</p>
        </div>
        {perms.can_create && (
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({ username: "", password: "", name: "", unit_id: null, is_super_user: false });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
        )}
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-x-auto shadow-xl">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Usuário</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Nome</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Tipo</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Unidade</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-slate-400" />
                    <span className="text-slate-200 font-medium">{user.username}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-300">{user.name}</td>
                <td className="px-6 py-4">
                  {user.is_super_user ? (
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Shield className="w-4 h-4" />
                      Super Usuário
                    </span>
                  ) : (
                    <span className="text-slate-400">Usuário Comum</span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-300">
                  {units.find((u) => u.id === user.unit_id)?.name || "-"}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {perms.can_update && (
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    )}
                    {perms.can_delete && user.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
              {editingUser ? "Editar Usuário" : "Novo Usuário"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Usuário
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                  disabled={!!editingUser}
                />
              </div>
              {(!editingUser || currentUser?.is_super_user) && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Senha {editingUser && currentUser?.is_super_user ? "(opcional para redefinir)" : ""}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required={!editingUser}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome
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
                  Tipo de Usuário
                </label>
                <select
                  value={formData.is_super_user ? "super" : "regular"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_super_user: e.target.value === "super",
                    })
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  disabled={!!editingUser}
                >
                  <option value="regular">Usuário Comum</option>
                  <option value="super">Super Usuário</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Unidade
                </label>
                <select
                  value={formData.unit_id || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unit_id: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Nenhuma</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
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
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (<><Loader2 className="w-5 h-5 inline animate-spin mr-2" />Salvando...</>) : "Salvar"}
                </button>
              </div>
              {error && (
                <div className="pt-2 text-sm text-red-400">{error}</div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
