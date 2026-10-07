"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { 
  ArrowLeftRight, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  Search,
  Check,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ListPageSkeleton } from "@/components/Skeleton";
import Pagination from "@/components/Pagination";

interface ShiftSwap {
  id: number;
  requester_id: number;
  receiver_id: number;
  requester_schedule_id: number;
  receiver_schedule_id: number;
  status: 'pending_receiver' | 'pending_manager' | 'approved' | 'rejected' | 'cancelled';
  reason: string;
  remark?: string;
  created_at: string;
  requester: { name: string };
  receiver: { name: string };
  requester_schedule: { date: string; shift: { name: string; start_time: string; end_time: string } };
  receiver_schedule: { date: string; shift: { name: string; start_time: string; end_time: string } };
}

interface WebUser {
  id: number;
  name: string;
  role?: { name: string };
}

interface Schedule {
  id: number;
  date: string;
  shift: { name: string; start_time: string; end_time: string };
}

export default function ShiftSwapPage() {
  const { user, hasPermission } = useAuth();
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  // Form State
  const [users, setUsers] = useState<WebUser[]>([]);
  const [mySchedules, setMySchedules] = useState<Schedule[]>([]);
  const [receiverSchedules, setReceiverSchedules] = useState<Schedule[]>([]);
  
  const [formData, setFormData] = useState({
    receiver_id: "",
    requester_schedule_id: "",
    receiver_schedule_id: "",
    reason: ""
  });

  const [activeTab, setActiveTab] = useState<'my_requests' | 'to_review'>('my_requests');
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchSwaps(currentPage);
    if (user?.id) {
      fetchInitialData();
    }
  }, [currentPage, user?.id]);

  const fetchSwaps = async (page = 1) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/shift-swap?page=${page}`);
      
      if (res.data.data?.data) {
        setSwaps(res.data.data.data || []);
        setCurrentPage(res.data.data.current_page);
        setLastPage(res.data.data.last_page);
        setTotal(res.data.data.total);
      } else {
        setSwaps(res.data.data || []);
        setLastPage(1);
        setTotal((res.data.data || []).length);
      }
    } catch (e) {
      console.error("Gagal ambil data tukar shift", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      // Ambil daftar rekan kerja (untuk tujuan tukar)
      const usersRes = await axiosInstance.get("/employees?per_page=100");
      const uData = usersRes.data.data;
      const rawUsers = Array.isArray(uData) ? uData : (uData?.data || []);
      setUsers(rawUsers.filter((u: any) => u.id !== user?.id));

      // Ambil jadwal saya
      if (user?.id) {
        const mySchedRes = await axiosInstance.get(`/schedules?user_id=${user.id}&per_page=100`);
        const schedData = mySchedRes.data.data;
        setMySchedules(Array.isArray(schedData) ? schedData : (schedData?.data || []));
      }
    } catch (e) {
      console.error("Gagal ambil data pendukung", e);
    }
  };

  const fetchReceiverSchedules = async (receiverId: string) => {
    if (!receiverId) return;
    try {
      const res = await axiosInstance.get(`/schedules?user_id=${receiverId}&per_page=100`);
      const resData = res.data.data;
      setReceiverSchedules(Array.isArray(resData) ? resData : (resData?.data || []));
    } catch (e) {
      console.error("Gagal ambil jadwal penerima", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.receiver_id || !formData.requester_schedule_id || !formData.receiver_schedule_id) {
      toast.warning("Mohon lengkapi semua pilihan jadwal.");
      return;
    }

    setIsSubmitLoading(true);
    try {
      await axiosInstance.post("/shift-swap", formData);
      toast.success("Permintaan tukar shift berhasil dikirim!");
      setIsModalOpen(false);
      setFormData({ receiver_id: "", requester_schedule_id: "", receiver_schedule_id: "", reason: "" });
      fetchSwaps(1);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal mengirim permintaan.");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleRespond = async (id: number, status: 'approved_by_receiver' | 'rejected') => {
    toast(status === 'approved_by_receiver' ? "Terima tukar shift ini?" : "Tolak tukar shift ini?", {
      description: status === 'approved_by_receiver' ? "Konfirmasi untuk menyetujui pertukaran." : "Anda akan menolak permintaan ini.",
      action: {
        label: status === 'approved_by_receiver' ? "Terima" : "Tolak",
        onClick: async () => {
          try {
            await axiosInstance.post(`/shift-swap/${id}/respond`, { status, remark: "" });
            toast.success("Respon berhasil dikirim.");
            fetchSwaps(currentPage);
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal memproses respon.");
          }
        },
      },
    });
  };

  const handleApprove = async (id: number, status: 'approved' | 'rejected') => {
    toast(status === 'approved' ? "Setujui tukar shift?" : "Tolak tukar shift?", {
      description: status === 'approved' ? "Konfirmasi persetujuan permanen." : "Pengajuan akan ditolak permanen.",
      action: {
        label: status === 'approved' ? "Setujui" : "Tolak",
        onClick: async () => {
          try {
            await axiosInstance.post(`/shift-swap/${id}/approve`, { status });
            toast.success(`Berhasil ${status === 'approved' ? 'menyetujui' : 'menolak'} pengajuan.`);
            fetchSwaps(currentPage);
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal memproses approval.");
          }
        },
      },
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_receiver': 
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold border border-blue-100 flex items-center gap-1.5 w-max"><Clock size={12} /> Menunggu Rekan</span>;
      case 'pending_manager': 
        return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[11px] font-bold border border-amber-100 flex items-center gap-1.5 w-max"><Clock size={12} /> Menunggu Atasan</span>;
      case 'approved': 
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold border border-emerald-100 flex items-center gap-1.5 w-max"><CheckCircle2 size={12} /> Selesai</span>;
      case 'rejected': 
        return <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-[11px] font-bold border border-red-100 flex items-center gap-1.5 w-max"><XCircle size={12} /> Ditolak</span>;
      default: 
        return <span className="px-2.5 py-1 bg-gray-50 text-gray-700 rounded-lg text-[11px] font-bold border border-gray-100 flex items-center gap-1.5 w-max">{status}</span>;
    }
  };

  if (loading && swaps.length === 0) return <ListPageSkeleton />;

  const myRequests = swaps.filter(s => s.requester_id === user?.id || (s.receiver_id === user?.id && s.status === 'pending_receiver'));
  const managerReview = swaps.filter(s => s.status === 'pending_manager');

  const filteredMyRequests = myRequests.filter(s => 
    s.requester.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.receiver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredManagerReview = managerReview.filter(s => 
    s.requester.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.receiver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeList = activeTab === 'my_requests' ? filteredMyRequests : filteredManagerReview;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Section */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title flex items-center gap-2">
            <ArrowLeftRight size={24} className="text-[#8B0000]" />
            Tukar Shift
          </h1>
          <p className="dash-page-desc">Ajukan pertukaran jadwal kerja dengan rekan tim Anda secara resmi.</p>
        </div>
        <div className="dash-page-actions">
          {hasPermission('apply-shift-swaps') && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="dash-btn bg-[#8B0000] hover:bg-[#720000] text-white font-bold rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Plus size={16} />
              Ajukan Tukar Baru
            </button>
          )}
        </div>
      </div>

      {/* Stats/Quick Glance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Menunggu Saya (Pending Me)</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
              {swaps.filter(s => s.receiver_id === user?.id && s.status === 'pending_receiver').length}
            </p>
          </div>
        </div>
        <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Menunggu Atasan (Wait Manager)</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
              {swaps.filter(s => s.requester_id === user?.id && s.status === 'pending_manager').length}
            </p>
          </div>
        </div>
        <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Disetujui (Approved)</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
              {swaps.filter(s => s.status === 'approved').length}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Tabs & Filters */}
      <div className="space-y-4">
        <div className="flex border-b border-gray-200 gap-6">
           <button 
            onClick={() => { setActiveTab('my_requests'); setSearchTerm(""); }}
            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'my_requests' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
           >
             Permintaan Saya
             {activeTab === 'my_requests' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B0000]" />}
           </button>
           {hasPermission('approve-shift-swaps') && (
             <button 
              onClick={() => { setActiveTab('to_review'); setSearchTerm(""); }}
              className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'to_review' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
             >
               Approval Manager
               {managerReview.length > 0 && (
                 <span className="ml-2 px-1.5 py-0.5 bg-red-600 text-[10px] text-white rounded-full align-middle font-bold">
                   {managerReview.length}
                 </span>
               )}
               {activeTab === 'to_review' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B0000]" />}
             </button>
           )}
        </div>

        {/* Search input */}
        <div className="flex items-center justify-between bg-white p-3 border border-[#ebedf0] rounded-lg">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Cari pengajuan tukar shift..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50/50 border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
        </div>

        {/* Swap Request List Table */}
        {activeList.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
             <div className="w-16 h-16 bg-red-50 text-[#8B0000] rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowLeftRight size={28} />
             </div>
             <h3 className="font-bold text-gray-950 text-lg">Tidak Ada Permintaan</h3>
             <p className="text-sm text-gray-500 mt-1">
               {searchTerm ? "Tidak menemukan hasil pencarian yang cocok." : "Semua jadwal terasa aman dan stabil saat ini."}
             </p>
          </div>
        ) : (
          <div className="dash-table-container">
            <div className="dash-table-wrapper">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Waktu Pengajuan</th>
                    <th>Pengaju</th>
                    <th>Rekan Kerja</th>
                    <th>Jadwal Pengaju (Dilepas)</th>
                    <th>Jadwal Rekan (Diambil)</th>
                    <th>Alasan</th>
                    <th>Status</th>
                    <th className="text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {activeList.map((swap) => (
                    <tr key={swap.id}>
                      <td className="whitespace-nowrap text-xs text-gray-500">
                        {new Date(swap.created_at).toLocaleString('id-ID', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-red-50 text-[#8B0000] flex items-center justify-center font-bold text-xs shrink-0">
                            {swap.requester.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 text-xs">{swap.requester.name}</span>
                            {swap.requester_id === user?.id && (
                              <span className="text-[9px] text-[#8B0000] font-bold bg-red-50 px-1 py-0.5 rounded w-max mt-0.5">Anda</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {swap.receiver.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 text-xs">{swap.receiver.name}</span>
                            {swap.receiver_id === user?.id && (
                              <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1 py-0.5 rounded w-max mt-0.5">Anda</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-gray-800">
                            {new Date(swap.requester_schedule.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {swap.requester_schedule.shift.name} ({swap.requester_schedule.shift.start_time} - {swap.requester_schedule.shift.end_time})
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-gray-800">
                            {new Date(swap.receiver_schedule.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {swap.receiver_schedule.shift.name} ({swap.receiver_schedule.shift.start_time} - {swap.receiver_schedule.shift.end_time})
                          </span>
                        </div>
                      </td>
                      <td className="max-w-[200px] truncate" title={swap.reason}>
                        <span className="text-xs text-gray-600 italic">"{swap.reason}"</span>
                      </td>
                      <td>{getStatusBadge(swap.status)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Action for Receiver */}
                          {swap.status === 'pending_receiver' && swap.receiver_id === user?.id && (
                            <>
                              <button 
                                onClick={() => handleRespond(swap.id, 'rejected')} 
                                className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition"
                                title="Tolak Pertukaran"
                              >
                                Tolak
                              </button>
                              <button 
                                onClick={() => handleRespond(swap.id, 'approved_by_receiver')} 
                                className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition shadow-sm"
                                title="Terima Pertukaran"
                              >
                                Terima
                              </button>
                            </>
                          )}

                          {/* Action for Manager */}
                          {swap.status === 'pending_manager' && hasPermission('approve-shift-swaps') && (
                            <>
                              <button 
                                onClick={() => handleApprove(swap.id, 'rejected')} 
                                className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition"
                                title="Reject Pengajuan"
                              >
                                Reject
                              </button>
                              <button 
                                onClick={() => handleApprove(swap.id, 'approved')} 
                                className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition shadow-sm"
                                title="Approve Pengajuan"
                              >
                                Approve
                              </button>
                            </>
                          )}

                          {/* Status descriptions for Requester */}
                          {swap.status === 'pending_receiver' && swap.requester_id === user?.id && (
                            <span className="text-[11px] text-gray-400 font-medium italic">
                              Menunggu respon rekan
                            </span>
                          )}
                          {swap.status === 'pending_manager' && swap.requester_id === user?.id && (
                            <span className="text-[11px] text-orange-500 font-medium italic">
                              Menunggu approval atasan
                            </span>
                          )}
                          {swap.status === 'approved' && (
                            <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                              <Check size={14} /> Sukses
                            </span>
                          )}
                          {swap.status === 'rejected' && (
                            <span className="text-[11px] text-red-600 font-bold uppercase tracking-wider flex items-center gap-1">
                              <X size={14} /> Ditolak
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {total > 0 && (
          <Pagination 
            currentPage={currentPage}
            lastPage={lastPage}
            total={total}
            onPageChange={(page) => setCurrentPage(page)}
          />
        )}
      </div>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-red-50 text-[#8B0000] rounded-xl shadow-sm">
                      <ArrowLeftRight size={20} />
                   </div>
                   <div>
                    <h3 className="font-bold text-gray-950 text-lg tracking-tight">Form Tukar Shift</h3>
                    <p className="text-xs text-gray-500 font-medium italic">Pilih rekan dan ajukan pertukaran jadwal secara resmi.</p>
                   </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-150 rounded-full transition-colors">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User Selection */}
                    <div className="space-y-1.5">
                       <label htmlFor="receiver-select" className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-0.5">1. Pilih Rekan Kerja</label>
                       <select id="receiver-select" 
                         className="w-full h-11 bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-red-150 focus:border-[#8B0000] transition-all"
                         value={formData.receiver_id}
                         onChange={(e) => {
                           setFormData({...formData, receiver_id: e.target.value, receiver_schedule_id: ""});
                           fetchReceiverSchedules(e.target.value);
                         }}
                         required
                       >
                          <option value="">Pilih Teman Kerja...</option>
                          {users
                            .filter((u) => u.id !== user?.id)
                            .map((u) => {
                              const roleDisplay = u.role?.name ? ` (${u.role.name})` : "";
                              return (
                                <option key={u.id} value={u.id}>
                                  {u.name}{roleDisplay}
                                </option>
                              );
                            })}
                       </select>
                    </div>

                    {/* My Schedule */}
                    <div className="space-y-1.5">
                       <label htmlFor="requester-schedule-select" className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-0.5">2. Jadwal Anda (Dilepas)</label>
                       <select 
                          className="w-full h-11 bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-red-150 focus:border-[#8B0000] transition-all"
                          id="requester-schedule-select"
                          value={formData.requester_schedule_id}
                          onChange={(e) => setFormData({...formData, requester_schedule_id: e.target.value})}
                          required
                       >
                          <option value="">{mySchedules.length === 0 ? "Belum ada jadwal shift Anda" : "Pilih Jadwal Anda..."}</option>
                          {mySchedules.map(s => {
                            const shiftName = s.shift?.name || "Shift";
                            const timeStr = s.shift?.start_time ? ` (${s.shift.start_time.substring(0, 5)})` : "";
                            const dateStr = s.date ? new Date(s.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : "-";
                            return (
                              <option key={s.id} value={s.id}>{dateStr} - {shiftName}{timeStr}</option>
                            );
                          })}
                       </select>
                    </div>

                    {/* Receiver Schedule */}
                    <div className={`space-y-1.5 transition-opacity ${formData.receiver_id ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                       <label htmlFor="receiver-schedule-select" className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-0.5">3. Jadwal Rekan (Diambil)</label>
                       <select 
                          className="w-full h-11 bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-red-150 focus:border-[#8B0000] transition-all"
                          id="receiver-schedule-select"
                          value={formData.receiver_schedule_id}
                          onChange={(e) => setFormData({...formData, receiver_schedule_id: e.target.value})}
                          required
                          disabled={!formData.receiver_id}
                       >
                          <option value="">
                            {(() => {
                              if (!formData.receiver_id) {
                                return "Pilih rekan dulu...";
                              }
                              if (receiverSchedules.length === 0) {
                                return "Rekan ini belum memiliki jadwal shift";
                              }
                              return "Pilih Jadwal Rekan...";
                            })()}
                          </option>
                          {receiverSchedules.map(s => {
                            const shiftName = s.shift?.name || "Shift";
                            const timeStr = s.shift?.start_time ? ` (${s.shift.start_time.substring(0, 5)})` : "";
                            const dateStr = s.date ? new Date(s.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : "-";
                            return (
                              <option key={s.id} value={s.id}>{dateStr} - {shiftName}{timeStr}</option>
                            );
                          })}
                       </select>
                    </div>

                    {/* Reason */}
                    <div className="space-y-1.5">
                        <label htmlFor="reason-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-0.5">4. Alasan Tukar</label>
                        <input 
                          id="reason-input"
                          type="text"
                          className="w-full h-11 bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-red-150 focus:border-[#8B0000] transition-all"
                          placeholder="Contoh: Urusan keluarga mendesak..."
                          value={formData.reason}
                          onChange={(e) => setFormData({...formData, reason: e.target.value})}
                          required
                        />
                    </div>
                 </div>

                 <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl flex items-start gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-[#8B0000] shrink-0 border border-gray-100">
                       <AlertCircle size={16} />
                    </div>
                    <div className="space-y-0.5">
                       <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">Perhatian Penting</p>
                       <p className="text-[11px] text-gray-500 font-medium leading-relaxed italic">Permintaan ini akan otomatis diperbarui setelah rekan Anda menyetujui DAN mendapat persetujuan akhir dari Manager.</p>
                    </div>
                 </div>

                 <div className="pt-2 flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)} 
                      className="flex-1 h-11 text-sm font-semibold text-gray-600 bg-gray-150 hover:bg-gray-200 rounded-lg transition active:scale-95"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitLoading}
                      className="flex-2 h-11 text-sm font-bold text-white bg-[#8B0000] hover:bg-[#720000] rounded-lg shadow-md transition disabled:opacity-50 active:scale-95"
                    >
                      {isSubmitLoading ? "Memproses..." : "Kirim Pengajuan"}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
