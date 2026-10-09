"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { 
  ArrowLeftRight, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Check, 
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Pagination from "@/components/Pagination";
import { ListPageSkeleton } from "@/components/Skeleton";

interface ShiftSwap {
  id: number;
  requester_id: number;
  receiver_id: number;
  requester_schedule_id: number;
  receiver_schedule_id: number;
  reason: string;
  status: 'pending_receiver' | 'pending_manager' | 'approved' | 'rejected';
  remark?: string;
  created_at: string;
  requester: { id: number; name: string; email: string };
  receiver: { id: number; name: string; email: string };
  requester_schedule?: {
    id: number;
    date: string;
    shift?: { name: string; start_time: string; end_time: string };
  };
  receiver_schedule?: {
    id: number;
    date: string;
    shift?: { name: string; start_time: string; end_time: string };
  };
}

interface WebUser {
  id: number;
  name: string;
  email: string;
  attendance_type?: string;
  role?: { name: string };
}

interface Schedule {
  id: number;
  date: string;
  shift_id?: number;
  shift: { name: string; start_time: string; end_time: string };
}

interface ShiftSwapStatsProps {
  readonly canApprove: boolean;
  readonly managerReviewCount: number;
  readonly pendingReceiverCount: number;
  readonly approvedCount: number;
  readonly requesterPendingCount: number;
}

interface ShiftSwapRowActionsProps {
  readonly swap: ShiftSwap;
  readonly currentUserId?: number;
  readonly canApprove: boolean;
  readonly onRespond: (id: number, status: 'approved_by_receiver' | 'rejected') => void;
  readonly onApprove: (id: number, status: 'approved' | 'rejected') => void;
}

interface ShiftSwapCreateModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (e: React.FormEvent) => void;
  readonly formData: { receiver_id: string; requester_schedule_id: string; receiver_schedule_id: string; reason: string };
  readonly setFormData: (val: any) => void;
  readonly users: WebUser[];
  readonly mySchedules: Schedule[];
  readonly receiverSchedules: Schedule[];
  readonly fetchReceiverSchedules: (id: string) => void;
  readonly isSubmitLoading: boolean;
}

function formatScheduleOption(s: Schedule | null | undefined): string {
  if (!s?.date) return "-";
  const d = new Date(s.date);
  const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
  const dateFormatted = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const shiftName = s.shift?.name || "Shift";
  const startTime = s.shift?.start_time ? s.shift.start_time.substring(0, 5) : "";
  const endTime = s.shift?.end_time ? s.shift.end_time.substring(0, 5) : "";
  const timeRange = startTime && endTime ? ` (${startTime} - ${endTime})` : "";
  return `${dayName}, ${dateFormatted} — ${shiftName}${timeRange}`;
}

function getStatusBadge(status: string) {
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
}

function getReceiverSchedulePlaceholder(receiverId: string, schedulesCount: number): string {
  if (!receiverId) {
    return "Pilih rekan dulu...";
  }
  if (schedulesCount === 0) {
    return "Rekan ini belum memiliki jadwal shift";
  }
  return "Pilih Jadwal Rekan (Pilih Tanggal & Shift)...";
}

async function fetchUserShiftSchedules(userId: string | number): Promise<Schedule[]> {
  if (!userId) return [];
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const res = await axiosInstance.get(`/schedules?user_id=${userId}&start_date=${startOfMonth}&per_page=100`);
    const schedData = res.data.data;
    const rawList = Array.isArray(schedData) ? schedData : (schedData?.data || []);
    return rawList.filter((s: any) => s.shift?.name);
  } catch (e) {
    console.error("Gagal ambil jadwal shift", e);
    return [];
  }
}

async function fetchEligibleShiftUsers(currentUserId?: number): Promise<WebUser[]> {
  try {
    const usersRes = await axiosInstance.get("/employees?attendance_type=shift&per_page=100");
    const uData = usersRes.data.data;
    const rawUsers = Array.isArray(uData) ? uData : (uData?.data || []);
    return rawUsers.filter((u: any) => u.id !== currentUserId && (u.attendance_type === 'shift' || !u.attendance_type));
  } catch (e) {
    console.error("Gagal ambil data rekan kerja shift", e);
    return [];
  }
}

function filterSwaps(list: ShiftSwap[], term: string): ShiftSwap[] {
  if (!term.trim()) return list;
  const q = term.toLowerCase();
  return list.filter(s =>
    s.requester.name.toLowerCase().includes(q) ||
    s.receiver.name.toLowerCase().includes(q) ||
    s.reason.toLowerCase().includes(q)
  );
}

function ShiftSwapStats(props: ShiftSwapStatsProps) {
  const { canApprove, managerReviewCount, pendingReceiverCount, approvedCount, requesterPendingCount } = props;

  if (canApprove) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Menunggu Approval Atasan</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{managerReviewCount}</p>
          </div>
        </div>
        <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Menunggu Respon Rekan</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{pendingReceiverCount}</p>
          </div>
        </div>
        <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Disetujui (Approved)</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{approvedCount}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <Clock size={22} />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Permintaan Masuk Ke Saya</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{pendingReceiverCount}</p>
        </div>
      </div>
      <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
          <AlertCircle size={22} />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Menunggu Diproses</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{requesterPendingCount}</p>
        </div>
      </div>
      <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
          <CheckCircle2 size={22} />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Disetujui (Approved)</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{approvedCount}</p>
        </div>
      </div>
    </div>
  );
}

function ShiftSwapRowActions(props: ShiftSwapRowActionsProps) {
  const { swap, currentUserId, canApprove, onRespond, onApprove } = props;

  if (swap.status === 'pending_receiver' && swap.receiver_id === currentUserId) {
    return (
      <>
        <button 
          onClick={() => onRespond(swap.id, 'rejected')} 
          className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition"
        >
          Tolak
        </button>
        <button 
          onClick={() => onRespond(swap.id, 'approved_by_receiver')} 
          className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition shadow-sm"
        >
          Terima
        </button>
      </>
    );
  }

  if (swap.status === 'pending_manager' && canApprove) {
    return (
      <>
        <button 
          onClick={() => onApprove(swap.id, 'rejected')} 
          className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition"
        >
          Reject
        </button>
        <button 
          onClick={() => onApprove(swap.id, 'approved')} 
          className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition shadow-sm"
        >
          Approve
        </button>
      </>
    );
  }

  if (swap.status === 'pending_receiver' && swap.requester_id === currentUserId) {
    return <span className="text-[11px] text-gray-400 font-medium italic">Menunggu respon rekan</span>;
  }
  if (swap.status === 'pending_manager' && swap.requester_id === currentUserId) {
    return <span className="text-[11px] text-orange-500 font-medium italic">Menunggu approval atasan</span>;
  }
  if (swap.status === 'approved') {
    return <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1"><Check size={14} /> Sukses</span>;
  }
  if (swap.status === 'rejected') {
    return <span className="text-[11px] text-red-600 font-bold uppercase tracking-wider flex items-center gap-1"><X size={14} /> Ditolak</span>;
  }
  return null;
}

function ShiftSwapCreateModal(props: ShiftSwapCreateModalProps) {
  const {
    isOpen,
    onClose,
    onSubmit,
    formData,
    setFormData,
    users,
    mySchedules,
    receiverSchedules,
    fetchReceiverSchedules,
    isSubmitLoading
  } = props;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
       <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-3">
               <div className="p-2.5 bg-red-50 text-[#8B0000] rounded-xl shadow-sm">
                  <ArrowLeftRight size={20} />
               </div>
               <div>
                <h3 className="font-bold text-gray-950 text-lg tracking-tight">Form Pengajuan Tukar Shift</h3>
                <p className="text-xs text-gray-500 font-medium italic">Pilih rekan kerja shift dan tentukan jadwal yang ingin ditukar.</p>
               </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-150 rounded-full transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label htmlFor="receiver-select" className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-0.5">1. Pilih Rekan Kerja (Pola Shift)</label>
                   <select id="receiver-select" 
                     className="w-full h-11 bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-red-150 focus:border-[#8B0000] transition-all"
                     value={formData.receiver_id}
                     onChange={(e) => {
                       setFormData({...formData, receiver_id: e.target.value, receiver_schedule_id: ""});
                       fetchReceiverSchedules(e.target.value);
                     }}
                     required
                   >
                      <option value="">{users.length === 0 ? "Tidak ada rekan shift tersedia..." : "Pilih Rekan Kerja..."}</option>
                      {users.map((u) => {
                        const roleDisplay = u.role?.name ? ` (${u.role.name})` : "";
                        return (
                          <option key={u.id} value={u.id}>
                            {u.name}{roleDisplay}
                          </option>
                        );
                      })}
                   </select>
                </div>

                <div className="space-y-1.5">
                   <label htmlFor="requester-schedule-select" className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-0.5">2. Jadwal Anda (Dilepas)</label>
                   <select 
                      className="w-full h-11 bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-red-150 focus:border-[#8B0000] transition-all"
                      id="requester-schedule-select"
                      value={formData.requester_schedule_id}
                      onChange={(e) => setFormData({...formData, requester_schedule_id: e.target.value})}
                      required
                   >
                      <option value="">{mySchedules.length === 0 ? "Belum ada jadwal shift Anda bulan ini" : "Pilih Jadwal Anda..."}</option>
                      {mySchedules.map(s => (
                        <option key={s.id} value={s.id}>
                          {formatScheduleOption(s)}
                        </option>
                      ))}
                   </select>
                </div>

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
                        {getReceiverSchedulePlaceholder(formData.receiver_id, receiverSchedules.length)}
                      </option>
                      {receiverSchedules.map(s => (
                        <option key={s.id} value={s.id}>
                          {formatScheduleOption(s)}
                        </option>
                      ))}
                   </select>
                </div>

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
                   <p className="text-[11px] text-gray-500 font-medium leading-relaxed italic">Permintaan ini akan otomatis diperbarui setelah rekan Anda menyetujui DAN mendapat persetujuan akhir dari Super Admin / Manager.</p>
                </div>
             </div>

             <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={onClose} 
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
  );
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

  const canApprove = Boolean(
    user?.role_id === 1 || 
    user?.role?.name === 'Super Admin' || 
    hasPermission('approve-shift-swaps')
  );

  const fetchSwaps = async (page = 1) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/shift-swap?page=${page}`);
      const pageData = res.data.data;
      if (pageData?.data) {
        setSwaps(pageData.data || []);
        setCurrentPage(pageData.current_page);
        setLastPage(pageData.last_page);
        setTotal(pageData.total);
      } else {
        setSwaps(pageData || []);
        setLastPage(1);
        setTotal((pageData || []).length);
      }
    } catch (e) {
      console.error("Gagal ambil data tukar shift", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    const shiftUsers = await fetchEligibleShiftUsers(user?.id);
    setUsers(shiftUsers);
    if (user?.id) {
      const schedules = await fetchUserShiftSchedules(user.id);
      setMySchedules(schedules);
    }
  };

  const fetchReceiverSchedules = async (receiverId: string) => {
    const schedules = await fetchUserShiftSchedules(receiverId);
    setReceiverSchedules(schedules);
  };

  useEffect(() => {
    fetchSwaps(currentPage);
    if (user?.id) {
      fetchInitialData();
    }
  }, [currentPage, user?.id]);

  useEffect(() => {
    if (isModalOpen && user?.id) {
      fetchInitialData();
    }
  }, [isModalOpen, user?.id]);

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

  if (loading && swaps.length === 0) return <ListPageSkeleton />;

  const myRequests = swaps.filter(s => s.requester_id === user?.id || (s.receiver_id === user?.id && s.status === 'pending_receiver'));
  const managerReview = swaps.filter(s => s.status === 'pending_manager');

  const filteredMyRequests = filterSwaps(myRequests, searchTerm);
  const filteredManagerReview = filterSwaps(managerReview, searchTerm);

  const activeList = (canApprove && activeTab === 'to_review') ? filteredManagerReview : filteredMyRequests;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title flex items-center gap-2">
            <ArrowLeftRight size={24} className="text-[#8B0000]" />
            Tukar Shift
          </h1>
          <p className="dash-page-desc">Ajukan pertukaran jadwal shift dengan sesama rekan kerja secara resmi.</p>
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

      <ShiftSwapStats
        canApprove={canApprove}
        managerReviewCount={managerReview.length}
        pendingReceiverCount={swaps.filter(s => s.receiver_id === user?.id && s.status === 'pending_receiver').length}
        approvedCount={canApprove ? swaps.filter(s => s.status === 'approved').length : swaps.filter(s => (s.requester_id === user?.id || s.receiver_id === user?.id) && s.status === 'approved').length}
        requesterPendingCount={swaps.filter(s => s.requester_id === user?.id && (s.status === 'pending_receiver' || s.status === 'pending_manager')).length}
      />

      <div className="space-y-4">
        {canApprove ? (
          <div className="flex border-b border-gray-200 gap-6">
             <button 
              onClick={() => { setActiveTab('my_requests'); setSearchTerm(""); }}
              className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'my_requests' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
             >
               Permintaan Saya
               {activeTab === 'my_requests' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B0000]" />}
             </button>
             <button 
              onClick={() => { setActiveTab('to_review'); setSearchTerm(""); }}
              className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'to_review' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
             >
               Approval Manager / Super Admin
               {managerReview.length > 0 && (
                 <span className="ml-2 px-1.5 py-0.5 bg-red-600 text-[10px] text-white rounded-full align-middle font-bold">
                   {managerReview.length}
                 </span>
               )}
               {activeTab === 'to_review' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B0000]" />}
             </button>
          </div>
        ) : (
          <div className="flex border-b border-gray-200 gap-6">
             <div className="pb-3 text-sm font-bold text-gray-900 border-b-2 border-[#8B0000]">
               Daftar Pengajuan Saya
             </div>
          </div>
        )}

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
                            {swap.requester?.name?.charAt(0) || "U"}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 text-xs">{swap.requester?.name}</span>
                            {swap.requester_id === user?.id && (
                              <span className="text-[9px] text-[#8B0000] font-bold bg-red-50 px-1 py-0.5 rounded w-max mt-0.5">Anda</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {swap.receiver?.name?.charAt(0) || "U"}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 text-xs">{swap.receiver?.name}</span>
                            {swap.receiver_id === user?.id && (
                              <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1 py-0.5 rounded w-max mt-0.5">Anda</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-gray-800">
                            {swap.requester_schedule?.date ? new Date(swap.requester_schedule.date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {swap.requester_schedule?.shift?.name || "Shift"} ({swap.requester_schedule?.shift?.start_time ? swap.requester_schedule.shift.start_time.substring(0, 5) : ""} - {swap.requester_schedule?.shift?.end_time ? swap.requester_schedule.shift.end_time.substring(0, 5) : ""})
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-gray-800">
                            {swap.receiver_schedule?.date ? new Date(swap.receiver_schedule.date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {swap.receiver_schedule?.shift?.name || "Shift"} ({swap.receiver_schedule?.shift?.start_time ? swap.receiver_schedule.shift.start_time.substring(0, 5) : ""} - {swap.receiver_schedule?.shift?.end_time ? swap.receiver_schedule.shift.end_time.substring(0, 5) : ""})
                          </span>
                        </div>
                      </td>
                      <td className="max-w-[200px] truncate" title={swap.reason}>
                        <span className="text-xs text-gray-600 italic">"{swap.reason}"</span>
                      </td>
                      <td>{getStatusBadge(swap.status)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <ShiftSwapRowActions
                            swap={swap}
                            currentUserId={user?.id}
                            canApprove={canApprove}
                            onRespond={handleRespond}
                            onApprove={handleApprove}
                          />
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

      <ShiftSwapCreateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        users={users}
        mySchedules={mySchedules}
        receiverSchedules={receiverSchedules}
        fetchReceiverSchedules={fetchReceiverSchedules}
        isSubmitLoading={isSubmitLoading}
      />
    </div>
  );
}
