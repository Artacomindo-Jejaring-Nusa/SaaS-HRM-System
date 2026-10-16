"use client";

import { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Search, FileSpreadsheet, Calendar, 
  Users, TrendingUp, DollarSign, Loader2, Clock, CheckSquare, Square
} from "lucide-react";
import { toast } from "sonner";
import { ReportSkeleton } from "@/components/Skeleton";
import ReportPeriodFilter, { PeriodState, computePeriodState } from "@/components/ReportPeriodFilter";

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

function parseAmount(val: number | string | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const parsed = Number.parseFloat(val);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getPayrollStatusBadgeClass(status?: string): string {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'approved') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function getPayrollStatusLabel(status?: string): string {
  if (status === 'paid') return 'Terbayar';
  if (status === 'approved') return 'Disetujui';
  if (status === 'rejected') return 'Ditolak';
  return 'Draft';
}

const MONTH_NAMES_EN = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function ReportsPayrollPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [monthFilter, setMonthFilter] = useState(() => {
    const m = new Date().getMonth() + 1;
    return MONTH_NAMES_EN[m];
  });
  const [yearFilter, setYearFilter] = useState<string | number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  // Period filter state
  const [currentPeriod, setCurrentPeriod] = useState<PeriodState>(() => {
    const now = new Date();
    return computePeriodState(String(now.getMonth() + 1).padStart(2, "0"), now.getFullYear());
  });

  const handlePeriodChange = (period: PeriodState) => {
    setCurrentPeriod(period);
    setSelectedIds([]);
    if (period.isAllTime) {
      setMonthFilter("all");
      setYearFilter("all");
    } else {
      if (period.month === "all") {
        setMonthFilter("all");
      } else {
        const mIdx = parseInt(period.month, 10);
        setMonthFilter(MONTH_NAMES_EN[mIdx] || period.month);
      }
      setYearFilter(period.year);
    }
  };

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
      const periodSlug = currentPeriod.periodLabel.replace(/[\s\(\)\/]+/g, '_');
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Payroll_${periodSlug}.xlsx`);
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

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} data payroll terpilih? Tindakan ini permanen.`)) {
      return;
    }

    try {
      setIsDeletingSelected(true);
      const res = await axiosInstance.post("/manager/purge-current-month", {
        module: "payroll",
        ids: selectedIds,
      });
      toast.success(res.data?.message || `${selectedIds.length} data payroll berhasil dihapus.`);
      setSelectedIds([]);
      await fetchPayrollReport();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Gagal menghapus data payroll.");
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const handlePurgePeriod = async (period: PeriodState) => {
    try {
      setIsPurging(true);
      const res = await axiosInstance.post("/manager/purge-current-month", {
        module: "payroll",
        period: period.periodKey,
        start_date: period.startDate,
        end_date: period.endDate,
      });
      toast.success(res.data?.message || "Data payroll pada periode berhasil dibersihkan.");
      setSelectedIds([]);
      await fetchPayrollReport();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Gagal membersihkan data payroll periode ini.");
      throw e;
    } finally {
      setIsPurging(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSalaries.length && filteredSalaries.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSalaries.map(item => item.id));
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
  const totalGross = filteredSalaries.reduce((acc, s) => acc + parseAmount(s.total_earnings), 0);
  const totalNetTHP = filteredSalaries.reduce((acc, s) => acc + parseAmount(s.net_salary), 0);
  const totalLateDeductions = filteredSalaries.reduce((acc, s) => acc + parseAmount(s.deduction_late), 0);
  const totalAbsenceDeductions = filteredSalaries.reduce((acc, s) => acc + parseAmount(s.deduction_absence), 0);

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
        <div className="dash-page-actions">
           <div className="bg-gray-100 px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase">
                {selectedIds.length > 0 ? `${selectedIds.length} Terpilih` : 'Total Data:'}
              </span>
              <span className="text-sm font-bold text-[#8B0000]">
                {selectedIds.length > 0 ? selectedIds.length : totalEmployees} Baris
              </span>
           </div>
        </div>
      </div>

      {/* Period Filter with Export & Purge */}
      <ReportPeriodFilter
        reportTitle="Laporan Penggajian (Payroll)"
        onPeriodChange={handlePeriodChange}
        onExportExcel={handleExportExcel}
        selectedCount={selectedIds.length}
        onDeleteSelected={handleDeleteSelected}
        isDeletingSelected={isDeletingSelected}
        canPurge={true}
        onPurgePeriod={handlePurgePeriod}
        isPurging={isPurging}
      />

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

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Cari nama karyawan, jabatan, bank, atau rekening..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-gray-50 border-none rounded-xl font-medium text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#8B0000]/20"
          />
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/70 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="py-4 px-4 w-10">
                   <button 
                      title="Select All"
                      onClick={toggleSelectAll}
                      className="text-gray-400 hover:text-[#8B0000] transition-colors"
                   >
                     {selectedIds.length === filteredSalaries.length && filteredSalaries.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                   </button>
                </th>
                <th className="py-4 px-6">Karyawan</th>
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
                  <td colSpan={9} className="text-center py-16 text-gray-400 italic">
                    Belum ada data payroll untuk periode yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredSalaries.map((s) => {
                  const discDeduction = parseAmount(s.deduction_late) + parseAmount(s.deduction_absence);
                  const taxAndBpjs = parseAmount(s.deduction_bpjs_jht) + 
                                     parseAmount(s.deduction_bpjs_jp) + 
                                     parseAmount(s.deduction_bpjs_kes) + 
                                     parseAmount(s.deduction_tax);
                  const allowances = parseAmount(s.total_earnings) - parseAmount(s.basic_salary);
                  const isSelected = selectedIds.includes(s.id);

                  return (
                    <tr key={s.id} className={`hover:bg-gray-50/80 transition-colors ${isSelected ? 'bg-red-50/30' : ''}`}>
                      <td className="py-4 px-4">
                        <button 
                          title="Select Row"
                          onClick={() => toggleSelect(s.id)}
                          className={`${isSelected ? 'text-[#8B0000]' : 'text-gray-300'} hover:text-[#8B0000] transition-colors`}
                        >
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-gray-900 block">{s.user?.name || "Karyawan"}</span>
                        <span className="text-xs text-gray-400 font-medium block">{s.department || "-"} • {s.bank_name || "-"} ({s.bank_account_no || "-"})</span>
                      </td>
                      <td className="py-4 px-4 text-xs font-bold text-gray-600">
                        {s.month} {s.year}
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-700">
                        Rp {Math.round(parseAmount(s.basic_salary)).toLocaleString('id-ID')}
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
                        Rp {Math.round(parseAmount(s.net_salary)).toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`px-3 py-1 text-[11px] font-bold rounded-full border inline-flex items-center gap-1 ${getPayrollStatusBadgeClass(s.status)}`}>
                          {getPayrollStatusLabel(s.status)}
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
