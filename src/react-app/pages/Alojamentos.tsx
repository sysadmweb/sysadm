import { useEffect, useState } from "react";
import { Accommodation, Unit, Fornecedor } from "@/shared/types";
import { Plus, Edit, Trash2, Loader2, Home, Truck, X, Check } from "lucide-react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";

export default function Alojamentos() {
  const { user: currentUser } = useAuth();
  const [controlSuppliers, setControlSuppliers] = useState(false);
  const [accommodations, setAccommodations] = useState<(Accommodation & { linked_suppliers?: Fornecedor[] })[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Fornecedor[]>([]);
  const [employeeCounts, setEmployeeCounts] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSuppliersModal, setShowSuppliersModal] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
  const [formData, setFormData] = useState<{ name: string; unit_id: number; bed_count: number | string }>({
    name: "",
    unit_id: 0,
    bed_count: "",
  });
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [employeesForAccommodation, setEmployeesForAccommodation] = useState<{ id: number; full_name: string }[]>([]);
  const [selectedAccommodationForEmployees, setSelectedAccommodationForEmployees] = useState<Accommodation | null>(null);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [employeeMarks, setEmployeeMarks] = useState<Record<number, number>>({});

  const showToast = (text: string, kind: "success" | "error") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchConfig();
    fetchAccommodations();
    fetchUnits();
    fetchSuppliers();
    fetchEmployeeCounts();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from("config")
      .select("value")
      .eq("key", "control_suppliers")
      .single();
    if (data) setControlSuppliers((data as { value: string }).value === "true");
  };

  const fetchAccommodations = async () => {
    try {
      const isSuper = currentUser?.is_super_user;
      let unitIds: number[] = [];
      if (!isSuper && currentUser?.id) {
        const { data: links } = await supabase
          .from("usuarios_unidades")
          .select("unit_id")
          .eq("user_id", currentUser.id);
        unitIds = Array.isArray(links) ? (links as { unit_id: number }[]).map((l) => l.unit_id) : [];
      }
      const base = supabase
        .from("alojamentos")
        .select("id, name, unit_id, bed_count, is_active, created_at, updated_at")
        .eq("is_active", true);
      const { data, error } = isSuper || unitIds.length === 0 ? await base : await base.in("unit_id", unitIds);
      if (!error && Array.isArray(data)) {
        // Fetch linked suppliers for each accommodation
        const accoms = data as Accommodation[];
        const { data: pivotData } = await supabase
          .from("alojamentos_fornecedores")
          .select("alojamento_id, fornecedores(id, name, is_active, category_id, phone, responsible, observation, created_at, updated_at)");

        const suppliersByAccom: Record<number, Fornecedor[]> = {};
        if (pivotData) {
          (pivotData as any[]).forEach((row) => {
            if (!suppliersByAccom[row.alojamento_id]) suppliersByAccom[row.alojamento_id] = [];
            if (row.fornecedores) suppliersByAccom[row.alojamento_id].push(row.fornecedores as Fornecedor);
          });
        }
        setAccommodations(accoms.map((a) => ({ ...a, linked_suppliers: suppliersByAccom[a.id] || [] })));
      } else {
        setAccommodations([]);
      }
    } catch (error) {
      console.error("Error fetching accommodations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployeeCounts = async () => {
    try {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("accommodation_id")
        .eq("is_active", true)
        .not("accommodation_id", "is", null);
      if (!error && data) {
        const counts: Record<number, number> = {};
        data.forEach((emp) => {
          if (emp.accommodation_id) {
            counts[emp.accommodation_id] = (counts[emp.accommodation_id] || 0) + 1;
          }
        });
        setEmployeeCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching employee counts:", error);
    }
  };

  const fetchUnits = async () => {
    try {
      const isSuper = currentUser?.is_super_user;
      let unitIds: number[] = [];
      if (!isSuper && currentUser?.id) {
        const { data: links } = await supabase
          .from("usuarios_unidades")
          .select("unit_id")
          .eq("user_id", currentUser.id);
        unitIds = Array.isArray(links) ? (links as { unit_id: number }[]).map((l) => l.unit_id) : [];
      }
      const { data, error } = await supabase.from("unidades").select("id, name, is_active, created_at, updated_at");
      if (!error && Array.isArray(data)) {
        const list = (data as Unit[]).filter((u) => u.is_active);
        setUnits(isSuper ? list : list.filter((u) => unitIds.includes(u.id)));
      } else {
        setUnits([]);
      }
    } catch (error) {
      console.error("Error fetching units:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data } = await supabase.from("fornecedores").select("*").eq("is_active", true).order("name");
      if (data) setSuppliers(data as Fornecedor[]);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If supplier control is enabled, at least one supplier must be selected
    if (controlSuppliers && selectedSupplierIds.length === 0) {
      showToast("Selecione ao menos um fornecedor", "error");
      return;
    }

    try {
      const payload = {
        name: formData.name.toUpperCase(),
        unit_id: formData.unit_id,
        bed_count: Number(formData.bed_count) || 0,
      };

      let accommodationId: number | null = null;

      if (editingAccommodation) {
        const { error } = await supabase
          .from("alojamentos")
          .update(payload)
          .eq("id", editingAccommodation.id);
        if (error) { showToast("Falha ao salvar alojamento", "error"); return; }
        accommodationId = editingAccommodation.id;
        showToast("Alojamento atualizado", "success");
      } else {
        const { data, error } = await supabase
          .from("alojamentos")
          .insert({ ...payload, is_active: true })
          .select("id")
          .single();
        if (error || !data) { showToast("Falha ao cadastrar alojamento", "error"); return; }
        accommodationId = (data as { id: number }).id;
        showToast("Alojamento criado", "success");
      }

      // Update pivot table - delete old and re-insert
      if (accommodationId !== null) {
        await supabase.from("alojamentos_fornecedores").delete().eq("alojamento_id", accommodationId);
        if (selectedSupplierIds.length > 0) {
          await supabase.from("alojamentos_fornecedores").insert(
            selectedSupplierIds.map((sid) => ({ alojamento_id: accommodationId!, fornecedor_id: sid }))
          );
        }
      }

      setShowModal(false);
      setEditingAccommodation(null);
      setFormData({ name: "", unit_id: 0, bed_count: "" });
      setSelectedSupplierIds([]);
      fetchAccommodations();
    } catch (error) {
      console.error("Error saving accommodation:", error);
      showToast("Falha ao salvar alojamento", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja desativar este alojamento?")) return;
    try {
      const { error } = await supabase.from("alojamentos").update({ is_active: false }).eq("id", id);
      if (error) { showToast("Falha ao desativar alojamento", "error"); return; }
      showToast("Alojamento desativado", "success");
      fetchAccommodations();
    } catch (error) {
      console.error("Error deleting accommodation:", error);
      showToast("Falha ao desativar alojamento", "error");
    }
  };

  const openEditModal = (accommodation: Accommodation & { linked_suppliers?: Fornecedor[] }) => {
    setEditingAccommodation(accommodation);
    setFormData({ name: accommodation.name, unit_id: accommodation.unit_id, bed_count: accommodation.bed_count || 0 });
    setSelectedSupplierIds((accommodation.linked_suppliers || []).map((s) => s.id));
    setShowModal(true);
  };

  const openNewModal = () => {
    setEditingAccommodation(null);
    setFormData({ name: "", unit_id: units[0]?.id || 0, bed_count: "" });
    setSelectedSupplierIds([]);
    setShowModal(true);
  };

  const toggleSupplier = (id: number) => {
    setSelectedSupplierIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const openEmployeesModal = async (accommodation: Accommodation) => {
    try {
      setIsLoadingEmployees(true);
      setSelectedAccommodationForEmployees(accommodation);
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, full_name")
        .eq("is_active", true)
        .eq("accommodation_id", accommodation.id)
        .order("full_name");
      if (error) {
        showToast("Falha ao carregar colaboradores", "error");
        setEmployeesForAccommodation([]);
      } else {
        setEmployeesForAccommodation(Array.isArray(data) ? (data as { id: number; full_name: string }[]) : []);
      }
      setEmployeeMarks({});
      setShowEmployeesModal(true);
    } catch (error) {
      console.error("Error fetching employees for accommodation:", error);
      showToast("Erro ao carregar colaboradores", "error");
    } finally {
      setIsLoadingEmployees(false);
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
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-[100] ${toast.kind === "success" ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"}`}>
          {toast.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Alojamentos</h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Gerencie os alojamentos das unidades</p>
        </div>
        <button
          onClick={openNewModal}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Novo Alojamento
        </button>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-x-auto shadow-xl">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Nome</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Unidade</th>
              {controlSuppliers && (
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Fornecedores</th>
              )}
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Camas</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Funcionários</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Vagas Disponível</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {accommodations.map((accommodation) => (
              <tr
                key={accommodation.id}
                onClick={() => openEmployeesModal(accommodation)}
                className="hover:bg-slate-800/30 transition-colors cursor-pointer"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-green-400" />
                    <span className="text-slate-200 font-medium">{accommodation.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-300">
                  {units.find((u) => u.id === accommodation.unit_id)?.name || "-"}
                </td>
                {controlSuppliers && (
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(accommodation.linked_suppliers || []).length === 0 ? (
                        <span className="text-amber-400 text-xs font-medium">⚠ Sem fornecedor</span>
                      ) : (
                        (accommodation.linked_suppliers || []).map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-full">
                            <Truck className="w-3 h-3" />
                            {s.name}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                )}
                <td className="px-6 py-4 text-center text-slate-400">{accommodation.bed_count || 0}</td>
                <td className="px-6 py-4 text-center text-slate-400">{employeeCounts[accommodation.id] || 0}</td>
                <td className="px-6 py-4 text-center text-slate-400">
                  {(accommodation.bed_count || 0) - (employeeCounts[accommodation.id] || 0)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(accommodation); }}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(accommodation.id); }}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {accommodations.map((accommodation) => (
          <div
            key={accommodation.id}
            onClick={() => openEmployeesModal(accommodation)}
            className="bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 shadow-xl cursor-pointer hover:bg-slate-800/40 transition-colors"
            style={{ touchAction: "manipulation" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg">
                  <Home className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-slate-200 font-medium text-sm">{accommodation.name}</h3>
                  <p className="text-slate-400 text-xs">{units.find((u) => u.id === accommodation.unit_id)?.name || "-"}</p>
                  <p className="text-slate-500 text-xs mt-1">{accommodation.bed_count} camas</p>
                  {(accommodation.linked_suppliers || []).length > 0 && (
                    <p className="text-blue-400 text-xs mt-1">
                      {(accommodation.linked_suppliers || []).map((s) => s.name).join(", ")}
                    </p>
                  )}
                  <p className="text-slate-500 text-xs mt-1">
                    Vagas: {(accommodation.bed_count || 0) - (employeeCounts[accommodation.id] || 0)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditModal(accommodation); }}
                  className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(accommodation.id); }}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
              <span className="text-slate-400 text-xs">Funcionários</span>
              <span className="text-slate-200 font-medium text-sm">{employeeCounts[accommodation.id] || 0}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-slate-100 mb-4">
              {editingAccommodation ? "Editar Alojamento" : "Novo Alojamento"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome do Alojamento</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Unidade</label>
                <select
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                >
                  <option value="">Selecione uma unidade</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </div>

              {/* Suppliers Section - required when config is enabled */}
              {controlSuppliers && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Fornecedores
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSuppliersModal(true)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-400" />
                      {selectedSupplierIds.length === 0
                        ? "Nenhum fornecedor selecionado"
                        : `${selectedSupplierIds.length} fornecedor(es) selecionado(s)`}
                    </span>
                    <Plus className="w-4 h-4 text-slate-400" />
                  </button>
                  {selectedSupplierIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedSupplierIds.map((id) => {
                        const s = suppliers.find((sup) => sup.id === id);
                        return s ? (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-full">
                            {s.name}
                            <button type="button" onClick={() => toggleSupplier(id)}>
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Quantidade de Camas</label>
                <input
                  type="number"
                  value={formData.bed_count}
                  onChange={(e) => setFormData({ ...formData, bed_count: e.target.value === "" ? "" : parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="0"
                  required
                />
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
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suppliers Selection Modal */}
      {showSuppliersModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-100">Selecionar Fornecedores</h2>
              <button onClick={() => setShowSuppliersModal(false)} className="p-1 text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            {suppliers.length === 0 ? (
              <p className="text-slate-400 text-center py-6 text-sm">Nenhum fornecedor ativo cadastrado.</p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {suppliers.map((s) => {
                  const isSelected = selectedSupplierIds.includes(s.id);
                  return (
                    <li
                      key={s.id}
                      onClick={() => toggleSupplier(s.id)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors select-none ${isSelected
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-300"
                        : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                        }`}
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Truck className="w-4 h-4" />
                        {s.name}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              onClick={() => setShowSuppliersModal(false)}
              className="mt-4 w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
            >
              Confirmar ({selectedSupplierIds.length} selecionado{selectedSupplierIds.length !== 1 ? "s" : ""})
            </button>
          </div>
        </div>
      )}

      {/* Employees Modal */}
      {showEmployeesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-slate-100 mb-2">Colaboradores</h2>
            <p className="text-slate-400 text-sm mb-4">Alojamento: {selectedAccommodationForEmployees?.name || "-"}</p>
            {isLoadingEmployees ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : employeesForAccommodation.length === 0 ? (
              <div className="text-slate-400 text-center py-6">Nenhum colaborador vinculado</div>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {employeesForAccommodation.map((emp) => (
                  <li
                    key={emp.id}
                    onClick={() => setEmployeeMarks((prev) => ({ ...prev, [emp.id]: ((prev[emp.id] ?? 0) + 1) % 3 }))}
                    className={`px-3 py-2 rounded border text-sm cursor-pointer select-none transition-colors ${employeeMarks[emp.id] === 1
                      ? "bg-green-500/5 border-green-500/30 text-green-400"
                      : employeeMarks[emp.id] === 2
                        ? "bg-red-500/5 border-red-500/30 text-red-400"
                        : "bg-slate-800 border-slate-700 text-slate-200"
                      }`}
                  >
                    {emp.full_name}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => { setShowEmployeesModal(false); setEmployeeMarks({}); }}
                className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
