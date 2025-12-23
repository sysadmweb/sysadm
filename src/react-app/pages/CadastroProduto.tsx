import { useEffect, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { Product } from "@/shared/types";
import { Plus, Edit, Trash2, Loader2, Package, ChevronUp, ChevronDown, Search } from "lucide-react";

export default function CadastroProduto() {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortKey, setSortKey] = useState<"code" | "name" | "quantity" | "unit_value">("name");
    const [sortAsc, setSortAsc] = useState(true);
    const [formData, setFormData] = useState({
        code: "",
        name: "",
        quantity: 0,
        unit_value: 0,
    });
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from("products")
                .select("id, code, name, quantity, unit_value, created_at, updated_at")
                .order("name", { ascending: true });

            if (!error && Array.isArray(data)) {
                setProducts(data as Product[]);
            } else {
                setProducts([]);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const payload = {
                code: formData.code.toUpperCase(),
                name: formData.name.toUpperCase(),
                quantity: formData.quantity,
                unit_value: formData.unit_value,
            };

            if (editingProduct) {
                const { error } = await supabase
                    .from("products")
                    .update(payload)
                    .eq("id", editingProduct.id);

                if (error) {
                    showToast("Falha ao salvar produto", "error");
                    return;
                }
                showToast("Produto atualizado", "success");
            } else {
                const { error } = await supabase
                    .from("products")
                    .insert(payload);

                if (error) {
                    showToast("Falha ao cadastrar produto", "error");
                    return;
                }
                showToast("Produto criado", "success");
            }

            setShowModal(false);
            setEditingProduct(null);
            resetFormData();
            fetchProducts();
        } catch (error) {
            console.error("Error saving product:", error);
            showToast("Falha ao salvar produto", "error");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este produto?")) return;

        try {
            const { error } = await supabase
                .from("products")
                .delete()
                .eq("id", id);

            if (error) {
                showToast("Falha ao excluir produto", "error");
                return;
            }
            showToast("Produto excluído", "success");
            fetchProducts();
        } catch (error) {
            console.error("Error deleting product:", error);
            showToast("Falha ao excluir produto", "error");
        }
    };

    const resetFormData = () => {
        setFormData({
            code: "",
            name: "",
            quantity: 0,
            unit_value: 0,
        });
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            code: product.code,
            name: product.name,
            quantity: product.quantity,
            unit_value: product.unit_value,
        });
        setShowModal(true);
    };

    const displayedProducts = (() => {
        const term = (searchTerm || "").toUpperCase();
        const filtered = products.filter(
            (p) =>
                (p.code || "").toUpperCase().includes(term) ||
                (p.name || "").toUpperCase().includes(term)
        );

        const compare = (a: Product, b: Product) => {
            let va: string | number = "";
            let vb: string | number = "";

            if (sortKey === "code") {
                va = a.code || "";
                vb = b.code || "";
            } else if (sortKey === "name") {
                va = a.name || "";
                vb = b.name || "";
            } else if (sortKey === "quantity") {
                va = a.quantity;
                vb = b.quantity;
            } else if (sortKey === "unit_value") {
                va = a.unit_value;
                vb = b.unit_value;
            }

            if (typeof va === "number" && typeof vb === "number") {
                return sortAsc ? va - vb : vb - va;
            }

            const sa = String(va).toUpperCase();
            const sb = String(vb).toUpperCase();
            if (sa < sb) return sortAsc ? -1 : 1;
            if (sa > sb) return sortAsc ? 1 : -1;
            return 0;
        };

        return filtered.slice().sort(compare);
    })();

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
                    className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg ${toast.kind === "success"
                        ? "bg-green-500/10 border border-green-500/50 text-green-400"
                        : "bg-red-500/10 border border-red-500/50 text-red-400"
                        }`}
                >
                    {toast.text}
                </div>
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Cadastro de Produto</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie os produtos do estoque</p>
                </div>
                <div className="w-full md:w-auto flex items-center gap-3">
                    <button
                        onClick={() => {
                            setEditingProduct(null);
                            resetFormData();
                            setShowModal(true);
                        }}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        Novo Produto
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700 w-full md:w-fit">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                    className="bg-transparent border-none text-slate-200 placeholder-slate-500 focus:outline-none w-full md:w-64"
                    placeholder="Buscar por código ou nome"
                />
            </div>

            {/* Desktop View */}
            <div className="hidden md:block bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-700/50">
                            <tr>
                                {[
                                    { key: "code", label: "Código" },
                                    { key: "name", label: "Nome" },
                                    { key: "quantity", label: "Quantidade" },
                                    { key: "unit_value", label: "Valor Unitário" },
                                ].map((col) => (
                                    <th key={col.key} className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortKey === col.key) {
                                                    setSortAsc(!sortAsc);
                                                } else {
                                                    setSortKey(col.key as typeof sortKey);
                                                    setSortAsc(true);
                                                }
                                            }}
                                            className="flex items-center justify-center gap-1 hover:text-slate-100 w-full"
                                        >
                                            <span>{col.label}</span>
                                            {sortKey === col.key ? (
                                                sortAsc ? (
                                                    <ChevronUp className="w-4 h-4" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4" />
                                                )
                                            ) : null}
                                        </button>
                                    </th>
                                ))}
                                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {displayedProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-slate-400 font-mono text-sm">{product.code}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-5 h-5 text-blue-400" />
                                            <span className="text-slate-200 font-medium">{product.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300 text-center whitespace-nowrap">
                                        {product.quantity.toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300 text-center whitespace-nowrap">
                                        R$ {product.unit_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => openEditModal(product)}
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product.id)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
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
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {displayedProducts.map((product) => (
                    <div key={product.id} className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 shadow-xl">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-800 rounded-lg">
                                    <Package className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-slate-200 font-medium text-sm">{product.name}</h3>
                                    <p className="text-slate-400 text-xs font-mono">{product.code}</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => openEditModal(product)}
                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(product.id)}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/50">
                            <div>
                                <p className="text-slate-400 text-xs">Quantidade</p>
                                <p className="text-slate-200 text-sm">{product.quantity.toLocaleString('pt-BR')}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs">Valor Unitário</p>
                                <p className="text-slate-200 text-sm">
                                    R$ {product.unit_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-2xl shadow-2xl my-8">
                        <h2 className="text-xl font-bold text-slate-100 mb-4">
                            {editingProduct ? "Editar Produto" : "Novo Produto"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Código
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        required
                                    />
                                </div>
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
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Quantidade
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Valor Unitário
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.unit_value}
                                        onChange={(e) => setFormData({ ...formData, unit_value: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        required
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
