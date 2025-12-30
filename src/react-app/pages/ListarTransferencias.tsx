import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../contexts/AuthContext";
import { Search, Loader2 } from "lucide-react";

export default function ListarTransferencias() {
    const { user: currentUser } = useAuth();
    const [transfers, setTransfers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (currentUser) {
            fetchTransferHistory();
        }
    }, [currentUser]);

    const fetchTransferHistory = async () => {
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

            let query = supabase
                .from("funcionario_transferencia")
                .select(`
          id,
          data_saida,
          data_chegada,
          observacao,
          funcionario:funcionarios (full_name),
          unidade_atual:unidades!unidade_atual_id (name),
          unidade_destino:unidades!unidade_destino_id (name)
        `)
                .order("data_saida", { ascending: false });

            if (!isSuper && unitIds.length > 0) {
                // Filter where either source OR destination unit is in the allowed list
                // Supabase syntax for OR with IN: .or(`unidade_atual_id.in.(${ids}),unidade_destino_id.in.(${ids})`)
                const idsString = `(${unitIds.join(',')})`;
                query = query.or(`unidade_atual_id.in.${idsString},unidade_destino_id.in.${idsString}`);
            } else if (!isSuper && unitIds.length === 0) {
                // User has no units, return empty
                setTransfers([]);
                setIsLoading(false);
                return;
            }

            const { data, error } = await query;

            if (error) throw error;
            setTransfers(data || []);
        } catch (error) {
            console.error("Error fetching transfer history:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const displayedTransfers = transfers.filter((t) =>
        (t.funcionario?.full_name || "").toUpperCase().includes(searchTerm.toUpperCase())
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Listar Transferências</h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">Histórico de transferências entre unidades</p>
            </div>

            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700 w-full md:w-fit">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none text-slate-200 placeholder-slate-500 focus:outline-none w-full md:w-64"
                    placeholder="Buscar por nome do colaborador"
                />
            </div>

            {/* Desktop View */}
            <div className="hidden md:block bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-700/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Nome Colaborador</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Data Saída</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">De</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Para</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Observação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {displayedTransfers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-slate-500">
                                        Nenhuma transferência encontrada.
                                    </td>
                                </tr>
                            ) : (
                                displayedTransfers.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 text-slate-200 font-medium">
                                            {t.funcionario?.full_name || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 font-mono text-sm">
                                            {t.data_saida ? new Date(t.data_saida).toLocaleDateString("pt-BR") : "-"}
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {t.unidade_atual?.name || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {t.unidade_destino?.name || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">
                                            {t.observacao || "-"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {displayedTransfers.map((t) => (
                    <div key={t.id} className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl p-4">
                        <div className="mb-2">
                            <span className="text-slate-200 font-bold block">{t.funcionario?.full_name || "-"}</span>
                            <span className="text-xs text-slate-500 block">
                                Saída: {t.data_saida ? new Date(t.data_saida).toLocaleDateString("pt-BR") : "-"}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="text-slate-500 text-xs uppercase font-bold">De</span>
                                <p className="text-slate-300">{t.unidade_atual?.name || "-"}</p>
                            </div>
                            <div>
                                <span className="text-slate-500 text-xs uppercase font-bold">Para</span>
                                <p className="text-slate-300">{t.unidade_destino?.name || "-"}</p>
                            </div>
                        </div>
                        {t.observacao && (
                            <div className="mt-2 text-sm text-slate-400 border-t border-slate-700 pt-2">
                                <span className="text-xs uppercase font-bold text-slate-500 mr-2">Obs:</span>
                                {t.observacao}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
