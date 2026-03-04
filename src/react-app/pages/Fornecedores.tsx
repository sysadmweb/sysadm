import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Loader2, Truck, Phone, User, Tag, FileText } from "lucide-react";
import { supabase } from "@/react-app/supabase";
import { Fornecedor, Category } from "@/shared/types";

export default function Fornecedores() {
    const [suppliers, setSuppliers] = useState<Fornecedor[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Fornecedor | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        category_id: "" as string | number,
        phone: "",
        responsible: "",
        observation: ""
    });
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        Promise.all([fetchSuppliers(), fetchCategories()]);
    }, []);

    const fetchCategories = async () => {
        const { data } = await supabase
            .from("categorias")
            .select("*")
            .eq("is_active", true)
            .order("name");
        if (data) setCategories(data);
    };

    const fetchSuppliers = async () => {
        try {
            const { data, error } = await supabase
                .from("fornecedores")
                .select("*, categorias(name)")
                .order("name");
            if (!error && Array.isArray(data)) {
                setSuppliers(data);
            } else {
                setSuppliers([]);
            }
        } catch (error) {
            console.error("Error fetching suppliers:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const payload = {
                name: formData.name.toUpperCase(),
                category_id: formData.category_id ? Number(formData.category_id) : null,
                phone: formData.phone,
                responsible: formData.responsible,
                observation: formData.observation,
                is_active: true
            };

            if (editingSupplier) {
                const { error } = await supabase
                    .from("fornecedores")
                    .update(payload)
                    .eq("id", editingSupplier.id);
                if (error) throw error;
                showToast("Fornecedor atualizado", "success");
            } else {
                const { error } = await supabase
                    .from("fornecedores")
                    .insert(payload);
                if (error) throw error;
                showToast("Fornecedor cadastrado", "success");
            }

            setShowModal(false);
            setEditingSupplier(null);
            setFormData({ name: "", category_id: "", phone: "", responsible: "", observation: "" });
            fetchSuppliers();
        } catch (error) {
            console.error("Error saving supplier:", error);
            showToast("Falha ao salvar fornecedor", "error");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja desativar este fornecedor?")) return;

        try {
            const { error } = await supabase
                .from("fornecedores")
                .update({ is_active: false })
                .eq("id", id);
            if (error) throw error;
            showToast("Fornecedor desativado", "success");
            fetchSuppliers();
        } catch (error) {
            console.error("Error deleting supplier:", error);
            showToast("Falha ao desativar fornecedor", "error");
        }
    };

    const openEditModal = (supplier: Fornecedor) => {
        setEditingSupplier(supplier);
        setFormData({
            name: supplier.name,
            category_id: supplier.category_id || "",
            phone: supplier.phone || "",
            responsible: supplier.responsible || "",
            observation: supplier.observation || ""
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
                    className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-[60] ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"
                        }`}
                >
                    {toast.text}
                </div>
            )}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Fornecedores</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie os fornecedores do sistema</p>
                </div>
                <button
                    onClick={() => {
                        setEditingSupplier(null);
                        setFormData({ name: "", category_id: "", phone: "", responsible: "", observation: "" });
                        setShowModal(true);
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Novo Fornecedor
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {suppliers.filter(s => s.is_active).map((supplier: any) => (
                    <div
                        key={supplier.id}
                        className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-lg">
                                <Truck className="w-6 h-6 text-blue-400" />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEditModal(supplier)}
                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(supplier.id)}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-slate-100 mb-4">{supplier.name}</h3>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm text-slate-400">
                                <Tag className="w-4 h-4 text-purple-400" />
                                <span>{supplier.categorias?.name || 'Sem Categoria'}</span>
                            </div>
                            {supplier.phone && (
                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                    <Phone className="w-4 h-4 text-green-400" />
                                    <span>{supplier.phone}</span>
                                </div>
                            )}
                            {supplier.responsible && (
                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                    <User className="w-4 h-4 text-orange-400" />
                                    <span>{supplier.responsible}</span>
                                </div>
                            )}
                            {supplier.observation && (
                                <div className="flex items-start gap-3 text-sm text-slate-400">
                                    <FileText className="w-4 h-4 text-slate-500 mt-1" />
                                    <span className="line-clamp-2">{supplier.observation}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-100">
                                {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Nome do Fornecedor *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Categoria *
                                    </label>
                                    <select
                                        value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Telefone
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Responsável
                                </label>
                                <input
                                    type="text"
                                    value={formData.responsible}
                                    onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Observação
                                </label>
                                <textarea
                                    value={formData.observation}
                                    onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all font-medium shadow-lg shadow-blue-500/20"
                                >
                                    Salvar Fornecedor
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
