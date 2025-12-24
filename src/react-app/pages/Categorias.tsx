import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Loader2, Tag } from "lucide-react";
import { supabase } from "@/react-app/supabase";

interface Category {
    id: number;
    name: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export default function Categorias() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({ name: "" });
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from("categorias")
                .select("id, name, is_active, created_at, updated_at")
                .eq("is_active", true);
            if (!error && Array.isArray(data)) {
                setCategories(data as Category[]);
            } else {
                setCategories([]);
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const payload = { name: formData.name.toUpperCase() };
            if (editingCategory) {
                const { error } = await supabase
                    .from("categorias")
                    .update({ name: payload.name })
                    .eq("id", editingCategory.id);
                if (error) {
                    showToast("Falha ao salvar categoria", "error");
                    return;
                }
                showToast("Categoria atualizada", "success");
            } else {
                const { error } = await supabase
                    .from("categorias")
                    .insert({ name: payload.name, is_active: true });
                if (error) {
                    showToast("Falha ao cadastrar categoria", "error");
                    return;
                }
                showToast("Categoria criada", "success");
            }

            setShowModal(false);
            setEditingCategory(null);
            setFormData({ name: "" });
            fetchCategories();
        } catch (error) {
            console.error("Error saving category:", error);
            showToast("Falha ao salvar categoria", "error");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja desativar esta categoria?")) return;

        try {
            const { error } = await supabase
                .from("categorias")
                .update({ is_active: false })
                .eq("id", id);
            if (error) {
                showToast("Falha ao desativar categoria", "error");
                return;
            }
            showToast("Categoria desativada", "success");
            fetchCategories();
        } catch (error) {
            console.error("Error deleting category:", error);
            showToast("Falha ao desativar categoria", "error");
        }
    };

    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setFormData({ name: category.name });
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
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Categorias</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie as categorias do sistema</p>
                </div>
                <button
                    onClick={() => {
                        setEditingCategory(null);
                        setFormData({ name: "" });
                        setShowModal(true);
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Nova Categoria
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((category) => (
                    <div
                        key={category.id}
                        className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-purple-500/10 rounded-lg">
                                <Tag className="w-6 h-6 text-purple-400" />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEditModal(category)}
                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(category.id)}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-slate-100 mb-2">{category.name}</h3>
                        <p className="text-sm text-slate-400">
                            Criado em {new Date(category.created_at).toLocaleDateString("pt-BR")}
                        </p>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-slate-100 mb-4">
                            {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Nome da Categoria
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
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
