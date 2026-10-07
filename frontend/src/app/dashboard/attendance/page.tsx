"use client";

import { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { 
  Search, 
  Download, 
  CheckCircle, 
  Clock, 
  Eye, 
  X, 
  MapPin, 
  User as UserIcon, 
  Globe, 
  Smartphone, 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  XCircle, 
  Laptop,
  History,
  RotateCcw,
  Building2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import Pagination from "@/components/Pagination";
import { getStorageUrl } from "@/lib/utils";

const getLocationBadge = (record: any) => {
  if (record.attendance_type === 'dinas_luar') {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
          <MapPin size={11} className="text-rose-600 shrink-0" />
          Dinas Luar
        </span>
        {record.dinas_luar_destination && (
          <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[130px]" title={record.dinas_luar_destination}>
            {record.dinas_luar_destination}
          </span>
        )}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
      <Building2 size={11} className="text-slate-500 shrink-0" />
      Di Kantor
    </span>
  );
};

const getDinasLuarBadge = (spvStatus?: string) => {
  switch (spvStatus) {
    case 'pending':
      return <span className="dash-badge bg-rose-50 text-rose-700 border border-rose-200"><Clock size={13} className="mr-1"/> DL: Menunggu SPV</span>;
    case 'approved_spv':
      return <span className="dash-badge bg-rose-50 text-rose-700 border border-rose-200"><Clock size={13} className="mr-1"/> DL: Menunggu HRD</span>;
    case 'approved_hr':
      return <span className="dash-badge bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle size={13} className="mr-1"/> Dinas Luar (Selesai)</span>;
    case 'rejected':
      return <span className="dash-badge bg-red-50 text-red-700 border border-red-200"><X size={13} className="mr-1"/> Dinas Luar (Ditolak)</span>;
    default:
      return <span className="dash-badge bg-rose-50 text-rose-700 border border-rose-200">Dinas Luar</span>;
  }
};

const getWebApprovalBadge = (webStatus?: string) => {
  if (webStatus === 'pending') {
    return <span className="dash-badge bg-amber-50 text-amber-700 border border-amber-200"><Clock size={13} className="mr-1"/> Web: Menunggu Approval</span>;
  }
  if (webStatus === 'rejected') {
    return <span className="dash-badge bg-rose-50 text-rose-700 border border-rose-200"><XCircle size={13} className="mr-1"/> Web: Ditolak</span>;
  }
  return null;
};

export default function AttendancePage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'web_pending'>('all');

  // History State
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Web Pending State
  const [webPendingList, setWebPendingList] = useState<any[]>([]);
  const [loadingWebPending, setLoadingWebPending] = useState(false);
  const [webPendingCount, setWebPendingCount] = useState<number>(0);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Detail Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const fetchAttendance = useCallback(async (pageNumber: number) => {
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
        
        if (pageNumber === 1) {
          localStorage.setItem('cached_attendance', JSON.stringify(data));
        }
      }
    } catch (e) {
      console.error("Gagal mengambil data absensi", e);
      if (pageNumber === 1) {
        const cached = localStorage.getItem('cached_attendance');
        if (cached) setAttendance(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWebPending = useCallback(async () => {
    try {
      setLoadingWebPending(true);
      const response = await axiosInstance.get('/attendance/web-pending');
      const data = response.data.data?.data || response.data.data || [];
      setWebPendingList(data);
      setWebPendingCount(data.length);
    } catch (e) {
      console.error("Gagal mengambil data pending absen web", e);
    } finally {
      setLoadingWebPending(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/attendance/pending-summary');
      if (response.data?.data?.web_pending_count !== undefined) {
        setWebPendingCount(response.data.data.web_pending_count);
      }
    } catch (e) {
      console.error("Gagal mengambil ringkasan pending", e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'all') {
      fetchAttendance(page);
    } else {
      fetchWebPending();
    }
    fetchSummary();
  }, [activeTab, page, fetchAttendance, fetchWebPending, fetchSummary]);

  const handleApprove = async (id: number) => {
    setProcessingId(id);
    try {
      await axiosInstance.post(`/attendance/web-approve/${id}`);
      toast.success("Absensi web berhasil disetujui.");
      fetchWebPending();
      fetchSummary();
      if (isModalOpen && selectedRecord?.id === id) {
        setIsModalOpen(false);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyetujui absensi web.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenRejectModal = (id: number) => {
    setRejectTargetId(id);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectTargetId) return;
    setProcessingId(rejectTargetId);
    try {
      await axiosInstance.post(`/attendance/web-reject/${rejectTargetId}`, {
        rejection_reason: rejectReason || undefined,
      });
      toast.success("Absensi web berhasil ditolak.");
      setRejectModalOpen(false);
      fetchWebPending();
      fetchSummary();
      if (isModalOpen && selectedRecord?.id === rejectTargetId) {
        setIsModalOpen(false);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menolak absensi web.");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (record: any) => {
    if (record.attendance_type === 'dinas_luar') {
      return getDinasLuarBadge(record.dinas_luar_status);
    }
    if (record.channel === 'web') {
      const webBadge = getWebApprovalBadge(record.web_approval_status);
      if (webBadge) return webBadge;
    }
    const status = record.status;
    if (status === 'present') return <span className="dash-badge dash-badge-success"><CheckCircle size={13} className="mr-1"/> Tepat Waktu</span>;
    if (status === 'late') return <span className="dash-badge dash-badge-danger"><Clock size={13} className="mr-1"/> Terlambat</span>;
    if (status === 'alfa') return <span className="dash-badge dash-badge-danger"><Clock size={13} className="mr-1"/> Alfa/Mangkir</span>;
    return <span className="dash-badge dash-badge-neutral">{status}</span>;
  };

  const getChannelBadge = (record: any) => {
    if (record.channel === 'web') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
          <Globe size={11} className="text-blue-500" />
          Web Dashboard
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
        <Smartphone size={11} className="text-purple-500" />
        Mobile (Face Recog)
      </span>
    );
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

  const filteredAttendance = attendance.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = item.user?.name?.toLowerCase() || '';
    const date = item.date?.toLowerCase() || '';
    return name.includes(q) || date.includes(q);
  });

  const renderAttendanceTable = () => {
    if (loading) {
      return <div className="p-8"><TableSkeleton rows={8} cols={7} /></div>;
    }
    if (filteredAttendance.length === 0) {
      return (
        <div className="p-12 text-center text-slate-400">
          <Clock size={36} className="mx-auto mb-2 opacity-30 text-slate-500" />
          <p className="text-sm font-black text-slate-600">Belum Ada Rekaman Absensi</p>
          <p className="text-xs text-slate-400 font-medium">Data absensi akan otomatis muncul saat karyawan check-in.</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80">
              <th className="px-4 py-3.5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Karyawan</th>
              <th className="px-4 py-3.5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Tanggal</th>
              <th className="px-4 py-3.5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Jam Masuk</th>
              <th className="px-4 py-3.5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Jam Pulang</th>
              <th className="px-4 py-3.5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Lokasi</th>
              <th className="px-4 py-3.5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Kanal</th>
              <th className="px-4 py-3.5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Status Kehadiran</th>
              <th className="px-4 py-3.5 font-black text-slate-500 uppercase tracking-widest text-[10px] text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAttendance.map((record) => (
              <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                      {record.user?.profile_photo_url || record.user?.profile_photo_path ? (
                        <img src={getStorageUrl(record.user?.profile_photo_url || record.user?.profile_photo_path)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon size={14} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 leading-tight">{record.user?.name || "Karyawan"}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{record.user?.email || `ID: #${record.user_id}`}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-700">
                  {record.date}
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-black text-emerald-600">
                  {record.check_in_time || "-"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-black text-orange-600">
                  {record.check_out_time || "-"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {getLocationBadge(record)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {getChannelBadge(record)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {getStatusBadge(record)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button 
                    onClick={() => handleViewDetails(record)}
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                    title="Lihat detail lengkap"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderWebPendingContent = () => {
    if (loadingWebPending) {
      return (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80">
          <TableSkeleton rows={6} cols={6} />
        </div>
      );
    }
    if (webPendingList.length === 0) {
      return (
        <div className="bg-white rounded-3xl p-16 border border-slate-200/80 text-center text-slate-400">
          <ShieldCheck size={48} className="mx-auto mb-3 text-emerald-500 opacity-80" />
          <h3 className="text-base font-black text-slate-800">Semua Absen Web Sudah Terverifikasi!</h3>
          <p className="text-xs text-slate-500 font-medium mt-1">Tidak ada antrean absensi web yang membutuhkan persetujuan manual saat ini.</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {webPendingList.map((item) => (
          <div 
            key={item.id} 
            className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
          >
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {item.user?.profile_photo_url || item.user?.profile_photo_path ? (
                      <img src={getStorageUrl(item.user?.profile_photo_url || item.user?.profile_photo_path)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={16} className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm">{item.user?.name || "Karyawan"}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{item.user?.email}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black uppercase">
                  Pending
                </span>
              </div>

              {/* Photo Previews */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                    <span>Check In</span>
                    <span className="text-emerald-600 font-black">{item.check_in_time || "-"}</span>
                  </div>
                  <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative">
                    {item.image_in_url || item.image_in ? (
                      <img src={getStorageUrl(item.image_in_url || item.image_in)} alt="Selfie Masuk" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 font-bold">Tanpa Foto</div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                    <span>Check Out</span>
                    <span className="text-orange-600 font-black">{item.check_out_time || "-"}</span>
                  </div>
                  <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative">
                    {item.image_out_url || item.image_out ? (
                      <img src={getStorageUrl(item.image_out_url || item.image_out)} alt="Selfie Pulang" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 font-bold">-</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-bold">Tanggal:</span>
                  <span className="font-black text-slate-800">{item.date}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-bold">IP Address:</span>
                  <span className="font-mono text-[10px] text-slate-700">{item.ip_address || 'Tidak tercatat'}</span>
                </div>
                {item.is_suspicious && (
                  <div className="pt-1 flex items-center gap-1 text-rose-600 font-black text-[10px]">
                    <AlertTriangle size={12} />
                    {item.suspicious_reason || 'Terdeteksi anomali jam kerja / lokasi'}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => handleViewDetails(item)}
                className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                title="Lihat Detail Lengkap"
              >
                <Eye size={16} />
              </button>
              <button
                onClick={() => handleOpenRejectModal(item.id)}
                disabled={processingId !== null}
                className="flex-1 py-2.5 px-3 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <X size={14} />
                Tolak
              </button>
              <button
                onClick={() => handleApprove(item.id)}
                disabled={processingId !== null}
                className="flex-1 py-2.5 px-3 bg-[#8B0000] hover:bg-[#700000] text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-[#8B0000]/20 transition-all disabled:opacity-50"
              >
                <Check size={14} />
                {processingId === item.id ? "Memproses..." : "Setujui"}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Riwayat & Persetujuan Absensi</h1>
          <p className="dash-page-desc">Pantau catatan kehadiran harian karyawan dan kelola verifikasi absensi web.</p>
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

      {/* Tabs Switcher */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <History size={14} />
            Semua Absensi
          </button>

          <button
            onClick={() => setActiveTab('web_pending')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
              activeTab === 'web_pending'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Laptop size={14} />
            Persetujuan Absen Web
            {webPendingCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'web_pending' ? 'bg-white text-amber-600' : 'bg-amber-100 text-amber-700'
              }`}>
                {webPendingCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'web_pending' && (
          <button
            onClick={fetchWebPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RotateCcw size={13} className={loadingWebPending ? "animate-spin" : ""} />
            Refresh
          </button>
        )}
      </div>

      {/* TAB 1: ALL ATTENDANCE */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3 border border-slate-200/80 rounded-2xl shadow-sm">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari nama karyawan atau tanggal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            {renderAttendanceTable()}
            
            {pagination.last_page > 1 && (
              <div className="p-4 border-t border-slate-100">
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
      )}

      {/* TAB 2: WEB PENDING APPROVAL */}
      {activeTab === 'web_pending' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-900 leading-relaxed font-medium">
              <span className="font-black block mb-0.5">Antrean Verifikasi Absen Web:</span>
              <span>Absensi di bawah ini dikirimkan melalui portal Web Dashboard oleh karyawan yang status validasi otomatisnya NONAKTIF atau terdeteksi potensi anomali jam kerja.</span>
            </div>
          </div>

          {renderWebPendingContent()}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <XCircle size={22} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">Tolak Absensi Web</h3>
                  <p className="text-xs text-slate-500 font-medium">Berikan alasan penolakan absensi ini</p>
                </div>
              </div>
              <button 
                onClick={() => setRejectModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <label htmlFor="rejectReasonTextarea" className="text-xs font-black text-slate-700 uppercase tracking-wider">Alasan Penolakan</label>
              <textarea
                id="rejectReasonTextarea"
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Foto selfie buram / tidak terlihat wajah / waktu tidak sesuai..."
                className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 font-medium"
              />
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={processingId !== null}
                className="px-6 py-2 text-xs font-black text-white bg-rose-600 rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all"
              >
                {processingId === null ? "Tolak Absensi" : "Memproses..."}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 tracking-tight text-base">Detail Kehadiran</h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedRecord.user?.name} &bull; {selectedRecord.date}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Check In Side */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Check In</span>
                    <span className="text-sm font-black text-emerald-600">{selectedRecord.check_in_time || "-"}</span>
                  </div>
                  
                  <div className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border-2 border-white shadow-md relative group">
                    {selectedRecord.image_in_url || selectedRecord.image_in ? (
                      <img src={getStorageUrl(selectedRecord.image_in_url || selectedRecord.image_in)} alt="Selfie Masuk" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                        <UserIcon size={48} className="mb-2 opacity-20" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Tanpa Foto</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                      <div className="flex items-center gap-2 text-white">
                        <MapPin size={12} className="text-rose-400" />
                        <p className="text-[10px] font-medium truncate">{selectedRecord.latitude_in}, {selectedRecord.longitude_in}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Check Out Side */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Check Out</span>
                    <span className="text-sm font-black text-orange-600">{selectedRecord.check_out_time || "-"}</span>
                  </div>

                  <div className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border-2 border-white shadow-md relative group">
                    {selectedRecord.image_out_url ? (
                      <img src={selectedRecord.image_out_url} alt="Selfie Pulang" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                        <UserIcon size={48} className="mb-2 opacity-20" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Belum Check Out</span>
                      </div>
                    )}
                    {selectedRecord.check_out_time && (
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                        <div className="flex items-center gap-2 text-white">
                          <MapPin size={12} className="text-rose-400" />
                          <p className="text-[10px] font-medium truncate">{selectedRecord.latitude_out}, {selectedRecord.longitude_out}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional Metadata Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipe / Lokasi</p>
                  <p className="text-xs font-bold text-slate-900">
                    {selectedRecord.attendance_type === 'dinas_luar' ? '📍 Dinas Luar' : '🏢 Di Kantor'}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kanal</p>
                  <p className="text-xs font-bold text-slate-900">{selectedRecord.channel === 'web' ? 'Web Dashboard' : 'Mobile App'}</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Web Approval</p>
                  <p className="text-xs font-bold text-slate-900 capitalize">{selectedRecord.web_approval_status || 'N/A'}</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">IP Address</p>
                  <p className="text-xs font-mono text-slate-900">{selectedRecord.ip_address || '-'}</p>
                </div>
              </div>

              {/* Dinas Luar Specific Details */}
              {selectedRecord.attendance_type === 'dinas_luar' && (
                <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <MapPin size={15} className="text-rose-600" />
                    <span>Detail Tugas Dinas Luar</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-rose-700 block">Tujuan Kunjungan</span>
                      <span className="font-black text-slate-800">{selectedRecord.dinas_luar_destination || "-"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-rose-700 block">Catatan / Keperluan</span>
                      <span className="text-slate-700">{selectedRecord.dinas_luar_notes || "-"}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedRecord.channel === 'web' && selectedRecord.web_approval_status === 'pending' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                  <div className="text-xs text-amber-900 font-bold">
                    Absensi ini menunggu persetujuan Anda
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenRejectModal(selectedRecord.id)}
                      className="px-4 py-2 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-xl text-xs font-black transition-colors"
                    >
                      Tolak
                    </button>
                    <button
                      onClick={() => handleApprove(selectedRecord.id)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all"
                    >
                      Setujui
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 bg-slate-50/50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all"
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
