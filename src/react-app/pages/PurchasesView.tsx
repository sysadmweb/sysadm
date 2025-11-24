import { useEffect, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { Invoice } from "@/shared/types";
import {
    Search,
    Edit,
    Trash2,
    ChevronLeft,
    ChevronRight,
    FileText,
    Loader2,
} from "lucide-react";
import { useNavigate } from "react-router";

export default function PurchasesView() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 10;
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchInvoices();
    }, [page, searchTerm]);

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from("invoices")
                .select("*, invoice_items(total_value)", { count: "exact" });

            if (searchTerm) {
                const term = searchTerm.toUpperCase();
                query = query.or(`number.ilike.%${term}%,issuer_name.ilike.%${term}%`);
            }

            const from = (page - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;

            const { data, error, count } = await query
                .order("created_at", { ascending: false })
                .range(from, to);

            if (error) throw error;

            setInvoices(data as Invoice[]);
            if (count !== null) {
                setTotalItems(count);
                setTotalPages(Math.ceil(count / itemsPerPage));
            }
        } catch (error) {
            console.error("Error fetching invoices:", error);
            showToast("Erro ao carregar notas fiscais", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir esta nota fiscal?")) return;

        try {
            const { error } = await supabase.from("invoices").delete().eq("id", id);
            if (error) throw error;
            showToast("Nota fiscal excluída com sucesso", "success");
            fetchInvoices();
        } catch (error) {
            console.error("Error deleting invoice:", error);
            showToast("Erro ao excluir nota fiscal", "error");
        }
    };

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

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Notas Fiscais</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie as notas fiscais importadas</p>
                </div>
                <div className="w-full md:w-auto flex items-center gap-3">
                    <div className="relative w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                            className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full md:w-64"
                            placeholder="Buscar por número ou fornecedor"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-700/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Número</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Fornecedor</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Chave de Acesso</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Total</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Carregando...
                                        </div>
                                    </td>
                                </tr>
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                        Nenhuma nota fiscal encontrada
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-blue-400" />
                                                <span className="text-slate-200 font-medium">
                                                    {invoice.number}
                                                </span>
                                                {invoice.series && (
                                                    <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                                        Série {invoice.series}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {invoice.issuer_name}
                                            <div className="text-xs text-slate-500">{invoice.issuer_tax_id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-mono text-slate-500 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50 block w-fit max-w-[200px] truncate" title={invoice.access_key || ""}>
                                                {invoice.access_key || "-"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-200 font-medium">
                                            {(() => {
                                                // Calculate total from items if available, otherwise fallback to invoice.total_value
                                                const itemsTotal = (invoice as any).invoice_items?.reduce(
                                                    (acc: number, item: { total_value: number }) => acc + item.total_value,
                                                    0
                                                );
                                                const displayTotal = itemsTotal !== undefined ? itemsTotal : invoice.total_value;

                                                return (displayTotal || 0).toLocaleString("pt-BR", {
                                                    style: "currency",
                                                    currency: "BRL",
                                                });
                                            })()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/purchases/xml?id=${invoice.id}`)}
                                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(invoice.id)}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden">
                    {isLoading ? (
                        <div className="px-6 py-8 text-center text-slate-400">
                            <div className="flex items-center justify-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Carregando...
                            </div>
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="px-6 py-8 text-center text-slate-400">
                            Nenhuma nota fiscal encontrada
                        </div>
                    ) : (
                        <div className="space-y-4 p-4">
                            {invoices.map((invoice) => (
                                <div key={invoice.id} className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 shadow-xl">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-800 rounded-lg">
                                                <FileText className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-slate-200 font-medium text-sm">{invoice.number}</h3>
                                                    {invoice.series && (
                                                        <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                                            Série {invoice.series}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-400 text-xs truncate max-w-[150px]">
                                                    {invoice.issuer_name}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => navigate(`/purchases/xml?id=${invoice.id}`)}
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(invoice.id)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-3 border-t border-slate-700/50">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 text-xs">CNPJ</span>
                                            <span className="text-slate-300 text-xs">{invoice.issuer_tax_id}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 text-xs">Chave</span>
                                            <span className="text-slate-300 text-xs font-mono truncate max-w-[150px]" title={invoice.access_key || ""}>
                                                {invoice.access_key || "-"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-slate-400 text-xs">Total</span>
                                            <span className="text-slate-200 font-bold text-sm">
                                                {(() => {
                                                    const itemsTotal = (invoice as any).invoice_items?.reduce(
                                                        (acc: number, item: { total_value: number }) => acc + item.total_value,
                                                        0
                                                    );
                                                    const displayTotal = itemsTotal !== undefined ? itemsTotal : invoice.total_value;

                                                    return (displayTotal || 0).toLocaleString("pt-BR", {
                                                        style: "currency",
                                                        currency: "BRL",
                                                    });
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
                    <div className="text-sm text-slate-400">
                        Mostrando {invoices.length > 0 ? (page - 1) * itemsPerPage + 1 : 0} até{" "}
                        {Math.min(page * itemsPerPage, totalItems)} de {totalItems} resultados
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm text-slate-400">
                            Página {page} de {totalPages || 1}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
