"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { 
  CreditCard, Download, Eye, Printer, Calendar, ArrowUpRight, 
  ArrowDownRight, CheckCircle2, Building, User as UserIcon, 
  FileText, ShieldCheck, Wallet, RefreshCw, X, AlertCircle, 
  ChevronRight, Sparkles, Building2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface PayslipDetail {
  id: number;
  component_name: string;
  type: 'earning' | 'deduction';
  amount: number | string;
  note?: string;
  is_adhoc?: boolean;
}

interface SalaryRecord {
  id: number;
  user_id: number;
  company_id: number;
  batch_id: number;
  month: string;
  year: number;
  basic_salary: number | string;
  department?: string;
  working_days?: number;
  total_working_days?: number;
  total_earnings?: number | string;
  total_deductions?: number | string;
  net_salary?: number | string;
  status: string;
  bank_name?: string;
  bank_account_no?: string;
  cost_center?: string;
  
  // Specific Earnings
  earning_position_allowance?: number | string;
  earning_attendance_allowance?: number | string;
  earning_communication_allowance?: number | string;
  earning_shift_premium?: number | string;
  earning_shift_meal?: number | string;
  earning_overtime?: number | string;
  earning_operational?: number | string;
  earning_diligence_bonus?: number | string;
  earning_backpay?: number | string;
  earning_others?: number | string;
  earning_others_note?: string;

  // Specific Deductions
  deduction_bpjs_jht?: number | string;
  deduction_bpjs_jp?: number | string;
  deduction_bpjs_kes?: number | string;
  deduction_absence?: number | string;
  deduction_late?: number | string;
  deduction_tax?: number | string;
  deduction_others?: number | string;
  deduction_others_note?: string;

  created_at?: string;
  details_records?: PayslipDetail[];
  detailsRecords?: PayslipDetail[];
  user?: {
    id: number;
    name: string;
    email: string;
    nik?: string;
    company?: {
      name: string;
      logo_path?: string;
    };
    role?: {
      name: string;
    };
  };
  batch?: {
    id: number;
    period_month: string;
    period_year: number;
    status: string;
  };
}

function parseAmount(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatRupiah(val: any): string {
  const num = parseAmount(val);
  return Math.round(num).toLocaleString("id-ID");
}

export default function MyPayrollSlipPage() {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedSlip, setSelectedSlip] = useState<SalaryRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const fetchSalaries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/payroll/my-history");
      const list = res.data?.data || [];
      setSalaries(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error("Gagal mengambil data slip gaji", err);
      toast.error(err.response?.data?.message || "Gagal memuat daftar slip gaji Anda.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalaries();
  }, [fetchSalaries]);

  // List of available years from salaries
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    salaries.forEach((s) => {
      if (s.year) years.add(Number(s.year));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [salaries]);

  // Filtered salaries based on year
  const filteredSalaries = useMemo(() => {
    if (selectedYear === "all") return salaries;
    return salaries.filter((s) => String(s.year) === selectedYear);
  }, [salaries, selectedYear]);

  // Latest payslip for highlight card
  const latestSlip = useMemo(() => {
    if (salaries.length === 0) return null;
    return salaries[0];
  }, [salaries]);

  const handleDownloadPdf = async (slip: SalaryRecord) => {
    try {
      setDownloadingId(slip.id);
      const response = await axiosInstance.get(`/payroll/download-slip/${slip.id}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Slip_Gaji_${user?.name || "Karyawan"}_${slip.month}_${slip.year}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Slip gaji berhasil diunduh.");
    } catch (err: any) {
      console.error("Gagal mengunduh slip PDF", err);
      toast.error(err.response?.data?.message || "Gagal mengunduh slip gaji PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreviewSlip = async (slip: SalaryRecord) => {
    try {
      setPreviewingId(slip.id);
      const response = await axiosInstance.get(`/payroll/preview-slip/${slip.id}`, {
        headers: { Accept: "application/json" },
      });
      const htmlContent = response.data?.html || response.data;
      if (typeof htmlContent === "string" && htmlContent.includes("<")) {
        setHtmlPreview(htmlContent);
        setSelectedSlip(slip);
        setIsPreviewModalOpen(true);
      } else {
        // Fallback to detail breakdown modal
        setSelectedSlip(slip);
        setIsModalOpen(true);
      }
    } catch (err: any) {
      console.error("Gagal membuka preview slip", err);
      // Fallback: open detail breakdown modal
      setSelectedSlip(slip);
      setIsModalOpen(true);
    } finally {
      setPreviewingId(null);
    }
  };

  const handlePrintPreview = () => {
    if (!htmlPreview) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlPreview);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  // Compute breakdown allowances
  const getAllowancesList = (slip: SalaryRecord) => {
    const list: { name: string; amount: number }[] = [];
    if (parseAmount(slip.earning_position_allowance) > 0) {
      list.push({ name: "Tunjangan Jabatan", amount: parseAmount(slip.earning_position_allowance) });
    }
    if (parseAmount(slip.earning_attendance_allowance) > 0) {
      list.push({ name: "Tunjangan Kehadiran", amount: parseAmount(slip.earning_attendance_allowance) });
    }
    if (parseAmount(slip.earning_communication_allowance) > 0) {
      list.push({ name: "Tunjangan Komunikasi", amount: parseAmount(slip.earning_communication_allowance) });
    }
    if (parseAmount(slip.earning_shift_premium) > 0) {
      list.push({ name: "Premi Shift", amount: parseAmount(slip.earning_shift_premium) });
    }
    if (parseAmount(slip.earning_shift_meal) > 0) {
      list.push({ name: "Uang Makan Shift", amount: parseAmount(slip.earning_shift_meal) });
    }
    if (parseAmount(slip.earning_overtime) > 0) {
      list.push({ name: "Upah Lembur", amount: parseAmount(slip.earning_overtime) });
    }
    if (parseAmount(slip.earning_operational) > 0) {
      list.push({ name: "Operasional", amount: parseAmount(slip.earning_operational) });
    }
    if (parseAmount(slip.earning_diligence_bonus) > 0) {
      list.push({ name: "Bonus Kerajinan", amount: parseAmount(slip.earning_diligence_bonus) });
    }
    if (parseAmount(slip.earning_backpay) > 0) {
      list.push({ name: "Rapel Gaji", amount: parseAmount(slip.earning_backpay) });
    }
    if (parseAmount(slip.earning_others) > 0) {
      list.push({ name: slip.earning_others_note || "Penghasilan Lainnya", amount: parseAmount(slip.earning_others) });
    }

    // Dynamic ad-hoc items
    const records = slip.detailsRecords || slip.details_records || [];
    records.filter((r) => r.type === "earning").forEach((r) => {
      list.push({ name: r.component_name || "Tambahan Adhoc", amount: parseAmount(r.amount) });
    });

    return list;
  };

  // Compute breakdown deductions
  const getDeductionsList = (slip: SalaryRecord) => {
    const list: { name: string; amount: number }[] = [];
    if (parseAmount(slip.deduction_bpjs_jht) > 0) {
      list.push({ name: "BPJS Ketenagakerjaan (JHT)", amount: parseAmount(slip.deduction_bpjs_jht) });
    }
    if (parseAmount(slip.deduction_bpjs_jp) > 0) {
      list.push({ name: "BPJS Ketenagakerjaan (JP)", amount: parseAmount(slip.deduction_bpjs_jp) });
    }
    if (parseAmount(slip.deduction_bpjs_kes) > 0) {
      list.push({ name: "BPJS Kesehatan", amount: parseAmount(slip.deduction_bpjs_kes) });
    }
    if (parseAmount(slip.deduction_late) > 0) {
      list.push({ name: "Potongan Terlambat", amount: parseAmount(slip.deduction_late) });
    }
    if (parseAmount(slip.deduction_absence) > 0) {
      list.push({ name: "Potongan Mangkir / Absen", amount: parseAmount(slip.deduction_absence) });
    }
    if (parseAmount(slip.deduction_tax) > 0) {
      list.push({ name: "Pajak Penghasilan (PPh 21)", amount: parseAmount(slip.deduction_tax) });
    }
    if (parseAmount(slip.deduction_others) > 0) {
      list.push({ name: slip.deduction_others_note || "Potongan Lainnya", amount: parseAmount(slip.deduction_others) });
    }

    // Dynamic ad-hoc items
    const records = slip.detailsRecords || slip.details_records || [];
    records.filter((r) => r.type === "deduction").forEach((r) => {
      list.push({ name: r.component_name || "Potongan Adhoc", amount: parseAmount(r.amount) });
    });

    return list;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="dash-page-title">Slip Gaji Saya</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck size={12} className="text-emerald-600" />
              Resmi & Terverifikasi
            </span>
          </div>
          <p className="dash-page-desc">
            Lihat rincian penghasilan bulanan, potongan, dan unduh dokumen slip gaji resmi Anda.
          </p>
        </div>
        <div className="dash-page-actions">
          <button 
            onClick={fetchSalaries} 
            disabled={loading}
            className="dash-btn dash-btn-outline inline-flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Segarkan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {latestSlip && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Take Home Pay */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-xl shadow-slate-900/10 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet size={14} className="text-emerald-400" />
                  Take Home Pay Terakhir
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {latestSlip.month} {latestSlip.year}
                </span>
              </div>
              <p className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                Rp {formatRupiah(latestSlip.net_salary)}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
              <span>Status Pembayaran</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} />
                Dibayarkan
              </span>
            </div>
          </div>

          {/* Card 2: Gaji Pokok */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Gaji Pokok
              </span>
              <p className="text-2xl font-black text-slate-900">
                Rp {formatRupiah(latestSlip.basic_salary)}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Hari Kerja</span>
              <span className="font-bold text-slate-700">
                {latestSlip.working_days ?? "-"} / {latestSlip.total_working_days ?? 22} Hari
              </span>
            </div>
          </div>

          {/* Card 3: Total Tunjangan */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1 mb-2">
                <ArrowUpRight size={14} className="text-emerald-600" />
                Total Tunjangan & Lembur
              </span>
              <p className="text-2xl font-black text-emerald-600">
                +Rp {formatRupiah(parseAmount(latestSlip.total_earnings) - parseAmount(latestSlip.basic_salary))}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Upah Lembur</span>
              <span className="font-bold text-slate-700">
                Rp {formatRupiah(latestSlip.earning_overtime || 0)}
              </span>
            </div>
          </div>

          {/* Card 4: Total Potongan */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1 mb-2">
                <ArrowDownRight size={14} className="text-rose-600" />
                Total Potongan (BPJS/Pajak)
              </span>
              <p className="text-2xl font-black text-rose-600">
                -Rp {formatRupiah(latestSlip.total_deductions)}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Rekening Payroll</span>
              <span className="font-bold text-slate-700 truncate max-w-[120px]" title={latestSlip.bank_name || "-"}>
                {latestSlip.bank_name || "Bank Transfer"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-slate-400" />
            <span className="text-sm font-black text-slate-800">Riwayat Slip Gaji</span>
            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-slate-100 text-slate-600">
              {filteredSalaries.length} Dokumen
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500">Tahun:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-9 px-3 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors shadow-sm"
            >
              <option value="all">Semua Tahun</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <RefreshCw size={28} className="animate-spin text-slate-400 mb-3" />
            <p className="text-sm font-bold text-slate-600">Memuat riwayat slip gaji...</p>
          </div>
        ) : filteredSalaries.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <CreditCard size={44} className="mx-auto mb-3 opacity-30 text-slate-500" />
            <p className="text-base font-black text-slate-700">Belum Ada Slip Gaji</p>
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto mt-1">
              Slip gaji resmi Anda akan otomatis terbit di sini setelah diproses dan dibagikan oleh pihak HR/Finance.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                  <th className="px-5 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">
                    Periode Gaji
                  </th>
                  <th className="px-5 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">
                    Gaji Pokok
                  </th>
                  <th className="px-5 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">
                    Tunjangan
                  </th>
                  <th className="px-5 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">
                    Potongan
                  </th>
                  <th className="px-5 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">
                    Take Home Pay (THP)
                  </th>
                  <th className="px-5 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">
                    Status
                  </th>
                  <th className="px-5 py-4 font-black text-slate-500 uppercase tracking-widest text-[10px] text-right">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSalaries.map((slip) => {
                  const allowances = parseAmount(slip.total_earnings) - parseAmount(slip.basic_salary);
                  return (
                    <tr key={slip.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-xs shrink-0 border border-slate-200/60">
                            <Calendar size={16} />
                          </div>
                          <div>
                            <span className="font-black text-slate-900 text-sm block">
                              {slip.month} {slip.year}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {slip.department || user?.role?.name || "Karyawan"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-slate-700">
                        Rp {formatRupiah(slip.basic_salary)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-emerald-600">
                        +Rp {formatRupiah(allowances)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-rose-600">
                        -Rp {formatRupiah(slip.total_deductions)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-black text-sm text-slate-900">
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                          Rp {formatRupiah(slip.net_salary)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          Dibayarkan
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedSlip(slip);
                              setIsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-black rounded-xl text-xs transition-colors"
                            title="Lihat rincian kalkulasi"
                          >
                            <Eye size={13} />
                            <span>Rincian</span>
                          </button>
                          
                          <button
                            onClick={() => handlePreviewSlip(slip)}
                            disabled={previewingId === slip.id}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Cetak / Preview Cetak"
                          >
                            <Printer size={15} className={previewingId === slip.id ? "animate-pulse" : ""} />
                          </button>

                          <button
                            onClick={() => handleDownloadPdf(slip)}
                            disabled={downloadingId === slip.id}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Unduh Slip PDF Resmi"
                          >
                            <Download size={15} className={downloadingId === slip.id ? "animate-bounce" : ""} />
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

      {/* Modal 1: Rincian Slip Gaji (Interactive Breakdown Modal) */}
      {isModalOpen && selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200/80">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/60 rounded-t-3xl">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 mb-1.5 uppercase tracking-wider">
                  Rahasia & Konfidensial
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  Slip Gaji {selectedSlip.month} {selectedSlip.year}
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {selectedSlip.user?.company?.name || "Perusahaan"} • Karyawan: {selectedSlip.user?.name || user?.name}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Employee Meta Details Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">NIK / ID</span>
                  <span className="font-bold text-slate-800">{selectedSlip.user?.nik || `ID #${selectedSlip.user_id}`}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Departemen</span>
                  <span className="font-bold text-slate-800">{selectedSlip.department || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hari Kerja</span>
                  <span className="font-bold text-slate-800">
                    {selectedSlip.working_days ?? 0} / {selectedSlip.total_working_days ?? 22} Hari
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rekening Bank</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {selectedSlip.bank_name || "Transfer"}
                  </span>
                </div>
              </div>

              {/* Two Column Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Earnings (Penerimaan) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowUpRight size={15} className="text-emerald-600" />
                      Penerimaan
                    </span>
                    <span className="text-xs font-bold text-emerald-600">Jumlah</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="font-bold text-slate-700">Gaji Pokok</span>
                      <span className="font-black text-slate-900">Rp {formatRupiah(selectedSlip.basic_salary)}</span>
                    </div>

                    {getAllowancesList(selectedSlip).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-600 font-medium">{item.name}</span>
                        <span className="font-bold text-slate-800">Rp {formatRupiah(item.amount)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-black text-xs text-slate-900">
                    <span>Total Penghasilan Bruto</span>
                    <span className="text-emerald-700">Rp {formatRupiah(selectedSlip.total_earnings)}</span>
                  </div>
                </div>

                {/* Deductions (Potongan) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowDownRight size={15} className="text-rose-600" />
                      Potongan
                    </span>
                    <span className="text-xs font-bold text-rose-600">Jumlah</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {getDeductionsList(selectedSlip).length === 0 ? (
                      <div className="py-3 text-center text-slate-400 font-medium italic">
                        Tidak ada potongan pada periode ini.
                      </div>
                    ) : (
                      getDeductionsList(selectedSlip).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-600 font-medium">{item.name}</span>
                          <span className="font-bold text-rose-600">-Rp {formatRupiah(item.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-black text-xs text-slate-900">
                    <span>Total Potongan</span>
                    <span className="text-rose-700">-Rp {formatRupiah(selectedSlip.total_deductions)}</span>
                  </div>
                </div>
              </div>

              {/* Total Take Home Pay Banner */}
              <div className="p-5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg shadow-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider block">
                    Gaji Bersih Diterima
                  </span>
                  <span className="text-lg font-bold">TAKE HOME PAY</span>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-2xl sm:text-3xl font-black tracking-tight">
                    Rp {formatRupiah(selectedSlip.net_salary)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-end gap-2.5 rounded-b-3xl">
              <button
                onClick={() => handlePreviewSlip(selectedSlip)}
                className="dash-btn dash-btn-outline inline-flex items-center gap-1.5"
              >
                <Printer size={15} />
                <span>Cetak / Cetak Preview</span>
              </button>

              <button
                onClick={() => handleDownloadPdf(selectedSlip)}
                disabled={downloadingId === selectedSlip.id}
                className="dash-btn dash-btn-primary inline-flex items-center gap-1.5"
              >
                <Download size={15} />
                <span>{downloadingId === selectedSlip.id ? "Mengunduh..." : "Unduh PDF Resmi"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: HTML Print Preview Modal */}
      {isPreviewModalOpen && htmlPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-slate-600" />
                <span className="text-sm font-black text-slate-800">
                  Pratinjau Slip Gaji Cetak ({selectedSlip?.month} {selectedSlip?.year})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPreview}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800 transition-colors"
                >
                  <Printer size={14} />
                  <span>Cetak Dokumen</span>
                </button>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-200/50 p-4 overflow-auto flex justify-center">
              <iframe
                srcDoc={htmlPreview}
                title="Slip Gaji Preview"
                className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-xl rounded-lg border border-slate-300"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
