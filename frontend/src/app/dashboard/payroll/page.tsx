"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Search, Download, Eye, FileSpreadsheet, 
  DollarSign, Loader2, X, Printer, ArrowLeft,
  CheckCircle2, Clock, AlertTriangle,
  ChevronRight, Edit2, Trash2,
  Sparkles, Plus, Check, Play, RefreshCw,
  AlertCircle
} from "lucide-react";
import { PayrollSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";

interface UserInfo {
  id: number;
  name: string;
  email: string;
  department?: string;
}

interface PayslipDetailItem {
  id: number;
  salary_id: number;
  component_id?: number | null;
  component_name: string;
  type: 'earning' | 'deduction';
  calculation_rule: string;
  amount: number | string;
  note?: string | null;
  is_adhoc: boolean;
}

interface SalaryRecord {
  id: number;
  user_id: number;
  company_id: number;
  batch_id: number;
  month: string;
  year: number;
  basic_salary: string | number;
  department: string;
  working_days: number;
  total_working_days: number;
  earning_bpjs_kes_premium?: string | number;
  earning_attendance_allowance?: string | number;
  earning_overtime?: string | number;
  deduction_bpjs_jht?: string | number;
  deduction_bpjs_jp?: string | number;
  deduction_bpjs_kes?: string | number;
  deduction_absence?: string | number;
  deduction_late?: string | number;
  deduction_tax?: string | number;
  total_earnings: string | number;
  total_deductions: string | number;
  net_salary: string | number;
  bank_name: string;
  bank_account_no: string;
  cost_center: string;
  status: string;
  user?: UserInfo;
  details_records?: PayslipDetailItem[];
  detailsRecords?: PayslipDetailItem[];
}

interface PayrollBatch {
  id: number;
  company_id: number;
  period_month: string;
  period_year: number;
  total_employees: number;
  total_gross: string | number;
  total_deductions: string | number;
  total_net: string | number;
  status: string;
  created_at: string;
  created_by?: number;
  approved_by?: number;
  submitted_at?: string;
  approved_at?: string;
  salaries?: SalaryRecord[];
  creator?: { id: number; name: string };
  approver?: { id: number; name: string };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function parseAmount(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const parsed = Number.parseFloat(val);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatRupiah(val: string | number | undefined | null): string {
  return Math.round(parseAmount(val)).toLocaleString('id-ID');
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-full border border-emerald-200">
          <CheckCircle2 size={13} /> Selesai Dibayar
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-black rounded-full border border-blue-200">
          <CheckCircle2 size={13} /> Disetujui
        </span>
      );
    case 'pending_approval':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-black rounded-full border border-amber-200 animate-pulse">
          <Clock size={13} /> Menunggu Persetujuan
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-black rounded-full border border-rose-200">
          <AlertTriangle size={13} /> Perlu Revisi
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-black rounded-full border border-gray-200">
          <Edit2 size={13} /> Draft
        </span>
      );
  }
}

interface BatchTableContentProps {
  detailLoading: boolean;
  filteredBatches: PayrollBatch[];
  onOpenGenerate: () => void;
  onViewBatchDetails: (batchId: number) => void;
  onExportBatchRekap: (batchId: number, month: string, year: number) => void;
}

function BatchTableContent({
  detailLoading,
  filteredBatches,
  onOpenGenerate,
  onViewBatchDetails,
  onExportBatchRekap,
}: BatchTableContentProps) {
  if (detailLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="animate-spin text-[#8B0000]" size={36} />
        <p className="text-gray-400 font-medium text-sm">Membuka rincian periode payroll...</p>
      </div>
    );
  }

  if (filteredBatches.length === 0) {
    return (
      <div className="py-20 text-center px-4">
        <div className="w-16 h-16 rounded-3xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3">
          <FileSpreadsheet size={32} />
        </div>
        <h3 className="text-base font-bold text-gray-800">Tidak ada batch payroll ditemukan</h3>
        <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
          Mulai dengan membuat batch penggajian bulan berjalan dengan mengklik tombol di bawah.
        </p>
        <button
          onClick={onOpenGenerate}
          className="mt-5 px-5 py-2.5 bg-[#8B0000] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#700000] transition-all"
        >
          + Proses Payroll Baru
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50/70 border-b border-gray-100">
          <tr>
            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest pl-8">Periode Payroll</th>
            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Karyawan</th>
            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Bersih (THP)</th>
            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filteredBatches.map((batch) => (
            <tr key={batch.id} className="hover:bg-gray-50/60 transition-colors">
              <td className="px-6 py-4 pl-8">
                <span className="font-bold text-gray-900 block text-base">
                  {batch.period_month} {batch.period_year}
                </span>
                <span className="text-[11px] font-semibold text-gray-400 block mt-0.5">
                  Dibuat: {new Date(batch.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </td>
              <td className="px-6 py-4 font-bold text-gray-700 text-sm">
                {batch.total_employees} Orang
              </td>
              <td className="px-6 py-4 font-black text-[#8B0000] text-base">
                Rp {formatRupiah(batch.total_net)}
              </td>
              <td className="px-6 py-4">
                {getStatusBadge(batch.status)}
              </td>
              <td className="px-6 py-4 text-center">
                <div className="flex justify-center items-center gap-2">
                  <button
                    onClick={() => onViewBatchDetails(batch.id)}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold text-xs transition-all"
                  >
                    <Eye size={14} />
                    <span>{['draft', 'pending_approval'].includes(batch.status) ? "Kelola & Review" : "Rincian"}</span>
                    <ChevronRight size={12} />
                  </button>
                  <button
                    onClick={() => onExportBatchRekap(batch.id, batch.period_month, batch.period_year)}
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                    title="Unduh Rekap Excel"
                  >
                    <FileSpreadsheet size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PayrollManagementPage() {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [yearFilter, setYearFilter] = useState<number | string>("all");
  const [exporting, setExporting] = useState(false);

  // Detail batch state
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Generate Modal state
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genLoading, setGenLoading] = useState(false);
  const [genStats, setGenStats] = useState({ total_employees: 0, unsaved_profiles: 0 });

  // Salary Edit Modal (Cleaner, Non-repetitive)
  const [editingSalary, setEditingSalary] = useState<SalaryRecord | null>(null);
  const [savingSalary, setSavingSalary] = useState(false);

  // Ad-hoc item inputs inside salary edit modal
  const [adhocName, setAdhocName] = useState("");
  const [adhocType, setAdhocType] = useState<"earning" | "deduction">("earning");
  const [adhocAmount, setAdhocAmount] = useState<string>("");
  const [adhocNote, setAdhocNote] = useState("");
  const [submittingAdhoc, setSubmittingAdhoc] = useState(false);

  // Slip preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSalary, setPreviewSalary] = useState<SalaryRecord | null>(null);

  const months = MONTHS;
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Fetch all batches
  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/payroll/batches');
      setBatches(res.data.data || []);
    } catch (e) {
      console.error("Gagal memuat batch payroll:", e);
      toast.error("Gagal memuat data batch payroll.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Open batch details
  const handleViewBatchDetails = async (batchId: number) => {
    try {
      setDetailLoading(true);
      const res = await axiosInstance.get(`/payroll/batches/${batchId}`);
      setSelectedBatch(res.data.data || null);
    } catch (e) {
      console.error("Gagal mengambil detail batch:", e);
      toast.error("Gagal memuat detail periode payroll.");
    } finally {
      setDetailLoading(false);
    }
  };

  // Refresh current batch detail
  const refreshCurrentBatch = async () => {
    if (!selectedBatch) return;
    try {
      const res = await axiosInstance.get(`/payroll/batches/${selectedBatch.id}`);
      setSelectedBatch(res.data.data || null);
      fetchBatches();
    } catch (e) {
      console.error(e);
    }
  };

  // Status Change Workflow (Submit, Approve, Reject, Paid)
  const handleStatusChange = async (action: 'submit' | 'approve' | 'reject' | 'paid', note?: string) => {
    if (!selectedBatch) return;
    const actionLabels: Record<string, string> = {
      submit: 'Submit ke CEO / Approver',
      approve: 'Setujui Payroll',
      reject: 'Tolak (Revisi)',
      paid: 'Tandai Sudah Dibayar'
    };

    toast(`Apakah Anda yakin ingin melakukan "${actionLabels[action]}"?`, {
      action: {
        label: "Lanjutkan",
        onClick: async () => {
          try {
            setActionSubmitting(true);
            const payload = action === 'reject' ? { rejection_note: note || 'Perlu revisi komponen' } : {};
            await axiosInstance.post(`/payroll/batches/${selectedBatch.id}/${action}`, payload);
            toast.success(`Payroll berhasil di-${action}`);
            refreshCurrentBatch();
          } catch (e: any) {
            toast.error(e.response?.data?.message || 'Aksi gagal dieksekusi.');
          } finally {
            setActionSubmitting(false);
          }
        }
      }
    });
  };

  // Delete Draft Batch
  const handleDeleteBatch = async (batchId: number) => {
    toast("Hapus draft batch payroll ini?", {
      description: "Data kalkulasi draft akan dihapus. Riwayat payslip lama tetap aman.",
      action: {
        label: "Hapus",
        onClick: async () => {
          try {
            await axiosInstance.delete(`/payroll/batches/${batchId}`);
            toast.success("Draft payroll berhasil dihapus.");
            setSelectedBatch(null);
            fetchBatches();
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal menghapus batch.");
          }
        }
      }
    });
  };

  // Open Generate Modal
  const handleOpenGenerate = async () => {
    setGenerateModalOpen(true);
    try {
      const res = await axiosInstance.get('/employees?per_page=1000');
      const emps = res.data.data.data || [];
      const total = res.data.data.total ?? emps.length;
      const unsaved = emps.filter((e: any) => !e.basic_salary || Number.parseInt(e.basic_salary, 10) === 0).length;
      setGenStats({ total_employees: total, unsaved_profiles: unsaved });
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Generate Batch
  const handleExecuteGenerate = async () => {
    try {
      setGenLoading(true);
      const res = await axiosInstance.post('/payroll/generate', {
        month: genMonth,
        year: genYear,
      });
      toast.success(res.data.message || "Draft payroll berhasil dibuat!");
      setGenerateModalOpen(false);
      await fetchBatches();
      if (res.data.batch_id) {
        handleViewBatchDetails(res.data.batch_id);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal membuat draft payroll.");
    } finally {
      setGenLoading(false);
    }
  };

  // Export All Batches
  const handleExportExcelAll = async () => {
    try {
      setExporting(true);
      const response = await axiosInstance.get('/payroll/export', {
        params: { year: yearFilter === "all" ? undefined : yearFilter },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Payroll_Semua_${yearFilter}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengekspor data Excel.");
    } finally {
      setExporting(false);
    }
  };

  // Export Single Batch Rekap
  const handleExportBatchRekap = async (batchId: number, month: string, year: number) => {
    try {
      const response = await axiosInstance.get(`/payroll/batches/${batchId}/export-rekap`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Rekap_Payroll_${month}_${year}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("File rekap payroll berhasil diunduh.");
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengunduh rekap Excel.");
    }
  };

  // Download PDF Slip
  const handleDownloadPDF = async (salaryId: number, name: string) => {
    try {
      const response = await axiosInstance.get(`/payroll/download-slip/${salaryId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Slip_Gaji_${name.replaceAll(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengunduh slip PDF");
    }
  };

  // Preview Slip in Modal
  const handlePreviewSlip = async (salary: SalaryRecord) => {
    try {
      setPreviewSalary(salary);
      setPreviewLoading(true);
      setPreviewOpen(true);
      const res = await axiosInstance.get(`/payroll/preview-slip/${salary.id}`);
      setPreviewHtml(res.data.html);
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat slip gaji");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePrintSlip = () => {
    const iframe = document.querySelector('iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  // Save Salary (Base & Discipline)
  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalary) return;
    try {
      setSavingSalary(true);
      await axiosInstance.put(`/payroll/salaries/${editingSalary.id}`, editingSalary);
      toast.success("Perubahan gaji berhasil disimpan.");
      setEditingSalary(null);
      refreshCurrentBatch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyimpan perubahan.");
    } finally {
      setSavingSalary(false);
    }
  };

  // Add Ad-Hoc Item in Modal
  const handleAddAdhocItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalary || !adhocName.trim() || !adhocAmount) {
      toast.error("Nama komponen dan nominal wajib diisi.");
      return;
    }
    try {
      setSubmittingAdhoc(true);
      const res = await axiosInstance.post(`/payroll/salaries/${editingSalary.id}/adhoc-item`, {
        name: adhocName,
        type: adhocType,
        amount: Number(adhocAmount),
        note: adhocNote,
      });
      toast.success("Komponen ad-hoc berhasil ditambahkan.");
      setAdhocName("");
      setAdhocAmount("");
      setAdhocNote("");
      setEditingSalary(res.data.data);
      refreshCurrentBatch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menambahkan komponen ad-hoc.");
    } finally {
      setSubmittingAdhoc(false);
    }
  };

  // Remove Ad-Hoc Item in Modal
  const handleRemoveAdhocItem = async (detailId: number) => {
    if (!editingSalary) return;
    if (!globalThis.confirm("Hapus komponen ini dari rincian payslip?")) return;
    try {
      const res = await axiosInstance.delete(`/payroll/salaries/${editingSalary.id}/adhoc-item/${detailId}`);
      toast.success("Komponen berhasil dihapus.");
      setEditingSalary(res.data.data);
      refreshCurrentBatch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus komponen.");
    }
  };

  // Filter batches by status tab and year
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchYear = yearFilter === "all" || b.period_year === Number(yearFilter);
      let matchStatus = true;
      if (statusTab === 'pending') {
        matchStatus = b.status === 'draft' || b.status === 'pending_approval' || b.status === 'rejected';
      } else if (statusTab === 'completed') {
        matchStatus = b.status === 'approved' || b.status === 'paid';
      }
      return matchYear && matchStatus;
    });
  }, [batches, statusTab, yearFilter]);

  // Filter salaries inside selected batch
  const filteredSalaries = useMemo(() => {
    if (!selectedBatch?.salaries) return [];
    if (!employeeSearch.trim()) return selectedBatch.salaries;
    const q = employeeSearch.toLowerCase();
    return selectedBatch.salaries.filter(s =>
      Boolean(s.user?.name.toLowerCase().includes(q)) ||
      Boolean(s.department?.toLowerCase().includes(q)) ||
      Boolean(s.bank_name?.toLowerCase().includes(q))
    );
  }, [selectedBatch, employeeSearch]);

  if (loading && !selectedBatch) {
    return <PayrollSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* ═══ TOP BREADCRUMB & HEADER ═══ */}
      <div className="dash-page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="dash-page-title">Kelola & Riwayat Payroll</h1>
            <span className="bg-[#8B0000]/10 text-[#8B0000] text-xs font-black uppercase px-3 py-0.5 rounded-full tracking-wider">
              Unified Hub
            </span>
          </div>
          <p className="dash-page-desc mt-1">
            Pusat pemrosesan gaji bulanan, verifikasi rincian draft, alur persetujuan, dan pengunduhan slip gaji.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchBatches}
            className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all"
            title="Segarkan Data"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleExportExcelAll}
            disabled={exporting}
            className="flex items-center gap-2 px-5 h-12 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl font-bold text-xs border border-emerald-200 transition-all"
          >
            {exporting ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleOpenGenerate}
            className="flex items-center gap-2 px-6 h-12 bg-[#8B0000] hover:bg-[#720000] text-white rounded-2xl font-bold text-xs shadow-lg shadow-red-950/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            <span>Proses Payroll Baru</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          VIEW 1: DETAIL INSPECTION OF A SELECTED BATCH
         ══════════════════════════════════════════════════════════ */}
      {selectedBatch ? (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          {/* Back Button & Batch Header Banner */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedBatch(null)}
                className="w-11 h-11 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl flex items-center justify-center transition-all shrink-0"
                title="Kembali ke Daftar Batch"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-gray-900">
                    Periode {selectedBatch.period_month} {selectedBatch.period_year}
                  </h2>
                  {getStatusBadge(selectedBatch.status)}
                </div>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  Diproses pada: {new Date(selectedBatch.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • {selectedBatch.total_employees} Karyawan
                </p>
              </div>
            </div>

            {/* Lifecycle Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Draft actions */}
              {['draft', 'rejected'].includes(selectedBatch.status) && (
                <>
                  <button
                    onClick={() => handleDeleteBatch(selectedBatch.id)}
                    className="h-11 px-4 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all"
                  >
                    Hapus Draft
                  </button>
                  <button
                    onClick={() => handleStatusChange('submit')}
                    disabled={actionSubmitting}
                    className="h-11 px-5 text-xs font-bold text-white bg-gray-900 hover:bg-black rounded-xl transition-all shadow-sm flex items-center gap-2"
                  >
                    <Play size={14} /> Submit ke Approver
                  </button>
                </>
              )}

              {/* Pending Approval actions */}
              {selectedBatch.status === 'pending_approval' && (
                <>
                  <button
                    onClick={() => {
                      const note = globalThis.prompt("Alasan penolakan untuk revisi:");
                      if (note) handleStatusChange('reject', note);
                    }}
                    disabled={actionSubmitting}
                    className="h-11 px-4 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all"
                  >
                    Tolak (Revisi)
                  </button>
                  <button
                    onClick={() => handleStatusChange('approve')}
                    disabled={actionSubmitting}
                    className="h-11 px-5 text-xs font-bold text-white bg-[#8B0000] hover:bg-[#700000] rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <Check size={16} /> Setujui Payroll
                  </button>
                </>
              )}

              {/* Approved actions */}
              {selectedBatch.status === 'approved' && (
                <button
                  onClick={() => handleStatusChange('paid')}
                  disabled={actionSubmitting}
                  className="h-11 px-5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md flex items-center gap-2"
                >
                  <CheckCircle2 size={16} /> Tandai Sudah Dibayar (Transfer Selesai)
                </button>
              )}

              {/* Rekap Excel button */}
              <button
                onClick={() => handleExportBatchRekap(selectedBatch.id, selectedBatch.period_month, selectedBatch.period_year)}
                className="h-11 px-4 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-all flex items-center gap-2"
              >
                <FileSpreadsheet size={15} /> Unduh Rekap
              </button>
            </div>
          </div>

          {/* 3 Metric Cards for this batch */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <span className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">
                Total Pendapatan (Gross)
              </span>
              <span className="text-2xl font-black text-gray-900">
                Rp {formatRupiah(selectedBatch.total_gross)}
              </span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <span className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">
                Total Potongan (Pajak + BPJS + Disiplin)
              </span>
              <span className="text-2xl font-black text-rose-600">
                -Rp {formatRupiah(selectedBatch.total_deductions)}
              </span>
            </div>

            <div className="bg-[#8B0000] p-6 rounded-3xl shadow-lg shadow-red-950/20 text-white">
              <span className="text-xs font-black text-red-200 uppercase tracking-wider block mb-1">
                Total Transfer Bersih (Net THP)
              </span>
              <span className="text-2xl font-black text-white">
                Rp {formatRupiah(selectedBatch.total_net)}
              </span>
            </div>
          </div>

          {/* Search inside batch */}
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Cari nama karyawan, jabatan, atau bank..."
                className="w-full h-11 pl-11 pr-4 bg-gray-50 border-none rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#8B0000]/20 outline-none"
              />
            </div>
            <span className="text-xs font-bold text-gray-400">
              Menampilkan {filteredSalaries.length} dari {selectedBatch.salaries?.length || 0} Karyawan
            </span>
          </div>

          {/* Salaries Table */}
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/70 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest pl-8">Karyawan</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Gaji Pokok</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tunjangan & Variabel</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pot. Disiplin</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pajak & BPJS</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Net THP</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSalaries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400 italic text-sm">
                        Tidak ada data karyawan yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredSalaries.map((salary: SalaryRecord) => {
                      const discDeduction = (parseAmount(salary.deduction_late)) + (parseAmount(salary.deduction_absence));
                      const taxAndBpjs = (parseAmount(salary.deduction_tax)) + 
                                         (parseAmount(salary.deduction_bpjs_jht)) + 
                                         (parseAmount(salary.deduction_bpjs_jp)) + 
                                         (parseAmount(salary.deduction_bpjs_kes));
                      const allowances = parseAmount(salary.total_earnings) - parseAmount(salary.basic_salary);

                      return (
                        <tr key={salary.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-6 py-4 pl-8">
                            <span className="font-bold text-gray-900 block text-sm">{salary.user?.name}</span>
                            <span className="text-[11px] text-gray-400 font-medium block mt-0.5">
                              {salary.department} • {salary.bank_name} {salary.bank_account_no}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-700 text-sm">
                            Rp {formatRupiah(salary.basic_salary)}
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-600 text-sm">
                            +Rp {formatRupiah(allowances)}
                          </td>
                          <td className="px-6 py-4 font-semibold text-rose-600 text-sm">
                            {discDeduction > 0 ? `-Rp ${formatRupiah(discDeduction)}` : 'Rp 0'}
                          </td>
                          <td className="px-6 py-4 font-semibold text-orange-600 text-sm">
                            -Rp {formatRupiah(taxAndBpjs)}
                          </td>
                          <td className="px-6 py-4 font-black text-[#8B0000] text-sm">
                            Rp {formatRupiah(salary.net_salary)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {['draft', 'rejected'].includes(selectedBatch.status) && (
                                <button
                                  onClick={() => setEditingSalary({ ...salary })}
                                  className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                  title="Edit Rincian / Tambah Variabel"
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => handlePreviewSlip(salary)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                title="Lihat Slip Gaji"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => handleDownloadPDF(salary.id, salary.user?.name || "Karyawan")}
                                className="p-2 text-gray-400 hover:text-[#8B0000] hover:bg-red-50 rounded-xl transition-all"
                                title="Unduh Slip PDF"
                              >
                                <Download size={16} />
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
        </div>
      ) : (

        /* ══════════════════════════════════════════════════════════
           VIEW 2: MASTER BATCHES LIST
           ══════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Status Filter Tabs & Year Filter */}
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex bg-gray-100 p-1 rounded-2xl w-full md:w-auto">
              <button
                onClick={() => setStatusTab('all')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusTab === 'all' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Semua Periode ({batches.length})
              </button>
              <button
                onClick={() => setStatusTab('pending')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusTab === 'pending' ? "bg-[#8B0000] text-white shadow-sm" : "text-gray-500 hover:text-[#8B0000]"
                }`}
              >
                Perlu Persetujuan ({batches.filter(b => ['draft', 'pending_approval', 'rejected'].includes(b.status)).length})
              </button>
              <button
                onClick={() => setStatusTab('completed')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusTab === 'completed' ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-emerald-700"
                }`}
              >
                Selesai / Terbayar ({batches.filter(b => ['approved', 'paid'].includes(b.status)).length})
              </button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <span className="text-xs font-bold text-gray-400">Tahun:</span>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="h-10 bg-gray-50 border-none rounded-xl px-4 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#8B0000]/20 outline-none cursor-pointer"
              >
                <option value="all">Semua Tahun</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Batches Table */}
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            <BatchTableContent
              detailLoading={detailLoading}
              filteredBatches={filteredBatches}
              onOpenGenerate={handleOpenGenerate}
              onViewBatchDetails={handleViewBatchDetails}
              onExportBatchRekap={handleExportBatchRekap}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL 1: PROSES PAYROLL BARU (DIRECT 1-CLICK DIALOG)
         ══════════════════════════════════════════════════════════ */}
      {generateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 text-[#8B0000] rounded-xl flex items-center justify-center font-bold">
                  <Play size={20} />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-lg">Proses Payroll Baru</h3>
                  <p className="text-xs text-gray-400 font-medium">Buat draft kalkulasi gaji bulanan</p>
                </div>
              </div>
              <button
                onClick={() => setGenerateModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="gen-month-select" className="text-[11px] font-black text-gray-500 uppercase">Bulan</label>
                  <select
                    id="gen-month-select"
                    value={genMonth}
                    onChange={(e) => setGenMonth(e.target.value)}
                    className="w-full h-11 bg-gray-50 border-none rounded-xl px-3 font-bold text-xs"
                  >
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="gen-year-select" className="text-[11px] font-black text-gray-500 uppercase">Tahun</label>
                  <select
                    id="gen-year-select"
                    value={genYear}
                    onChange={(e) => setGenYear(Number(e.target.value))}
                    className="w-full h-11 bg-gray-50 border-none rounded-xl px-3 font-bold text-xs"
                  >
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total Karyawan Terdaftar:</span>
                  <span className="font-bold text-gray-900">{genStats.total_employees} Orang</span>
                </div>
                {genStats.unsaved_profiles > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium pt-1">
                    <AlertCircle size={14} />
                    <span>{genStats.unsaved_profiles} karyawan belum melengkapi profil gaji pokok.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGenerateModalOpen(false)}
                className="px-5 h-11 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={genLoading}
                onClick={handleExecuteGenerate}
                className="px-6 h-11 text-xs font-bold text-white bg-[#8B0000] hover:bg-[#720000] rounded-xl flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                {genLoading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                Generate Draft Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL 2: SALARY DRAFT ADJUSTMENT (FREE OF OBSOLETE STATIC FIELDS)
         ══════════════════════════════════════════════════════════ */}
      {editingSalary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-white shrink-0">
              <div>
                <h3 className="text-xl font-black text-gray-900">Penyesuaian Gaji & Variabel</h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  {editingSalary.user?.name} — {editingSalary.department} ({editingSalary.month} {editingSalary.year})
                </p>
              </div>
              <button
                onClick={() => setEditingSalary(null)}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSalary} className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Basic Salary & Payment Info */}
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                    <DollarSign size={16} className="text-[#8B0000]" />
                    Gaji Pokok & Informasi Rekening
                  </h4>

                  <div className="space-y-1.5">
                    <label htmlFor="edit-basic-salary-input" className="text-xs font-bold text-gray-600">Gaji Pokok (Rp)</label>
                    <input
                      id="edit-basic-salary-input"
                      type="number"
                      value={editingSalary.basic_salary}
                      onChange={(e) => setEditingSalary({ ...editingSalary, basic_salary: e.target.value })}
                      className="w-full h-12 bg-gray-50 border-none rounded-2xl px-4 font-black text-gray-900 focus:ring-2 focus:ring-[#8B0000]/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="edit-bank-name-input" className="text-xs font-bold text-gray-600">Nama Bank</label>
                      <input
                        id="edit-bank-name-input"
                        type="text"
                        value={editingSalary.bank_name || ''}
                        onChange={(e) => setEditingSalary({ ...editingSalary, bank_name: e.target.value })}
                        className="w-full h-11 bg-gray-50 border-none rounded-xl px-4 text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="edit-bank-account-no-input" className="text-xs font-bold text-gray-600">No. Rekening</label>
                      <input
                        id="edit-bank-account-no-input"
                        type="text"
                        value={editingSalary.bank_account_no || ''}
                        onChange={(e) => setEditingSalary({ ...editingSalary, bank_account_no: e.target.value })}
                        className="w-full h-11 bg-gray-50 border-none rounded-xl px-4 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="edit-cost-center-input" className="text-xs font-bold text-gray-600">Cost Center</label>
                    <input
                      id="edit-cost-center-input"
                      type="text"
                      value={editingSalary.cost_center || ''}
                      onChange={(e) => setEditingSalary({ ...editingSalary, cost_center: e.target.value })}
                      className="w-full h-11 bg-gray-50 border-none rounded-xl px-4 text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Right Column: Disciplinary Deductions */}
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                    <Clock size={16} className="text-rose-600" />
                    Potongan Disiplin Kehadiran
                  </h4>

                  <div className="space-y-1.5">
                    <label htmlFor="edit-deduction-late-input" className="text-xs font-bold text-gray-600">Potongan Keterlambatan (Rp)</label>
                    <input
                      id="edit-deduction-late-input"
                      type="number"
                      value={editingSalary.deduction_late || 0}
                      onChange={(e) => setEditingSalary({ ...editingSalary, deduction_late: e.target.value })}
                      className="w-full h-12 bg-rose-50/50 text-rose-700 border-none rounded-2xl px-4 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="edit-deduction-absence-input" className="text-xs font-bold text-gray-600">Potongan Absensi / Alfa (Rp)</label>
                    <input
                      id="edit-deduction-absence-input"
                      type="number"
                      value={editingSalary.deduction_absence || 0}
                      onChange={(e) => setEditingSalary({ ...editingSalary, deduction_absence: e.target.value })}
                      className="w-full h-12 bg-rose-50/50 text-rose-700 border-none rounded-2xl px-4 font-bold"
                    />
                  </div>

                  {/* Summary Box */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Pajak PPh 21 (TER):</span>
                      <span className="font-bold">Rp {formatRupiah(editingSalary.deduction_tax)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Iuran BPJS Karyawan:</span>
                      <span className="font-bold">
                        Rp {formatRupiah(parseAmount(editingSalary.deduction_bpjs_jht) + parseAmount(editingSalary.deduction_bpjs_jp) + parseAmount(editingSalary.deduction_bpjs_kes))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Snapshot Details & Ad-Hoc Items */}
              <div className="pt-6 border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                      <Sparkles size={16} className="text-[#8B0000]" />
                      Rincian Snapshot Komponen Gaji ({((editingSalary.details_records || editingSalary.detailsRecords || []).length)} Item)
                    </h4>
                    <p className="text-xs text-gray-400 font-medium">
                      Rincian tunjangan dan potongan otomatis yang terkalkulasi untuk periode ini.
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50/70 rounded-2xl p-4 border border-gray-100 space-y-2 max-h-56 overflow-y-auto">
                  {(editingSalary.details_records || editingSalary.detailsRecords || []).length === 0 ? (
                    <div className="text-xs text-gray-400 italic py-3 text-center">
                      Belum ada rincian snapshot komponen tercatat.
                    </div>
                  ) : (
                    (editingSalary.details_records || editingSalary.detailsRecords || []).map((detail: any) => {
                      const isEarning = detail.type === 'earning';
                      return (
                        <div key={detail.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isEarning ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}>
                              {isEarning ? "+" : "-"}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-gray-800">{detail.component_name}</span>
                              {detail.note && <span className="text-[11px] text-gray-400 ml-2 italic">({detail.note})</span>}
                              {detail.is_adhoc && (
                                <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                  Ad-Hoc
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-black ${isEarning ? "text-emerald-600" : "text-rose-600"}`}>
                              {isEarning ? "+" : "-"}Rp {formatRupiah(detail.amount)}
                            </span>
                            {detail.is_adhoc && (
                              <button
                                type="button"
                                onClick={() => handleRemoveAdhocItem(detail.id)}
                                className="p-1 text-gray-400 hover:text-rose-600 rounded"
                                title="Hapus variabel ad-hoc"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Ad-Hoc Item Form */}
                <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/60 space-y-3">
                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Plus size={14} /> Tambah Variabel / Komponen Ad-Hoc Khusus Karyawan Ini
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label htmlFor="adhoc-type-select" className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tipe</label>
                      <select
                        id="adhoc-type-select"
                        value={adhocType}
                        onChange={(e) => setAdhocType(e.target.value as "earning" | "deduction")}
                        className="w-full h-10 bg-white border border-gray-200 rounded-xl px-3 text-xs font-bold"
                      >
                        <option value="earning">Pendapatan (+)</option>
                        <option value="deduction">Potongan (-)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="adhoc-name-input" className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Nama Variabel</label>
                      <input
                        id="adhoc-name-input"
                        type="text"
                        value={adhocName}
                        onChange={(e) => setAdhocName(e.target.value)}
                        placeholder="Misal: Bonus Project / Denda"
                        className="w-full h-10 bg-white border border-gray-200 rounded-xl px-3 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label htmlFor="adhoc-amount-input" className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Nominal (Rp)</label>
                      <input
                        id="adhoc-amount-input"
                        type="number"
                        min={0}
                        value={adhocAmount}
                        onChange={(e) => setAdhocAmount(e.target.value)}
                        placeholder="Rp 0"
                        className="w-full h-10 bg-white border border-gray-200 rounded-xl px-3 text-xs font-bold"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={submittingAdhoc || !adhocName.trim() || !adhocAmount}
                        onClick={handleAddAdhocItem}
                        className="w-full h-10 bg-[#8B0000] hover:bg-[#720000] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {submittingAdhoc ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        Tambahkan
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingSalary(null)}
                  className="px-6 h-11 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={savingSalary}
                  className="px-8 h-11 text-xs font-bold text-white bg-[#8B0000] hover:bg-[#720000] rounded-xl flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {savingSalary ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL 3: SLIP PREVIEW MODAL
         ══════════════════════════════════════════════════════════ */}
      {previewOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[900px] max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white shrink-0">
              <div>
                <h3 className="text-lg font-black text-gray-900">Slip Gaji</h3>
                <p className="text-xs text-gray-400 font-medium">
                  {previewSalary?.user?.name} — {previewSalary?.month} {previewSalary?.year}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSlip}
                  disabled={previewLoading}
                  className="flex items-center gap-2 px-4 h-10 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs hover:bg-blue-100"
                >
                  <Printer size={15} /> Print
                </button>
                <button
                  onClick={() => {
                    if (previewSalary) {
                      handleDownloadPDF(previewSalary.id, previewSalary.user?.name || "Karyawan");
                    }
                  }}
                  disabled={previewLoading}
                  className="flex items-center gap-2 px-4 h-10 bg-[#8B0000] text-white rounded-xl font-bold text-xs shadow-sm hover:bg-[#6d0000]"
                >
                  <Download size={15} /> Download PDF
                </button>
                <button
                  onClick={() => { setPreviewOpen(false); setPreviewHtml(""); setPreviewSalary(null); }}
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-xl ml-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-100 p-8">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="animate-spin text-[#8B0000]" size={36} />
                  <p className="text-gray-400 font-medium text-sm">Memuat slip gaji...</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md mx-auto border border-gray-200 max-w-[750px]">
                  <iframe
                    srcDoc={previewHtml}
                    title="Payslip Preview"
                    className="w-full border-0 rounded-xl"
                    style={{ height: '1000px', minHeight: '600px' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
