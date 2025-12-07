import { useEffect, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Plus, Edit, Trash2, Loader2, UserCircle, ChevronUp, ChevronDown, Search } from "lucide-react";

type Cleaner = {
    id: number;
    arrival_date: string | null;
    full_name: string;
    cpf: string | null;
    pix: string | null;
    agreed_salary: number | null;
    observation: string | null;
    user_id: number | null;
    created_at: string;
    is_active: boolean;
};

export default function Cleaners() {
    const { user: currentUser } = useAuth();
    const [cleaners, setCleaners] = useState<Cleaner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCleaner, setEditingCleaner] = useState<Cleaner | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortKey, setSortKey] = useState<"full_name" | "arrival_date" | "agreed_salary">("full_name");
    const [sortAsc, setSortAsc] = useState(true);
    const [formData, setFormData] = useState({
        full_name: "",
        arrival_date: "",
        cpf: "",
        pix: "",
        agreed_salary: "",
        observation: "",
    });
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchCleaners();
    }, []);

    const fetchCleaners = async () => {
        try {
            const { data, error } = await supabase
                .from("cleaners")
                .select("*")
                .eq("is_active", true)
                .order("full_name");

            if (!error && Array.isArray(data)) {
                setCleaners(data as Cleaner[]);
            } else {
                setCleaners([]);
            }
        } catch (error) {
            console.error("Error fetching cleaners:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                full_name: formData.full_name.toUpperCase(),
                arrival_date: formData.arrival_date || null,
                cpf: formData.cpf || null,
                pix: formData.pix || null,
                agreed_salary: formData.agreed_salary ? parseFloat(formData.agreed_salary) : null,
                observation: formData.observation ? formData.observation.toUpperCase() : null,
                user_id: currentUser?.id,
            };

            if (editingCleaner) {
                const { error } = await supabase
                    .from("cleaners")
                    .update(payload)
                    .eq("id", editingCleaner.id);
                if (error) throw error;
                showToast("Faxineira atualizada!", "success");
            } else {
                const { error } = await supabase.from("cleaners").insert(payload);
                if (error) throw error;
                showToast("Faxineira cadastrada!", "success");
            }

            setShowModal(false);
            setEditingCleaner(null);
            resetForm();
            fetchCleaners();
        } catch (error) {
            console.error("Error saving cleaner:", error);
            showToast("Erro ao salvar faxineira.", "error");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Deseja realmente excluir esta faxineira?")) return;
        try {
            const { error } = await supabase
                .from("cleaners")
                .update({ is_active: false })
                .eq("id", id);
            if (error) throw error;
            showToast("Faxineira excluída!", "success");
            fetchCleaners();
        } catch (error) {
            console.error("Error deleting cleaner:", error);
            showToast("Erro ao excluir faxineira.", "error");
        }
    };

    const openEditModal = (cleaner: Cleaner) => {
        setEditingCleaner(cleaner);
        setFormData({
            full_name: cleaner.full_name,
            arrival_date: cleaner.arrival_date || "",
            cpf: cleaner.cpf || "",
            pix: cleaner.pix || "",
            agreed_salary: cleaner.agreed_salary?.toString() || "",
            observation: cleaner.observation || "",
        });
        setShowModal(true);
    };

    const openNewModal = () => {
        setEditingCleaner(null);
        resetForm();
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({
            full_name: "",
            arrival_date: "",
            cpf: "",
            pix: "",
            agreed_salary: "",
            observation: "",
        });
    };

    const handleSort = (key: typeof sortKey) => {
        if (sortKey === key) {
            setSortAsc(!sortAsc);
        } else {
            setSortKey(key);
            setSortAsc(true);
        }
    };

    const filteredCleaners = cleaners.filter((c) =>
        c.full_name.toUpperCase().includes(searchTerm.toUpperCase())
    );

    const sortedCleaners = [...filteredCleaners].sort((a, b) => {
        let aVal: any = a[sortKey];
        let bVal: any = b[sortKey];

        if (sortKey === "arrival_date") {
            aVal = aVal ? new Date(aVal).getTime() : 0;
            bVal = bVal ? new Date(bVal).getTime() : 0;
        } else if (sortKey === "agreed_salary") {
            aVal = aVal || 0;
            bVal = bVal || 0;
        } else {
            aVal = (aVal || "").toString().toUpperCase();
            bVal = (bVal || "").toString().toUpperCase();
        }

        if (aVal < bVal) return sortAsc ? -1 : 1;
        if (aVal > bVal) return sortAsc ? 1 : -1;
        return 0;
    });

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
                    className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${toast.kind === "success"
                            ? "bg-green-500/10 border border-green-500/50 text-green-400"
                            : "bg-red-500/10 border border-red-500/50 text-red-400"
                        }`}
                >
                    {toast.text}
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Faxineiras</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">
                        Gerencie as faxineiras cadastradas
                    </p>
                </div>
                <button
                    onClick={openNewModal}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-5 h-5" />
                    <span className="hidden md:inline">Nova Faxineira</span>
                </button>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="p-4 border-b border-slate-700/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar faxineira..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800/50">
                            <tr>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                                    onClick={() => handleSort("full_name")}
                                >
                                    <div className="flex items-center gap-2">
                                        Nome Completo
                                        {sortKey === "full_name" &&
                                            (sortAsc ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            ))}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                                    onClick={() => handleSort("arrival_date")}
                                >
                                    <div className="flex items-center gap-2">
                                        Chegada à Obra
                                        {sortKey === "arrival_date" &&
                                            (sortAsc ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            ))}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    CPF
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                                    onClick={() => handleSort("agreed_salary")}
                                >
                                    <div className="flex items-center gap-2">
                                        Salário
                                        {sortKey === "agreed_salary" &&
                                            (sortAsc ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            ))}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {sortedCleaners.map((cleaner) => (
                                <tr key={cleaner.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-3 text-sm text-slate-300">{cleaner.full_name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {cleaner.arrival_date
                                            ? new Date(cleaner.arrival_date).toLocaleDateString("pt-BR", {
                                                timeZone: "UTC",
                                            })
                                            : "-"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{cleaner.cpf || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {cleaner.agreed_salary
                                            ? new Intl.NumberFormat("pt-BR", {
                                                style: "currency",
                                                currency: "BRL",
                                            }).format(cleaner.agreed_salary)
                                            : "-"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(cleaner)}
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cleaner.id)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Excluir"
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

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-700/50">
                    {sortedCleaners.map((cleaner) => (
                        <div key={cleaner.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                        <UserCircle className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-slate-200">{cleaner.full_name}</h3>
                                        <p className="text-xs text-slate-500">
                                            {cleaner.arrival_date
                                                ? new Date(cleaner.arrival_date).toLocaleDateString("pt-BR", {
                                                    timeZone: "UTC",
                                                })
                                                : "Sem data"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEditModal(cleaner)}
                                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cleaner.id)}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-slate-500">CPF:</span>
                                    <span className="ml-2 text-slate-300">{cleaner.cpf || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Salário:</span>
                                    <span className="ml-2 text-slate-300">
                                        {cleaner.agreed_salary
                                            ? new Intl.NumberFormat("pt-BR", {
                                                style: "currency",
                                                currency: "BRL",
                                            }).format(cleaner.agreed_salary)
                                            : "-"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {sortedCleaners.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        {searchTerm ? "Nenhuma faxineira encontrada." : "Nenhuma faxineira cadastrada."}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingCleaner ? "Editar Faxineira" : "Nova Faxineira"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Nome Completo *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.full_name}
                                        onChange={(e) =>
                                            setFormData({ ...formData, full_name: e.target.value.toUpperCase() })
                                        }
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Chegada à Obra
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.arrival_date}
                                        onChange={(e) => setFormData({ ...formData, arrival_date: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">CPF</label>
                                    <input
                                        type="text"
                                        value={formData.cpf}
                                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">PIX</label>
                                    <input
                                        type="text"
                                        value={formData.pix}
                                        onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Salário Combinado
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.agreed_salary}
                                        onChange={(e) => setFormData({ ...formData, agreed_salary: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Observação</label>
                                    <textarea
                                        value={formData.observation}
                                        onChange={(e) =>
                                            setFormData({ ...formData, observation: e.target.value.toUpperCase() })
                                        }
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[80px]"
                                    />
                                </div>
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
                                    {editingCleaner ? "Salvar Alterações" : "Cadastrar"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
