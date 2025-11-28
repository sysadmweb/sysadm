import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Loader2, DollarSign } from "lucide-react";
import { supabase } from "@/react-app/supabase";

interface ManualPurchase {
    id: number;
    category_id: number;
    description: string;
    unit_value: number;
    quantity: number;
    total_value: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    categories?: { name: string };
}

interface Category {
    id: number;
    name: string;
}

export default function ManualPurchases() {
    const [purchases, setPurchases] = useState<ManualPurchase[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState<ManualPurchase | null>(null);
    const [formData, setFormData] = useState({
        category_id: "",
        description: "",
        unit_value: "",
        quantity: "",
    });
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [purchasesRes, categoriesRes] = await Promise.all([
                supabase
                    .from("manual_purchases")
                    .select("*, categories(name)")
                    .eq("is_active", true)
                    .order("created_at", { ascending: false }),
                supabase
                    .from("categories")
                    .select("id, name")
                    .eq("is_active", true)
                    .order("name"),
            ]);

            if (purchasesRes.data) {
                setPurchases(purchasesRes.data as ManualPurchase[]);
            }
            if (categoriesRes.data) {
                setCategories(categoriesRes.data as Category[]);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateTotal = (unit: string, qty: string) => {
        const u = parseFloat(unit) || 0;
        const q = parseFloat(qty) || 0;
        return (u * q).toFixed(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const unitVal = parseFloat(formData.unit_value);
            const qty = parseFloat(formData.quantity);
            const total = unitVal * qty;

            const payload = {
                category_id: parseInt(formData.category_id),
                description: formData.description,
                unit_value: unitVal,
                quantity: qty,
                total_value: total,
            };

            if (editingPurchase) {
                const { error } = await supabase
                    .from("manual_purchases")
                    .update(payload)
                    .eq("id", editingPurchase.id);
                if (error) throw error;
                showToast("Lançamento atualizado", "success");
            } else {
                const { error } = await supabase
                    .from("manual_purchases")
                    .insert({ ...payload, is_active: true });
                if (error) throw error;
                showToast("Lançamento criado", "success");
            }

            setShowModal(false);
            setEditingPurchase(null);
            setFormData({ category_id: "", description: "", unit_value: "", quantity: "" });
            fetchData();
        } catch (error) {
            console.error("Error saving purchase:", error);
            showToast("Falha ao salvar lançamento", "error");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;

        try {
            const { error } = await supabase
                .from("manual_purchases")
                .update({ is_active: false })
                .eq("id", id);
            if (error) throw error;
            showToast("Lançamento excluído", "success");
            fetchData();
        } catch (error) {
            console.error("Error deleting purchase:", error);
            showToast("Falha ao excluir lançamento", "error");
        }
    };

    const openEditModal = (purchase: ManualPurchase) => {
        setEditingPurchase(purchase);
        setFormData({
            category_id: purchase.category_id.toString(),
            description: purchase.description,
            unit_value: purchase.unit_value.toString(),
            quantity: purchase.quantity.toString(),
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
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Lançamentos Avulsos</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie despesas extras da obra</p>
                </div>
                <button
                    onClick={() => {
                        setEditingPurchase(null);
                        setFormData({ category_id: "", description: "", unit_value: "", quantity: "" });
                        setShowModal(true);
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Novo Lançamento
                </button>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-700/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Descrição</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Categoria</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Valor Unit.</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Qtd.</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Total</th>
                                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {purchases.map((purchase) => (
                                <tr key={purchase.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 text-slate-300">{purchase.description}</td>
                                    <td className="px-6 py-4 text-slate-300">
                                        <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                                            {purchase.categories?.name || "-"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-300">
                                        {purchase.unit_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-300">{purchase.quantity}</td>
                                    <td className="px-6 py-4 text-right font-medium text-green-400">
                                        {purchase.total_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => openEditModal(purchase)}
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(purchase.id)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {purchases.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                                        Nenhum lançamento encontrado
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-slate-100 mb-4">
                            {editingPurchase ? "Editar Lançamento" : "Novo Lançamento"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Categoria
                                </label>
                                <select
                                    value={formData.category_id}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                >
                                    <option value="">Selecione...</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Descrição
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Valor Unitário
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.unit_value}
                                        onChange={(e) => setFormData({ ...formData, unit_value: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Quantidade
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Total
                                </label>
                                <div className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-green-400 font-medium flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" />
                                    {calculateTotal(formData.unit_value, formData.quantity)}
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
