"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import axiosInstance from "@/lib/axios";
import { 
  CheckCircle2, XCircle, Clock, AlertTriangle, 
  Eye, Loader2, RefreshCw, 
  Check, X, Users,
  ShieldCheck, AlertCircle, Download
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, isSuperAdminUser } from "@/contexts/AuthContext";

interface CreatorOrApprover {
  id: number;
  name: string;
  email?: string;
}

interface SalaryItem {
  id: number;
  user_id: number;
  basic_salary: number | string;
  total_earnings: number | string;
  total_deductions: number | string;
  net_salary: number | string;
  deduction_late?: number | string;
  deduction_absence?: number | string;
  deduction_tax?: number | string;
  deduction_bpjs_jht?: number | string;
  deduction_bpjs_jp?: number | string;
  deduction_bpjs_kes?: number | string;
  user?: {
    id: number;
    name: string;
    department?: string;
  };
  department?: string;
  bank_name?: string;
  bank_account_no?: string;
}

interface PayrollBatch {
  id: number;
  company_id: number;
  period_month: string;
  period_year: number;
  total_employees: number;
  total_gross: number | string;
  total_deductions: number | string;
  total_net: number | string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "paid";
  created_at: string;
  submitted_at?: string;
  approved_at?: string;
  rejection_note?: string;
  creator?: CreatorOrApprover;
  approver?: CreatorOrApprover;
  salaries?: SalaryItem[];
}

function parseAmount(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const parsed = Number.parseFloat(val);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatRupiah(val: string | number | undefined | null): string {
  const num = parseAmount(val);
  return new Intl.NumberFormat("id-ID").format(num);
}

function getBatchStatusBadge(status: string) {
  if (status === "pending_approval") {
    return {
      className: "bg-amber-100 text-amber-800 border border-amber-200",
      label: "Menunggu Persetujuan",
    };
  }
  if (status === "approved") {
    return {
      className: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      label: "Disetujui",
    };
  }
  if (status === "paid") {
    return {
      className: "bg-blue-100 text-blue-800 border border-blue-200",
      label: "Sudah Ditransfer (Paid)",
    };
  }
  return {
    className: "bg-rose-100 text-rose-800 border border-rose-200",
    label: "Ditolak (Revisi)",
  };
}

function getEmptyStateInfo(activeTab: "pending" | "approved" | "rejected") {
  if (activeTab === "pending") {
    return {
      title: "Semua Penggajian Telah Ditinjau",
      description: "Tidak ada batch payroll yang sedang menunggu persetujuan pada periode saat ini.",
    };
  }
  return {
    title: "Belum Ada Riwayat Batch",
    description: `Tidak ditemukan batch dengan status ${activeTab}.`,
  };
}

interface PayrollBatchCardProps {
  readonly batch: PayrollBatch;
  readonly canApprove: boolean;
  readonly actionLoading: boolean;
  readonly onExportRekap: (batch: PayrollBatch) => void;
  readonly onOpenDetail: (batchId: number) => void;
  readonly onOpenApprove: (batch: PayrollBatch) => void;
  readonly onOpenReject: (batchId: number) => void;
}

function PayrollBatchCard(props: Readonly<PayrollBatchCardProps>) {
  const {
    batch,
    canApprove,
    actionLoading,
    onExportRekap,
    onOpenDetail,
    onOpenApprove,
    onOpenReject,
  } = props;
  const statusBadge = getBatchStatusBadge(batch.status);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 shadow-sm hover:shadow-md transition-all space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-gray-900">
              Periode {batch.period_month} {batch.period_year}
            </h2>
            <span
              className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-xl ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Diajukan oleh: <strong className="text-gray-700">{batch.creator?.name || "HR Officer"}</strong> • {batch.total_employees} Karyawan Terdaftar
          </p>
        </div>

        {/* Approver Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onExportRekap(batch)}
            className="h-11 px-4 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 flex items-center gap-1.5 transition-all"
          >
            <Download size={14} /> Unduh Rekap
          </button>

          <button
            onClick={() => onOpenDetail(batch.id)}
            className="h-11 px-4 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 flex items-center gap-1.5 transition-all"
          >
            <Eye size={14} /> Lihat Detail Karyawan
          </button>

          {canApprove && batch.status === "pending_approval" && (
            <>
              <button
                onClick={() => onOpenReject(batch.id)}
                disabled={actionLoading}
                className="h-11 px-4 text-xs font-black text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <X size={14} /> Tolak (Revisi)
              </button>

              <button
                onClick={() => onOpenApprove(batch)}
                disabled={actionLoading}
                className="h-11 px-5 text-xs font-black text-white bg-[#8B0000] hover:bg-[#700000] rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Check size={14} /> Setujui Payroll
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-1">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Karyawan</span>
          <div className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-[#8B0000]" />
            {batch.total_employees} Orang
          </div>
        </div>

        <div className="p-5 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-1">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Gross (Pendapatan)</span>
          <div className="text-xl font-black text-gray-900">
            Rp {formatRupiah(batch.total_gross)}
          </div>
        </div>

        <div className="p-5 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-1">
          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Total Potongan (Disiplin + Pajak + BPJS)</span>
          <div className="text-xl font-black text-rose-600">
            -Rp {formatRupiah(batch.total_deductions)}
          </div>
        </div>

        <div className="p-5 bg-red-50/60 rounded-2xl border border-red-100 space-y-1">
          <span className="text-[10px] font-black text-[#8B0000] uppercase tracking-widest">Total Transfer Bersih (Net THP)</span>
          <div className="text-xl font-black text-[#8B0000]">
            Rp {formatRupiah(batch.total_net)}
          </div>
        </div>
      </div>

      {/* Notes if rejected */}
      {batch.status === "rejected" && batch.rejection_note && (
        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <strong>Catatan Revisi dari Approver:</strong>
            <p className="mt-0.5 text-rose-700">{batch.rejection_note}</p>
          </div>
        </div>
      )}

      {/* Approval Info */}
      {batch.approver && (
        <div className="text-[11px] text-gray-400 font-medium">
          Disetujui oleh: <strong className="text-gray-700">{batch.approver.name}</strong>
          {batch.approved_at && ` pada ${new Date(batch.approved_at).toLocaleString("id-ID")}`}
        </div>
      )}
    </div>
  );
}

export default function PayrollApprovalPage() {
  const { user, hasPermission } = useAuth();
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");

  // Detail Modal State
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchSalary, setSearchSalary] = useState("");

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectBatchId, setRejectBatchId] = useState<number | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");

  // Approval Confirm Modal State
  const [approveConfirmModalOpen, setApproveConfirmModalOpen] = useState(false);
  const [approveBatchTarget, setApproveBatchTarget] = useState<PayrollBatch | null>(null);

  const canApprove = isSuperAdminUser(user) || hasPermission("approve-payroll") || hasPermission("manage-payroll");

  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/payroll/batches");
      setBatches(res.data.data || []);
    } catch (e: any) {
      console.error("Gagal mengambil data batch payroll:", e);
      toast.error(e.response?.data?.message || "Gagal memuat daftar batch payroll.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (activeTab === "pending") return b.status === "pending_approval";
      if (activeTab === "approved") return b.status === "approved" || b.status === "paid";
      if (activeTab === "rejected") return b.status === "rejected";
      return true;
    });
  }, [batches, activeTab]);

  const pendingCount = useMemo(() => {
    return batches.filter((b) => b.status === "pending_approval").length;
  }, [batches]);

  const handleOpenDetail = async (batchId: number) => {
    try {
      setDetailLoading(true);
      const res = await axiosInstance.get(`/payroll/batches/${batchId}`);
      setSelectedBatch(res.data.data || null);
    } catch (e: any) {
      console.error(e);
      toast.error("Gagal memuat rincian slip gaji karyawan.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approveBatchTarget) return;
    try {
      setActionLoading(true);
      const res = await axiosInstance.post(`/payroll/batches/${approveBatchTarget.id}/approve`);
      toast.success(res.data?.message || "Payroll berhasil disetujui!");
      setApproveConfirmModalOpen(false);
      setApproveBatchTarget(null);
      if (selectedBatch?.id === approveBatchTarget.id) {
        setSelectedBatch(null);
      }
      fetchBatches();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyetujui payroll.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectBatchId || !rejectionNote.trim()) {
      toast.error("Wajib mengisi alasan/catatan penolakan.");
      return;
    }
    try {
      setActionLoading(true);
      const res = await axiosInstance.post(`/payroll/batches/${rejectBatchId}/reject`, {
        rejection_note: rejectionNote.trim(),
      });
      toast.success(res.data?.message || "Payroll berhasil ditolak untuk revisi.");
      setRejectModalOpen(false);
      setRejectBatchId(null);
      setRejectionNote("");
      if (selectedBatch?.id === rejectBatchId) {
        setSelectedBatch(null);
      }
      fetchBatches();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menolak payroll.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportRekap = async (batch: PayrollBatch) => {
    try {
      toast.info("Mengunduh rekap Excel...");
      const res = await axiosInstance.get(`/payroll/batches/${batch.id}/export-rekap`, {
        responseType: "blob",
      });
      const url = globalThis.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Rekap_Payroll_${batch.period_month}_${batch.period_year}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Rekap Excel berhasil diunduh.");
    } catch {
      toast.error("Gagal mengunduh file rekap.");
    }
  };

  const filteredSalaries = useMemo(() => {
    if (!selectedBatch?.salaries) return [];
    if (!searchSalary.trim()) return selectedBatch.salaries;
    const q = searchSalary.toLowerCase();
    return selectedBatch.salaries.filter((s) =>
      s.user?.name.toLowerCase().includes(q) ||
      s.department?.toLowerCase().includes(q)
    );
  }, [selectedBatch, searchSalary]);

  const renderBatchContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[350px] gap-3 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <Loader2 className="animate-spin text-[#8B0000]" size={40} />
          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Memuat Batch Payroll...</p>
        </div>
      );
    }

    if (filteredBatches.length === 0) {
      const emptyInfo = getEmptyStateInfo(activeTab);
      return (
        <div className="flex flex-col items-center justify-center min-h-[350px] gap-3 bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-lg font-black text-gray-800">{emptyInfo.title}</h3>
          <p className="text-gray-400 text-xs font-medium max-w-md">{emptyInfo.description}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6">
        {filteredBatches.map((batch) => (
          <PayrollBatchCard
            key={batch.id}
            batch={batch}
            canApprove={canApprove}
            actionLoading={actionLoading}
            onExportRekap={handleExportRekap}
            onOpenDetail={handleOpenDetail}
            onOpenApprove={(b) => {
              setApproveBatchTarget(b);
              setApproveConfirmModalOpen(true);
            }}
            onOpenReject={(id) => {
              setRejectBatchId(id);
              setRejectionNote("");
              setRejectModalOpen(true);
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-white border border-gray-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-4 py-1.5 bg-[#8B0000]/10 text-[#8B0000] text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <ShieldCheck size={14} /> Executive Approval Portal
            </span>
            {pendingCount > 0 && (
              <span className="px-3.5 py-1.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider rounded-full animate-pulse">
                {pendingCount} Batch Menunggu Persetujuan
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
            Persetujuan <span className="text-[#8B0000]">Payroll</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-2 leading-relaxed">
            Pusat verifikasi dan otorisasi batch penggajian bulanan perusahaan. Tinjau total dana, komponen potongan, dan rincian per karyawan sebelum memberikan persetujuan pencairan.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={fetchBatches}
            disabled={loading}
            className="h-12 px-5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl font-bold text-xs flex items-center gap-2 border border-gray-200 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Muat Ulang
          </button>
        </div>

        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8B0000]/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-gray-100/80 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
            activeTab === "pending"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <Clock size={15} /> Menunggu Persetujuan
          {pendingCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-[10px] bg-[#8B0000] text-white rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("approved")}
          className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
            activeTab === "approved"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <CheckCircle2 size={15} /> Riwayat Disetujui
        </button>
        <button
          onClick={() => setActiveTab("rejected")}
          className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
            activeTab === "rejected"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <XCircle size={15} /> Riwayat Ditolak
        </button>
      </div>

      {/* Batches List */}
      {renderBatchContent()}

      {/* Modal Detail Slip Gaji Karyawan */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900">
                  Rincian Penggajian — {selectedBatch.period_month} {selectedBatch.period_year}
                </h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  Total {selectedBatch.salaries?.length || 0} karyawan terdaftar pada batch ini.
                </p>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Search */}
            <div className="px-6 md:px-8 py-3 bg-gray-50 border-b border-gray-100">
              <input
                type="text"
                placeholder="Cari nama karyawan atau divisi..."
                value={searchSalary}
                onChange={(e) => setSearchSalary(e.target.value)}
                className="w-full h-11 px-4 bg-white border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-[#8B0000]"
              />
            </div>

            {/* Modal Table */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {detailLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-[#8B0000]" size={32} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="pb-3">Karyawan</th>
                        <th className="pb-3">Gaji Pokok</th>
                        <th className="pb-3">Pendapatan Bruto</th>
                        <th className="pb-3">Pot. Disiplin</th>
                        <th className="pb-3">Pajak & BPJS</th>
                        <th className="pb-3">Net THP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSalaries.map((sal) => {
                        const disc = parseAmount(sal.deduction_late) + parseAmount(sal.deduction_absence);
                        const taxBpjs = parseAmount(sal.deduction_tax) +
                          parseAmount(sal.deduction_bpjs_jht) +
                          parseAmount(sal.deduction_bpjs_jp) +
                          parseAmount(sal.deduction_bpjs_kes);

                        return (
                          <tr key={sal.id} className="hover:bg-gray-50/60">
                            <td className="py-3.5 pr-4 font-bold text-gray-900">
                              {sal.user?.name}
                              <span className="block text-[10px] font-normal text-gray-400">
                                {sal.department || sal.user?.department || "-"}
                              </span>
                            </td>
                            <td className="py-3.5 pr-4 font-semibold text-gray-700">
                              Rp {formatRupiah(sal.basic_salary)}
                            </td>
                            <td className="py-3.5 pr-4 font-semibold text-emerald-600">
                              Rp {formatRupiah(sal.total_earnings)}
                            </td>
                            <td className="py-3.5 pr-4 font-semibold text-rose-600">
                              {disc > 0 ? `-Rp ${formatRupiah(disc)}` : "Rp 0"}
                            </td>
                            <td className="py-3.5 pr-4 font-semibold text-orange-600">
                              {taxBpjs > 0 ? `-Rp ${formatRupiah(taxBpjs)}` : "Rp 0"}
                            </td>
                            <td className="py-3.5 font-black text-[#8B0000]">
                              Rp {formatRupiah(sal.net_salary)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">
                Total Net THP Batch:{" "}
                <strong className="text-gray-900 text-sm">
                  Rp {formatRupiah(selectedBatch.total_net)}
                </strong>
              </span>
              <button
                onClick={() => setSelectedBatch(null)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Setujui */}
      {approveConfirmModalOpen && approveBatchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border border-gray-100 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Setujui Batch Payroll?</h3>
              <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">
                Anda akan menyetujui penggajian <strong>{approveBatchTarget.period_month} {approveBatchTarget.period_year}</strong> untuk <strong>{approveBatchTarget.total_employees} karyawan</strong> dengan total transfer bersih <strong>Rp {formatRupiah(approveBatchTarget.total_net)}</strong>.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setApproveConfirmModalOpen(false)}
                disabled={actionLoading}
                className="flex-1 h-12 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex-1 h-12 bg-[#8B0000] hover:bg-[#700000] text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Ya, Setujui Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak (Revisi) */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border border-gray-100 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Tolak Batch Payroll</h3>
                <p className="text-xs text-gray-400 font-medium">Berikan instruksi revisi ke staf HR.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rejection-note-textarea" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Alasan / Catatan Revisi (Wajib)
              </label>
              <textarea
                id="rejection-note-textarea"
                rows={4}
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Contoh: Tolong cek ulang potongan kehadiran divisi Marketing, ada koreksi absensi yang belum masuk..."
                className="w-full p-4 border border-gray-200 rounded-2xl text-xs font-medium outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setRejectModalOpen(false)}
                disabled={actionLoading}
                className="flex-1 h-12 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectionNote.trim()}
                className="flex-1 h-12 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                Kirim Penolakan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
