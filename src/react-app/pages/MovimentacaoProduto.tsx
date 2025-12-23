import { useEffect, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Plus, Loader2, User, Package, Image as ImageIcon, X, Search, Edit, RotateCcw } from "lucide-react";
import imageCompression from 'browser-image-compression';
import { Product, Employee } from "@/shared/types";

type ProductMovement = {
    id: number;
    employee_id: number;
    product_id: number;
    movement_date: string;
    quantity: number;
    photo_url?: string | null;
    observation?: string | null;
    user_id?: number;
    created_at: string;
    is_active: boolean;
    products?: {
        name: string;
        code: string;
    };
};

export default function MovimentacaoProduto() {
    const { user: currentUser } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [movements, setMovements] = useState<ProductMovement[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        employee_id: 0,
        product_id: 0,
        movement_date: new Date().toISOString().split('T')[0],
        quantity: 1,
        observation: "",
        photo: null as File | null,
    });
    const [editingMovement, setEditingMovement] = useState<ProductMovement | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [showStockAlert, setShowStockAlert] = useState(false);

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([fetchEmployees(), fetchProducts(), fetchMovements()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const fetchEmployees = async () => {
        try {
            const { data, error } = await supabase
                .from("employees")
                .select("*")
                .eq("is_active", true)
                .order("full_name");

            if (!error && data) {
                setEmployees(data as Employee[]);
            }
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from("products")
                .select("*")
                .order("name");

            if (!error && data) {
                setProducts(data as Product[]);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
        }
    };

    const fetchMovements = async () => {
        try {
            const { data, error } = await supabase
                .from("product_movements")
                .select(`
                    *,
                    products (
                        name,
                        code
                    )
                `)
                .eq("is_active", true)
                .is("return_date", null) // Only show items not returned
                .order("movement_date", { ascending: false });

            if (!error && data) {
                setMovements(data as ProductMovement[]);
            }
        } catch (error) {
            console.error("Error fetching movements:", error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFormData({ ...formData, photo: file });
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const removePhoto = () => {
        setFormData({ ...formData, photo: null });
        setPhotoPreview(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.employee_id || !formData.product_id) {
            showToast("Selecione um colaborador e um produto.", "error");
            return;
        }

        setIsSubmitting(true);

        try {
            let photoUrl = null;

            if (formData.photo) {
                const options = {
                    maxSizeMB: 0.3,
                    maxWidthOrHeight: 1280,
                    useWebWorker: true,
                    fileType: 'image/webp',
                    initialQuality: 0.6 as number,
                };

                let compressedFile = formData.photo;
                try {
                    compressedFile = await imageCompression(formData.photo, options);
                } catch (error) {
                    console.error("Compression error:", error);
                }

                const fileExt = 'webp';
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `movements/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('inspection-photos') // Reusing existing bucket or create new if needed
                    .upload(filePath, compressedFile, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: 'image/webp'
                    });

                if (uploadError) throw new Error("Falha no upload da imagem");

                const { data: { publicUrl } } = supabase.storage
                    .from('inspection-photos')
                    .getPublicUrl(filePath);

                photoUrl = publicUrl;
            }

            if (editingMovement) {
                const { error } = await supabase.rpc('update_movement', {
                    p_movement_id: editingMovement.id,
                    p_employee_id: formData.employee_id,
                    p_product_id: formData.product_id,
                    p_movement_date: new Date(formData.movement_date).toISOString(),
                    p_quantity: formData.quantity,
                    p_observation: formData.observation ? formData.observation.toUpperCase() : null,
                    p_photo_url: photoUrl || editingMovement.photo_url,
                    p_user_id: currentUser?.id
                });

                if (error) throw error;
                showToast("Movimentação atualizada com sucesso!", "success");
            } else {
                const { error } = await supabase.rpc('register_movement', {
                    p_employee_id: formData.employee_id,
                    p_product_id: formData.product_id,
                    p_movement_date: new Date(formData.movement_date).toISOString(),
                    p_quantity: formData.quantity,
                    p_observation: formData.observation ? formData.observation.toUpperCase() : null,
                    p_photo_url: photoUrl,
                    p_user_id: currentUser?.id
                });

                if (error) throw error;
                showToast("Movimentação registrada com sucesso!", "success");
            }
            setShowModal(false);
            resetFormData();
            fetchMovements();

            // Auto-select the employee to show the new/updated movement
            setSelectedEmployeeId(formData.employee_id);

        } catch (error: any) {
            console.error("Error saving movement:", error);
            showToast(error.message || "Erro ao registrar movimentação.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetFormData = () => {
        setFormData({
            employee_id: selectedEmployeeId || 0,
            product_id: 0,
            movement_date: new Date().toISOString().split('T')[0],
            quantity: 1,
            observation: "",
            photo: null,
        });
        setPhotoPreview(null);
        setEditingMovement(null);
    };

    const handleEdit = (movement: ProductMovement) => {
        setEditingMovement(movement);
        setFormData({
            employee_id: movement.employee_id,
            product_id: movement.product_id,
            movement_date: new Date(movement.movement_date).toISOString().split('T')[0],
            quantity: movement.quantity,
            observation: movement.observation || "",
            photo: null,
        });
        setPhotoPreview(movement.photo_url || null);
        setShowModal(true);
    };

    const handleReturn = async (movementId: number) => {
        if (!confirm("Confirmar devolução deste item? O estoque será reposto.")) return;

        try {
            const { error } = await supabase.rpc('return_movement', {
                p_movement_id: movementId,
                p_return_date: new Date().toISOString()
            });

            if (error) throw error;

            showToast("Item devolvido com sucesso!", "success");
            fetchMovements();
        } catch (error: any) {
            console.error("Error returning item:", error);
            showToast(error.message || "Erro ao devolver item.", "error");
        }
    };

    const handleProductChange = (productId: number) => {
        const product = products.find(p => p.id === productId);

        if (product && product.quantity === 0) {
            setShowStockAlert(true);
            return;
        }

        setFormData({ ...formData, product_id: productId, quantity: 1 });
    };

    const openNewMovementModal = () => {
        resetFormData();
        setShowModal(true);
    };

    // Get employees who have movements
    const employeesWithMovements = Array.from(new Set(movements.map(m => m.employee_id)));

    // Combine employees with movements and filtered search results
    const displayedEmployees = employees.filter(emp =>
        employeesWithMovements.includes(emp.id) ||
        (searchTerm && emp.full_name.toUpperCase().includes(searchTerm.toUpperCase()))
    );

    const selectedMovements = selectedEmployeeId
        ? movements.filter(m => m.employee_id === selectedEmployeeId)
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
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Movimentação</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">
                        Controle de retirada de produtos por colaborador
                    </p>
                </div>
                <button
                    onClick={openNewMovementModal}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-5 h-5" />
                    <span className="hidden md:inline">Nova Movimentação</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Left Sidebar - Employees List */}
                <div className="md:col-span-1 bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2 mb-3">
                            <User className="w-5 h-5 text-blue-400" />
                            Colaboradores
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar colaborador..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto p-2 space-y-2 flex-1">
                        {displayedEmployees.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 px-4">
                                Nenhum colaborador encontrado.
                            </div>
                        ) : (
                            displayedEmployees.map((emp) => (
                                <button
                                    key={emp.id}
                                    onClick={() => setSelectedEmployeeId(emp.id)}
                                    className={`w-full text-left p-3 rounded-lg transition-all border group flex items-center justify-between ${selectedEmployeeId === emp.id
                                        ? "bg-blue-500/10 border-blue-500/50"
                                        : "hover:bg-slate-800 border-transparent hover:border-slate-700"
                                        }`}
                                >
                                    <div>
                                        <span className={`font-medium block ${selectedEmployeeId === emp.id ? "text-blue-400" : "text-slate-300 group-hover:text-white"}`}>
                                            {emp.full_name}
                                        </span>
                                        {movements.filter(m => m.employee_id === emp.id).length > 0 && (
                                            <span className="text-xs text-slate-500">
                                                {movements.filter(m => m.employee_id === emp.id).length} itens retirados
                                            </span>
                                        )}
                                    </div>
                                    <Package className={`w-5 h-5 ${selectedEmployeeId === emp.id ? "text-blue-400" : "text-slate-600"}`} />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Content - Movements List */}
                <div className="md:col-span-2 bg-slate-900/30 rounded-xl border border-slate-700/30 flex flex-col h-full overflow-hidden">
                    {!selectedEmployeeId ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                            <Package className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg">Selecione um colaborador ao lado para ver as movimentações</p>
                        </div>
                    ) : (
                        <div className="p-4 overflow-y-auto h-full">
                            <div className="flex items-center justify-between mb-4 sticky top-0 bg-slate-900/95 p-2 z-10 rounded-lg backdrop-blur-sm border border-slate-800">
                                <h3 className="text-xl font-bold text-slate-200">
                                    {employees.find(e => e.id === selectedEmployeeId)?.full_name}
                                </h3>
                                <span className="text-sm text-slate-400">
                                    {selectedMovements.length} registros
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {selectedMovements.map((movement) => (
                                    <div key={movement.id} className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row h-auto min-h-[100px]">
                                        {movement.photo_url && (
                                            <div className="w-full md:w-32 h-32 md:h-auto flex-shrink-0 bg-slate-900">
                                                <img
                                                    src={movement.photo_url}
                                                    alt="Foto da retirada"
                                                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => setZoomedImage(movement.photo_url || null)}
                                                />
                                            </div>
                                        )}
                                        <div className="p-3 flex-1 flex flex-col justify-between">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-slate-500 block text-xs uppercase tracking-wider">Nome Produto</span>
                                                    <span className="text-slate-200 font-medium">{movement.products?.name}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs uppercase tracking-wider">Data Retirada</span>
                                                    <span className="text-slate-300">{new Date(movement.movement_date).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs uppercase tracking-wider">Quantidade</span>
                                                    <span className="text-blue-400 font-bold">{movement.quantity}</span>
                                                </div>
                                                {/* Data Devolução is hidden as requested for active items, but structure is here if needed */}
                                            </div>

                                            {movement.observation && (
                                                <div className="mt-2 text-xs text-slate-400 italic border-t border-slate-700/50 pt-1">
                                                    Obs: {movement.observation}
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-700/50">
                                                <button
                                                    onClick={() => handleEdit(movement)}
                                                    className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-all text-xs"
                                                >
                                                    <Edit className="w-3 h-3" />
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleReturn(movement.id)}
                                                    className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-all text-xs"
                                                    title="Marcar como devolvido"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    Devolver
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedMovements.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    Nenhuma movimentação registrada para este colaborador.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
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
                            {editingMovement ? "Editar Movimentação" : "Nova Movimentação"}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Data da Retirada
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.movement_date}
                                        onChange={(e) => setFormData({ ...formData, movement_date: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Quantidade
                                        {formData.product_id > 0 && (() => {
                                            const selectedProduct = products.find(p => p.id === formData.product_id);
                                            return selectedProduct ? (
                                                <span className="ml-2 text-xs text-slate-400">
                                                    (Disponível: {selectedProduct.quantity})
                                                </span>
                                            ) : null;
                                        })()}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={(() => {
                                            const selectedProduct = products.find(p => p.id === formData.product_id);
                                            return selectedProduct?.quantity || 999999;
                                        })()}
                                        value={formData.quantity}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value) || 0;
                                            const selectedProduct = products.find(p => p.id === formData.product_id);
                                            const maxQty = selectedProduct?.quantity || 999999;
                                            setFormData({ ...formData, quantity: Math.min(value, maxQty) });
                                        }}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Colaborador
                                </label>
                                <select
                                    value={formData.employee_id}
                                    onChange={(e) => setFormData({ ...formData, employee_id: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                >
                                    <option value="0">Selecione um colaborador</option>
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Produto
                                </label>
                                <select
                                    value={formData.product_id}
                                    onChange={(e) => handleProductChange(parseInt(e.target.value))}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                >
                                    <option value="0">Selecione um produto</option>
                                    {products.map((prod) => (
                                        <option key={prod.id} value={prod.id}>
                                            {prod.name} ({prod.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Foto (Opcional)
                                </label>
                                {photoPreview ? (
                                    <div className="relative w-full h-48 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                                        <img src={photoPreview} alt="Preview" className="w-full h-full object-contain" />
                                        <button
                                            type="button"
                                            onClick={removePhoto}
                                            className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:bg-slate-800/50 transition-colors cursor-pointer relative h-32 flex items-center justify-center">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <ImageIcon className="w-8 h-8" />
                                            <span className="text-sm">Clique para tirar ou selecionar uma foto</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Observação (Opcional)
                                </label>
                                <textarea
                                    value={formData.observation}
                                    onChange={(e) => setFormData({ ...formData, observation: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[80px]"
                                    placeholder="Observações sobre a retirada..."
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
                                        editingMovement ? "Salvar Alterações" : "Salvar Movimentação"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Image Zoom Modal */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setZoomedImage(null)}
                >
                    <img
                        src={zoomedImage}
                        alt="Zoom"
                        className="max-w-full max-h-full object-contain rounded-lg"
                    />
                    <button
                        className="absolute top-4 right-4 text-white hover:text-slate-300"
                        onClick={() => setZoomedImage(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                </div>
            )}

            {/* Stock Alert Modal */}
            {showStockAlert && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                                <Package className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-100">Produto sem Estoque</h3>
                                <p className="text-sm text-slate-400">Este produto não está disponível</p>
                            </div>
                        </div>
                        <p className="text-slate-300 mb-6">
                            O produto selecionado não possui quantidade em estoque. Por favor, selecione outro produto ou aguarde a reposição.
                        </p>
                        <button
                            onClick={() => setShowStockAlert(false)}
                            className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
