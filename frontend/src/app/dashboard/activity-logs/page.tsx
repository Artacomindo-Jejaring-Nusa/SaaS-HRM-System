"use client";

import { useEffect, useState, useRef } from "react";
import axiosInstance from "@/lib/axios";
import { Search, Loader2, Database, User, Clock, Info, Filter, Calendar, X } from "lucide-react";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";

interface ActivityLog {
  id: number;
  user_id: number;
  action: string;
  description: string;
  model_type?: string;
  model_id?: number;
  created_at: string;
  user?: {
    name: string;
    email: string;
  };
}

interface PaginationData {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  
  // New Filter states
  const [actionType, setActionType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isDateVisible, setIsDateVisible] = useState(false);
  
  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
        fetchLogs(1); // Reset to page 1 on filter/search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, actionType, startDate, endDate]);

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  const fetchLogs = async (pageNum: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        search: searchQuery,
        action_type: actionType,
        start_date: startDate,
        end_date: endDate
      });
      const response = await axiosInstance.get(`/activity-logs?${params.toString()}`);
      const { data, ...paginator } = response.data.data;
      setLogs(data || []);
      setPagination(paginator);
    } catch (e) {
      console.error("Gagal mengambil data log aktivitas", e);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = action?.toLowerCase() || "";
    if (act.includes("create") || act.includes("tambah")) return "bg-emerald-50 text-emerald-600 border-emerald-100";
    if (act.includes("update") || act.includes("ubah")) return "bg-blue-50 text-blue-600 border-blue-100";
    if (act.includes("delete") || act.includes("hapus")) return "bg-rose-50 text-rose-600 border-rose-100";
    if (act.includes("login")) return "bg-indigo-50 text-indigo-600 border-indigo-100";
    if (act.includes("logout")) return "bg-slate-100 text-slate-500 border-slate-200";
    if (act.includes("approve") || act.includes("setuju")) return "bg-teal-50 text-teal-600 border-teal-100";
    if (act.includes("reject") || act.includes("tolak")) return "bg-orange-50 text-orange-600 border-orange-100";
    return "bg-slate-50 text-slate-600 border-slate-100";
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="dash-page-header">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#8B0000]/5 text-[#8B0000] rounded-xl border border-[#8B0000]/10">
            <Database size={24} />
          </div>
          <div>
            <h1 className="dash-page-title">Log Aktivitas Sistem</h1>
            <p className="dash-page-desc">Audit trail transparan untuk melacak setiap perubahan data dalam aplikasi.</p>
          </div>
        </div>
      </div>

      {/* Toolbar / Search */}
      <div className="bg-white p-4 border border-[#ebedf0] rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
                type="text"
                placeholder="Cari aksi, deskripsi, atau nama user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-11 pr-4 text-sm bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] focus:ring-4 focus:ring-[#8B0000]/5 transition-all outline-none"
            />
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
                <button 
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={`h-11 px-4 flex items-center gap-2 text-sm font-bold rounded-xl border transition-all ${isFilterVisible ? 'bg-gray-100 text-gray-800 border-gray-200' : 'text-gray-500 hover:bg-gray-50 border-gray-100'}`}
                >
                    <Filter size={16} />
                    Filter
                </button>
                <div className="relative">
                    <button 
                      onClick={() => setIsDateVisible(!isDateVisible)}
                      className={`h-11 px-4 flex items-center gap-2 text-sm font-bold rounded-xl border transition-all ${startDate || endDate ? 'bg-[#8B0000]/5 text-[#8B0000] border-[#8B0000]/10' : 'text-gray-500 hover:bg-gray-50 border-gray-100'}`}
                    >
                        <Calendar size={16} />
                        Rentang Waktu
                    </button>
                    {isDateVisible && (
                        <div className="absolute right-0 top-full mt-2 p-4 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 w-72">
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Mulai Dari</label>
                                    <input 
                                      type="date" 
                                      value={startDate} 
                                      onChange={(e) => setStartDate(e.target.value)}
                                      className="w-full h-10 px-3 text-sm border border-gray-100 rounded-lg outline-none focus:border-[#8B0000]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Sampai Dengan</label>
                                    <input 
                                      type="date" 
                                      value={endDate} 
                                      onChange={(e) => setEndDate(e.target.value)}
                                      className="w-full h-10 px-3 text-sm border border-gray-100 rounded-lg outline-none focus:border-[#8B0000]"
                                    />
                                </div>
                                <div className="pt-2 flex gap-2">
                                    <button 
                                      onClick={() => {setStartDate(""); setEndDate(""); setIsDateVisible(false);}}
                                      className="flex-1 h-9 text-xs font-bold text-gray-400 hover:text-gray-600"
                                    >
                                        Reset
                                    </button>
                                    <button 
                                      onClick={() => setIsDateVisible(false)}
                                      className="flex-1 h-9 text-xs font-bold bg-[#8B0000] text-white rounded-lg shadow-sm"
                                    >
                                        Terapkan
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Extra Filter Row */}
        {isFilterVisible && (
            <div className="pt-3 border-t border-gray-50 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                {['LOGIN', 'LOGOUT', 'CREATE_EMPLOYEE', 'UPDATE_EMPLOYEE', 'DELETE_EMPLOYEE', 'APPLY_LEAVE', 'APPROVE_LEAVE', 'REJECT_LEAVE'].map((type) => (
                    <button
                        key={type}
                        onClick={() => setActionType(actionType === type ? "" : type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${actionType === type ? 'bg-[#8B0000] text-white border-[#8B0000]' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}
                    >
                        {type.replace('_', ' ')}
                    </button>
                ))}
            </div>
        )}
      </div>

      {/* Main Table Container */}
      <div className="dash-table-container rounded-2xl! p-0! overflow-hidden bg-white">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={10} cols={4} /></div>
        ) : logs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-200">
                <Info size={40} />
            </div>
            <h3 className="text-base font-bold text-gray-800">Tidak ada log ditemukan</h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto mt-1">
                Belum ada rekaman aktivitas yang sesuai dengan kriteria pencarian Anda.
            </p>
          </div>
        ) : (
          <div className="dash-table-wrapper">
            <table className="dash-table border-0! text-left">
              <thead>
                <tr>
                  <th className="bg-gray-50/80! py-4! pl-6">Waktu & User</th>
                  <th className="bg-gray-50/80! py-4!">Aksi</th>
                  <th className="bg-gray-50/80! py-4!">Deskripsi Aktivitas</th>
                  <th className="bg-gray-50/80! py-4! pr-6 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="py-5 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#8B0000]/5 flex items-center justify-center text-[#8B0000] shadow-sm border border-[#8B0000]/10 font-bold uppercase text-sm">
                          {log.user?.name ? log.user.name.charAt(0) : "S"}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm">{log.user?.name || "Sistem"}</span>
                          <div className="flex items-center gap-1.5 text-gray-400 text-[11px] font-medium">
                            <Clock size={12} />
                            {formatDateTime(log.created_at)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase tracking-wider ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-5">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm text-gray-600 line-clamp-1">{log.description}</p>
                        {log.model_type && (
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tighter">Target:</span>
                                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 rounded uppercase">{log.model_type.split('\\').pop()} #{log.model_id}</span>
                            </div>
                        )}
                      </div>
                    </td>
                    <td className="py-5 pr-6 text-right">
                       <button 
                         onClick={() => setSelectedLog(log)}
                         className="p-2 hover:bg-gray-100 text-gray-400 rounded-lg transition-all hover:text-[#8B0000]"
                       >
                           <Info size={18} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Log Detail Modal */}
      {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Detail Aktivitas</h3>
                        <p className="text-xs text-gray-400 font-medium tracking-tight">Audit Trail ID: #{selectedLog.id}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedLog(null)}
                        className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-gray-400 transition-colors border border-transparent hover:border-gray-200"
                      >
                         <X size={20} />
                      </button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dilakukan Oleh</span>
                              <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 uppercase italic">
                                      {selectedLog.user?.name ? selectedLog.user.name.charAt(0) : "S"}
                                  </div>
                                  <span className="text-sm font-bold text-gray-700">{selectedLog.user?.name || "Sistem"}</span>
                              </div>
                          </div>
                          <div className="space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Waktu Kejadian</span>
                              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                  <Clock size={14} className="text-gray-400" />
                                  {formatDateTime(selectedLog.created_at)}
                              </div>
                          </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Deskripsi Aksi</span>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border mb-3 inline-block ${getActionBadgeColor(selectedLog.action)}`}>
                              {selectedLog.action}
                          </span>
                          <p className="text-sm text-gray-700 leading-relaxed font-medium italic">
                             "{selectedLog.description}"
                          </p>
                      </div>

                      {selectedLog.model_type && (
                          <div className="space-y-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Objek Terdampak</span>
                              <div className="flex items-center justify-between p-4 bg-white border-2 border-dashed border-gray-100 rounded-2xl">
                                  <div className="flex items-center gap-3">
                                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                          <Database size={18} />
                                      </div>
                                      <div>
                                          <p className="text-sm font-bold text-gray-800">{selectedLog.model_type.split('\\').pop()}</p>
                                          <p className="text-[11px] text-gray-400 font-medium">Referensi Sistem Internal</p>
                                      </div>
                                  </div>
                                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase italic">ID: #{selectedLog.model_id}</span>
                              </div>
                          </div>
                      )}
                  </div>
                  <div className="p-6 bg-gray-50/50 border-t border-gray-100">
                      <button 
                        onClick={() => setSelectedLog(null)}
                        className="w-full h-11 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-gray-200 transition-all active:scale-95"
                      >
                          Selesai
                      </button>
                  </div>
              </div>
          </div>
      )}

        {/* Pagination Section */}
        {!loading && pagination && pagination.total > 0 && (
          <div className="border-t border-gray-100 p-6 bg-gray-50/30">
            <Pagination 
              currentPage={pagination.current_page} 
              lastPage={pagination.last_page} 
              total={pagination.total} 
              onPageChange={setPage} 
            />
          </div>
        )}
      </div>
      
      {/* Help Card */}
      <div className="bg-[#8B0000]/5 border border-[#8B0000]/10 rounded-2xl p-5 flex gap-4 items-start">
          <div className="p-2 bg-[#8B0000]/10 text-[#8B0000] rounded-xl">
              <Info size={20} />
          </div>
          <div>
              <h4 className="text-sm font-bold text-gray-800">Mengapa Log Penting?</h4>
              <p className="text-[12px] text-gray-500 leading-relaxed mt-1">
                  Log aktivitas mencatat setiap tindakan krusial seperti perubahan data karyawan, persetujuan cuti, 
                  dan pengaturan sistem. Ini membantu Admin untuk melakukan audit jika terjadi kesalahan input atau 
                  penyalahgunaan wewenang.
              </p>
          </div>
      </div>
    </div>
  );
}
