"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Eye,
  FileText,
  Users,
  ShieldCheck,
  Search,
  RefreshCw,
  Car,
  CreditCard,
  Wallet,
  CalendarCheck,
  ClipboardList,
  AlertCircle,
  MapPin,
  Building2
} from "lucide-react";
import { ListPageSkeleton } from "@/components/Skeleton";
import { useAuth, isSuperAdminUser } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import OfficialApprovalDocumentSheet from "@/components/OfficialApprovalDocumentSheet";
import Link from "next/link";

type ApprovalType = 
  | "leave" 
  | "reimbursement" 
  | "overtime" 
  | "permit" 
  | "dinas_luar" 
  | "fund_request"
  | "vehicle_log";

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
  // Vehicle Log-specific
  vehicle_name?: string;
  plate_number?: string;
  odometer_start?: number;
  odometer_end?: number;
  distance?: number;
  purpose?: string;
  destination?: string;
  // Dynamic approval workflow
  current_approval_step?: number | null;
  current_step_info?: Record<string, any>;
}

interface TeamMemberAttendance {
  id: number;
  name: string;
  role: string;
  photo_url?: string;
  status: string;
  check_in?: string | null;
  check_out?: string | null;
  attendance_type?: string;
  is_dinas_luar?: boolean;
  dinas_luar_destination?: string | null;
  dinas_luar_status?: string | null;
  location_label?: string | null;
}

const typeLabel: Record<ApprovalType, string> = {
  leave: "Cuti",
  reimbursement: "Klaim Biaya",
  overtime: "Lembur",
  permit: "Izin",
  dinas_luar: "Dinas Luar",
  fund_request: "Pengajuan Dana",
  vehicle_log: "Log Armada",
};

const typeColor: Record<ApprovalType, string> = {
  leave: "bg-blue-50 text-blue-700 border-blue-200",
  reimbursement: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overtime: "bg-amber-50 text-amber-700 border-amber-200",
  permit: "bg-purple-50 text-purple-700 border-purple-200",
  dinas_luar: "bg-rose-50 text-rose-700 border-rose-200",
  fund_request: "bg-teal-50 text-teal-700 border-teal-200",
  vehicle_log: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const extractStoragePath = (url?: string): string | undefined => {
  if (!url) return undefined;
  const idx = url.indexOf('/storage/');
  if (idx >= 0) {
    return url.substring(idx + 9);
  }
  return url;
};

const normalizeLeaves = (rawLeaves: any[]): ApprovalItem[] =>
  rawLeaves.map((l: any) => ({
    id: l.id,
    type: "leave",
    user_name: l.user?.name || "Karyawan",
    user_email: l.user?.email,
    user_role: l.user?.role?.name || l.user?.role,
    description: l.reason || l.type || "Pengajuan Cuti",
    category: l.type || "Cuti Tahunan",
    start_date: l.start_date,
    end_date: l.end_date,
    status: l.status,
    current_approval_step: l.current_approval_step || null,
    current_step_info: l.current_step_info,
    signature: l.signature,
    leave_address: l.leave_address,
    emergency_phone: l.emergency_phone,
    created_at: l.created_at,
    target_supervisor_id: l.user?.supervisor_id
  }));

const normalizeReims = (rawReims: any[]): ApprovalItem[] =>
  rawReims.map((r: any) => ({
    id: r.id,
    type: "reimbursement",
    user_name: r.employee_name || r.user?.name || "Karyawan",
    user_email: r.user?.email,
    user_role: r.user?.role?.name || r.user?.role,
    description: r.description || r.title || "Pengajuan Klaim Biaya",
    category: r.title || "Reimbursement",
    amount: r.amount ? String(r.amount) : undefined,
    status: r.status,
    current_approval_step: r.current_approval_step || null,
    current_step_info: r.current_step_info,
    attachment: extractStoragePath(typeof r.attachment === "string" ? r.attachment : r.attachment?.[0]),
    signature: r.signature,
    reimbursement_items: Array.isArray(r.items) ? r.items : [],
    reimbursement_divisi: r.divisi,
    reimbursement_tujuan: r.tujuan,
    created_at: r.created_at,
    target_supervisor_id: r.user?.supervisor_id
  }));

const normalizeOvertimes = (rawOvertimes: any[]): ApprovalItem[] =>
  rawOvertimes.map((o: any) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const first = items[0];
    const dateVal = o.date || first?.date;
    const startVal = o.start_time || first?.start_time;
    const endVal = o.end_time || first?.end_time;
    const reasonVal = o.reason || first?.reason || o.title || "Pengajuan Lembur";
    const formattedDate = dateVal && startVal && endVal ? `${dateVal} (${startVal} - ${endVal})` : (dateVal || "");

    return {
      id: o.id,
      type: "overtime",
      user_name: o.user?.name || "Karyawan",
      user_email: o.user?.email,
      user_role: o.user?.role?.name || o.user?.role,
      description: reasonVal,
      category: o.title ? `Lembur: ${o.title}` : "Lembur",
      start_date: formattedDate,
      end_date: items.length > 1 ? `+${items.length - 1} jadwal tambahan` : undefined,
      status: o.status,
      current_approval_step: o.current_approval_step || null,
      current_step_info: o.current_step_info,
      signature: o.signature,
      created_at: o.created_at,
      overtime_items: items,
      target_supervisor_id: o.user?.supervisor_id
    };
  });

const normalizePermits = (rawPermits: any[]): ApprovalItem[] =>
  rawPermits.map((pe: any) => ({
    id: pe.id,
    type: "permit",
    user_name: pe.user?.name || "Karyawan",
    user_email: pe.user?.email,
    user_role: pe.user?.role?.name || pe.user?.role,
    description: pe.reason || pe.type || "Pengajuan Izin",
    category: `[${pe.category || "I"}] ${pe.type || "Izin"}`,
    start_date: pe.start_date,
    end_date: pe.end_date,
    status: pe.status,
    current_approval_step: pe.current_approval_step || null,
    current_step_info: pe.current_step_info,
    attachment: extractStoragePath(pe.attachment),
    signature: pe.signature,
    created_at: pe.created_at,
    permit_category: pe.category || "I",
    permit_has_doctor_note: pe.has_doctor_note || false,
    permit_is_deducted: pe.is_deducted || false,
    target_supervisor_id: pe.user?.supervisor_id
  }));

const normalizeFunds = (rawFunds: any[]): ApprovalItem[] =>
  rawFunds.map((f: any) => ({
    id: f.id,
    type: "fund_request",
    user_name: f.employee_name || f.user?.name || "Karyawan",
    user_email: f.user?.email,
    user_role: f.user?.role?.name || f.user?.role,
    description: f.title || f.reason || "Pengajuan Kasbon/Dana",
    category: "Pengajuan Dana",
    amount: f.amount ? String(f.amount) : undefined,
    status: f.status,
    current_approval_step: f.current_approval_step || null,
    current_step_info: f.current_step_info,
    attachment: extractStoragePath(f.attachment),
    signature: f.signature,
    created_at: f.created_at,
    target_supervisor_id: f.user?.supervisor_id
  }));

const normalizeVehicles = (rawVehicles: any[]): ApprovalItem[] =>
  rawVehicles.map((v: any) => ({
    id: v.id,
    type: "vehicle_log",
    user_name: v.user?.name || "Karyawan",
    user_email: v.user?.email,
    user_role: v.user?.role?.name || v.user?.role,
    description: `Tujuan: ${v.destination || '-'}. Keperluan: ${v.purpose || '-'}`,
    category: `Armada: ${v.vehicle_name || 'Kendaraan'} (${v.plate_number || '-'})`,
    amount: v.total_cost ? String(v.total_cost) : undefined,
    start_date: v.departure_date ? `${v.departure_date} ${v.departure_time || ''}` : undefined,
    end_date: v.return_date ? `${v.return_date} ${v.return_time || ''}` : undefined,
    status: v.status,
    current_approval_step: v.current_approval_step || null,
    created_at: v.created_at,
    vehicle_name: v.vehicle_name,
    plate_number: v.plate_number,
    odometer_start: v.odometer_start,
    odometer_end: v.odometer_end,
    distance: v.distance,
    purpose: v.purpose,
    destination: v.destination,
    target_supervisor_id: v.user?.supervisor_id
  }));

const normalizeDinas = (rawDinas: any[]): ApprovalItem[] =>
  rawDinas.map((d: any) => ({
    id: d.id,
    type: "dinas_luar",
    user_name: d.user?.name || "Karyawan",
    user_email: d.user?.email,
    user_role: d.user?.role?.name || d.user?.role,
    description: `Tujuan: ${d.dinas_luar_destination || '-'}. Catatan: ${d.dinas_luar_notes || '-'}`,
    category: "Dinas Luar",
    start_date: d.check_in ? new Date(d.check_in).toLocaleString('id-ID') : (d.date || undefined),
    end_date: d.check_out ? new Date(d.check_out).toLocaleString('id-ID') : undefined,
    status: d.dinas_luar_status || "pending",
    attachment: extractStoragePath(d.image_in_url || d.image_in),
    created_at: d.created_at,
    dinas_luar_destination: d.dinas_luar_destination,
    dinas_luar_notes: d.dinas_luar_notes,
    target_supervisor_id: d.user?.supervisor_id
  }));

const dispatchApprovalRequest = async (
  item: ApprovalItem,
  action: ActionType,
  remarkInput: string,
  permitOverrideCategory: string,
  permitOverrideDoctorNote: boolean,
  isHR: boolean
) => {
  if (item.type === "dinas_luar") {
    let actionSuffix = "reject";
    if (action === "approve") {
      actionSuffix = (isHR && item.status === "waiting_approval") ? "approve-hr" : "approve-spv";
    }
    return axiosInstance.post(`/attendance/dinas-luar/${item.id}/${actionSuffix}`, { reason: remarkInput });
  }
  const payload: Record<string, any> = { 
    remark: remarkInput,
    type: item.type,
    id: item.id,
    status: action === "approve" ? "approved" : "rejected"
  };
  if (item.type === "permit" && action === "approve") {
    payload.category = permitOverrideCategory;
    payload.has_doctor_note = permitOverrideDoctorNote;
  }
  return axiosInstance.post("/manager/update-status", payload);
};

const renderMemberStatusBadge = (member: TeamMemberAttendance) => {
  const isDinasLuar = member.is_dinas_luar || member.attendance_type === "dinas_luar";

  if (member.status === "Belum Masuk") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        <span>Belum Masuk</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {/* Location Badge */}
      {isDinasLuar ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
          <MapPin size={10} className="text-rose-600 shrink-0" />
          <span>Dinas Luar</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
          <Building2 size={10} className="text-slate-500 shrink-0" />
          <span>Di Kantor</span>
        </span>
      )}

      {/* Main Status Badge */}
      {member.status === "Hadir" ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Hadir</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <CheckCircle2 size={10} />
          <span>Selesai</span>
        </span>
      )}
    </div>
  );
};

export default function ApprovalsPage() {
  const { user: currentUser, hasPermission } = useAuth();
  
  // Tabs: 'approvals' (Persetujuan) vs 'team' (Kehadiran Tim)
  const [activeTab, setActiveTab] = useState<"approvals" | "team">("approvals");

  const isSuperAdmin = isSuperAdminUser(currentUser);
  const hasManageApprovals = hasPermission("manage-approvals");

  const canApprove = useCallback((type: ApprovalType): boolean => {
    if (isSuperAdmin || hasManageApprovals) return true;
    switch (type) {
      case "leave":
        return hasPermission("approve-leaves");
      case "permit":
        return hasPermission("approve-permits");
      case "reimbursement":
        return hasPermission("approve-reimbursements");
      case "overtime":
        return hasPermission("approve-overtimes");
      case "fund_request":
        return hasPermission("approve-fund-requests");
      case "vehicle_log":
        return hasPermission("approve-vehicle-logs");
      case "dinas_luar":
        return hasPermission("approve-leaves") || hasPermission("view-attendances");
      default:
        return false;
    }
  }, [isSuperAdmin, hasManageApprovals, hasPermission]);

  const hasAnyApprovalPermission =
    isSuperAdmin ||
    hasManageApprovals ||
    canApprove("leave") ||
    canApprove("permit") ||
    canApprove("overtime") ||
    canApprove("reimbursement") ||
    canApprove("fund_request") ||
    canApprove("vehicle_log") ||
    canApprove("dinas_luar");

  // Approval state
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [pendingCounts, setPendingCounts] = useState<{
    leave: number;
    overtime: number;
    reimbursement: number;
    permit: number;
    fund_request: number;
    vehicle_log: number;
    total: number;
  }>({
    leave: 0,
    overtime: 0,
    reimbursement: 0,
    permit: 0,
    fund_request: 0,
    vehicle_log: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Team attendance state
  const [teamMembers, setTeamMembers] = useState<TeamMemberAttendance[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState("");

  // Modals state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: ActionType | null;
    item: ApprovalItem | null;
  }>({ isOpen: false, action: null, item: null });
  const [remarkInput, setRemarkInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // HRD override state for permit approvals
  const [permitOverrideCategory, setPermitOverrideCategory] = useState<string>("I");
  const [permitOverrideDoctorNote, setPermitOverrideDoctorNote] = useState(false);

  const getStorageUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      return path;
    }
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";
    return `${backendUrl}/storage/${path.replace(/^\/+/, '')}`;
  };

  // 1. Fetch Manager Pending Counts
  const fetchCounts = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/manager/pending-count");
      if (res.data?.data) {
        setPendingCounts(res.data.data);
      }
    } catch (e) {
      console.warn("Could not fetch manager pending count:", e);
    }
  }, []);

  // 2. Fetch Team Attendance
  const fetchTeamAttendance = useCallback(async () => {
    try {
      setLoadingTeam(true);
      const res = await axiosInstance.get("/manager/team-attendance");
      if (res.data?.data && Array.isArray(res.data.data)) {
        setTeamMembers(res.data.data);
      }
    } catch (e) {
      console.warn("Could not fetch team attendance:", e);
    } finally {
      setLoadingTeam(false);
    }
  }, []);

const fetchCategoryData = async (allowed: boolean, url: string): Promise<any[]> => {
  if (!allowed) return [];
  try {
    const res = await axiosInstance.get(url);
    const data = res.data?.data;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

  // 3. Fetch All Pending Approvals (filtered dynamically by allowed categories)
  const fetchApprovals = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setRefreshing(true);

      // Fetch from manager endpoints and specialized routes conditionally based on permissions
      const [
        leaveData,
        reimData,
        overtimeData,
        permitData,
        fundData,
        vehicleData,
        dinasData
      ] = await Promise.all([
        fetchCategoryData(canApprove("leave"), "/manager/pending-requests?type=leave"),
        fetchCategoryData(canApprove("reimbursement"), "/manager/pending-requests?type=reimbursement"),
        fetchCategoryData(canApprove("overtime"), "/manager/pending-requests?type=overtime"),
        fetchCategoryData(canApprove("permit"), "/manager/pending-requests?type=permit"),
        fetchCategoryData(canApprove("fund_request"), "/manager/pending-requests?type=fund_request"),
        fetchCategoryData(canApprove("vehicle_log"), "/manager/pending-requests?type=vehicle_log"),
        fetchCategoryData(canApprove("dinas_luar"), "/attendance/dinas-luar/pending"),
      ]);

      const allMerged = [
        ...normalizeLeaves(leaveData),
        ...normalizeReims(reimData),
        ...normalizeOvertimes(overtimeData),
        ...normalizePermits(permitData),
        ...normalizeFunds(fundData),
        ...normalizeVehicles(vehicleData),
        ...normalizeDinas(dinasData)
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(allMerged);
      await fetchCounts();
    } catch (e) {
      console.error("Gagal mengambil daftar persetujuan:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canApprove, fetchCounts]);

  useEffect(() => {
    fetchApprovals();
    fetchTeamAttendance();
    const interval = setInterval(() => {
      fetchApprovals(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchApprovals, fetchTeamAttendance]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchApprovals(), fetchTeamAttendance()]);
    toast.success("Data persetujuan dan kehadiran tim telah diperbarui.");
  };

  const handleActionClick = (item: ApprovalItem, action: ActionType) => {
    setActionModal({ isOpen: true, action, item });
    setRemarkInput("");
    if (item.type === "permit") {
      setPermitOverrideCategory(item.permit_category || "I");
      setPermitOverrideDoctorNote(item.permit_has_doctor_note || false);
    }
  };

  const executeAction = async () => {
    const { action, item } = actionModal;
    if (!action || !item || isSubmitting) return;

    if (action === "reject" && !remarkInput.trim() && (item.type === "reimbursement" || item.type === "overtime" || item.type === "fund_request")) {
      toast.warning("Alasan penolakan WAJIB diisi!");
      return;
    }

    setIsSubmitting(true);
    setProcessingId(`${item.type}-${item.id}`);

    try {
      const roleName = currentUser?.role?.name?.toLowerCase() || "";
      const isHR = currentUser?.role_id === 1 || 
                   roleName.includes("hr") || 
                   roleName.includes("admin") ||
                   roleName.includes("vp") ||
                   roleName.includes("direktur") ||
                   roleName.includes("director") ||
                   roleName.includes("ceo");

      await dispatchApprovalRequest(
        item,
        action,
        remarkInput,
        permitOverrideCategory,
        permitOverrideDoctorNote,
        isHR
      );

      // Play subtle confirmation sound
      try {
        const audio = new globalThis.Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
        audio.volume = 0.6;
        audio.play().catch(() => {});
      } catch {}

      toast.success(`Berhasil ${action === "approve" ? "menyetujui" : "menolak"} pengajuan.`);
      setActionModal({ isOpen: false, action: null, item: null });
      if (selectedItem?.id === item.id && selectedItem?.type === item.type) {
        setIsDetailModalOpen(false);
      }
      await fetchApprovals(true);
    } catch (error: any) {
      console.error("Error processing approval:", error);
      toast.error("Gagal memproses pengajuan: " + (error?.response?.data?.message || "Terjadi kesalahan sistem"));
    } finally {
      setIsSubmitting(false);
      setProcessingId(null);
    }
  };

  const handleViewDetail = (item: ApprovalItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  // Filtered approval items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchType = filter === "all" || item.type === filter;
      if (!matchType) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.user_name.toLowerCase().includes(q) ||
        Boolean(item.user_email?.toLowerCase().includes(q)) ||
        Boolean(item.user_role?.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [items, filter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Filtered team members
  const filteredTeam = useMemo(() => {
    if (!teamSearchQuery.trim()) return teamMembers;
    const q = teamSearchQuery.toLowerCase();
    return teamMembers.filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.role.toLowerCase().includes(q) ||
      m.status.toLowerCase().includes(q) ||
      Boolean(m.dinas_luar_destination?.toLowerCase().includes(q)) ||
      (m.is_dinas_luar && "dinas luar".includes(q)) ||
      (!m.is_dinas_luar && "di kantor".includes(q))
    );
  }, [teamMembers, teamSearchQuery]);

  // Team summary counts
  const teamStats = useMemo(() => {
    const total = teamMembers.length;
    const working = teamMembers.filter(m => m.status === "Hadir").length;
    const finished = teamMembers.filter(m => m.status === "Selesai").length;
    const absent = teamMembers.filter(m => m.status === "Belum Masuk").length;
    const dinasLuar = teamMembers.filter(m => (m.is_dinas_luar || m.attendance_type === "dinas_luar") && m.status !== "Belum Masuk").length;
    const diKantor = teamMembers.filter(m => (!m.is_dinas_luar && m.attendance_type !== "dinas_luar") && m.status !== "Belum Masuk").length;
    return { total, working, finished, absent, dinasLuar, diKantor };
  }, [teamMembers]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const getDinasLuarStatusText = (status?: string | null) => {
    if (status === 'approved_hr') return 'Disetujui HRD';
    if (status === 'approved_spv') return 'Disetujui SPV';
    if (status === 'rejected') return 'Ditolak';
    return 'Menunggu Approval';
  };

  const renderTeamAttendanceContent = () => {
    if (loadingTeam) {
      return (
        <div className="col-span-full py-16 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="w-8 h-8 border-2 border-[#8B0000] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">Memuat data tim...</p>
        </div>
      );
    }

    if (filteredTeam.length === 0) {
      return (
        <div className="col-span-full py-16 bg-white rounded-2xl border border-slate-200 text-center">
          <Users size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-700">Tidak ada data anggota tim ditemukan</p>
          <p className="text-xs text-slate-400">Pastikan bawahan telah diset pada struktur organisasi</p>
        </div>
      );
    }

    return filteredTeam.map((member) => (
      <div
        key={member.id}
        className={`bg-white rounded-2xl border p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4 ${
          member.is_dinas_luar || member.attendance_type === "dinas_luar"
            ? "border-rose-200/90 bg-gradient-to-b from-rose-50/20 to-white"
            : "border-slate-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-[#8B0000] border border-rose-100 flex items-center justify-center text-sm font-black overflow-hidden shrink-0">
              {member.photo_url ? (
                <img
                  src={getStorageUrl(member.photo_url)}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                member.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-snug">{member.name}</h3>
              <p className="text-xs text-slate-500">{member.role}</p>
            </div>
          </div>

          {/* Status Badge */}
          {renderMemberStatusBadge(member)}
        </div>

        {/* Dinas Luar Info Banner */}
        {(member.is_dinas_luar || member.attendance_type === "dinas_luar") && member.status !== "Belum Masuk" && (
          <div className="p-2.5 bg-rose-50 border border-rose-200/70 rounded-xl text-xs flex items-start gap-2">
            <MapPin size={14} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-black text-rose-700 tracking-wider block">Lokasi Dinas Luar</span>
              <span className="font-bold text-rose-950 text-xs truncate block">
                {member.dinas_luar_destination || "Tugas di luar kantor"}
              </span>
              {member.dinas_luar_status && (
                <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">
                  Persetujuan: {getDinasLuarStatusText(member.dinas_luar_status)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Attendance Times */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2 rounded-xl">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Jam Masuk</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">
              {member.check_in ? member.check_in + " WIB" : "-- : --"}
            </div>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Jam Pulang</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">
              {member.check_out ? member.check_out + " WIB" : "-- : --"}
            </div>
          </div>
        </div>
      </div>
    ));
  };

  if (loading && items.length === 0) {
    return <ListPageSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#8B0000] via-[#700000] to-[#4A0000] p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold text-rose-100 backdrop-blur-md">
              <ShieldCheck size={14} className="text-amber-300" />
              <span>Portal Manager & Pusat Persetujuan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Pusat Persetujuan & Monitoring Tim
            </h1>
            <p className="text-xs sm:text-sm text-rose-100/90 max-w-2xl leading-relaxed">
              Tinjau permohonan bawahan/tim secara cepat dan pantau kehadiran seluruh anggota tim secara real-time.
            </p>
          </div>

          {/* Action & Refresh Button */}
          <div className="flex items-center gap-3">
            {(isSuperAdmin || hasPermission("approve-payroll") || hasPermission("manage-payroll")) && (
              <Link
                href="/dashboard/payroll/approval"
                className="px-4 py-2.5 bg-white text-[#8B0000] hover:bg-rose-50 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm"
              >
                <CreditCard size={14} />
                <span>Persetujuan Payroll</span>
              </Link>
            )}
            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin text-amber-300" : ""} />
              <span>{refreshing ? "Memperbarui..." : "Muat Ulang Data"}</span>
            </button>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-12 -bottom-12 h-56 w-56 rounded-full bg-white/5 blur-2xl pointer-events-none" />
      </div>

      {/* Main Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 gap-4">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab("approvals")}
            className={`pb-3 px-2 sm:px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "approvals"
                ? "border-[#8B0000] text-[#8B0000]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <FileText size={16} />
            <span>Permohonan Persetujuan</span>
            {items.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-[#8B0000]">
                {items.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("team")}
            className={`pb-3 px-2 sm:px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "team"
                ? "border-[#8B0000] text-[#8B0000]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users size={16} />
            <span>Kehadiran Tim Hari Ini</span>
            {teamMembers.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700">
                {teamMembers.length} Anggota
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: PERMOHONAN PERSETUJUAN */}
      {activeTab === "approvals" && (
        hasAnyApprovalPermission ? (
        <div className="space-y-6">
          {/* Quick Metrics Category Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {/* Cuti */}
            {canApprove("leave") && (
              <button
                onClick={() => setFilter(filter === "leave" ? "all" : "leave")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "leave"
                    ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                    <CalendarCheck size={16} />
                  </div>
                  <span className="text-base font-black text-blue-900">
                    {pendingCounts.leave || items.filter(i => i.type === "leave").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Cuti</div>
                <div className="text-[10px] text-slate-400">Tahunan & Sakit</div>
              </button>
            )}

            {/* Izin */}
            {canApprove("permit") && (
              <button
                onClick={() => setFilter(filter === "permit" ? "all" : "permit")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "permit"
                    ? "bg-purple-50/80 border-purple-300 ring-2 ring-purple-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                    <ClipboardList size={16} />
                  </div>
                  <span className="text-base font-black text-purple-900">
                    {pendingCounts.permit || items.filter(i => i.type === "permit").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Izin</div>
                <div className="text-[10px] text-slate-400">Dispensasi & Jam</div>
              </button>
            )}

            {/* Lembur */}
            {canApprove("overtime") && (
              <button
                onClick={() => setFilter(filter === "overtime" ? "all" : "overtime")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "overtime"
                    ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Clock size={16} />
                  </div>
                  <span className="text-base font-black text-amber-900">
                    {pendingCounts.overtime || items.filter(i => i.type === "overtime").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Lembur</div>
                <div className="text-[10px] text-slate-400">Jadwal & Tugas</div>
              </button>
            )}

            {/* Klaim Reimburse */}
            {canApprove("reimbursement") && (
              <button
                onClick={() => setFilter(filter === "reimbursement" ? "all" : "reimbursement")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "reimbursement"
                    ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <CreditCard size={16} />
                  </div>
                  <span className="text-base font-black text-emerald-900">
                    {pendingCounts.reimbursement || items.filter(i => i.type === "reimbursement").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Klaim Biaya</div>
                <div className="text-[10px] text-slate-400">Reimbursement</div>
              </button>
            )}

            {/* Pengajuan Dana */}
            {canApprove("fund_request") && (
              <button
                onClick={() => setFilter(filter === "fund_request" ? "all" : "fund_request")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "fund_request"
                    ? "bg-teal-50/80 border-teal-300 ring-2 ring-teal-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                    <Wallet size={16} />
                  </div>
                  <span className="text-base font-black text-teal-900">
                    {pendingCounts.fund_request || items.filter(i => i.type === "fund_request").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Kasbon / Dana</div>
                <div className="text-[10px] text-slate-400">Uang Muka</div>
              </button>
            )}

            {/* Armada / Dinas */}
            {canApprove("vehicle_log") && (
              <button
                onClick={() => setFilter(filter === "vehicle_log" ? "all" : "vehicle_log")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "vehicle_log"
                    ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center">
                    <Car size={16} />
                  </div>
                  <span className="text-base font-black text-indigo-900">
                    {pendingCounts.vehicle_log || items.filter(i => i.type === "vehicle_log").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Log Armada</div>
                <div className="text-[10px] text-slate-400">Peminjaman Mobil</div>
              </button>
            )}
          </div>

          {/* Search and Category Filter Pills */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama karyawan, jabatan, keperluan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition-all"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filter === "all"
                    ? "bg-[#8B0000] text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua ({items.length})
              </button>
              {canApprove("leave") && (
                <button
                  onClick={() => setFilter("leave")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "leave"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Cuti
                </button>
              )}
              {canApprove("permit") && (
                <button
                  onClick={() => setFilter("permit")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "permit"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Izin
                </button>
              )}
              {canApprove("overtime") && (
                <button
                  onClick={() => setFilter("overtime")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "overtime"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Lembur
                </button>
              )}
              {canApprove("reimbursement") && (
                <button
                  onClick={() => setFilter("reimbursement")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "reimbursement"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Klaim
                </button>
              )}
              {canApprove("fund_request") && (
                <button
                  onClick={() => setFilter("fund_request")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "fund_request"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Dana
                </button>
              )}
              {canApprove("vehicle_log") && (
                <button
                  onClick={() => setFilter("vehicle_log")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "vehicle_log"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Armada
                </button>
              )}
              {canApprove("dinas_luar") && (
                <button
                  onClick={() => setFilter("dinas_luar")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "dinas_luar"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Dinas Luar
                </button>
              )}
            </div>
          </div>

          {/* Approvals Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Menampilkan <span className="font-bold text-slate-900">{paginatedItems.length}</span> dari <span className="font-bold text-slate-900">{filteredItems.length}</span> pengajuan pending
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Tipe & Tahap</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Jadwal / Nominal</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4">Waktu Pengajuan</th>
                    <th className="py-3 px-4 text-right">Aksi Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-20 bg-white">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-xs">
                            <CheckCircle2 size={28} />
                          </div>
                          <h3 className="text-base font-bold text-slate-900 mt-2">Semua Beres!</h3>
                          <p className="text-xs text-slate-500 text-center">
                            Tidak ada permohonan bawahan yang memerlukan persetujuan pada filter ini saat ini.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => {
                      const isProcessing = processingId === `${item.type}-${item.id}`;
                      return (
                        <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50/80 transition-colors group">
                          {/* Karyawan */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#8B0000] border border-rose-200/80 flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                                {item.user_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block leading-snug truncate">
                                  {item.user_name}
                                </span>
                                {item.user_role && (
                                  <span className="text-[11px] text-slate-400 block truncate">
                                    {item.user_role}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Tipe & Step */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <Badge variant="outline" className={`text-xs font-bold ${typeColor[item.type]}`}>
                                {typeLabel[item.type] || item.type}
                              </Badge>
                              {item.current_approval_step && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Tahap {item.current_approval_step}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Kategori */}
                          <td className="py-3.5 px-4">
                            <span className="text-xs font-semibold text-slate-700 block max-w-[150px] truncate">
                              {item.category}
                            </span>
                          </td>

                          {/* Jadwal / Nominal */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              {item.start_date && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                                  <Clock size={12} className="text-slate-400 shrink-0" />
                                  <span>
                                    {item.start_date} {item.end_date ? `s/d ${item.end_date}` : ""}
                                  </span>
                                </div>
                              )}
                              {item.amount && (
                                <div className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md w-fit border border-emerald-100">
                                  IDR {Number.parseInt(item.amount, 10).toLocaleString("id-ID")}
                                </div>
                              )}
                              {!item.start_date && !item.amount && (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </div>
                          </td>

                          {/* Keterangan */}
                          <td className="py-3.5 px-4 max-w-[200px]">
                            <p className="text-xs text-slate-600 truncate font-normal" title={item.description}>
                              {item.description || <span className="text-slate-400 italic">Tanpa keterangan</span>}
                            </p>
                            {item.attachment && (
                              <button
                                onClick={() => handleViewDetail(item)}
                                className="flex items-center gap-1 text-[11px] text-[#8B0000] font-bold hover:underline mt-0.5"
                              >
                                <ExternalLink size={11} /> Lihat Bukti Lampiran
                              </button>
                            )}
                          </td>

                          {/* Waktu Pengajuan */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="text-xs text-slate-500 font-medium">
                              {new Date(item.created_at).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </td>

                          {/* Aksi Tindakan */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetail(item)}
                                className="h-8 px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg shadow-xs"
                                title="Lihat Detail Lengkap"
                              >
                                <Eye size={13} className="mr-1 text-slate-500" />
                                Detail
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleActionClick(item, "reject")}
                                disabled={isProcessing}
                                className="h-8 px-2.5 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 rounded-lg"
                              >
                                <XCircle size={13} className="mr-1" />
                                {isProcessing ? "..." : "Tolak"}
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => handleActionClick(item, "approve")}
                                disabled={isProcessing}
                                className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                              >
                                <CheckCircle2 size={13} className="mr-1" />
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
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white">
                <p className="text-xs text-slate-500 font-medium">
                  Halaman {currentPage} dari {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-3 text-xs font-bold"
                  >
                    <ChevronLeft size={14} className="mr-1" /> Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 px-3 text-xs font-bold"
                  >
                    Selanjutnya <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm my-8">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Tidak Ada Akses Persetujuan</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Role / Akun Anda saat ini belum memiliki izin untuk menyetujui kategori pengajuan apapun.
              Jika Anda memerlukan akses, silakan hubungi Super Admin untuk mengaktifkan izin persetujuan di kelola role.
            </p>
          </div>
        )
      )}

      {/* TAB 2: KEHADIRAN TIM HARI INI (TEAM ATTENDANCE) */}
      {activeTab === "team" && (
        <div className="space-y-6">
          {/* Top Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Tim</div>
                <div className="text-xl font-black text-slate-900 mt-0.5">{teamStats.total}</div>
                <div className="text-[10px] text-slate-400">Bawahan terdaftar</div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Users size={20} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Di Kantor</div>
                <div className="text-xl font-black text-emerald-700 mt-0.5">{teamStats.diKantor}</div>
                <div className="text-[10px] text-emerald-600/80">Absen di kantor</div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
                <Building2 size={20} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-rose-200 p-4.5 shadow-xs flex items-center justify-between bg-gradient-to-br from-rose-50/40 to-white">
              <div>
                <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Dinas Luar</div>
                <div className="text-xl font-black text-rose-700 mt-0.5">{teamStats.dinasLuar}</div>
                <div className="text-[10px] text-rose-600/80">Tugas luar kantor</div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-rose-100/70 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0">
                <MapPin size={20} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Selesai</div>
                <div className="text-xl font-black text-blue-700 mt-0.5">{teamStats.finished}</div>
                <div className="text-[10px] text-blue-600/80">Sudah check-out</div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shrink-0">
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
              <div>
                <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Belum Masuk</div>
                <div className="text-xl font-black text-amber-700 mt-0.5">{teamStats.absent}</div>
                <div className="text-[10px] text-amber-600/80">Belum absen</div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100 shrink-0">
                <Clock size={20} />
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari anggota tim berdasarkan nama atau jabatan..."
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition-all"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Total {filteredTeam.length} karyawan
            </div>
          </div>

          {/* Subordinate Attendance Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderTeamAttendanceContent()}
          </div>
        </div>
      )}

      {/* OFFICIAL CORPORATE FORM DOCUMENT SHEET MODAL */}
      {isDetailModalOpen && selectedItem && (
        <OfficialApprovalDocumentSheet
          item={selectedItem}
          onClose={() => setIsDetailModalOpen(false)}
          onApprove={() => {
            setIsDetailModalOpen(false);
            handleActionClick(selectedItem, "approve");
          }}
          onReject={() => {
            setIsDetailModalOpen(false);
            handleActionClick(selectedItem, "reject");
          }}
        />
      )}

      {/* ACTION MODAL (APPROVE / REJECT CONFIRMATION) */}
      {actionModal.isOpen && actionModal.item && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className={`font-bold text-lg ${actionModal.action === "approve" ? "text-emerald-700" : "text-red-700"}`}>
                {actionModal.action === "approve" ? "Setujui Pengajuan" : "Tolak Pengajuan"}
              </h3>
              <button 
                onClick={() => setActionModal({ isOpen: false, action: null, item: null })}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6">
              {actionModal.item.attachment && (
                <div className="mb-4 rounded-xl border overflow-hidden bg-slate-50">
                  <p className="text-[10px] font-black text-slate-400 bg-slate-100/50 px-3 py-1 border-b">BUKTI LAMPIRAN</p>
                  <img 
                    src={getStorageUrl(actionModal.item.attachment)} 
                    alt="Receipt" 
                    className="w-full h-auto max-h-[220px] object-contain mx-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://placehold.co/600x400?text=Bukti+Gagal+Dimuat";
                    }}
                  />
                </div>
              )}

              <p className="text-xs sm:text-sm text-slate-600 mb-4">
                Tuliskan {actionModal.action === "approve" ? "catatan respon (opsional)" : "alasan penolakan (WAJIB)"} untuk karyawan ini.
              </p>

              <textarea
                className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3.5 text-xs text-slate-800 outline-none focus:border-[#8B0000] focus:ring-4 focus:ring-[#8B0000]/5 min-h-[90px] transition-all"
                placeholder={actionModal.action === "approve" ? "Tulis catatan persetujuan..." : "Tuliskan alasan penolakan..."}
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                autoFocus
              />

              {/* HRD Override for Permit Approvals */}
              {actionModal.item.type === "permit" && actionModal.action === "approve" && (
                <div className="mt-4 p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={15} className="text-purple-600" />
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Override Kategori Izin (HRD)</p>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="permit-override-category-select" className="text-xs font-semibold text-slate-600">Kategori</label>
                    <select 
                      id="permit-override-category-select"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:ring-1 focus:ring-purple-400"
                      value={permitOverrideCategory}
                      onChange={(e) => setPermitOverrideCategory(e.target.value)}
                    >
                      <option value="I">[I] Izin — Tidak Potong</option>
                      <option value="A">[A] Alpha/Mangkir — Potong</option>
                      <option value="S">[S] Sakit</option>
                      <option value="L">[L] Lainnya — Tidak Potong</option>
                    </select>
                  </div>
                  {permitOverrideCategory === "S" && (
                    <div className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-200">
                      <input 
                        type="checkbox" 
                        id="doctor-note-toggle"
                        checked={permitOverrideDoctorNote}
                        onChange={(e) => setPermitOverrideDoctorNote(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <label htmlFor="doctor-note-toggle" className="text-xs text-slate-700 cursor-pointer">
                        <span className="font-semibold">Dengan Surat Dokter</span>
                        <span className="block text-[10px] text-slate-400">
                          {permitOverrideDoctorNote ? "✓ Tidak dipotong gaji" : "✗ Dipotong gaji"}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 bg-slate-50/50 border-t border-slate-200 flex gap-3">
              <button 
                onClick={() => setActionModal({ isOpen: false, action: null, item: null })}
                disabled={isSubmitting}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={executeAction}
                disabled={isSubmitting}
                className={`flex-1 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 ${
                  actionModal.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/10"
                    : "bg-red-600 hover:bg-red-700 shadow-red-900/10"
                }`}
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
