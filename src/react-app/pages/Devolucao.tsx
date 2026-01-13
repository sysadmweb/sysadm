import { useState, useEffect } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { usePermissions } from "@/react-app/hooks/usePermissions";
import { Plus, Loader2, RefreshCcw, Image as ImageIcon, Edit, Trash2, X } from "lucide-react";
import AlertModal from "../components/AlertModal";
import imageCompression from 'browser-image-compression';

// Simple helper for dates
const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
};

type ItemWithQuantity = {
    name: string;
    quantity: number;
};

type DevolucaoItem = {
    id: number;
    date: string;
    unit_id: number;
    items: ItemWithQuantity[];
    photos: string[];
    units?: { name: string };
    users?: { name: string };
};

export default function Devolucao() {
    const { user } = useAuth();
    const { get } = usePermissions();
    const canView = get("devolucao").can_view;

    const [dataList, setDataList] = useState<DevolucaoItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [progressMessage, setProgressMessage] = useState("");

    // Alert state
    const [alertState, setAlertState] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Form inputs
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    // Items List
    const [items, setItems] = useState<ItemWithQuantity[]>([]);
    const [currentItemName, setCurrentItemName] = useState("");
    const [currentItemQty, setCurrentItemQty] = useState<string>("1");

    // Photos
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);

    // Editing state
    const [editingId, setEditingId] = useState<number | null>(null);

    // Units for selection (if superuser)
    const [units, setUnits] = useState<{ id: number, name: string }[]>([]);
    const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

    useEffect(() => {
        fetchUnits();
    }, [user]);

    useEffect(() => {
        if (units.length > 0 || user?.is_super_user) {
            fetchData();
        }
    }, [units, user]);

    const fetchUnits = async () => {
        if (!user) return;

        let fetchedUnits: { id: number; name: string }[] = [];

        if (user.is_super_user) {
            const { data } = await supabase.from("unidades").select("id, name").eq("is_active", true);
            fetchedUnits = data || [];
        } else {
            const { data: links } = await supabase
                .from("usuarios_unidades")
                .select("unit_id")
                .eq("user_id", user.id);

            const linkedIds = links?.map((l: any) => l.unit_id) || [];

            if (linkedIds.length > 0) {
                const { data } = await supabase
                    .from("unidades")
                    .select("id, name")
                    .in("id", linkedIds)
                    .eq("is_active", true);
                fetchedUnits = data || [];
            }
        }

        setUnits(fetchedUnits);

        if (fetchedUnits.length === 1) {
            setSelectedUnitId(fetchedUnits[0].id);
        } else {
            setSelectedUnitId(null);
        }
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from("devolucoes")
                .select(`
                    *,
                    unidades (name),
                    usuarios (name)
                `)
                .eq("is_active", true)
                .order("date", { ascending: false });

            if (!user?.is_super_user) {
                const accessibleUnitIds = units.map(u => u.id);
                if (accessibleUnitIds.length > 0) {
                    query = query.in("unit_id", accessibleUnitIds);
                } else {
                    setDataList([]);
                    setIsLoading(false);
                    return;
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            setDataList(data || []);
        } catch (error) {
            console.error("Error fetching devolutions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setDate(new Date().toISOString().split("T")[0]);
        setItems([]);
        setCurrentItemName("");
        setCurrentItemQty("1");
        setPhotoFiles([]);
        setExistingPhotos([]);
        setEditingId(null);

        if (units.length === 1) {
            setSelectedUnitId(units[0].id);
        } else {
            setSelectedUnitId(null);
        }
    };

    const openNewModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleEdit = (item: DevolucaoItem) => {
        setEditingId(item.id);
        setDate(item.date);
        setSelectedUnitId(item.unit_id);

        // Handle migration from string[] to ItemWithQuantity[] if necessary
        // Assuming database clean or migration not affecting old data structure if json
        // But let's be safe: check if item is string or object
        const parsedItems: ItemWithQuantity[] = (item.items || []).map((it: any) => {
            if (typeof it === 'string') return { name: it, quantity: 1 };
            return it;
        });

        setItems(parsedItems);
        setExistingPhotos(item.photos || []);
        setPhotoFiles([]);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir esta devolução?")) return;

        try {
            const { error } = await supabase
                .from("devolucoes")
                .update({ is_active: false })
                .eq("id", id);

            if (error) throw error;

            setAlertState({ message: "Devolução excluída com sucesso!", type: "success" });
            fetchData();
        } catch (error: any) {
            console.error("Error deleting:", error);
            setAlertState({ message: "Erro ao excluir: " + error.message, type: "error" });
        }
    };

    const handleAddItem = () => {
        if (!currentItemName.trim()) return;
        const qty = parseInt(currentItemQty);
        if (isNaN(qty) || qty <= 0) {
            setAlertState({ message: "Quantidade inválida.", type: "error" });
            return;
        }

        setItems([...items, { name: currentItemName.trim(), quantity: qty }]);
        setCurrentItemName("");
        setCurrentItemQty("1");
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setPhotoFiles([...photoFiles, ...newFiles]);
        }
    };

    const handleRemovePhotoFile = (index: number) => {
        setPhotoFiles(photoFiles.filter((_, i) => i !== index));
    };

    const handleRemoveExistingPhoto = (index: number) => {
        setExistingPhotos(existingPhotos.filter((_, i) => i !== index));
    };

    const uploadImage = async (file: File) => {
        const options = {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1280,
            useWebWorker: true,
            fileType: 'image/webp',
            initialQuality: 0.7
        };

        try {
            const compressedFile = await imageCompression(file, options);
            const fileExt = 'webp';
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`; // bucket/filename

            const { error: uploadError } = await supabase.storage
                .from('devolucoes')
                .upload(filePath, compressedFile, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: 'image/webp'
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('devolucoes')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error("Error uploading image:", error);
            throw new Error("Falha no upload da imagem");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (units.length > 0 && !selectedUnitId) {
            setAlertState({ message: "Por favor, selecione uma unidade.", type: "error" });
            return;
        }

        if (items.length === 0) {
            setAlertState({ message: "Adicione pelo menos um item.", type: "error" });
            return;
        }

        setIsSubmitting(true);

        try {
            let photoUrls = [...existingPhotos];

            if (photoFiles.length > 0) {
                setProgressMessage("Enviando fotos...");
                for (const file of photoFiles) {
                    const url = await uploadImage(file);
                    photoUrls.push(url);
                }
            }

            setProgressMessage("Salvando registro...");

            const payload = {
                unit_id: selectedUnitId,
                date: date,
                items: items,
                photos: photoUrls,
            };

            if (editingId) {
                const { error } = await supabase
                    .from("devolucoes")
                    .update(payload)
                    .eq("id", editingId);
                if (error) throw error;
                setAlertState({ message: "Devolução atualizada com sucesso!", type: "success" });
            } else {
                const { error } = await supabase.from("devolucoes").insert({
                    ...payload,
                    user_id: user?.id,
                    is_active: true
                });
                if (error) throw error;
                setAlertState({ message: "Devolução registrada com sucesso!", type: "success" });
            }

            setIsModalOpen(false);
            resetForm();
            fetchData();

        } catch (error: any) {
            console.error("Error submitting:", error);
            setAlertState({ message: "Erro: " + error.message, type: "error" });
        } finally {
            setIsSubmitting(false);
            setProgressMessage("");
        }
    };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <RefreshCcw className="w-16 h-16 mb-4 opacity-20" />
                <p>Você não tem permissão para visualizar esta página.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <RefreshCcw className="w-8 h-8 text-blue-400" />
                        Devolução
                    </h1>
                    <p className="text-slate-400">Gerenciamento de devoluções e ocorrências</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={openNewModal}
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
            ) : dataList.length === 0 ? (
                <div className="text-center p-12 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                    <RefreshCcw className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">Nenhuma devolução registrada.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dataList.map((item) => (
                        <div key={item.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition-all group relative">
                            <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(item)}
                                    className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded transition-colors"
                                    title="Editar"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex justify-between items-start mb-4 pr-16 text-slate-100">
                                <div>
                                    <p className="text-lg font-bold">{formatDate(item.date)}</p>
                                    <p className="text-sm text-slate-400">{item.units?.name}</p>
                                </div>
                                <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded">
                                    {item.users?.name || "N/A"}
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Itens</p>
                                    <ul className="list-inside text-sm text-slate-300 space-y-0.5">
                                        {item.items && item.items.slice(0, 3).map((it, i) => (
                                            <li key={i} className="truncate">
                                                <span className="font-bold text-blue-400 mr-2">{typeof it === 'string' ? "1x" : `${it.quantity}x`}</span>
                                                {typeof it === 'string' ? it : it.name}
                                            </li>
                                        ))}
                                        {item.items && item.items.length > 3 && (
                                            <li className="text-slate-500 italic pl-2">...e mais {item.items.length - 3}</li>
                                        )}
                                    </ul>
                                </div>

                                {item.photos && item.photos.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Fotos</p>
                                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                            {item.photos.map((url, i) => (
                                                <a
                                                    key={i}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block w-10 h-10 rounded border border-slate-700 bg-slate-900 overflow-hidden flex-shrink-0 hover:border-blue-500 transition-colors"
                                                >
                                                    <img src={url} alt="Foto" className="w-full h-full object-cover" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
                            <h2 className="text-xl font-bold text-slate-100">
                                {editingId ? "Editar Devolução" : "Nova Devolução"}
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Data</label>
                                    <input
                                        type="date"
                                        required
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
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

                            {/* Items Section */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Itens Devolvidos</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="number"
                                        min="1"
                                        value={currentItemQty}
                                        onChange={e => setCurrentItemQty(e.target.value)}
                                        className="w-20 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 text-center"
                                        placeholder="Qtd"
                                    />
                                    <input
                                        type="text"
                                        value={currentItemName}
                                        onChange={e => setCurrentItemName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                                        placeholder="Digite o item..."
                                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="space-y-1 max-h-40 overflow-y-auto p-1">
                                    {items.map((item, index) => (
                                        <div key={index} className="flex justify-between items-center bg-slate-950 px-3 py-2 rounded border border-slate-800">
                                            <span className="text-sm text-slate-300">
                                                <span className="font-bold text-blue-400 mr-2">{item.quantity}x</span>
                                                {item.name}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="text-slate-500 hover:text-red-400 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {items.length === 0 && <p className="text-xs text-slate-500 italic p-2">Nenhum item adicionado.</p>}
                                </div>
                            </div>

                            {/* Photos Section */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Fotos</label>
                                <div className="relative group mb-3">
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-slate-700 rounded-lg bg-slate-950/50 text-slate-400 group-hover:bg-slate-900 group-hover:border-blue-500/50 group-hover:text-blue-400 transition-all">
                                        <ImageIcon className="w-5 h-5" />
                                        <span className="text-sm">Clique para adicionar fotos...</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-2">
                                    {existingPhotos.map((url, i) => (
                                        <div key={`exist-${i}`} className="relative aspect-square rounded overflow-hidden border border-green-900/50 group">
                                            <img src={url} className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveExistingPhoto(i)}
                                                className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-green-500/20 text-green-500 text-[10px] text-center font-bold">Salva</div>
                                        </div>
                                    ))}
                                    {photoFiles.map((file, i) => (
                                        <div key={`new-${i}`} className="relative aspect-square rounded overflow-hidden border border-blue-900/50 group">
                                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePhotoFile(i)}
                                                className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-blue-500/20 text-blue-500 text-[10px] text-center font-bold">Nova</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-800">
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
                                            <span>{progressMessage || "Salvar"}</span>
                                        </div>
                                    ) : (
                                        editingId ? "Atualizar" : "Enviar"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <AlertModal
                isOpen={!!alertState}
                message={alertState?.message || ""}
                onClose={() => setAlertState(null)}
                type={alertState?.type}
            />
        </div>
    );
}
