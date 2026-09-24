"use client";

import { useState, useEffect, useMemo } from "react";
import axiosInstance from "@/lib/axios";
import {
  Coins, Plus, Search, Edit2, Trash2, CheckCircle2,
  Calendar, Users, Calculator, Sliders, ShieldCheck,
  AlertCircle, HelpCircle, ArrowRight, Loader2,
  TrendingUp, Percent, Sparkles, Filter, X,
  Clock, Award, RefreshCw, Check, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface ComponentTrigger {
  id?: number;
  trigger_type: 'recurring_monthly' | 'fixed_calendar_date' | 'date_range' | 'employee_anniversary' | 'manual';
  config?: any;
}

interface ComponentAssignment {
  id?: number;
  is_global: boolean;
  role_id?: number | null;
  user_id?: number | null;
  custom_amount?: number | null;
  role?: { id: number; name: string };
  user?: { id: number; name: string; email?: string };
}

interface PayrollComponent {
  id: number;
  company_id: number;
  name: string;
  code: string;
  type: 'earning' | 'deduction';
  calculation_rule: 'fixed' | 'attendance' | 'percentage' | 'formula' | 'adhoc';
  default_amount: number | string;
  percentage_value?: number | string | null;
  percentage_basis?: string | null;
  formula_expression?: string | null;
  is_taxable: boolean;
  is_active: boolean;
  description?: string | null;
  triggers?: ComponentTrigger[];
  assignments?: ComponentAssignment[];
}

export default function PayrollComponentsPage() {
  const { t } = useLanguage();
  const [components, setComponents] = useState<PayrollComponent[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "earning" | "deduction">("all");
  const [ruleFilter, setRuleFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<PayrollComponent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'basic' | 'rule' | 'trigger' | 'assignment'>('basic');

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    type: 'earning' | 'deduction';
    calculation_rule: 'fixed' | 'attendance' | 'percentage' | 'formula' | 'adhoc';
    default_amount: number | string;
    percentage_value: number | string;
    percentage_basis: string;
    formula_expression: string;
    is_taxable: boolean;
    is_active: boolean;
    description: string;
    trigger_type: 'recurring_monthly' | 'fixed_calendar_date' | 'date_range' | 'employee_anniversary' | 'manual';
    trigger_config: any;
    assignment_type: 'global' | 'role' | 'users';
    role_id: string;
    user_ids: number[];
  }>({
    name: "",
    code: "",
    type: "earning",
    calculation_rule: "fixed",
    default_amount: 0,
    percentage_value: 0,
    percentage_basis: "basic_salary",
    formula_expression: "",
    is_taxable: true,
    is_active: true,
    description: "",
    trigger_type: "recurring_monthly",
    trigger_config: {},
    assignment_type: "global",
    role_id: "",
    user_ids: [],
  });

  // Simulator for Formula
  const [simContext, setSimContext] = useState({
    basic_salary: 5000000,
    attendance_days: 20,
    total_working_days: 22,
    absent_days: 0,
    overtime_hours: 5,
    late_minutes: 15,
    tenure_years: 2,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [compRes, rolesRes, empRes] = await Promise.all([
        axiosInstance.get("/payroll/components"),
        axiosInstance.get("/roles").catch(() => ({ data: { data: [] } })),
        axiosInstance.get("/employees?per_page=1000").catch(() => ({ data: { data: { data: [] } } })),
      ]);

      setComponents(compRes.data.data || []);
      setRoles(rolesRes.data.data || []);
      const emps = empRes.data.data?.data || empRes.data.data || [];
      setEmployees(emps);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal memuat komponen gaji");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingComponent(null);
    setFormData({
      name: "",
      code: "",
      type: "earning",
      calculation_rule: "fixed",
      default_amount: 0,
      percentage_value: 0,
      percentage_basis: "basic_salary",
      formula_expression: "",
      is_taxable: true,
      is_active: true,
      description: "",
      trigger_type: "recurring_monthly",
      trigger_config: {},
      assignment_type: "global",
      role_id: "",
      user_ids: [],
    });
    setActiveModalTab("basic");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (comp: PayrollComponent) => {
    setEditingComponent(comp);

    const primaryTrigger = comp.triggers?.[0];
    const assignments = comp.assignments || [];
    let assignmentType: 'global' | 'role' | 'users' = 'global';
    let roleId = "";
    let userIds: number[] = [];

    const roleAssignment = assignments.find(a => a.role_id);
    const userAssignments = assignments.filter(a => a.user_id);
    const hasGlobal = assignments.some(a => a.is_global);

    if (roleAssignment) {
      assignmentType = 'role';
      roleId = String(roleAssignment.role_id);
    } else if (userAssignments.length > 0) {
      assignmentType = 'users';
      userIds = userAssignments.map(a => a.user_id as number);
    } else {
      assignmentType = 'global';
    }

    setFormData({
      name: comp.name,
      code: comp.code || "",
      type: comp.type,
      calculation_rule: comp.calculation_rule,
      default_amount: comp.default_amount || 0,
      percentage_value: comp.percentage_value || 0,
      percentage_basis: comp.percentage_basis || "basic_salary",
      formula_expression: comp.formula_expression || "",
      is_taxable: !!comp.is_taxable,
      is_active: !!comp.is_active,
      description: comp.description || "",
      trigger_type: primaryTrigger?.trigger_type || "recurring_monthly",
      trigger_config: primaryTrigger?.config || {},
      assignment_type: assignmentType,
      role_id: roleId,
      user_ids: userIds,
    });
    setActiveModalTab("basic");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nama komponen wajib diisi.");
      return;
    }

    const payload: any = {
      name: formData.name,
      code: formData.code || formData.name.toUpperCase().replace(/[^A-Z0-9]/g, "_").substring(0, 30),
      type: formData.type,
      calculation_rule: formData.calculation_rule,
      default_amount: Number(formData.default_amount) || 0,
      percentage_value: Number(formData.percentage_value) || 0,
      percentage_basis: formData.percentage_basis,
      formula_expression: formData.formula_expression,
      is_taxable: formData.is_taxable,
      is_active: formData.is_active,
      description: formData.description,
      triggers: [
        {
          trigger_type: formData.trigger_type,
          config: formData.trigger_config,
        },
      ],
      assignment_type: formData.assignment_type,
      role_id: formData.assignment_type === 'role' ? Number(formData.role_id) : null,
      user_ids: formData.assignment_type === 'users' ? formData.user_ids : [],
    };

    setSubmitting(true);
    try {
      if (editingComponent) {
        await axiosInstance.put(`/payroll/components/${editingComponent.id}`, payload);
        toast.success("Komponen gaji berhasil diperbarui.");
      } else {
        await axiosInstance.post("/payroll/components", payload);
        toast.success("Komponen gaji baru berhasil ditambahkan.");
      }
      setIsModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan komponen gaji.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (comp: PayrollComponent) => {
    if (!window.confirm(`Hapus komponen "${comp.name}"? Riwayat payslip sebelumnya tetap tersimpan aman karena snapshot immutable.`)) {
      return;
    }

    try {
      await axiosInstance.delete(`/payroll/components/${comp.id}`);
      toast.success("Komponen berhasil dihapus.");
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus komponen.");
    }
  };

  const handleToggleActive = async (comp: PayrollComponent) => {
    try {
      await axiosInstance.put(`/payroll/components/${comp.id}`, {
        is_active: !comp.is_active,
      });
      toast.success(`Komponen ${comp.is_active ? "dinonaktifkan" : "diaktifkan"}.`);
      setComponents(prev => prev.map(c => c.id === comp.id ? { ...c, is_active: !c.is_active } : c));
    } catch (err: any) {
      toast.error("Gagal mengubah status aktif.");
    }
  };

  // Safe client-side calculation preview for formula simulator
  const simulatedFormulaResult = useMemo(() => {
    if (formData.calculation_rule !== 'formula' || !formData.formula_expression) return null;
    try {
      let expr = formData.formula_expression;
      expr = expr.replace(/\{basic_salary\}/g, String(simContext.basic_salary));
      expr = expr.replace(/\{attendance_days\}/g, String(simContext.attendance_days));
      expr = expr.replace(/\{total_working_days\}/g, String(simContext.total_working_days));
      expr = expr.replace(/\{absent_days\}/g, String(simContext.absent_days));
      expr = expr.replace(/\{overtime_hours\}/g, String(simContext.overtime_hours));
      expr = expr.replace(/\{late_minutes\}/g, String(simContext.late_minutes));
      expr = expr.replace(/\{tenure_years\}/g, String(simContext.tenure_years));

      // Quick syntax safety check: allow only digits, parentheses, +, -, *, /, ., space
      if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
        return "Format ekspresi belum valid (hanya gunakan variabel dan +, -, *, /, ())";
      }
      // eslint-disable-next-line no-eval
      const res = Function(`'use strict'; return (${expr})`)();
      return isNaN(res) ? "Tidak valid" : `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(res))}`;
    } catch (e) {
      return "Format belum lengkap";
    }
  }, [formData.calculation_rule, formData.formula_expression, simContext]);

  // Filtered Components
  const filteredComponents = useMemo(() => {
    return components.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchType = typeFilter === "all" || c.type === typeFilter;
      const matchRule = ruleFilter === "all" || c.calculation_rule === ruleFilter;
      return matchSearch && matchType && matchRule;
    });
  }, [components, searchQuery, typeFilter, ruleFilter]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: components.length,
      active: components.filter(c => c.is_active).length,
      earnings: components.filter(c => c.type === 'earning' && c.is_active).length,
      deductions: components.filter(c => c.type === 'deduction' && c.is_active).length,
      automated: components.filter(c => {
        const trig = c.triggers?.[0]?.trigger_type;
        return trig && trig !== 'manual';
      }).length,
    };
  }, [components]);

  const formatRupiah = (num: any) => {
    const val = Number(num) || 0;
    return new Intl.NumberFormat('id-ID').format(val);
  };

  const getRuleBadge = (rule: string) => {
    switch (rule) {
      case 'fixed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Nominal Tetap</span>;
      case 'attendance':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Kehadiran (Absensi)</span>;
      case 'percentage':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">Persentase (%)</span>;
      case 'formula':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Rumus Kustom (Formula)</span>;
      case 'adhoc':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">Fleksibel / Ad-Hoc</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded">{rule}</span>;
    }
  };

  const getTriggerBadge = (triggers?: ComponentTrigger[]) => {
    const trigger = triggers?.[0]?.trigger_type || 'recurring_monthly';
    switch (trigger) {
      case 'recurring_monthly':
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg"><CheckCircle2 size={12} /> Bulanan Rutin</span>;
      case 'fixed_calendar_date':
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg"><Calendar size={12} /> Tanggal Tertentu</span>;
      case 'date_range':
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg"><Clock size={12} /> Rentang Tanggal</span>;
      case 'employee_anniversary':
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg"><Award size={12} /> Masa Kerja (Anniversary)</span>;
      case 'manual':
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg"><Sliders size={12} /> Manual / Draft</span>;
      default:
        return <span className="text-xs text-gray-500">{trigger}</span>;
    }
  };

  const getAssignmentText = (assignments?: ComponentAssignment[]) => {
    if (!assignments || assignments.length === 0) return "Semua Karyawan (Global)";
    const hasGlobal = assignments.some(a => a.is_global);
    if (hasGlobal) return "Semua Karyawan (Global)";

    const roleAssignment = assignments.find(a => a.role_id);
    if (roleAssignment) {
      return `Jabatan: ${roleAssignment.role?.name || `Role #${roleAssignment.role_id}`}`;
    }

    const userCount = assignments.filter(a => a.user_id).length;
    if (userCount > 0) {
      return `${userCount} Karyawan Spesifik`;
    }

    return "Semua Karyawan (Global)";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      {/* ═══ Header Section ═══ */}
      <div className="dash-page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="dash-page-title">Komponen Gaji & Variabel</h1>
            <span className="bg-[#8B0000]/10 text-[#8B0000] text-xs font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
              Agnostic Multi-Tenant
            </span>
          </div>
          <p className="dash-page-desc mt-1">
            Konfigurasi tunjangan, potongan kustom, formula kalkulasi dinamis, serta pemicu kalender otomatis sesuai regulasi perusahaan Anda.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchInitialData}
            disabled={loading}
            className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all"
            title="Segarkan Data"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 h-12 bg-[#8B0000] hover:bg-[#720000] text-white rounded-2xl font-bold shadow-lg shadow-red-950/20 transition-all active:scale-[0.98]"
          >
            <Plus size={18} />
            <span>Tambah Komponen</span>
          </button>
        </div>
      </div>

      {/* ═══ Metric Summary Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Coins size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Komponen Aktif</div>
            <div className="text-2xl font-black text-gray-900 mt-0.5">{stats.active} <span className="text-sm font-semibold text-gray-400">/ {stats.total}</span></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tunjangan (Earnings)</div>
            <div className="text-2xl font-black text-emerald-600 mt-0.5">{stats.earnings}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Percent size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Potongan (Deductions)</div>
            <div className="text-2xl font-black text-rose-600 mt-0.5">{stats.deductions}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Otomasi Trigger</div>
            <div className="text-2xl font-black text-purple-600 mt-0.5">{stats.automated}</div>
          </div>
        </div>
      </div>

      {/* ═══ Filter & Search Controls ═══ */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Cari nama atau kode komponen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#8B0000]/20 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Type Filter */}
          <div className="flex bg-gray-100 p-1 rounded-2xl">
            <button
              onClick={() => setTypeFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                typeFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Semua Tipe
            </button>
            <button
              onClick={() => setTypeFilter("earning")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                typeFilter === "earning" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-emerald-700"
              }`}
            >
              Pendapatan (+)
            </button>
            <button
              onClick={() => setTypeFilter("deduction")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                typeFilter === "deduction" ? "bg-rose-600 text-white shadow-sm" : "text-gray-500 hover:text-rose-700"
              }`}
            >
              Potongan (-)
            </button>
          </div>

          {/* Rule Filter */}
          <select
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="h-10 bg-gray-50 border-none rounded-2xl px-3 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#8B0000]/20 outline-none cursor-pointer"
          >
            <option value="all">Semua Metode Hitung</option>
            <option value="fixed">Nominal Tetap</option>
            <option value="attendance">Kehadiran (Absensi)</option>
            <option value="percentage">Persentase (%)</option>
            <option value="formula">Rumus (Formula)</option>
            <option value="adhoc">Ad-Hoc / Variabel</option>
          </select>
        </div>
      </div>

      {/* ═══ Component Table ═══ */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-[#8B0000]" size={36} />
            <p className="text-gray-400 font-medium text-sm">Memuat komponen penggajian...</p>
          </div>
        ) : filteredComponents.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3">
              <Coins size={32} />
            </div>
            <h3 className="text-base font-bold text-gray-800">Tidak ada komponen ditemukan</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
              Buat komponen gaji baru seperti Tunjangan Komunikasi, Uang Transport, Bonus Tahunan, atau Potongan Koperasi.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-5 px-5 py-2.5 bg-[#8B0000] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#700000] transition-all"
            >
              + Tambah Komponen Baru
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/70 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest pl-8">Komponen</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipe & Aturan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nominal / Rumus</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pemicu (Trigger)</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Penerima</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">PPh 21</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredComponents.map((comp) => {
                  const isEarning = comp.type === "earning";
                  return (
                    <tr key={comp.id} className="hover:bg-gray-50/60 transition-colors group">
                      <td className="px-6 py-4 pl-8">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                              isEarning ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            }`}
                          >
                            {isEarning ? "+" : "-"}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block text-sm">{comp.name}</span>
                            <span className="text-[11px] font-mono text-gray-400 block mt-0.5 tracking-wider uppercase">
                              {comp.code}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isEarning ? "bg-emerald-100/60 text-emerald-700" : "bg-rose-100/60 text-rose-700"
                            }`}
                          >
                            {isEarning ? "Pendapatan" : "Potongan"}
                          </span>
                          <div>{getRuleBadge(comp.calculation_rule)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {comp.calculation_rule === 'fixed' && (
                          <span className="text-sm font-bold text-gray-800">
                            Rp {formatRupiah(comp.default_amount)}
                          </span>
                        )}
                        {comp.calculation_rule === 'attendance' && (
                          <div>
                            <span className="text-sm font-bold text-gray-800">
                              Rp {formatRupiah(comp.default_amount)}
                            </span>
                            <span className="text-[11px] text-gray-400 block">/ hari kehadiran</span>
                          </div>
                        )}
                        {comp.calculation_rule === 'percentage' && (
                          <div>
                            <span className="text-sm font-black text-purple-700">
                              {comp.percentage_value}%
                            </span>
                            <span className="text-[11px] text-gray-400 block">
                              dari {comp.percentage_basis === 'basic_salary' ? 'Gaji Pokok' : 'Gross'}
                            </span>
                          </div>
                        )}
                        {comp.calculation_rule === 'formula' && (
                          <div className="max-w-[220px]" title={comp.formula_expression || ""}>
                            <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 block truncate">
                              {comp.formula_expression}
                            </code>
                          </div>
                        )}
                        {comp.calculation_rule === 'adhoc' && (
                          <span className="text-xs italic text-gray-500 font-medium">Diinput saat periode payroll</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getTriggerBadge(comp.triggers)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-gray-600 block">
                          {getAssignmentText(comp.assignments)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {comp.is_taxable ? (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            Kena Pajak
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            Non-Pajak
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleActive(comp)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            comp.is_active ? "bg-emerald-500" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              comp.is_active ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(comp)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Edit Komponen"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(comp)}
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="Hapus Komponen"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ Create / Edit Modal ═══ */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[850px] max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-xl font-black text-gray-900">
                  {editingComponent ? "Edit Komponen Penggajian" : "Buat Komponen Penggajian Baru"}
                </h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  Atur cara hitung, pemicu otomatisasi, dan target penerima komponen ini.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex px-8 border-b border-gray-100 bg-gray-50/50 shrink-0 gap-6">
              {[
                { id: 'basic', label: '1. Info Dasar', icon: Coins },
                { id: 'rule', label: '2. Metode Hitung', icon: Calculator },
                { id: 'trigger', label: '3. Jadwal & Trigger', icon: Calendar },
                { id: 'assignment', label: '4. Penerima', icon: Users },
              ].map((tItem) => {
                const Icon = tItem.icon;
                const active = activeModalTab === tItem.id;
                return (
                  <button
                    key={tItem.id}
                    type="button"
                    onClick={() => setActiveModalTab(tItem.id as any)}
                    className={`flex items-center gap-2 py-3.5 font-bold text-xs border-b-2 transition-all ${
                      active
                        ? "border-[#8B0000] text-[#8B0000]"
                        : "border-transparent text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    <Icon size={15} />
                    {tItem.label}
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* TAB 1: BASIC INFO */}
              {activeModalTab === 'basic' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                        Nama Komponen <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            name: val,
                            code: prev.code ? prev.code : val.toUpperCase().replace(/[^A-Z0-9]/g, "_").substring(0, 30),
                          }));
                        }}
                        placeholder="Contoh: Tunjangan Makan, Bonus Loyalitas"
                        className="w-full h-12 bg-gray-50 border-none rounded-2xl px-4 font-semibold text-gray-900 focus:ring-2 focus:ring-[#8B0000]/20 outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                        Kode Komponen (Unik)
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))}
                        placeholder="Contoh: TUNJ_MAKAN"
                        className="w-full h-12 bg-gray-50 border-none rounded-2xl px-4 font-mono font-bold text-gray-700 uppercase focus:ring-2 focus:ring-[#8B0000]/20 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                        Tipe Komponen <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, type: 'earning' }))}
                          className={`h-12 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                            formData.type === 'earning'
                              ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <TrendingUp size={16} />
                          Pendapatan (+)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, type: 'deduction' }))}
                          className={`h-12 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                            formData.type === 'deduction'
                              ? "bg-rose-50 border-rose-500 text-rose-700 shadow-sm"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <Percent size={16} />
                          Potongan (-)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                        Objek PPh 21
                      </label>
                      <label className="flex items-center gap-3 h-12 bg-gray-50 px-4 rounded-2xl cursor-pointer border border-transparent hover:border-gray-200">
                        <input
                          type="checkbox"
                          checked={formData.is_taxable}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_taxable: e.target.checked }))}
                          className="w-5 h-5 rounded text-[#8B0000] focus:ring-[#8B0000]"
                        />
                        <span className="text-xs font-bold text-gray-700">
                          Termasuk dalam Kalkulasi Penghasilan Kena Pajak (PPh 21)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                      Deskripsi / Catatan Peraturan Perusahaan
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Jelaskan dasar pemberian atau aturan potongan ini (opsional)..."
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-medium text-gray-800 focus:ring-2 focus:ring-[#8B0000]/20 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: CALCULATION RULE */}
              {activeModalTab === 'rule' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                      Pilih Metode Kalkulasi <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { id: 'fixed', title: 'Nominal Tetap', desc: 'Nilai rupiah pasti setiap bulan' },
                        { id: 'attendance', title: 'Per Kehadiran', desc: 'Dikalikan jumlah hari hadir' },
                        { id: 'percentage', title: 'Persentase (%)', desc: 'Dihitung % dari gaji pokok/gross' },
                        { id: 'formula', title: 'Formula Kustom', desc: 'Rumus matematika logika fleksibel' },
                        { id: 'adhoc', title: 'Ad-Hoc / Variabel', desc: 'Diinput manual saat draft penggajian' },
                      ].map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setFormData(prev => ({ ...prev, calculation_rule: item.id as any }))}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                            formData.calculation_rule === item.id
                              ? "border-[#8B0000] bg-red-50/40 shadow-sm"
                              : "border-gray-100 bg-gray-50/50 hover:bg-gray-100"
                          }`}
                        >
                          <div className="font-bold text-xs text-gray-900">{item.title}</div>
                          <div className="text-[11px] text-gray-400 mt-1 leading-snug">{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rule Specific Fields */}
                  {formData.calculation_rule === 'fixed' && (
                    <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-2">
                      <label className="text-xs font-black text-blue-900 uppercase tracking-wider">
                        Nominal Rupiah (Rp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formData.default_amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, default_amount: e.target.value }))}
                        className="w-full h-12 bg-white border border-blue-200 rounded-xl px-4 font-bold text-lg text-gray-900 focus:ring-2 focus:ring-blue-400 outline-none"
                        placeholder="Contoh: 500000"
                      />
                      <p className="text-[11px] text-blue-600 font-medium">
                        Nominal ini akan otomatis masuk ke payslip setiap periode aktif.
                      </p>
                    </div>
                  )}

                  {formData.calculation_rule === 'attendance' && (
                    <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
                      <label className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                        Nominal Per Hari Hadir (Rp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formData.default_amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, default_amount: e.target.value }))}
                        className="w-full h-12 bg-white border border-emerald-200 rounded-xl px-4 font-bold text-lg text-gray-900 focus:ring-2 focus:ring-emerald-400 outline-none"
                        placeholder="Contoh: 25000"
                      />
                      <p className="text-[11px] text-emerald-700 font-medium">
                        Total didapat dari: (Hari Hadir Aktual) × (Nominal di atas).
                      </p>
                    </div>
                  )}

                  {formData.calculation_rule === 'percentage' && (
                    <div className="p-5 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-purple-900 uppercase tracking-wider">
                            Persentase (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            value={formData.percentage_value}
                            onChange={(e) => setFormData(prev => ({ ...prev, percentage_value: e.target.value }))}
                            className="w-full h-12 bg-white border border-purple-200 rounded-xl px-4 font-bold text-lg text-gray-900 focus:ring-2 focus:ring-purple-400 outline-none"
                            placeholder="Contoh: 5"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-purple-900 uppercase tracking-wider">
                            Dihitung Dari Basis
                          </label>
                          <select
                            value={formData.percentage_basis}
                            onChange={(e) => setFormData(prev => ({ ...prev, percentage_basis: e.target.value }))}
                            className="w-full h-12 bg-white border border-purple-200 rounded-xl px-4 font-bold text-sm text-gray-800 focus:ring-2 focus:ring-purple-400 outline-none"
                          >
                            <option value="basic_salary">Gaji Pokok (Basic Salary)</option>
                            <option value="gross_salary">Total Pendapatan Kotor (Gross)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.calculation_rule === 'formula' && (
                    <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-amber-900 uppercase tracking-wider">
                            Ekspresi Rumus Formula
                          </label>
                          <span className="text-[11px] text-amber-700 font-medium">
                            Klik chip variabel di bawah untuk menambahkan ke rumus
                          </span>
                        </div>
                        <input
                          type="text"
                          value={formData.formula_expression}
                          onChange={(e) => setFormData(prev => ({ ...prev, formula_expression: e.target.value }))}
                          placeholder="Contoh: (basic_salary / 22) * attendance_days * 0.1"
                          className="w-full h-12 bg-white border border-amber-300 rounded-xl px-4 font-mono font-bold text-sm text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>

                      {/* Variable Helper Pills */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                          Variabel Yang Tersedia:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: "{basic_salary}", label: "Gaji Pokok" },
                            { key: "{attendance_days}", label: "Hari Hadir" },
                            { key: "{total_working_days}", label: "Hari Kerja Bulan Ini" },
                            { key: "{absent_days}", label: "Hari Alfa" },
                            { key: "{overtime_hours}", label: "Jam Lembur" },
                            { key: "{late_minutes}", label: "Menit Telat" },
                            { key: "{tenure_years}", label: "Masa Kerja (Tahun)" },
                          ].map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                formula_expression: prev.formula_expression
                                  ? `${prev.formula_expression} ${v.key}`
                                  : v.key
                              }))}
                              className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-mono font-bold shadow-xs transition-colors"
                            >
                              + {v.key} <span className="font-sans font-normal text-[10px] text-amber-700">({v.label})</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Interactive Formula Tester */}
                      <div className="p-4 bg-white rounded-xl border border-amber-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-amber-500" />
                            Simulasi Hasil Rumus:
                          </span>
                          <span className="text-sm font-black text-[#8B0000]">
                            {simulatedFormulaResult || "Rp 0"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-gray-100">
                          <div>
                            <label className="text-[10px] text-gray-400 font-bold block">Gaji Pokok</label>
                            <input
                              type="number"
                              value={simContext.basic_salary}
                              onChange={(e) => setSimContext(prev => ({ ...prev, basic_salary: Number(e.target.value) }))}
                              className="w-full h-8 bg-gray-50 rounded px-2 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 font-bold block">Hari Hadir</label>
                            <input
                              type="number"
                              value={simContext.attendance_days}
                              onChange={(e) => setSimContext(prev => ({ ...prev, attendance_days: Number(e.target.value) }))}
                              className="w-full h-8 bg-gray-50 rounded px-2 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 font-bold block">Hari Efektif</label>
                            <input
                              type="number"
                              value={simContext.total_working_days}
                              onChange={(e) => setSimContext(prev => ({ ...prev, total_working_days: Number(e.target.value) }))}
                              className="w-full h-8 bg-gray-50 rounded px-2 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 font-bold block">Masa Kerja (Thn)</label>
                            <input
                              type="number"
                              value={simContext.tenure_years}
                              onChange={(e) => setSimContext(prev => ({ ...prev, tenure_years: Number(e.target.value) }))}
                              className="w-full h-8 bg-gray-50 rounded px-2 text-xs font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.calculation_rule === 'adhoc' && (
                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="text-gray-500" size={18} />
                        <span className="text-xs font-bold text-gray-800">Komponen Ad-Hoc / Variabel Fleksibel</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed font-medium">
                        Komponen ini dapat ditambahkan kapan saja secara manual saat Anda meninjau Draft Payroll di halaman Persetujuan Payroll.
                      </p>
                      <div className="pt-2">
                        <label className="text-xs font-bold text-gray-700 block mb-1">Nominal Default (Opsional):</label>
                        <input
                          type="number"
                          value={formData.default_amount}
                          onChange={(e) => setFormData(prev => ({ ...prev, default_amount: e.target.value }))}
                          className="w-full md:w-64 h-11 bg-white border border-gray-300 rounded-xl px-4 font-bold text-sm"
                          placeholder="Rp 0"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: TRIGGER ENGINE */}
              {activeModalTab === 'trigger' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                      Kapan Komponen Ini Otomatis Diberikan?
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        {
                          id: 'recurring_monthly',
                          title: 'Otomatis Tiap Bulan (Rutin)',
                          desc: 'Dihitung setiap kali periode payroll bulanan dibuat (Default).',
                          icon: CheckCircle2,
                        },
                        {
                          id: 'fixed_calendar_date',
                          title: 'Tanggal Kalender Tertentu',
                          desc: 'Hanya aktif pada bulan/tanggal spesifik (e.g. Bonus 17 Agustus, THR).',
                          icon: Calendar,
                        },
                        {
                          id: 'date_range',
                          title: 'Rentang Tanggal Khusus',
                          desc: 'Aktif bila tanggal payroll berada di antara rentang tanggal.',
                          icon: Clock,
                        },
                        {
                          id: 'employee_anniversary',
                          title: 'Ulang Tahun Masa Kerja (Anniversary)',
                          desc: 'Diberikan saat masa kerja karyawan genap bertambah (e.g. 1 tahun, 5 tahun).',
                          icon: Award,
                        },
                        {
                          id: 'manual',
                          title: 'Manual Saja',
                          desc: 'Hanya dimasukkan saat HRD memilih secara manual.',
                          icon: Sliders,
                        },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = formData.trigger_type === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => setFormData(prev => ({ ...prev, trigger_type: item.id as any }))}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                              isSelected
                                ? "border-[#8B0000] bg-red-50/40 shadow-sm"
                                : "border-gray-100 bg-gray-50/50 hover:bg-gray-100"
                            }`}
                          >
                            <div className={`p-2 rounded-xl mt-0.5 ${isSelected ? "bg-[#8B0000] text-white" : "bg-white text-gray-400"}`}>
                              <Icon size={16} />
                            </div>
                            <div>
                              <div className="font-bold text-xs text-gray-900">{item.title}</div>
                              <div className="text-[11px] text-gray-400 mt-1 leading-snug">{item.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Trigger Configs */}
                  {formData.trigger_type === 'fixed_calendar_date' && (
                    <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
                      <div className="font-bold text-xs text-blue-900">Konfigurasi Tanggal & Bulan Kalender</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-blue-800 block mb-1">Bulan</label>
                          <select
                            value={formData.trigger_config?.month || 8}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              trigger_config: { ...prev.trigger_config, month: Number(e.target.value) }
                            }))}
                            className="w-full h-11 bg-white border border-blue-200 rounded-xl px-3 font-bold text-xs"
                          >
                            {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m, idx) => (
                              <option key={idx + 1} value={idx + 1}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-blue-800 block mb-1">Hari / Tanggal (1-31)</label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={formData.trigger_config?.day || 17}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              trigger_config: { ...prev.trigger_config, day: Number(e.target.value) }
                            }))}
                            className="w-full h-11 bg-white border border-blue-200 rounded-xl px-3 font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.trigger_type === 'date_range' && (
                    <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
                      <div className="font-bold text-xs text-amber-900">Konfigurasi Rentang Tanggal</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-amber-800 block mb-1">Tanggal Mulai</label>
                          <input
                            type="date"
                            value={formData.trigger_config?.start_date || ""}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              trigger_config: { ...prev.trigger_config, start_date: e.target.value }
                            }))}
                            className="w-full h-11 bg-white border border-amber-200 rounded-xl px-3 font-bold text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-amber-800 block mb-1">Tanggal Selesai</label>
                          <input
                            type="date"
                            value={formData.trigger_config?.end_date || ""}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              trigger_config: { ...prev.trigger_config, end_date: e.target.value }
                            }))}
                            className="w-full h-11 bg-white border border-amber-200 rounded-xl px-3 font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.trigger_type === 'employee_anniversary' && (
                    <div className="p-5 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-3">
                      <div className="font-bold text-xs text-purple-900">Konfigurasi Ulang Tahun Masa Kerja</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-purple-800 block mb-1">Minimal Masa Kerja (Tahun)</label>
                          <input
                            type="number"
                            min={1}
                            value={formData.trigger_config?.min_tenure_years || 1}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              trigger_config: { ...prev.trigger_config, min_tenure_years: Number(e.target.value) }
                            }))}
                            className="w-full h-11 bg-white border border-purple-200 rounded-xl px-3 font-bold text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-purple-800 block mb-1">Diberikan Di Bulan Join Saja?</label>
                          <select
                            value={formData.trigger_config?.exact_anniversary_month ? "yes" : "no"}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              trigger_config: { ...prev.trigger_config, exact_anniversary_month: e.target.value === "yes" }
                            }))}
                            className="w-full h-11 bg-white border border-purple-200 rounded-xl px-3 font-bold text-xs"
                          >
                            <option value="yes">Hanya di bulan ulang tahun kerja</option>
                            <option value="no">Setiap bulan setelah memenuhi masa kerja</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: ASSIGNMENT */}
              {activeModalTab === 'assignment' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                      Siapa Yang Berhak Menerima Komponen Ini?
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'global', title: 'Seluruh Karyawan', desc: 'Berlaku otomatis ke semua pegawai perusahaan ini' },
                        { id: 'role', title: 'Berdasarkan Jabatan (Role)', desc: 'Berlaku hanya untuk role tertentu' },
                        { id: 'users', title: 'Karyawan Spesifik', desc: 'Pilih satu per satu nama karyawan' },
                      ].map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setFormData(prev => ({ ...prev, assignment_type: item.id as any }))}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                            formData.assignment_type === item.id
                              ? "border-[#8B0000] bg-red-50/40 shadow-sm"
                              : "border-gray-100 bg-gray-50/50 hover:bg-gray-100"
                          }`}
                        >
                          <div className="font-bold text-xs text-gray-900">{item.title}</div>
                          <div className="text-[11px] text-gray-400 mt-1 leading-snug">{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {formData.assignment_type === 'role' && (
                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                      <label className="text-xs font-black text-gray-700 uppercase tracking-wider">
                        Pilih Jabatan / Role Target
                      </label>
                      <select
                        value={formData.role_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, role_id: e.target.value }))}
                        className="w-full h-12 bg-white border border-gray-300 rounded-xl px-4 font-bold text-sm text-gray-800 focus:ring-2 focus:ring-[#8B0000]/20 outline-none"
                      >
                        <option value="">-- Pilih Role --</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.assignment_type === 'users' && (
                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-gray-700 uppercase tracking-wider">
                          Pilih Karyawan ({formData.user_ids.length} dipilih)
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, user_ids: [] }))}
                          className="text-[11px] text-red-600 hover:underline font-bold"
                        >
                          Reset Pilihan
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1 bg-white p-3 rounded-xl border border-gray-200">
                        {employees.map((emp) => {
                          const isSelected = formData.user_ids.includes(emp.id);
                          return (
                            <label
                              key={emp.id}
                              className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                                isSelected ? "bg-red-50 text-[#8B0000] font-bold" : "hover:bg-gray-50 text-gray-700"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData(prev => ({ ...prev, user_ids: [...prev.user_ids, emp.id] }));
                                    } else {
                                      setFormData(prev => ({ ...prev, user_ids: prev.user_ids.filter(id => id !== emp.id) }));
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-[#8B0000] focus:ring-[#8B0000]"
                                />
                                <span className="text-xs font-semibold">{emp.name}</span>
                              </div>
                              <span className="text-[11px] text-gray-400 font-mono">{emp.department || emp.email}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {activeModalTab !== 'basic' && (
                    <button
                      type="button"
                      onClick={() => {
                        const tabs: ('basic' | 'rule' | 'trigger' | 'assignment')[] = ['basic', 'rule', 'trigger', 'assignment'];
                        const prevIdx = tabs.indexOf(activeModalTab) - 1;
                        if (prevIdx >= 0) setActiveModalTab(tabs[prevIdx]);
                      }}
                      className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      ← Kembali
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {activeModalTab !== 'assignment' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const tabs: ('basic' | 'rule' | 'trigger' | 'assignment')[] = ['basic', 'rule', 'trigger', 'assignment'];
                        const nextIdx = tabs.indexOf(activeModalTab) + 1;
                        if (nextIdx < tabs.length) setActiveModalTab(tabs[nextIdx]);
                      }}
                      className="px-6 h-11 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                      Lanjut Langkah Berikutnya →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-8 h-12 bg-[#8B0000] hover:bg-[#720000] text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-red-950/20 flex items-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      {editingComponent ? "Simpan Perubahan Komponen" : "Buat Komponen Penggajian"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
