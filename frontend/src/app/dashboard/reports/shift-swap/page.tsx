"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { User, Calendar, Filter, AlertCircle, ArrowRightLeft, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import Pagination from "@/components/Pagination";
import { ReportSkeleton } from "@/components/Skeleton";
import ReportPeriodFilter, { PeriodState, computePeriodState } from "@/components/ReportPeriodFilter";

export default function ReportsShiftSwapPage() {
  const [loading, setLoading] = useState(true);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [page, setPage] = useState(1);
  
  // Period filter state
  const [currentPeriod, setCurrentPeriod] = useState<PeriodState>(() => {
    const now = new Date();
    return computePeriodState(String(now.getMonth() + 1).padStart(2, "0"), now.getFullYear());
  });

  // Utils to get local date string YYYY-MM-DD
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filters
  const [startDate, setStartDate] = useState(getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [endDate, setEndDate] = useState(getLocalDateString(new Date()));
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const handlePeriodChange = (period: PeriodState) => {
    setCurrentPeriod(period);
    if (!period.isAllTime) {
      if (period.startDate) setStartDate(period.startDate);
      if (period.endDate) setEndDate(period.endDate);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchReport(1);
  }, []);

  useEffect(() => {
    fetchReport(page);
  }, [page, startDate, endDate]);

  const fetchEmployees = async () => {
    try {
      const res = await axiosInstance.get("/employees?per_page=100");
      const rawData = res.data.data;
      setEmployees(Array.isArray(rawData) ? rawData : (rawData?.data || []));
    } catch (e) {
      console.error("Gagal mengambil data karyawan", e);
    }
  };

  const fetchReport = async (pageNumber = 1) => {
    try {
      setFetchingPreview(true);
      const res = await axiosInstance.get(`/shift-swap/report?page=${pageNumber}&start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}${selectedStatus ? `&status=${selectedStatus}` : ""}`);
      const rawData = res.data.data;
      setReportData(Array.isArray(rawData) ? rawData : (rawData?.data || []));
      setPagination(rawData);
      setLoading(false);
    } catch (e) {
      console.error("Gagal mengambil preview report", e);
    } finally {
      setFetchingPreview(false);
    }
  };

  const exportShiftSwapToExcel = async () => {
    try {
      const response = await axiosInstance.get(`/shift-swap/export?start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}${selectedStatus ? `&status=${selectedStatus}` : ""}`, {
        responseType: 'blob',
      });
      const periodSlug = currentPeriod.periodLabel.replaceAll(/[\s()/]+/g, '_');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Tukar_Shift_${periodSlug}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Gagal mendownload laporan Excel", e);
      toast.error("Gagal mengunduh Laporan Excel.");
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'approved': return <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 w-fit"><CheckCircle2 size={10} /> Selesai</span>;
      case 'rejected': return <span className="text-red-600 font-bold text-[10px] bg-red-50 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 w-fit">Ditolak</span>;
      case 'pending_receiver': return <span className="text-blue-600 font-bold text-[10px] bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 w-fit"><Clock size={10} /> Menunggu Rekan</span>;
      case 'pending_manager': return <span className="text-amber-600 font-bold text-[10px] bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 w-fit"><Clock size={10} /> Menunggu Atasan</span>;
      default: return <span className="text-gray-600 font-bold text-[10px] bg-gray-50 px-2 py-0.5 rounded uppercase tracking-wider w-fit">{status}</span>;
    }
  };

  if (loading) {
    return <ReportSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Laporan Pertukaran Shift</h1>
          <p className="dash-page-desc">Audit riwayat pertukaran jadwal antar karyawan dalam periode tertentu.</p>
        </div>
      </div>

      {/* Period Filter with Export */}
      <ReportPeriodFilter
        reportTitle="Laporan Pertukaran Shift"
        onPeriodChange={handlePeriodChange}
        onExportExcel={exportShiftSwapToExcel}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={12} /> Dari Tanggal
          </label>
          <input 
            type="date" 
            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 transition-all bg-gray-50/50"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={12} /> Sampai Tanggal
          </label>
          <input 
            type="date" 
            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 transition-all bg-gray-50/50"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <User size={12} /> Pilih Karyawan
          </label>
          <select 
            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 transition-all bg-gray-50/50"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">Semua Karyawan</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Filter size={12} /> Status
          </label>
          <select 
            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 transition-all bg-gray-50/50"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="approved">Selesai (Approved)</option>
            <option value="pending_receiver">Menunggu Rekan</option>
            <option value="pending_manager">Menunggu Atasan</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>
        <div className="flex items-end">
           <button 
            type="button" 
            onClick={() => { setPage(1); fetchReport(1); }}
            className="w-full h-10 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-gray-200 uppercase tracking-widest"
           >
             <Filter size={15} />
             Filter
           </button>
        </div>
      </div>

      <div className="dash-table-container min-h-[400px]">
        {fetchingPreview ? (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-gray-100 border-t-[#8B0000] rounded-full animate-spin mb-4" />
            <p className="text-gray-400 text-xs font-medium tracking-wider uppercase">Memuat Data Report...</p>
          </div>
        ) : reportData.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center opacity-60">
            <AlertCircle size={48} className="text-gray-200 mb-4" />
            <h3 className="font-bold text-gray-400 text-sm tracking-widest uppercase">Laporan Kosong</h3>
            <p className="text-gray-400 text-xs mt-1">Gunakan filter untuk memperluas pencarian Anda.</p>
          </div>
        ) : (
          <div className="dash-table-wrapper">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Waktu Pengajuan</th>
                  <th>Pengaju</th>
                  <th>Rekan Kerja</th>
                  <th>Pertukaran Jadwal</th>
                  <th>Status</th>
                  <th>Disetujui Oleh</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-[11px] text-gray-500">
                       {new Date(row.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 text-xs">{row.requester?.name}</span>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Requester</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 text-xs">{row.receiver?.name}</span>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Receiver</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 py-1">
                        <div className="px-2 py-1 bg-gray-50 rounded border border-gray-100 flex flex-col items-center min-w-[70px]">
                           <span className="text-[9px] font-black text-gray-400">{new Date(row.requester_schedule?.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                           <span className="text-[10px] font-bold text-[#8B0000]">{row.requester_schedule?.shift?.name}</span>
                        </div>
                        <ArrowRightLeft size={12} className="text-gray-300" />
                        <div className="px-2 py-1 bg-gray-50 rounded border border-gray-100 flex flex-col items-center min-w-[70px]">
                           <span className="text-[9px] font-black text-gray-400">{new Date(row.receiver_schedule?.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                           <span className="text-[10px] font-bold text-blue-600">{row.receiver_schedule?.shift?.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {getStatusLabel(row.status)}
                    </td>
                    <td>
                       {row.approver ? (
                         <div className="flex flex-col">
                           <span className="text-xs font-bold text-gray-700">{row.approver.name}</span>
                           <span className="text-[9px] text-gray-400">Atasan/Manager</span>
                         </div>
                       ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.total > 0 && (
           <div className="border-t border-gray-50 flex items-center justify-between p-4 bg-gray-50/20">
              <span className="text-xs text-gray-400 font-medium tracking-tight">Menampilkan {reportData.length} data pertukaran</span>
              <Pagination 
                currentPage={pagination.current_page} 
                lastPage={pagination.last_page} 
                total={pagination.total} 
                onPageChange={setPage} 
              />
           </div>
        )}
      </div>
    </div>
  );
}
