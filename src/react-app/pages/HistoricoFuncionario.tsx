import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { 
    Search, 
    UserPlus, 
    Building2, 
    ClipboardCheck, 
    ArrowRightLeft, 
    Calendar, 
    Clock, 
    Loader2,
    User,
    ChevronRight,
    History
} from "lucide-react";

interface Employee {
    id: number;
    full_name: string;
    created_at: string;
    arrival_date: string | null;
    integration_date: string | null;
    unit_id: number | null;
}

interface Unit {
    id: number;
    name: string;
}

interface Transfer {
    id: number;
    data_saida: string | null;
    data_chegada: string | null;
    unidade_atual_id: number | null;
    unidade_destino_id: number | null;
}

interface TimelineEvent {
    id: string;
    date: string;
    type: 'registration' | 'arrival' | 'integration' | 'transfer';
    title: string;
    description: string;
    unitName?: string;
    fromUnit?: string;
    toUnit?: string;
    icon: any;
    color: string;
}

export default function HistoricoFuncionario() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
    const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(true);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsSearching(true);
        try {
            const [empRes, unitRes] = await Promise.all([
                supabase.from("funcionarios").select("id, full_name, created_at, arrival_date, integration_date, unit_id").order("full_name"),
                supabase.from("unidades").select("id, name")
            ]);

            if (empRes.error) throw empRes.error;
            if (unitRes.error) throw unitRes.error;

            setEmployees(empRes.data || []);
            setUnits(unitRes.data || []);
        } catch (error) {
            console.error("Error fetching initial data:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const fetchEmployeeHistory = async (empId: number) => {
        setIsLoading(true);
        try {
            const employee = employees.find(e => e.id === empId);
            if (!employee) return;

            const { data: transfers, error: transError } = await supabase
                .from("funcionario_transferencia")
                .select("*")
                .eq("funcionario_id", empId)
                .order("data_saida", { ascending: true });

            if (transError) throw transError;

            const events: TimelineEvent[] = [];
            const unitMap = new Map(units.map(u => [u.id, u.name]));

            // 1. Registration
            if (employee.created_at) {
                events.push({
                    id: `reg-${employee.id}`,
                    date: employee.created_at,
                    type: 'registration',
                    title: 'Cadastro no Sistema',
                    description: 'O colaborador foi registrado no sistema.',
                    icon: UserPlus,
                    color: 'text-blue-400'
                });
            }

            // 2. Integration
            if (employee.integration_date) {
                events.push({
                    id: `int-${employee.id}`,
                    date: employee.integration_date,
                    type: 'integration',
                    title: 'Integração Realizada',
                    description: 'A integração do colaborador foi concluída.',
                    icon: ClipboardCheck,
                    color: 'text-emerald-400'
                });
            }

            // 3. Initial Arrival (if no transfers, or first arrival)
            // This is tricky because arrival_date in Table is "current arrival".
            // Historical arrivals usually come from transfers.
            
            // 4. Transfers
            (transfers || []).forEach((t: Transfer) => {
                if (t.data_saida) {
                    events.push({
                        id: `trans-out-${t.id}`,
                        date: t.data_saida,
                        type: 'transfer',
                        title: 'Transferência Iniciada',
                        description: `Saída da unidade ${unitMap.get(t.unidade_atual_id!) || 'Desconhecida'} para ${unitMap.get(t.unidade_destino_id!) || 'Desconhecida'}.`,
                        fromUnit: unitMap.get(t.unidade_atual_id!),
                        toUnit: unitMap.get(t.unidade_destino_id!),
                        icon: ArrowRightLeft,
                        color: 'text-amber-400'
                    });
                }
                if (t.data_chegada) {
                    events.push({
                        id: `trans-in-${t.id}`,
                        date: t.data_chegada,
                        type: 'arrival',
                        title: 'Chegada em Nova Unidade',
                        description: `Chegada confirmada na unidade ${unitMap.get(t.unidade_destino_id!) || 'Desconhecida'}.`,
                        unitName: unitMap.get(t.unidade_destino_id!),
                        icon: Building2,
                        color: 'text-blue-400'
                    });
                }
            });

            // 5. Current Arrival (if not already covered by transfers)
            // If the latest event is NOT an arrival at the current unit, we add it.
            // But usually the most recent arrival_date on employee is useful.
            if (employee.arrival_date) {
                const latestEvent = events.length > 0 ? events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null;
                const arrivalDateString = new Date(employee.arrival_date).toISOString();
                
                if (!latestEvent || latestEvent.date !== arrivalDateString) {
                  events.push({
                      id: `curr-arr-${employee.id}`,
                      date: employee.arrival_date,
                      type: 'arrival',
                      title: 'Chegada na Unidade Atual',
                      description: `Colaborador chegou na unidade ${unitMap.get(employee.unit_id!) || 'Desconhecida'}.`,
                      unitName: unitMap.get(employee.unit_id!),
                      icon: Building2,
                      color: 'text-blue-400'
                  });
                }
            }

            // Sort all events by date
            const sortedEvents = events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setTimelineEvents(sortedEvents);
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectEmployee = (empId: number) => {
        setSelectedEmployeeId(empId);
        fetchEmployeeHistory(empId);
        setSearchTerm("");
    };

    const filteredEmployees = searchTerm.length >= 2 
        ? employees.filter(e => e.full_name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10)
        : [];

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100 flex items-center gap-3">
                        <History className="w-8 h-8 text-blue-400" />
                        Histórico de Funcionário
                    </h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Linha do tempo de eventos do colaborador</p>
                </div>
            </div>

            {/* Search Section */}
            <div className="relative">
                <div className="flex items-center gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700 shadow-lg">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none text-slate-200 placeholder-slate-500 focus:outline-none w-full text-lg"
                        placeholder="Pesquisar colaborador para ver o histórico..."
                    />
                </div>

                {/* Search Results Dropdown */}
                {filteredEmployees.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {filteredEmployees.map((emp) => (
                            <button
                                key={emp.id}
                                onClick={() => handleSelectEmployee(emp.id)}
                                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-0"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/10">
                                        <User className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <span className="text-slate-200 font-medium">{emp.full_name}</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="min-h-[400px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                        <p className="text-slate-400 animate-pulse">Carregando linha do tempo...</p>
                    </div>
                ) : selectedEmployeeId ? (
                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-xl">
                        <div className="mb-8 flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                            <div className="p-3 bg-blue-500/10 rounded-xl">
                                <User className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-100 italic">
                                    {employees.find(e => e.id === selectedEmployeeId)?.full_name}
                                </h2>
                                <p className="text-sm text-slate-400">Linha do Tempo Completa</p>
                            </div>
                        </div>

                        {timelineEvents.length > 0 ? (
                            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-500/20 before:via-blue-500/50 before:to-transparent">
                                {timelineEvents.map((event, index) => (
                                    <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                        {/* Icon Container */}
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-700 bg-slate-900 text-slate-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 transition-transform group-hover:scale-110">
                                            <event.icon className={`w-5 h-5 ${event.color}`} />
                                        </div>

                                        {/* Card */}
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 shadow-sm transition-all hover:bg-slate-800/60 hover:border-slate-600">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-bold text-slate-200">{event.title}</h3>
                                                <time className="text-xs font-mono text-slate-500 bg-slate-900/50 px-2 py-1 rounded">
                                                    {new Date(event.date).toLocaleDateString("pt-BR")}
                                                </time>
                                            </div>
                                            <p className="text-sm text-slate-400">{event.description}</p>
                                            
                                            {event.type === 'transfer' && (
                                              <div className="mt-3 flex items-center gap-2 text-xs bg-slate-900/30 p-2 rounded-lg border border-slate-700/30">
                                                <span className="text-slate-500 italic">{event.fromUnit}</span>
                                                <ChevronRight className="w-3 h-3 text-slate-600" />
                                                <span className="text-blue-400 font-bold uppercase">{event.toUnit}</span>
                                              </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <History className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                <p className="text-slate-500">Nenhum evento histórico encontrado para este colaborador.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 gap-6 bg-slate-900/30 rounded-2xl border border-dashed border-slate-700 transition-all">
                        <div className="p-4 bg-slate-800/50 rounded-full ring-8 ring-slate-800/20">
                            <Search className="w-10 h-10 text-slate-600" />
                        </div>
                        <div className="text-center">
                            <p className="text-slate-400 text-lg font-medium">Nenhum colaborador selecionado</p>
                            <p className="text-slate-500 text-sm mt-1">Utilize a barra de pesquisa acima para começar</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
