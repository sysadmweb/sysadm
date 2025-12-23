import { useEffect, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Plus, Loader2, ClipboardCheck, Home, Image as ImageIcon, X, Trash2, Edit, Download } from "lucide-react";
import imageCompression from 'browser-image-compression';

type Inspection = {
    id: number;
    accommodation_id: number;
    employee_id: number | null;
    inspection_date: string;
    status: string;
    observations: string | null;
    photo_url?: string | null;
    title?: string;
    user_id?: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

type Accommodation = {
    id: number;
    name: string;
    unit_id: number;
};

type User = {
    id: number;
    name: string;
};

export default function Vistorias() {
    const { user: currentUser } = useAuth();
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [inspectedAccommodationIds, setInspectedAccommodationIds] = useState<number[]>([]);
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [users, setUsers] = useState<Record<number, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedAccommodationId, setSelectedAccommodationId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        accommodation_id: 0,
        title: "",
        observations: "",
        photos: [] as File[],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [inspectionPhotos, setInspectionPhotos] = useState<Record<number, string[]>>({});
    const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
    const [removedExistingUrls, setRemovedExistingUrls] = useState<string[]>([]);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([fetchAccommodations(), fetchInspections(), fetchUsers()]);
            setIsLoading(false);
        };
        loadData();
    }, [currentUser]);

    const fetchAccommodations = async () => {
        try {
            const isSuper = currentUser?.is_super_user;
            let unitIds: number[] = [];

            if (!isSuper && currentUser?.id) {
                const { data: links } = await supabase
                    .from("user_units")
                    .select("unit_id")
                    .eq("user_id", currentUser.id);
                unitIds = Array.isArray(links) ? (links as { unit_id: number }[]).map((l) => l.unit_id) : [];
            }

            const base = supabase
                .from("accommodations")
                .select("id, name, unit_id")
                .eq("is_active", true);

            const { data, error } = isSuper || unitIds.length === 0
                ? await base
                : await base.in("unit_id", unitIds);

            if (!error && Array.isArray(data)) {
                setAccommodations(data as Accommodation[]);
            } else {
                setAccommodations([]);
            }
        } catch (error) {
            console.error("Error fetching accommodations:", error);
        }
    };

    const fetchInspections = async () => {
        try {
            const { data, error } = await supabase
                .from("inspections")
                .select("*")
                .eq("is_active", true)
                .order("created_at", { ascending: false });

            if (!error && Array.isArray(data)) {
                const list = data as Inspection[];
                setInspections(list);
                const uniqueIds = Array.from(new Set(list.map(i => i.accommodation_id)));
                setInspectedAccommodationIds(uniqueIds);
                const inspIds = list.map(i => i.id);
                if (inspIds.length > 0) {
                    const { data: photosRows } = await supabase
                        .from("inspection_photos")
                        .select("inspection_id, photo_url, is_active")
                        .in("inspection_id", inspIds)
                        .eq("is_active", true);
                    const map: Record<number, string[]> = {};
                    (photosRows || []).forEach((row: { inspection_id: number; photo_url: string }) => {
                        const id = row.inspection_id;
                        const url = row.photo_url;
                        if (!map[id]) map[id] = [];
                        map[id].push(url);
                    });
                    setInspectionPhotos(map);
                } else {
                    setInspectionPhotos({});
                }
            }
        } catch (error) {
            console.error("Error fetching inspections:", error);
        }
    };

    //

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from("users")
                .select("id, name");

            if (!error && data) {
                const userMap: Record<number, string> = {};
                data.forEach((u: User) => {
                    userMap[u.id] = u.name;
                });
                setUsers(userMap);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const arr = Array.from(files);
        const nextPhotos = [...formData.photos, ...arr];
        setFormData({ ...formData, photos: nextPhotos });
        Promise.all(
            arr.map(
                (file) =>
                    new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    })
            )
        ).then((list) => setPhotoPreviews((prev) => [...prev, ...list]));
    };

    const removePhotoAt = (idx: number) => {
        const nextPhotos = formData.photos.slice();
        nextPhotos.splice(idx, 1);
        const nextPreviews = photoPreviews.slice();
        nextPreviews.splice(idx, 1);
        setFormData({ ...formData, photos: nextPhotos });
        setPhotoPreviews(nextPreviews);
    };

    const removeExistingUrl = (url: string) => {
        setExistingPhotoUrls((prev) => prev.filter((u) => u !== url));
        setRemovedExistingUrls((prev) => [...prev, url]);
    };

    const handleDownload = async (url: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `vistoria-${Date.now()}.webp`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingInspection && (!formData.photos || formData.photos.length === 0)) {
            showToast("Por favor, selecione ao menos uma foto.", "error");
            return;
        }
        if (!formData.title) {
            showToast("Por favor, informe um título.", "error");
            return;
        }

        setIsSubmitting(true);

        try {
            const options = {
                maxSizeMB: 0.3,
                maxWidthOrHeight: 1280,
                useWebWorker: true,
                fileType: 'image/webp',
                initialQuality: 0.6 as number,
            };

            if (editingInspection) {
                const payload = {
                    accommodation_id: formData.accommodation_id,
                    title: formData.title.toUpperCase(),
                    observations: formData.observations ? formData.observations.toUpperCase() : null,
                    inspection_date: editingInspection?.inspection_date || new Date().toISOString(),
                    user_id: currentUser?.id,
                    status: "REALIZADO",
                    is_active: true
                };
                const { error: dbError } = await supabase
                    .from("inspections")
                    .update(payload)
                    .eq("id", editingInspection.id);
                if (dbError) throw dbError;

                if (removedExistingUrls.length > 0) {
                    await supabase
                        .from('inspection_photos')
                        .update({ is_active: false })
                        .eq('inspection_id', editingInspection.id)
                        .in('photo_url', removedExistingUrls);
                }

                const uploadedUrls: string[] = [];
                if (formData.photos.length > 0) {
                    for (const file of formData.photos) {
                        let compressedFile = file;
                        try {
                            compressedFile = await imageCompression(file, options);
                        } catch (error) {
                            console.error("Compression error:", error);
                        }
                        const fileExt = 'webp';
                        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                        const filePath = `${formData.accommodation_id}/${fileName}`;
                        const { error: uploadError } = await supabase.storage
                            .from('inspection-photos')
                            .upload(filePath, compressedFile, {
                                cacheControl: '3600',
                                upsert: false,
                                contentType: 'image/webp'
                            });
                        if (uploadError) {
                            throw new Error("Falha no upload da imagem");
                        }
                        const { data: { publicUrl } } = supabase.storage
                            .from('inspection-photos')
                            .getPublicUrl(filePath);
                        uploadedUrls.push(publicUrl);
                        await supabase
                            .from('inspection_photos')
                            .insert({ inspection_id: editingInspection.id, photo_url: publicUrl, is_active: true });
                    }
                }

                const finalUrls = [...existingPhotoUrls, ...uploadedUrls];
                setInspectionPhotos(prev => ({
                    ...prev,
                    [editingInspection.id]: finalUrls
                }));

                setInspections(prev => prev.map(i =>
                    i.id === editingInspection.id
                        ? { ...i, ...payload, id: editingInspection.id, created_at: i.created_at, updated_at: new Date().toISOString() }
                        : i
                ));
                showToast("Vistoria atualizada com sucesso!", "success");
            } else {
                const payload = {
                    accommodation_id: formData.accommodation_id,
                    title: formData.title.toUpperCase(),
                    observations: formData.observations ? formData.observations.toUpperCase() : null,
                    inspection_date: new Date().toISOString(),
                    user_id: currentUser?.id,
                    status: "REALIZADO",
                    is_active: true
                };
                const { data: inserted, error: dbError } = await supabase
                    .from("inspections")
                    .insert(payload)
                    .select()
                    .single();
                if (dbError) throw dbError;
                const newInspection = inserted as Inspection;

                const uploadedUrls: string[] = [];
                for (const file of formData.photos) {
                    let compressedFile = file;
                    try {
                        compressedFile = await imageCompression(file, options);
                    } catch (error) {
                        console.error("Compression error:", error);
                    }
                    const fileExt = 'webp';
                    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                    const filePath = `${formData.accommodation_id}/${fileName}`;
                    const { error: uploadError } = await supabase.storage
                        .from('inspection-photos')
                        .upload(filePath, compressedFile, {
                            cacheControl: '3600',
                            upsert: false,
                            contentType: 'image/webp'
                        });
                    if (uploadError) {
                        throw new Error("Falha no upload da imagem");
                    }
                    const { data: { publicUrl } } = supabase.storage
                        .from('inspection-photos')
                        .getPublicUrl(filePath);
                    uploadedUrls.push(publicUrl);
                    await supabase
                        .from('inspection_photos')
                        .insert({ inspection_id: newInspection.id, photo_url: publicUrl, is_active: true });
                }

                setInspectionPhotos(prev => ({ ...prev, [newInspection.id]: uploadedUrls }));
                setInspections(prev => [newInspection, ...prev]);

                if (!inspectedAccommodationIds.includes(formData.accommodation_id)) {
                    setInspectedAccommodationIds(prev => [...prev, formData.accommodation_id]);
                }
                setSelectedAccommodationId(formData.accommodation_id);
                showToast("Vistoria salva com sucesso!", "success");
            }

            setShowModal(false);
            resetFormData();

        } catch (error) {
            console.error("Error saving inspection:", error);
            showToast("Erro ao salvar vistoria.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetFormData = () => {
        setFormData({
            accommodation_id: accommodations[0]?.id || 0,
            title: "",
            observations: "",
            photos: [],
        });
        setPhotoPreviews([]);
        setEditingInspection(null);
        setExistingPhotoUrls([]);
        setRemovedExistingUrls([]);
    };

    const openNewInspectionModal = () => {
        setEditingInspection(null);
        setFormData({
            accommodation_id: selectedAccommodationId || accommodations[0]?.id || 0,
            title: "",
            observations: "",
            photos: [],
        });
        setShowModal(true);
    };

    const openEditModal = (inspection: Inspection) => {
        setEditingInspection(inspection);
        const existing = inspectionPhotos[inspection.id] || [];
        setExistingPhotoUrls(existing);
        setRemovedExistingUrls([]);
        setPhotoPreviews([]);
        setFormData({
            accommodation_id: inspection.accommodation_id,
            title: inspection.title || "",
            observations: inspection.observations || "",
            photos: [],
        });
        setShowModal(true);
    };

    const handleDeleteInspection = async (inspectionId: number) => {
        try {
            const { error } = await supabase
                .from("inspections")
                .update({ is_active: false })
                .eq("id", inspectionId);

            if (error) throw error;

            setInspections(prev => prev.filter(i => i.id !== inspectionId));

            const remainingForAccommodation = inspections.filter(
                i => i.accommodation_id === selectedAccommodationId && i.id !== inspectionId
            );

            if (remainingForAccommodation.length === 0 && selectedAccommodationId) {
                setInspectedAccommodationIds(prev => prev.filter(id => id !== selectedAccommodationId));
                setSelectedAccommodationId(null);
            }

            showToast("Foto excluída com sucesso!", "success");
        } catch (error) {
            console.error("Error deleting inspection:", error);
            showToast("Erro ao excluir foto.", "error");
        }
    };

    const handleDeleteAllInspections = async () => {
        if (!selectedAccommodationId) return;

        try {
            const inspectionIds = selectedInspections.map(i => i.id);

            const { error } = await supabase
                .from("inspections")
                .update({ is_active: false })
                .in("id", inspectionIds);

            if (error) throw error;

            setInspections(prev => prev.filter(i => !inspectionIds.includes(i.id)));
            setInspectedAccommodationIds(prev => prev.filter(id => id !== selectedAccommodationId));
            setSelectedAccommodationId(null);
            setShowDeleteModal(false);

            showToast("Todas as fotos foram excluídas!", "success");
        } catch (error) {
            console.error("Error deleting inspections:", error);
            showToast("Erro ao excluir vistorias.", "error");
        }
    };

    const visibleAccommodations = accommodations.filter(acc =>
        inspectedAccommodationIds.includes(acc.id)
    );

    const selectedInspections = selectedAccommodationId
        ? inspections.filter(i => i.accommodation_id === selectedAccommodationId)
        : [];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
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

            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Vistorias</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">
                        Galeria de fotos e vistorias realizadas
                    </p>
                </div>
                <button
                    onClick={openNewInspectionModal}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-5 h-5" />
                    <span className="hidden md:inline">Nova Vistoria</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
                <div className="md:col-span-1 bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                            <Home className="w-5 h-5 text-blue-400" />
                            Alojamentos Vistoriados
                        </h2>
                    </div>
                    <div className="overflow-y-auto p-2 space-y-2 flex-1">
                        {visibleAccommodations.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 px-4">
                                Nenhuma vistoria realizada ainda. Clique em "Nova Vistoria" para começar.
                            </div>
                        ) : (
                            visibleAccommodations.map((acc) => (
                                <button
                                    key={acc.id}
                                    onClick={() => setSelectedAccommodationId(acc.id)}
                                    className={`w-full text-left p-3 rounded-lg transition-all border group flex items-center justify-between ${selectedAccommodationId === acc.id
                                        ? "bg-blue-500/10 border-blue-500/50"
                                        : "hover:bg-slate-800 border-transparent hover:border-slate-700"
                                        }`}
                                >
                                    <span className={`font-medium ${selectedAccommodationId === acc.id ? "text-blue-400" : "text-slate-300 group-hover:text-white"}`}>
                                        {acc.name}
                                    </span>
                                    <ClipboardCheck className="w-5 h-5 text-green-500" />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="md:col-span-2 bg-slate-900/30 rounded-xl border border-slate-700/30 flex flex-col h-full overflow-hidden">
                    {!selectedAccommodationId ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                            <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg">Selecione um alojamento ao lado para ver as fotos</p>
                        </div>
                    ) : (
                        <div className="p-4 overflow-y-auto h-full">
                            <div className="flex items-center justify-between mb-4 sticky top-0 bg-slate-900/95 p-2 z-10 rounded-lg backdrop-blur-sm border border-slate-800">
                                <h3 className="text-xl font-bold text-slate-200">
                                    {accommodations.find(a => a.id === selectedAccommodationId)?.name}
                                </h3>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-sm"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Excluir Todas
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {selectedInspections.map((inspection) => (
                                    <div key={inspection.id} className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-lg hover:shadow-xl transition-shadow">
                                        <div className="p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-slate-200 font-medium truncate">{inspection.title}</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => openEditModal(inspection)}
                                                        className="p-2 bg-blue-500/80 hover:bg-blue-600 text-white rounded-lg"
                                                        title="Editar"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteInspection(inspection.id)}
                                                        className="p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-lg"
                                                        title="Excluir vistoria"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                {(inspectionPhotos[inspection.id] || []).map((url, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={url}
                                                        alt={`Foto ${idx + 1}`}
                                                        className="w-full h-24 object-cover rounded border border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => setZoomedImage(url)}
                                                    />
                                                ))}
                                                {(!inspectionPhotos[inspection.id] || inspectionPhotos[inspection.id].length === 0) && (
                                                    <div className="col-span-3 w-full h-24 flex items-center justify-center text-slate-600 border border-dashed border-slate-700 rounded">
                                                        <ImageIcon className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>

                                            {inspection.observations && (
                                                <p className="text-slate-400 text-sm mt-3 line-clamp-2">
                                                    {inspection.observations}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-700 mt-3">
                                                <span>{new Date(inspection.created_at).toLocaleDateString('pt-BR')}</span>
                                                <span>{inspection.user_id && users[inspection.user_id] ? users[inspection.user_id].split(' ')[0] : 'Sistema'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedInspections.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    Nenhuma foto registrada para este alojamento.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <h2 className="text-xl font-bold text-slate-100 mb-6">
                            {editingInspection ? "Editar Vistoria" : "Nova Vistoria"}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Alojamento
                                </label>
                                <select
                                    value={formData.accommodation_id}
                                    onChange={(e) =>
                                        setFormData({ ...formData, accommodation_id: parseInt(e.target.value) })
                                    }
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                    disabled={!!editingInspection}
                                >
                                    <option value="">Selecione um alojamento</option>
                                    {accommodations.map((accommodation) => (
                                        <option key={accommodation.id} value={accommodation.id}>
                                            {accommodation.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Cômodo / Título da Foto
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    placeholder="Ex: SALA, QUARTO 1, COZINHA..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Fotos
                                </label>
                                {editingInspection && existingPhotoUrls.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                        {existingPhotoUrls.map((src, idx) => (
                                            <div key={`existing-${idx}`} className="relative">
                                                <img src={src} alt={`Atual ${idx + 1}`} className="w-full h-32 object-cover rounded-lg border border-slate-700" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeExistingUrl(src)}
                                                    className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {photoPreviews.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                        {photoPreviews.map((src, idx) => (
                                            <div key={`new-${idx}`} className="relative">
                                                <img src={src} alt={`Nova ${idx + 1}`} className="w-full h-32 object-cover rounded-lg border border-slate-700" />
                                                <button
                                                    type="button"
                                                    onClick={() => removePhotoAt(idx)}
                                                    className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:bg-slate-800/50 transition-colors cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        capture="environment"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        required={!editingInspection && photoPreviews.length === 0}
                                    />
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <ImageIcon className="w-8 h-8" />
                                        <span className="text-sm">
                                            {formData.photos.length > 0 ? `${formData.photos.length} arquivo(s) selecionado(s)` : "Clique para selecionar uma ou mais fotos"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Observações (Opcional)
                                </label>
                                <textarea
                                    value={formData.observations}
                                    onChange={(e) =>
                                        setFormData({ ...formData, observations: e.target.value.toUpperCase() })
                                    }
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[80px]"
                                    placeholder="Alguma observação sobre o estado do cômodo?"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all flex items-center justify-center gap-2"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        editingInspection ? "Atualizar Vistoria" : "Salvar Vistoria"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-xl border border-red-500/50 p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-500/10 rounded-full">
                                <Trash2 className="w-6 h-6 text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-100">
                                Confirmar Exclusão
                            </h2>
                        </div>

                        <p className="text-slate-300 mb-6">
                            Tem certeza que deseja excluir <strong>todas as {selectedInspections.length} fotos</strong> de vistoria desta casa?
                            <br />
                            <span className="text-red-400 text-sm mt-2 block">Esta ação não pode ser desfeita.</span>
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteAllInspections}
                                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Excluir Tudo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {zoomedImage && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setZoomedImage(null)}>
                    <div className="relative max-w-full max-h-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-4 right-4 flex gap-4 z-10">
                            <button
                                onClick={() => handleDownload(zoomedImage)}
                                className="p-2 bg-slate-800/50 hover:bg-slate-700 text-white rounded-full backdrop-blur-md transition-all"
                                title="Baixar imagem"
                            >
                                <Download className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => setZoomedImage(null)}
                                className="p-2 bg-slate-800/50 hover:bg-slate-700 text-white rounded-full backdrop-blur-md transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <img
                            src={zoomedImage}
                            alt="Zoom"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
