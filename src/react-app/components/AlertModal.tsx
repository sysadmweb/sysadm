import { AlertTriangle } from "lucide-react";

interface AlertModalProps {
    isOpen: boolean;
    message: string;
    onClose: () => void;
}

export default function AlertModal({ isOpen, message, onClose }: AlertModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-red-500/50 p-6 rounded-xl shadow-2xl w-full max-w-sm text-center relative animate-in fade-in zoom-in duration-300">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mb-4">
                    <AlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">Atenção Necessária</h3>
                <p className="text-slate-300 mb-6">{message}</p>
                <button
                    onClick={onClose}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all"
                >
                    OK, Entendi
                </button>
            </div>
        </div>
    );
}
