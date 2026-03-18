import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../contexts/AuthContext";
import { Search, Loader2, X, ArrowRight, Calendar, Clock, MapPin, User, MessageSquare } from "lucide-react";

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("pt-BR");
}

function formatTime(iso: string | null | undefined): string {
    if (!iso) return "-";
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

interface Transfer {
    id: number;
    data_saida: string | null;
    data_chegada: string | null;
    observacao: string | null;
    funcionario: { full_name: string } | null;
    unidade_atual: { name: string } | null;
    unidade_destino: { name: string } | null;
}

export default function ListarTransferencias() {
    const { user: currentUser } = useAuth();
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

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
                const idsString = `(${unitIds.join(',')})`;
                query = query.or(`unidade_atual_id.in.${idsString},unidade_destino_id.in.${idsString}`);
            } else if (!isSuper && unitIds.length === 0) {
                setTransfers([]);
                setIsLoading(false);
                return;
            }

            const { data, error } = await query;

            if (error) throw error;

            const formatted = (data as any[] || []).map(item => ({
                ...item,
                funcionario: Array.isArray(item.funcionario) ? item.funcionario[0] : item.funcionario,
                unidade_atual: Array.isArray(item.unidade_atual) ? item.unidade_atual[0] : item.unidade_atual,
                unidade_destino: Array.isArray(item.unidade_destino) ? item.unidade_destino[0] : item.unidade_destino,
            }));

            setTransfers(formatted as Transfer[]);
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
                                    <tr
                                        key={t.id}
                                        onClick={() => setSelectedTransfer(t)}
                                        className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 text-blue-400 font-medium hover:text-blue-300 underline underline-offset-2">
                                            {t.funcionario?.full_name || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 font-mono text-sm">
                                            {formatDate(t.data_saida)}
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
                    <div
                        key={t.id}
                        onClick={() => setSelectedTransfer(t)}
                        className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl p-4 cursor-pointer hover:border-blue-500/40 transition-all"
                    >
                        <div className="mb-2">
                            <span className="text-blue-400 font-bold block underline underline-offset-2">{t.funcionario?.full_name || "-"}</span>
                            <span className="text-xs text-slate-500 block">
                                Saída: {formatDate(t.data_saida)}
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

            {/* Detail Modal */}
            {selectedTransfer && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                    onClick={() => setSelectedTransfer(null)}
                >
                    <div
                        className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-800/60">
                            <h2 className="text-lg font-bold text-slate-100">Detalhes da Transferência</h2>
                            <button
                                onClick={() => setSelectedTransfer(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">

                            {/* Nome */}
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg mt-0.5">
                                    <User className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Nome</p>
                                    <p className="text-slate-100 font-semibold text-base mt-0.5">
                                        {selectedTransfer.funcionario?.full_name || "-"}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-slate-700/50" />

                            {/* Saída */}
                            <div>
                                <p className="text-xs font-bold uppercase text-blue-400/80 tracking-widest mb-3">Saída</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-slate-800 rounded-lg mt-0.5">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Data de Saída</p>
                                            <p className="text-slate-200 font-medium mt-0.5">{formatDate(selectedTransfer.data_saida)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-slate-800 rounded-lg mt-0.5">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Hora</p>
                                            <p className="text-slate-200 font-medium mt-0.5">{formatTime(selectedTransfer.data_saida)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-700/50" />

                            {/* Destino */}
                            <div>
                                <p className="text-xs font-bold uppercase text-green-400/80 tracking-widest mb-3">Destino</p>
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="p-2 bg-green-500/10 rounded-lg mt-0.5">
                                        <MapPin className="w-4 h-4 text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Unidade de Destino</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-slate-400 text-sm">{selectedTransfer.unidade_atual?.name || "-"}</span>
                                            <ArrowRight className="w-3 h-3 text-slate-500" />
                                            <span className="text-green-400 font-semibold text-sm">{selectedTransfer.unidade_destino?.name || "-"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-slate-800 rounded-lg mt-0.5">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Data de Chegada</p>
                                            <p className="text-slate-200 font-medium mt-0.5">{formatDate(selectedTransfer.data_chegada)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-slate-800 rounded-lg mt-0.5">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Hora de Chegada</p>
                                            <p className="text-slate-200 font-medium mt-0.5">{formatTime(selectedTransfer.data_chegada)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Observação */}
                            {selectedTransfer.observacao && (
                                <>
                                    <div className="border-t border-slate-700/50" />
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-slate-800 rounded-lg mt-0.5">
                                            <MessageSquare className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Observação</p>
                                            <p className="text-slate-300 text-sm mt-0.5 leading-relaxed">{selectedTransfer.observacao}</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 pb-5">
                            <button
                                onClick={() => setSelectedTransfer(null)}
                                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all border border-slate-700"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
