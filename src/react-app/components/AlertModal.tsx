import { AlertTriangle, CheckCircle } from "lucide-react";

interface AlertModalProps {
    isOpen: boolean;
    message: string;
    onClose: () => void;
    type?: "success" | "error";
}

export default function AlertModal({ isOpen, message, onClose, type = "error" }: AlertModalProps) {
    if (!isOpen) return null;

    const isSuccess = type === "success";

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`bg-slate-900 border p-6 rounded-xl shadow-2xl w-full max-w-sm text-center relative animate-in fade-in zoom-in duration-300 ${isSuccess ? "border-green-500/50" : "border-red-500/50"
                }`}>
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4 ${isSuccess ? "bg-green-500/10" : "bg-red-500/10"
                    }`}>
                    {isSuccess ? (
                        <CheckCircle className="h-10 w-10 text-green-500" />
                    ) : (
                        <AlertTriangle className="h-10 w-10 text-red-500" />
                    )}
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">
                    {isSuccess ? "Sucesso!" : "Atenção Necessária"}
                </h3>
                <p className="text-slate-300 mb-6">{message}</p>
                <button
                    onClick={onClose}
                    className={`w-full py-3 font-semibold rounded-lg transition-all text-white ${isSuccess
                            ? "bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20"
                            : "bg-red-600 hover:bg-red-700"
                        }`}
                >
                    OK, Entendi
                </button>
            </div>
        </div>
    );
}
