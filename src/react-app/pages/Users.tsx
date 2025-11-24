import { useEffect, useState } from "react";
import { User } from "@/shared/types";
import { Plus, Edit, Trash2, Loader2, Shield, User as UserIcon } from "lucide-react";
import { useAuth } from "@/react-app/contexts/AuthContext";
import * as bcrypt from "bcryptjs";
import { supabase } from "@/react-app/supabase";

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    is_super_user: false,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const showToast = (text: string, kind: "success" | "error") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const hashPassword = async (pwd: string) => bcrypt.hash(pwd, 10);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, username, name, is_super_user, is_active, created_at, updated_at")
        .eq("is_active", true);
      if (!error && Array.isArray(data)) {
        setUsers(data as User[]);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (editingUser) {
        const payload = {
          name: formData.name.toUpperCase(),
        };
        const { error: upErr } = await supabase
          .from("users")
          .update(payload)
          .eq("id", editingUser.id);
        if (upErr) {
          setError("Falha ao salvar");
          showToast("Falha ao salvar usuário", "error");
          return;
        } else {
          setError("");
        }
        if (currentUser?.is_super_user && formData.password) {
          const pwHash = await hashPassword(formData.password);
          const { error } = await supabase
            .from("users")
            .update({ password_hash: pwHash })
            .eq("id", editingUser.id);
          if (error) {
            setError("Falha ao salvar");
            showToast("Falha ao alterar senha", "error");
            return;
          }
        }
      } else {
        const payload = {
          username: formData.username.toUpperCase(),
          password: formData.password,
          name: formData.name.toUpperCase(),
          is_super_user: !!formData.is_super_user,
        };
        const pwHash = payload.password ? await hashPassword(payload.password) : "";
        const { error } = await supabase
          .from("users")
          .insert({
            username: payload.username,
            password_hash: pwHash,
            name: payload.name,
            is_super_user: !!payload.is_super_user,
            is_active: true,
          });
        if (error) {
          setError("Falha ao salvar");
          showToast("Falha ao salvar usuário", "error");
          return;
        } else {
          setError("");
        }
      }

      setShowModal(false);
      setEditingUser(null);
      setFormData({ username: "", password: "", name: "", is_super_user: false });
      fetchUsers();
      showToast(editingUser ? "Usuário atualizado" : "Usuário criado", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao salvar";
      setError(msg);
      showToast("Falha ao salvar usuário", "error");
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
        showToast("Falha ao desativar usuário", "error");
        return;
      }
      fetchUsers();
      showToast("Usuário desativado", "success");
    } catch (error) {
      console.error("Error deleting user:", error);
      showToast("Falha ao desativar usuário", "error");
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: "",
      name: user.name,
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Usuários</h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie os usuários do sistema</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({ username: "", password: "", name: "", is_super_user: false });
            setShowModal(true);
          }}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 shadow-xl overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="min-w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Usuário</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Nome</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Tipo</th>
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
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {user.id !== currentUser?.id && (
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

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {users.map((user) => (
          <div key={user.id} className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 shadow-xl">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg">
                  <UserIcon className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-slate-200 font-medium text-sm">{user.username}</h3>
                  <p className="text-slate-400 text-xs">{user.name}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEditModal(user)}
                  className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>
                {user.id !== currentUser?.id && (
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
              <span className="text-slate-400 text-xs">Tipo de Usuário</span>
              {user.is_super_user ? (
                <span className="flex items-center gap-1 text-yellow-400 text-xs">
                  <Shield className="w-3 h-3" />
                  Super Usuário
                </span>
              ) : (
                <span className="text-slate-400 text-xs">Usuário Comum</span>
              )}
            </div>
          </div>
        ))}
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
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toUpperCase() })}
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
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
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
