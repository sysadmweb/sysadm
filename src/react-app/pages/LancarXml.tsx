import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { supabase } from "@/react-app/supabase";
import { Upload, Save, Loader2 } from "lucide-react";

interface ParsedItem {
    code: string;
    name: string;
    quantity: number;
    unit_value: number;
    total_value: number;
}

interface ParsedInvoice {
    number: string;
    series: string;
    issuer_name: string;
    issuer_tax_id: string;
    issue_date: string;
    access_key: string;
    xml_content: string;
    code: string;
    total_value: number;
    items: ParsedItem[];
}

export default function LancarXml() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const editId = searchParams.get("id");
    const [parsedInvoice, setParsedInvoice] = useState<ParsedInvoice | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

    useEffect(() => {
        if (editId) {
            fetchInvoice(editId);
        }
    }, [editId]);

    const fetchInvoice = async (id: string) => {
        setIsLoading(true);
        try {
            const { data: invoice, error } = await supabase
                .from("invoices")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;

            const { data: items, error: itemsError } = await supabase
                .from("invoice_items")
                .select("*")
                .eq("invoice_id", id);

            if (itemsError) throw itemsError;

            setParsedInvoice({
                number: invoice.number,
                series: invoice.series || "",
                issuer_name: invoice.issuer_name,
                issuer_tax_id: invoice.issuer_tax_id,
                issue_date: invoice.issue_date || "",
                access_key: invoice.access_key || "",
                xml_content: invoice.xml_content || "",
                code: invoice.code || "",
                total_value: invoice.total_value || 0,
                items: items.map((i) => ({
                    code: i.product_code,
                    name: i.product_name,
                    quantity: i.quantity,
                    unit_value: i.unit_value,
                    total_value: i.total_value,
                })),
            });
        } catch (error) {
            console.error("Error fetching invoice:", error);
            showToast("Erro ao carregar nota fiscal", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const showToast = (text: string, kind: "success" | "error") => {
        setToast({ text, kind });
        setTimeout(() => setToast(null), 3000);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            parseXml(content);
        };
        reader.readAsText(file);
    };

    const parseXml = (xmlText: string) => {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            const ns = xmlDoc.getElementsByTagName("infNFe")[0]?.getAttribute("Id") || "";
            const accessKey = ns.replace("NFe", "");

            const ide = xmlDoc.getElementsByTagName("ide")[0];
            const emit = xmlDoc.getElementsByTagName("emit")[0];
            const dets = xmlDoc.getElementsByTagName("det");

            if (!ide || !emit) {
                showToast("XML inválido: Falta dados da nota ou emitente", "error");
                return;
            }

            const number = ide.getElementsByTagName("nNF")[0]?.textContent || "";
            const series = ide.getElementsByTagName("serie")[0]?.textContent || "";
            const issue_date = ide.getElementsByTagName("dhEmi")[0]?.textContent || "";
            const code = ide.getElementsByTagName("cNF")[0]?.textContent || "";
            const issuer_name = emit.getElementsByTagName("xNome")[0]?.textContent || "";
            const issuer_tax_id = emit.getElementsByTagName("CNPJ")[0]?.textContent || "";

            const total = xmlDoc.getElementsByTagName("ICMSTot")[0];
            const total_value = parseFloat(total?.getElementsByTagName("vNF")[0]?.textContent || "0");

            const items: ParsedItem[] = [];
            for (let i = 0; i < dets.length; i++) {
                const prod = dets[i].getElementsByTagName("prod")[0];
                if (prod) {
                    items.push({
                        code: prod.getElementsByTagName("cProd")[0]?.textContent || "",
                        name: prod.getElementsByTagName("xProd")[0]?.textContent || "",
                        quantity: parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || "0"),
                        unit_value: parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || "0"),
                        total_value: parseFloat(prod.getElementsByTagName("vProd")[0]?.textContent || "0"),
                    });
                }
            }

            setParsedInvoice({
                number,
                series,
                issuer_name,
                issuer_tax_id,
                issue_date,
                access_key: accessKey,
                xml_content: xmlText,
                code,
                total_value,
                items,
            });
            showToast("XML lido com sucesso", "success");
        } catch (error) {
            console.error("Error parsing XML:", error);
            showToast("Erro ao ler arquivo XML", "error");
        }
    };

    const handleSave = async () => {
        if (!parsedInvoice) return;
        setIsLoading(true);

        try {
            // 1. Create or Update Invoice
            let invoiceId = editId ? parseInt(editId) : 0;

            if (editId) {
                const { error: updateError } = await supabase
                    .from("invoices")
                    .update({
                        number: parsedInvoice.number,
                        series: parsedInvoice.series,
                        issuer_name: parsedInvoice.issuer_name,
                        issuer_tax_id: parsedInvoice.issuer_tax_id,
                        issue_date: parsedInvoice.issue_date,
                        access_key: parsedInvoice.access_key,
                        xml_content: parsedInvoice.xml_content,
                        code: parsedInvoice.code,
                        total_value: parsedInvoice.total_value,
                    })
                    .eq("id", invoiceId);

                if (updateError) throw updateError;

                // Delete existing items to recreate them (simplest way to handle updates)
                await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
            } else {
                const { data: invoiceData, error: invoiceError } = await supabase
                    .from("invoices")
                    .insert({
                        number: parsedInvoice.number,
                        series: parsedInvoice.series,
                        issuer_name: parsedInvoice.issuer_name,
                        issuer_tax_id: parsedInvoice.issuer_tax_id,
                        issue_date: parsedInvoice.issue_date,
                        access_key: parsedInvoice.access_key,
                        xml_content: parsedInvoice.xml_content,
                        code: parsedInvoice.code,
                        total_value: parsedInvoice.total_value,
                    })
                    .select()
                    .single();

                if (invoiceError) {
                    if (invoiceError.code === "23505") {
                        showToast("Nota fiscal já importada (Chave de acesso duplicada)", "error");
                    } else {
                        showToast("Erro ao salvar nota fiscal: " + invoiceError.message, "error");
                    }
                    setIsLoading(false);
                    return;
                }
                invoiceId = invoiceData.id;
            }

            // 2. Process Items
            for (const item of parsedInvoice.items) {
                // Check if product exists
                const { data: existingProduct } = await supabase
                    .from("products")
                    .select("id, quantity, unit_value")
                    .eq("code", item.code)
                    .single();

                let productId: number;

                if (existingProduct) {
                    // Update existing product
                    const newQuantity = Number(existingProduct.quantity) + Number(item.quantity);
                    // Optional: Update unit value to the latest one or average? Requirement says "sum quantity and value", assuming value means total value or just updating unit value.
                    // Let's update unit_value to the latest one.
                    const { data: updatedProduct, error: updateError } = await supabase
                        .from("products")
                        .update({
                            quantity: newQuantity,
                            unit_value: item.unit_value,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", existingProduct.id)
                        .select()
                        .single();

                    if (updateError) throw updateError;
                    productId = updatedProduct.id;
                } else {
                    // Create new product
                    const { data: newProduct, error: createError } = await supabase
                        .from("products")
                        .insert({
                            code: item.code,
                            name: item.name,
                            quantity: item.quantity,
                            unit_value: item.unit_value,
                        })
                        .select()
                        .single();

                    if (createError) throw createError;
                    productId = newProduct.id;
                }

                // Create Invoice Item
                await supabase.from("invoice_items").insert({
                    invoice_id: invoiceId,
                    product_id: productId,
                    product_code: item.code,
                    product_name: item.name,
                    quantity: item.quantity,
                    unit_value: item.unit_value,
                    total_value: item.total_value,
                });
            }

            showToast(editId ? "Nota fiscal atualizada!" : "Nota fiscal importada com sucesso!", "success");
            if (editId) {
                navigate("/purchases/view");
            } else {
                setParsedInvoice(null);
            }
        } catch (error) {
            console.error("Error saving invoice:", error);
            showToast("Erro ao processar importação", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {toast && (
                <div
                    className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${toast.kind === "success"
                        ? "bg-green-500/10 border border-green-500/50 text-green-400"
                        : "bg-red-500/10 border border-red-500/50 text-red-400"
                        }`}
                >
                    {toast.text}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">
                        {editId ? "Editar Nota Fiscal" : "Lançar XML"}
                    </h1>
                    <p className="text-slate-400 mt-1">
                        {editId ? "Edite os dados da nota fiscal" : "Importe notas fiscais via arquivo XML"}
                    </p>
                </div>
            </div>

            {/* Upload Area */}
            {!parsedInvoice && (
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-12 flex flex-col items-center justify-center text-center border-dashed border-2 border-slate-700 hover:border-blue-500/50 transition-colors">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Upload className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-200 mb-2">
                        Arraste e solte ou clique para selecionar
                    </h3>
                    <p className="text-slate-400 mb-6">Suporta apenas arquivos XML de NFe</p>
                    <input
                        type="file"
                        accept=".xml"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="xml-upload"
                    />
                    <label
                        htmlFor="xml-upload"
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg cursor-pointer transition-colors font-medium"
                    >
                        Selecionar Arquivo
                    </label>
                </div>
            )}

            {/* Parsed Data Preview */}
            {parsedInvoice && (
                <div className="space-y-6">
                    {/* Header Info */}
                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-sm text-slate-400">Número / Série</label>
                                <p className="text-lg font-medium text-slate-200">
                                    {parsedInvoice.number} - {parsedInvoice.series}
                                </p>
                            </div>
                            <div>
                                <label className="text-sm text-slate-400">Emitente</label>
                                <p className="text-lg font-medium text-slate-200">
                                    {parsedInvoice.issuer_name}
                                </p>
                                <p className="text-sm text-slate-500">{parsedInvoice.issuer_tax_id}</p>
                            </div>
                            <div>
                                <label className="text-sm text-slate-400">Data de Emissão</label>
                                <p className="text-lg font-medium text-slate-200">
                                    {new Date(parsedInvoice.issue_date).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-200">Itens da Nota</h3>
                            <span className="text-sm text-slate-400">
                                {parsedInvoice.items.length} itens encontrados
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Código</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Produto</th>
                                        <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Qtd</th>
                                        <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Vl. Unit</th>
                                        <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {parsedInvoice.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 text-slate-400 font-mono text-sm">
                                                <input
                                                    type="text"
                                                    value={item.code}
                                                    onChange={(e) => {
                                                        const newItems = [...parsedInvoice.items];
                                                        newItems[idx].code = e.target.value;
                                                        setParsedInvoice({ ...parsedInvoice, items: newItems });
                                                    }}
                                                    className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none w-full"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-slate-200">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => {
                                                        const newItems = [...parsedInvoice.items];
                                                        newItems[idx].name = e.target.value;
                                                        setParsedInvoice({ ...parsedInvoice, items: newItems });
                                                    }}
                                                    className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none w-full"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-300">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const newItems = [...parsedInvoice.items];
                                                        newItems[idx].quantity = parseFloat(e.target.value);
                                                        newItems[idx].total_value = newItems[idx].quantity * newItems[idx].unit_value;
                                                        setParsedInvoice({ ...parsedInvoice, items: newItems });
                                                    }}
                                                    className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none w-20 text-right"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-300">
                                                <input
                                                    type="number"
                                                    value={item.unit_value}
                                                    onChange={(e) => {
                                                        const newItems = [...parsedInvoice.items];
                                                        newItems[idx].unit_value = parseFloat(e.target.value);
                                                        newItems[idx].total_value = newItems[idx].quantity * newItems[idx].unit_value;
                                                        setParsedInvoice({ ...parsedInvoice, items: newItems });
                                                    }}
                                                    className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none w-24 text-right"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-300 font-medium">
                                                {item.total_value.toLocaleString("pt-BR", {
                                                    style: "currency",
                                                    currency: "BRL",
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 justify-end">
                        <button
                            onClick={() => setParsedInvoice(null)}
                            className="px-6 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all font-medium"
                            disabled={isLoading}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg shadow-green-500/20 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            Confirmar Importação
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
