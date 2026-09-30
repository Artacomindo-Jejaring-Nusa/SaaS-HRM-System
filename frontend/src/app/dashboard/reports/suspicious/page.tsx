"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { 
  User, 
  Calendar, 
  Filter, 
  ChevronRight, 
  FileSpreadsheet, 
  AlertCircle, 
  ShieldAlert,
  MapPin,
  Smartphone,
  UserX,
  Camera
} from "lucide-react";
import Pagination from "@/components/Pagination";
import { ReportSkeleton } from "@/components/Skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
export default function SuspiciousAttendanceReportPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [page, setPage] = useState(1);
  
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
  const [suspiciousType, setSuspiciousType] = useState("");

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchHistory(page);
  }, [page, startDate, endDate, selectedUser, suspiciousType]);

  const fetchEmployees = async () => {
    try {
      const res = await axiosInstance.get("/employees?per_page=100");
      const rawData = res.data.data;
      setEmployees(Array.isArray(rawData) ? rawData : (rawData?.data || []));
    } catch (e) {
      console.error("Gagal mengambil data karyawan", e);
    }
  };

  const fetchHistory = async (pageNumber = 1) => {
    try {
      setFetchingPreview(true);
      const res = await axiosInstance.get(`/attendance/suspicious?page=${pageNumber}&start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}${suspiciousType ? `&type=${suspiciousType}` : ""}`);
      const rawData = res.data.data;
      setHistory(Array.isArray(rawData) ? rawData : (rawData?.data || []));
      setPagination(rawData);
      setLoading(false);
    } catch (e) {
      console.error("Gagal mengambil preview data mencurigakan", e);
    } finally {
      setFetchingPreview(false);
    }
  };

  if (loading) {
    return <ReportSkeleton />;
  }

  const exportToExcel = async () => {
    try {
      const response = await axiosInstance.get(`/attendance/export?is_suspicious=1&start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Kehadiran_Mencurigakan_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Gagal mengunduh laporan", e);
      toast.error("Gagal mengunduh Laporan Excel.");
    }
  };

  const getSuspiciousBadge = (reason: string) => {
    if (!reason) return <span className="text-gray-400 font-bold text-[10px] bg-gray-50 px-2 py-0.5 rounded uppercase tracking-wider">Unmarked</span>;
    
    if (reason.toLowerCase().includes('fake gps') || reason.toLowerCase().includes('gps spoofing')) {
      return (
        <span className="flex items-center gap-1.5 text-rose-600 font-bold text-[10px] bg-rose-50 px-2 py-0.5 rounded uppercase tracking-wider border border-rose-100 shadow-sm">
          <MapPin size={10} className="shrink-0" /> Lokasi Palsu
        </span>
      );
    }
    
    if (reason.toLowerCase().includes('device') || reason.toLowerCase().includes('hp')) {
      return (
        <span className="flex items-center gap-1.5 text-amber-600 font-bold text-[10px] bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider border border-amber-100 shadow-sm">
          <Smartphone size={10} className="shrink-0" /> Perangkat Berbeda
        </span>
      );
    }

    if (reason.toLowerCase().includes('face') || reason.toLowerCase().includes('wajah')) {
      return (
        <span className="flex items-center gap-1.5 text-violet-600 font-bold text-[10px] bg-violet-50 px-2 py-0.5 rounded uppercase tracking-wider border border-violet-100 shadow-sm">
          <UserX size={10} className="shrink-0" /> Wajah Tidak Cocok
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 text-orange-600 font-bold text-[10px] bg-orange-50 px-2 py-0.5 rounded uppercase tracking-wider border border-orange-100 shadow-sm">
        <ShieldAlert size={10} className="shrink-0" /> {reason}
      </span>
    );
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="dash-page-header">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shadow-sm border border-rose-100">
             <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="dash-page-title text-rose-900 font-black tracking-tight">{t('suspicious_attendance_report')}</h1>
            <p className="dash-page-desc font-medium">Audit dan pantau aktivitas absensi yang terdeteksi sebagai anomali atau kecurangan.</p>
          </div>
        </div>
        <div className="dash-page-actions">
          <button className="dash-btn dash-btn-primary bg-rose-600 hover:bg-rose-700 text-white! shadow-lg shadow-rose-200" onClick={exportToExcel}>
            <FileSpreadsheet size={15} />
            Unduh Laporan (Excel)
          </button>
        </div>
      </div>

      {/* Filters Container */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 mb-8 overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
           <Filter size={120} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={14} className="text-rose-500" /> Dari Tanggal
            </label>
            <input 
              type="date" 
              className="w-full h-11 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all bg-gray-50/30 font-bold text-gray-700"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={14} className="text-rose-500" /> Sampai Tanggal
            </label>
            <input 
              type="date" 
              className="w-full h-11 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all bg-gray-50/30 font-bold text-gray-700"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <User size={14} className="text-rose-500" /> Pilih Karyawan
            </label>
            <select 
              className="w-full h-11 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all bg-gray-50/30 font-bold text-gray-700"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">Semua Karyawan</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert size={14} className="text-rose-500" /> Tipe Kecurigaan
            </label>
            <select 
              className="w-full h-11 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all bg-gray-50/30 font-bold text-gray-700"
              value={suspiciousType}
              onChange={(e) => setSuspiciousType(e.target.value)}
            >
              <option value="">Semua Tipe</option>
              <option value="fake_gps">Lokasi Palsu (Fake GPS)</option>
              <option value="device_id">Perangkat Ganti</option>
              <option value="face">Wajah Tidak Cocok</option>
              <option value="manual">Ditandai Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="dash-table-container min-h-[400px] border border-gray-100 shadow-2xl shadow-gray-200/50 rounded-3xl overflow-hidden bg-white">
        {fetchingPreview ? (
          <div className="p-32 text-center flex flex-col items-center">
            <div className="w-14 h-14 border-4 border-rose-100 border-t-rose-600 rounded-full animate-spin mb-6" />
            <p className="text-rose-900/40 text-xs font-black tracking-widest uppercase">Menganalisis Data...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="p-24 text-center flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-rose-50 flex items-center justify-center text-rose-200 mb-6">
               <AlertCircle size={48} />
            </div>
            <h3 className="font-black text-rose-900/30 text-lg tracking-widest uppercase">Aman Terkendali</h3>
            <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto">Tidak ada penemuan absensi mencurigakan pada rentang waktu ini.</p>
          </div>
        ) : (
          <div className="dash-table-wrapper overflow-x-auto">
            <table className="dash-table w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Tanggal & Jam</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Karyawan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Kategori Kecurigaan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Bukti Foto</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Koordinat Peserta</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-rose-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col">
                         <span className="font-bold text-gray-900 text-sm">
                           {new Date(row.check_in).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                         </span>
                         <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wide">
                           {new Date(row.check_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                         </span>
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 overflow-hidden shadow-sm">
                           {row.user?.profile_photo_path ? (
                             <img src={`/storage/${row.user.profile_photo_path}`} alt="" className="w-full h-full object-cover" />
                           ) : <User size={20} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-gray-900 text-sm group-hover:text-rose-700 transition-colors">{row.user?.name}</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">ID: {row.user?.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getSuspiciousBadge(row.suspicious_reason || row.status)}
                    </td>
                    <td className="px-6 py-4">
                       {row.image_in ? (
                         <div className="relative w-12 h-12 rounded-lg border-2 border-white shadow-sm overflow-hidden bg-gray-50 cursor-zoom-in group-hover:scale-110 transition-transform">
                            <img 
                              src={`/storage/${row.image_in}`} 
                              alt="Selfie" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <Camera size={12} className="text-white" />
                            </div>
                         </div>
                       ) : (
                         <span className="text-[10px] font-bold text-gray-300 uppercase">Tidak Ada Foto</span>
                       )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center gap-2 text-gray-500 hover:text-rose-600 transition-colors">
                          <MapPin size={14} className="shrink-0" />
                          <span className="text-[11px] font-bold font-mono tracking-tighter">
                            {Number(row.latitude_in).toFixed(5)}, {Number(row.longitude_in).toFixed(5)}
                          </span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <button className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-rose-600 shadow-sm border border-transparent hover:border-rose-100 transition-all">
                          <ChevronRight size={18} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.total > 0 && (
           <div className="border-t border-gray-50 flex items-center justify-between p-6 bg-gray-50/30">
              <span className="text-xs text-gray-400 font-black tracking-widest uppercase opacity-60">MENAMPILKAN {history.length} DATA ANOMALI</span>
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
