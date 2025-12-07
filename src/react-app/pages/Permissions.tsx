import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/react-app/contexts/AuthContext";

type SimpleUser = {
  id: number;
  username: string;
  name: string;
  is_super_user: boolean;
  is_active: boolean;
};

type UserPermission = {
  id: number;
  user_id: number;
  page: string;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  is_active: boolean;
};

export default function Permissions() {
  const { user } = useAuth();
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [perms, setPerms] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const pages = useMemo(
    () => [
      "dashboard",
      "employees",
      "employees_integration",
      "employees_list",
      "employees_transfer",
      "accommodations",
      "rooms",
      "functions",
      "units",
      "users",
      "permissions",
      "purchases",
      "manual_purchases",
      "categories",
      "jornada",
      "stock",
    ],
    []
  );

  const pageLabels: Record<string, string> = {
    dashboard: "Dashboard",
    employees: "Funcionários (Menu)",
    employees_integration: "Integração",
    employees_list: "Lista de Funcionários",
    employees_transfer: "Transferência",
    accommodations: "Alojamentos",
    rooms: "Quartos",
    functions: "Funções",
    units: "Unidades",
    users: "Usuários",
    permissions: "Regras",
    purchases: "Compras",
    manual_purchases: "Lançamento Avulso",
    categories: "Categorias",
    jornada: "Jornada",
    stock: "Estoque",
  };

  useEffect(() => {
    const load = async () => {
      const { data: usersData } = await supabase
        .from("users")
        .select("id, username, name, is_super_user, is_active")
        .eq("is_active", true);
      const list = Array.isArray(usersData)
        ? (usersData as SimpleUser[])
        : [];
      setUsers(list);
      const first = list.find((u) => !u.is_super_user)?.id ?? list[0]?.id ?? null;
      setSelectedUserId(first);
      setIsLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const loadPerms = async () => {
      if (!selectedUserId) {
        setPerms([]);
        return;
      }
      const { data } = await supabase
        .from("user_permissions")
        .select("id, user_id, page, can_view, can_create, can_update, can_delete, is_active")
        .eq("user_id", selectedUserId)
        .eq("is_active", true);
      const existing = Array.isArray(data) ? (data as UserPermission[]) : [];
      const byPage = new Map(existing.map((p) => [p.page, p]));
      const normalized: UserPermission[] = pages.map((page) => {
        const found = byPage.get(page);
        return found ?? {
          id: 0,
          user_id: selectedUserId,
          page,
          can_view: true,
          can_create: true,
          can_update: true,
          can_delete: true,
          is_active: true,
        };
      });
      setPerms(normalized);
    };
    loadPerms();
  }, [selectedUserId, pages]);

  const updatePerm = async (idx: number, key: keyof Pick<UserPermission, "can_view" | "can_create" | "can_update" | "can_delete">, value: boolean) => {
    const row = perms[idx];
    const next = { ...row, [key]: value };
    const copy = [...perms];
    copy[idx] = next;
    setPerms(copy);
    setSaving(true);
    try {
      const payload = {
        user_id: next.user_id,
        page: next.page,
        can_view: next.can_view,
        can_create: next.can_create,
        can_update: next.can_update,
        can_delete: next.can_delete,
        is_active: true,
      };
      await supabase.from("user_permissions").upsert(payload, { onConflict: "user_id,page" });
    } finally {
      setSaving(false);
    }
  };

  if (!user?.is_super_user) {
    return <div className="flex items-center justify-center h-96 text-slate-300">Sem acesso</div>;
  }

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
          <h1 className="text-3xl font-bold text-slate-100">Regras de Usuário</h1>
          <p className="text-slate-400 mt-1">Defina permissões por página</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 rounded-lg">
          <ShieldCheck className="w-5 h-5" />
          {saving ? <span className="text-blue-400">Salvando...</span> : <span>Pronto</span>}
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <label className="text-slate-300">Usuário</label>
        <select
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
          value={selectedUserId ?? undefined}
          onChange={(e) => setSelectedUserId(parseInt(e.target.value))}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username} - {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-x-auto shadow-xl">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Página</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Ver</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Criar</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Editar</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Excluir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {perms.map((p, idx) => (
              <tr key={`${p.user_id}-${p.page}`} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 text-slate-300">{pageLabels[p.page] || p.page}</td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={p.can_view}
                    onChange={(e) => updatePerm(idx, "can_view", e.target.checked)}
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={p.can_create}
                    onChange={(e) => updatePerm(idx, "can_create", e.target.checked)}
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={p.can_update}
                    onChange={(e) => updatePerm(idx, "can_update", e.target.checked)}
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={p.can_delete}
                    onChange={(e) => updatePerm(idx, "can_delete", e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}