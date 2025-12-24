import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../contexts/AuthContext";
import {
    Search,
    Edit,
    ChevronUp,
    ChevronDown,
    Loader2,
    UserCircle,
} from "lucide-react";

interface Employee {
    id: number;
    full_name: string;
    arrival_date: string | null;
    departure_date: string | null;
    integration_date: string | null;
    observation: string | null;
    unit_id: number | null;
    accommodation_id: number | null;
    status_id: number;
    function_id: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface Unit {
    id: number;
    name: string;
}

interface Status {
    id: number;
    name: string;
}

interface Function {
    id: number;
    name: string;
}

interface Accommodation {
    id: number;
    name: string;
    unit_id: number;
}

export default function ListaFuncionarios() {
    const { user: currentUser, isLoading: authLoading } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [statuses, setStatuses] = useState<Status[]>([]);
    const [functions, setFunctions] = useState<Function[]>([]);
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortKey, setSortKey] = useState<keyof Employee | "unit" | "status" | "function" | "accommodation">("full_name");
    const [sortAsc, setSortAsc] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [formData, setFormData] = useState({
        full_name: "",
        status_id: 0,
        integration_date: "",
        accommodation_id: null as number | null,
    });

    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchUnits();
        fetchStatuses();
        fetchFunctions();
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (currentUser) {
                fetchEmployees();
                fetchAccommodations();
            } else {
                setIsLoading(false);
            }
        }
    }, [currentUser, authLoading]);

    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            const isSuper = currentUser?.is_super_user;
            let unitIds: number[] = [];
            if (!isSuper && currentUser?.id) {
                const { data: links } = await supabase
                    .from("usuarios_unidades")
                    .select("unit_id")
                    .eq("user_id", currentUser.id);
                unitIds = Array.isArray(links) ? (links as { unit_id: number }[]).map((l) => l.unit_id) : [];
            }

            // Get status IDs for "TRABALHANDO DISPONIVEL" and "INATIVO"
            const { data: statusData } = await supabase
                .from("status")
                .select("id, name")
                .in("name", ["TRABALHANDO DISPONIVEL", "INATIVO"]);

            if (!statusData || statusData.length === 0) {
                console.error("Statuses not found");
                setEmployees([]);
                return;
            }

            const statusIds = statusData.map(s => s.id);

            const base = supabase
                .from("funcionarios")
                .select(
                    "id, full_name, arrival_date, departure_date, integration_date, observation, unit_id, accommodation_id, status_id, function_id, is_active, created_at, updated_at"
                )
                .eq("is_active", true)
                .in("status_id", statusIds); // Filter by statuses

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
            const { data } = await supabase.from("unidades").select("id, name");
            if (Array.isArray(data)) setUnits(data as Unit[]);
        } catch (error) {
            console.error("Error fetching units:", error);
        }
    };

    const fetchStatuses = async () => {
        try {
            const { data } = await supabase.from("status").select("id, name").eq("is_active", true);
            if (Array.isArray(data)) setStatuses(data as Status[]);
        } catch (error) {
            console.error("Error fetching statuses:", error);
        }
    };

    const fetchFunctions = async () => {
        try {
            const { data } = await supabase.from("funcoes").select("id, name").eq("is_active", true);
            if (Array.isArray(data)) setFunctions(data as Function[]);
        } catch (error) {
            console.error("Error fetching functions:", error);
        }
    };

    const fetchAccommodations = async () => {
        try {
            const isSuper = currentUser?.is_super_user;
            let unitIds: number[] = [];
            if (!isSuper && currentUser?.id) {
                const { data: links } = await supabase
                    .from("usuarios_unidades")
                    .select("unit_id")
                    .eq("user_id", currentUser.id);
                unitIds = Array.isArray(links) ? (links as { unit_id: number }[]).map((l) => l.unit_id) : [];
            }
            const base = supabase
                .from("alojamentos")
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEmployee) return;

        try {
            const payload = {
                full_name: formData.full_name.toUpperCase(),
                status_id: formData.status_id,
                integration_date: formData.integration_date || null,
                accommodation_id: formData.accommodation_id,
            };

            const { error } = await supabase
                .from("funcionarios")
                .update(payload)
                .eq("id", editingEmployee.id);

            if (error) {
                showToast("Falha ao atualizar funcionário", "error");
                return;
            }
            showToast("Funcionário atualizado", "success");
            setShowModal(false);
            setEditingEmployee(null);
            fetchEmployees();
        } catch (error) {
            console.error("Error saving employee:", error);
            showToast("Falha ao salvar funcionário", "error");
        }
    };

    const openEditModal = (employee: Employee) => {
        setEditingEmployee(employee);
        setFormData({
            full_name: employee.full_name,
            status_id: employee.status_id,
            integration_date: employee.integration_date || "",
            accommodation_id: employee.accommodation_id,
        });
        setShowModal(true);
    };

    const displayedEmployees = (() => {
        const term = (searchTerm || "").toUpperCase();
        const filtered = employees.filter((e) => (e.full_name || "").toUpperCase().includes(term));
        const getFunctionName = (id: number | null) => functions.find((f) => f.id === id)?.name || "";
        const getUnitName = (id: number | null | undefined) => units.find((u) => u.id === (id ?? -1))?.name || "";
        const getStatusName = (id: number | null) => statuses.find((s) => s.id === id)?.name || "";

        const compare = (a: Employee, b: Employee) => {
            let va: string | number = "";
            let vb: string | number = "";
            if (sortKey === "full_name") {
                va = a.full_name || "";
                vb = b.full_name || "";
            } else if (sortKey === "function") {
                va = getFunctionName(a.function_id);
                vb = getFunctionName(b.function_id);
            } else if (sortKey === "unit") {
                va = getUnitName(a.unit_id);
                vb = getUnitName(b.unit_id);
            } else if (sortKey === "status") {
                va = getStatusName(a.status_id);
                vb = getStatusName(b.status_id);
            } else if (sortKey === "integration_date") {
                va = a.integration_date || "";
                vb = b.integration_date || "";
            }

            if (va < vb) return sortAsc ? -1 : 1;
            if (va > vb) return sortAsc ? 1 : -1;
            return 0;
        };
        return filtered.slice().sort(compare);
    })();

    if (isLoading || authLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {toast && (
                <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"}`}>
                    {toast.text}
                </div>
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Lista de Funcionários</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Visualize e edite informações básicas</p>
                </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700 w-full md:w-fit">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                    className="bg-transparent border-none text-slate-200 placeholder-slate-500 focus:outline-none w-full md:w-64"
                    placeholder="Buscar por nome"
                />
            </div>

            <div className="hidden md:block bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-700/50">
                            <tr>
                                {[
                                    { key: "arrival_date", label: "Chegada á Obra" },
                                    { key: "integration_date", label: "Data Integração" },
                                    { key: "full_name", label: "Nome" },
                                    { key: "accommodation", label: "Alojamento" },
                                    { key: "function", label: "Função" },
                                    { key: "unit", label: "Unidade" },
                                ].map((col) => (
                                    <th key={col.key} className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortKey === col.key) setSortAsc(!sortAsc);
                                                else { setSortKey(col.key as any); setSortAsc(true); }
                                            }}
                                            className="flex items-center justify-center gap-1 hover:text-slate-100 w-full"
                                        >
                                            <span>{col.label}</span>
                                            {sortKey === col.key ? (sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : null}
                                        </button>
                                    </th>
                                ))}
                                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {displayedEmployees.map((employee) => {
                                const isInactive = statuses.find(s => s.id === employee.status_id)?.name === "INATIVO";
                                const rowTextClass = isInactive ? "text-red-400" : "text-slate-300";
                                const nameTextClass = isInactive ? "text-red-400" : "text-slate-200";
                                const iconClass = isInactive ? "text-red-400" : "text-blue-400";

                                return (
                                    <tr key={employee.id} className={`hover:bg-slate-800/30 transition-colors ${isInactive ? "bg-red-500/5" : ""}`}>
                                        <td className={`px-6 py-4 text-center font-mono text-sm ${rowTextClass}`}>
                                            {employee.arrival_date ? new Date(employee.arrival_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}
                                        </td>
                                        <td className={`px-6 py-4 text-center font-mono text-sm ${rowTextClass}`}>
                                            {employee.integration_date ? new Date(employee.integration_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <UserCircle className={`w-5 h-5 ${iconClass}`} />
                                                <span className={`font-medium ${nameTextClass}`}>{employee.full_name}</span>
                                            </div>
                                        </td>
                                        <td className={`px-6 py-4 text-center ${rowTextClass}`}>
                                            {accommodations.find((a) => a.id === employee.accommodation_id)?.name || "-"}
                                        </td>
                                        <td className={`px-6 py-4 text-center ${rowTextClass}`}>
                                            {functions.find((f) => f.id === employee.function_id)?.name || "-"}
                                        </td>
                                        <td className={`px-6 py-4 text-center ${rowTextClass}`}>
                                            {units.find((u) => u.id === employee.unit_id)?.name || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <button
                                                onClick={() => openEditModal(employee)}
                                                className={`p-2 rounded-lg transition-all ${isInactive ? "text-red-400 hover:bg-red-500/10" : "text-blue-400 hover:bg-blue-500/10"}`}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {displayedEmployees.map((employee) => {
                    const isInactive = statuses.find(s => s.id === employee.status_id)?.name === "INATIVO";
                    const iconClass = isInactive ? "text-red-400" : "text-blue-400";
                    const nameTextClass = isInactive ? "text-red-400" : "text-slate-100";

                    return (
                        <div key={employee.id} className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                            {/* Header Section */}
                            <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="p-2 bg-slate-800 rounded-lg shrink-0">
                                            <UserCircle className={`w-6 h-6 ${iconClass}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className={`font-semibold text-base truncate ${nameTextClass}`}>{employee.full_name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-mono text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded">
                                                    {employee.arrival_date ? new Date(employee.arrival_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="p-4 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Função</p>
                                    <p className="text-slate-200 text-sm font-medium truncate">
                                        {functions.find((f) => f.id === employee.function_id)?.name || "-"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Unidade</p>
                                    <p className="text-slate-200 text-sm font-medium truncate">
                                        {units.find((u) => u.id === employee.unit_id)?.name || "-"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Alojamento</p>
                                    <p className="text-slate-200 text-sm font-medium truncate">
                                        {accommodations.find((a) => a.id === employee.accommodation_id)?.name || "-"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">Status</p>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statuses.find((s) => s.id === employee.status_id)?.name === "TRABALHANDO DISPONIVEL"
                                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                        : isInactive
                                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                            : "bg-slate-700/50 text-slate-300 border border-slate-600/50"
                                        }`}>
                                        {statuses.find((s) => s.id === employee.status_id)?.name || "-"}
                                    </span>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="px-4 py-3 bg-slate-800/20 border-t border-slate-700/50 flex justify-end gap-2">
                                <button
                                    onClick={() => openEditModal(employee)}
                                    className="flex-1 flex items-center justify-center gap-2 p-2 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 rounded-lg transition-all active:scale-95"
                                >
                                    <Edit className="w-4 h-4" />
                                    <span className="text-xs font-medium">Editar</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-slate-100 mb-4">Editar Funcionário</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Nome Completo</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Alojamento</label>
                                <select
                                    value={formData.accommodation_id || ""}
                                    onChange={(e) => setFormData({ ...formData, accommodation_id: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                    <option value="">Nenhum</option>
                                    {accommodations.map((acc) => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                                <select
                                    value={formData.status_id || ""}
                                    onChange={(e) => setFormData({ ...formData, status_id: e.target.value ? parseInt(e.target.value) : 0 })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                    {statuses
                                        .filter(s => ["TRABALHANDO DISPONIVEL", "INATIVO"].includes(s.name))
                                        .map((status) => (
                                            <option key={status.id} value={status.id}>{status.name}</option>
                                        ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Data Integração</label>
                                <input
                                    type="date"
                                    value={formData.integration_date}
                                    onChange={(e) => setFormData({ ...formData, integration_date: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
