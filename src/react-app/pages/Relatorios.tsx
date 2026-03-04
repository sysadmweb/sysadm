import { useState, useEffect, useRef } from "react";
import { supabase } from "@/react-app/supabase";
import { Employee, Unit, Accommodation, Function } from "@/shared/types";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { FileDown, Loader2, Utensils, Clock, Users, X, Coffee, Sun, Moon, UserCircle, Image } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

type WorkLog = {
    id: number;
    employee_id: number;
    work_date: string;
    entry_time_1: string | null;
    exit_time_1: string | null;
    entry_time_2: string | null;
    exit_time_2: string | null;
    observation: string | null;
    created_at: string;
};

type Adicional = {
    id: number;
    nome: string;
    quantidade_marmita: number;
    ativo: boolean;
};

export default function Relatorios() {
    const { user: currentUser } = useAuth();
    const [loadingReport, setLoadingReport] = useState<string | null>(null);
    const [selectedReport, setSelectedReport] = useState<string | null>(null);
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

    // State for JPEG generation
    const [previewData, setPreviewData] = useState<any>(null);
    const [previewType, setPreviewType] = useState<string | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    // State for report date
    const [reportDate, setReportDate] = useState<string>("");
    // Include all statuses for meal reports
    const [includeAllStatuses, setIncludeAllStatuses] = useState<boolean>(false);

    // Supplier control (for Café da Manhã)
    const [controlSuppliers, setControlSuppliers] = useState(false);
    const [marmitaSuppliers, setMarmitaSuppliers] = useState<{ id: number; name: string }[]>([]);
    const [cafeSuppliers, setCafeSuppliers] = useState<{ id: number; name: string }[]>([]);
    const [selectedCafeSupplier, setSelectedCafeSupplier] = useState<number | null>(null);
    const [selectedMarmitaSupplier, setSelectedMarmitaSupplier] = useState<number | null>(null);

    // Initial state for employee report filters and sort
    const [employeeFilterType, setEmployeeFilterType] = useState<"todos" | "moi" | "mod">("todos");
    const [employeeSort, setEmployeeSort] = useState<"name" | "function">("name");



    // ... (skipping unchanged code: PDF generators, etc) ...



    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    // Load config and suppliers once
    useEffect(() => {
        (async () => {
            const { data: configs } = await supabase.from("config").select("key, value");
            if (!configs) return;

            const enabled = configs.find(c => c.key === "control_suppliers")?.value === "true";
            const mealCatId = configs.find(c => c.key === "supplier_category_refeicao")?.value;
            const cafeCatId = configs.find(c => c.key === "supplier_category_cafe")?.value;

            setControlSuppliers(enabled);

            if (enabled) {
                // Fetch Meal Suppliers
                if (mealCatId) {
                    const { data: mSups } = await supabase
                        .from("fornecedores")
                        .select("id, name")
                        .eq("category_id", Number(mealCatId))
                        .eq("is_active", true)
                        .order("name");
                    if (mSups) setMarmitaSuppliers(mSups);
                }

                // Fetch Cafe Suppliers
                if (cafeCatId) {
                    const { data: cSups } = await supabase
                        .from("fornecedores")
                        .select("id, name")
                        .eq("category_id", Number(cafeCatId))
                        .eq("is_active", true)
                        .order("name");
                    if (cSups) setCafeSuppliers(cSups);
                }
            }
        })();
    }, []);

    const fetchUserUnits = async () => {
        const isSuper = currentUser?.is_super_user;
        let unitIds: number[] = [];
        if (!isSuper && currentUser?.id) {
            // First, include the unit_id from the user profile if it exists
            if (currentUser.unit_id) {
                unitIds.push(currentUser.unit_id);
            }

            // Then, fetch additional units linked in the join table
            const { data: links } = await supabase
                .from("usuarios_unidades")
                .select("unit_id")
                .eq("user_id", currentUser.id);
            if (Array.isArray(links)) {
                links.forEach(l => {
                    if (!unitIds.includes(l.unit_id)) unitIds.push(l.unit_id);
                });
            }
        }
        return { isSuper, unitIds };
    };

    const getSystemLogo = async (): Promise<string | null> => {
        try {
            // First try to get from config
            const { data } = await supabase
                .from("config")
                .select("value")
                .eq("key", "system_logo")
                .single();

            if (data?.value) {
                return data.value;
            }

            // Fallback to default file
            const response = await fetch("/logo.png");
            const blob = await response.blob();
            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Error loading logo:", error);
            return null;
        }
    };

    // --- Data Fetchers ---

    const fetchJornadaData = async () => {
        const { isSuper, unitIds } = await fetchUserUnits();
        const [empRes, logsRes, unitsRes] = await Promise.all([
            supabase.from("funcionarios").select("id, full_name, unit_id").eq("is_active", true).order("full_name"),
            supabase.from("registros_trabalho").select("*").order("work_date", { ascending: false }),
            supabase.from("unidades").select("id, name").eq("is_active", true)
        ]);

        if (empRes.error) throw empRes.error;
        if (logsRes.error) throw logsRes.error;
        if (unitsRes.error) throw unitsRes.error;

        let employees = empRes.data as Employee[] || [];
        let workLogs = logsRes.data as WorkLog[] || [];
        let units = unitsRes.data as Unit[] || [];

        if (!isSuper && unitIds.length > 0) {
            employees = employees.filter(e => unitIds.includes(e.unit_id));
            const empIds = employees.map(e => e.id);
            workLogs = workLogs.filter(l => empIds.includes(l.employee_id));
        } else if (!isSuper && unitIds.length === 0) {
            employees = [];
            workLogs = [];
        }

        return { employees, workLogs, units };
    };

    const fetchEmployeesData = async () => {
        const { isSuper, unitIds } = await fetchUserUnits();

        // Fetch specific statuses
        const [aguardandoRes, trabalhandoRes] = await Promise.all([
            supabase.from("status").select("id").eq("name", "AGUARDANDO INTEGRAÇÃO").single(),
            supabase.from("status").select("id").eq("name", "TRABALHANDO DISPONIVEL").single()
        ]);

        const aguardandoId = aguardandoRes.data?.id;
        const trabalhandoId = trabalhandoRes.data?.id;
        const statusIds = [aguardandoId, trabalhandoId].filter(Boolean);

        const [empRes, unitsRes, funcsRes] = await Promise.all([
            supabase.from("funcionarios")
                .select("*")
                .eq("is_active", true)
                .in("status_id", statusIds),
            supabase.from("unidades").select("*").eq("is_active", true),
            supabase.from("funcoes").select("*").eq("is_active", true)
        ]);

        if (empRes.error) throw empRes.error;
        if (unitsRes.error) throw unitsRes.error;
        if (funcsRes.error) throw funcsRes.error;

        let employees = empRes.data as Employee[] || [];
        let units = unitsRes.data as Unit[] || [];
        let functions = funcsRes.data as Function[] || [];

        if (!isSuper && unitIds.length > 0) {
            employees = employees.filter(e => unitIds.includes(e.unit_id));
        } else if (!isSuper && unitIds.length === 0) {
            employees = [];
        }

        // Apply Function Type Filters
        if (employeeFilterType !== "todos") {
            employees = employees.filter(emp => {
                const func = functions.find(f => f.id === emp.function_id);
                if (!func) return false;
                if (employeeFilterType === "moi" && func.type === 'MOI') return true;
                if (employeeFilterType === "mod" && func.type === 'MOD') return true;
                return false;
            });
        }

        // We don't filter by arrival/departure date anymore based on the new requirement, 
        // as we are filtering by specific statuses.
        // const activeEmployees = employees.filter(e => e.arrival_date && !e.departure_date);

        return { employees, units, functions };
    };

    const fetchMarmitasData = async (includeAllStatuses: boolean = false) => {
        const { isSuper, unitIds } = await fetchUserUnits();

        const [alojRes, aguardandoRes, trabalhandoRes] = await Promise.all([
            supabase.from("status").select("id").eq("name", "ALOJAMENTO").single(),
            supabase.from("status").select("id").eq("name", "AGUARDANDO INTEGRAÇÃO").single(),
            supabase.from("status").select("id").eq("name", "TRABALHANDO DISPONIVEL").single()
        ]);

        if (alojRes.error) throw new Error("Status 'ALOJAMENTO' not found");

        const alojId = alojRes.data.id;
        const aguardandoId = aguardandoRes.data?.id;
        const trabalhandoId = trabalhandoRes.data?.id;

        let employeeQuery;

        if (includeAllStatuses) {
            const statusIds = [aguardandoId, trabalhandoId].filter(Boolean);
            employeeQuery = supabase.from("funcionarios")
                .select("id, full_name, arrival_date, departure_date, integration_date, unit_id, accommodation_id, status_id, function_id, tamanho_marmita, is_active, created_at, updated_at")
                .eq("is_active", true)
                .not("accommodation_id", "is", null)
                .in("status_id", statusIds);
        } else {
            employeeQuery = supabase.from("funcionarios")
                .select("id, full_name, arrival_date, departure_date, integration_date, unit_id, accommodation_id, status_id, function_id, tamanho_marmita, is_active, created_at, updated_at")
                .eq("is_active", true)
                .not("accommodation_id", "is", null)
                .or(`refeicao_status_id.eq.${alojId}${aguardandoId ? `,status_id.eq.${aguardandoId}` : ''}`);
        }

        const [accRes, empRes, adsRes] = await Promise.all([
            supabase.from("alojamentos").select("*").eq("is_active", true),
            employeeQuery,
            supabase.from("adicionais").select("*").eq("ativo", true).order("nome")
        ]);

        if (accRes.error) throw accRes.error;
        if (empRes.error) throw empRes.error;
        if (adsRes.error) throw adsRes.error;

        let accommodations = accRes.data as Accommodation[] || [];
        const employees = empRes.data as Employee[] || [];
        const adicionais = adsRes.data as Adicional[] || [];

        if (!isSuper && unitIds.length > 0) {
            accommodations = accommodations.filter(a => unitIds.includes(a.unit_id));
        } else if (!isSuper && unitIds.length === 0) {
            accommodations = [];
        }

        const employeeCounts: Record<number, number> = {};
        const sizeCounts: Record<number, { P: number, M: number, G: number }> = {};

        employees.forEach(emp => {
            if (emp.accommodation_id) {
                employeeCounts[emp.accommodation_id] = (employeeCounts[emp.accommodation_id] || 0) + 1;

                if (!sizeCounts[emp.accommodation_id]) {
                    sizeCounts[emp.accommodation_id] = { P: 0, M: 0, G: 0 };
                }
                const size = emp.tamanho_marmita as "P" | "M" | "G" | null;
                if (size && ["P", "M", "G"].includes(size)) {
                    sizeCounts[emp.accommodation_id][size]++;
                }
            }
        });

        const accommodationsWithEmployees = accommodations.filter(acc => (employeeCounts[acc.id] || 0) > 0);

        // Filter by supplier if selected
        let finalAccommodations = accommodationsWithEmployees;
        if (selectedMarmitaSupplier) {
            const { data: pivotRows } = await supabase
                .from("alojamentos_fornecedores")
                .select("alojamento_id")
                .eq("fornecedor_id", selectedMarmitaSupplier);
            const allowedIds = new Set((pivotRows || []).map((r: any) => r.alojamento_id));
            finalAccommodations = accommodationsWithEmployees.filter(a => allowedIds.has(a.id));
        }

        return { accommodations: finalAccommodations, employeeCounts, sizeCounts, adicionais };
    };

    const fetchCafeDaManhaData = async (includeAllStatuses: boolean = false) => {
        const { isSuper, unitIds } = await fetchUserUnits();

        // Fetch status IDs
        const [alojRes, aguardandoRes, trabalhandoRes] = await Promise.all([
            supabase.from("status").select("id").eq("name", "ALOJAMENTO").single(),
            supabase.from("status").select("id").eq("name", "AGUARDANDO INTEGRAÇÃO").single(),
            supabase.from("status").select("id").eq("name", "TRABALHANDO DISPONIVEL").single()
        ]);

        const alojId = alojRes.data?.id;
        const aguardandoId = aguardandoRes.data?.id;
        const trabalhandoId = trabalhandoRes.data?.id;

        let employeeQuery;

        if (includeAllStatuses) {
            const statusIds = [aguardandoId, trabalhandoId].filter(Boolean);
            employeeQuery = supabase.from("funcionarios")
                .select("accommodation_id, status_id")
                .eq("is_active", true)
                .not("accommodation_id", "is", null)
                .in("status_id", statusIds);
        } else {
            if (!alojId) throw new Error("Status 'ALOJAMENTO' not found");
            employeeQuery = supabase.from("funcionarios")
                .select("accommodation_id, status_id")
                .eq("is_active", true)
                .not("accommodation_id", "is", null)
                .eq("refeicao_status_id", alojId);
        }

        // Fetch employees, accommodations and adicionais
        const [accRes, empRes, adsRes] = await Promise.all([
            supabase.from("alojamentos").select("*").eq("is_active", true),
            employeeQuery,
            supabase.from("adicionais").select("*").eq("ativo", true).order("nome")
        ]);

        if (accRes.error) throw accRes.error;
        if (empRes.error) throw empRes.error;
        if (adsRes.error) throw adsRes.error;

        let accommodations = accRes.data as Accommodation[] || [];
        const employees = empRes.data as { accommodation_id: number, status_id: number }[] || [];
        const adicionais = adsRes.data as Adicional[] || [];

        if (!isSuper && unitIds.length > 0) {
            accommodations = accommodations.filter(a => unitIds.includes(a.unit_id));
        } else if (!isSuper && unitIds.length === 0) {
            accommodations = [];
        }

        const employeeCounts: Record<number, number> = {};
        employees.forEach(emp => {
            if (emp.accommodation_id) {
                employeeCounts[emp.accommodation_id] = (employeeCounts[emp.accommodation_id] || 0) + 1;
            }
        });

        let accommodationsWithEmployees = accommodations.filter(acc => (employeeCounts[acc.id] || 0) > 0);

        // If supplier filter is active, filter by linked accommodations
        if (selectedCafeSupplier) {
            const { data: pivotRows } = await supabase
                .from("alojamentos_fornecedores")
                .select("alojamento_id")
                .eq("fornecedor_id", selectedCafeSupplier);
            const allowedIds = new Set((pivotRows || []).map((r: any) => r.alojamento_id));
            accommodationsWithEmployees = accommodationsWithEmployees.filter(a => allowedIds.has(a.id));
        }

        return { accommodations: accommodationsWithEmployees, employeeCounts, adicionais };
    };

    const fetchLancheData = async (includeAllStatuses: boolean = false) => {
        const { isSuper, unitIds } = await fetchUserUnits();

        // Fetch status IDs
        const { data: allStatuses } = await supabase.from("status").select("id, name");
        const sts = allStatuses || [];
        const alojResId = sts.find(s => s.name.toUpperCase() === "ALOJAMENTO")?.id;
        const obraResId = sts.find(s => s.name.toUpperCase() === "OBRA")?.id;
        const aguardandoId = sts.find(s => s.name.toUpperCase() === "AGUARDANDO INTEGRAÇÃO")?.id;
        const trabalhandoId = sts.find(s => s.name.toUpperCase() === "TRABALHANDO DISPONIVEL")?.id;

        let employeeQuery = supabase.from("funcionarios")
            .select("unit_id, accommodation_id, status_id, refeicao_status_id")
            .eq("is_active", true);

        if (includeAllStatuses) {
            const statusIds = [aguardandoId, trabalhandoId].filter(Boolean);
            employeeQuery = employeeQuery.in("status_id", statusIds);
        } else {
            const mealStatusIds = [alojResId, obraResId].filter(Boolean);
            employeeQuery = employeeQuery.in("refeicao_status_id", mealStatusIds);
        }

        const [accRes, unitsRes, empRes, adsRes] = await Promise.all([
            supabase.from("alojamentos").select("*").eq("is_active", true),
            supabase.from("unidades").select("*").eq("is_active", true),
            employeeQuery,
            supabase.from("adicionais").select("*").eq("ativo", true).order("nome")
        ]);

        if (accRes.error) throw accRes.error;
        if (unitsRes.error) throw unitsRes.error;
        if (empRes.error) throw empRes.error;
        if (adsRes.error) throw adsRes.error;

        let accommodations = accRes.data as Accommodation[] || [];
        let units = unitsRes.data as Unit[] || [];
        const employees = empRes.data as { unit_id: number, accommodation_id: number, status_id: number, refeicao_status_id: number }[] || [];
        const adicionais = adsRes.data as Adicional[] || [];

        if (!isSuper && unitIds.length > 0) {
            accommodations = accommodations.filter(a => unitIds.includes(a.unit_id));
            units = units.filter(u => unitIds.includes(u.id));
        } else if (!isSuper && unitIds.length === 0) {
            accommodations = [];
            units = [];
        }

        const accommodationCounts: Record<number, number> = {};
        const unitCounts: Record<number, number> = {};

        employees.forEach(emp => {
            if (emp.refeicao_status_id === alojResId) {
                if (emp.accommodation_id) {
                    accommodationCounts[emp.accommodation_id] = (accommodationCounts[emp.accommodation_id] || 0) + 1;
                }
            } else if (emp.refeicao_status_id === obraResId) {
                if (emp.unit_id) {
                    unitCounts[emp.unit_id] = (unitCounts[emp.unit_id] || 0) + 1;
                }
            } else if (includeAllStatuses) {
                // If including all, and not explicitly ALOJ/OBRA meal status, default to unit if no acc
                if (emp.accommodation_id) {
                    accommodationCounts[emp.accommodation_id] = (accommodationCounts[emp.accommodation_id] || 0) + 1;
                } else if (emp.unit_id) {
                    unitCounts[emp.unit_id] = (unitCounts[emp.unit_id] || 0) + 1;
                }
            }
        });

        const filteredAccs = accommodations.filter(acc => (accommodationCounts[acc.id] || 0) > 0);
        const filteredUnits = units.filter(unit => (unitCounts[unit.id] || 0) > 0);

        return { accommodations: filteredAccs, accommodationCounts, units: filteredUnits, unitCounts, adicionais };
    };


    const fetchDDSData = async () => {
        const { isSuper, unitIds } = await fetchUserUnits();
        let employees: Employee[] = [];
        let units: Unit[] = [];
        let statuses: any[] = [];

        const { data: statusData } = await supabase
            .from("status")
            .select("id")
            .eq("name", "TRABALHANDO DISPONIVEL")
            .single();

        if (!statusData) throw new Error("Status 'TRABALHANDO DISPONIVEL' not found");

        const [empRes, unitsRes, statusRes] = await Promise.all([
            supabase
                .from("funcionarios")
                .select("id, full_name, unit_id, status_id, is_active, function_id, accommodation_id, tamanho_marmita, refeicao_status_id")
                .eq("is_active", true)
                .eq("status_id", statusData.id)
                .order("full_name"),
            supabase.from("unidades").select("id, name").eq("is_active", true),
            supabase.from("status").select("id, name")
        ]);

        if (empRes.error) throw empRes.error;
        if (unitsRes.error) throw unitsRes.error;
        if (statusRes.error) throw statusRes.error;

        employees = (empRes.data || []) as Employee[];
        units = (unitsRes.data || []) as Unit[];
        statuses = (statusRes.data || []) as any[];

        if (!isSuper) {
            if (unitIds.length > 0) employees = employees.filter(e => unitIds.includes(e.unit_id));
            else employees = [];
        }

        const statusMap = new Map(statuses.map(s => [s.id, s.name]));

        return { employees, units, statusMap };
    };

    const fetchIntegrationData = async () => {
        const { isSuper, unitIds } = await fetchUserUnits();

        // Get status ID for "TRABALHANDO DISPONIVEL"
        const { data: statusData } = await supabase
            .from("status")
            .select("id")
            .eq("name", "TRABALHANDO DISPONIVEL")
            .single();

        if (!statusData) throw new Error("Status 'TRABALHANDO DISPONIVEL' not found");

        const [empRes, funcsRes, statusRes, unitsRes] = await Promise.all([
            supabase.from("funcionarios")
                .select("id, full_name, arrival_date, integration_date, function_id, status_id, unit_id, tamanho_marmita, refeicao_status_id")
                .eq("is_active", true)
                .eq("status_id", statusData.id),
            supabase.from("funcoes").select("id, name").eq("is_active", true),
            supabase.from("status").select("id, name").eq("is_active", true),
            supabase.from("unidades").select("id, name").eq("is_active", true)
        ]);

        if (empRes.error) throw empRes.error;
        if (funcsRes.error) throw funcsRes.error;
        if (statusRes.error) throw statusRes.error;
        if (unitsRes.error) throw unitsRes.error;

        let employees = empRes.data as Employee[] || [];
        const functions = funcsRes.data as Function[] || [];
        const statuses = statusRes.data as any[] || [];
        const units = unitsRes.data as Unit[] || [];

        if (!isSuper && unitIds.length > 0) {
            employees = employees.filter(e => unitIds.includes(e.unit_id));
        } else if (!isSuper && unitIds.length === 0) {
            employees = [];
        }

        const statusMap = new Map(statuses.map(s => [s.id, s.name]));

        return { employees, functions, statuses, statusMap, units };
    };

    // --- PDF Generators ---

    const generateJornadaPDF = async (data: any) => {
        const { employees, workLogs, units } = data;
        if (workLogs.length === 0) {
            showToast("Nenhum registro encontrado.", "error");
            return;
        }

        const doc = new jsPDF();
        const groupedLogs: Record<number, WorkLog[]> = {};
        workLogs.forEach((log: WorkLog) => {
            if (!groupedLogs[log.employee_id]) groupedLogs[log.employee_id] = [];
            groupedLogs[log.employee_id].push(log);
        });
        const employeeIds = Object.keys(groupedLogs).map(Number);

        const logoDataUrl = await getSystemLogo();

        employeeIds.forEach((empId: number, index: number) => {
            if (index > 0) doc.addPage();
            const employee = employees.find((e: Employee) => e.id === empId);
            const unit = units.find((u: Unit) => u.id === employee?.unit_id);
            const logs = groupedLogs[empId].sort((a: WorkLog, b: WorkLog) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());

            if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
            doc.setFontSize(18);
            doc.text("Relatório de Jornada", 50, 20);
            doc.setFontSize(11);
            const startX = 50;
            let currentY = 30;
            const lineHeight = 6;

            doc.text(`Colaborador: ${employee?.full_name || "Desconhecido"}`, startX, currentY);
            currentY += lineHeight;
            doc.text(`Obra: ${unit?.name || '-'}`, startX, currentY);
            currentY += lineHeight;
            doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, startX, currentY);

            autoTable(doc, {
                startY: 55,
                head: [["Data", "Entrada", "Saída Almoço", "Volta Almoço", "Saída", "Observação"]],
                body: logs.map(log => [
                    new Date(log.work_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
                    log.entry_time_1?.slice(0, 5) || "-",
                    log.exit_time_1?.slice(0, 5) || "-",
                    log.entry_time_2?.slice(0, 5) || "-",
                    log.exit_time_2?.slice(0, 5) || "-",
                    log.observation || "-"
                ]),
                theme: 'grid',
                styles: { fontSize: 8, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 25 },
                    1: { halign: 'center', cellWidth: 15 },
                    2: { halign: 'center', cellWidth: 20 },
                    3: { halign: 'center', cellWidth: 20 },
                    4: { halign: 'center', cellWidth: 15 },
                    5: { halign: 'left', cellWidth: 'auto', cellPadding: 2 }
                },
            });
        });
        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'relatorio_jornada.pdf';
        link.click();
        URL.revokeObjectURL(url);
    };

    const generateEmployeesPDF = async (data: any, reportDate: string) => {
        const { employees, units, functions } = data;
        if (employees.length === 0) {
            showToast("Nenhum colaborador ativo.", "error");
            return;
        }

        const doc = new jsPDF();
        const groupedEmployees: Record<number, Employee[]> = {};
        employees.forEach((emp: Employee) => {
            if (!groupedEmployees[emp.unit_id]) groupedEmployees[emp.unit_id] = [];
            groupedEmployees[emp.unit_id].push(emp);
        });
        const unitIdsToPrint = Object.keys(groupedEmployees).map(Number);

        const logoDataUrl = await getSystemLogo();

        unitIdsToPrint.forEach((unitId, index) => {
            if (index > 0) doc.addPage();
            const unit = units.find((u: Unit) => u.id === unitId);
            const unitEmployees = groupedEmployees[unitId];

            if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
            doc.setFontSize(18);
            doc.text("LISTA DE COLABORADORES", 50, 20);
            doc.setFontSize(11);
            const startX = 50;
            let currentY = 30;
            const lineHeight = 6;

            doc.text(`Total de Colaboradores (Obra): ${unitEmployees.length}`, startX, currentY);
            currentY += lineHeight;
            doc.text(`Obra: ${unit?.name || "-"}`, startX, currentY);
            currentY += lineHeight;
            const dateLabel = reportDate ? new Date(reportDate + 'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
            doc.text(`Data de Emissão: ${dateLabel}`, startX, currentY);

            if (employeeSort === "function") {
                // Aggregation view: Function | Count
                const functionCounts: Record<string, number> = {};
                unitEmployees.forEach(emp => {
                    const funcName = functions.find((f: Function) => f.id === emp.function_id)?.name || "SEM FUNÇÃO";
                    functionCounts[funcName] = (functionCounts[funcName] || 0) + 1;
                });

                const tableData = Object.entries(functionCounts)
                    .map(([name, count]) => [name, count.toString()])
                    .sort((a, b) => a[0].localeCompare(b[0]));

                // Add total row
                tableData.push(["TOTAL", unitEmployees.length.toString()]);

                autoTable(doc, {
                    startY: 56,
                    head: [["FUNÇÃO", "QUANTIDADE"]],
                    body: tableData,
                    theme: 'grid',
                    styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3 },
                    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
                    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
                    didParseCell: (data: any) => {
                        if (data.row.index === tableData.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [240, 240, 240];
                        }
                    },
                });

            } else {
                // Name view (Standard list)
                const sortedEmployees = unitEmployees.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

                autoTable(doc, {
                    startY: 56,
                    head: [["CHEGADA À OBRA", "COLABORADOR", "FUNÇÃO"]],
                    body: sortedEmployees.map(emp => [
                        emp.arrival_date ? new Date(emp.arrival_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-",
                        emp.full_name || "-",
                        functions.find((f: Function) => f.id === emp.function_id)?.name || "-"
                    ]),
                    theme: 'grid',
                    styles: { fontSize: 8, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3 },
                    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
                    columnStyles: { 0: { halign: 'center' }, 1: { halign: 'left' }, 2: { halign: 'center' } },
                });
            }
        });
        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'lista_colaboradores.pdf';
        link.click();
        URL.revokeObjectURL(url);
    };

    const generateMarmitasPDF = async (data: any) => {
        const { accommodations, employeeCounts, sizeCounts } = data;
        if (accommodations.length === 0) {
            showToast("Nenhum alojamento encontrado.", "error");
            return;
        }

        const doc = new jsPDF();
        const logoDataUrl = await getSystemLogo();

        if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
        doc.setFontSize(18);
        doc.text("Relatório de Marmitas", 50, 20);
        doc.setFontSize(11);
        const startX = 50;
        let currentY = 30;
        doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, startX, currentY);

        const body = accommodations.map((acc: Accommodation) => {
            const counts = sizeCounts[acc.id] || { P: 0, M: 0, G: 0 };
            return [
                acc.name || "-",
                (employeeCounts[acc.id] || 0).toString(),
                counts.P.toString(),
                counts.M.toString(),
                counts.G.toString(),
            ];
        });

        const total = accommodations.reduce((sum: number, acc: Accommodation) => sum + (employeeCounts[acc.id] || 0), 0);
        const totalP = accommodations.reduce((sum: number, acc: Accommodation) => sum + (sizeCounts[acc.id]?.P || 0), 0);
        const totalM = accommodations.reduce((sum: number, acc: Accommodation) => sum + (sizeCounts[acc.id]?.M || 0), 0);
        const totalG = accommodations.reduce((sum: number, acc: Accommodation) => sum + (sizeCounts[acc.id]?.G || 0), 0);

        body.push(["TOTAL", total.toString(), totalP.toString(), totalM.toString(), totalG.toString()]);

        autoTable(doc, {
            head: [["ALOJAMENTO", "TOTAL", "P", "M", "G"]],
            body,
            startY: 45,
            theme: 'grid',
            styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' },
                2: { halign: 'center' },
                3: { halign: 'center' },
                4: { halign: 'center' },
            },
            didParseCell: (data: any) => {
                if (data.row.index === body.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            },
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Tabela de Adicionais
        if (data.adicionais && data.adicionais.length > 0) {
            const adsBody = data.adicionais.map((ad: any) => [
                ad.nome || "-",
                ad.quantidade_marmita.toString()
            ]);
            const totalAds = data.adicionais.reduce((sum: number, ad: any) => sum + (ad.quantidade_marmita || 0), 0);
            adsBody.push(["TOTAL ADICIONAIS", totalAds.toString()]);

            autoTable(doc, {
                head: [["ITEM", "QUANTIDADE MARMITA EQUIVALENTE"]],
                body: adsBody,
                startY: currentY,
                theme: 'grid',
                styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3 },
                headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
                columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
                didParseCell: (data: any) => {
                    if (data.row.index === adsBody.length - 1) {
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                },
            });
            currentY = (doc as any).lastAutoTable.finalY + 20;
        }

        const totalMarmita = accommodations.reduce((sum: number, acc: any) => sum + (employeeCounts[acc.id] || 0), 0);
        const totalAds = (data.adicionais || []).reduce((sum: number, ad: any) => sum + (ad.quantidade_marmita || 0), 0);
        const grandTotal = totalMarmita + totalAds;

        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL | ${grandTotal}`, 105, currentY, { align: "center" });

        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'relatorio_marmitas.pdf';
        link.click();
        URL.revokeObjectURL(url);
    };

    const generateCafeDaManhaPDF = async (data: any) => {
        const { accommodations, employeeCounts } = data;
        if (accommodations.length === 0) {
            showToast("Nenhum alojamento encontrado.", "error");
            return;
        }

        const doc = new jsPDF();
        const logoDataUrl = await getSystemLogo();

        if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
        doc.setFontSize(18);
        doc.text("Relatório de Café da Manhã", 50, 20);
        doc.setFontSize(11);
        const startX = 50;
        let currentY = 30;
        doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, startX, currentY);

        const body = accommodations.map((acc: Accommodation) => [
            acc.name || "-",
            (employeeCounts[acc.id] || 0).toString(),
        ]);

        const total = accommodations.reduce((sum: number, acc: Accommodation) => sum + (employeeCounts[acc.id] || 0), 0);
        body.push(["TOTAL", total.toString()]);

        autoTable(doc, {
            head: [["ALOJAMENTO", "CAFÉ DA MANHÃ"]],
            body,
            startY: 45,
            theme: 'grid',
            styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
            columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
            didParseCell: (data: any) => {
                if (data.row.index === body.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            },
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Tabela de Adicionais
        if (data.adicionais && data.adicionais.length > 0) {
            const adsBody = data.adicionais.map((ad: any) => [
                ad.nome || "-",
                ad.quantidade_marmita.toString()
            ]);
            const totalAds = data.adicionais.reduce((sum: number, ad: any) => sum + (ad.quantidade_marmita || 0), 0);
            adsBody.push(["TOTAL ADICIONAIS", totalAds.toString()]);

            autoTable(doc, {
                head: [["ITEM", "QUANTIDADE MARMITA EQUIVALENTE"]],
                body: adsBody,
                startY: currentY,
                theme: 'grid',
                styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3 },
                headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
                columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
                didParseCell: (data: any) => {
                    if (data.row.index === adsBody.length - 1) {
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                },
            });
            currentY = (doc as any).lastAutoTable.finalY + 20;
        }

        const totalCafe = accommodations.reduce((sum: number, acc: any) => sum + (employeeCounts[acc.id] || 0), 0);
        const totalAds = (data.adicionais || []).reduce((sum: number, ad: any) => sum + (ad.quantidade_marmita || 0), 0);
        const grandTotal = totalCafe + totalAds;

        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL | ${grandTotal}`, 105, currentY, { align: "center" });

        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'relatorio_cafe_da_manha.pdf';
        link.click();
        URL.revokeObjectURL(url);
    };

    const generateLanchePDF = async (data: any) => {
        const { accommodations, accommodationCounts, units, unitCounts } = data;
        if (accommodations.length === 0 && units.length === 0) {
            showToast("Nenhum dado encontrado para o relatório.", "error");
            return;
        }

        const doc = new jsPDF();
        const logoDataUrl = await getSystemLogo();

        if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
        doc.setFontSize(18);
        doc.text("Relatório de Lanche", 50, 20);
        doc.setFontSize(11);
        const startX = 50;
        let currentY = 30;
        doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, startX, currentY);

        currentY = 45;

        // Tabela de Alojamento
        if (accommodations.length > 0) {
            const body = accommodations.map((acc: Accommodation) => [
                acc.name || "-",
                (accommodationCounts[acc.id] || 0).toString(),
            ]);

            const total = accommodations.reduce((sum: number, acc: Accommodation) => sum + (accommodationCounts[acc.id] || 0), 0);
            body.push(["TOTAL ALOJAMENTO", total.toString()]);

            autoTable(doc, {
                head: [["ALOJAMENTO", "LANCHE"]],
                body,
                startY: currentY,
                theme: 'grid',
                styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
                columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
                didParseCell: (data: any) => {
                    if (data.row.index === body.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                },
            });
            currentY = (doc as any).lastAutoTable.finalY + 15;
        }

        // Tabela de Obra
        if (units.length > 0) {
            const body = units.map((unit: Unit) => [
                unit.name || "-",
                (unitCounts[unit.id] || 0).toString(),
            ]);

            const total = units.reduce((sum: number, unit: Unit) => sum + (unitCounts[unit.id] || 0), 0);
            body.push(["TOTAL OBRA", total.toString()]);

            autoTable(doc, {
                head: [["OBRA", "LANCHE"]],
                body,
                startY: currentY,
                theme: 'grid',
                styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3 },
                headStyles: { fillColor: [39, 174, 96], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
                columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
                didParseCell: (data: any) => {
                    if (data.row.index === body.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                },
            });
            currentY = (doc as any).lastAutoTable.finalY + 15;
        }

        // Tabela de Adicionais
        if (data.adicionais && data.adicionais.length > 0) {
            const adsBody = data.adicionais.map((ad: any) => [
                ad.nome || "-",
                ad.quantidade_marmita.toString()
            ]);
            const totalAds = data.adicionais.reduce((sum: number, ad: any) => sum + (ad.quantidade_marmita || 0), 0);
            adsBody.push(["TOTAL ADICIONAIS", totalAds.toString()]);

            autoTable(doc, {
                head: [["ITEM", "QUANTIDADE MARMITA EQUIVALENTE"]],
                body: adsBody,
                startY: currentY,
                theme: 'grid',
                styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3 },
                headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
                columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
                didParseCell: (data: any) => {
                    if (data.row.index === adsBody.length - 1) {
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                },
            });
            currentY = (doc as any).lastAutoTable.finalY + 20;
        }

        const totalAloj = accommodations.reduce((sum: number, acc: any) => sum + (accommodationCounts[acc.id] || 0), 0);
        const totalObra = units.reduce((sum: number, unit: any) => sum + (unitCounts[unit.id] || 0), 0);
        const totalAds = (data.adicionais || []).reduce((sum: number, ad: any) => sum + (ad.quantidade_marmita || 0), 0);
        const grandTotal = totalAloj + totalObra + totalAds;

        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL | ${grandTotal}`, 105, currentY, { align: "center" });

        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'relatorio_lanche.pdf';
        link.click();
        URL.revokeObjectURL(url);
    };


    const generateIntegrationPDF = async (data: any) => {
        const { employees, functions, statusMap } = data;
        if (employees.length === 0) {
            showToast("Nenhum colaborador trabalhando disponível.", "error");
            return;
        }

        const doc = new jsPDF();
        const date = new Date().toLocaleDateString("pt-BR");

        // Load logo
        const logoDataUrl = await getSystemLogo();

        // Sort employees by arrival_date (most recent first)
        const sortedEmployees = [...employees].sort((a, b) => {
            if (!a.arrival_date && !b.arrival_date) return 0;
            if (!a.arrival_date) return 1;
            if (!b.arrival_date) return -1;
            return new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime();
        });

        // Add header
        if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
        doc.setFontSize(18);
        doc.text("RELATÓRIO DE INTEGRAÇÃO", 50, 20);
        doc.setFontSize(11);
        const startX = 50;
        let currentY = 30;
        const lineHeight = 6;

        doc.text(`Total de Colaboradores: ${employees.length}`, startX, currentY);
        currentY += lineHeight;
        doc.text(`Obra: -`, startX, currentY);
        currentY += lineHeight;
        doc.text(`Data de Emissão: ${date}`, startX, currentY);

        const tableData = sortedEmployees.map((emp: Employee) => [
            emp.arrival_date ? new Date(emp.arrival_date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-",
            emp.integration_date ? new Date(emp.integration_date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-",
            emp.full_name,
            functions.find((f: Function) => f.id === emp.function_id)?.name || "-",
            (emp.tamanho_marmita || "-"),
            (emp.status_id && statusMap.get(emp.status_id) || "-"),
        ]);

        autoTable(doc, {
            startY: 55,
            head: [["CHEGADA À OBRA", "DATA INTEGRAÇÃO", "COLABORADOR", "FUNÇÃO", "TAM.", "STATUS"]],
            body: tableData,
            styles: {
                fontSize: 7,
                halign: 'center',
                valign: 'middle',
                lineColor: [0, 0, 0],
                lineWidth: 0.3,
                cellPadding: 1.5,
                overflow: 'ellipsize'
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center',
                lineWidth: 0,
                minCellHeight: 8
            },
            columnStyles: {
                0: { cellWidth: 28, halign: 'center' },
                1: { cellWidth: 28, halign: 'center' },
                2: { cellWidth: 'auto', halign: 'left' },
                3: { cellWidth: 30, halign: 'center' },
                4: { cellWidth: 15, halign: 'center' },
                5: { cellWidth: 30, halign: 'center' }
            }
        });

        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'relatorio_integracao.pdf';
        link.click();
        URL.revokeObjectURL(url);
    };

    const generateDDSPDF = async (data: any) => {
        const { employees, units } = data;
        if (!employees || employees.length === 0) {
            showToast("Nenhum colaborador encontrado.", "error");
            return;
        }

        const doc = new jsPDF();
        const logoDataUrl = await getSystemLogo();

        const groupedEmployees: Record<number, Employee[]> = {};
        employees.forEach((emp: Employee) => {
            if (!groupedEmployees[emp.unit_id]) groupedEmployees[emp.unit_id] = [];
            groupedEmployees[emp.unit_id].push(emp);
        });
        const unitIdsToPrint = Object.keys(groupedEmployees).map(Number);

        unitIdsToPrint.forEach((unitId, index) => {
            if (index > 0) doc.addPage();
            const unit = units.find((u: Unit) => u.id === unitId);
            const unitEmployees = groupedEmployees[unitId].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

            if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
            doc.setFontSize(18);
            doc.text("Diálogo Diário de Segurança", 50, 20);
            doc.setFontSize(12);
            const dateLabel = reportDate ? new Date(reportDate + 'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
            doc.text(`Emitido em: ${dateLabel}`, 50, 30);
            const unitName = unit?.name || "-";
            doc.text(`Obra: ${unitName}`, 50, 36);
            doc.text(`Colaboradores: ${unitEmployees.length}`, 50, 42);

            autoTable(doc, {
                startY: 50,
                head: [["Colaboradores", "Assinatura"]],
                body: unitEmployees.map((e: Employee) => [e.full_name || "-", ""]),
                theme: 'grid',
                styles: { fontSize: 8, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.3, overflow: 'linebreak', cellPadding: 2 },
                headStyles: { fillColor: [76, 81, 191], textColor: 255, fontStyle: 'bold', halign: 'center', lineWidth: 0 },
                columnStyles: {
                    0: { cellWidth: 80, halign: 'left', overflow: 'linebreak' },
                    1: { cellWidth: 100, halign: 'center' }
                }
            });
        });

        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'relatorio_dds.pdf';
        link.click();
        URL.revokeObjectURL(url);
    };

    const generateRomaneioPDF = async () => {
        const doc = new jsPDF();
        const logoDataUrl = await getSystemLogo();

        if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);

        doc.setFontSize(14);
        doc.text("CONTROLE DE ENTRADA E SAÍDA DE MATERIAIS", 105, 26, { align: "center" });

        doc.setFontSize(10);
        let currentY = 54;
        doc.text(`Empresa:___________________`, 14, currentY);
        doc.text("Responsável: ____________________", 110, currentY);
        currentY += 6;
        doc.text("Data de Entrada: ____/____/____", 14, currentY);
        doc.text("Data de Saída: ____/____/____", 110, currentY);

        const body = Array.from({ length: 25 }, () => ["", "", "", ""]);

        autoTable(doc, {
            head: [["QUANTIDADE", "UNIDADE", "DESCRIÇÃO DO MATERIAL", "DATA DE SAÍDA"]],
            body,
            startY: currentY + 8,
            theme: "grid",
            styles: { fontSize: 9, halign: "center", valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.3 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", halign: "center", lineWidth: 0 },
            columnStyles: {
                0: { halign: "center", cellWidth: 25 },
                1: { halign: "center", cellWidth: 25 },
                2: { halign: "left", cellWidth: 100 },
                3: { halign: "center", cellWidth: 30 }
            }
        });

        const anyDoc: any = doc;
        let footerY = anyDoc.lastAutoTable && anyDoc.lastAutoTable.finalY ? anyDoc.lastAutoTable.finalY + 12 : 140;

        doc.line(20, footerY, 90, footerY);
        doc.line(120, footerY, 190, footerY);
        doc.text("RESPONSAVEL ENTRADA", 55, footerY + 5, { align: "center" });
        doc.text("RESPONSAVEL SAÍDA", 155, footerY + 5, { align: "center" });


        const pdfBlob = doc.output("blob");
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "relatorio_romaneio.pdf";
        link.click();
        URL.revokeObjectURL(url);
    };

    // --- Handlers ---

    const handleDownloadPDF = async () => {
        if (!selectedReport) return;
        setLoadingReport(selectedReport);
        try {
            let data;
            if (selectedReport === "jornada") {
                data = await fetchJornadaData();
                await generateJornadaPDF(data);
            } else if (selectedReport === "employees") {
                if (!reportDate) {
                    showToast("Por favor, selecione uma data.", "error");
                    return;
                }
                data = await fetchEmployeesData();
                await generateEmployeesPDF(data, reportDate);
            } else if (selectedReport === "marmitas") {
                data = await fetchMarmitasData(includeAllStatuses);
                await generateMarmitasPDF(data);
            } else if (selectedReport === "cafe-da-manha") {
                data = await fetchCafeDaManhaData(includeAllStatuses);
                await generateCafeDaManhaPDF(data);
            } else if (selectedReport === "lanche") {
                data = await fetchLancheData(includeAllStatuses);
                await generateLanchePDF(data);
            } else if (selectedReport === "integration") {
                data = await fetchIntegrationData();
                await generateIntegrationPDF(data);
            } else if (selectedReport === "dds") {
                data = await fetchDDSData();
                await generateDDSPDF(data);
            } else if (selectedReport === "romaneio") {
                await generateRomaneioPDF();
            }
            showToast("Download iniciado!", "success");
        } catch (error) {
            console.error("Error downloading PDF:", error);
            showToast("Erro ao gerar PDF.", "error");
        } finally {
            setLoadingReport(null);
            setSelectedReport(null);
        }
    };



    const handleMealJPEG = async (mealType: "almoco" | "janta" | "cafe-da-manha" | "lanche") => {
        if (!selectedReport) return;
        if (!reportDate) {
            showToast("Por favor, selecione uma data.", "error");
            return;
        }
        setLoadingReport(selectedReport + "-" + mealType);
        try {
            // 1. Fetch Data
            let data;
            if (selectedReport === "marmitas") data = await fetchMarmitasData(includeAllStatuses);
            else if (selectedReport === "cafe-da-manha") data = await fetchCafeDaManhaData(includeAllStatuses);
            else if (selectedReport === "lanche") data = await fetchLancheData(includeAllStatuses);

            // 2. Set Preview Data & Type with meal type and date
            const systemLogo = await getSystemLogo();
            setPreviewData({ ...data, mealType, reportDate, includeAllStatuses, systemLogo });
            setPreviewType(selectedReport);

            // 3. Wait for render
            await new Promise(resolve => setTimeout(resolve, 500));

            // 4. Capture
            if (previewRef.current) {
                const canvas = await html2canvas(previewRef.current, {
                    scale: 3,
                    backgroundColor: "#ffffff",
                    useCORS: true
                });

                // 5. Download
                const link = document.createElement('a');
                let reportName = "";
                if (selectedReport === "marmitas") reportName = "marmitas";
                else if (selectedReport === "cafe-da-manha") reportName = "cafe-da-manha";
                else if (selectedReport === "lanche") reportName = "lanche";

                const suffix = includeAllStatuses ? "_todos" : "";
                link.download = `relatorio_${reportName}_${mealType}${suffix}.jpg`;
                link.href = canvas.toDataURL("image/jpeg", 1.0);
                link.click();

                showToast("Imagem gerada com sucesso!", "success");
            } else {
                throw new Error("Preview element not found");
            }

        } catch (error) {
            console.error("Error generating JPEG:", error);
            showToast("Erro ao gerar imagem.", "error");
        } finally {
            setLoadingReport(null);
            setSelectedReport(null);
            setPreviewData(null);
            setPreviewType(null);
        }
    };

    const handleEmployeesDirectJPEG = async () => {
        if (!reportDate) {
            showToast("Por favor, selecione uma data.", "error");
            return;
        }
        setLoadingReport("employees-img");
        try {
            // 1. Fetch Data
            const data = await fetchEmployeesData();

            // 2. Set Preview Data & Type
            const systemLogo = await getSystemLogo();
            setPreviewData({ ...data, reportDate, employeeSort, systemLogo }); // Pass sort option
            setPreviewType("employees");

            // 3. Wait for render
            await new Promise(resolve => setTimeout(resolve, 500));

            // 4. Capture
            if (previewRef.current) {
                const canvas = await html2canvas(previewRef.current, {
                    scale: 3,
                    backgroundColor: "#ffffff",
                    useCORS: true
                });

                // 5. Download
                const link = document.createElement('a');
                link.download = `relatorio_colaboradores.jpg`;
                link.href = canvas.toDataURL("image/jpeg", 1.0);
                link.click();

                showToast("Imagem gerada com sucesso!", "success");
            } else {
                throw new Error("Preview element not found");
            }

        } catch (error) {
            console.error("Error generating JPEG:", error);
            showToast("Erro ao gerar imagem.", "error");
        } finally {
            setLoadingReport(null);
            setPreviewData(null);
            setPreviewType(null);
        }
    };

    // --- End of Handlers ---

    const reports = [
        {
            id: "jornada",
            title: "Relatório de Jornada",
            description: "Exportar registro de horários dos colaboradores.",
            icon: Clock,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20"
        },
        {
            id: "employees",
            title: "Relatório de Colaboradores",
            description: "Lista de colaboradores ativos organizados por obra.",
            icon: Users,
            color: "text-green-400",
            bg: "bg-green-500/10",
            border: "border-green-500/20"
        },
        {
            id: "integration",
            title: "Relatório de Integração",
            description: "Lista de colaboradores trabalhando disponível.",
            icon: UserCircle,
            color: "text-cyan-400",
            bg: "bg-cyan-500/10",
            border: "border-cyan-500/20"
        },
        {
            id: "marmitas",
            title: "Relatório de Marmitas",
            description: "Contagem de marmitas necessárias por alojamento.",
            icon: Utensils,
            color: "text-orange-400",
            bg: "bg-orange-500/10",
            border: "border-orange-500/20"
        },
        {
            id: "cafe-da-manha",
            title: "Relatório de Café da Manhã",
            description: "Contagem de café da manhã necessário por alojamento.",
            icon: Coffee,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            border: "border-purple-500/20"
        },
        {
            id: "dds",
            title: "Relatório DDS",
            description: "Lista de colaboradores (Todos ou Em Obra).",
            icon: FileDown,
            color: "text-indigo-400",
            bg: "bg-indigo-500/10",
            border: "border-indigo-500/20"
        },
        {
            id: "romaneio",
            title: "Romaneio de Materiais",
            description: "Controle de entrada e saída de materiais.",
            icon: FileDown,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20"
        },
        {
            id: "lanche",
            title: "Relatório de Lanche",
            description: "Contagem de lanche por alojamento e obra.",
            icon: Utensils,
            color: "text-yellow-400",
            bg: "bg-yellow-500/10",
            border: "border-yellow-500/20"
        }
    ];

    return (
        <div className="space-y-6">
            {toast && (
                <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-[99999] ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"}`}>
                    {toast.text}
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Relatórios</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Central de relatórios do sistema</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report) => (
                    <div key={report.id} className={`bg-slate-900/50 backdrop-blur-xl rounded-xl border p-6 shadow-xl transition-all hover:scale-[1.02] ${report.border}`}>
                        <div className={`w-12 h-12 rounded-lg ${report.bg} flex items-center justify-center mb-4`}>
                            <report.icon className={`w-6 h-6 ${report.color}`} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-200 mb-2">{report.title}</h3>
                        <p className="text-slate-400 text-sm mb-6 min-h-[40px]">{report.description}</p>

                        {(report.id === "cafe-da-manha" || report.id === "lanche" || report.id === "marmitas" || report.id === "dds") && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-300 mb-2">Data do Relatório</label>
                                <input
                                    type="date"
                                    value={reportDate}
                                    onChange={(e) => setReportDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                    required
                                />
                            </div>
                        )}


                        <button
                            onClick={() => {
                                setSelectedReport(report.id);
                            }}
                            disabled={(loadingReport === "cafe-da-manha" && report.id === "cafe-da-manha") || (loadingReport === "dds" && report.id === "dds")}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700"
                        >
                            {loadingReport === "cafe-da-manha" && report.id === "cafe-da-manha" || loadingReport === "dds" && report.id === "dds" ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <FileDown className="w-5 h-5" />
                            )}
                            <span>Gerar Relatório</span>
                        </button>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-full max-w-md relative">
                        <button
                            onClick={() => {
                                setSelectedReport(null);
                                setIncludeAllStatuses(false);
                            }}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-2">
                            {reports.find(r => r.id === selectedReport)?.title}
                        </h3>

                        {/* Marmitas */}
                        {selectedReport === "marmitas" ? (
                            <>
                                <p className="text-slate-400 text-sm mb-4">Escolha o tipo de refeição:</p>

                                {/* Checkbox for TODOS option */}
                                <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeAllStatuses}
                                            onChange={(e) => setIncludeAllStatuses(e.target.checked)}
                                            className="w-5 h-5 accent-green-500 cursor-pointer"
                                        />
                                        <div className="flex-1">
                                            <span className="text-slate-200 font-medium">Incluir TODOS os status</span>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Marque para incluir funcionários com status "AGUARDANDO INTEGRAÇÃO" e "TRABALHANDO DISPONIVEL"
                                            </p>
                                        </div>
                                    </label>
                                </div>

                                {/* Supplier filter for Marmitas */}
                                {controlSuppliers && marmitaSuppliers.length > 0 && (
                                    <div className="mb-6 p-4 bg-slate-800/50 border border-purple-500/30 rounded-lg">
                                        <p className="text-slate-300 text-sm font-medium mb-3">Selecione o Fornecedor:</p>
                                        <div className="space-y-2">
                                            {marmitaSuppliers.map(s => (
                                                <label key={s.id} className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="marmita-supplier"
                                                        value={s.id}
                                                        checked={selectedMarmitaSupplier === s.id}
                                                        onChange={() => setSelectedMarmitaSupplier(s.id)}
                                                        className="w-4 h-4 accent-purple-500 cursor-pointer"
                                                    />
                                                    <span className="text-slate-200 text-sm">{s.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {selectedMarmitaSupplier === null && (
                                            <p className="text-amber-400 text-xs mt-2">⚠ Selecione um fornecedor para filtrar o relatório.</p>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleMealJPEG("almoco")}
                                        disabled={loadingReport !== null}
                                        className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                    >
                                        {loadingReport === "marmitas-almoco" ? (
                                            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
                                        ) : (
                                            <Sun className="w-8 h-8 text-yellow-400" />
                                        )}
                                        <span className="text-slate-200 font-medium">Almoço</span>
                                    </button>

                                    <button
                                        onClick={() => handleMealJPEG("janta")}
                                        disabled={loadingReport !== null}
                                        className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                    >
                                        {loadingReport === "marmitas-janta" ? (
                                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                                        ) : (
                                            <Moon className="w-8 h-8 text-indigo-400" />
                                        )}
                                        <span className="text-slate-200 font-medium">Janta</span>
                                    </button>
                                </div>
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={loadingReport !== null}
                                    className="w-full mt-4 flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                >
                                    {loadingReport === "marmitas" ? (
                                        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                                    ) : (
                                        <FileDown className="w-8 h-8 text-orange-400" />
                                    )}
                                    <span className="text-slate-200 font-medium">Download PDF (Geral)</span>
                                </button>
                            </>
                        ) : null}


                        {/* Employees Report */}
                        {selectedReport === "employees" ? (
                            <>
                                {/* Date Selection for Employees */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Data do Relatório:</label>
                                    <input
                                        type="date"
                                        value={reportDate}
                                        onChange={(e) => setReportDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    {/* Filtering */}
                                    <div>
                                        <p className="text-slate-400 text-sm mb-3 font-medium">Filtrar colaboradores:</p>
                                        <div className="space-y-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={employeeFilterType === "mod"}
                                                    onChange={() => setEmployeeFilterType("mod")}
                                                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                                                />
                                                <span className="text-slate-300 text-sm">MOD</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={employeeFilterType === "moi"}
                                                    onChange={() => setEmployeeFilterType("moi")}
                                                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                                                />
                                                <span className="text-slate-300 text-sm">MOI</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={employeeFilterType === "todos"}
                                                    onChange={() => setEmployeeFilterType("todos")}
                                                    className="w-4 h-4 accent-green-500 rounded cursor-pointer"
                                                />
                                                <span className="text-slate-300 text-sm font-medium">TODOS</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Sorting */}
                                    <div>
                                        <p className="text-slate-400 text-sm mb-3 font-medium">Organizar relatório por:</p>
                                        <div className="space-y-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="sort"
                                                    checked={employeeSort === "name"}
                                                    onChange={() => setEmployeeSort("name")}
                                                    className="w-4 h-4 accent-green-500 cursor-pointer"
                                                />
                                                <span className="text-slate-300 text-sm">Nome</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="sort"
                                                    checked={employeeSort === "function"}
                                                    onChange={() => setEmployeeSort("function")}
                                                    className="w-4 h-4 accent-green-500 cursor-pointer"
                                                />
                                                <span className="text-slate-300 text-sm">Função</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-slate-400 text-sm mb-6">Gerar PDF com lista de colaboradores ativos:</p>
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={loadingReport !== null}
                                    className="w-full flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                >
                                    {loadingReport === 'employees' ? (
                                        <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
                                    ) : (
                                        <FileDown className="w-8 h-8 text-green-400" />
                                    )}
                                    <span className="text-slate-200 font-medium">Download PDF</span>
                                </button>

                                <button
                                    onClick={handleEmployeesDirectJPEG}
                                    disabled={loadingReport !== null}
                                    className="w-full flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all mt-3"
                                >
                                    {loadingReport === 'employees-img' ? (
                                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                                    ) : (
                                        <Image className="w-8 h-8 text-blue-400" />
                                    )}
                                    <span className="text-slate-200 font-medium">Download Imagem</span>
                                </button>
                            </>
                        ) : null}

                        {/* Café da Manhã & Lanche */}
                        {(selectedReport === "cafe-da-manha" || selectedReport === "lanche") ? (
                            <>
                                <p className="text-slate-400 text-sm mb-4">Configurações do relatório:</p>

                                {/* Supplier radio buttons — only if config is enabled and it's café */}
                                {controlSuppliers && selectedReport === "cafe-da-manha" && cafeSuppliers.length > 0 && (
                                    <div className="mb-4 p-4 bg-slate-800/50 border border-purple-500/30 rounded-lg">
                                        <p className="text-slate-300 text-sm font-medium mb-3">Selecione o Fornecedor:</p>
                                        <div className="space-y-2">
                                            {cafeSuppliers.map(s => (
                                                <label key={s.id} className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="cafe-supplier"
                                                        value={s.id}
                                                        checked={selectedCafeSupplier === s.id}
                                                        onChange={() => setSelectedCafeSupplier(s.id)}
                                                        className="w-4 h-4 accent-purple-500 cursor-pointer"
                                                    />
                                                    <span className="text-slate-200 text-sm">{s.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {selectedCafeSupplier === null && (
                                            <p className="text-amber-400 text-xs mt-2">⚠ Selecione um fornecedor para filtrar o relatório.</p>
                                        )}
                                    </div>
                                )}

                                {/* Checkbox for TODOS option */}
                                <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeAllStatuses}
                                            onChange={(e) => setIncludeAllStatuses(e.target.checked)}
                                            className="w-5 h-5 accent-purple-500 cursor-pointer"
                                        />
                                        <div className="flex-1">
                                            <span className="text-slate-200 font-medium">Incluir TODOS os status</span>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Marque para incluir funcionários com status "AGUARDANDO INTEGRAÇÃO" e "TRABALHANDO DISPONIVEL"
                                            </p>
                                        </div>
                                    </label>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <button
                                        onClick={() => handleMealJPEG(selectedReport === "cafe-da-manha" ? "cafe-da-manha" : "lanche")}
                                        disabled={loadingReport !== null}
                                        className="w-full flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                    >
                                        {loadingReport === selectedReport + "-" + (selectedReport === "cafe-da-manha" ? "cafe-da-manha" : "lanche") ? (
                                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                                        ) : (
                                            <Image className="w-8 h-8 text-blue-400" />
                                        )}
                                        <span className="text-slate-200 font-medium">Download Imagem</span>
                                    </button>
                                </div>
                            </>
                        ) : null}

                        {/* Integration Report */}
                        {selectedReport === "integration" ? (
                            <>
                                <p className="text-slate-400 text-sm mb-6">Gerar PDF com lista de colaboradores trabalhando disponível:</p>
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={loadingReport !== null}
                                    className="w-full flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                >
                                    {loadingReport === 'integration' ? (
                                        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                                    ) : (
                                        <FileDown className="w-8 h-8 text-cyan-400" />
                                    )}
                                    <span className="text-slate-200 font-medium">Download PDF</span>
                                </button>
                            </>
                        ) : null}

                        {/* Jornada Report */}
                        {selectedReport === "jornada" ? (
                            <>
                                <p className="text-slate-400 text-sm mb-6">Gerar PDF com registro de jornadas:</p>
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={loadingReport !== null}
                                    className="w-full flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                >
                                    {loadingReport === 'jornada' ? (
                                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                                    ) : (
                                        <FileDown className="w-8 h-8 text-blue-400" />
                                    )}
                                    <span className="text-slate-200 font-medium">Download PDF</span>
                                </button>
                            </>
                        ) : null}

                        {/* DDS Report */}
                        {selectedReport === "dds" ? (
                            <>
                                <p className="text-slate-400 text-sm mb-6">Gerar PDF com lista de presença para DDS:</p>
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={loadingReport !== null}
                                    className="w-full flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                >
                                    {loadingReport === "dds" ? (
                                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                                    ) : (
                                        <FileDown className="w-8 h-8 text-indigo-400" />
                                    )}
                                    <span className="text-slate-200 font-medium">Download PDF</span>
                                </button>
                            </>
                        ) : null}

                        {selectedReport === "romaneio" ? (
                            <>
                                <p className="text-slate-400 text-sm mb-6">Gerar PDF de controle de entrada e saída de materiais:</p>
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={loadingReport !== null}
                                    className="w-full flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                >
                                    {loadingReport === "romaneio" ? (
                                        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                                    ) : (
                                        <FileDown className="w-8 h-8 text-emerald-400" />
                                    )}
                                    <span className="text-slate-200 font-medium">Download PDF</span>
                                </button>
                            </>
                        ) : null}

                        {selectedReport === "janta-lanche" ? (
                            <>
                                <p className="text-slate-400 text-sm mb-6">Selecione o formato para JANTA - LANCHE:</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={handleDownloadPDF}
                                        disabled={loadingReport !== null}
                                        className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                    >
                                        {loadingReport === "janta-lanche" ? (
                                            <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                                        ) : (
                                            <FileDown className="w-8 h-8 text-red-400" />
                                        )}
                                        <span className="text-slate-200 font-medium">PDF</span>
                                    </button>

                                    <button
                                        onClick={() => handleMealJPEG("janta")}
                                        disabled={loadingReport !== null}
                                        className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                    >
                                        {loadingReport === "janta-lanche-janta" ? (
                                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                                        ) : (
                                            <Image className="w-8 h-8 text-blue-400" />
                                        )}
                                        <span className="text-slate-200 font-medium">Imagem</span>
                                    </button>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Hidden Preview Area for HTML2Canvas */}
            <div style={{ position: "absolute", left: "-9999px", top: 0 }} className={`${previewType === "cafe-da-manha" || previewType === "lanche" || previewType === "marmitas" ? "w-[1600px]" : "w-[1200px]"} bg-white text-black ${previewType === "cafe-da-manha" || previewType === "lanche" || previewType === "marmitas" ? "p-12" : "p-8"}`} ref={previewRef}>
                {previewData && (
                    <div className="space-y-6">
                        {/* Header for non-marmitas reports */}
                        {previewType !== "marmitas" && previewType !== "dds" && previewType !== "employees" && (
                            <div className="flex items-center gap-4 mb-8 border-b pb-4">
                                <img src={previewData.systemLogo || "/logo.png"} alt="Logo" className={previewType === "cafe-da-manha" || previewType === "lanche" ? "w-32 h-32 object-contain" : "w-20 h-20 object-contain"} />
                                <div>
                                    <h1 className={previewType === "cafe-da-manha" || previewType === "lanche" ? "text-6xl font-bold text-gray-900" : "text-2xl font-bold text-gray-900"}>
                                        {previewType === "jornada" && "Relatório de Jornada"}
                                        {previewType === "employees" && "Lista de Colaboradores"}
                                        {previewType === "cafe-da-manha" && (
                                            <>
                                                {"Relatório de Café da Manhã"}
                                                {previewData.includeAllStatuses && " - TODOS"}
                                            </>
                                        )}
                                        {previewType === "lanche" && (
                                            <>
                                                {"Relatório de Lanche"}
                                                {previewData.includeAllStatuses && " - TODOS"}
                                            </>
                                        )}
                                        {previewType === "integration" && "Relatório de Integração"}
                                        {previewType === "dds" && "Relatório DDS"}
                                    </h1>
                                    <p className={previewType === "cafe-da-manha" || previewType === "lanche" ? "text-4xl font-bold text-gray-800 mt-4" : "text-gray-500"}>Emitido em: {previewData.reportDate ? new Date(previewData.reportDate + 'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                        )}

                        {/* Marmitas Report */}
                        {previewType === "marmitas" && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 mb-8 border-b pb-4">
                                    <img src={previewData.systemLogo || "/logo.png"} alt="Logo" className="w-32 h-32 object-contain" />
                                    <div>
                                        <h1 className="text-6xl font-bold text-gray-900">
                                            {(previewData.mealType === "almoco" ? "Relatório de Almoço" : "Relatório de Janta")}
                                            {previewData.includeAllStatuses && " - TODOS"}
                                        </h1>
                                        <p className="text-4xl font-bold text-gray-800 mt-4">Emitido em: {previewData.reportDate ? new Date(previewData.reportDate + 'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                                <table className="w-full text-2xl border-collapse">
                                    <thead>
                                        <tr className="bg-blue-600 text-white">
                                            <th className="p-8 text-left text-4xl">Alojamento</th>
                                            <th className="p-8 text-4xl text-center">
                                                {previewData.mealType === "almoco" ? "Quantidade Almoço" : "Quantidade Janta"}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.accommodations.map((acc: any) => (
                                            <tr key={acc.id} className="text-center">
                                                <td className="p-8 border border-black text-left text-3xl font-medium">{acc.name}</td>
                                                <td className="p-8 border border-black text-4xl font-bold">{previewData.employeeCounts[acc.id] || 0}</td>
                                            </tr>
                                        ))}
                                        <tr className="text-center font-bold bg-gray-100">
                                            <td className="p-8 border border-black text-left text-5xl">TOTAL</td>
                                            <td className="p-8 border border-black text-5xl text-center">
                                                {previewData.accommodations.reduce((sum: number, acc: any) => sum + (previewData.employeeCounts[acc.id] || 0), 0)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {previewType === "jornada" && (
                            <div className="space-y-8">
                                {Object.entries(previewData.workLogs.reduce((acc: any, log: any) => {
                                    if (!acc[log.employee_id]) acc[log.employee_id] = [];
                                    acc[log.employee_id].push(log);
                                    return acc;
                                }, {})).map(([empId, logs]: [string, any]) => {
                                    const employee = previewData.employees.find((e: any) => e.id === Number(empId));
                                    const unit = previewData.units.find((u: any) => u.id === employee?.unit_id);
                                    return (
                                        <div key={empId} className="break-inside-avoid">
                                            <div className="mb-2 bg-gray-100 p-3 rounded">
                                                <p className="font-bold">Colaborador: {employee?.full_name}</p>
                                                <p className="text-sm text-gray-600">Obra: {unit?.name}</p>
                                            </div>
                                            <table className="w-full text-sm border-collapse">
                                                <thead>
                                                    <tr className="bg-blue-600 text-white">
                                                        <th className="p-2">Data</th>
                                                        <th className="p-2">Entrada</th>
                                                        <th className="p-2">Saída Almoço</th>
                                                        <th className="p-2">Volta Almoço</th>
                                                        <th className="p-2">Saída</th>
                                                        <th className="p-2 text-left">Observação</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {logs.map((log: any) => (
                                                        <tr key={log.id} className="text-center">
                                                            <td className="p-2 border border-black">{new Date(log.work_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                                            <td className="p-2 border border-black">{log.entry_time_1?.slice(0, 5) || "-"}</td>
                                                            <td className="p-2 border border-black">{log.exit_time_1?.slice(0, 5) || "-"}</td>
                                                            <td className="p-2 border border-black">{log.entry_time_2?.slice(0, 5) || "-"}</td>
                                                            <td className="p-2 border border-black">{log.exit_time_2?.slice(0, 5) || "-"}</td>
                                                            <td className="p-2 border border-black text-left italic text-gray-700">{log.observation || "-"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {previewType === "employees" && (
                            <div className="space-y-12">
                                {Object.entries(previewData.employees.reduce((acc: any, emp: any) => {
                                    if (!acc[emp.unit_id]) acc[emp.unit_id] = [];
                                    acc[emp.unit_id].push(emp);
                                    return acc;
                                }, {})).map(([unitId, emps]: [string, any]) => {
                                    const unit = previewData.units.find((u: any) => u.id === Number(unitId));
                                    const dateLabel = previewData.reportDate ? new Date(previewData.reportDate + 'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');

                                    // Aggregation logic for preview
                                    let tableHead, tableBody;

                                    if (previewData.employeeSort === "function") {
                                        const functionCounts: Record<string, number> = {};
                                        emps.forEach((emp: any) => {
                                            const funcName = previewData.functions.find((f: any) => f.id === emp.function_id)?.name || "SEM FUNÇÃO";
                                            functionCounts[funcName] = (functionCounts[funcName] || 0) + 1;
                                        });

                                        const sortedCounts = Object.entries(functionCounts).sort((a, b) => a[0].localeCompare(b[0]));

                                        tableHead = (
                                            <tr className="bg-[#2980b9] text-white">
                                                <th className="p-3 border border-black text-left font-bold">FUNÇÃO</th>
                                                <th className="p-3 border border-black text-center font-bold">QUANTIDADE</th>
                                            </tr>
                                        );

                                        tableBody = (
                                            <>
                                                {sortedCounts.map(([name, count]) => (
                                                    <tr key={name} className="text-center">
                                                        <td className="p-2 border border-black text-left">{name}</td>
                                                        <td className="p-2 border border-black">{count}</td>
                                                    </tr>
                                                ))}
                                                <tr className="text-center font-bold bg-gray-100">
                                                    <td className="p-2 border border-black text-left">TOTAL</td>
                                                    <td className="p-2 border border-black">{emps.length}</td>
                                                </tr>
                                            </>
                                        );
                                    } else {
                                        // Standard list by name
                                        tableHead = (
                                            <tr className="bg-[#2980b9] text-white">
                                                <th className="p-3 border border-black text-center font-bold">CHEGADA À OBRA</th>
                                                <th className="p-3 border border-black text-left font-bold">COLABORADOR</th>
                                                <th className="p-3 border border-black text-center font-bold">FUNÇÃO</th>
                                            </tr>
                                        );
                                        tableBody = emps.map((emp: any) => (
                                            <tr key={emp.id} className="text-center">
                                                <td className="p-2 border border-black w-40">{emp.arrival_date ? new Date(emp.arrival_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}</td>
                                                <td className="p-2 border border-black text-left">{emp.full_name}</td>
                                                <td className="p-2 border border-black">{previewData.functions.find((f: any) => f.id === emp.function_id)?.name || "-"}</td>
                                            </tr>
                                        ));
                                    }

                                    return (
                                        <div key={unitId} className="break-inside-avoid">
                                            {/* Header matching PDF */}
                                            <div className="flex items-start gap-4 mb-6">
                                                <img src={previewData.systemLogo || "/logo.png"} alt="Logo" className="w-24 h-24 object-contain" />
                                                <div className="pt-2">
                                                    <h1 className="text-3xl font-bold text-gray-900 mb-4">LISTA DE COLABORADORES</h1>
                                                    <div className="space-y-1 text-lg">
                                                        <p><span className="font-semibold">Total de Colaboradores:</span> {emps.length}</p>
                                                        <p><span className="font-semibold">Obra:</span> {unit?.name || "-"}</p>
                                                        <p><span className="font-semibold">Data de Emissão:</span> {dateLabel}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Table matching PDF */}
                                            <table className="w-full text-base border-collapse">
                                                <thead>
                                                    {tableHead}
                                                </thead>
                                                <tbody>
                                                    {tableBody}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {previewType === "cafe-da-manha" && (
                            <table className="w-full text-2xl border-collapse">
                                <thead>
                                    <tr className="bg-blue-600 text-white">
                                        <th className="p-8 text-left text-4xl">Alojamento</th>
                                        <th className="p-8 text-4xl text-center">Quantidade Café</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.accommodations.map((acc: any) => (
                                        <tr key={acc.id} className="text-center">
                                            <td className="p-8 border border-black text-left text-3xl font-medium">{acc.name}</td>
                                            <td className="p-8 border border-black text-4xl font-bold">{previewData.employeeCounts[acc.id] || 0}</td>
                                        </tr>
                                    ))}
                                    <tr className="text-center font-bold bg-gray-100">
                                        <td className="p-8 border border-black text-left text-5xl">TOTAL</td>
                                        <td className="p-8 border border-black text-5xl">
                                            {previewData.accommodations.reduce((sum: number, acc: any) => sum + (previewData.employeeCounts[acc.id] || 0), 0)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}

                        {previewType === "lanche" && (
                            <div className="space-y-10">
                                {previewData.accommodations.length > 0 && (
                                    <div>
                                        <table className="w-full text-2xl border-collapse">
                                            <thead>
                                                <tr className="bg-blue-600 text-white">
                                                    <th className="p-8 text-left text-4xl">Alojamento</th>
                                                    <th className="p-8 text-4xl text-center">Quantidade Lanche</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.accommodations.map((acc: any) => (
                                                    <tr key={acc.id} className="text-center">
                                                        <td className="p-8 border border-black text-left text-3xl font-medium">{acc.name}</td>
                                                        <td className="p-8 border border-black text-4xl font-bold">{previewData.accommodationCounts[acc.id] || 0}</td>
                                                    </tr>
                                                ))}
                                                <tr className="text-center font-bold bg-gray-100">
                                                    <td className="p-8 border border-black text-left text-5xl">TOTAL ALOJAMENTO</td>
                                                    <td className="p-8 border border-black text-5xl">
                                                        {previewData.accommodations.reduce((sum: number, acc: any) => sum + (previewData.accommodationCounts[acc.id] || 0), 0)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {previewData.units.length > 0 && (
                                    <div>
                                        <table className="w-full text-2xl border-collapse">
                                            <thead>
                                                <tr className="bg-green-600 text-white">
                                                    <th className="p-8 text-left text-4xl">Obra</th>
                                                    <th className="p-8 text-4xl text-center">Quantidade Lanche</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.units.map((unit: any) => (
                                                    <tr key={unit.id} className="text-center">
                                                        <td className="p-8 border border-black text-left text-3xl font-medium">{unit.name}</td>
                                                        <td className="p-8 border border-black text-4xl font-bold">{previewData.unitCounts[unit.id] || 0}</td>
                                                    </tr>
                                                ))}
                                                <tr className="text-center font-bold bg-gray-100">
                                                    <td className="p-8 border border-black text-left text-5xl">TOTAL OBRA</td>
                                                    <td className="p-8 border border-black text-5xl">
                                                        {previewData.units.reduce((sum: number, unit: any) => sum + (previewData.unitCounts[unit.id] || 0), 0)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="text-center pt-8 border-t-4 border-gray-300">
                                    <span className="text-8xl font-black uppercase">TOTAL GERAL | </span>
                                    <span className="text-8xl font-black">
                                        {previewData.accommodations.reduce((sum: number, acc: any) => sum + (previewData.accommodationCounts[acc.id] || 0), 0) +
                                            previewData.units.reduce((sum: number, unit: any) => sum + (previewData.unitCounts[unit.id] || 0), 0) +
                                            (previewData.adicionais || []).reduce((sum: number, ad: any) => sum + (ad.quantidade_marmita || 0), 0)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {previewType === "dds" && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 mb-8 border-b pb-4">
                                    <img src={previewData.systemLogo || "/logo.png"} alt="Logo" className="w-28 h-28 object-contain" />
                                    <div>
                                        <h1 className="text-3xl font-bold text-gray-900">Relatório DDS</h1>
                                        <p className="text-lg text-gray-600">Emitido em: {previewData.reportDate ? new Date(previewData.reportDate + 'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                                <table className="w-full text-xl border-collapse">
                                    <thead>
                                        <tr className="bg-indigo-600 text-white">
                                            <th className="p-6 text-left text-2xl">Colaboradores</th>
                                            <th className="p-6 text-center text-2xl" style={{ width: '250px' }}>Assinatura</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.employees.map((e: any) => (
                                            <tr key={e.id}>
                                                <td className="p-4 border border-black">{e.full_name}</td>
                                                <td className="p-4 border border-black" style={{ width: '250px' }}></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {previewType === "integration" && (
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-blue-600 text-white">
                                        <th className="p-2 whitespace-nowrap">Chegada à Obra</th>
                                        <th className="p-2 whitespace-nowrap">Data Integração</th>
                                        <th className="p-2 text-left whitespace-nowrap">Colaborador</th>
                                        <th className="p-2 whitespace-nowrap">Função</th>
                                        <th className="p-2 whitespace-nowrap">Tam.</th>
                                        <th className="p-2 whitespace-nowrap">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.employees.map((emp: any) => (
                                        <tr key={emp.id} className="text-center">
                                            <td className="p-2 border border-black whitespace-nowrap">{emp.arrival_date ? new Date(emp.arrival_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}</td>
                                            <td className="p-2 border border-black whitespace-nowrap">{emp.integration_date ? new Date(emp.integration_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}</td>
                                            <td className="p-2 border border-black text-left whitespace-nowrap">{emp.full_name}</td>
                                            <td className="p-2 border border-black whitespace-nowrap">{previewData.functions.find((f: any) => f.id === emp.function_id)?.name || "-"}</td>
                                            <td className="p-2 border border-black whitespace-nowrap">{emp.tamanho_marmita || "-"}</td>
                                            <td className="p-2 border border-black whitespace-nowrap">{previewData.statusMap.get(emp.status_id) || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
