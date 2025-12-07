import { useState, useRef } from "react";
import { supabase } from "@/react-app/supabase";
import { Employee, Unit, Accommodation, Function } from "@/shared/types";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { FileDown, Loader2, Utensils, Clock, Users, Share2, X, Coffee, Sun, Moon, UserCircle } from "lucide-react";
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
    created_at: string;
};

export default function Reports() {
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

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchUserUnits = async () => {
        const isSuper = currentUser?.is_super_user;
        let unitIds: number[] = [];
        if (!isSuper && currentUser?.id) {
            const { data: links } = await supabase
                .from("user_units")
                .select("unit_id")
                .eq("user_id", currentUser.id);
            unitIds = Array.isArray(links) ? (links as { unit_id: number }[]).map((l) => l.unit_id) : [];
        }
        return { isSuper, unitIds };
    };

    // --- Data Fetchers ---

    const fetchJornadaData = async () => {
        const { isSuper, unitIds } = await fetchUserUnits();
        const [empRes, logsRes, unitsRes] = await Promise.all([
            supabase.from("employees").select("id, full_name, unit_id").eq("is_active", true).order("full_name"),
            supabase.from("work_logs").select("*").order("work_date", { ascending: false }),
            supabase.from("units").select("id, name").eq("is_active", true)
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
        const [empRes, unitsRes, funcsRes] = await Promise.all([
            supabase.from("employees").select("*").eq("is_active", true),
            supabase.from("units").select("*").eq("is_active", true),
            supabase.from("functions").select("*").eq("is_active", true)
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

        const activeEmployees = employees.filter(e => e.arrival_date && !e.departure_date);
        return { employees: activeEmployees, units, functions };
    };

    const fetchMarmitasData = async () => {
        const { isSuper, unitIds } = await fetchUserUnits();

        // Get status IDs for "AGUARDANDO INTEGRAÇÃO" and "TRABALHANDO DISPONIVEL"
        const { data: statusData } = await supabase
            .from("statuses")
            .select("id, name")
            .in("name", ["AGUARDANDO INTEGRAÇÃO", "TRABALHANDO DISPONIVEL"]);

        if (!statusData || statusData.length === 0) {
            throw new Error("Statuses not found");
        }

        const statusIds = statusData.map(s => s.id);

        const [accRes, empRes] = await Promise.all([
            supabase.from("accommodations").select("*").eq("is_active", true),
            supabase.from("employees")
                .select("accommodation_id")
                .eq("is_active", true)
                .not("accommodation_id", "is", null)
                .in("status_id", statusIds)
        ]);

        if (accRes.error) throw accRes.error;
        if (empRes.error) throw empRes.error;

        let accommodations = accRes.data as Accommodation[] || [];
        const employees = empRes.data as { accommodation_id: number }[] || [];

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

        // Filter accommodations to show only those with at least 1 employee
        const accommodationsWithEmployees = accommodations.filter(acc => (employeeCounts[acc.id] || 0) > 0);

        return { accommodations: accommodationsWithEmployees, employeeCounts };
    };

    const fetchCafeDaManhaData = async () => {
        return await fetchMarmitasData();
    };

    const fetchIntegrationData = async () => {
        const { isSuper, unitIds } = await fetchUserUnits();

        // Get status ID for "AGUARDANDO INTEGRAÇÃO"
        const { data: statusData } = await supabase
            .from("statuses")
            .select("id")
            .eq("name", "AGUARDANDO INTEGRAÇÃO")
            .single();

        if (!statusData) throw new Error("Status 'AGUARDANDO INTEGRAÇÃO' not found");

        const [empRes, funcsRes, statusRes] = await Promise.all([
            supabase.from("employees")
                .select("id, full_name, arrival_date, integration_date, function_id, status_id, unit_id")
                .eq("is_active", true)
                .eq("status_id", statusData.id),
            supabase.from("functions").select("id, name").eq("is_active", true),
            supabase.from("statuses").select("id, name").eq("is_active", true)
        ]);

        if (empRes.error) throw empRes.error;
        if (funcsRes.error) throw funcsRes.error;
        if (statusRes.error) throw statusRes.error;

        let employees = empRes.data as Employee[] || [];
        const functions = funcsRes.data as Function[] || [];
        const statuses = statusRes.data as any[] || [];

        if (!isSuper && unitIds.length > 0) {
            employees = employees.filter(e => unitIds.includes(e.unit_id));
        } else if (!isSuper && unitIds.length === 0) {
            employees = [];
        }

        return { employees, functions, statuses };
    };

    // --- PDF Generators ---

    const generateJornadaPDF = async (data: any) => {
        const { employees, workLogs, units } = data;
        if (workLogs.length === 0) {
            showToast("Nenhum registro encontrado.", "error");
            return;
        }

        const doc = new jsPDF();
        const logoUrl = "/logo.png";
        const groupedLogs: Record<number, WorkLog[]> = {};
        workLogs.forEach((log: WorkLog) => {
            if (!groupedLogs[log.employee_id]) groupedLogs[log.employee_id] = [];
            groupedLogs[log.employee_id].push(log);
        });
        const employeeIds = Object.keys(groupedLogs).map(Number);

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
            if (index > 0) doc.addPage();
            const employee = employees.find((e: Employee) => e.id === empId);
            const unit = units.find((u: Unit) => u.id === employee?.unit_id);
            const logs = groupedLogs[empId].sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());

            if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
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
                styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [200, 200, 200], lineWidth: 0.1 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center' },
                columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
            });
        });
        doc.save("relatorio_jornada.pdf");
    };

    const generateEmployeesPDF = async (data: any) => {
        const { employees, units, functions } = data;
        if (employees.length === 0) {
            showToast("Nenhum colaborador ativo.", "error");
            return;
        }

        const doc = new jsPDF();
        const logoUrl = "/logo.png";
        const groupedEmployees: Record<number, Employee[]> = {};
        employees.forEach((emp: Employee) => {
            if (!groupedEmployees[emp.unit_id]) groupedEmployees[emp.unit_id] = [];
            groupedEmployees[emp.unit_id].push(emp);
        });
        const unitIdsToPrint = Object.keys(groupedEmployees).map(Number);

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

        unitIdsToPrint.forEach((unitId, index) => {
            if (index > 0) doc.addPage();
            const unit = units.find((u: Unit) => u.id === unitId);
            const unitEmployees = groupedEmployees[unitId].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

            if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
            doc.setFontSize(18);
            doc.text("LISTA DE COLABORADORES", 50, 20);
            doc.setFontSize(11);
            const startX = 50;
            let currentY = 30;
            const lineHeight = 6;

            doc.text(`Obra: ${unit?.name || "-"}`, startX, currentY);
            currentY += lineHeight;
            doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, startX, currentY);

            autoTable(doc, {
                startY: 50,
                head: [["CHEGADA À OBRA", "COLABORADOR", "FUNÇÃO"]],
                body: unitEmployees.map(emp => [
                    emp.arrival_date ? new Date(emp.arrival_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-",
                    emp.full_name || "-",
                    functions.find((f: Function) => f.id === emp.function_id)?.name || "-"
                ]),
                theme: 'grid',
                styles: { fontSize: 8, halign: 'center', valign: 'middle', lineColor: [200, 200, 200], lineWidth: 0.1 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center' },
                columnStyles: { 0: { halign: 'center' }, 1: { halign: 'left' }, 2: { halign: 'center' } },
            });
        });
        doc.save("lista_colaboradores.pdf");
    };

    const generateMarmitasPDF = async (data: any) => {
        const { accommodations, employeeCounts } = data;
        if (accommodations.length === 0) {
            showToast("Nenhum alojamento encontrado.", "error");
            return;
        }

        const doc = new jsPDF();
        const logoUrl = "/logo.png";
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

        if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
        doc.setFontSize(18);
        doc.text("Relatório de Marmitas", 50, 20);
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
            head: [["ALOJAMENTO", "MARMITAS"]],
            body,
            startY: 45,
            theme: 'grid',
            styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [200, 200, 200], lineWidth: 0.1 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center' },
            columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
            didParseCell: (data: any) => {
                if (data.row.index === body.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            },
        });
        doc.save("relatorio-marmitas.pdf");
    };

    const generateCafeDaManhaPDF = async (data: any) => {
        const { accommodations, employeeCounts } = data;
        if (accommodations.length === 0) {
            showToast("Nenhum alojamento encontrado.", "error");
            return;
        }

        const doc = new jsPDF();
        const logoUrl = "/logo.png";
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
            styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: [200, 200, 200], lineWidth: 0.1 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center' },
            columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
            didParseCell: (data: any) => {
                if (data.row.index === body.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            },
        });
        doc.save("relatorio-cafe-da-manha.pdf");
    };



    const generateIntegrationPDF = async (data: any) => {
        const { employees, functions, statuses } = data;
        if (employees.length === 0) {
            showToast("Nenhum colaborador aguardando integração.", "error");
            return;
        }

        const doc = new jsPDF();
        const date = new Date().toLocaleDateString("pt-BR");

        doc.setFontSize(16);
        doc.text("Relatório de Integração", 14, 20);
        doc.setFontSize(10);
        doc.text(`Data de Emissão: ${date}`, 14, 28);

        const tableData = employees.map((emp: Employee) => [
            emp.arrival_date ? new Date(emp.arrival_date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-",
            emp.integration_date ? new Date(emp.integration_date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-",
            emp.full_name,
            functions.find((f: Function) => f.id === emp.function_id)?.name || "-",
            statuses.find((s: any) => s.id === emp.status_id)?.name || "-",
        ]);

        autoTable(doc, {
            startY: 35,
            head: [["CHEGADA Á OBRA", "DATA INTEGRAÇÃO", "COLABORADOR", "FUNÇÃO", "STATUS"]],
            body: tableData,
            styles: { fontSize: 7, cellPadding: 1 },
            headStyles: { fillColor: [41, 128, 185] },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 'auto' },
                4: { cellWidth: 'auto' }
            }
        });

        doc.save("relatorio_integracao.pdf");
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
                data = await fetchEmployeesData();
                await generateEmployeesPDF(data);
            } else if (selectedReport === "marmitas") {
                data = await fetchMarmitasData();
                await generateMarmitasPDF(data);
            } else if (selectedReport === "cafe-da-manha") {
                data = await fetchCafeDaManhaData();
                await generateCafeDaManhaPDF(data);
            } else if (selectedReport === "integration") {
                data = await fetchIntegrationData();
                await generateIntegrationPDF(data);
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

    const handleShareJPEG = async () => {
        if (!selectedReport) return;
        setLoadingReport(selectedReport);
        try {
            // 1. Fetch Data
            let data;
            if (selectedReport === "jornada") data = await fetchJornadaData();
            else if (selectedReport === "employees") data = await fetchEmployeesData();
            else if (selectedReport === "marmitas") data = await fetchMarmitasData();
            else if (selectedReport === "cafe-da-manha") data = await fetchCafeDaManhaData();
            else if (selectedReport === "integration") data = await fetchIntegrationData();

            // 2. Set Preview Data & Type (triggers render)
            setPreviewData(data);
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
                link.download = `relatorio_${selectedReport}.jpg`;
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

    const handleMealJPEG = async (mealType: "almoco" | "janta") => {
        if (!selectedReport) return;
        if (!reportDate) {
            showToast("Por favor, selecione uma data.", "error");
            return;
        }
        setLoadingReport(selectedReport + "-" + mealType);
        try {
            // 1. Fetch Data
            let data;
            if (selectedReport === "marmitas") data = await fetchMarmitasData();
            else if (selectedReport === "cafe-da-manha") data = await fetchCafeDaManhaData();

            // 2. Set Preview Data & Type with meal type and date
            setPreviewData({ ...data, mealType, reportDate });
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
                const reportName = selectedReport === "marmitas" ? "marmitas" : "cafe-da-manha";
                link.download = `relatorio_${reportName}_${mealType}.jpg`;
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

    const handleCafeDaManhaDirectJPEG = async () => {
        if (!reportDate) {
            showToast("Por favor, selecione uma data.", "error");
            return;
        }
        setLoadingReport("cafe-da-manha");
        try {
            // 1. Fetch Data
            const data = await fetchCafeDaManhaData();

            // 2. Set Preview Data & Type with date
            setPreviewData({ ...data, reportDate });
            setPreviewType("cafe-da-manha");

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
                link.download = `relatorio_cafe-da-manha.jpg`;
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
            description: "Lista de colaboradores aguardando integração.",
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
        }
    ];

    return (
        <div className="space-y-6">
            {toast && (
                <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"}`}>
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

                        {/* Date input for Café da Manhã */}
                        {report.id === "cafe-da-manha" && (
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
                                if (report.id === "cafe-da-manha") {
                                    handleCafeDaManhaDirectJPEG();
                                } else {
                                    setSelectedReport(report.id);
                                }
                            }}
                            disabled={loadingReport === "cafe-da-manha" && report.id === "cafe-da-manha"}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700"
                        >
                            {loadingReport === "cafe-da-manha" && report.id === "cafe-da-manha" ? (
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
                            onClick={() => setSelectedReport(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-2">
                            {reports.find(r => r.id === selectedReport)?.title}
                        </h3>

                        {/* Show Almoço/Janta buttons only for marmitas */}
                        {selectedReport === "marmitas" ? (
                            <>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Data do Relatório *</label>
                                    <input
                                        type="date"
                                        value={reportDate}
                                        onChange={(e) => setReportDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                        required
                                    />
                                </div>
                                <p className="text-slate-400 text-sm mb-6">Escolha o tipo de refeição:</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleMealJPEG("almoco")}
                                        disabled={loadingReport !== null}
                                        className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                    >
                                        {loadingReport === selectedReport + "-almoco" ? (
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
                                        {loadingReport === selectedReport + "-janta" ? (
                                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                                        ) : (
                                            <Moon className="w-8 h-8 text-indigo-400" />
                                        )}
                                        <span className="text-slate-200 font-medium">Janta</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-slate-400 text-sm mb-6">Escolha o formato para exportação:</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={handleDownloadPDF}
                                        disabled={loadingReport !== null}
                                        className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                    >
                                        {loadingReport === selectedReport ? (
                                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                                        ) : (
                                            <FileDown className="w-8 h-8 text-blue-400" />
                                        )}
                                        <span className="text-slate-200 font-medium">Download (PDF)</span>
                                    </button>

                                    <button
                                        onClick={handleShareJPEG}
                                        disabled={loadingReport !== null}
                                        className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                                    >
                                        {loadingReport === selectedReport ? (
                                            <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
                                        ) : (
                                            <Share2 className="w-8 h-8 text-green-400" />
                                        )}
                                        <span className="text-slate-200 font-medium">Compartilhar (JPEG)</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Hidden Preview Area for HTML2Canvas */}
            <div style={{ position: "absolute", left: "-9999px", top: 0 }} className={`${previewType === "cafe-da-manha" || previewType === "marmitas" ? "w-[1600px]" : "w-[1200px]"} bg-white text-black ${previewType === "cafe-da-manha" || previewType === "marmitas" ? "p-12" : "p-8"}`} ref={previewRef}>
                {previewData && (
                    <div className="space-y-6">
                        {/* Header for non-marmitas reports */}
                        {previewType !== "marmitas" && (
                            <div className="flex items-center gap-4 mb-8 border-b pb-4">
                                <img src="/logo.png" alt="Logo" className={previewType === "cafe-da-manha" ? "w-32 h-32 object-contain" : "w-20 h-20 object-contain"} />
                                <div>
                                    <h1 className={previewType === "cafe-da-manha" ? "text-4xl font-bold text-gray-900" : "text-2xl font-bold text-gray-900"}>
                                        {previewType === "jornada" && "Relatório de Jornada"}
                                        {previewType === "employees" && "Lista de Colaboradores"}
                                        {previewType === "cafe-da-manha" && "Relatório de Café da Manhã"}
                                        {previewType === "integration" && "Relatório de Integração"}
                                    </h1>
                                    <p className={previewType === "cafe-da-manha" ? "text-xl text-gray-500" : "text-gray-500"}>Emitido em: {previewData.reportDate ? new Date(previewData.reportDate + 'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                        )}

                        {/* Marmitas Report (Custom Header + Table) */}
                        {previewType === "marmitas" && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 mb-8 border-b pb-4">
                                    <img src="/logo.png" alt="Logo" className="w-32 h-32 object-contain" />
                                    <div>
                                        <h1 className="text-4xl font-bold text-gray-900">
                                            {previewData.mealType === "almoco" ? "Relatório de Almoço" : "Relatório de Janta"}
                                        </h1>
                                        <p className="text-xl text-gray-500">Emitido em: {previewData.reportDate ? new Date(previewData.reportDate + 'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>

                                <table className="w-full text-xl border-collapse border-2 border-gray-400">
                                    <thead>
                                        <tr className="bg-blue-600 text-white">
                                            <th className="p-6 border-2 border-gray-400 text-left text-2xl">Alojamento</th>
                                            <th className="p-6 border-2 border-gray-400 text-2xl">
                                                {previewData.mealType === "almoco" ? "Quantidade Almoço" : "Quantidade Janta"}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.accommodations.map((acc: any) => (
                                            <tr key={acc.id} className="text-center">
                                                <td className="p-6 border-2 border-gray-400 text-left text-xl">{acc.name}</td>
                                                <td className="p-6 border-2 border-gray-400 text-xl">{previewData.employeeCounts[acc.id] || 0}</td>
                                            </tr>
                                        ))}
                                        <tr className="text-center font-bold bg-gray-100">
                                            <td className="p-6 border-2 border-gray-400 text-left text-2xl">TOTAL</td>
                                            <td className="p-6 border-2 border-gray-400 text-2xl">
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
                                            <table className="w-full text-sm border-collapse border border-gray-300">
                                                <thead>
                                                    <tr className="bg-blue-600 text-white">
                                                        <th className="p-2 border border-gray-300">Data</th>
                                                        <th className="p-2 border border-gray-300">Entrada</th>
                                                        <th className="p-2 border border-gray-300">Saída Almoço</th>
                                                        <th className="p-2 border border-gray-300">Volta Almoço</th>
                                                        <th className="p-2 border border-gray-300">Saída</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {logs.map((log: any) => (
                                                        <tr key={log.id} className="text-center">
                                                            <td className="p-2 border border-gray-300">{new Date(log.work_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                                            <td className="p-2 border border-gray-300">{log.entry_time_1?.slice(0, 5) || "-"}</td>
                                                            <td className="p-2 border border-gray-300">{log.exit_time_1?.slice(0, 5) || "-"}</td>
                                                            <td className="p-2 border border-gray-300">{log.entry_time_2?.slice(0, 5) || "-"}</td>
                                                            <td className="p-2 border border-gray-300">{log.exit_time_2?.slice(0, 5) || "-"}</td>
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
                            <div className="space-y-8">
                                {Object.entries(previewData.employees.reduce((acc: any, emp: any) => {
                                    if (!acc[emp.unit_id]) acc[emp.unit_id] = [];
                                    acc[emp.unit_id].push(emp);
                                    return acc;
                                }, {})).map(([unitId, emps]: [string, any]) => {
                                    const unit = previewData.units.find((u: any) => u.id === Number(unitId));
                                    return (
                                        <div key={unitId} className="break-inside-avoid">
                                            <div className="mb-2 bg-gray-100 p-3 rounded">
                                                <p className="font-bold">Obra: {unit?.name}</p>
                                            </div>
                                            <table className="w-full text-sm border-collapse border border-gray-300">
                                                <thead>
                                                    <tr className="bg-blue-600 text-white">
                                                        <th className="p-2 border border-gray-300">Chegada</th>
                                                        <th className="p-2 border border-gray-300 text-left">Colaborador</th>
                                                        <th className="p-2 border border-gray-300">Função</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {emps.map((emp: any) => (
                                                        <tr key={emp.id} className="text-center">
                                                            <td className="p-2 border border-gray-300">{emp.arrival_date ? new Date(emp.arrival_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}</td>
                                                            <td className="p-2 border border-gray-300 text-left">{emp.full_name}</td>
                                                            <td className="p-2 border border-gray-300">{previewData.functions.find((f: any) => f.id === emp.function_id)?.name || "-"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {previewType === "cafe-da-manha" && (
                            <table className="w-full text-xl border-collapse border-2 border-gray-400">
                                <thead>
                                    <tr className="bg-blue-600 text-white">
                                        <th className="p-6 border-2 border-gray-400 text-left text-2xl">Alojamento</th>
                                        <th className="p-6 border-2 border-gray-400 text-2xl">Quantidade Café da Manhã</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.accommodations.map((acc: any) => (
                                        <tr key={acc.id} className="text-center">
                                            <td className="p-6 border-2 border-gray-400 text-left text-xl">{acc.name}</td>
                                            <td className="p-6 border-2 border-gray-400 text-xl">{previewData.employeeCounts[acc.id] || 0}</td>
                                        </tr>
                                    ))}
                                    <tr className="text-center font-bold bg-gray-100">
                                        <td className="p-6 border-2 border-gray-400 text-left text-2xl">TOTAL</td>
                                        <td className="p-6 border-2 border-gray-400 text-2xl">
                                            {previewData.accommodations.reduce((sum: number, acc: any) => sum + (previewData.employeeCounts[acc.id] || 0), 0)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}

                        {previewType === "integration" && (
                            <table className="w-full text-sm border-collapse border border-gray-300">
                                <thead>
                                    <tr className="bg-blue-600 text-white">
                                        <th className="p-2 border border-gray-300 whitespace-nowrap">Chegada à Obra</th>
                                        <th className="p-2 border border-gray-300 whitespace-nowrap">Data Integração</th>
                                        <th className="p-2 border border-gray-300 text-left whitespace-nowrap">Colaborador</th>
                                        <th className="p-2 border border-gray-300 whitespace-nowrap">Função</th>
                                        <th className="p-2 border border-gray-300 whitespace-nowrap">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.employees.map((emp: any) => (
                                        <tr key={emp.id} className="text-center">
                                            <td className="p-2 border border-gray-300 whitespace-nowrap">{emp.arrival_date ? new Date(emp.arrival_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}</td>
                                            <td className="p-2 border border-gray-300 whitespace-nowrap">{emp.integration_date ? new Date(emp.integration_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}</td>
                                            <td className="p-2 border border-gray-300 text-left whitespace-nowrap">{emp.full_name}</td>
                                            <td className="p-2 border border-gray-300 whitespace-nowrap">{previewData.functions.find((f: any) => f.id === emp.function_id)?.name || "-"}</td>
                                            <td className="p-2 border border-gray-300 whitespace-nowrap">{previewData.statuses.find((s: any) => s.id === emp.status_id)?.name || "-"}</td>
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
