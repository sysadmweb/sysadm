import { useEffect, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { Loader2, Save, Trash2, Edit, Plus, FileDown, Calendar, User } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Employee = {
    id: number;
    full_name: string;
    unit_id: number;
};

type Unit = {
    id: number;
    name: string;
};

type WorkLog = {
    id: number;
    employee_id: number;
    work_date: string;
    entry_time_1: string | null;
    exit_time_1: string | null;
    entry_time_2: string | null;
    exit_time_2: string | null;
    created_at: string;
};

export default function WorkLogs() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
    const [editingLog, setEditingLog] = useState<WorkLog | null>(null);

    const [formData, setFormData] = useState({
        employee_id: 0,
        work_date: new Date().toISOString().split('T')[0],
        entry_time_1: "",
        exit_time_1: "",
        entry_time_2: "",
        exit_time_2: "",
    });

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [empRes, logsRes, unitsRes] = await Promise.all([
                supabase.from("employees").select("id, full_name, unit_id").eq("is_active", true).order("full_name"),
                supabase.from("work_logs").select("*").order("work_date", { ascending: false }),
                supabase.from("units").select("id, name").eq("is_active", true)
            ]);

            if (empRes.error) throw empRes.error;
            if (logsRes.error) throw logsRes.error;
            if (unitsRes.error) throw unitsRes.error;

            setEmployees(empRes.data || []);
            setWorkLogs(logsRes.data || []);
            setUnits(unitsRes.data || []);
        } catch (error) {
            console.error("Error fetching data:", error);
            showToast("Erro ao carregar dados.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.employee_id) {
            showToast("Selecione um colaborador.", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                employee_id: formData.employee_id,
                work_date: formData.work_date,
                entry_time_1: formData.entry_time_1 || null,
                exit_time_1: formData.exit_time_1 || null,
                entry_time_2: formData.entry_time_2 || null,
                exit_time_2: formData.exit_time_2 || null,
            };

            if (editingLog) {
                const { error } = await supabase
                    .from("work_logs")
                    .update(payload)
                    .eq("id", editingLog.id);
                if (error) throw error;
                showToast("Jornada atualizada com sucesso!", "success");
            } else {
                const { error } = await supabase
                    .from("work_logs")
                    .insert(payload);
                if (error) throw error;
                showToast("Jornada registrada com sucesso!", "success");
            }

            setShowModal(false);
            fetchData();
            resetForm();
        } catch (error) {
            console.error("Error saving work log:", error);
            showToast("Erro ao salvar jornada.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este registro?")) return;
        try {
            const { error } = await supabase.from("work_logs").delete().eq("id", id);
            if (error) throw error;
            setWorkLogs(prev => prev.filter(log => log.id !== id));
            showToast("Registro excluído.", "success");
        } catch (error) {
            console.error("Error deleting log:", error);
            showToast("Erro ao excluir registro.", "error");
        }
    };

    const resetForm = () => {
        setFormData({
            employee_id: 0,
            work_date: new Date().toISOString().split('T')[0],
            entry_time_1: "",
            exit_time_1: "",
            entry_time_2: "",
            exit_time_2: "",
        });
        setEditingLog(null);
    };

    const openEditModal = (log: WorkLog) => {
        setEditingLog(log);
        setFormData({
            employee_id: log.employee_id,
            work_date: log.work_date,
            entry_time_1: log.entry_time_1 || "",
            exit_time_1: log.exit_time_1 || "",
            entry_time_2: log.entry_time_2 || "",
            exit_time_2: log.exit_time_2 || "",
        });
        setShowModal(true);
    };

    const openNewModal = () => {
        resetForm();
        setShowModal(true);
    };

    const generatePDF = async () => {
        const doc = new jsPDF();
        const logoUrl = "/logo.png";

        // Group logs by employee
        const groupedLogs: Record<number, WorkLog[]> = {};
        workLogs.forEach(log => {
            if (!groupedLogs[log.employee_id]) {
                groupedLogs[log.employee_id] = [];
            }
            groupedLogs[log.employee_id].push(log);
        });

        const employeeIds = Object.keys(groupedLogs).map(Number);

        // Load logo
        let logoDataUrl: string | null = null;
        try {
            const response = await fetch(logoUrl);
            const blob = await response.blob();
            logoDataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Error loading logo:", error);
        }

        employeeIds.forEach((empId, index) => {
            if (index > 0) {
                doc.addPage();
            }

            const employee = employees.find(e => e.id === empId);
            const unit = units.find(u => u.id === employee?.unit_id);
            const logs = groupedLogs[empId].sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());

            // Header
            if (logoDataUrl) {
                doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
            }

            doc.setFontSize(18);
            doc.text("Relatório de Jornada", 50, 20);

            doc.setFontSize(11);
            const startX = 50;
            let currentY = 30;
            const lineHeight = 6;

            doc.text(`Colaborador: ${employee?.full_name || "Desconhecido"}`, startX, currentY);
            currentY += lineHeight;
            doc.text(`Obra: ${unit?.name || "-"}`, startX, currentY);
            currentY += lineHeight;
            doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, startX, currentY);

            // Table
            autoTable(doc, {
                startY: 55,
                head: [["Data", "Entrada", "Saída Almoço", "Volta Almoço", "Saída"]],
                body: logs.map(log => [
                    new Date(log.work_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
                    log.entry_time_1?.slice(0, 5) || "-",
                    log.exit_time_1?.slice(0, 5) || "-",
                    log.entry_time_2?.slice(0, 5) || "-",
                    log.exit_time_2?.slice(0, 5) || "-"
                ]),
                theme: 'grid',
                styles: {
                    fontSize: 10,
                    halign: 'center',
                    valign: 'middle',
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1,
                },
                headStyles: {
                    fillColor: [41, 128, 185],
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center',
                },
                columnStyles: {
                    0: { halign: 'center' }, // Data
                    1: { halign: 'center' }, // Entrada
                    2: { halign: 'center' }, // Saída Almoço
                    3: { halign: 'center' }, // Volta Almoço
                    4: { halign: 'center' }, // Saída
                },
            });
        });

        doc.save("relatorio_jornada.pdf");
    };

    return (
        <div className="space-y-6">
            {toast && (
                <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"}`}>
                    {toast.text}
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Jornada de Trabalho</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Registro de horários dos colaboradores</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={generatePDF}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all border border-slate-700"
                    >
                        <FileDown className="w-5 h-5" />
                        <span className="hidden sm:inline">Exportar</span>
                    </button>
                    <button
                        onClick={openNewModal}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">Novo Registro</span>
                    </button>
                </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:block bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-700/50 bg-slate-800/30">
                                <th className="p-4 text-slate-300 font-medium">Data</th>
                                <th className="p-4 text-slate-300 font-medium">Colaborador</th>
                                <th className="p-4 text-slate-300 font-medium text-center">Entrada</th>
                                <th className="p-4 text-slate-300 font-medium text-center">Saída Almoço</th>
                                <th className="p-4 text-slate-300 font-medium text-center">Volta Almoço</th>
                                <th className="p-4 text-slate-300 font-medium text-center">Saída</th>
                                <th className="p-4 text-slate-300 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                        Carregando...
                                    </td>
                                </tr>
                            ) : workLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        Nenhum registro encontrado.
                                    </td>
                                </tr>
                            ) : (
                                workLogs.map((log) => {
                                    const employee = employees.find(e => e.id === log.employee_id);
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="p-4 text-slate-300">
                                                {new Date(log.work_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                            </td>
                                            <td className="p-4 text-slate-200 font-medium">
                                                {employee?.full_name || "Desconhecido"}
                                            </td>
                                            <td className="p-4 text-slate-400 text-center">{log.entry_time_1?.slice(0, 5) || "-"}</td>
                                            <td className="p-4 text-slate-400 text-center">{log.exit_time_1?.slice(0, 5) || "-"}</td>
                                            <td className="p-4 text-slate-400 text-center">{log.entry_time_2?.slice(0, 5) || "-"}</td>
                                            <td className="p-4 text-slate-400 text-center">{log.exit_time_2?.slice(0, 5) || "-"}</td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openEditModal(log)}
                                                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(log.id)}
                                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {isLoading ? (
                    <div className="text-center py-8 text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        Carregando...
                    </div>
                ) : workLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-700/50">
                        Nenhum registro encontrado.
                    </div>
                ) : (
                    workLogs.map((log) => {
                        const employee = employees.find(e => e.id === log.employee_id);
                        return (
                            <div key={log.id} className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 text-slate-200 font-medium mb-1">
                                            <User className="w-4 h-4 text-blue-400" />
                                            {employee?.full_name || "Desconhecido"}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(log.work_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => openEditModal(log)}
                                            className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(log.id)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-700/50 pt-3">
                                    <div className="bg-slate-800/50 p-2 rounded-lg text-center">
                                        <span className="block text-xs text-slate-500 mb-1">Entrada</span>
                                        <span className="text-slate-200 font-mono">{log.entry_time_1?.slice(0, 5) || "-"}</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg text-center">
                                        <span className="block text-xs text-slate-500 mb-1">Saída Almoço</span>
                                        <span className="text-slate-200 font-mono">{log.exit_time_1?.slice(0, 5) || "-"}</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg text-center">
                                        <span className="block text-xs text-slate-500 mb-1">Volta Almoço</span>
                                        <span className="text-slate-200 font-mono">{log.entry_time_2?.slice(0, 5) || "-"}</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg text-center">
                                        <span className="block text-xs text-slate-500 mb-1">Saída</span>
                                        <span className="text-slate-200 font-mono">{log.exit_time_2?.slice(0, 5) || "-"}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-slate-100 mb-6">
                            {editingLog ? "Editar Jornada" : "Nova Jornada"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Colaborador</label>
                                <select
                                    value={formData.employee_id}
                                    onChange={e => setFormData({ ...formData, employee_id: Number(e.target.value) })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                >
                                    <option value={0}>Selecione...</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Data</label>
                                <input
                                    type="date"
                                    value={formData.work_date}
                                    onChange={e => setFormData({ ...formData, work_date: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Entrada</label>
                                    <input
                                        type="time"
                                        value={formData.entry_time_1}
                                        onChange={e => setFormData({ ...formData, entry_time_1: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Saída Almoço</label>
                                    <input
                                        type="time"
                                        value={formData.exit_time_1}
                                        onChange={e => setFormData({ ...formData, exit_time_1: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Volta Almoço</label>
                                    <input
                                        type="time"
                                        value={formData.entry_time_2}
                                        onChange={e => setFormData({ ...formData, entry_time_2: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Saída</label>
                                    <input
                                        type="time"
                                        value={formData.exit_time_2}
                                        onChange={e => setFormData({ ...formData, exit_time_2: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
