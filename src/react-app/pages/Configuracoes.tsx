import { useState, useEffect } from "react";
import { supabase } from "@/react-app/supabase";
import { Save, Loader2, CreditCard } from "lucide-react";

interface ConfigItem {
    id: number;
    key: string;
    value: string;
    description: string;
}

export default function Configuracoes() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

    // Form states
    const [mealTargetDays, setMealTargetDays] = useState("");
    const [mealStock, setMealStock] = useState("");

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

            // Populate form
            const targetDays = items.find(i => i.key === "meal_target_days")?.value || "0";
            const stock = items.find(i => i.key === "meal_stock")?.value || "0";

            setMealTargetDays(targetDays);
            setMealStock(stock);
        } catch (error) {
            console.error("Error fetching configs:", error);
            showToast("Erro ao carregar configurações", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveMealSettings = async () => {
        setIsSaving(true);
        try {
            const updates = [
                { key: "meal_target_days", value: mealTargetDays },
                { key: "meal_stock", value: mealStock }
            ];

            for (const update of updates) {
                // Upsert based on key
                const { error } = await supabase
                    .from("config")
                    .upsert({
                        key: update.key,
                        value: update.value,
                        // We preserve description if it exists, or add default if new (though migration handles defaults)
                    }, { onConflict: "key" });

                if (error) throw error;
            }

            showToast("Configurações salvas com sucesso!", "success");
            fetchConfigs(); // Refresh to be sure
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
        <div className="space-y-6 max-w-4xl mx-auto">
            {toast && (
                <div className={`fixed top-4 right-4 z-[9999] px-4 py-2 rounded-lg shadow-lg ${toast.kind === "success"
                    ? "bg-green-500/10 border border-green-500/50 text-green-400"
                    : "bg-red-500/10 border border-red-500/50 text-red-400"
                    }`}>
                    {toast.text}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Configurações</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie os parâmetros do sistema</p>
                </div>
            </div>

            {/* Meal Vouchers Section */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <CreditCard className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-100">Vale Refeição</h2>
                        <p className="text-sm text-slate-400">Configure os parâmetros para cálculo de vales</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">
                            Dias Planejados
                        </label>
                        <input
                            type="number"
                            value={mealTargetDays}
                            onChange={(e) => setMealTargetDays(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Ex: 22"
                        />
                        <p className="text-xs text-slate-500">
                            Quantidade de dias que você deseja cobrir com os vales.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">
                            Vales em Estoque
                        </label>
                        <input
                            type="number"
                            value={mealStock}
                            onChange={(e) => setMealStock(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Ex: 500"
                        />
                        <p className="text-xs text-slate-500">
                            Quantidade atual de vales que você possui fisicamente.
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleSaveMealSettings}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-blue-600/20"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Salvar Alterações
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
