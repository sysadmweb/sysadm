import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/react-app/supabase";
import {
  Loader2,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  UserCircle,
  Home,
  Briefcase,
  Tag,
  Activity,
  ClipboardCheck,
  Clock,
  FileText,
  Utensils,
  Fuel,
  ShoppingCart,
  Upload,
  Package,
  Users,
  Building2,
  UserLock,
  RefreshCcw,
  Settings,
} from "lucide-react";
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

type PageDefinition = {
  key: string;
  label: string;
  icon: any;
  children?: PageDefinition[];
}

export default function Permissoes() {
  const { user } = useAuth();
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [perms, setPerms] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Define hierarchy matching Layout.tsx
  const menuStructure: PageDefinition[] = useMemo(() => [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      key: "employees",
      label: "Funcionários",
      icon: UserCircle,
      children: [
        { key: "employees_integration", label: "Integração", icon: UserCircle },
        { key: "employees_list", label: "Lista de funcionários", icon: UserCircle },
        { key: "employees_transfer", label: "Transferência", icon: UserCircle },
        { key: "employees_transfers_list", label: "Histórico de Transferências", icon: UserCircle },
      ]
    },
    { key: "accommodations", label: "Alojamentos", icon: Home },
    { key: "functions", label: "Funções", icon: Briefcase },
    { key: "categories", label: "Categorias", icon: Tag },
    { key: "status", label: "Status", icon: Activity },
    { key: "inspection", label: "Vistorias", icon: ClipboardCheck },
    { key: "jornada", label: "Jornada", icon: Clock },
    { key: "reports", label: "Relatórios", icon: FileText },
    { key: "meals", label: "Refeição", icon: Utensils },
    { key: "abastecimento", label: "Abastecimento", icon: Fuel },
    { key: "devolucao", label: "Devolução", icon: RefreshCcw },
    {
      key: "purchases",
      label: "Compras",
      icon: ShoppingCart,
      children: [
        { key: "purchases_xml", label: "Lançar XML", icon: Upload },
        { key: "manual_purchases", label: "Lançamento Avulso", icon: FileText },
        { key: "purchases_view", label: "Visualizar Nota", icon: FileText },
      ]
    },
    {
      key: "stock",
      label: "Estoque",
      icon: Package,
      children: [
        { key: "stock", label: "Cadastro de Produto", icon: Package },
        { key: "product_movement", label: "Movimentação", icon: Package },
      ]
    },
    { key: "cleaners", label: "Faxineiras", icon: Users },
    { key: "units", label: "Unidades", icon: Building2 },
    { key: "users", label: "Usuários", icon: Users },
    { key: "permissions", label: "Regras", icon: UserLock },
    { key: "settings", label: "Configurações", icon: Settings },
  ], []);

  // Recursively extract all page keys for loading permissions
  const pages = useMemo(() => {
    const list: string[] = [];
    const traverse = (items: PageDefinition[]) => {
      items.forEach(item => {
        list.push(item.key);
        if (item.children) traverse(item.children);
      });
    };
    traverse(menuStructure);
    return list;
  }, [menuStructure]);

  useEffect(() => {
    const load = async () => {
      const { data: usersData } = await supabase
        .from("usuarios")
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
        .from("permissoes_usuario")
        .select("id, user_id, page, can_view, can_create, can_update, can_delete, is_active")
        .eq("user_id", selectedUserId)
        .eq("is_active", true);
      const existing = Array.isArray(data) ? (data as UserPermission[]) : [];
      const byPage = new Map(existing.map((p) => [p.page, p]));

      // Use Set to avoid duplicates if keys are repeated in structure (though they shouldn't be)
      const uniquePages = Array.from(new Set(pages));

      const normalized: UserPermission[] = uniquePages.map((page) => {
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

  const updatePerm = async (page: string, key: keyof Pick<UserPermission, "can_view" | "can_create" | "can_update" | "can_delete">, value: boolean) => {
    const idx = perms.findIndex(p => p.page === page);
    if (idx === -1) return;

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
      await supabase.from("permissoes_usuario").upsert(payload, { onConflict: "user_id,page" });
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
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

  // Recursive renderer for table rows
  const renderRows = (items: PageDefinition[], level = 0) => {
    return items.map(item => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedGroups.includes(item.key);
      const perm = perms.find(p => p.page === item.key);

      // If permission object is missing (shouldn't happen due to normalization), skip
      if (!perm) return null;

      // Indentation logic
      const paddingLeft = level * 20 + 24; // Base 24px + 20px per level

      return (
        <React.Fragment key={item.key}>
          <tr className={`hover:bg-slate-800/30 transition-colors ${level > 0 ? "bg-slate-900/20" : ""}`}>
            <td className="py-3 pr-6 text-slate-300" style={{ paddingLeft: `${paddingLeft}px` }}>
              <div className="flex items-center gap-3">
                {/* Expand Toggle or Spacer */}
                {hasChildren ? (
                  <button
                    onClick={() => toggleGroup(item.key)}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                  >
                    {isExpanded ?
                      <ChevronDown className="w-4 h-4 text-slate-400" /> :
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    }
                  </button>
                ) : (
                  // If it's a child (level > 0), show a visual tree line endpoint or just space
                  // Sidebar usually has simple indentation. We'll use a spacer that matches the button size.
                  <div className="w-6 h-6 flex items-center justify-center">
                    {level > 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />}
                  </div>
                )}

                {/* Icon */}
                <item.icon className={`w-5 h-5 ${level === 0 ? "text-blue-400" : "text-slate-500"}`} />

                {/* Label */}
                <span className={`${level === 0 ? "font-medium text-slate-200" : "text-slate-400"}`}>
                  {item.label}
                </span>
              </div>
            </td>

            {/* Checkboxes */}
            <td className="px-6 py-3 text-center">
              <input
                type="checkbox"
                checked={perm.can_view}
                onChange={(e) => updatePerm(item.key, "can_view", e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
              />
            </td>
            <td className="px-6 py-3 text-center">
              <input
                type="checkbox"
                checked={perm.can_create}
                onChange={(e) => updatePerm(item.key, "can_create", e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
              />
            </td>
            <td className="px-6 py-3 text-center">
              <input
                type="checkbox"
                checked={perm.can_update}
                onChange={(e) => updatePerm(item.key, "can_update", e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
              />
            </td>
            <td className="px-6 py-3 text-center">
              <input
                type="checkbox"
                checked={perm.can_delete}
                onChange={(e) => updatePerm(item.key, "can_delete", e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
              />
            </td>
          </tr>

          {/* Recursive Children Rendering */}
          {hasChildren && isExpanded && (
            renderRows(item.children!, level + 1)
          )}
        </React.Fragment>
      );
    });
  };

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

      <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
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
            {renderRows(menuStructure)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
