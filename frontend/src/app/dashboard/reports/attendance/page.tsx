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
  Map as MapIcon, 
  BarChart3, 
  History, 
  ShieldAlert,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Smartphone,
  UserX,
  Camera,
  Edit2,
  Save,
  X
} from "lucide-react";
import Pagination from "@/components/Pagination";
import { ReportSkeleton } from "@/components/Skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

// Nested Components for each Tab
const LogView = ({ employees, startDate, endDate, selectedUser, onStartDateChange, onEndDateChange, onUserChange }: any) => {
  const { hasPermission } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Correction Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [editData, setEditData] = useState<any>({ check_out: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Fetch with high per_page to load all logs for the pivot table
      const res = await axiosInstance.get(`/attendance/history?per_page=1000&start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}`);
      const rawData = res.data.data;
      setHistory(Array.isArray(rawData) ? rawData : (rawData?.data || rawData || []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchHistory(); 
  }, [startDate, endDate, selectedUser]);

  const handleEditClick = (row: any) => {
    setSelectedRow(row);
    // Format date for datetime-local input
    const outDate = row.check_out ? new Date(row.check_out) : new Date(row.check_in);
    const offset = outDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(outDate.getTime() - offset)).toISOString().slice(0, 16);
    
    setEditData({ check_out: localISOTime });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      await axiosInstance.put(`/attendance/${selectedRow.id}`, {
        check_out: editData.check_out
      });
      toast.success("Absensi berhasil diperbarui!");
      setIsEditModalOpen(false);
      fetchHistory();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal memperbarui absensi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to format local date key "YYYY-MM-DD"
  const getLocalDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Generate date list between startDate and endDate
  const dateList: Date[] = [];
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const temp = new Date(start);
    let limit = 0;
    while (temp <= end && limit < 45) { // Limit to 45 days max to prevent horizontal explosion
      dateList.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
      limit++;
    }
  }

  // Group history logs in memory for fast lookup O(1)
  const attendanceMap: Record<string, any> = {};
  history.forEach((record: any) => {
    if (record.check_in) {
      const dateStr = record.check_in.includes(' ') 
        ? record.check_in.split(' ')[0] 
        : record.check_in.split('T')[0];
      const key = `${record.user_id}_${dateStr}`;
      attendanceMap[key] = record;
    }
  });

  const getIndoDayName = (date: Date) => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    return days[date.getDay()];
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp: any) => {
    const matchesSearch = emp.name.toLowerCase().includes(employeeSearch.toLowerCase());
    const matchesUser = selectedUser ? String(emp.id) === String(selectedUser) : true;
    return matchesSearch && matchesUser;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      {/* Filters & Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6 bg-white p-4 rounded-xl border border-[#ebedf0] shadow-sm">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={12} className="text-[#8B0000]" /> Dari Tanggal
          </label>
          <input type="date" className="w-full px-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={12} className="text-[#8B0000]" /> Sampai Tanggal
          </label>
          <input type="date" className="w-full px-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <User size={12} className="text-[#8B0000]" /> Pilih Karyawan
          </label>
          <select className="w-full px-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15" value={selectedUser} onChange={(e) => onUserChange(e.target.value)}>
            <option value="">Semua Karyawan</option>
            {employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Search size={12} className="text-[#8B0000]" /> Cari Nama
          </label>
          <input 
            type="text" 
            placeholder="Cari nama karyawan..." 
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15" 
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Pivot Table spreadsheet container */}
      <div className="bg-white rounded-xl border border-[#ebedf0] overflow-hidden shadow-sm min-h-[400px]">
        {loading ? (
          <div className="p-32 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-gray-100 border-t-[#8B0000] rounded-full animate-spin mb-4" />
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Mempersiapkan Pivot Table...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-24 text-center flex flex-col items-center opacity-40">
             <AlertCircle size={64} className="mb-4 text-[#8B0000]/20" />
             <h3 className="font-bold text-gray-900 tracking-wider uppercase">Data Kosong</h3>
             <p className="text-xs">Tidak ada karyawan yang cocok.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto relative scrollbar-thin">
            <table className="text-left border-collapse table-fixed" style={{ width: `${220 + dateList.length * 85 + 215}px`, minWidth: '100%' }}>
              <thead>
                <tr className="bg-[#f9f9fb] border-b border-[#ebedf0]">
                  {/* Sticky left Employee header */}
                  <th className="sticky left-0 bg-[#f9f9fb] z-30 px-4 py-3 text-xs font-bold text-[#5f6368] uppercase tracking-wider min-w-[220px] max-w-[220px] w-[220px] border-r border-[#ebedf0] shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                    Karyawan
                  </th>
                  
                  {/* Date Column headers */}
                  {dateList.map((date, idx) => {
                    const isWk = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th 
                        key={idx} 
                        className={`px-2 py-2 text-center text-[10px] font-bold uppercase tracking-tighter min-w-[85px] max-w-[85px] w-[85px] border-r border-[#ebedf0] leading-tight ${isWk ? 'bg-rose-50/40 text-rose-600' : 'text-[#5f6368]'}`}
                      >
                        <div>{date.getDate()} {getIndoDayName(date)}</div>
                        <div className="text-[8px] text-gray-400 font-normal mt-0.5">
                          {date.toLocaleString('id-ID', { month: 'short' })}
                        </div>
                      </th>
                    );
                  })}

                  {/* Summary columns */}
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-[#03543f] uppercase tracking-wider min-w-[70px] max-w-[70px] w-[70px] bg-[#def7ec]/30 border-r border-[#ebedf0]">
                    Hadir
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-[#723b13] uppercase tracking-wider min-w-[70px] max-w-[70px] w-[70px] bg-[#fdf6b2]/30 border-r border-[#ebedf0]">
                    Telat
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-[#9b1c1c] uppercase tracking-wider min-w-[75px] max-w-[75px] w-[75px] bg-[#fde8e8]/30">
                    Lupa Out
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebedf0]">
                {filteredEmployees.map((emp: any, rowIdx: number) => {
                  let totalPresent = 0;
                  let totalLate = 0;
                  let totalMissedOut = 0;

                  return (
                    <tr key={emp.id} className="hover:bg-[#f9f9fb] transition-colors group">
                      {/* Sticky left Employee body cell */}
                      <td className="sticky left-0 bg-white group-hover:bg-[#f9f9fb] z-20 px-4 py-3 border-r border-[#ebedf0] shadow-[2px_0_5px_rgba(0,0,0,0.04)] transition-colors min-w-[220px] max-w-[220px] w-[220px]">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                            style={{ 
                              background: `hsl(${(rowIdx * 53 + 20) % 360}, 50%, 45%)` 
                            }}
                          >
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-xs text-[#1a1a2e] truncate">{emp.name}</span>
                            <span className="text-[9px] text-[#8c8fa3] font-mono leading-none mt-0.5">NIK: {emp.nik || `EMP${emp.id}`}</span>
                          </div>
                        </div>
                      </td>

                      {/* Render Attendance matrix cells */}
                      {dateList.map((date, dateIdx) => {
                        const dateStr = getLocalDateKey(date);
                        const key = `${emp.id}_${dateStr}`;
                        const record = attendanceMap[key];
                        const isWk = date.getDay() === 0 || date.getDay() === 6;

                        let checkInStr = "";
                        let checkOutStr = "";
                        let cellStyle = "text-gray-300 bg-white";

                        if (record) {
                          const checkInTime = new Date(record.check_in);
                          checkInStr = checkInTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                          
                          if (record.check_out) {
                            const checkOutTime = new Date(record.check_out);
                            checkOutStr = checkOutTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                          } else {
                            checkOutStr = "Lupa";
                            totalMissedOut++;
                          }

                          if (record.status === 'late') {
                            totalLate++;
                            totalPresent++;
                            cellStyle = "bg-amber-50 text-amber-800 border border-amber-100/70 rounded-md shadow-[inset_0_0_0_1px_rgba(217,119,6,0.1)]";
                          } else {
                            totalPresent++;
                            cellStyle = "bg-emerald-50 text-emerald-800 border border-emerald-100/70 rounded-md shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]";
                          }
                        } else if (isWk) {
                          cellStyle = "bg-rose-50/10 text-rose-300 font-normal text-[9px]";
                        }

                        return (
                          <td 
                            key={dateIdx} 
                            onClick={() => record && handleEditClick(record)}
                            className={`px-1 py-1.5 text-center text-[10px] border-r border-[#ebedf0] align-middle select-none transition-all ${record ? 'cursor-pointer hover:brightness-95 hover:scale-95' : ''} ${isWk && !record ? 'bg-gray-50/40' : ''}`}
                          >
                            {record ? (
                              <div className={`py-1 px-1 flex flex-col items-center justify-center font-bold font-mono tracking-tighter ${cellStyle}`}>
                                <span className="leading-tight">{checkInStr}</span>
                                <span className={`text-[8px] leading-tight ${record.check_out ? 'opacity-65' : 'text-rose-500 font-extrabold uppercase'}`}>
                                  {checkOutStr}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-300 font-normal">
                                {isWk ? <span className="text-[9px] text-gray-300">Off</span> : "-"}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Dynamic Metrics summaries */}
                      <td className="px-2 py-3 text-center text-xs font-bold text-[#03543f] bg-[#def7ec]/15 border-r border-[#ebedf0]">
                        {totalPresent}
                      </td>
                      <td className="px-2 py-3 text-center text-xs font-bold text-[#723b13] bg-[#fdf6b2]/15 border-r border-[#ebedf0]">
                        {totalLate}
                      </td>
                      <td className="px-2 py-3 text-center text-xs font-bold text-[#9b1c1c] bg-[#fde8e8]/15">
                        {totalMissedOut}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Correction Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-[#ebedf0]">
             <div className="p-5 border-b border-[#ebedf0] flex items-center justify-between bg-[#f9f9fb]">
                <div className="flex items-center gap-3">
                   <div className="w-9 h-9 rounded-lg bg-[#8B0000] text-white flex items-center justify-center shadow-lg shadow-rose-100 shrink-0">
                      <Edit2 size={16} />
                   </div>
                   <div>
                      <h3 className="font-bold text-gray-900 text-sm">Koreksi Absensi</h3>
                      <p className="text-[10px] text-[#8B0000] font-bold uppercase tracking-wider">{selectedRow?.user?.name}</p>
                   </div>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                   <X size={18} />
                </button>
             </div>
             
             <div className="p-6 space-y-5">
                <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-lg flex items-start gap-2.5">
                   <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                   <div className="text-[11px] text-amber-900 font-medium leading-relaxed">
                      Lakukan koreksi jam keluar untuk karyawan yang lupa absen. Data yang diubah akan langsung diperbarui di sistem.
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-0.5 flex items-center gap-2">
                         <Clock size={11} className="text-[#8B0000]" /> Jam Masuk (Tercatat)
                      </label>
                      <div className="w-full px-3 py-2.5 rounded-lg border border-[#ebedf0] bg-gray-50 text-gray-400 font-semibold text-sm">
                         {new Date(selectedRow?.check_in).toLocaleString('id-ID')}
                      </div>
                   </div>

                   <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-0.5 flex items-center gap-2">
                         <Save size={11} className="text-[#8B0000]" /> Jam Keluar (Koreksi)
                      </label>
                      <input 
                        type="datetime-local" 
                        className="w-full px-3 py-2 rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15 text-sm font-semibold"
                        value={editData.check_out}
                        onChange={(e) => setEditData({ ...editData, check_out: e.target.value })}
                      />
                   </div>
                </div>
             </div>

             <div className="p-4 bg-[#f9f9fb] border-t border-[#ebedf0] flex gap-3">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2 text-xs text-[#5f6368] font-semibold bg-white border border-[#ebedf0] rounded-lg hover:bg-gray-50 transition-all"
                >
                   BATAL
                </button>
                <button 
                  onClick={handleUpdate}
                  disabled={isSubmitting}
                  className="flex-2 bg-[#8B0000] hover:bg-[#6d0000] text-white py-2 px-6 rounded-lg font-bold text-xs shadow-lg shadow-rose-100 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                   {isSubmitting ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                   SIMPAN KOREKSI
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryView = ({ startDate, endDate, selectedUser }: any) => {
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/attendance/summary?start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}`);
        setSummary(res.data.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchSummary();
  }, [startDate, endDate, selectedUser]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 flex flex-col gap-2">
             <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2">
                <CheckCircle2 size={20} />
             </div>
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Akumulasi Hadir</span>
             <h4 className="text-3xl font-black text-gray-900 leading-none">{summary.reduce((acc, curr) => acc + curr.total_present, 0)} <span className="text-lg text-emerald-500 opacity-50">Hari</span></h4>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 flex flex-col gap-2">
             <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-2">
                <Clock size={20} />
             </div>
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Terlambat</span>
             <h4 className="text-3xl font-black text-gray-900 leading-none">{summary.reduce((acc, curr) => acc + curr.total_late, 0)} <span className="text-lg text-amber-500 opacity-50">Kali</span></h4>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 flex flex-col gap-2 border-b-4 border-b-rose-500">
             <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 mb-2">
                <ShieldAlert size={20} />
             </div>
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Terdeteksi Anomali</span>
             <h4 className="text-3xl font-black text-gray-900 leading-none">{summary.reduce((acc, curr) => acc + curr.total_suspicious, 0)} <span className="text-lg text-rose-500 opacity-50">Kasus</span></h4>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 flex flex-col gap-2">
             <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                <History size={20} />
             </div>
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rata-rata Kehadiran</span>
             <h4 className="text-3xl font-black text-gray-900 leading-none">{(summary.reduce((acc, curr) => acc + curr.total_present, 0) / (summary.length || 1)).toFixed(1)} <span className="text-lg text-blue-500 opacity-50">D/m</span></h4>
          </div>
       </div>

       <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-50">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Karyawan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Presentase</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center text-emerald-600">Total Hadir</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center text-blue-600">Tepat Waktu</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center text-amber-600">Terlambat</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center text-rose-600">Suspicious</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {summary.map((row) => (
                  <tr key={row.user_id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-black text-gray-900 text-xs">{row.name}</td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                             <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (row.total_on_time / (row.total_present || 1)) * 100)}%` }} />
                          </div>
                          <span className="text-[10px] font-black text-gray-400">{Math.round((row.total_on_time / (row.total_present || 1)) * 100)}%</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center font-black text-sm text-gray-700">{row.total_present} Hari</td>
                    <td className="px-6 py-4 text-center font-black text-sm text-emerald-600">{row.total_on_time}</td>
                    <td className="px-6 py-4 text-center font-black text-sm text-amber-600">{row.total_late}</td>
                    <td className="px-6 py-4 text-center font-black text-sm text-rose-600 bg-rose-50/30 font-mono">{row.total_suspicious}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
       </div>
    </div>
  );
};

const SuspiciousView = ({ startDate, endDate, selectedUser }: any) => {
   const [history, setHistory] = useState<any[]>([]);
   const [loading, setLoading] = useState(false);

   useEffect(() => {
     const fetchData = async () => {
       setLoading(true);
       try {
         const res = await axiosInstance.get(`/attendance/suspicious?start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}`);
         setHistory(res.data.data.data || []);
       } catch (e) { console.error(e); }
       finally { setLoading(false); }
     };
     fetchData();
   }, [startDate, endDate, selectedUser]);

   const getSuspiciousBadge = (reason: string) => {
    if (!reason || reason === 'manual') return <span className="text-orange-600 font-bold text-[10px] bg-orange-50 px-2 py-0.5 rounded uppercase tracking-wider border border-orange-100 shadow-sm flex items-center gap-1.5 max-w-fit mx-auto"><ShieldAlert size={10} /> Fraudulent Activity</span>;
    
    if (reason.toLowerCase().includes('fake gps') || reason.toLowerCase().includes('gps spoofing')) {
      return (
        <span className="flex items-center gap-1.5 text-rose-600 font-bold text-[10px] bg-rose-50 px-2 py-0.5 rounded uppercase tracking-wider border border-rose-100 shadow-sm max-w-fit mx-auto">
          <MapPin size={10} /> Lokasi Palsu
        </span>
      );
    }
    
    if (reason.toLowerCase().includes('device')) {
      return (
        <span className="flex items-center gap-1.5 text-amber-600 font-bold text-[10px] bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider border border-amber-100 shadow-sm max-w-fit mx-auto">
          <Smartphone size={10} /> Device Mismatch
        </span>
      );
    }

    if (reason.toLowerCase().includes('face')) {
      return (
        <span className="flex items-center gap-1.5 text-violet-600 font-bold text-[10px] bg-violet-50 px-2 py-0.5 rounded uppercase tracking-wider border border-violet-100 shadow-sm max-w-fit mx-auto">
          <UserX size={10} /> Biometric Fail
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 text-orange-600 font-bold text-[10px] bg-orange-50 px-2 py-0.5 rounded uppercase tracking-wider border border-orange-100 shadow-sm max-w-fit mx-auto">
        <ShieldAlert size={10} /> {reason}
      </span>
    );
  };

   return (
     <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-3xl mb-8 flex items-center gap-6">
           <div className="w-16 h-16 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200 shrink-0">
              <ShieldAlert size={32} />
           </div>
           <div>
              <h3 className="text-rose-900 font-black text-lg tracking-tight uppercase">Audit Fraud Terdeteksi</h3>
              <p className="text-rose-700/60 text-sm font-medium">Rekaman berikut ditandai otomatis oleh sistem sebagai aktivitas mencurigakan yang memerlukan perhatian HR.</p>
           </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden min-h-[300px]">
           {loading ? (
             <div className="p-32 text-center flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-rose-100 border-t-rose-600 rounded-full animate-spin" />
             </div>
           ) : history.length === 0 ? (
             <div className="p-32 text-center flex flex-col items-center opacity-30">
                <CheckCircle2 size={64} className="text-emerald-500 mb-4" />
                <h4 className="font-black tracking-widest text-gray-900 uppercase">Tidak Ada Fraud</h4>
                <p className="text-xs">Semua rekaman absensi terlihat normal pada periode ini.</p>
             </div>
           ) : (
             <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-50 text-center">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Tanggal / Jam</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Karyawan</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Alasan Audit</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Bukti Foto</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Titik Koordinat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {history.map((row) => (
                      <tr key={row.id} className="hover:bg-rose-50/20 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex flex-col select-none">
                             <span className="font-black text-gray-900 text-xs">{new Date(row.check_in).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                             <span className="text-[10px] font-mono font-black text-rose-500">{new Date(row.check_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex flex-col">
                             <span className="font-black text-gray-900 text-xs">{row.user?.name}</span>
                             <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest font-mono italic">HP: {row.user?.device_id?.slice(-8) || '-'}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                           {getSuspiciousBadge(row.suspicious_reason)}
                        </td>
                        <td className="px-6 py-4 text-center">
                           {row.image_in ? (
                             <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-sm inline-block bg-gray-50 grayscale group-hover:grayscale-0 transition-all hover:scale-150 relative z-10">
                                <img src={`/storage/${row.image_in}`} alt="Evidence" className="w-full h-full object-cover" />
                             </div>
                           ) : <Camera size={16} className="text-gray-200 mx-auto" />}
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="flex items-center justify-center gap-2 text-rose-300 font-mono text-[9px] group-hover:text-rose-600 transition-colors">
                              <MapPin size={12} />
                              {Number(row.latitude_in).toFixed(5)}, {Number(row.longitude_in).toFixed(5)}
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           )}
        </div>
     </div>
   );
};

const CorrectionView = ({ startDate, endDate, selectedUser }: any) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/attendance-corrections?start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}`);
        setData(res.data.data.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [startDate, endDate, selectedUser]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden">
          <div className="p-8 border-b border-gray-50 bg-amber-50/20 flex items-center justify-between">
             <div>
                <h3 className="font-black text-gray-900 tracking-tight flex items-center gap-2">
                   <FileSpreadsheet size={20} className="text-amber-500" /> Audit Koreksi Kehadiran
                </h3>
                <p className="text-xs text-gray-400 font-medium">Rekaman riwayat perubahan data absen yang diajukan oleh karyawan.</p>
             </div>
             <button 
               onClick={async () => {
                  try {
                    const response = await axiosInstance.get(`/attendance-corrections/export?start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}`, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a'); link.href = url;
                    link.setAttribute('download', `Rekap_Koreksi_${startDate}_to_${endDate}.xlsx`);
                    document.body.appendChild(link); link.click(); link.remove();
                  } catch(e) { toast.error("Gagal export koreksi."); }
               }}
               className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-lg shadow-amber-100"
             >
                <FileSpreadsheet size={14} /> Export Laporan Excel
             </button>
          </div>
          {loading ? (
             <div className="p-32 text-center flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-amber-100 border-t-amber-600 rounded-full animate-spin" />
             </div>
          ) : data.length === 0 ? (
             <div className="p-32 text-center flex flex-col items-center opacity-30">
                <FileSpreadsheet size={64} className="mb-4" />
                <p className="text-sm font-black uppercase tracking-widest">Tidak Ada Data Koreksi</p>
             </div>
          ) : (
             <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left min-w-[850px]">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-50">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Karyawan</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipe Koreksi</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Waktu Koreksi</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Alasan</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.map((row) => (
                      <tr key={row.id} className="hover:bg-amber-50/10">
                        <td className="px-6 py-4 font-black text-gray-900 text-xs">
                           {row.user?.name}
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-[9px] font-black text-amber-600 uppercase bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                              {row.correction_type?.replace('_', ' ')}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col text-[10px] font-mono">
                              <span className="text-emerald-600 font-black">IN: {row.corrected_check_in ? new Date(row.corrected_check_in).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                              <span className="text-amber-600 font-black">OUT: {row.corrected_check_out ? new Date(row.corrected_check_out).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-gray-500 italic max-w-xs truncate">
                           "{row.reason}"
                        </td>
                        <td className="px-6 py-4 text-center">
                           <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg shadow-sm border ${
                              row.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              row.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                              'bg-gray-50 text-gray-600 border-gray-100'
                           }`}>
                              {row.status}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          )}
       </div>
    </div>
  );
};

const ShiftView = ({ employees, startDate, endDate, selectedUser }: any) => {
   const [data, setData] = useState<any[]>([]);
   const [loading, setLoading] = useState(false);

   useEffect(() => {
     const fetchData = async () => {
       setLoading(true);
       try {
         // This typically comes from schedules endpoint
         const res = await axiosInstance.get(`/schedules?start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}`);
         const rawData = res.data.data;
         setData(Array.isArray(rawData) ? rawData : (rawData?.data || []));
       } catch (e) { console.error(e); }
       finally { setLoading(false); }
     };
     fetchData();
   }, [startDate, endDate, selectedUser]);

   return (
     <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden">
           <div className="p-8 border-b border-gray-50 bg-blue-50/20 flex items-center justify-between">
              <div>
                 <h3 className="font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Calendar size={20} className="text-blue-500" /> Rekap Jadwal & Penugasan Shift
                 </h3>
                 <p className="text-xs text-gray-400 font-medium">Data perencanaan jam kerja karyawan pada periode terpilih.</p>
              </div>
              <button 
               onClick={async () => {
                  try {
                    const response = await axiosInstance.get(`/schedules/export?start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}`, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a'); link.href = url;
                    link.setAttribute('download', `Laporan_Shift_${startDate}_to_${endDate}.xlsx`);
                    document.body.appendChild(link); link.click(); link.remove();
                  } catch(e) { toast.error("Gagal export jadwal shift."); }
               }}
               className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-lg shadow-blue-100"
             >
                <FileSpreadsheet size={14} /> Export Laporan Excel
             </button>
           </div>
           {loading ? (
              <div className="p-32 text-center flex items-center justify-center">
                 <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              </div>
           ) : data.length === 0 ? (
              <div className="p-32 text-center flex flex-col items-center opacity-30">
                 <Calendar size={64} className="mb-4" />
                 <p className="text-sm font-black uppercase tracking-widest">Tidak Ada Jadwal</p>
              </div>
           ) : (
              <div className="overflow-x-auto scrollbar-thin">
                 <table className="w-full text-left min-w-[800px]">
                   <thead>
                     <tr className="bg-gray-50/50 border-b border-gray-50">
                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tanggal</th>
                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Karyawan</th>
                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Shift</th>
                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Jam Kerja</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                     {data.map((row) => (
                       <tr key={row.id}>
                         <td className="px-6 py-4 text-xs font-black text-gray-900">
                            {new Date(row.date).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric'})}
                         </td>
                         <td className="px-6 py-4 text-xs font-bold text-gray-700">{row.user?.name}</td>
                         <td className="px-6 py-4">
                            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                               {row.shift?.name}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-xs font-mono font-bold text-gray-400">
                            {row.shift?.start_time?.slice(0,5)} - {row.shift?.end_time?.slice(0,5)}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
           )}
        </div>
     </div>
   );
};

const LocationView = ({ startDate, endDate, selectedUser }: any) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/attendance/history?start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}&per_page=100`);
        setData(res.data.data.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [startDate, endDate, selectedUser]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden min-h-[500px]">
          <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-emerald-50/20">
             <div>
                <h3 className="font-black text-gray-900 tracking-tight flex items-center gap-2">
                   <MapIcon size={20} className="text-emerald-500" /> Sebaran Lokasi Absensi
                </h3>
                <p className="text-xs text-gray-400 font-medium">Klik pada koordinat untuk melihat lokasi detail di Google Maps.</p>
             </div>
          </div>
          {loading ? (
             <div className="p-32 text-center flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
             </div>
          ) : data.length === 0 ? (
             <div className="p-32 text-center flex flex-col items-center opacity-30">
                <MapIcon size={64} className="mb-4" />
                <p className="text-sm font-black uppercase tracking-widest">Tidak Ada Data Lokasi</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="max-h-[500px] overflow-y-auto border-r border-gray-50 bg-gray-50/30">
                   {data.map((row) => (
                      <div key={row.id} className="p-4 border-b border-white hover:bg-white transition-all group flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-emerald-600 font-black text-xs shadow-sm group-hover:scale-110 transition-transform">
                               {row.user?.name?.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                               <span className="font-black text-gray-900 text-xs">{row.user?.name}</span>
                               <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">{new Date(row.check_in).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit'})} WIB</span>
                            </div>
                         </div>
                         <a 
                           href={`https://www.google.com/maps/search/?api=1&query=${row.latitude_in},${row.longitude_in}`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl text-[10px] font-black text-gray-400 hover:text-emerald-600 border border-gray-100 hover:border-emerald-200 shadow-sm transition-all"
                         >
                            <MapPin size={12} /> {Number(row.latitude_in).toFixed(5)}, {Number(row.longitude_in).toFixed(5)}
                         </a>
                      </div>
                   ))}
                </div>
                <div className="p-12 flex flex-col items-center justify-center bg-emerald-50/10 relative overflow-hidden group">
                   <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
                      <MapIcon size={400} className="ml-[-100px] mt-[-50px]" />
                   </div>
                   <MapPin size={48} className="text-emerald-200 mb-6 drop-shadow-xl animate-bounce" />
                   <h4 className="font-black text-emerald-900 text-lg tracking-tight">Geo-Visualization</h4>
                   <p className="text-center text-xs text-emerald-700/60 mt-2 max-w-xs font-medium">Gunakan link koordinat di sebelah kiri untuk audit lokasi per titik secara presisi pada peta interaktif Google Maps.</p>
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default function ReportsAttendancePage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"logs" | "summary" | "suspicious" | "location" | "corrections" | "shifts">("logs");
  
  // Filters Persistence
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedUser, setSelectedUser] = useState("");

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axiosInstance.get("/employees?per_page=100");
        const rawData = res.data.data;
        setEmployees(Array.isArray(rawData) ? rawData : (rawData?.data || []));
        setLoading(false);
      } catch (e) {
        console.error("Gagal mengambil data karyawan", e);
      }
    };
    fetchEmployees();
  }, []);

  if (loading) return <ReportSkeleton />;

  const exportExcel = async () => {
    try {
      const response = await axiosInstance.get(`/attendance/export?start_date=${startDate}&end_date=${endDate}${selectedUser ? `&user_id=${selectedUser}` : ""}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Rekap_Kehadiran_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast.error("Gagal mengunduh Laporan Excel.");
    }
  };

  return (
    <div className="animate-in fade-in duration-700 w-full">
      <div className="dash-page-header">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl bg-[#8B0000] text-white flex items-center justify-center shadow-xl shadow-rose-100/50 group transition-transform hover:rotate-3 border-4 border-rose-50/50 shrink-0">
              <History size={26} />
           </div>
           <div>
              <h1 className="dash-page-title text-[#8B0000] font-black tracking-tight">{t('attendance_report')}</h1>
              <p className="dash-page-desc font-medium text-gray-500">Monitoring pergerakan, ringkasan kinerja, dan audit kepatuhan absensi karyawan.</p>
           </div>
        </div>
        <div className="dash-page-actions">
          <button className="dash-btn shadow-lg shadow-rose-100 bg-[#8B0000] hover:bg-[#6d0000] text-white flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all" onClick={exportExcel}>
            <FileSpreadsheet size={15} />
            {t('export')} Excel
          </button>
        </div>
      </div>

      {/* Segmented Tabs Control */}
      <div className="flex items-center gap-1 p-1 bg-gray-100/80 backdrop-blur-md rounded-xl mb-6 w-full md:w-fit border border-gray-200 overflow-x-auto no-scrollbar">
         <button 
           onClick={() => setActiveTab("logs")}
           className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] whitespace-nowrap font-bold transition-all tracking-wider uppercase ${activeTab === 'logs' ? 'bg-white text-[#8B0000] shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
         >
            <History size={13} /> Rekap Absen
         </button>
         <button 
           onClick={() => setActiveTab("summary")}
           className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] whitespace-nowrap font-bold transition-all tracking-wider uppercase ${activeTab === 'summary' ? 'bg-white text-[#8B0000] shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
         >
            <BarChart3 size={13} /> Ringkasan
         </button>
         <button 
           onClick={() => setActiveTab("shifts")}
           className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] whitespace-nowrap font-bold transition-all tracking-wider uppercase ${activeTab === 'shifts' ? 'bg-white text-[#8B0000] shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
         >
            <Calendar size={13} /> Laporan Shift
         </button>
         <button 
           onClick={() => setActiveTab("corrections")}
           className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] whitespace-nowrap font-bold transition-all tracking-wider uppercase ${activeTab === 'corrections' ? 'bg-white text-[#8B0000] shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
         >
            <FileSpreadsheet size={13} /> Koreksi
         </button>
         <button 
           onClick={() => setActiveTab("location")}
           className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] whitespace-nowrap font-bold transition-all tracking-wider uppercase ${activeTab === 'location' ? 'bg-white text-[#8B0000] shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
         >
            <MapIcon size={13} /> Lokasi
         </button>
         <button 
           onClick={() => setActiveTab("suspicious")}
           className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] whitespace-nowrap font-bold transition-all tracking-wider uppercase ${activeTab === 'suspicious' ? 'bg-white text-rose-600 shadow-sm ring-1 ring-rose-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
         >
            <ShieldAlert size={13} /> Audit
         </button>
      </div>

      {/* Tab Content Rendering */}
      {activeTab === 'logs' && (
        <LogView 
          employees={employees} 
          startDate={startDate} 
          endDate={endDate} 
          selectedUser={selectedUser}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onUserChange={setSelectedUser}
        />
      )}

      {activeTab === 'summary' && (
        <SummaryView 
          startDate={startDate} 
          endDate={endDate} 
          selectedUser={selectedUser} 
        />
      )}

      {activeTab === 'shifts' && (
        <ShiftView 
          startDate={startDate} 
          endDate={endDate} 
          selectedUser={selectedUser} 
        />
      )}

      {activeTab === 'corrections' && (
        <CorrectionView 
          startDate={startDate} 
          endDate={endDate} 
          selectedUser={selectedUser} 
        />
      )}

      {activeTab === 'location' && (
        <LocationView 
          startDate={startDate} 
          endDate={endDate} 
          selectedUser={selectedUser} 
        />
      )}

      {activeTab === 'suspicious' && (
        <SuspiciousView 
          startDate={startDate} 
          endDate={endDate} 
          selectedUser={selectedUser} 
        />
      )}
    </div>
  );
}

