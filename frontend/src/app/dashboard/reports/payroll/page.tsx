"use client";

import { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Download, Search, FileSpreadsheet, Calendar, 
  Users, TrendingUp, DollarSign, Loader2, ArrowRight,
  ShieldCheck, Clock, UserX, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { ReportSkeleton } from "@/components/Skeleton";

interface SalaryRow {
  id: number;
  user_id: number;
  month: string;
  year: number;
  basic_salary: number;
  department: string;
  working_days: number;
  total_working_days: number;
  earning_attendance_allowance: number;
  earning_overtime: number;
  earning_position_allowance?: number;
  earning_others?: number;
  total_earnings: number;
  deduction_bpjs_jht: number;
  deduction_bpjs_jp: number;
  deduction_bpjs_kes: number;
  deduction_late: number;
  deduction_absence: number;
  deduction_tax: number;
  total_deductions: number;
  net_salary: number;
  bank_name: string;
  bank_account_no: string;
  cost_center: string;
  status: string;
  user?: {
    id: number;
    name: string;
    email: string;
    ptkp_status?: string;
  };
}

export default function ReportsPayrollPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState<string | number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState("");

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const fetchPayrollReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/payroll/history', {
        params: { month: monthFilter, year: yearFilter }
      });
      setSalaries(res.data.data || []);
    } catch (e) {
      console.error("Gagal mengambil data laporan payroll:", e);
      toast.error("Gagal memuat rekap laporan payroll");
    } finally {
      setLoading(false);
    }
  }, [monthFilter, yearFilter]);

  useEffect(() => {
    fetchPayrollReport();
  }, [fetchPayrollReport]);

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      toast.info("Sedang mengunduh laporan Excel komprehensif...");
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
      toast.success("Laporan payroll berhasil diekspor ke Excel.");
    } catch (e) {
      console.error("Error exporting excel:", e);
      toast.error("Gagal mengekspor laporan payroll ke Excel.");
    } finally {
      setExporting(false);
    }
  };

  const filteredSalaries = salaries.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      (s.user?.name || "").toLowerCase().includes(q) ||
      (s.department || "").toLowerCase().includes(q) ||
      (s.bank_name || "").toLowerCase().includes(q) ||
      (s.cost_center || "").toLowerCase().includes(q)
    );
  });

  // Calculate totals
  const totalEmployees = filteredSalaries.length;
  const totalGross = filteredSalaries.reduce((acc, s) => acc + (parseFloat(s.total_earnings as any) || 0), 0);
  const totalDeductions = filteredSalaries.reduce((acc, s) => acc + (parseFloat(s.total_deductions as any) || 0), 0);
  const totalNetTHP = filteredSalaries.reduce((acc, s) => acc + (parseFloat(s.net_salary as any) || 0), 0);
  const totalLateDeductions = filteredSalaries.reduce((acc, s) => acc + (parseFloat(s.deduction_late as any) || 0), 0);
  const totalAbsenceDeductions = filteredSalaries.reduce((acc, s) => acc + (parseFloat(s.deduction_absence as any) || 0), 0);

  if (loading && salaries.length === 0) {
    return <ReportSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <div className="dash-page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="dash-page-title">Rekap Laporan Penggajian (Payroll Report)</h1>
          <p className="dash-page-desc">
            Laporan lengkap penghasilan, potongan BPJS, pemotongan disiplin (telat & alfa), PPh 21, dan take-home pay (THP) karyawan.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            className="dash-btn dash-btn-primary bg-[#107c41] hover:bg-[#0c6130] text-white flex items-center gap-2 px-6 h-12 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50" 
            onClick={handleExportExcel}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
            Export Laporan Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-13 h-13 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Karyawan</p>
            <h3 className="text-2xl font-black text-gray-900 mt-0.5">{totalEmployees} Orang</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-13 h-13 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Gaji Kotor (Gross)</p>
            <h3 className="text-xl font-black text-emerald-700 mt-0.5">Rp {Math.round(totalGross).toLocaleString('id-ID')}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-13 h-13 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Potongan Disiplin (Telat & Alfa)</p>
            <h3 className="text-xl font-black text-rose-600 mt-0.5">Rp {Math.round(totalLateDeductions + totalAbsenceDeductions).toLocaleString('id-ID')}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-13 h-13 bg-red-50 text-[#8B0000] rounded-2xl flex items-center justify-center">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Bersih (Net THP)</p>
            <h3 className="text-xl font-black text-[#8B0000] mt-0.5">Rp {Math.round(totalNetTHP).toLocaleString('id-ID')}</h3>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Cari nama, jabatan, bank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-gray-50 border-none rounded-xl font-medium text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#8B0000]/20"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
            <Calendar size={14} /> Periode:
          </div>
          <select 
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="h-11 bg-gray-50 border-none rounded-xl px-4 font-bold text-xs text-gray-700 outline-none focus:ring-2 focus:ring-[#8B0000]/20"
          >
            <option value="all">Semua Bulan</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select 
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="h-11 bg-gray-50 border-none rounded-xl px-4 font-bold text-xs text-gray-700 outline-none focus:ring-2 focus:ring-[#8B0000]/20"
          >
            <option value="all">Semua Tahun</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/70 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="py-4 px-6 pl-8">Karyawan</th>
                <th className="py-4 px-4">Periode</th>
                <th className="py-4 px-4">Gaji Pokok</th>
                <th className="py-4 px-4">Tunjangan & Lembur</th>
                <th className="py-4 px-4">Pot. Disiplin (Telat/Alfa)</th>
                <th className="py-4 px-4">Pot. BPJS & PPh21</th>
                <th className="py-4 px-4">Take Home Pay (THP)</th>
                <th className="py-4 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSalaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400 italic">
                    Belum ada data payroll untuk periode yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredSalaries.map((s) => {
                  const discDeduction = (parseFloat(s.deduction_late as any) || 0) + (parseFloat(s.deduction_absence as any) || 0);
                  const taxAndBpjs = (parseFloat(s.deduction_bpjs_jht as any) || 0) + 
                                     (parseFloat(s.deduction_bpjs_jp as any) || 0) + 
                                     (parseFloat(s.deduction_bpjs_kes as any) || 0) + 
                                     (parseFloat(s.deduction_tax as any) || 0);
                  const allowances = (parseFloat(s.total_earnings as any) || 0) - (parseFloat(s.basic_salary as any) || 0);

                  return (
                    <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-6 pl-8">
                        <span className="font-bold text-gray-900 block">{s.user?.name || "Karyawan"}</span>
                        <span className="text-xs text-gray-400 font-medium block">{s.department || "-"} • {s.bank_name || "-"} ({s.bank_account_no || "-"})</span>
                      </td>
                      <td className="py-4 px-4 text-xs font-bold text-gray-600">
                        {s.month} {s.year}
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-700">
                        Rp {Math.round(parseFloat(s.basic_salary as any) || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-4 font-semibold text-emerald-600">
                        +Rp {Math.round(allowances).toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-4 font-semibold text-rose-600">
                        {discDeduction > 0 ? `-Rp ${Math.round(discDeduction).toLocaleString('id-ID')}` : 'Rp 0'}
                      </td>
                      <td className="py-4 px-4 font-semibold text-orange-600">
                        -Rp {Math.round(taxAndBpjs).toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-4 font-black text-[#8B0000] text-base">
                        Rp {Math.round(parseFloat(s.net_salary as any) || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`px-3 py-1 text-[11px] font-bold rounded-full border inline-flex items-center gap-1 ${
                          s.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          s.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          s.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {s.status === 'paid' ? 'Terbayar' : s.status === 'approved' ? 'Disetujui' : s.status === 'rejected' ? 'Ditolak' : 'Draft'}
                        </span>
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
  );
}
