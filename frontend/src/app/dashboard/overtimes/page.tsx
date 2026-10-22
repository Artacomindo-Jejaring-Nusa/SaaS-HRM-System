"use client";

import { useEffect, useState, useMemo } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Plus, Search, Eye, Clock, Trash2, Printer, 
  CheckCircle2, XCircle, AlertCircle, Users, 
  Calendar, Building2, UserCheck, Briefcase
} from "lucide-react";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";

interface OvertimeItem {
  id?: number;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
}

interface OvertimeRecord {
  id: number;
  title: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'draft';
  date?: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
  rejection_reason?: string | null;
  responded_at?: string | null;
  created_at?: string;
  updated_at?: string;
  user_id: number;
  assigned_by?: number | null;
  user?: { 
    id: number;
    name: string; 
    email?: string;
    profile_photo_url?: string;
    role?: { id: number; name: string }; 
    office?: { name: string }; 
    company?: { name: string };
    supervisor?: { name: string };
  };
  assigner?: {
    id: number;
    name: string;
    email?: string;
    profile_photo_url?: string;
    role?: { id: number; name: string };
  } | null;
  division?: {
    id: number;
    name: string;
  } | null;
  approver?: { name: string } | null;
  remark?: string | null;
  signature?: string | null;
  items?: OvertimeItem[];
}

interface Employee {
  id: number;
  name: string;
  role?: { id: number; name: string };
  department?: string;
  profile_photo_url?: string;
}

interface RoleOption {
  id: number;
  name: string;
}

export default function OvertimesPage() {
  const { user, hasPermission } = useAuth();

  const isSuperAdmin = Boolean(
    user?.role_id === 1 ||
    user?.role?.id === 1 ||
    user?.role?.name?.toLowerCase().includes("super admin") ||
    user?.can_access_all_companies
  );

  const canAssign = isSuperAdmin || hasPermission('manage-overtimes') || hasPermission('assign-overtimes');
  const canApply = isSuperAdmin || hasPermission('apply-overtimes') || hasPermission('manage-overtimes');
  const canReceive = true; // All employees can receive overtime orders

  const [activeTab, setActiveTab] = useState<'received' | 'sent'>(() => {
    return (!canReceive && canAssign) ? 'sent' : 'received';
  });

  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isSelfModalOpen, setIsSelfModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedOvertime, setSelectedOvertime] = useState<OvertimeRecord | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "detail" | "print">("list");
  
  // Assign Form state
  const [assignTargetType, setAssignTargetType] = useState<'users' | 'division'>('users');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("17:00");
  const [formEndTime, setFormEndTime] = useState("20:00");
  const [formReason, setFormReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reject Form state
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Employees & Roles list for assignment
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");

  useEffect(() => {
    fetchOvertimes(page);
  }, [activeTab, page, statusFilter]);

  useEffect(() => {
    if (isAssignModalOpen && canAssign) {
      fetchAssignmentOptions();
    }
  }, [isAssignModalOpen, canAssign]);

  const fetchOvertimes = async (p: number) => {
    try {
      setLoading(true);
      let url = `/overtimes?type=${activeTab}&page=${p}`;
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      const res = await axiosInstance.get(url);
      const data = res.data.data?.data || res.data.data || [];
      setOvertimes(data);
      if (res.data.data?.current_page) {
        setPagination({
          current_page: res.data.data.current_page,
          last_page: res.data.data.last_page,
          total: res.data.data.total
        });
      }
    } catch (err) {
      console.error("Gagal mengambil data lembur", err);
      toast.error("Gagal memuat data lembur.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentOptions = async () => {
    try {
      const [empRes, roleRes] = await Promise.all([
        axiosInstance.get('/employees?per_page=150'),
        axiosInstance.get('/roles')
      ]);
      setEmployees(empRes.data.data?.data || empRes.data.data || []);
      setRoles(roleRes.data.data || []);
    } catch (err) {
      console.error("Gagal mengambil opsi karyawan/divisi", err);
    }
  };

  const handleAssignOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assignTargetType === 'users' && selectedUserIds.length === 0) {
      toast.error("Pilih minimal satu karyawan untuk diberikan perintah lembur.");
      return;
    }
    if (assignTargetType === 'division' && !selectedDivisionId) {
      toast.error("Pilih divisi/departemen untuk diberikan perintah lembur.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Record<string, unknown> = {
        title: formTitle,
        date: formDate,
        start_time: formStartTime,
        end_time: formEndTime,
        reason: formReason,
        is_assignment: true,
      };

      if (assignTargetType === 'users') {
        payload.user_id = selectedUserIds;
      } else {
        payload.division_id = Number(selectedDivisionId);
      }

      await axiosInstance.post('/overtimes', payload);
      toast.success("Perintah lembur (SPKL) berhasil diterbitkan.");
      setIsAssignModalOpen(false);
      resetAssignForm();
      fetchOvertimes(1);
    } catch (err: unknown) {
      console.error("Gagal menugaskan lembur", err);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Gagal menerbitkan perintah lembur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelfSubmitOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate || !formStartTime || !formEndTime || !formReason.trim()) {
      toast.error("Mohon lengkapi semua field yang berbintang merah.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        title: formTitle || `Pengajuan Lembur - ${formDate}`,
        date: formDate,
        start_time: formStartTime,
        end_time: formEndTime,
        reason: formReason,
        is_assignment: false,
      };

      await axiosInstance.post('/overtimes', payload);
      toast.success("Permohonan lembur berhasil diajukan dan sedang menunggu persetujuan.");
      setIsSelfModalOpen(false);
      resetAssignForm();
      fetchOvertimes(1);
    } catch (err: unknown) {
      console.error("Gagal mengajukan lembur mandiri", err);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Gagal mengajukan lembur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAssignForm = () => {
    setSelectedUserIds([]);
    setSelectedDivisionId("");
    setFormTitle("");
    setFormDate("");
    setFormStartTime("17:00");
    setFormEndTime("20:00");
    setFormReason("");
  };

  const handleRespond = async (id: number, action: 'accept' | 'reject') => {
    if (action === 'reject') {
      const ot = overtimes.find(o => o.id === id);
      if (ot) {
        setSelectedOvertime(ot);
        setRejectionReason("");
        setIsRejectModalOpen(true);
      }
      return;
    }

    try {
      setLoading(true);
      await axiosInstance.post(`/overtimes/${id}/respond`, { action: 'accept' });
      toast.success("Perintah lembur telah Anda setujui.");
      fetchOvertimes(page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Gagal merespon lembur.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOvertime) return;
    if (!rejectionReason.trim()) {
      toast.error("Mohon isi alasan/komentar penolakan.");
      return;
    }

    try {
      setIsRejecting(true);
      await axiosInstance.post(`/overtimes/${selectedOvertime.id}/respond`, {
        action: 'reject',
        reason: rejectionReason
      });
      toast.success("Perintah lembur telah ditolak dengan catatan.");
      setIsRejectModalOpen(false);
      setSelectedOvertime(null);
      setRejectionReason("");
      fetchOvertimes(page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Gagal menolak lembur.");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin membatalkan/menghapus perintah lembur ini?")) return;
    try {
      setLoading(true);
      await axiosInstance.delete(`/overtimes/${id}`);
      toast.success("Perintah lembur berhasil dibatalkan.");
      fetchOvertimes(page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Gagal menghapus perintah lembur.");
    } finally {
      setLoading(false);
    }
  };

  const filteredOvertimes = useMemo(() => {
    if (!searchQuery.trim()) return overtimes;
    const q = searchQuery.toLowerCase();
    return overtimes.filter(ot => 
      ot.title?.toLowerCase().includes(q) ||
      ot.user?.name.toLowerCase().includes(q) ||
      ot.assigner?.name.toLowerCase().includes(q) ||
      ot.reason?.toLowerCase().includes(q)
    );
  }, [overtimes, searchQuery]);

  const stats = useMemo(() => {
    const total = overtimes.length;
    const pending = overtimes.filter(o => o.status === 'pending').length;
    const approved = overtimes.filter(o => o.status === 'approved').length;
    const rejected = overtimes.filter(o => o.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [overtimes]);

  const filteredEmployeesForSelect = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const q = employeeSearch.toLowerCase();
    return employees.filter(e => 
      e.name.toLowerCase().includes(q) ||
      e.role?.name?.toLowerCase().includes(q)
    );
  }, [employees, employeeSearch]);

  const toggleSelectUser = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const selectAllFilteredUsers = () => {
    const allIds = filteredEmployeesForSelect.map(e => e.id);
    const newSelected = Array.from(new Set([...selectedUserIds, ...allIds]));
    setSelectedUserIds(newSelected);
  };

  const clearSelectedUsers = () => {
    setSelectedUserIds([]);
  };

  const calculateHours = (start?: string, end?: string): string => {
    if (!start || !end) return "-";
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60; // Cross midnight
      const hours = (diff / 60).toFixed(1);
      return `${hours} Jam`;
    } catch {
      return "-";
    }
  };

  const formatDateIndo = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const emptyTabMessage = activeTab === 'received'
    ? 'Belum ada surat perintah lembur yang ditugaskan ke Anda saat ini.'
    : 'Belum ada perintah lembur yang Anda tugaskan ke karyawan.';

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-7 h-7 text-[#800000]" />
            Surat Perintah Kerja Lembur (SPKL)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pengelolaan tugas dan perintah lembur resmi karyawan berstandar ketenagakerjaan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canApply && (
            <button
              onClick={() => {
                resetAssignForm();
                setIsSelfModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-[#800000]/20"
            >
              <Calendar className="w-4 h-4 text-[#800000]" />
              Ajukan Lembur Mandiri
            </button>
          )}

          {canAssign && (
            <button
              onClick={() => {
                resetAssignForm();
                setIsAssignModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#800000] hover:bg-[#990000] text-white text-sm font-semibold rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-[#800000]/20"
            >
              <Plus className="w-4 h-4" />
              Tugaskan Lembur (SPKL)
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Lembur</div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Menunggu Respon</div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.approved}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Disetujui / Diterima</div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{stats.rejected}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Ditolak</div>
          </div>
        </div>
      </div>

      {/* Tabs and Filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              setActiveTab('received');
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'received'
                ? 'bg-white dark:bg-gray-700 text-[#800000] dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Lembur Saya (Diterima)
          </button>

          {canAssign && (
            <button
              onClick={() => {
                setActiveTab('sent');
                setPage(1);
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'sent'
                  ? 'bg-white dark:bg-gray-700 text-[#800000] dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Perintah Lembur Diberikan
            </button>
          )}
        </div>

        {/* Search & Status Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari perintah lembur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#800000]/20 outline-none text-gray-900 dark:text-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#800000]/20 outline-none text-gray-700 dark:text-gray-300"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu Respon</option>
            <option value="approved">Disetujui / Diterima</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>
      </div>

      {/* Main Table / List View */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        {loading && <TableSkeleton rows={5} />}

        {!loading && filteredOvertimes.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto text-gray-400 mb-3">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Tidak ada perintah lembur</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {emptyTabMessage}
            </p>
          </div>
        )}

        {!loading && filteredOvertimes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Tugas Lembur</th>
                  <th className="px-6 py-4 font-semibold">
                    {activeTab === 'received' ? 'Pemberi Tugas' : 'Karyawan'}
                  </th>
                  <th className="px-6 py-4 font-semibold">Jadwal & Waktu</th>
                  <th className="px-6 py-4 font-semibold">Status Respon</th>
                  <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOvertimes.map((ot) => {
                  const effectiveDate = ot.date || ot.items?.[0]?.date;
                  const effectiveStart = ot.start_time || ot.items?.[0]?.start_time;
                  const effectiveEnd = ot.end_time || ot.items?.[0]?.end_time;
                  const effectiveReason = ot.reason || ot.items?.[0]?.reason || ot.title;

                  const isPending = ot.status === 'pending';
                  const isApproved = ot.status === 'approved';
                  const isRejected = ot.status === 'rejected';

                  const canManageThis = isSuperAdmin || (ot.assigned_by === user?.id);

                  return (
                    <tr key={ot.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                      {/* Judul & Alasan */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {ot.title || "Perintah Lembur"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {effectiveReason}
                        </div>
                      </td>

                      {/* Aktor (Pemberi Tugas atau Penerima) */}
                      <td className="px-6 py-4">
                        {activeTab === 'received' ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#800000]/10 text-[#800000] font-bold text-xs flex items-center justify-center">
                              {ot.assigner?.name?.charAt(0) || "A"}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {ot.assigner?.name || "Atasan / Supervisor"}
                              </div>
                              <div className="text-xs text-gray-400">
                                {ot.assigner?.role?.name || "Pemberi Tugas"}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                              {ot.user?.name?.charAt(0) || "K"}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {ot.user?.name || "Karyawan"}
                              </div>
                              <div className="text-xs text-gray-400">
                                {ot.user?.role?.name || ot.division?.name || "Staff"}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Jadwal & Durasi */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-white">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {formatDateIndo(effectiveDate)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                          <span>{effectiveStart?.substring(0, 5)} - {effectiveEnd?.substring(0, 5)}</span>
                          <span className="inline-block px-1.5 py-0.2 bg-gray-100 dark:bg-gray-700 rounded text-[11px] font-medium text-gray-600 dark:text-gray-300">
                            {calculateHours(effectiveStart, effectiveEnd)}
                          </span>
                        </div>
                      </td>

                      {/* Status Respon */}
                      <td className="px-6 py-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                            <Clock className="w-3.5 h-3.5" />
                            Menunggu Konfirmasi
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Disetujui
                          </span>
                        )}
                        {isRejected && (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800">
                              <XCircle className="w-3.5 h-3.5" />
                              Ditolak Karyawan
                            </span>
                            {ot.rejection_reason && (
                              <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 max-w-xs truncate" title={ot.rejection_reason}>
                                Catatan: {ot.rejection_reason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Tombol Aksi */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Aksi khusus karyawan pada lembur diterima yang pending */}
                          {activeTab === 'received' && isPending && (
                            <>
                              <button
                                onClick={() => handleRespond(ot.id, 'accept')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
                                title="Terima Perintah Lembur"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Terima
                              </button>
                              <button
                                onClick={() => handleRespond(ot.id, 'reject')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-rose-50 border border-rose-300 text-rose-600 rounded-lg text-xs font-medium transition"
                                title="Tolak dengan Alasan"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Tolak
                              </button>
                            </>
                          )}

                          {/* Tombol Lihat Detail */}
                          <button
                            onClick={() => {
                              setSelectedOvertime(ot);
                              setViewMode("detail");
                            }}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                            title="Lihat Detail SPKL"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Tombol Hapus / Batalkan Perintah */}
                          {canManageThis && (
                            <button
                              onClick={() => handleDelete(ot.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                              title="Batalkan / Hapus Perintah Lembur"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.total > 10 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              currentPage={pagination.current_page}
              lastPage={pagination.last_page}
              total={pagination.total}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* MODAL 1: TUGASKAN LEMBUR (SPKL) */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#800000]/10 text-[#800000] flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Terbitkan Perintah Kerja Lembur (SPKL)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tugaskan lembur kepada karyawan atau divisi tertentu.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignOvertime} className="mt-5 space-y-4">
              {/* Target Selector Mode */}
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Target Penerima Lembur
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAssignTargetType('users')}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition ${
                      assignTargetType === 'users'
                        ? 'bg-[#800000]/10 border-[#800000] text-[#800000]'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Pilih Karyawan Spesifik ({selectedUserIds.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignTargetType('division')}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition ${
                      assignTargetType === 'division'
                        ? 'bg-[#800000]/10 border-[#800000] text-[#800000]'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Pilih Satu Divisi / Role
                  </button>
                </div>
              </div>

              {/* Employee multi-select list */}
              {assignTargetType === 'users' ? (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-900/30">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="text"
                      placeholder="Cari nama karyawan..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none w-56 text-gray-900 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllFilteredUsers}
                        className="text-[11px] font-semibold text-[#800000] hover:underline"
                      >
                        Pilih Semua
                      </button>
                      <button
                        type="button"
                        onClick={clearSelectedUsers}
                        className="text-[11px] text-gray-500 hover:underline"
                      >
                        Batal Pilih
                      </button>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredEmployeesForSelect.map(emp => {
                      const isSelected = selectedUserIds.includes(emp.id);
                      return (
                        <button
                          type="button"
                          key={emp.id}
                          onClick={() => toggleSelectUser(emp.id)}
                          className={`w-full text-left flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                            isSelected ? 'bg-red-50/70 dark:bg-red-950/30' : 'hover:bg-gray-100/60 dark:hover:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-[#800000] focus:ring-[#800000]"
                            />
                            <div>
                              <div className="text-xs font-semibold text-gray-900 dark:text-white">{emp.name}</div>
                              <div className="text-[10px] text-gray-400">{emp.role?.name || "Staff"}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="assign-division-select" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Divisi / Role Penerima
                  </label>
                  <select
                    id="assign-division-select"
                    value={selectedDivisionId}
                    onChange={(e) => setSelectedDivisionId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  >
                    <option value="">-- Pilih Divisi / Role --</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Judul Perintah Lembur */}
              <div>
                <label htmlFor="assign-title-input" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Judul Perintah Lembur <span className="text-red-500">*</span>
                </label>
                <input
                  id="assign-title-input"
                  type="text"
                  required
                  placeholder="Contoh: Perbaikan Bug Server & Maintenance Database"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#800000]/20 text-gray-900 dark:text-white"
                />
              </div>

              {/* Tanggal & Waktu */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="assign-date-input" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal Lembur <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="assign-date-input"
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="assign-start-time-input" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Jam Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="assign-start-time-input"
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="assign-end-time-input" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Jam Selesai <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="assign-end-time-input"
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Deskripsi Tugas Lembur */}
              <div>
                <label htmlFor="assign-reason-textarea" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Rincian Tugas & Deskripsi Pekerjaan <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="assign-reason-textarea"
                  required
                  rows={3}
                  placeholder="Jelaskan secara spesifik instruksi pekerjaan lembur yang harus diselesaikan..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#800000]/20 text-gray-900 dark:text-white"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 rounded-xl font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#800000] hover:bg-[#990000] text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 transition"
                >
                  {isSubmitting ? "Menerbitkan..." : "Terbitkan SPKL"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PENGAJUAN LEMBUR MANDIRI */}
      {isSelfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#800000] flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Pengajuan Lembur Mandiri
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Masuk ke Approval Workflow yang telah ditentukan Super Admin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSelfModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSelfSubmitOvertime} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Judul / Agenda Lembur
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Penyelesaian Laporan Keuangan Bulanan"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#800000]/20 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Lembur <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Jam Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Jam Selesai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Alasan & Uraian Pekerjaan <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Jelaskan kebutuhan mendesak atau pekerjaan yang harus diselesaikan pada lembur ini..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#800000]/20 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsSelfModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 rounded-xl font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#800000] hover:bg-[#990000] text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 transition"
                >
                  {isSubmitting ? "Mengirimkan..." : "Kirim Pengajuan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TOLAK PERINTAH LEMBUR (DENGAN KOMENTAR) */}
      {isRejectModalOpen && selectedOvertime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Tolak Perintah Lembur
              </h3>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Anda akan menolak perintah lembur <strong>&quot;{selectedOvertime.title}&quot;</strong>. Mohon berikan alasan penolakan agar dapat ditinjau oleh atasan Anda.
            </p>

            <form onSubmit={handleConfirmReject} className="mt-4 space-y-4">
              <div>
                <label htmlFor="reject-reason-textarea" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Alasan / Komentar Penolakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reject-reason-textarea"
                  required
                  rows={3}
                  placeholder="Contoh: Mohon maaf ada keperluan keluarga mendesak / kondisi badan kurang fit..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRejectModalOpen(false);
                    setSelectedOvertime(null);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 transition"
                >
                  {isRejecting ? "Mengirim..." : "Kirim Penolakan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DETAIL / CETAK SPKL */}
      {viewMode === "detail" && selectedOvertime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#800000]/10 text-[#800000] flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Detail Dokumen SPKL #{selectedOvertime.id}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Surat Perintah Kerja Lembur Resmi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewMode("list")}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="text-base font-bold text-gray-900 dark:text-white">
                  {selectedOvertime.title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedOvertime.reason || selectedOvertime.items?.[0]?.reason}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">Pemberi Perintah:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {selectedOvertime.assigner?.name || "Atasan / Supervisor"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Karyawan Ditugaskan:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {selectedOvertime.user?.name || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Tanggal Lembur:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatDateIndo(selectedOvertime.date || selectedOvertime.items?.[0]?.date)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Waktu Pelaksanaan:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {(selectedOvertime.start_time || selectedOvertime.items?.[0]?.start_time)?.substring(0, 5)} - {(selectedOvertime.end_time || selectedOvertime.items?.[0]?.end_time)?.substring(0, 5)} ({calculateHours(selectedOvertime.start_time, selectedOvertime.end_time)})
                  </span>
                </div>
              </div>

              {/* Status Section */}
              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status Konfirmasi:</span>
                  {selectedOvertime.status === 'pending' && (
                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Menunggu Konfirmasi Karyawan
                    </span>
                  )}
                  {selectedOvertime.status === 'approved' && (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Disetujui Karyawan
                    </span>
                  )}
                  {selectedOvertime.status === 'rejected' && (
                    <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      Ditolak Karyawan
                    </span>
                  )}
                </div>

                {selectedOvertime.rejection_reason && (
                  <div className="mt-2.5 p-2.5 bg-rose-50/70 dark:bg-rose-950/30 rounded-lg text-xs text-rose-700 dark:text-rose-400 border border-rose-200/50">
                    <span className="font-bold block mb-0.5">Alasan Penolakan:</span>
                    {selectedOvertime.rejection_reason}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => globalThis.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak SPKL
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
