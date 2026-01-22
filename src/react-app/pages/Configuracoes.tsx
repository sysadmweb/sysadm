import React, { useState, useEffect } from "react";
import { supabase } from "@/react-app/supabase";
import { Save, Loader2, CreditCard, Image as ImageIcon, X, ChevronDown, ChevronRight, Settings } from "lucide-react";

interface ConfigItem {
    id: number;
    key: string;
    value: string;
    description: string;
}

const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new window.Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 300;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }
                ctx.clearRect(0, 0, size, size);
                const scale = Math.min(size / img.width, size / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                const x = (size - w) / 2;
                const y = (size - h) / 2;
                ctx.drawImage(img, x, y, w, h);
                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

interface SettingSectionProps {
    icon: any;
    title: string;
    subtitle: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
}

function SettingSection({ icon: Icon, title, subtitle, children, isOpen, onToggle }: SettingSectionProps) {
    return (
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl border border-slate-700/30 overflow-hidden shadow-lg transition-all duration-300">
            <button
                onClick={onToggle}
                className={`w-full flex items-center justify-between p-5 hover:bg-slate-800/40 transition-colors ${isOpen ? 'bg-slate-800/60 border-b border-slate-700/50' : ''}`}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-lg border ${isOpen ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
                        <p className="text-sm text-slate-400">{subtitle}</p>
                    </div>
                </div>
                {isOpen ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
            </button>
            <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100 p-6' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                {children}
            </div>
        </div>
    );
}

export default function Configuracoes() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
    const [openSection, setOpenSection] = useState<string | null>("personalizacao");

    // Form states
    const [mealTargetDays, setMealTargetDays] = useState("");
    const [mealStock, setMealStock] = useState("");
    const [systemLogo, setSystemLogo] = useState<string | null>(null);

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from("config").select("*");
            if (error) throw error;
            const items = (data || []) as ConfigItem[];
            setMealTargetDays(items.find(i => i.key === "meal_target_days")?.value || "0");
            setMealStock(items.find(i => i.key === "meal_stock")?.value || "0");
            setSystemLogo(items.find(i => i.key === "system_logo")?.value || null);
        } catch (error) {
            console.error("Error fetching configs:", error);
            showToast("Erro ao carregar configurações", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                showToast("A imagem deve ter no máximo 2MB", "error");
                return;
            }
            try {
                const base64 = await processImage(file);
                setSystemLogo(base64);
            } catch (error) {
                console.error("Error processing image:", error);
                showToast("Erro ao processar imagem", "error");
            }
        }
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            const updates = [
                { key: "meal_target_days", value: mealTargetDays },
                { key: "meal_stock", value: mealStock },
                { key: "system_logo", value: systemLogo || "" }
            ];
            for (const update of updates) {
                const { error } = await supabase
                    .from("config")
                    .upsert({ key: update.key, value: update.value }, { onConflict: "key" });
                if (error) throw error;
            }
            showToast("Configurações salvas com sucesso!", "success");
            fetchConfigs();
        } catch (error) {
            console.error("Error saving configs:", error);
            showToast("Erro ao salvar configurações", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
            {toast && (
                <div className={`fixed top-4 right-4 z-[9999] px-4 py-2 rounded-lg shadow-lg ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"}`}>
                    {toast.text}
                </div>
            )}

            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700 shadow-xl">
                        <Settings className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Configurações</h1>
                        <p className="text-slate-400">Gerencie os parâmetros do sistema</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <SettingSection
                    icon={ImageIcon}
                    title="Personalização do Sistema"
                    subtitle="Logo dos relatórios e aparência visual"
                    isOpen={openSection === "personalizacao"}
                    onToggle={() => setOpenSection(openSection === "personalizacao" ? null : "personalizacao")}
                >
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-1 w-full">
                                <label className="text-sm font-medium text-slate-400 mb-3 block">Upload do Logo</label>
                                <div className="relative border-2 border-dashed border-slate-700 bg-slate-800/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all hover:border-blue-500/50 hover:bg-slate-800/40 group cursor-pointer group">
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="p-4 bg-slate-800/80 rounded-full mb-4 group-hover:scale-110 group-hover:bg-blue-500/10 transition-all border border-slate-700 group-hover:border-blue-500/30">
                                        <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-blue-400" />
                                    </div>
                                    <p className="text-slate-200 font-medium mb-1">Clique para enviar ou arraste</p>
                                    <p className="text-xs text-slate-500">PNG, JPG (Máx 2MB)</p>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-3">
                                <label className="text-sm font-medium text-slate-400 block">Visualização</label>
                                {systemLogo ? (
                                    <div className="relative p-3 bg-white rounded-2xl border border-slate-700 shadow-2xl group animate-in zoom-in duration-300">
                                        <img src={systemLogo} alt="Logo" className="h-32 w-32 object-contain" />
                                        <button onClick={() => setSystemLogo(null)} className="absolute -top-3 -right-3 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-xl border-2 border-slate-900 transition-transform hover:scale-110">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-white/50 rounded-2xl border border-slate-700 shadow-inner grayscale opacity-40">
                                        <img src="/logo.png" alt="Padrão" className="h-32 w-32 object-contain" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                            A imagem será redimensionada para 300x300 pixels automaticamente, mantendo a compatibilidade com todos os relatórios do sistema.
                        </p>
                    </div>
                </SettingSection>

                <SettingSection
                    icon={CreditCard}
                    title="Vale Refeição"
                    subtitle="Parâmetros para cálculo e projeção de vales"
                    isOpen={openSection === "refeicao"}
                    onToggle={() => setOpenSection(openSection === "refeicao" ? null : "refeicao")}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-300">Dias Planejados (Cobertura)</label>
                            <input
                                type="number"
                                value={mealTargetDays}
                                onChange={(e) => setMealTargetDays(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="Ex: 22"
                            />
                            <p className="text-xs text-slate-500">Define para quantos dias o sistema deve projetar o estoque necessário.</p>
                        </div>
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-300">Quantidade em Estoque</label>
                            <input
                                type="number"
                                value={mealStock}
                                onChange={(e) => setMealStock(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="Ex: 500"
                            />
                            <p className="text-xs text-slate-500">Saldo físico atual de vales disponíveis para entrega.</p>
                        </div>
                    </div>
                </SettingSection>
            </div>

            <div className="mt-12 bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-slate-700/50 p-5 shadow-2xl flex justify-end items-center gap-4">
                <p className="text-xs text-slate-500 mr-auto hidden md:block italic">As alterações serão aplicadas globalmente nos relatórios e cálculos.</p>
                <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="flex items-center gap-3 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-95 transform"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Salvando...</span>
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            <span>Salvar Alterações</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
