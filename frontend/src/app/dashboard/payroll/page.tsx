"use client";

import { useState, useEffect, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Search, Download, Eye, FileSpreadsheet, 
  DollarSign, Loader2, X, Printer, ArrowLeft,
  Calendar, Users, CheckCircle2, Clock, AlertTriangle,
  ChevronRight, TrendingUp
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PayrollSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";

interface UserInfo {
  id: number;
  name: string;
  email: string;
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
  earning_bpjs_kes_premium: string | number;
  earning_attendance_allowance: string | number;
  earning_position_allowance?: string | number;
  earning_communication_allowance?: string | number;
  earning_shift_premium?: string | number;
  earning_shift_meal?: string | number;
  earning_overtime: string | number;
  earning_operational?: string | number;
  earning_diligence_bonus?: string | number;
  earning_backpay?: string | number;
  earning_others?: string | number;
  earning_others_note?: string | null;
  deduction_bpjs_jht: string | number;
  deduction_bpjs_jp: string | number;
  deduction_bpjs_kes: string | number;
  deduction_absence: string | number;
  deduction_late: string | number;
  deduction_tax: string | number;
  total_earnings: string | number;
  total_deductions: string | number;
  net_salary: string | number;
  bank_name: string;
  bank_account_no: string;
  cost_center: string;
  status: string;
  user?: UserInfo;
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
}

export default function PayrollHistoryPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState<number | string>("all");
  const [exporting, setExporting] = useState(false);

  // Detail batch state
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Slip preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSalary, setPreviewSalary] = useState<SalaryRecord | null>(null);

  const parseAmount = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === "number") return val;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatRupiah = (val: string | number | undefined | null): string => {
    return Math.round(parseAmount(val)).toLocaleString('id-ID');
  };

  // Fetch all payroll batches
  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/payroll/batches');
      setBatches(res.data.data || []);
    } catch (e) {
      console.error("Gagal mengambil data batch payroll:", e);
      toast.error("Gagal memuat riwayat payroll.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Fetch batch details (salaries inside the batch)
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

  // General export of all payroll records in selected month/year
  const handleExportExcelAll = async () => {
    try {
      setExporting(true);
      const response = await axiosInstance.get('/payroll/export', {
        params: { month: monthFilter, year: yearFilter },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Payroll_${monthFilter}_${yearFilter}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Error exporting excel:", e);
      toast.error("Gagal ekspor Excel");
    } finally {
      setExporting(false);
    }
  };

  // Batch-specific rekap export
  const handleExportBatchRekap = async (batchId: number, month: string, year: number) => {
    try {
      toast.info("Sedang menyiapkan file rekap...");
      const response = await axiosInstance.get(`/payroll/batches/${batchId}/export-rekap`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Rekap_Gaji_${month}_${year}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Rekap payroll berhasil diunduh.");
    } catch (e) {
      console.error("Error exporting batch rekap:", e);
      toast.error("Gagal mengunduh rekap Excel.");
    }
  };

  const handleDownloadPDF = async (id: number, name: string) => {
    try {
      const response = await axiosInstance.get(`/payroll/download-slip/${id}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Slip_Gaji_${name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Error downloading PDF:", e);
      toast.error("Gagal unduh PDF");
    }
  };

  const handlePreviewSlip = async (salary: SalaryRecord) => {
    try {
      setPreviewSalary(salary);
      setPreviewLoading(true);
      setPreviewOpen(true);
      const res = await axiosInstance.get(`/payroll/preview-slip/${salary.id}`);
      setPreviewHtml(res.data.html);
    } catch (e) {
      console.error("Error previewing slip:", e);
      toast.error("Gagal memuat preview slip gaji");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePrintSlip = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(previewHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  // Helper status badge styles
  const getStatusBadge = (status: string) => {
    const defaultClasses = "px-3 py-1 text-xs font-bold rounded-full border";
    switch (status.toLowerCase()) {
      case "paid":
        return <span className={`${defaultClasses} bg-emerald-50 text-emerald-700 border-emerald-100 flex items-center gap-1 w-max`}><CheckCircle2 size={12} /> Terbayar</span>;
      case "approved":
        return <span className={`${defaultClasses} bg-blue-50 text-blue-700 border-blue-100 flex items-center gap-1 w-max`}><CheckCircle2 size={12} /> Disetujui</span>;
      case "pending_approval":
        return <span className={`${defaultClasses} bg-amber-50 text-amber-700 border-amber-100 flex items-center gap-1 w-max`}><Clock size={12} /> Menunggu Persetujuan</span>;
      case "rejected":
        return <span className={`${defaultClasses} bg-rose-50 text-rose-700 border-rose-100 flex items-center gap-1 w-max`}><AlertTriangle size={12} /> Ditolak</span>;
      default:
        return <span className={`${defaultClasses} bg-slate-50 text-slate-700 border-slate-100 flex items-center gap-1 w-max`}><Clock size={12} /> Draft</span>;
    }
  };

  // Client-side filtering of batches
  const filteredBatches = batches.filter(batch => {
    const matchMonth = monthFilter === "all" || batch.period_month.toLowerCase() === monthFilter.toLowerCase();
    const matchYear = yearFilter === "all" || batch.period_year.toString() === yearFilter.toString();
    return matchMonth && matchYear;
  });

  // Client-side filtering of employees inside a batch
  const filteredSalaries = selectedBatch?.salaries?.filter((salary: SalaryRecord) => {
    return salary.user?.name?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
           salary.department?.toLowerCase().includes(employeeSearch.toLowerCase());
  }) || [];

  const availableYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  if (loading) return <PayrollSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* ═══ DETAIL VIEW: INSIDE A BATCH ═══ */}
      {selectedBatch ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => setSelectedBatch(null)} 
              className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors w-max"
            >
              <ArrowLeft size={16} /> Kembali ke Riwayat Payroll
            </button>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  <div className="p-2 bg-[#8B0000]/10 rounded-xl text-[#8B0000]">
                    <Calendar size={24} />
                  </div>
                  Periode {selectedBatch.period_month} {selectedBatch.period_year}
                </h1>
                <p className="text-sm text-gray-500 font-medium mt-1">
                  Detail rincian perhitungan gaji seluruh karyawan.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleExportBatchRekap(selectedBatch.id, selectedBatch.period_month, selectedBatch.period_year)}
                  className="flex items-center gap-2 px-5 h-11 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-sm border border-emerald-100 hover:bg-emerald-100 transition-colors"
                >
                  <FileSpreadsheet size={16} />
                  Unduh Rekap Excel
                </button>
              </div>
            </div>
          </div>

          {/* Cards Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                <Users size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Total Karyawan</span>
                <span className="text-xl font-black text-gray-900">{selectedBatch.total_employees || 0} Staff</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Total Bersih (THP)</span>
                <span className="text-xl font-black text-emerald-600">
                  Rp {formatRupiah(selectedBatch.total_net)}
                </span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-gray-50 rounded-2xl text-gray-600">
                <Clock size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Status Payroll</span>
                <div className="mt-1">{getStatusBadge(selectedBatch.status)}</div>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table Filter/Search */}
            <div className="p-6 border-b border-gray-50 flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari karyawan atau jabatan..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full h-11 pl-11 pr-4 bg-gray-50 border-none rounded-xl focus:ring-4 focus:ring-[#8B0000]/10 outline-none font-medium text-sm transition-all"
                />
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest pl-8">Karyawan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Gaji Pokok</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tunjangan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Potongan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Payable (THP)</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSalaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400 italic">
                      Tidak ada data karyawan yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredSalaries.map((salary: SalaryRecord) => (
                    <tr key={salary.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-5 pl-8">
                        <span className="font-bold text-gray-900 block">{salary.user?.name}</span>
                        <span className="text-xs text-gray-400 font-medium block mt-0.5">{salary.department}</span>
                      </td>
                      <td className="px-6 py-5 font-semibold text-gray-600 text-sm">
                        Rp {formatRupiah(salary.basic_salary)}
                      </td>
                      <td className="px-6 py-5 font-semibold text-emerald-600 text-sm">
                        Rp {formatRupiah(parseAmount(salary.total_earnings) - parseAmount(salary.basic_salary))}
                      </td>
                      <td className="px-6 py-5 font-semibold text-rose-600 text-sm">
                        Rp {formatRupiah(salary.total_deductions)}
                      </td>
                      <td className="px-6 py-5 font-black text-[#8B0000] text-sm">
                        Rp {formatRupiah(salary.net_salary)}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex justify-center gap-1">
                          <button 
                            onClick={() => handlePreviewSlip(salary)}
                            className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Lihat Slip"
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                            onClick={() => handleDownloadPDF(salary.id, salary.user?.name || "Karyawan")}
                            className="p-2.5 text-gray-400 hover:text-[#8B0000] hover:bg-red-50 rounded-xl transition-all"
                            title="Download PDF"
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        
        // ═══ MASTER VIEW: BATCHES LIST ═══
        <div className="space-y-6">
          <div className="dash-page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="dash-page-title">{t('payroll_history')}</h1>
              <p className="text-gray-400 font-medium">Laporan penggajian bulanan perusahaan.</p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                onClick={handleExportExcelAll}
                className="flex items-center gap-2 px-6 h-12 bg-emerald-50 text-emerald-600 rounded-2xl font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors flex-1 sm:flex-none justify-center"
              >
                {exporting ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                Export Excel (Semua)
              </button>
              <button 
                onClick={() => window.location.href = '/dashboard/payroll/process'}
                className="flex items-center gap-2 px-6 h-12 bg-[#8B0000] text-white rounded-2xl font-bold shadow-lg hover:bg-[#6d0000] transition-colors flex-1 sm:flex-none justify-center"
              >
                <DollarSign size={16} />
                Proses Baru
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 items-center bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm overflow-x-auto">
            <div className="flex items-center gap-2 text-gray-500 font-bold px-2 whitespace-nowrap">
              <Search size={18} /> Filter Periode:
            </div>
            <select 
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="h-10 bg-gray-50 border-none rounded-xl px-4 font-bold text-gray-700 focus:ring-2 focus:ring-[#8B0000]/20 outline-none"
            >
              <option value="all">Semua Bulan</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            
            <select 
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="h-10 bg-gray-50 border-none rounded-xl px-4 font-bold text-gray-700 focus:ring-2 focus:ring-[#8B0000]/20 outline-none"
            >
              <option value="all">Semua Tahun</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Batches Table */}
          <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-[#8B0000]" size={40} />
                <p className="text-gray-400 font-medium">Membuka detail payroll...</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest pl-10">Periode Payroll</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Jumlah Karyawan</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Bersih (THP)</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400 italic">
                        Belum ada riwayat proses payroll yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-5 pl-10">
                          <span className="font-bold text-gray-900 block text-base">
                            {batch.period_month} {batch.period_year}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 block mt-0.5 uppercase tracking-wider">
                            Diproses: {new Date(batch.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-6 py-5 font-bold text-gray-600 text-sm">
                          {batch.total_employees} Karyawan
                        </td>
                        <td className="px-6 py-5 font-black text-[#8B0000] text-base">
                          Rp {formatRupiah(batch.total_net)}
                        </td>
                        <td className="px-6 py-5">
                          {getStatusBadge(batch.status)}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex justify-center items-center gap-2">
                            <button
                              onClick={() => handleViewBatchDetails(batch.id)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-xs transition-all"
                              title="Buka Rincian Gaji"
                            >
                              <Eye size={14} /> Detail
                              <ChevronRight size={12} />
                            </button>
                            <button
                              onClick={() => handleExportBatchRekap(batch.id, batch.period_month, batch.period_year)}
                              className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="Unduh Rekap Excel"
                            >
                              <FileSpreadsheet size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══ SLIP PREVIEW MODAL ═══ */}
      {previewOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[900px] max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white shrink-0">
              <div>
                <h3 className="text-lg font-black text-gray-900">Slip Gaji</h3>
                <p className="text-sm text-gray-400 font-medium">
                  {previewSalary?.user?.name} — {previewSalary?.month} {previewSalary?.year}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSlip}
                  disabled={previewLoading}
                  className="flex items-center gap-2 px-5 h-10 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm border border-blue-100 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <Printer size={15} />
                  Print
                </button>
                 <button
                  onClick={() => {
                    if (previewSalary) {
                      handleDownloadPDF(previewSalary.id, previewSalary.user?.name || "Karyawan");
                    }
                  }}
                  disabled={previewLoading}
                  className="flex items-center gap-2 px-5 h-10 bg-[#8B0000] text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#6d0000] transition-colors disabled:opacity-50"
                >
                  <Download size={15} />
                  Download PDF
                </button>
                <button
                  onClick={() => { setPreviewOpen(false); setPreviewHtml(""); setPreviewSalary(null); }}
                  className="p-2.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors ml-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body — scrollable content area */}
            <div className="flex-1 overflow-y-auto bg-gray-100 p-8">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="animate-spin text-[#8B0000]" size={40} />
                  <p className="text-gray-400 font-medium">Memuat slip gaji...</p>
                </div>
              ) : (
                <div 
                  className="bg-white rounded-xl shadow-lg mx-auto border border-gray-200"
                  style={{ maxWidth: '750px' }}
                >
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
