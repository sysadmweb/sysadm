import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Loader2, Save, Calendar, Search, ChevronLeft, ChevronRight, Clock, MessageSquare, CheckSquare, Users } from "lucide-react";
import AlertModal from "../components/AlertModal";

// --- Subcomponent: Calendar ---
type DayStatus = "none" | "partial" | "complete";

interface CalendarProps {
    selectedDate: string;
    onDateSelect: (date: string) => void;
    dayStatuses: Record<string, DayStatus>;
}

function WorkDaysCalendar({ selectedDate, onDateSelect, dayStatuses }: CalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const getDaysInMonth = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days: { date: Date | null; dateStr: string }[] = [];

        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push({ date: null, dateStr: "" });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            days.push({ date, dateStr });
        }

        return days;
    };

    const changeMonth = (delta: number) => {
        const newMonth = new Date(currentMonth);
        newMonth.setMonth(newMonth.getMonth() + delta);
        setCurrentMonth(newMonth);
    };

    const days = getDaysInMonth();
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    return (
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-100">Calendário</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-slate-200 text-sm font-medium min-w-[100px] text-center uppercase">
                        {currentMonth.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                    </span>
                    <button
                        onClick={() => changeMonth(1)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                    <div key={day} className="text-center text-[10px] uppercase font-bold text-slate-500 py-1">
                        {day}
                    </div>
                ))}
                {days.map((day, idx) => {
                    const status = dayStatuses[day.dateStr] || "none";
                    const isSelected = selectedDate === day.dateStr;

                    return (
                        <button
                            key={idx}
                            onClick={() => day.date && onDateSelect(day.dateStr)}
                            disabled={!day.date}
                            className={`aspect-square flex items-center justify-center text-xs rounded-lg transition-all border
                                ${!day.date ? "invisible" : ""}
                                ${isSelected ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900" : ""}
                                ${status === "complete" ? "bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30" :
                                    status === "partial" ? "bg-orange-500/20 border-orange-500/50 text-orange-400 hover:bg-orange-500/30" :
                                        "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700"}
                            `}
                        >
                            {day.date?.getDate()}
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-wrap gap-3 text-[10px] uppercase font-bold tracking-wider">
                <div className="flex items-center gap-1.5 text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                    <span>Vazio</span>
                </div>
                <div className="flex items-center gap-1.5 text-orange-400">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span>Parcial</span>
                </div>
                <div className="flex items-center gap-1.5 text-green-400">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>Completo</span>
                </div>
            </div>
        </div>
    );
}

type Employee = {
    id: number;
    full_name: string;
    unit_id: number;
    category: string | null;
    arrival_date: string | null;
    transferred_arrival_date: string | null;
};

type WorkLog = {
    id: number;
    employee_id: number;
    unit_id: number | null;
    work_date: string;
    entry_time_1: string | null;
    exit_time_1: string | null;
    entry_time_2: string | null;
    exit_time_2: string | null;
    observation: string | null;
    created_at: string;
};

export default function Jornada() {
    const { user } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingReport, setLoadingReport] = useState<string | null>(null);
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [categoryFilter, setCategoryFilter] = useState<"MOD" | "MOI" | "TODOS">("TODOS");
    const [searchTerm, setSearchTerm] = useState("");
    const [localLogs, setLocalLogs] = useState<Record<number, Partial<WorkLog>>>({}); // employeeId -> partial record
    const [lastSelectedDate, setLastSelectedDate] = useState(selectedDate);
    const [bulkRecord, setBulkRecord] = useState<Partial<WorkLog>>({
        entry_time_1: "07:00",
        exit_time_1: "11:00",
        entry_time_2: "12:00",
        exit_time_2: "16:00",
        observation: ""
    });

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchUserUnits = async () => {
        const isSuper = user?.is_super_user;
        let unitIds: number[] = [];
        if (!isSuper && user?.id) {
            const { data: links } = await supabase
                .from("usuarios_unidades")
                .select("unit_id")
                .eq("user_id", user.id);
            unitIds = Array.isArray(links) ? (links as { unit_id: number }[]).map((l) => l.unit_id) : [];
        }
        return { isSuper, unitIds };
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { isSuper: isSuperUser, unitIds } = await fetchUserUnits();

            let empQuery = supabase.from("funcionarios")
                .select("id, full_name, unit_id, arrival_date, transferred_arrival_date, funcoes(type)")
                .eq("is_active", true)
                .order("full_name");

            if (!isSuperUser) {
                if (unitIds.length === 0) {
                    setEmployees([]);
                    setWorkLogs([]);
                    setIsLoading(false);
                    return;
                }
                empQuery = empQuery.in("unit_id", unitIds);
            }

            let logsQuery = supabase.from("registros_trabalho").select("*").order("work_date", { ascending: false });
            if (!isSuperUser) {
                logsQuery = logsQuery.in("unit_id", unitIds);
            }

            const [empRes, logsRes] = await Promise.all([empQuery, logsQuery]);

            if (empRes.error) throw empRes.error;
            if (logsRes.error) throw logsRes.error;

            const formattedEmployees = (empRes.data || []).map((emp: any) => ({
                id: emp.id,
                full_name: emp.full_name,
                unit_id: emp.unit_id,
                category: emp.funcoes?.type || null,
                arrival_date: emp.arrival_date ? emp.arrival_date.split('T')[0] : null,
                transferred_arrival_date: emp.transferred_arrival_date ? emp.transferred_arrival_date.split('T')[0] : null
            }));

            setEmployees(formattedEmployees);
            setWorkLogs(logsRes.data || []);
        } catch (error) {
            console.error("Error fetching data:", error);
            showToast("Erro ao carregar dados.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate day statuses for the month
    const dayStatuses = useMemo(() => {
        const statusMap: Record<string, DayStatus> = {};
        const logsByDate: Record<string, number[]> = {};

        workLogs.forEach((log: WorkLog) => {
            if (!logsByDate[log.work_date]) logsByDate[log.work_date] = [];
            logsByDate[log.work_date].push(log.employee_id);
        });

        Object.entries(logsByDate).forEach(([date, empIds]) => {
            // Conta quantos funcionários deveriam estar na unidade nesta data específica
            const activeEmpsOnDate = employees.filter(emp => {
                const effectiveArrival = emp.transferred_arrival_date || emp.arrival_date;
                return !effectiveArrival || date >= effectiveArrival;
            });

            if (empIds.length >= activeEmpsOnDate.length && activeEmpsOnDate.length > 0) {
                statusMap[date] = "complete";
            } else if (empIds.length > 0) {
                statusMap[date] = "partial";
            }
        });
        return statusMap;
    }, [workLogs, employees]);

    useEffect(() => {
        // Se a data mudou, resetamos tudo para os dados do banco naquela data
        if (selectedDate !== lastSelectedDate) {
            const daily: Record<number, Partial<WorkLog>> = {};
            workLogs.filter(l => l.work_date === selectedDate).forEach(l => {
                daily[l.employee_id] = l;
            });
            setLocalLogs(daily);
            setLastSelectedDate(selectedDate);
            return;
        }

        // Se a data é a mesma mas workLogs mudou (após um save), sincronizamos apenas o registro persistido
        // mantendo o que o usuário digitou nas outras linhas
        setLocalLogs(prev => {
            const next = { ...prev };
            workLogs.filter(l => l.work_date === selectedDate).forEach(l => {
                // Se não temos edição local ou se o id já existia, atualizamos com o dado do banco
                // Isso preserva edições "sujas" de novos registros ou registros existentes
                if (!next[l.employee_id] || next[l.employee_id].id === l.id) {
                    next[l.employee_id] = l;
                }
            });
            return next;
        });
    }, [selectedDate, workLogs]);

    const handleSaveRow = async (employeeId: number, silent: boolean = false) => {
        const log = localLogs[employeeId];
        if (!log) return;

        if (!silent) setLoadingReport(`save-${employeeId}`);
        try {
            const emp = employees.find(e => e.id === employeeId);
            const payload = {
                employee_id: employeeId,
                unit_id: emp?.unit_id || null,
                work_date: selectedDate,
                entry_time_1: log.entry_time_1 || null,
                exit_time_1: log.exit_time_1 || null,
                entry_time_2: log.entry_time_2 || null,
                exit_time_2: log.exit_time_2 || null,
                observation: log.observation || null,
            };

            let savedData: WorkLog | null = null;
            if (log.id) {
                const { data, error } = await supabase.from("registros_trabalho").update(payload).eq("id", log.id).select().single();
                if (error) throw error;
                savedData = data;
            } else {
                const { data, error } = await supabase.from("registros_trabalho").insert(payload).select().single();
                if (error) throw error;
                savedData = data;
            }

            if (savedData) {
                // Atualiza workLogs localmente sem disparar fetchData global
                setWorkLogs(prev => {
                    const idx = prev.findIndex(l => l.id === savedData!.id);
                    if (idx >= 0) {
                        const next = [...prev];
                        next[idx] = savedData!;
                        return next;
                    }
                    return [savedData!, ...prev];
                });
                if (!silent) showToast("Registro salvo!", "success");
            }
        } catch (error) {
            console.error("Error saving log:", error);
            if (!silent) showToast("Erro ao salvar.", "error");
            throw error;
        } finally {
            if (!silent) setLoadingReport(null);
        }
    };

    const handleBulkApply = () => {
        const nextLocal = { ...localLogs };
        filteredEmployees.forEach(emp => {
            nextLocal[emp.id] = {
                ...(nextLocal[emp.id] || {}),
                ...bulkRecord
            };
        });
        setLocalLogs(nextLocal);
        showToast("Horários aplicados aos filtrados!", "success");
    };

    const handleSaveAllVisible = async () => {
        setLoadingReport("save-all");
        try {
            const promises = filteredEmployees.map(emp => handleSaveRow(emp.id, true));
            await Promise.all(promises);
            showToast("Todos os registros filtrados foram salvos!", "success");
        } catch (error) {
            console.error("Error saving all rows:", error);
            showToast("Erro ao salvar alguns registros.", "error");
        } finally {
            setLoadingReport(null);
        }
    };

    const updateLocalLog = (employeeId: number, field: string, value: string) => {
        setLocalLogs(prev => ({
            ...prev,
            [employeeId]: {
                ...(prev[employeeId] || {}),
                [field]: value
            }
        }));
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === "TODOS" || emp.category === categoryFilter;

        // Filtro por data de chegada
        const effectiveArrival = emp.transferred_arrival_date || emp.arrival_date;
        const arrivedBySelectedDate = !effectiveArrival || selectedDate >= effectiveArrival;

        return matchesSearch && matchesCategory && arrivedBySelectedDate;
    });

    return (
        <div className="space-y-6">
            {toast && (
                <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-[9999] ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"}`}>
                    {toast.text}
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Jornada Diária</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Lançamento de horários por colaborador</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50">
                    <Calendar className="w-4 h-4 text-blue-400 ml-2" />
                    <span className="text-slate-200 font-medium px-2">
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Content: Employee List */}
                <div className="lg:col-span-3 space-y-4">

                    <div className="flex flex-wrap items-center gap-4 justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <Users className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Lançamento Rápido</h3>
                                <p className="text-[10px] text-slate-500 font-medium">Preencha e aplique a todos os filtrados</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
                                <div className="flex items-center gap-1">
                                    <input
                                        type="time"
                                        value={bulkRecord.entry_time_1 || ""}
                                        onChange={(e) => setBulkRecord(prev => ({ ...prev, entry_time_1: e.target.value }))}
                                        className="bg-slate-900 border border-slate-700 rounded p-1 text-[10px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    />
                                    <input
                                        type="time"
                                        value={bulkRecord.exit_time_1 || ""}
                                        onChange={(e) => setBulkRecord(prev => ({ ...prev, exit_time_1: e.target.value }))}
                                        className="bg-slate-900 border border-slate-700 rounded p-1 text-[10px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div className="w-[1px] h-4 bg-slate-700 mx-1"></div>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="time"
                                        value={bulkRecord.entry_time_2 || ""}
                                        onChange={(e) => setBulkRecord(prev => ({ ...prev, entry_time_2: e.target.value }))}
                                        className="bg-slate-900 border border-slate-700 rounded p-1 text-[10px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    />
                                    <input
                                        type="time"
                                        value={bulkRecord.exit_time_2 || ""}
                                        onChange={(e) => setBulkRecord(prev => ({ ...prev, exit_time_2: e.target.value }))}
                                        className="bg-slate-900 border border-slate-700 rounded p-1 text-[10px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Obs Geral..."
                                    value={bulkRecord.observation || ""}
                                    onChange={(e) => setBulkRecord(prev => ({ ...prev, observation: e.target.value }))}
                                    className="bg-slate-900 border border-slate-700 rounded p-1 text-[10px] text-slate-200 w-24 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                />
                                <button
                                    onClick={handleBulkApply}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded transition-all flex items-center gap-1.5"
                                >
                                    <CheckSquare className="w-3 h-3" /> Aplicar
                                </button>
                            </div>

                            <button
                                onClick={handleSaveAllVisible}
                                disabled={loadingReport === "save-all" || filteredEmployees.length === 0}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-all shadow-lg shadow-green-500/20 flex items-center gap-2"
                            >
                                {loadingReport === "save-all" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Salvar Atuais ({filteredEmployees.length})
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 justify-between">
                        {/* Search */}
                        <div className="flex-1 min-w-[300px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                placeholder="Buscar colaborador..."
                            />
                        </div>

                        {/* Category Filter */}
                        <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700">
                            {(["MOD", "MOI", "TODOS"] as const).map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${categoryFilter === cat
                                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                                        : "text-slate-400 hover:text-slate-200"
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-slate-700/30">Colaborador</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Entrada 1</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Saída 1</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Entrada 2</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Saída 2</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Observação</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/30">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center">
                                                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                                                <p className="mt-2 text-slate-500 font-medium">Carregando colaboradores...</p>
                                            </td>
                                        </tr>
                                    ) : filteredEmployees.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-slate-500 font-medium">
                                                Nenhum colaborador encontrado nesta categoria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEmployees.map((emp) => {
                                            const log = localLogs[emp.id] || {};
                                            const isSaving = loadingReport === `save-${emp.id}`;

                                            return (
                                                <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors group">
                                                    <td className="p-4 border-r border-slate-700/30 min-w-[200px]">
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-200 font-medium">{emp.full_name}</span>
                                                            <span className={`text-[10px] font-bold uppercase ${emp.category === 'MOD' ? 'text-blue-400' : 'text-purple-400'}`}>
                                                                {emp.category || '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 min-w-[100px]">
                                                        <input
                                                            type="time"
                                                            value={log.entry_time_1?.slice(0, 5) || ""}
                                                            onChange={(e) => updateLocalLog(emp.id, 'entry_time_1', e.target.value)}
                                                            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-1.5 text-center text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                                        />
                                                    </td>
                                                    <td className="p-2 min-w-[100px]">
                                                        <input
                                                            type="time"
                                                            value={log.exit_time_1?.slice(0, 5) || ""}
                                                            onChange={(e) => updateLocalLog(emp.id, 'exit_time_1', e.target.value)}
                                                            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-1.5 text-center text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                                        />
                                                    </td>
                                                    <td className="p-2 min-w-[100px]">
                                                        <input
                                                            type="time"
                                                            value={log.entry_time_2?.slice(0, 5) || ""}
                                                            onChange={(e) => updateLocalLog(emp.id, 'entry_time_2', e.target.value)}
                                                            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-1.5 text-center text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                                        />
                                                    </td>
                                                    <td className="p-2 min-w-[100px]">
                                                        <input
                                                            type="time"
                                                            value={log.exit_time_2?.slice(0, 5) || ""}
                                                            onChange={(e) => updateLocalLog(emp.id, 'exit_time_2', e.target.value)}
                                                            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-1.5 text-center text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                                        />
                                                    </td>
                                                    <td className="p-2 min-w-[200px]">
                                                        <div className="relative group/obs">
                                                            <MessageSquare className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                                            <input
                                                                type="text"
                                                                value={log.observation || ""}
                                                                onChange={(e) => updateLocalLog(emp.id, 'observation', e.target.value)}
                                                                className="w-full pl-8 pr-2 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                                                placeholder="Obs..."
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => handleSaveRow(emp.id)}
                                                            disabled={isSaving}
                                                            className={`p-2 rounded-lg transition-all ${log.id
                                                                ? "bg-slate-800 text-blue-400 hover:bg-blue-500/10 border border-slate-700"
                                                                : "bg-blue-600 text-white hover:bg-blue-500"
                                                                } disabled:opacity-50`}
                                                            title={log.id ? "Atualizar" : "Salvar"}
                                                        >
                                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Calendar */}
                <div className="lg:col-span-1 space-y-6">
                    <WorkDaysCalendar
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        dayStatuses={dayStatuses}
                    />

                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 space-y-4 shadow-xl">
                        <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm uppercase tracking-wider">
                            <Clock className="w-4 h-4 text-blue-400" />
                            Resumo do Dia
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Equipe</p>
                                <p className="text-xl font-bold text-slate-200">{filteredEmployees.length}</p>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Lançados</p>
                                <p className="text-xl font-bold text-blue-400">{Object.keys(localLogs).length}</p>
                            </div>
                        </div>

                        <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Progresso</p>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-500"
                                    style={{ width: `${(Object.keys(localLogs).length / (employees.length || 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AlertModal
                isOpen={!!alertMessage}
                message={alertMessage || ""}
                onClose={() => setAlertMessage(null)}
            />
        </div>
    );
}
