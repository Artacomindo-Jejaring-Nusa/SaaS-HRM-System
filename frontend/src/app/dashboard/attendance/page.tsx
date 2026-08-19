"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { Search, Download, CheckCircle, Clock, Eye, X, MapPin, User as UserIcon, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import Pagination from "@/components/Pagination";

export default function AttendancePage() {
  const { hasPermission } = useAuth();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  useEffect(() => {
    fetchAttendance(page);
  }, [page]);

  const fetchAttendance = async (pageNumber: number) => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/attendance/history?page=${pageNumber}`);
      const data = response.data.data?.data || response.data.data || [];
      setAttendance(data);
      if (response.data.data && response.data.data.current_page) {
        setPagination({
          current_page: response.data.data.current_page,
          last_page: response.data.data.last_page,
          total: response.data.data.total
        });
        
        // Cache first page for offline mode
        if (pageNumber === 1) {
          localStorage.setItem('cached_attendance', JSON.stringify(data));
        }
      }
    } catch (e) {
      console.error("Gagal mengambil data absensi", e);
      // Fallback
      if (pageNumber === 1) {
        const cached = localStorage.getItem('cached_attendance');
        if (cached) setAttendance(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (record: any) => {
    const status = record.status;
    if (record.attendance_type === 'dinas_luar') {
      const spvStatus = record.dinas_luar_status;
      if (spvStatus === 'pending') {
        return <span className="dash-badge bg-rose-50 text-rose-700 border border-rose-200"><Clock size={13} className="mr-1"/> DL: Menunggu SPV</span>;
      }
      if (spvStatus === 'approved_spv') {
        return <span className="dash-badge bg-rose-50 text-rose-700 border border-rose-200"><Clock size={13} className="mr-1"/> DL: Menunggu HRD</span>;
      }
      if (spvStatus === 'approved_hr') {
        return <span className="dash-badge bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle size={13} className="mr-1"/> Dinas Luar (Selesai)</span>;
      }
      if (spvStatus === 'rejected') {
        return <span className="dash-badge bg-red-50 text-red-700 border border-red-200"><X size={13} className="mr-1"/> Dinas Luar (Ditolak)</span>;
      }
      return <span className="dash-badge bg-rose-50 text-rose-700 border border-rose-200">Dinas Luar</span>;
    }
    if (status === 'present') return <span className="dash-badge dash-badge-success"><CheckCircle size={13} className="mr-1"/> Tepat Waktu</span>;
    if (status === 'late') return <span className="dash-badge dash-badge-danger"><Clock size={13} className="mr-1"/> Terlambat</span>;
    if (status === 'alfa') return <span className="dash-badge dash-badge-danger"><Clock size={13} className="mr-1"/> Alfa/Mangkir</span>;
    return <span className="dash-badge dash-badge-neutral">{status}</span>;
  };

  const handleViewDetails = (record: any) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleExport = async () => {
    toast("Unduh Laporan Absensi?", {
      description: "Laporan akan diunduh dalam format Excel (.xlsx).",
      action: {
        label: "Unduh",
        onClick: async () => {
          try {
            const response = await axiosInstance.get('/attendance/export', {
              responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Riwayat_Absensi_${new Date().getTime()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Laporan berhasil diunduh.");
          } catch (e) {
            console.error("Gagal mendownload laporan Excel", e);
            toast.error("Gagal mengunduh Laporan Excel.");
          }
        }
      }
    });
  };

  return (
    <div>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Riwayat Absensi</h1>
          <p className="dash-page-desc">Pantau catatan kehadiran harian karyawan secara real-time.</p>
        </div>
        <div className="dash-page-actions">
          {hasPermission('export-attendance') && (
            <button className="dash-btn dash-btn-outline" onClick={handleExport}>
              <Download size={15} />
              Export Laporan
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 bg-white p-3 border border-[#ebedf0] rounded-lg">
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Cari nama atau filter tanggal..."
              className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
      </div>

      <div className="dash-table-container">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={8} cols={5} /></div>
        ) : attendance.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Belum ada rekaman absensi.
          </div>
        ) : (
          <div className="dash-table-wrapper">
            <table className="dash-table text-left">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Tanggal</th>
                  <th>Jam Masuk</th>
                  <th>Jam Pulang</th>
                  <th>Status Kehadiran</th>
                  <th>Lokasi</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td>
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                             {record.user?.profile_photo_url ? (
                                <img src={record.user.profile_photo_url} alt="" className="w-full h-full object-cover" />
                             ) : (
                                <UserIcon size={16} className="text-gray-400" />
                             )}
                          </div>
                          <span className="font-semibold text-gray-900">{record.user?.name || "Karyawan"}</span>
                       </div>
                    </td>
                    <td><span className="text-sm text-gray-600 font-medium">{record.date}</span></td>
                    <td><span className="text-sm font-bold text-gray-900">{record.check_in_time || "-"}</span></td>
                    <td><span className="text-sm font-bold text-gray-900">{record.check_out_time || "-"}</span></td>
                    <td>{getStatusBadge(record)}</td>
                    <td>
                      <span className="text-xs text-gray-500 block truncate max-w-[150px]">
                        {record.check_in_location || "Sistem web"}
                      </span>
                    </td>
                    <td className="text-right">
                       <button 
                          onClick={() => handleViewDetails(record)}
                          className="p-2 text-gray-400 hover:text-[#8B0000] hover:bg-red-50 rounded-lg transition-all"
                       >
                          <Eye size={18} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {pagination.last_page > 1 && (
          <Pagination 
            currentPage={pagination.current_page} 
            lastPage={pagination.last_page} 
            total={pagination.total} 
            onPageChange={setPage} 
          />
        )}
      </div>

      {/* Detail Modal */}
      {isModalOpen && selectedRecord && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
               <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-[#8B0000]">
                        <Clock size={20} />
                     </div>
                     <div>
                        <h3 className="font-black text-gray-900 tracking-tight">Detail Kehadiran</h3>
                        <p className="text-xs text-gray-500 font-medium">{selectedRecord.user?.name} · {selectedRecord.date}</p>
                     </div>
                  </div>
                  <button 
                     onClick={() => setIsModalOpen(false)}
                     className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-600"
                  >
                     <X size={20} />
                  </button>
               </div>

               <div className="p-6 overflow-y-auto max-h-[70vh]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {/* Check In Side */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl border border-gray-100">
                           <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Check In</span>
                           <span className="text-sm font-black text-emerald-600">{selectedRecord.check_in_time}</span>
                        </div>
                        
                        <div className="aspect-square bg-gray-100 rounded-3xl overflow-hidden border-2 border-white shadow-lg relative group">
                           {selectedRecord.image_in_url ? (
                              <img src={selectedRecord.image_in_url} alt="Selfie Masuk" className="w-full h-full object-cover" />
                           ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                 <UserIcon size={48} className="mb-2 opacity-20" />
                                 <span className="text-[10px] font-bold uppercase tracking-widest">Tanpa Foto</span>
                              </div>
                           )}
                           <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                              <div className="flex items-center gap-2 text-white">
                                 <MapPin size={12} className="text-red-400" />
                                 <p className="text-[10px] font-medium truncate">{selectedRecord.latitude_in}, {selectedRecord.longitude_in}</p>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Check Out Side */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl border border-gray-100">
                           <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Check Out</span>
                           <span className="text-sm font-black text-orange-600">{selectedRecord.check_out_time || "-"}</span>
                        </div>

                        <div className="aspect-square bg-gray-100 rounded-3xl overflow-hidden border-2 border-white shadow-lg relative group">
                           {selectedRecord.image_out_url ? (
                              <img src={selectedRecord.image_out_url} alt="Selfie Pulang" className="w-full h-full object-cover" />
                           ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                 <UserIcon size={48} className="mb-2 opacity-20" />
                                 <span className="text-[10px] font-bold uppercase tracking-widest">Belum Check Out</span>
                              </div>
                           )}
                           {selectedRecord.check_out && (
                              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                                 <div className="flex items-center gap-2 text-white">
                                    <MapPin size={12} className="text-red-400" />
                                    <p className="text-[10px] font-medium truncate">{selectedRecord.latitude_out}, {selectedRecord.longitude_out}</p>
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>

                  {/* Additional Info Cards */}
                  <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
                     <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${selectedRecord.attendance_type === 'dinas_luar' ? 'bg-rose-500' : (selectedRecord.status === 'present' ? 'bg-emerald-500' : 'bg-red-500')}`}></div>
                           <p className="text-xs font-bold text-gray-900">
                             {selectedRecord.attendance_type === 'dinas_luar' 
                               ? `Dinas Luar (${selectedRecord.dinas_luar_status?.toUpperCase()})` 
                               : (selectedRecord.status === 'present' ? 'Hadir Tepat Waktu' : 'Terlambat')}
                           </p>
                        </div>
                     </div>
                     <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Perangkat</p>
                        <p className="text-xs font-bold text-gray-900 truncate">Android/iOS App</p>
                     </div>
                     <div className="col-span-2 md:col-span-1 bg-[#8B0000] rounded-2xl p-4 text-white shadow-lg shadow-red-900/10">
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Audit Trace</p>
                        <p className="text-[10px] font-medium italic">Verified by Face & GPS</p>
                     </div>
                  </div>

                  {selectedRecord.attendance_type === 'dinas_luar' && (
                     <div className="mt-6 p-4 bg-rose-50/30 border border-rose-100 rounded-2xl col-span-full">
                        <p className="text-[10px] font-black text-rose-800 uppercase tracking-widest mb-2">Detail Dinas Luar</p>
                        <div className="space-y-2 text-xs">
                           <div>
                              <span className="font-bold text-gray-700">Tujuan: </span>
                              <span className="text-gray-900 font-semibold">{selectedRecord.dinas_luar_destination}</span>
                           </div>
                           <div>
                              <span className="font-bold text-gray-700">Keterangan: </span>
                              <span className="text-gray-900 font-medium italic">{selectedRecord.dinas_luar_notes || '-'}</span>
                           </div>
                           {selectedRecord.rejection_reason && (
                              <div className="mt-2 p-2 bg-red-50 text-red-700 rounded-lg font-medium">
                                 <strong>Alasan Penolakan: </strong> {selectedRecord.rejection_reason}
                              </div>
                           )}
                        </div>
                     </div>
                  )}
               </div>

               <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex justify-end">
                  <button 
                     onClick={() => setIsModalOpen(false)}
                     className="px-8 py-3 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200"
                  >
                     Tutup
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
