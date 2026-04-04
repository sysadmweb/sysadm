import { useState, useEffect } from "react";
import { createWorker } from "tesseract.js";
import { supabase } from "../supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Search,
  Clock,
  UserCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  ChevronRight,
  ChevronLeft,
  TrendingDown,
  Edit2,
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  FileSearch,
  CheckSquare,
  Square
} from "lucide-react";
import { Employee, Function } from "../../shared/types";
import { useMemo, useState as useReactState } from "react";

// --- Subcomponent: Calendar ---
type DayStatus = "none" | "leaving";

interface CalendarProps {
    selectedDate: string | null;
    onDateSelect: (date: string | null) => void;
    dayStatuses: Record<string, DayStatus>;
}

function DeparturesCalendar({ selectedDate, onDateSelect, dayStatuses }: CalendarProps) {
    const [currentMonth, setCurrentMonth] = useReactState(new Date());

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
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Cronograma</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-slate-200 text-[10px] font-bold min-w-[80px] text-center uppercase">
                        {currentMonth.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                    </span>
                    <button
                        onClick={() => changeMonth(1)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                    <div key={day} className="text-center text-[9px] uppercase font-bold text-slate-500 py-1">
                        {day}
                    </div>
                ))}
                {days.map((day, idx) => {
                    const status = dayStatuses[day.dateStr] || "none";
                    const isSelected = selectedDate === day.dateStr;

                    return (
                        <button
                            key={idx}
                            onClick={() => {
                                if (day.date) {
                                  onDateSelect(selectedDate === day.dateStr ? null : day.dateStr);
                                }
                            }}
                            disabled={!day.date}
                            className={`aspect-square flex items-center justify-center text-[11px] rounded-lg transition-all border
                                ${!day.date ? "invisible" : ""}
                                ${isSelected ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-900 z-10" : ""}
                                ${status === "leaving" ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30" :
                                    "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700"}
                            `}
                        >
                            {day.date?.getDate()}
                        </button>
                    );
                })}
            </div>
            
            {selectedDate && (
                <button 
                  onClick={() => onDateSelect(null)}
                  className="w-full mt-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold rounded-lg border border-slate-700 transition-all uppercase"
                >
                  Limpar Filtro Data
                </button>
            )}
        </div>
    );
}

export default function AvisoPrevio() {
  const { user: currentUser } = useAuth();
  const [employeesOnNotice, setEmployeesOnNotice] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [functions, setFunctions] = useState<Function[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [mainListSearchTerm, setMainListSearchTerm] = useState("");
  const [filterFunctionId, setFilterFunctionId] = useState<string>("all");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [noticePeriodConfigDays, setNoticePeriodConfigDays] = useState(23);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [revisingIdx, setRevisingIdx] = useState<number | null>(null);
  const [revisionSearchTerm, setRevisionSearchTerm] = useState("");
  const [showRevisionResults, setShowRevisionResults] = useState(false);
  const [noticeData, setNoticeData] = useState({
    start_date: new Date().toISOString().split('T')[0],
    type: 'PADRAO'
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, [currentUser]);

  const fetchUserUnits = async () => {
    const isSuper = (currentUser as any)?.is_super_user;
    let unitIds: number[] = [];
    if (!isSuper && (currentUser as any)?.id) {
        if ((currentUser as any).unit_id) {
            unitIds.push((currentUser as any).unit_id);
        }

        const { data: links } = await supabase
            .from("usuarios_unidades")
            .select("unit_id")
            .eq("user_id", (currentUser as any).id);
        if (Array.isArray(links)) {
            links.forEach(l => {
                if (!unitIds.includes(l.unit_id)) unitIds.push(l.unit_id);
            });
        }
    }
    return { isSuper, unitIds };
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const { isSuper, unitIds } = await fetchUserUnits();

      let empQuery = supabase.from("funcionarios")
        .select("*, funcoes(name, type)")
        .eq("is_active", true);

      if (!isSuper) {
        if (unitIds.length === 0) {
          setAllEmployees([]);
          setEmployeesOnNotice([]);
          setIsLoading(false);
          return;
        }
        empQuery = empQuery.in("unit_id", unitIds);
      }

      const [funcsRes, empRes] = await Promise.all([
        supabase.from("funcoes").select("*").eq("is_active", true),
        empQuery
      ]);

      if (funcsRes.data) setFunctions(funcsRes.data);
      if (empRes.data) {
        setAllEmployees(empRes.data);
        const onNotice = empRes.data.filter(e => e.notice_start_date);
        setEmployeesOnNotice(onNotice);
      }

      // Fetch notice period config
      const { data: configData } = await supabase
        .from("config")
        .select("value")
        .eq("key", "notice_period_days")
        .single();
      
      if (configData) {
        setNoticePeriodConfigDays(parseInt(configData.value) || 23);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNotice = async () => {
    if (!selectedEmpId) return;

    const [year, month, day] = noticeData.start_date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    let lastWorkingDay = new Date(startDate);
    
    const days = (noticeData.type === 'PADRAO' ? noticePeriodConfigDays : 30) - 1;
    lastWorkingDay.setDate(startDate.getDate() + days);

    try {
      // If we are editing and the employee was changed, clear the old one first
      if (editingEmpId && selectedEmpId !== editingEmpId) {
        const { error: clearError } = await supabase
          .from("funcionarios")
          .update({
            notice_start_date: null,
            notice_type: null,
            last_working_day: null
          })
          .eq("id", editingEmpId);
        
        if (clearError) throw clearError;
      }

      const { error } = await supabase
        .from("funcionarios")
        .update({
          notice_start_date: noticeData.start_date,
          notice_type: noticeData.type,
          last_working_day: lastWorkingDay.toISOString().split('T')[0]
        })
        .eq("id", selectedEmpId);

      if (error) throw error;

      setShowAddModal(false);
      setSelectedEmpId(null);
      setEditingEmpId(null);
      setSearchTerm("");
      fetchInitialData();
    } catch (error) {
      console.error("Error adding notice:", error);
      alert("Erro ao lançar aviso prévio");
    }
  };

  const handleRemoveNotice = async (id: number) => {
    if (!confirm("Remover este colaborador do controle de aviso?")) return;

    try {
      const { error } = await supabase
        .from("funcionarios")
        .update({
          notice_start_date: null,
          notice_type: null,
          last_working_day: null
        })
        .eq("id", id);

      if (error) throw error;
      setSelectedIds(prev => prev.filter(sid => sid !== id));
      fetchInitialData();
    } catch (error) {
      console.error("Error removing notice:", error);
    }
  };

  const handleBatchRemoveNotice = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Remover os ${selectedIds.length} colaboradores selecionados do controle de aviso?`)) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("funcionarios")
        .update({
          notice_start_date: null,
          notice_type: null,
          last_working_day: null
        })
        .in("id", selectedIds);

      if (error) throw error;
      
      setSelectedIds([]);
      fetchInitialData();
    } catch (error) {
      console.error("Error removing notices in batch:", error);
      alert("Erro ao remover avisos em lote");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(sid => sid !== id) 
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEmployeesOnNotice.length && filteredEmployeesOnNotice.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployeesOnNotice.map(e => e.id));
    }
  };

  const getDaysRemaining = (lastDay: string) => {
    const [year, month, day] = lastDay.split('-').map(Number);
    const end = new Date(year, month - 1, day);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const calculateProgress = (start: string, last: string) => {
    const [sY, sM, sD] = start.split('-').map(Number);
    const [lY, lM, lD] = last.split('-').map(Number);
    const startDate = new Date(sY, sM - 1, sD).getTime();
    const lastDate = new Date(lY, lM - 1, lD).getTime();
    const now = new Date().getTime();
    
    if (now >= lastDate) return 100;
    if (now <= startDate) return 0;
    
    const total = lastDate - startDate;
    const current = now - startDate;
    return Math.round((current / total) * 100);
  };

  const filteredEmployeesOnNotice = useMemo(() => {
    return employeesOnNotice.filter(emp => {
      // Name filter
      const matchesName = emp.full_name.toUpperCase().includes(mainListSearchTerm.toUpperCase());
      
      // Function filter
      const matchesFunction = filterFunctionId === "all" || emp.function_id?.toString() === filterFunctionId;
      
      // Calendar date filter
      let matchesCalendar = true;
      if (selectedCalendarDate && emp.last_working_day) {
        matchesCalendar = emp.last_working_day === selectedCalendarDate;
      }
      
      return matchesName && matchesFunction && matchesCalendar;
    });
  }, [employeesOnNotice, mainListSearchTerm, filterFunctionId, selectedCalendarDate]);

  const filteredRevisionEmployees = useMemo(() => {
    if (revisionSearchTerm.length < 2) return [];
    return allEmployees.filter(emp => 
        emp.full_name.toUpperCase().includes(revisionSearchTerm.toUpperCase())
    ).slice(0, 5);
  }, [allEmployees, revisionSearchTerm]);

  const departureStatuses = useMemo(() => {
    const statuses: Record<string, DayStatus> = {};
    employeesOnNotice.forEach(emp => {
      if (emp.last_working_day) {
        statuses[emp.last_working_day] = "leaving";
      }
    });
    return statuses;
  }, [employeesOnNotice]);

  const filteredEmployees = allEmployees
    .filter(e => !e.notice_start_date && e.full_name.toUpperCase().includes(searchTerm.toUpperCase()))
    .slice(0, 5);

  const openEditModal = (employee: Employee) => {
    setSelectedEmpId(employee.id);
    setEditingEmpId(employee.id);
    setSearchTerm(employee.full_name);
    setNoticeData({
      start_date: employee.notice_start_date || new Date().toISOString().split('T')[0],
      type: employee.notice_type || 'PADRAO'
    });
    setShowSearchResults(false);
    setShowAddModal(true);
  };

  const processBatchImages = async (files: FileList) => {
    setIsProcessingBatch(true);
    setBatchResults([]);
    try {
        const worker = await createWorker('por'); // Portuguese

        const results = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const { data: { text } } = await worker.recognize(file);
                
                const nameMatch = text.match(/Sr\(a\):\s*([A-ZÀ-Ú\s]+)/i);
                const dateMatch = text.match(/a partir de\s*(\d{2}\/\d{2}\/\d{4})/i);
                
                let extractedName = nameMatch ? nameMatch[1].trim().split('\n')[0] : "";
                let extractedDate = dateMatch ? dateMatch[1] : "";
                
                let formattedDate = "";
                if (extractedDate) {
                    const [d, m, y] = extractedDate.split('/');
                    formattedDate = `${y}-${m}-${d}`;
                }

                // Find match in system
                const systemMatch = allEmployees.find(e => 
                    e.full_name.toUpperCase().includes(extractedName.toUpperCase()) ||
                    extractedName.toUpperCase().includes(e.full_name.toUpperCase())
                );

                const isDuplicate = systemMatch && systemMatch.notice_start_date === formattedDate;
                const isReady = systemMatch && formattedDate !== "" && !isDuplicate;

                results.push({
                    fileName: file.name,
                    extractedName,
                    extractedDate: formattedDate,
                    systemMatch,
                    status: isDuplicate ? 'DUPLICATE' : (isReady ? 'READY' : 'REVISAR')
                });
            } catch (err) {
                console.error("Error processing file", file.name, err);
                results.push({ fileName: file.name, status: 'ERROR', error: 'Erro ao ler imagem' });
            }
        }

        await worker.terminate();
        setBatchResults(results);
    } catch (error: any) {
        console.error("OCR Error:", error);
        alert(`Erro ao inicializar processamento: ${error.message || 'Verifique sua conexão'}`);
    } finally {
        setIsProcessingBatch(false);
    }
  };

  const updateBatchItem = (index: number, updates: any) => {
    setBatchResults(prev => {
      const newResults = [...prev];
      const item = { ...newResults[index], ...updates };
      
      // Re-calculate status
      const isDuplicate = item.systemMatch && item.systemMatch.notice_start_date === item.extractedDate;
      const isReady = item.systemMatch && item.extractedDate !== "" && !isDuplicate;
      
      item.status = isDuplicate ? 'DUPLICATE' : (isReady ? 'READY' : 'REVISAR');
      newResults[index] = item;
      return newResults;
    });
  };

  const launchBatch = async () => {
    setIsProcessingBatch(true);
    const readyResults = batchResults.filter(r => r.status === 'READY' && r.systemMatch && r.extractedDate !== "");
    
    if (readyResults.length === 0) {
        setIsProcessingBatch(false);
        return;
    }

    try {
        const batchPromises = readyResults.map(res => {
            const [year, month, day] = res.extractedDate.split('-').map(Number);
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                throw new Error(`Data inválida para ${res.systemMatch.full_name}`);
            }

            const startDate = new Date(year, month - 1, day);
            let lastWorkingDay = new Date(startDate);
            const days = noticePeriodConfigDays - 1;
            lastWorkingDay.setDate(startDate.getDate() + days);

            return supabase
                .from("funcionarios")
                .update({
                    notice_start_date: res.extractedDate,
                    notice_type: 'PADRAO',
                    last_working_day: lastWorkingDay.toISOString().split('T')[0],
                    is_active: true
                })
                .eq("id", res.systemMatch.id);
        });

        const responses = await Promise.all(batchPromises);
        const firstError = responses.find(r => r.error);
        if (firstError) throw firstError.error;
        
        setIsProcessingBatch(false);
        setShowBatchModal(false);
        setBatchResults([]);
        fetchInitialData();
    } catch (error: any) {
        console.error("Error launching batch:", error);
        alert(`Erro ao lançar avisos em lote: ${error.message || 'Erro desconhecido'}`);
        setIsProcessingBatch(false);
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-400" />
            Gestão de Aviso Prévio
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Acompanhamento {filteredEmployeesOnNotice.length} desligamentos próximos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all border border-slate-700"
          >
            <Upload className="w-5 h-5" />
            Importar em Lote
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-5 h-5" />
            Lançar Novo Aviso
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-700/50 shadow-xl">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total em Aviso</p>
              <h3 className="text-3xl font-black text-white">{filteredEmployeesOnNotice.length}</h3>
              <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {filteredEmployeesOnNotice.filter(e => getDaysRemaining(e.last_working_day!) <= 7).length} saindo em 7 dias
              </p>
            </div>
            
            <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-700/50 shadow-xl">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">FUNÇÃO</p>
              <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {functions.filter(f => filteredEmployeesOnNotice.some(e => e.function_id === f.id)).map(f => (
                      <div key={f.id} className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">{f.name}</span>
                          <span className="text-slate-200 font-bold bg-slate-800 px-1.5 rounded ml-4">{filteredEmployeesOnNotice.filter(e => e.function_id === f.id).length}</span>
                      </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4 gap-4 items-center justify-between shadow-xl">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                      type="text"
                      placeholder="Buscar por nome..."
                      value={mainListSearchTerm}
                      onChange={(e) => setMainListSearchTerm(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
              </div>

              <select 
                  value={filterFunctionId}
                  onChange={(e) => setFilterFunctionId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                  <option value="all">Todas as Funções</option>
                  {functions
                    .filter(f => employeesOnNotice.some(e => e.function_id === f.id))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(f => <option key={f.id} value={f.id.toString()}>{f.name}</option>)
                  }
              </select>
            </div>

            <div className="flex items-center gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-800 w-full lg:w-auto justify-between lg:justify-end">
              <button 
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all border border-slate-700 text-sm font-medium"
              >
                {selectedIds.length === filteredEmployeesOnNotice.length && filteredEmployeesOnNotice.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                {selectedIds.length === filteredEmployeesOnNotice.length && filteredEmployeesOnNotice.length > 0 ? 'Desmarcar' : 'Selecionar'}
              </button>
              {selectedIds.length > 0 && (
                <button 
                  onClick={handleBatchRemoveNotice}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/20 text-sm font-bold shadow-lg shadow-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover ({selectedIds.length})
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployeesOnNotice.length > 0 ? (
              filteredEmployeesOnNotice.map((employee) => {
            const daysLeft = getDaysRemaining(employee.last_working_day!);
            const progress = calculateProgress(employee.notice_start_date!, employee.last_working_day!);
            
            return (
              <div 
                key={employee.id} 
                className={`bg-slate-900/50 backdrop-blur-xl rounded-2xl border ${selectedIds.includes(employee.id) ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-700/50'} p-6 shadow-xl group hover:border-slate-600 transition-all relative`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleSelect(employee.id)}
                      className="shrink-0 transition-transform active:scale-90"
                    >
                      {selectedIds.includes(employee.id) ? (
                        <CheckSquare className="w-6 h-6 text-blue-400" />
                      ) : (
                        <Square className="w-6 h-6 text-slate-600 group-hover:text-slate-400" />
                      )}
                    </button>
                    <div className="p-3 bg-slate-800 rounded-xl group-hover:bg-slate-700 transition-colors">
                      <UserCircle className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-slate-100 font-bold text-lg">{employee.full_name}</h3>
                      <p className="text-xs text-slate-400">
                        {functions.find(f => f.id === employee.function_id)?.name || "Função não definida"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => openEditModal(employee)}
                      className="p-2 text-slate-500 hover:text-blue-400 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleRemoveNotice(employee.id)}
                      className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1">
                      <TrendingDown className="w-4 h-4" />
                      Progresso
                    </span>
                    <span className={`font-mono font-bold ${daysLeft <= 5 ? 'text-red-400' : 'text-amber-400'}`}>
                      {daysLeft > 0 ? `${daysLeft} dias restantes` : 'Finalizado'}
                    </span>
                  </div>
                  
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${daysLeft <= 5 ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Início</p>
                      <p className="text-slate-200 text-sm font-medium">
                        {employee.notice_start_date!.split('-').reverse().join('/')}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl border ${daysLeft <= 5 ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-800/50 border-slate-700/50'}`}>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Último Dia</p>
                      <p className={`text-sm font-bold ${daysLeft <= 5 ? 'text-red-400' : 'text-slate-200'}`}>
                        {employee.last_working_day!.split('-').reverse().join('/')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
              <div className="col-span-full py-20 text-center bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-800">
                <p className="text-slate-500 font-medium">Nenhum colaborador em aviso prévio encontrado com estes filtros.</p>
                <button 
                  onClick={() => {
                    setMainListSearchTerm("");
                    setFilterFunctionId("all");
                    setSelectedCalendarDate(null);
                  }}
                  className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-bold"
                >
                  Limpar todos os filtros
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Calendar */}
        <div className="lg:col-span-1 space-y-6">
          <DeparturesCalendar
            selectedDate={selectedCalendarDate}
            onDateSelect={setSelectedCalendarDate}
            dayStatuses={departureStatuses}
          />
        </div>
      </div>

      {/* Modal Lançar Aviso */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden scale-in">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                {editingEmpId ? "Editar Aviso Prévio" : "Lançar Aviso Prévio"}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Buscar Colaborador</label>
                <div className="relative">
                  <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar colaborador..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowSearchResults(true);
                      setSelectedEmpId(null);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-10 pr-10 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  {selectedEmpId && (
                    <button
                      onClick={() => {
                        setSelectedEmpId(null);
                        setSearchTerm("");
                        setShowSearchResults(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500 hover:text-amber-400 uppercase"
                    >
                      Trocar
                    </button>
                  )}
                  
                  {showSearchResults && searchTerm.length >= 2 && filteredEmployees.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                      {filteredEmployees.map(emp => (
                        <button
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmpId(emp.id);
                            setSearchTerm(emp.full_name);
                            setShowSearchResults(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700 transition-colors ${selectedEmpId === emp.id ? 'bg-amber-500/10 text-amber-400' : 'text-slate-300'}`}
                        >
                          <span className="font-medium">{emp.full_name}</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Data de Início</label>
                  <input
                    type="date"
                    value={noticeData.start_date}
                    onChange={(e) => setNoticeData({...noticeData, start_date: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Modalidade</label>
                  <select
                    value={noticeData.type}
                    onChange={(e) => setNoticeData({...noticeData, type: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="PADRAO">{noticePeriodConfigDays} Dias (Configuração)</option>
                    <option value="TRABALHADO_30">30 Dias</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-800/50 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedEmpId(null);
                  setEditingEmpId(null);
                  setSearchTerm("");
                  setShowSearchResults(false);
                }}
                className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddNotice}
                disabled={!selectedEmpId}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingEmpId ? "Salvar Alterações" : "Lançar Aviso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                <FileText className="w-7 h-7 text-blue-400" />
                Importação em Lote via OCR
              </h2>
              <button 
                onClick={() => {
                    if (!isProcessingBatch) setShowBatchModal(false);
                }}
                className="p-2 text-slate-500 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              {!isProcessingBatch && batchResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-800/20 hover:bg-slate-800/40 transition-all group cursor-pointer relative">
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*"
                    onChange={(e) => e.target.files && processBatchImages(e.target.files)}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="p-5 bg-blue-500/10 rounded-full mb-4 border border-blue-500/20 group-hover:scale-110 transition-transform">
                    <Upload className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-200">Arraste as imagens aqui</h3>
                  <p className="text-slate-500 mt-2">Selecione um ou mais arquivos de aviso prévio (JPEG, PNG)</p>
                </div>
              )}

              {isProcessingBatch && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-lg text-slate-300 font-medium animate-pulse">Escanerizando documentos e identificando colaboradores...</p>
                  <p className="text-sm text-slate-500 mt-2">Isso pode levar alguns segundos dependendo da quantidade de arquivos.</p>
                </div>
              )}

              {batchResults.length > 0 && !isProcessingBatch && (
                <div className="space-y-6">
                  <div className="max-h-[400px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
                    <table className="w-full text-left">
                      <thead className="bg-slate-900 sticky top-0">
                        <tr>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Documento</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Extraído</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Match Sistema</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {batchResults.map((res, idx) => (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 text-sm text-slate-400">{res.fileName}</td>
                            <td className="p-4">
                                <p className="text-sm font-bold text-slate-200">{res.extractedName || "Não identificado"}</p>
                            </td>
                            <td className="p-4">
                                {res.systemMatch ? (
                                    <div className="flex flex-col">
                                        <span className="text-sm text-blue-400 font-semibold">{res.systemMatch.full_name}</span>
                                        <span className="text-[10px] text-slate-500 uppercase">{functions.find(f => f.id === res.systemMatch.function_id)?.name}</span>
                                    </div>
                                ) : (
                                    <span className="text-xs text-red-500 italic flex items-center gap-1">
                                        <FileSearch className="w-3 h-3" />
                                        Pendente (Não encontrado)
                                    </span>
                                )}
                            </td>
                            <td className="p-4">
                                <span className="text-sm text-slate-300 font-mono">
                                    {res.extractedDate ? res.extractedDate.split('-').reverse().join('/') : "Data não lida"}
                                </span>
                            </td>
                            <td className="p-4">
                                <button
                                    onClick={() => {
                                        setRevisingIdx(idx);
                                        setRevisionSearchTerm(res.systemMatch?.full_name || "");
                                    }}
                                    className="hover:scale-105 transition-transform"
                                >
                                    {res.status === 'READY' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold rounded-lg border border-green-500/20">
                                            <CheckCircle2 className="w-3 h-3" />
                                            PRONTO
                                        </span>
                                    ) : res.status === 'DUPLICATE' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded-lg border border-blue-500/20">
                                            <Clock className="w-3 h-3" />
                                            JÁ LANÇADO
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded-lg border border-amber-500/20 cursor-pointer animate-pulse hover:animate-none">
                                            <AlertCircle className="w-3 h-3" />
                                            REVISAR
                                        </span>
                                    )}
                                </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                    <p className="text-sm text-slate-400">
                        Prontos para Lançamento: <span className="text-green-400 font-bold">{batchResults.filter(r => r.status === 'READY').length}</span> | Já Lançados: <span className="text-blue-400 font-bold">{batchResults.filter(r => r.status === 'DUPLICATE').length}</span>
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setBatchResults([])}
                            className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium"
                        >
                            Limpar Tudo
                        </button>
                        <button 
                            disabled={batchResults.filter(r => r.status === 'READY').length === 0}
                            onClick={launchBatch}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Lançar Novos ({batchResults.filter(r => r.status === 'READY').length})
                        </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {revisingIdx !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-amber-500" />
                    Revisar Registro
                </h3>
                <button onClick={() => setRevisingIdx(null)} className="text-slate-500 hover:text-white">
                    <XCircle className="w-5 h-5" />
                </button>
            </div>
            
            <div className="p-6 space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Colaborador</label>
                    <div className="relative">
                        <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                            type="text"
                            value={revisionSearchTerm}
                            onChange={(e) => {
                                setRevisionSearchTerm(e.target.value);
                                setShowRevisionResults(true);
                            }}
                            placeholder="Buscar nome do colaborador..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                        {showRevisionResults && filteredRevisionEmployees.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-10 max-h-40 overflow-y-auto">
                                {filteredRevisionEmployees.map(emp => (
                                    <button
                                        key={emp.id}
                                        onClick={() => {
                                            updateBatchItem(revisingIdx, { systemMatch: emp });
                                            setRevisionSearchTerm(emp.full_name);
                                            setShowRevisionResults(false);
                                        }}
                                        className="w-full text-left p-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                                    >
                                        <p className="text-xs font-bold text-slate-200">{emp.full_name}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">{functions.find(f => f.id === emp.function_id)?.name}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data do Aviso</label>
                    <input 
                        type="date"
                        value={batchResults[revisingIdx]?.extractedDate || ""}
                        onChange={(e) => updateBatchItem(revisingIdx, { extractedDate: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                </div>

                <div className="pt-2">
                    <button 
                        onClick={() => setRevisingIdx(null)}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20"
                    >
                        Confirmar Ajustes
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
