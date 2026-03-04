import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Loader2, PackagePlus } from "lucide-react";
import { supabase } from "@/react-app/supabase";
import AlertModal from "@/react-app/components/AlertModal";

interface Adicional {
    id: number;
    nome: string;
    quantidade_marmita: number;
    ativo: boolean;
    criado_em: string;
    atualizado_em: string;
}

export default function Adicionais() {
    const [adicionais, setAdicionais] = useState<Adicional[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAdicional, setEditingAdicional] = useState<Adicional | null>(null);
    const [formData, setFormData] = useState({ nome: "", quantidade_marmita: "" });
    const [alert, setAlert] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const showAlert = (message: string, type: "success" | "error") => {
        setAlert({ message, type });
    };

    useEffect(() => {
        fetchAdicionais();
    }, []);

    const fetchAdicionais = async () => {
        try {
            const { data, error } = await supabase
                .from("adicionais")
                .select("*")
                .eq("ativo", true)
                .order("nome");
            if (error) throw error;
            setAdicionais(data || []);
        } catch (error) {
            console.error("Error fetching adicionais:", error);
            showAlert("Erro ao buscar adicionais", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const payload = {
                nome: formData.nome.toUpperCase(),
                quantidade_marmita: parseFloat(formData.quantidade_marmita)
            };

            if (isNaN(payload.quantidade_marmita)) {
                showAlert("Quantidade inválida", "error");
                return;
            }

            if (editingAdicional) {
                const { error } = await supabase
                    .from("adicionais")
                    .update(payload)
                    .eq("id", editingAdicional.id);
                if (error) throw error;
                showAlert("Item atualizado com sucesso", "success");
            } else {
                const { error } = await supabase
                    .from("adicionais")
                    .insert([{ ...payload, ativo: true }]);
                if (error) throw error;
                showAlert("Item cadastrado com sucesso", "success");
            }

            setShowModal(false);
            setEditingAdicional(null);
            setFormData({ nome: "", quantidade_marmita: "" });
            fetchAdicionais();
        } catch (error: any) {
            console.error("Error saving adicional:", error);
            if (error.code === "23505") {
                showAlert("Já existe um item com este nome", "error");
            } else {
                showAlert("Falha ao salvar item", "error");
            }
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja desativar este item?")) return;

        try {
            const { error } = await supabase
                .from("adicionais")
                .update({ ativo: false })
                .eq("id", id);
            if (error) throw error;
            showAlert("Item desativado com sucesso", "success");
            fetchAdicionais();
        } catch (error) {
            console.error("Error deleting adicional:", error);
            showAlert("Falha ao desativar item", "error");
        }
    };

    const openEditModal = (item: Adicional) => {
        setEditingAdicional(item);
        setFormData({
            nome: item.nome,
            quantidade_marmita: item.quantidade_marmita.toString()
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
            <AlertModal
                isOpen={!!alert}
                message={alert?.message || ""}
                type={alert?.type}
                onClose={() => setAlert(null)}
            />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Cadastro de Adicionais</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie os itens adicionais e sua paridade com marmitas</p>
                </div>
                <button
                    onClick={() => {
                        setEditingAdicional(null);
                        setFormData({ nome: "", quantidade_marmita: "" });
                        setShowModal(true);
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Novo Item
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {adicionais.map((item) => (
                    <div
                        key={item.id}
                        className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-lg">
                                <PackagePlus className="w-6 h-6 text-blue-400" />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEditModal(item)}
                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-slate-100 mb-2">{item.nome}</h3>
                        <div className="flex items-center gap-2 text-slate-400">
                            <span className="text-sm">Quantidade Marmita:</span>
                            <span className="font-bold text-blue-400 text-lg">{item.quantidade_marmita}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-4">
                            Criado em {new Date(item.criado_em).toLocaleDateString("pt-BR")}
                        </p>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-slate-100 mb-4">
                            {editingAdicional ? "Editar Item" : "Novo Item"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Nome do Item
                                </label>
                                <input
                                    type="text"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    placeholder="Ex: REFRIGERANTE"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Quantidade Marmita
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.quantidade_marmita}
                                    onChange={(e) => setFormData({ ...formData, quantidade_marmita: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    placeholder="Ex: 0.5"
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">Insira o valor numérico equivalente em marmitas.</p>
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
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all font-semibold"
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
