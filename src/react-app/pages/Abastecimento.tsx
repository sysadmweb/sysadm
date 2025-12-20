import { useState, useEffect } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Plus, Loader2, Fuel, Image as ImageIcon, ExternalLink } from "lucide-react";
import { FuelSupply } from "@/shared/types";

// Simple helper for dates
const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
};

export default function AbastecimentoPage() {
    const { user } = useAuth();
    const [supplies, setSupplies] = useState<FuelSupply[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [progressMessage, setProgressMessage] = useState("");

    // Form inputs
    const [supplyDate, setSupplyDate] = useState(new Date().toISOString().split("T")[0]);
    const [kmFile, setKmFile] = useState<File | null>(null);
    const [plateFile, setPlateFile] = useState<File | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);

    // Units for selection (if superuser)
    const [units, setUnits] = useState<{ id: number, name: string }[]>([]);
    const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

    useEffect(() => {
        fetchSupplies();
        fetchUnits();
    }, [user]);

    const fetchUnits = async () => {
        const { data } = await supabase.from("units").select("id, name").eq("is_active", true);
        if (data) {
            setUnits(data);
            if (user?.unit_id) {
                setSelectedUnitId(user.unit_id);
            } else if (data.length > 0) {
                setSelectedUnitId(data[0].id);
            }
        }
    };

    const fetchSupplies = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from("fuel_supplies")
                .select(`
                    *,
                    units (name),
                    users (name)
                `)
                .eq("is_active", true)
                .order("supply_date", { ascending: false });

            // If not superuser, filter by unit ?? Or maybe they can see all? 
            // Usually filter by unit if strict multitenancy, but let's assume they can see what they have access to via RLS
            // RLS implies "true" in my migration for authenticated, so everyone sees everything. 
            // I'll filter by unit if user has one assigned and is not superuser, just to be safe visually.
            if (!user?.is_super_user && user?.unit_id) {
                query = query.eq("unit_id", user.unit_id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setSupplies(data || []);
        } catch (error) {
            console.error("Error fetching supplies:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Simulação de envio, já que a integração foi removida.
        // Se desejar salvar apenas os dados (sem fotos reais), precisaria alterar o banco ou enviar placeholders.
        // Como o pedido foi "deixar a tela crua", apenas simularemos o sucesso.

        setIsSubmitting(true);
        // setProgressMessage("Salvando..."); // removido pois não vamos salvar real

        try {
            // Mock delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Aqui entraria a lógica de salvar no banco, mas sem URLs de fotos não podemos preencher os campos obrigatórios.
            // await supabase.from("fuel_supplies").insert({...});

            setIsModalOpen(false);
            resetForm();
            alert("Abastecimento registrado (Simulação - Upload desativado)!");

        } catch (error: any) {
            console.error("Error submitting:", error);
            alert("Erro: " + error.message);
        } finally {
            setIsSubmitting(false);
            setProgressMessage("");
        }
    };

    const resetForm = () => {
        setSupplyDate(new Date().toISOString().split("T")[0]);
        setKmFile(null);
        setPlateFile(null);
        setReceiptFile(null);
    };

    const handleFileChange = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setter(e.target.files[0]);
        }
    };

    const MegaLink = ({ url, label }: { url: string, label: string }) => {
        if (!url) return <span className="text-slate-500 text-xs">-</span>;
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 rounded"
            >
                <ExternalLink className="w-3 h-3" />
                {label}
            </a>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <Fuel className="w-8 h-8 text-blue-400" />
                        Abastecimento
                    </h1>
                    <p className="text-slate-400">Gerenciamento de combustível e comprovantes</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        Novo Registro
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
            ) : supplies.length === 0 ? (
                <div className="text-center p-12 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                    <Fuel className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">Nenhum abastecimento registrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {supplies.map((item: any) => (
                        <div key={item.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-lg font-bold text-slate-200">{formatDate(item.supply_date)}</p>
                                    <p className="text-sm text-slate-400">{item.units?.name}</p>
                                </div>
                                <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded">
                                    {item.users?.name || "N/A"}
                                </span>
                            </div>

                            <div className="space-y-2 mt-4">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Comprovantes (MEGA)</p>
                                <div className="flex flex-wrap gap-2">
                                    <MegaLink url={item.km_photo_url} label="Foto KM" />
                                    <MegaLink url={item.plate_photo_url} label="Placa" />
                                    <MegaLink url={item.receipt_photo_url} label="Cupom" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 bg-slate-800/50">
                            <h2 className="text-xl font-bold text-slate-100">Novo Abastecimento</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Data</label>
                                    <input
                                        type="date"
                                        required
                                        value={supplyDate}
                                        onChange={e => setSupplyDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Unidade</label>
                                    <select
                                        value={selectedUnitId?.toString()}
                                        onChange={e => setSelectedUnitId(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                                    >
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <LabelFileInput label="Foto do KM (Painel)" file={kmFile} onChange={handleFileChange(setKmFile)} />
                                <LabelFileInput label="Foto da Placa" file={plateFile} onChange={handleFileChange(setPlateFile)} />
                                <LabelFileInput label="Foto do Cupom Fiscal" file={receiptFile} onChange={handleFileChange(setReceiptFile)} />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="animate-spin w-5 h-5" />
                                            <span>{progressMessage || "Enviando..."}</span>
                                        </div>
                                    ) : (
                                        "Enviar"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper component for file inputs
function LabelFileInput({ label, file, onChange }: { label: string, file: File | null, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
    return (
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{label}</label>
            <div className="relative group">
                <input
                    type="file"
                    accept="image/*"
                    onChange={onChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`flex items-center gap-3 px-3 py-2 border rounded-lg transition-colors ${file ? 'bg-blue-500/10 border-blue-500/50 text-blue-300' : 'bg-slate-950 border-slate-700 text-slate-500'}`}>
                    <ImageIcon className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate text-sm">{file ? file.name : "Clique para selecionar foto..."}</span>
                </div>
            </div>
        </div>
    );
}
