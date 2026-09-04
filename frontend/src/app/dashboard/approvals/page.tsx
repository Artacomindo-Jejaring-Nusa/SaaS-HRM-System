"use client";

import { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  Eye, 
  FileText, 
  MapPin, 
  Phone, 
  Calendar,
  Building2
} from "lucide-react";
import { ListPageSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ApprovalType = "leave" | "reimbursement" | "profile" | "overtime" | "permit" | "dinas_luar" | "fund_request";
type FilterType = "all" | ApprovalType;
type ActionType = "approve" | "reject";

interface OvertimeItemDetail {
  id?: number;
  date?: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

interface ReimbursementItemDetail {
  id?: number;
  item_name?: string;
  description?: string;
  amount?: number | string;
  receipt?: string;
}

interface ApprovalItem {
  id: number;
  type: ApprovalType;
  user_name: string;
  user_email?: string;
  user_role?: string;
  category: string;
  description: string;
  amount?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  attachment?: string;
  attachments?: string[];
  signature?: string;
  created_at: string;
  // Permit-specific fields
  permit_category?: string;
  permit_has_doctor_note?: boolean;
  permit_is_deducted?: boolean;
  target_supervisor_id?: number | null;
  // Leave-specific
  leave_address?: string;
  emergency_phone?: string;
  // Overtime-specific
  overtime_items?: OvertimeItemDetail[];
  // Reimbursement-specific
  reimbursement_items?: ReimbursementItemDetail[];
  reimbursement_divisi?: string;
  reimbursement_tujuan?: string;
  // Profile-specific
  profile_new_data?: Record<string, unknown>;
  // Dinas Luar-specific
  dinas_luar_status?: string;
  dinas_luar_destination?: string;
  dinas_luar_notes?: string;
}

interface RawLeave {
  id: number;
  reason?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  leave_address?: string;
  emergency_phone?: string;
  signature?: string;
  status: "pending" | "approved" | "rejected" | "pending_supervisor" | "pending_hr";
  created_at: string;
  user?: {
    name?: string;
    email?: string;
    role?: { name?: string };
    supervisor_id?: number;
  };
}

interface RawReimbursement {
  id: number;
  employee_name?: string;
  title?: string;
  description?: string;
  amount?: string | number;
  status: "pending" | "approved" | "rejected" | "waiting_approval";
  attachment?: string | string[];
  signature?: string;
  items?: ReimbursementItemDetail[];
  divisi?: string;
  tujuan?: string;
  created_at: string;
  user?: {
    name?: string;
    email?: string;
    role?: { name?: string };
    supervisor_id?: number;
  };
}

interface RawOvertime {
  id: number;
  title?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "waiting_approval";
  created_at: string;
  signature?: string;
  items?: OvertimeItemDetail[];
  user?: {
    name?: string;
    email?: string;
    role?: { name?: string };
    supervisor_id?: number;
  };
}

interface RawProfileRequest {
  id: number;
  new_data: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "waiting_approval";
  created_at: string;
  user?: {
    name?: string;
    email?: string;
    role?: { name?: string };
    supervisor_id?: number;
  };
}

interface RawPermit {
  id: number;
  reason?: string;
  type?: string;
  category?: string;
  has_doctor_note?: boolean;
  is_deducted?: boolean;
  start_date?: string;
  end_date?: string;
  status: "pending" | "approved" | "rejected" | "waiting_approval";
  attachment?: string;
  signature?: string;
  created_at: string;
  user?: {
    name?: string;
    email?: string;
    role?: { name?: string };
    supervisor_id?: number;
  };
}

interface RawDinasLuar {
  id: number;
  check_in?: string;
  check_out?: string;
  date?: string;
  dinas_luar_destination?: string;
  dinas_luar_notes?: string;
  dinas_luar_status?: string;
  image_in_url?: string;
  image_in?: string;
  created_at: string;
  user?: {
    name?: string;
    email?: string;
    role?: { name?: string };
    supervisor_id?: number;
  };
}

interface RawFundRequest {
  id: number;
  employee_name?: string;
  title?: string;
  reason?: string;
  amount?: string | number;
  status: string;
  attachment?: string;
  signature?: string;
  created_at: string;
  user?: {
    name?: string;
    email?: string;
    role?: { name?: string };
    supervisor_id?: number;
  };
}

const typeLabel: Record<ApprovalType, string> = {
  leave: "Cuti",
  reimbursement: "Klaim",
  overtime: "Lembur",
  permit: "Izin",
  profile: "Profil",
  dinas_luar: "Dinas Luar",
  fund_request: "Dana",
};

const typeColor: Record<ApprovalType, string> = {
  leave: "bg-blue-50 text-blue-700 border-blue-200",
  reimbursement: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overtime: "bg-amber-50 text-amber-700 border-amber-200",
  permit: "bg-purple-50 text-purple-700 border-purple-200",
  profile: "bg-orange-50 text-orange-700 border-orange-200",
  dinas_luar: "bg-rose-50 text-rose-700 border-rose-200",
  fund_request: "bg-teal-50 text-teal-700 border-teal-200",
};

const extractStoragePath = (url?: string): string | undefined => {
  if (!url) return undefined;
  const idx = url.indexOf('/storage/');
  if (idx >= 0) {
    return url.substring(idx + 9);
  }
  return url;
};

const getApprovalEndpoint = (type: ApprovalType): string => {
  const map: Record<ApprovalType, string> = {
    leave: '/leave',
    reimbursement: '/reimbursements',
    profile: '/profile-requests',
    overtime: '/overtimes',
    permit: '/permits',
    dinas_luar: '/attendance/dinas-luar',
    fund_request: '/fund-requests',
  };
  return map[type] || `/${type}`;
};

const isLeaveAllowed = (status: string, isTargetSpv: boolean, isHR: boolean): boolean => {
  if (status === 'pending_supervisor') return isTargetSpv || isHR;
  if (status === 'pending_hr') return isHR;
  return status === 'pending' && (isHR || isTargetSpv);
};

const isDinasLuarAllowed = (dinasStatus: string | undefined, isTargetSpv: boolean, isHR: boolean): boolean => {
  if (dinasStatus === 'pending') return isTargetSpv || isHR;
  return dinasStatus === 'approved_spv' && isHR;
};

const shouldIncludeApprovalItem = (
  item: ApprovalItem,
  currentUserId: number | null,
  isHR: boolean
): boolean => {
  const targetSpvId = item.target_supervisor_id ? Number(item.target_supervisor_id) : null;
  const isTargetSpv = targetSpvId !== null && targetSpvId === currentUserId;

  // Non-HR users can ONLY see requests from their direct subordinates (bawahan langsung)
  if (!isHR && !isTargetSpv) {
    return false;
  }

  if (item.type === 'leave') {
    return isLeaveAllowed(item.status, isTargetSpv, isHR);
  }
  if (item.type === 'dinas_luar') {
    return isDinasLuarAllowed(item.dinas_luar_status, isTargetSpv, isHR);
  }
  if (item.type === 'profile') {
    return isHR;
  }
  return true;
};

const normalizeLeaves = (data: unknown): ApprovalItem[] =>
  (Array.isArray(data) ? data : ((data as { data?: RawLeave[] })?.data || [])).map((l: RawLeave) => ({
    id: l.id,
    type: "leave" as const,
    user_name: l.user?.name || "Karyawan",
    user_email: l.user?.email,
    user_role: l.user?.role?.name,
    description: l.reason || l.type || "Pengajuan Cuti",
    category: l.type || "Cuti Tahunan",
    start_date: l.start_date,
    end_date: l.end_date,
    status: l.status,
    attachment: undefined,
    signature: l.signature,
    leave_address: l.leave_address,
    emergency_phone: l.emergency_phone,
    created_at: l.created_at,
    target_supervisor_id: l.user?.supervisor_id
  }));

const normalizeReimbursements = (data: unknown): ApprovalItem[] =>
  (Array.isArray(data) ? data : ((data as { data?: RawReimbursement[] })?.data || [])).map((r: RawReimbursement) => {
    let attPath: string | undefined;
    let atts: string[] = [];
    if (typeof r.attachment === 'string') {
      attPath = extractStoragePath(r.attachment);
      if (attPath) atts.push(attPath);
    } else if (Array.isArray(r.attachment)) {
      atts = r.attachment.map((a: string) => extractStoragePath(a)).filter(Boolean) as string[];
      attPath = atts[0];
    }
    return {
      id: r.id,
      type: "reimbursement" as const,
      user_name: r.employee_name || r.user?.name || "Karyawan",
      user_email: r.user?.email,
      user_role: r.user?.role?.name,
      description: r.description || r.title || "Pengajuan Klaim Reimbursement",
      category: r.title || "Reimbursement",
      amount: r.amount ? String(r.amount) : undefined,
      status: r.status,
      attachment: attPath,
      attachments: atts,
      signature: r.signature,
      reimbursement_items: Array.isArray(r.items) ? r.items : [],
      reimbursement_divisi: r.divisi,
      reimbursement_tujuan: r.tujuan,
      created_at: r.created_at,
      target_supervisor_id: r.user?.supervisor_id
    };
  });

const normalizeFundRequests = (data: unknown): ApprovalItem[] =>
  (Array.isArray(data) ? data : ((data as { data?: RawFundRequest[] })?.data || [])).map((f: RawFundRequest) => ({
    id: f.id,
    type: "fund_request" as const,
    user_name: f.employee_name || f.user?.name || "Karyawan",
    user_email: f.user?.email,
    user_role: f.user?.role?.name,
    description: f.title || f.reason || "Pengajuan Uang Muka",
    category: "Pengajuan Dana",
    amount: f.amount ? String(f.amount) : undefined,
    status: f.status,
    attachment: extractStoragePath(f.attachment),
    signature: f.signature,
    created_at: f.created_at,
    target_supervisor_id: f.user?.supervisor_id
  }));

const normalizeOvertimes = (data: unknown): ApprovalItem[] =>
  (Array.isArray(data) ? data : ((data as { data?: RawOvertime[] })?.data || [])).map((o: RawOvertime) => {
    const items: OvertimeItemDetail[] = Array.isArray(o.items) ? o.items : [];
    const firstItem = items.length > 0 ? items[0] : undefined;

    const dateVal = o.date || firstItem?.date;
    const startTimeVal = o.start_time || firstItem?.start_time;
    const endTimeVal = o.end_time || firstItem?.end_time;
    const reasonVal = o.reason || firstItem?.reason || o.title || "Pengajuan Lembur";

    let formattedDate: string | undefined;
    if (dateVal) {
      formattedDate = startTimeVal && endTimeVal ? `${dateVal} (${startTimeVal} - ${endTimeVal})` : dateVal;
    } else if (startTimeVal && endTimeVal) {
      formattedDate = `${startTimeVal} - ${endTimeVal}`;
    }

    return {
      id: o.id,
      type: "overtime" as const,
      user_name: o.user?.name || "Karyawan",
      user_email: o.user?.email,
      user_role: o.user?.role?.name,
      description: reasonVal,
      category: o.title ? `Lembur: ${o.title}` : "Lembur",
      start_date: formattedDate || dateVal,
      end_date: items.length > 1 ? `+${items.length - 1} jadwal` : undefined,
      status: o.status,
      attachment: undefined,
      signature: o.signature,
      created_at: o.created_at,
      overtime_items: items,
      target_supervisor_id: o.user?.supervisor_id
    };
  });

const normalizeProfiles = (data: unknown): ApprovalItem[] =>
  (Array.isArray(data) ? data : ((data as { data?: RawProfileRequest[] })?.data || [])).map((p: RawProfileRequest) => ({
    id: p.id,
    type: "profile" as const,
    user_name: p.user?.name || "Karyawan",
    user_email: p.user?.email,
    user_role: p.user?.role?.name,
    description: p.new_data ? `Update data: ${Object.keys(p.new_data).join(", ")}` : "Permintaan Perubahan Profil",
    category: "Perubahan Profil",
    status: p.status,
    attachment: undefined,
    profile_new_data: p.new_data,
    created_at: p.created_at
  }));

const normalizePermits = (data: unknown): ApprovalItem[] =>
  (Array.isArray(data) ? data : ((data as { data?: RawPermit[] })?.data || [])).map((pe: RawPermit) => ({
    id: pe.id,
    type: "permit" as const,
    user_name: pe.user?.name || "Karyawan",
    user_email: pe.user?.email,
    user_role: pe.user?.role?.name,
    description: pe.reason || pe.type || "Pengajuan Izin",
    category: `[${pe.category || 'I'}] ${pe.type || 'Izin'}`,
    start_date: pe.start_date,
    end_date: pe.end_date,
    status: pe.status,
    attachment: extractStoragePath(pe.attachment),
    signature: pe.signature,
    created_at: pe.created_at,
    permit_category: pe.category || 'I',
    permit_has_doctor_note: pe.has_doctor_note || false,
    permit_is_deducted: pe.is_deducted || false,
    target_supervisor_id: pe.user?.supervisor_id
  }));

const normalizeDinasLuars = (data: unknown): ApprovalItem[] =>
  (Array.isArray(data) ? data : ((data as { data?: RawDinasLuar[] })?.data || [])).map((d: RawDinasLuar) => {
    let status = d.dinas_luar_status || 'pending';
    if (d.dinas_luar_status === 'approved_spv') {
      status = 'waiting_approval';
    }
    return {
      id: d.id,
      type: "dinas_luar" as const,
      user_name: d.user?.name || "Karyawan",
      user_email: d.user?.email,
      user_role: d.user?.role?.name,
      description: `Tujuan: ${d.dinas_luar_destination || '-'}. Keterangan: ${d.dinas_luar_notes || '-'}`,
      category: "Dinas Luar",
      start_date: d.check_in ? new Date(d.check_in).toLocaleString('id-ID') : (d.date || undefined),
      end_date: d.check_out ? new Date(d.check_out).toLocaleString('id-ID') : undefined,
      status,
      attachment: extractStoragePath(d.image_in_url || d.image_in),
      created_at: d.created_at,
      dinas_luar_status: d.dinas_luar_status,
      dinas_luar_destination: d.dinas_luar_destination,
      dinas_luar_notes: d.dinas_luar_notes,
      target_supervisor_id: d.user?.supervisor_id
    };
  });

const executeApprovalApi = async (
  item: ApprovalItem,
  action: ActionType,
  isHR: boolean,
  payload: Record<string, unknown>
): Promise<void> => {
  if (item.type === 'dinas_luar') {
    let actionSuffix = 'reject';
    if (action === 'approve') {
      actionSuffix = (isHR && item.status === 'waiting_approval') ? 'approve-hr' : 'approve-spv';
    }
    await axiosInstance.post(`/attendance/dinas-luar/${item.id}/${actionSuffix}`, payload);
  } else {
    const endpoint = getApprovalEndpoint(item.type);
    await axiosInstance.post(`${endpoint}/${item.id}/${action}`, payload);
  }
};

export default function ApprovalsPage() {
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [actionModal, setActionModal] = useState<{isOpen: boolean; action: ActionType | null; item: ApprovalItem | null}>({isOpen: false, action: null, item: null});
  const [remarkInput, setRemarkInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // HRD override state for permit approvals
  const [permitOverrideCategory, setPermitOverrideCategory] = useState<string>('I');
  const [permitOverrideDoctorNote, setPermitOverrideDoctorNote] = useState(false);

  const getStorageUrl = (path: string) => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";
    return `${backendUrl}/storage/${path}`;
  };

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const [leaveRes, reimRes, profileRes, overtimeRes, permitRes, dinasRes, fundRes] = await Promise.all([
        axiosInstance.get("/leave?status=pending").catch(() => ({ data: { data: [] } })),
        axiosInstance.get("/reimbursements?status=pending").catch(() => ({ data: { data: [] } })),
        axiosInstance.get("/profile-requests?status=pending").catch(() => ({ data: { data: [] } })),
        axiosInstance.get("/overtimes?status=pending").catch(() => ({ data: { data: [] } })),
        axiosInstance.get("/permits?status=pending").catch(() => ({ data: { data: [] } })),
        axiosInstance.get("/attendance/dinas-luar/pending").catch(() => ({ data: { data: [] } })),
        axiosInstance.get("/fund-requests?status=pending").catch(() => ({ data: { data: [] } }))
      ]);

      const allApprovals = [
        ...normalizeLeaves(leaveRes.data.data),
        ...normalizeReimbursements(reimRes.data.data),
        ...normalizeFundRequests(fundRes.data.data),
        ...normalizeOvertimes(overtimeRes.data.data),
        ...normalizeProfiles(profileRes.data.data),
        ...normalizePermits(permitRes.data.data),
        ...normalizeDinasLuars(dinasRes.data.data),
      ];

      const roleName = currentUser?.role?.name?.toLowerCase() || "";
      const isHR = currentUser?.role_id === 1 || 
                   roleName.includes("hr") || 
                   roleName.includes("admin") ||
                   roleName.includes("vp") ||
                   roleName.includes("direktur") ||
                   roleName.includes("ceo");

      const currentUserId = currentUser?.id ? Number(currentUser.id) : null;
      const merged = allApprovals
        .filter(item => shouldIncludeApprovalItem(item, currentUserId, isHR))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(merged);
    } catch (e) {
      console.error("Gagal ambil data pengajuan", e);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const handleActionClick = (item: ApprovalItem, action: ActionType) => {
    setActionModal({ isOpen: true, action, item });
    setRemarkInput("");
    if (item.type === 'permit') {
      setPermitOverrideCategory(item.permit_category || 'I');
      setPermitOverrideDoctorNote(item.permit_has_doctor_note || false);
    }
  };

  const executeAction = async () => {
    const { action, item } = actionModal;
    if (!action || !item || isSubmitting) return;

    if (action === 'reject' && !remarkInput.trim() && (item.type === 'reimbursement' || item.type === 'overtime')) {
        toast.warning("Alasan penolakan WAJIB diisi!");
        return;
    }
    
    setIsSubmitting(true);
    setProcessingId(`${item.type}-${item.id}`);
    
    try {
      const payload: Record<string, unknown> = { remark: remarkInput };
      if (item.type === 'dinas_luar' && action === 'reject') {
        payload.reason = remarkInput;
      } else if (item.type === 'permit' && action === 'approve') {
        payload.category = permitOverrideCategory;
        payload.has_doctor_note = permitOverrideDoctorNote;
      }
      
      const roleName = currentUser?.role?.name?.toLowerCase() || "";
      const isHR = currentUser?.role_id === 1 || 
                   roleName.includes("hr") || 
                   roleName.includes("admin") ||
                   roleName.includes("vp") ||
                   roleName.includes("direktur") ||
                   roleName.includes("ceo");

      await executeApprovalApi(item, action, isHR, payload);
      
      try {
          const audio = new window.Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.8;
          audio.play().catch(err => console.log(err));
      } catch {}

      toast.success(`Berhasil ${action === 'approve' ? 'menyetujui' : 'menolak'} pengajuan.`);
      setActionModal({ isOpen: false, action: null, item: null });
      if (selectedItem?.id === item.id && selectedItem?.type === item.type) {
        setIsDetailModalOpen(false);
      }
      await fetchApprovals();
    } catch (error) {
      console.error("Error processing approval:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error("Gagal memproses pengajuan: " + (err.response?.data?.message || "Terjadi kesalahan server"));
    } finally {
      setIsSubmitting(false);
      setProcessingId(null);
    }
  };

  const handleViewDetail = (item: ApprovalItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const filteredItems = items.filter(item => filter === 'all' || item.type === filter);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  if (loading && items.length === 0) {
    return <ListPageSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Persetujuan Pending</h1>
          <p className="dash-page-desc">Review dan proses pengajuan karyawan yang memerlukan persetujuan Anda.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-sm border border-gray-150/50 flex-wrap gap-1">
          <button onClick={() => setFilter("all")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'all' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Semua</button>
          <button onClick={() => setFilter("leave")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'leave' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Cuti</button>
          <button onClick={() => setFilter("reimbursement")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'reimbursement' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Klaim</button>
          <button onClick={() => setFilter("overtime")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'overtime' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Lembur</button>
          <button onClick={() => setFilter("permit")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'permit' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Izin</button>
          <button onClick={() => setFilter("profile")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'profile' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Profil</button>
          <button onClick={() => setFilter("dinas_luar")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'dinas_luar' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Dinas Luar</button>
        </div>
      </div>

      {/* Table */}
      <div className="dash-table-container">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <p className="text-xs text-gray-500 font-medium">
            Menampilkan <span className="font-bold text-gray-900">{paginatedItems.length}</span> dari <span className="font-bold text-gray-900">{filteredItems.length}</span> pengajuan yang memerlukan tindakan
          </p>
        </div>
        <div className="dash-table-wrapper">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Tipe</th>
                <th>Kategori</th>
                <th>Tanggal / Nominal</th>
                <th>Keterangan</th>
                <th>Diajukan</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center">
                        <CheckCircle size={24} />
                      </div>
                      <h3 className="text-base font-bold text-gray-900">Semua Beres!</h3>
                      <p className="text-sm text-gray-500">Tidak ada pengajuan yang memerlukan tindakan saat ini.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(item => {
                  const isProcessing = processingId === `${item.type}-${item.id}`;
                  return (
                    <tr key={`${item.type}-${item.id}`} className="group">
                      {/* Karyawan */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-50 text-[#8B0000] border border-red-100 flex items-center justify-center text-xs font-black shrink-0">
                            {item.user_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900 block leading-tight">{item.user_name}</span>
                            {item.user_role && (
                              <span className="text-[11px] text-gray-400 block">{item.user_role}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tipe */}
                      <td>
                        <Badge variant="outline" className={`text-xs font-semibold ${typeColor[item.type]}`}>
                          {typeLabel[item.type] || item.type}
                        </Badge>
                      </td>

                      {/* Kategori */}
                      <td>
                        <span className="text-sm text-gray-700 font-medium">{item.category}</span>
                      </td>

                      {/* Tanggal / Nominal */}
                      <td>
                        <div className="space-y-1">
                          {item.start_date && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                              <Clock size={13} className="text-gray-400 shrink-0" />
                              <span>{item.start_date} {item.end_date ? `s/d ${item.end_date}` : ''}</span>
                            </div>
                          )}
                          {item.amount && (
                            <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                              IDR {Number.parseInt(item.amount, 10).toLocaleString('id-ID')}
                            </div>
                          )}
                          {!item.start_date && !item.amount && (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>

                      {/* Keterangan */}
                      <td className="max-w-[220px]">
                        <p className="text-sm text-gray-700 truncate font-normal" title={item.description || 'Tanpa keterangan'}>
                          {item.description || <span className="text-gray-400 italic">Tanpa keterangan</span>}
                        </p>
                        {item.attachment && (
                          <button
                            onClick={() => handleViewDetail(item)}
                            className="flex items-center gap-1 text-xs text-[#8B0000] font-semibold hover:underline mt-0.5"
                          >
                            <ExternalLink size={12} /> Lihat Lampiran
                          </button>
                        )}
                      </td>

                      {/* Diajukan */}
                      <td>
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Button View Detail */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetail(item)}
                            className="text-gray-700 border-gray-200 hover:bg-gray-100 hover:text-gray-900 h-8 px-2.5 text-xs font-semibold shadow-xs"
                            title="Lihat Detail Pengajuan"
                          >
                            <Eye size={14} className="mr-1 text-gray-500" />
                            Detail
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleActionClick(item, 'reject')}
                            disabled={isProcessing}
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-8 px-2.5 text-xs font-bold"
                          >
                            <XCircle size={14} className="mr-1" />
                            {isProcessing ? "..." : "Tolak"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleActionClick(item, 'approve')}
                            disabled={isProcessing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-2.5 text-xs font-bold shadow-xs"
                          >
                            <CheckCircle size={14} className="mr-1" />
                            {isProcessing ? "..." : "Setujui"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredItems.length > itemsPerPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
            <p className="text-sm text-muted-foreground">
              Halaman {currentPage} dari {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-3 text-xs"
              >
                <ChevronLeft size={14} className="mr-1" /> Sebelumnya
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, currentPage - 3),
                  Math.min(totalPages, currentPage + 2)
                ).map(page => (
                  <button
                    key={`page-${page}`}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-xs font-medium rounded-lg transition ${
                      page === currentPage
                        ? 'bg-[#8B0000] text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-3 text-xs"
              >
                Selanjutnya <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-100/70 text-[#8B0000] rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">Detail Pengajuan</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-[11px] font-semibold ${typeColor[selectedItem.type]}`}>
                      {typeLabel[selectedItem.type] || selectedItem.type}
                    </Badge>
                    <span className="text-xs text-gray-500 font-medium">ID #{selectedItem.id}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 hover:bg-gray-200/60 rounded-full transition-colors text-gray-400 hover:text-gray-700"
              >
                <XCircle size={22} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Requester Information */}
              <div className="flex items-center gap-4 p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                <div className="w-12 h-12 rounded-full bg-red-100 text-[#8B0000] border border-red-200 flex items-center justify-center text-lg font-black shrink-0">
                  {selectedItem.user_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-gray-900 leading-snug truncate">{selectedItem.user_name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                    {selectedItem.user_role && <span className="font-medium text-gray-700">{selectedItem.user_role}</span>}
                    {selectedItem.user_role && selectedItem.user_email && <span>•</span>}
                    {selectedItem.user_email && <span className="truncate">{selectedItem.user_email}</span>}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                    <Calendar size={12} />
                    Diajukan pada: {new Date(selectedItem.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>

              {/* Core Attributes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl">
                  <p className="text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">KATEGORI</p>
                  <p className="text-sm font-bold text-gray-800">{selectedItem.category}</p>
                </div>
                {selectedItem.amount ? (
                  <div className="p-3.5 border border-emerald-100 bg-emerald-50/40 rounded-2xl">
                    <p className="text-[10px] uppercase font-black tracking-wider text-emerald-600/80 mb-1">NOMINAL PENGAJUAN</p>
                    <p className="text-base font-black text-emerald-700">IDR {Number.parseInt(selectedItem.amount, 10).toLocaleString('id-ID')}</p>
                  </div>
                ) : (
                  <div className="p-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl">
                    <p className="text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">STATUS</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock size={12} /> Menunggu Persetujuan
                    </span>
                  </div>
                )}
              </div>

              {/* Specific Details Section */}
              {/* Overtime Breakdown */}
              {selectedItem.type === 'overtime' && (
                <div className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                    <Clock size={14} className="text-[#8B0000]" />
                    Rincian Jadwal Lembur
                  </p>
                  {selectedItem.overtime_items && selectedItem.overtime_items.length > 0 ? (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 bg-white shadow-xs">
                      {selectedItem.overtime_items.map((otItem) => {
                        const otKey = `ot-${otItem.id ?? `${otItem.date}-${otItem.start_time}-${otItem.end_time}`}`;
                        return (
                          <div key={otKey} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">{otItem.date || selectedItem.start_date || '-'}</span>
                                <span className="bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded border border-amber-200">
                                  {otItem.start_time || '-'} s/d {otItem.end_time || '-'}
                                </span>
                              </div>
                              <p className="text-gray-600 mt-1 italic">&ldquo;{otItem.reason || 'Tanpa keterangan tugas'}&rdquo;</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs space-y-1">
                      <p className="text-gray-500 font-medium">Jadwal: <span className="text-gray-900 font-bold">{selectedItem.start_date} {selectedItem.end_date ? `s/d ${selectedItem.end_date}` : ''}</span></p>
                      <p className="text-gray-600 italic mt-1">&ldquo;{selectedItem.description}&rdquo;</p>
                    </div>
                  )}
                </div>
              )}

              {/* Leave Details */}
              {selectedItem.type === 'leave' && (
                <div className="space-y-2 bg-blue-50/40 border border-blue-100 p-4 rounded-2xl text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-100/60">
                    <span className="text-gray-500 font-medium">Periode Cuti:</span>
                    <span className="font-bold text-gray-900">{selectedItem.start_date} s/d {selectedItem.end_date}</span>
                  </div>
                  {selectedItem.leave_address && (
                    <div className="flex items-start gap-2 pt-1">
                      <MapPin size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-gray-500 font-medium">Alamat Selama Cuti:</span>
                        <p className="text-gray-800 font-semibold">{selectedItem.leave_address}</p>
                      </div>
                    </div>
                  )}
                  {selectedItem.emergency_phone && (
                    <div className="flex items-center gap-2 pt-1">
                      <Phone size={14} className="text-blue-600 shrink-0" />
                      <span className="text-gray-500 font-medium">Kontak Darurat:</span>
                      <span className="font-bold text-gray-800">{selectedItem.emergency_phone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Permit Details */}
              {selectedItem.type === 'permit' && (
                <div className="space-y-2 bg-purple-50/40 border border-purple-100 p-4 rounded-2xl text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-purple-100/60">
                    <span className="text-gray-500 font-medium">Periode Izin:</span>
                    <span className="font-bold text-gray-900">{selectedItem.start_date} {selectedItem.end_date ? `s/d ${selectedItem.end_date}` : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-gray-500 font-medium block">Surat Dokter:</span>
                      <span className={`font-bold ${selectedItem.permit_has_doctor_note ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {selectedItem.permit_has_doctor_note ? '✓ Ada Surat Dokter' : '✗ Tanpa Surat Dokter'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium block">Potong Gaji:</span>
                      <span className={`font-bold ${selectedItem.permit_is_deducted ? 'text-red-700' : 'text-emerald-700'}`}>
                        {selectedItem.permit_is_deducted ? 'Ya (Dipotong)' : 'Tidak Dipotong'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reimbursement Details */}
              {selectedItem.type === 'reimbursement' && (
                <div className="space-y-2.5">
                  {(selectedItem.reimbursement_divisi || selectedItem.reimbursement_tujuan) && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs">
                      {selectedItem.reimbursement_divisi && (
                        <div>
                          <span className="text-gray-400 font-bold uppercase block text-[10px]">Divisi</span>
                          <span className="font-semibold text-gray-800">{selectedItem.reimbursement_divisi}</span>
                        </div>
                      )}
                      {selectedItem.reimbursement_tujuan && (
                        <div>
                          <span className="text-gray-400 font-bold uppercase block text-[10px]">Tujuan / Keperluan</span>
                          <span className="font-semibold text-gray-800">{selectedItem.reimbursement_tujuan}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedItem.reimbursement_items && selectedItem.reimbursement_items.length > 0 && (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 bg-white">
                      <div className="p-2.5 bg-gray-50 text-[11px] font-bold text-gray-600 uppercase tracking-wider flex justify-between">
                        <span>Item Pengeluaran</span>
                        <span>Nominal</span>
                      </div>
                      {selectedItem.reimbursement_items.map((rItem) => {
                        const rKey = `r-${rItem.id ?? `${rItem.item_name}-${rItem.amount}-${rItem.description}`}`;
                        return (
                          <div key={rKey} className="p-3 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-gray-900">{rItem.item_name || 'Item Reimbursement'}</p>
                              {rItem.description && <p className="text-gray-500 text-[11px]">{rItem.description}</p>}
                            </div>
                            {rItem.amount && (
                              <span className="font-bold text-emerald-700">
                                IDR {Number.parseInt(String(rItem.amount), 10).toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Dinas Luar Details */}
              {selectedItem.type === 'dinas_luar' && (
                <div className="space-y-2 bg-rose-50/40 border border-rose-100 p-4 rounded-2xl text-xs">
                  {selectedItem.dinas_luar_destination && (
                    <div className="flex items-start gap-2 pb-2 border-b border-rose-100/60">
                      <Building2 size={14} className="text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-gray-500 font-medium">Lokasi / Instansi Tujuan:</span>
                        <p className="text-gray-900 font-bold">{selectedItem.dinas_luar_destination}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-gray-500 font-medium">Waktu Check-in:</span>
                    <span className="font-bold text-gray-900">{selectedItem.start_date || '-'}</span>
                  </div>
                  {selectedItem.end_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Waktu Check-out:</span>
                      <span className="font-bold text-gray-900">{selectedItem.end_date}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Profile Change Details */}
              {selectedItem.type === 'profile' && selectedItem.profile_new_data && (
                <div className="space-y-2 border border-orange-200 bg-orange-50/40 p-4 rounded-2xl text-xs">
                  <p className="font-bold text-orange-800 uppercase tracking-wider text-[11px]">Perubahan Data yang Diajukan:</p>
                  <div className="bg-white rounded-xl border border-orange-100 p-3 divide-y divide-gray-100 space-y-1.5">
                    {Object.entries(selectedItem.profile_new_data).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center pt-1.5 first:pt-0">
                        <span className="text-gray-500 capitalize">{key.replaceAll('_', ' ')}</span>
                        <span className="font-bold text-gray-900">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description / Reason Box */}
              <div>
                <p className="text-[10px] uppercase font-black text-gray-400 mb-1.5 px-1">KETERANGAN / ALASAN LENGKAP</p>
                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-100 text-sm text-gray-700 leading-relaxed italic">
                  &ldquo;{selectedItem.description || 'Tidak ada keterangan tambahan'}&rdquo;
                </div>
              </div>

              {/* Attachments (Bukti) */}
              {selectedItem.attachment && (
                <div>
                  <p className="text-[10px] uppercase font-black text-gray-400 mb-1.5 px-1">BUKTI PENDUKUNG (ATTACHMENT)</p>
                  <div className="rounded-2xl border border-gray-100 overflow-hidden bg-gray-100 group relative">
                    <img 
                      src={getStorageUrl(selectedItem.attachment)} 
                      alt="Bukti Pengajuan" 
                      className="w-full h-auto max-h-[280px] object-contain mx-auto bg-gray-50"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Bukti+Lampiran';
                      }}
                    />
                    <a 
                      href={getStorageUrl(selectedItem.attachment)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-sm backdrop-blur-xs"
                    >
                      <ExternalLink size={18} className="mr-2" /> Buka Ukuran Penuh
                    </a>
                  </div>
                </div>
              )}

              {/* Digital Signature */}
              {selectedItem.signature && (
                <div>
                  <p className="text-[10px] uppercase font-black text-gray-400 mb-1.5 px-1">TANDA TANGAN DIGITAL</p>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl max-w-[200px]">
                    <img 
                      src={selectedItem.signature.startsWith('data:') ? selectedItem.signature : getStorageUrl(selectedItem.signature)} 
                      alt="Tanda Tangan" 
                      className="w-full h-auto max-h-[80px] object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between gap-3">
              <Button 
                variant="outline"
                onClick={() => setIsDetailModalOpen(false)}
                className="py-2.5 px-4 text-xs font-semibold text-gray-600 border-gray-200 hover:bg-gray-100 rounded-xl"
              >
                Tutup
              </Button>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleActionClick(selectedItem, 'reject');
                  }}
                  className="py-2.5 px-4 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 rounded-xl"
                >
                  <XCircle size={14} className="mr-1.5" /> Tolak
                </Button>
                <Button 
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleActionClick(selectedItem, 'approve');
                  }}
                  className="py-2.5 px-5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/10"
                >
                  <CheckCircle size={14} className="mr-1.5" /> Setujui Sekarang
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action (Approve / Reject) Modal */}
      {actionModal.isOpen && actionModal.item && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className={`font-bold text-lg ${actionModal.action === 'approve' ? 'text-emerald-700' : 'text-red-700'}`}>
                {actionModal.action === 'approve' ? 'Setujui Pengajuan' : 'Tolak Pengajuan'}
              </h3>
              <button 
                onClick={() => setActionModal({ isOpen: false, action: null, item: null })}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6">
              {actionModal.item.attachment && (
                <div className="mb-4 rounded-xl border overflow-hidden bg-gray-50">
                  <p className="text-[10px] font-black text-gray-400 bg-gray-100/50 px-3 py-1 border-b">BUKTI LAMPIRAN</p>
                  <img 
                    src={getStorageUrl(actionModal.item.attachment)} 
                    alt="Receipt" 
                    className="w-full h-auto max-h-[250px] object-contain mx-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Bukti+Gagal+Dimuat';
                    }}
                  />
                </div>
              )}
              <p className="text-sm text-gray-600 mb-4">
                Tuliskan {actionModal.action === 'approve' ? 'catatan (opsional)' : 'alasan penolakan (WAJIB)'} untuk pengajuan ini.
              </p>
              <textarea
                className="w-full border border-gray-200 bg-gray-50 rounded-xl p-4 text-sm outline-none focus:border-[#8B0000] focus:ring-4 focus:ring-[#8B0000]/5 min-h-[100px] transition-all"
                placeholder={actionModal.action === 'approve' ? 'Tulis catatan...' : 'Tulis alasan penolakan...'}
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                autoFocus
              />

              {/* HRD Override for Permit Approvals */}
              {actionModal.item.type === 'permit' && actionModal.action === 'approve' && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-purple-600" />
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Override Kategori Izin (HRD)</p>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="permit-override-category-select" className="text-xs font-semibold text-gray-600">Kategori</label>
                    <select 
                      id="permit-override-category-select"
                      className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white focus:ring-1 focus:ring-purple-400"
                      value={permitOverrideCategory}
                      onChange={(e) => setPermitOverrideCategory(e.target.value)}
                    >
                      <option value="I">[I] Izin — Tidak Potong</option>
                      <option value="A">[A] Alpha/Mangkir — Potong</option>
                      <option value="S">[S] Sakit</option>
                      <option value="L">[L] Lainnya — Tidak Potong</option>
                    </select>
                  </div>
                  {permitOverrideCategory === 'S' && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                      <input 
                        type="checkbox" 
                        id="doctor-note-toggle"
                        checked={permitOverrideDoctorNote}
                        onChange={(e) => setPermitOverrideDoctorNote(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <label htmlFor="doctor-note-toggle" className="text-sm text-gray-700 cursor-pointer">
                        <span className="font-semibold">Dengan Surat Dokter</span>
                        <span className="block text-[11px] text-gray-400">
                          {permitOverrideDoctorNote 
                            ? '✓ Tidak dipotong gaji' 
                            : '✗ Akan dipotong gaji (default)'}
                        </span>
                      </label>
                    </div>
                  )}
                  {permitOverrideCategory === 'A' && (
                    <p className="text-[11px] text-red-500 font-medium">⚠️ Alpha selalu dipotong gaji.</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setActionModal({ isOpen: false, action: null, item: null })}
                disabled={isSubmitting}
                className="flex-1 py-3 text-sm font-bold text-gray-500 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={executeAction}
                disabled={isSubmitting}
                className={`flex-1 py-3 text-sm font-bold text-white rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50 ${actionModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/10' : 'bg-red-600 hover:bg-red-700 shadow-red-900/10'}`}
              >
                {isSubmitting ? "Memproses..." : "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
