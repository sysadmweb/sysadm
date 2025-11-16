import { useEffect, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Shield, Save, ArrowLeft, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router";

type PermRow = { page: string; can_view: boolean; can_create: boolean; can_update: boolean; can_delete: boolean };

const PAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "employees", label: "Funcionários" },
  { key: "accommodations", label: "Alojamentos" },
  { key: "rooms", label: "Quartos" },
  { key: "functions", label: "Funções" },
  { key: "units", label: "Unidades" },
  { key: "users", label: "Usuários" },
];

export default function UserPermissionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  type UserLite = { id: number; name: string; username: string };
  const [users, setUsers] = useState<UserLite[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [perms, setPerms] = useState<Record<string, PermRow>>(() => {
    const o: Record<string, PermRow> = {};
    for (const p of PAGES) o[p.key] = { page: p.key, can_view: true, can_create: true, can_update: true, can_delete: true };
    return o;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      const { data } = await supabase
        .from("users")
        .select("id, name, username")
        .eq("is_super_user", false)
        .eq("is_active", true)
        .order("name");
      setUsers(Array.isArray(data) ? (data as UserLite[]) : []);
    };
    loadUsers();
  }, []);

  useEffect(() => {
    const loadPerms = async () => {
      if (!selectedUserId) return;
      const { data } = await supabase
        .from("user_permissions")
        .select("page, can_view, can_create, can_update, can_delete")
        .eq("user_id", selectedUserId)
        .eq("is_active", true);
      const m: Record<string, PermRow> = { ...perms };
      if (Array.isArray(data)) {
        for (const p of PAGES) m[p.key] = m[p.key] || { page: p.key, can_view: true, can_create: true, can_update: true, can_delete: true };
        (data as { page: string; can_view: boolean; can_create: boolean; can_update: boolean; can_delete: boolean }[]).forEach((row) => {
          m[row.page] = {
            page: row.page,
            can_view: !!row.can_view,
            can_create: !!row.can_create,
            can_update: !!row.can_update,
            can_delete: !!row.can_delete,
          };
        });
      }
      setPerms(m);
    };
    loadPerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  if (!user?.is_super_user) {
    return (
      <div className="max-w-md mx-auto bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mt-10">
        <div className="flex items-center gap-2 text-yellow-400 mb-4">
          <Shield className="w-5 h-5" />
          <span>Acesso permitido apenas para Super Usuário</span>
        </div>
        <button onClick={() => navigate("/dashboard")} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">
          <ArrowLeft className="w-4 h-4 inline mr-2" /> Voltar
        </button>
      </div>
    );
  }

  const setFlag = (key: string, field: keyof PermRow, value: boolean) => {
    setPerms((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const save = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setError("");
    try {
      const rows = PAGES.map((p) => ({
        user_id: selectedUserId,
        page: p.key,
        can_view: perms[p.key]?.can_view ?? true,
        can_create: perms[p.key]?.can_create ?? true,
        can_update: perms[p.key]?.can_update ?? true,
        can_delete: perms[p.key]?.can_delete ?? true,
        is_active: true,
      }));
      const { error } = await supabase.from("user_permissions").upsert(rows, { onConflict: "user_id,page" });
      if (error) {
        setError(error.message || "Falha ao salvar");
      } else {
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {toastVisible && (
        <div className="fixed top-4 right-4 z-50">
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/90 border border-green-500/40 text-green-300 rounded-lg shadow-xl">
            <CheckCircle className="w-5 h-5" />
            <span>Permissões atualizadas com sucesso</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Regras de Usuário</h1>
          <p className="text-slate-400 mt-1">Defina acesso por tela e ações</p>
        </div>
        <button onClick={() => navigate("/dashboard")} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">
          <ArrowLeft className="w-4 h-4 inline mr-2" /> Voltar
        </button>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 shadow-xl">
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Usuário</label>
          <select
            value={selectedUserId ?? ''}
            onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
            className="w-full px-3 py-2 bg-slate-800 text-slate-200 rounded-lg"
          >
            <option value="">Selecione um usuário</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.username})
              </option>
            ))}
          </select>
        </div>

        {selectedUserId && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Tela</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">Ver</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">Cadastrar</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">Alterar</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {PAGES.map((p) => (
                  <tr key={p.key} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-200">{p.label}</td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={!!perms[p.key]?.can_view} onChange={(e) => setFlag(p.key, "can_view", e.target.checked)} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={!!perms[p.key]?.can_create} onChange={(e) => setFlag(p.key, "can_create", e.target.checked)} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={!!perms[p.key]?.can_update} onChange={(e) => setFlag(p.key, "can_update", e.target.checked)} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={!!perms[p.key]?.can_delete} onChange={(e) => setFlag(p.key, "can_delete", e.target.checked)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-4 gap-3">
              {error && <div className="text-red-400 text-sm">{error}</div>}
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50">
                <Save className="w-4 h-4 inline mr-2" /> Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}