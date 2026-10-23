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
  Building2,
  Trash2,
  History,
  Filter,
  ShieldAlert,
  DollarSign,
  CalendarDays,
  Laptop,
  Repeat,
  Sparkles,
  Smartphone,
  Camera
} from "lucide-react";
import { ListPageSkeleton } from "@/components/Skeleton";
import { useAuth, isSuperAdminUser } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import OfficialApprovalDocumentSheet from "@/components/OfficialApprovalDocumentSheet";
import { getStorageUrl } from "@/lib/utils";
import Link from "next/link";

type ApprovalType = 
  | "leave" 
  | "reimbursement" 
  | "overtime" 
  | "permit" 
  | "dinas_luar" 
  | "fund_request"
  | "vehicle_log"
  | "payroll"
  | "early_out"
  | "attendance_correction"
  | "web_attendance";

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
  // Web Attendance-specific
  web_approval_status?: string;
  ip_address?: string;
  is_suspicious?: boolean;
  latitude_in?: string;
  longitude_in?: string;
  image_in?: string;
  // Dynamic approval workflow
  current_approval_step?: number | null;
  current_step_info?: Record<string, any>;
}

type CoordinateValue = number | string | null;

interface TeamMemberAttendance {
  id: number | string;
  name: string;
  role: string;
  avatar?: string;
  photo_url?: string | null;
  shift?: string;
  check_in?: string | null;
  check_out?: string | null;
  status: "Hadir" | "Terlambat" | "Belum Masuk" | "Selesai" | "Alpha" | "Izin" | "Cuti" | "Dinas Luar";
  attendance_id?: number | null;
  check_in_full?: string | null;
  check_out_full?: string | null;
  attendance_type?: string;
  is_dinas_luar?: boolean;
  is_wfa?: boolean;
  dinas_luar_destination?: string | null;
  dinas_luar_notes?: string | null;
  dinas_luar_status?: string | null;
  image_in?: string | null;
  image_out?: string | null;
  image_in_url?: string | null;
  image_out_url?: string | null;
  latitude_in?: CoordinateValue;
  longitude_in?: CoordinateValue;
  latitude_out?: CoordinateValue;
  longitude_out?: CoordinateValue;
  location_label?: string | null;
  work_pattern?: "office_hour" | "shift" | "flexible";
  user_attendance_type?: string;
}

const typeLabel: Record<ApprovalType, string> = {
  leave: "Cuti",
  reimbursement: "Klaim Biaya",
  overtime: "Lembur",
  permit: "Izin",
  dinas_luar: "Dinas Luar",
  fund_request: "Pengajuan Dana",
  vehicle_log: "Log Armada",
  payroll: "Payroll",
  early_out: "Pulang Awal",
  attendance_correction: "Koreksi Absen",
  web_attendance: "Absen Web",
};

const typeColor: Record<ApprovalType, string> = {
  leave: "bg-blue-50 text-blue-700 border-blue-200",
  reimbursement: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overtime: "bg-amber-50 text-amber-700 border-amber-200",
  permit: "bg-purple-50 text-purple-700 border-purple-200",
  dinas_luar: "bg-rose-50 text-rose-700 border-rose-200",
  fund_request: "bg-teal-50 text-teal-700 border-teal-200",
  vehicle_log: "bg-indigo-50 text-indigo-700 border-indigo-200",
  payroll: "bg-emerald-50 text-emerald-700 border-emerald-200",
  early_out: "bg-orange-50 text-orange-700 border-orange-200",
  attendance_correction: "bg-cyan-50 text-cyan-700 border-cyan-200",
  web_attendance: "bg-indigo-50 text-indigo-700 border-indigo-200",
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

const normalizeEarlyOut = (rawAttendances: any[]): ApprovalItem[] =>
  rawAttendances.map((a: any) => ({
    id: a.id,
    type: "early_out",
    user_name: a.user?.name || "Karyawan",
    user_email: a.user?.email,
    user_role: a.user?.role?.name || a.user?.role,
    description: `Alasan Pulang Awal: ${a.early_out_reason || a.suspicious_reason || 'Tidak ada keterangan'}`,
    category: "Izin Pulang Lebih Awal",
    start_date: a.check_in ? new Date(a.check_in).toLocaleString('id-ID') : (a.date || undefined),
    end_date: a.check_out ? new Date(a.check_out).toLocaleString('id-ID') : undefined,
    status: a.early_out_status || "pending",
    attachment: extractStoragePath(a.image_out_url || a.image_out || a.image_in_url || a.image_in),
    created_at: a.created_at || a.check_out || a.check_in,
    target_supervisor_id: a.user?.supervisor_id
  }));

const normalizePayroll = (rawPayrolls: any[]): ApprovalItem[] =>
  rawPayrolls.map((p: any) => ({
    id: p.id,
    type: "payroll",
    user_name: p.creator?.name || "HR Officer",
    user_email: p.creator?.email,
    user_role: p.creator?.role?.name || "HR / Finance",
    description: `Batch Payroll Periode ${p.period_month} ${p.period_year} (${p.total_employees} Karyawan)`,
    category: `Payroll ${p.period_month} ${p.period_year}`,
    amount: p.total_net ? String(p.total_net) : undefined,
    status: p.status,
    current_approval_step: p.current_approval_step || null,
    current_step_info: p.current_step_info,
    created_at: p.submitted_at || p.created_at,
    target_supervisor_id: null,
  }));

const normalizeCorrections = (rawCorrections: any[]): ApprovalItem[] =>
  rawCorrections.map((c: any) => {
    const corrDate = c.attendance_date || c.attendance?.date || (c.created_at ? new Date(c.created_at).toLocaleDateString('id-ID') : '-');
    const checkInTime = c.corrected_check_in_time || (c.corrected_check_in ? c.corrected_check_in.substring(11, 16) : '--:--');
    const checkOutTime = c.corrected_check_out_time || (c.corrected_check_out ? c.corrected_check_out.substring(11, 16) : '--:--');

    return {
      id: c.id,
      type: "attendance_correction",
      user_name: c.user?.name || "Karyawan",
      user_email: c.user?.email,
      user_role: c.user?.role?.name || c.user?.role,
      description: `Koreksi Absen Tanggal ${corrDate}: Masuk [${checkInTime}] Pulang [${checkOutTime}]. Alasan: ${c.reason || '-'}`,
      category: c.correction_type === 'missing_checkout' ? 'Lupa Absen Pulang' : 'Koreksi Waktu',
      start_date: `${corrDate} (${checkInTime} - ${checkOutTime})`,
      status: c.status || "pending",
      current_approval_step: c.current_approval_step || null,
      attachment: extractStoragePath(c.attachment),
      created_at: c.created_at,
      target_supervisor_id: c.user?.supervisor_id
    };
  });

const normalizeWebAttendances = (rawItems: any[]): ApprovalItem[] =>
  rawItems.map((w: any) => {
    const checkInDate = w.check_in ? new Date(w.check_in) : new Date();
    const timeFormatted = checkInDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const dateFormatted = checkInDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    const isMobileManual = w.channel === 'mobile' || (w.suspicious_reason && (w.suspicious_reason.includes('Tanpa verifikasi') || w.suspicious_reason.includes('wajah gagal')));
    const anomalySuffix = w.is_suspicious ? " — Anomali Terdeteksi" : "";
    const description = isMobileManual
      ? `Absen Manual Mobile pada ${dateFormatted} pukul ${timeFormatted} WIB. Catatan: "${w.suspicious_reason || 'Verifikasi wajah gagal'}"`
      : `Absen Masuk Browser via Web pada ${dateFormatted} pukul ${timeFormatted} WIB (IP: ${w.ip_address || "127.0.0.1"})${anomalySuffix}`;

    return {
      id: w.id,
      type: "web_attendance",
      user_name: w.user?.name || "Karyawan",
      user_email: w.user?.email,
      user_role: w.user?.role?.name || w.user?.role || "Karyawan",
      category: isMobileManual ? "Presensi Manual (Wajah Gagal)" : "Presensi Web (Browser)",
      description,
      status: w.web_approval_status || w.status || "pending",
      created_at: w.check_in || w.created_at,
      web_approval_status: w.web_approval_status,
      ip_address: w.ip_address,
      is_suspicious: w.is_suspicious,
      latitude_in: w.latitude_in,
      longitude_in: w.longitude_in,
      image_in: w.image_in,
      attachment: extractStoragePath(w.image_in || w.image_out),
      target_supervisor_id: null,
    };
  });

const handleWebAttendanceApproval = async (item: ApprovalItem, action: ActionType, remarkInput: string) => {
  if (action === "approve") {
    return axiosInstance.post(`/attendance/web-approve/${item.id}`);
  }
  return axiosInstance.post(`/attendance/web-reject/${item.id}`, {
    reason: remarkInput || "Ditolak oleh Admin/Super Admin"
  });
};

const handleDinasLuarApproval = async (
  item: ApprovalItem,
  action: ActionType,
  remarkInput: string,
  isHR: boolean
) => {
  try {
    return await axiosInstance.post("/manager/update-status", {
      type: "dinas_luar",
      id: item.id,
      status: action === "approve" ? "approved" : "rejected",
      remark: remarkInput
    });
  } catch {
    let actionSuffix = "reject";
    if (action === "approve") {
      actionSuffix = "approve-spv";
      if (isHR && item.status === "waiting_approval") {
        actionSuffix = "approve-hr";
      }
    }
    return axiosInstance.post(`/attendance/dinas-luar/${item.id}/${actionSuffix}`, { reason: remarkInput });
  }
};

const dispatchApprovalRequest = async (
  item: ApprovalItem,
  action: ActionType,
  remarkInput: string,
  permitOverrideCategory: string,
  permitOverrideDoctorNote: boolean,
  isHR: boolean
) => {
  if (item.type === "web_attendance") {
    return handleWebAttendanceApproval(item, action, remarkInput);
  }

  if (item.type === "dinas_luar") {
    return handleDinasLuarApproval(item, action, remarkInput, isHR);
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
  const isWfa = member.is_wfa || member.attendance_type === "wfh";

  if (member.status === "Belum Masuk") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        <span>Belum Masuk</span>
      </span>
    );
  }

  const renderLocationBadge = (isDl?: boolean, isWf?: boolean) => {
    if (isDl) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
          <MapPin size={10} className="text-rose-600 shrink-0" />
          <span>Dinas Luar</span>
        </span>
      );
    }
    if (isWf) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs">
          <Laptop size={10} className="text-indigo-600 shrink-0" />
          <span>WFA</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
        <Building2 size={10} className="text-slate-500 shrink-0" />
        <span>Di Kantor</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      {/* 3-Label Location Badge: Di Kantor, Dinas Luar, WFA */}
      {renderLocationBadge(isDinasLuar, isWfa)}

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

const renderWorkPatternBadge = (workPattern?: string) => {
  if (workPattern === "shift") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
        <Repeat size={10} /> Shift Hour
      </span>
    );
  }
  if (workPattern === "flexible") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
        <Sparkles size={10} /> Fleksibel
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
      <Clock size={10} /> Office Hour
    </span>
  );
};

const renderAttendancePatternBadge = (pattern?: string) => {
  if (pattern === "shift") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
        <Repeat size={10} /> Shift Hour
      </span>
    );
  }
  if (pattern === "flexible") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
        <Sparkles size={10} /> Fleksibel
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
      <Building2 size={10} /> Office Hour
    </span>
  );
};

const renderAttendanceStatusTag = (status?: string) => {
  if (status === "late") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={10} /> Terlambat
      </span>
    );
  }
  if (status === "present") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 size={10} /> Tepat Waktu
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
      {status || "Hadir"}
    </span>
  );
};

const isDateInMonth = (d: Date, createdAt: string, now: Date): boolean => {
  const inMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  const cDate = new Date(createdAt);
  const cInMonth = !Number.isNaN(cDate.getTime()) && cDate.getFullYear() === now.getFullYear() && cDate.getMonth() === now.getMonth();
  return inMonth || cInMonth;
};

const isDateInYear = (d: Date, createdAt: string, now: Date): boolean => {
  const inYear = d.getFullYear() === now.getFullYear();
  const cDate = new Date(createdAt);
  const cInYear = !Number.isNaN(cDate.getTime()) && cDate.getFullYear() === now.getFullYear();
  return inYear || cInYear;
};

const isDateInCustomRange = (d: Date, customStart: string, customEnd: string): boolean => {
  if (customStart) {
    const s = new Date(customStart);
    s.setHours(0, 0, 0, 0);
    if (d < s) return false;
  }
  if (customEnd) {
    const e = new Date(customEnd);
    e.setHours(23, 59, 59, 999);
    if (d > e) return false;
  }
  return true;
};

const isItemWithinPeriod = (
  item: ApprovalItem,
  period: string,
  customStart: string,
  customEnd: string
): boolean => {
  if (period === "all") return true;

  const rawDateStr = item.created_at || item.start_date;
  if (!rawDateStr) return true;

  // Clean date string if it contains schedule/hours in parentheses e.g. "2026-10-15 (08:00 - 17:00)"
  const cleanDateStr = rawDateStr.includes("(") ? rawDateStr.split("(")[0].trim() : rawDateStr;
  const d = new Date(cleanDateStr);
  if (Number.isNaN(d.getTime())) return true;

  const now = new Date();
  if (period === "this_month") {
    return isDateInMonth(d, item.created_at, now);
  }

  if (period === "this_year") {
    return isDateInYear(d, item.created_at, now);
  }

  if (period === "custom") {
    return isDateInCustomRange(d, customStart, customEnd);
  }

  return true;
};

const getLocalDateString = (d: Date = new Date()): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const isItemMatchingSearch = (item: ApprovalItem, searchQuery: string): boolean => {
  if (!searchQuery.trim()) return true;
  const q = searchQuery.toLowerCase();
  return (
    item.user_name.toLowerCase().includes(q) ||
    Boolean(item.user_email?.toLowerCase().includes(q)) ||
    Boolean(item.user_role?.toLowerCase().includes(q)) ||
    item.category.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q)
  );
};

export default function ApprovalsPage() {
  const { user: currentUser, hasPermission, isManager } = useAuth();
  
  // Tabs: 'approvals' (Persetujuan) vs 'team' (Kehadiran Tim) vs 'history' (Riwayat & Audit Log)
  const [activeTab, setActiveTab] = useState<"approvals" | "team" | "history">("approvals");

  // History & Audit Log State
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilterType, setHistoryFilterType] = useState<string>("all");
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>("all");
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");

  // Server Data Purge State (Super Admin Only)
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeType, setPurgeType] = useState<"month" | "year" | "all">("month");
  const [purgeYear, setPurgeYear] = useState<number>(new Date().getFullYear());
  const [purgeMonth, setPurgeMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [purgeModule, setPurgeModule] = useState<string>("all");
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [isPurging, setIsPurging] = useState(false);

  const isSuperAdmin = isSuperAdminUser(currentUser);
  const hasManageApprovals = hasPermission("manage-approvals");

  const canApprove = useCallback((type: ApprovalType): boolean => {
    if (isSuperAdmin || hasManageApprovals) return true;
    switch (type) {
      case "leave":
        return hasPermission("approve-leaves") || isManager;
      case "permit":
        return hasPermission("approve-permits") || isManager;
      case "reimbursement":
        return hasPermission("approve-reimbursements") || isManager;
      case "overtime":
        return hasPermission("approve-overtimes") || isManager;
      case "fund_request":
        return hasPermission("approve-fund-requests") || isManager;
      case "vehicle_log":
        return hasPermission("approve-vehicle-logs") || isManager;
      case "payroll":
        return isSuperAdmin;
      case "dinas_luar":
        return hasPermission("approve-attendances") || hasPermission("approve-leaves") || isManager;
      case "early_out":
        return hasPermission("approve-attendances") || isManager;
      case "attendance_correction":
        return hasPermission("manage-attendance-corrections") || hasPermission("approve-attendance-corrections") || isManager;
      case "web_attendance":
        return isSuperAdmin;
      default:
        return false;
    }
  }, [isSuperAdmin, hasManageApprovals, hasPermission, isManager]);

  const hasAnyApprovalPermission =
    isSuperAdmin ||
    hasManageApprovals ||
    canApprove("leave") ||
    canApprove("permit") ||
    canApprove("overtime") ||
    canApprove("reimbursement") ||
    canApprove("fund_request") ||
    canApprove("vehicle_log") ||
    canApprove("payroll") ||
    canApprove("dinas_luar") ||
    canApprove("early_out") ||
    canApprove("attendance_correction") ||
    canApprove("web_attendance");

  // Date Period state (Presets & Custom Range)
  type PeriodType = "this_month" | "this_year" | "all" | "custom";
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [teamDate, setTeamDate] = useState<string>(() => getLocalDateString());

  // Company filtering state for Super Admin
  const [companies, setCompanies] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  // Approval state
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [pendingCounts, setPendingCounts] = useState<{
    leave: number;
    overtime: number;
    reimbursement: number;
    permit: number;
    fund_request: number;
    vehicle_log: number;
    payroll?: number;
    early_out?: number;
    attendance_correction?: number;
    dinas_luar?: number;
    web_attendance?: number;
    total: number;
  }>({
    leave: 0,
    overtime: 0,
    reimbursement: 0,
    permit: 0,
    fund_request: 0,
    vehicle_log: 0,
    payroll: 0,
    early_out: 0,
    attendance_correction: 0,
    dinas_luar: 0,
    web_attendance: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Team attendance state & Pattern filter
  type TeamStatusFilter = "all" | "di_kantor" | "dinas_luar" | "wfa" | "finished" | "absent";
  const [teamMembers, setTeamMembers] = useState<TeamMemberAttendance[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [patternFilter, setPatternFilter] = useState<"all" | "office_hour" | "shift" | "flexible">("all");
  const [teamStatusFilter, setTeamStatusFilter] = useState<TeamStatusFilter>("all");

  // Tab 3 Attendance History State
  const [historyTab, setHistoryTab] = useState<"requests" | "attendance">("requests");
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [loadingAttHistory, setLoadingAttHistory] = useState(false);
  const [attHistoryPage, setAttHistoryPage] = useState(1);
  const [attHistoryLastPage, setAttHistoryLastPage] = useState(1);
  const [attHistoryTotal, setAttHistoryTotal] = useState(0);
  const [attHistoryFilterStatus, setAttHistoryFilterStatus] = useState("all");
  const [attHistoryFilterChannel, setAttHistoryFilterChannel] = useState("all");
  const [attHistorySearch, setAttHistorySearch] = useState("");

  // Modals state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<TeamMemberAttendance | null>(null);

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

  // Load companies for Super Admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    axiosInstance.get("/approval-workflows/companies")
      .then((res) => {
        if (Array.isArray(res.data?.data)) {
          setCompanies(res.data.data);
        }
      })
      .catch(() => {});
  }, [isSuperAdmin]);

  const buildPeriodQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.append("period", selectedPeriod);
    if (selectedPeriod === "custom") {
      if (customStartDate) params.append("start_date", customStartDate);
      if (customEndDate) params.append("end_date", customEndDate);
    }
    if (selectedCompanyId) {
      params.append("company_id", String(selectedCompanyId));
    }
    return params.toString();
  }, [selectedPeriod, customStartDate, customEndDate, selectedCompanyId]);

  // 1. Fetch Manager Pending Counts
  const fetchCounts = useCallback(async () => {
    try {
      const periodQuery = buildPeriodQuery();
      const res = await axiosInstance.get(`/manager/pending-count?${periodQuery}`);
      if (res.data?.data) {
        setPendingCounts(prev => ({
          ...res.data.data,
          web_attendance: prev.web_attendance || 0,
          total: (res.data.data.total || 0) + (prev.web_attendance || 0),
        }));
      }
    } catch (e) {
      console.warn("Could not fetch manager pending count:", e);
    }
  }, [buildPeriodQuery]);

  // 2. Fetch Team Attendance
  const fetchTeamAttendance = useCallback(async (targetDate?: string) => {
    try {
      setLoadingTeam(true);
      const queryDate = targetDate || teamDate;
      let url = `/manager/team-attendance?date=${queryDate}`;
      if (selectedCompanyId) {
        url += `&company_id=${selectedCompanyId}`;
      }
      const res = await axiosInstance.get(url);
      if (res.data?.data && Array.isArray(res.data.data)) {
        setTeamMembers(res.data.data);
      }
    } catch (e) {
      console.warn("Could not fetch team attendance:", e);
    } finally {
      setLoadingTeam(false);
    }
  }, [teamDate, selectedCompanyId]);

  const fetchCategoryData = async (allowed: boolean, url: string): Promise<any[]> => {
    if (!allowed) return [];
    try {
      const res = await axiosInstance.get(url);
      const data = res.data?.data;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    } catch {
      return [];
    }
  };

  // 3. Fetch All Pending Approvals (filtered dynamically by allowed categories & period)
  const fetchApprovals = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setRefreshing(true);

      const periodQuery = buildPeriodQuery();

      // Fetch from manager endpoints and specialized routes conditionally based on permissions
      const [
        leaveData,
        reimData,
        overtimeData,
        permitData,
        fundData,
        vehicleData,
        dinasData,
        earlyOutData,
        payrollData,
        correctionData,
        webPendingData
      ] = await Promise.all([
        fetchCategoryData(canApprove("leave"), `/manager/pending-requests?type=leave&${periodQuery}`),
        fetchCategoryData(canApprove("reimbursement"), `/manager/pending-requests?type=reimbursement&${periodQuery}`),
        fetchCategoryData(canApprove("overtime"), `/manager/pending-requests?type=overtime&${periodQuery}`),
        fetchCategoryData(canApprove("permit"), `/manager/pending-requests?type=permit&${periodQuery}`),
        fetchCategoryData(canApprove("fund_request"), `/manager/pending-requests?type=fund_request&${periodQuery}`),
        fetchCategoryData(canApprove("vehicle_log"), `/manager/pending-requests?type=vehicle_log&${periodQuery}`),
        fetchCategoryData(canApprove("dinas_luar"), `/manager/pending-requests?type=dinas_luar&${periodQuery}`),
        fetchCategoryData(canApprove("early_out"), `/manager/pending-requests?type=early_out&${periodQuery}`),
        fetchCategoryData(canApprove("payroll"), `/manager/pending-requests?type=payroll&${periodQuery}`),
        fetchCategoryData(canApprove("attendance_correction"), `/manager/pending-requests?type=attendance_correction&${periodQuery}`),
        fetchCategoryData(
          canApprove("web_attendance"),
          selectedCompanyId ? `/attendance/web-pending?company_id=${selectedCompanyId}` : "/attendance/web-pending"
        ),
      ]);

      const normalizedWeb = normalizeWebAttendances(webPendingData);

      const allMerged = [
        ...normalizeLeaves(leaveData),
        ...normalizeReims(reimData),
        ...normalizeOvertimes(overtimeData),
        ...normalizePermits(permitData),
        ...normalizeFunds(fundData),
        ...normalizeVehicles(vehicleData),
        ...normalizeDinas(dinasData),
        ...normalizeEarlyOut(earlyOutData),
        ...normalizePayroll(payrollData),
        ...normalizeCorrections(correctionData),
        ...normalizedWeb,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(allMerged);
      setPendingCounts(prev => ({
        ...prev,
        web_attendance: normalizedWeb.length,
      }));
      await fetchCounts();
    } catch (e) {
      console.error("Gagal mengambil daftar persetujuan:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canApprove, fetchCounts, buildPeriodQuery, selectedCompanyId]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  useEffect(() => {
    fetchTeamAttendance();
  }, [fetchTeamAttendance]);

  useEffect(() => {
    if (activeTab === "team") {
      fetchTeamAttendance(teamDate);
    }
  }, [activeTab, fetchTeamAttendance, teamDate]);

  // Fetch Attendance History for Tab 3
  const fetchAttendanceHistory = useCallback(async (pageNumber = 1) => {
    try {
      setLoadingAttHistory(true);
      const params = new URLSearchParams();
      params.append("page", String(pageNumber));
      if (selectedPeriod === "custom") {
        if (customStartDate) params.append("start_date", customStartDate);
        if (customEndDate) params.append("end_date", customEndDate);
      }
      if (selectedCompanyId) {
        params.append("company_id", String(selectedCompanyId));
      }
      if (attHistoryFilterStatus !== "all") params.append("status", attHistoryFilterStatus);
      if (attHistoryFilterChannel !== "all") params.append("channel", attHistoryFilterChannel);
      if (attHistorySearch.trim()) params.append("search", attHistorySearch.trim());

      const res = await axiosInstance.get(`/attendance/history?${params.toString()}`);
      const data = res.data?.data?.data || res.data?.data || [];
      setAttendanceHistory(Array.isArray(data) ? data : []);
      if (res.data?.data?.total !== undefined) {
        setAttHistoryTotal(res.data.data.total);
      }
      if (res.data?.data?.last_page !== undefined) {
        setAttHistoryLastPage(res.data.data.last_page);
      }
      setAttHistoryPage(pageNumber);
    } catch (e) {
      console.warn("Could not fetch attendance history:", e);
    } finally {
      setLoadingAttHistory(false);
    }
  }, [selectedPeriod, customStartDate, customEndDate, selectedCompanyId, attHistoryFilterStatus, attHistoryFilterChannel, attHistorySearch]);

  useEffect(() => {
    if (activeTab === "history" && historyTab === "attendance") {
      fetchAttendanceHistory(1);
    }
  }, [activeTab, historyTab, fetchAttendanceHistory]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchApprovals(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const params = new URLSearchParams();
      if (historyFilterType !== "all") params.append("type", historyFilterType);
      if (historyFilterStatus !== "all") params.append("status", historyFilterStatus);
      params.append("period", selectedPeriod);
      if (selectedPeriod === "custom") {
        if (customStartDate) params.append("start_date", customStartDate);
        if (customEndDate) params.append("end_date", customEndDate);
      }
      if (selectedCompanyId) {
        params.append("company_id", String(selectedCompanyId));
      }
      const res = await axiosInstance.get(`/manager/history-requests?${params.toString()}`);
      setHistoryItems(res.data?.data || []);
    } catch (e) {
      console.warn("Could not fetch history:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFilterType, historyFilterStatus, selectedPeriod, customStartDate, customEndDate, selectedCompanyId]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  const handleExecutePurge = async () => {
    if (purgeConfirmation.trim().toUpperCase() !== "HAPUS") {
      toast.warning('Ketik kata "HAPUS" untuk mengonfirmasi pembersihan.');
      return;
    }
    try {
      setIsPurging(true);
      let computedPeriod = "all";
      if (purgeType === "year") {
        computedPeriod = String(purgeYear);
      } else if (purgeType === "month") {
        computedPeriod = `${purgeYear}-${purgeMonth}`;
      }

      const payload: { period: string; module: string; company_id?: number } = {
        period: computedPeriod,
        module: purgeModule,
      };
      if (selectedCompanyId) {
        payload.company_id = selectedCompanyId;
      }

      const res = await axiosInstance.post("/manager/purge-current-month", payload);
      toast.success(res.data?.message || "Pembersihan data periode berhasil dilakukan.");
      setIsPurgeModalOpen(false);
      setPurgeConfirmation("");
      await handleRefreshAll();
      if (activeTab === "history") {
        fetchHistory();
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Gagal melakukan pembersihan data.");
    } finally {
      setIsPurging(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchApprovals(), fetchTeamAttendance()]);
    if (activeTab === "history") {
      await fetchHistory();
    }
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

      if (!isItemWithinPeriod(item, selectedPeriod, customStartDate, customEndDate)) {
        return false;
      }

      return isItemMatchingSearch(item, searchQuery);
    });
  }, [items, filter, searchQuery, selectedPeriod, customStartDate, customEndDate]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Pattern breakdown counts: Office Hour vs Shift Hour vs Flexible
  const patternStats = useMemo(() => {
    const officeMembers = teamMembers.filter(m => (m.work_pattern || "office_hour") === "office_hour");
    const officeTotal = officeMembers.length;
    const officePresent = officeMembers.filter(m => m.status === "Hadir" || m.status === "Selesai").length;
    const officeAbsent = officeMembers.filter(m => m.status === "Belum Masuk").length;

    const shiftMembers = teamMembers.filter(m => m.work_pattern === "shift");
    const shiftTotal = shiftMembers.length;
    const shiftPresent = shiftMembers.filter(m => m.status === "Hadir" || m.status === "Selesai").length;
    const shiftAbsent = shiftMembers.filter(m => m.status === "Belum Masuk").length;

    const flexMembers = teamMembers.filter(m => m.work_pattern === "flexible");
    const flexTotal = flexMembers.length;
    const flexPresent = flexMembers.filter(m => m.status === "Hadir" || m.status === "Selesai").length;

    return {
      office: { total: officeTotal, present: officePresent, absent: officeAbsent },
      shift: { total: shiftTotal, present: shiftPresent, absent: shiftAbsent },
      flexible: { total: flexTotal, present: flexPresent },
    };
  }, [teamMembers]);

  // Filtered team members based on search, patternFilter, and teamStatusFilter with smart priority sorting
  const filteredTeam = useMemo(() => {
    let list = teamMembers;

    // Filter by work pattern
    if (patternFilter !== "all") {
      list = list.filter(m => (m.work_pattern || "office_hour") === patternFilter);
    }

    // Filter by team status card
    if (teamStatusFilter !== "all") {
      if (teamStatusFilter === "di_kantor") {
        list = list.filter(m => (!m.is_dinas_luar && m.attendance_type !== "dinas_luar" && !m.is_wfa && m.attendance_type !== "wfh") && m.status !== "Belum Masuk");
      } else if (teamStatusFilter === "dinas_luar") {
        list = list.filter(m => (m.is_dinas_luar || m.attendance_type === "dinas_luar") && m.status !== "Belum Masuk");
      } else if (teamStatusFilter === "wfa") {
        list = list.filter(m => (m.is_wfa || m.attendance_type === "wfh") && m.status !== "Belum Masuk");
      } else if (teamStatusFilter === "finished") {
        list = list.filter(m => m.status === "Selesai");
      } else if (teamStatusFilter === "absent") {
        list = list.filter(m => m.status === "Belum Masuk");
      }
    }

    // Filter by search query
    if (teamSearchQuery.trim()) {
      const q = teamSearchQuery.toLowerCase();
      list = list.filter(m => 
        m.name.toLowerCase().includes(q) || 
        m.role.toLowerCase().includes(q) ||
        m.status.toLowerCase().includes(q) ||
        Boolean(m.dinas_luar_destination?.toLowerCase().includes(q)) ||
        (m.is_dinas_luar && "dinas luar".includes(q)) ||
        ((m.is_wfa || m.attendance_type === "wfh") && "wfa work from anywhere".includes(q)) ||
        (!m.is_dinas_luar && !m.is_wfa && "di kantor".includes(q))
      );
    }

    // Smart Sorting:
    // 1. Yang sudah absen (status !== "Belum Masuk" atau ada check_in) di paling atas,
    //    diurutkan berdasarkan jam masuk paling awal (earliest check_in).
    // 2. Yang belum masuk di paling bawah, diurutkan alfabetis berdasarkan nama (A-Z).
    return [...list].sort((a, b) => {
      const aCheckedIn = a.status !== "Belum Masuk" || Boolean(a.check_in);
      const bCheckedIn = b.status !== "Belum Masuk" || Boolean(b.check_in);

      if (aCheckedIn && !bCheckedIn) return -1;
      if (!aCheckedIn && bCheckedIn) return 1;

      if (aCheckedIn && bCheckedIn) {
        // Both checked in: sort by earliest check_in (ascending)
        const timeA = a.check_in || "99:99";
        const timeB = b.check_in || "99:99";
        const timeDiff = timeA.localeCompare(timeB);
        if (timeDiff !== 0) return timeDiff;
        return a.name.localeCompare(b.name);
      }

      // Both not checked in: sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [teamMembers, patternFilter, teamStatusFilter, teamSearchQuery]);

  // Team summary counts
  const teamStats = useMemo(() => {
    const total = teamMembers.length;
    const working = teamMembers.filter(m => m.status === "Hadir").length;
    const finished = teamMembers.filter(m => m.status === "Selesai").length;
    const absent = teamMembers.filter(m => m.status === "Belum Masuk").length;
    const dinasLuar = teamMembers.filter(m => (m.is_dinas_luar || m.attendance_type === "dinas_luar") && m.status !== "Belum Masuk").length;
    const wfa = teamMembers.filter(m => (m.is_wfa || m.attendance_type === "wfh") && m.status !== "Belum Masuk").length;
    const diKantor = teamMembers.filter(m => (!m.is_dinas_luar && m.attendance_type !== "dinas_luar" && !m.is_wfa && m.attendance_type !== "wfh") && m.status !== "Belum Masuk").length;
    return { total, working, finished, absent, dinasLuar, wfa, diKantor };
  }, [teamMembers]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery, selectedPeriod, customStartDate, customEndDate, selectedCompanyId]);

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
      const hasActiveFilters = teamStatusFilter !== "all" || patternFilter !== "all" || Boolean(teamSearchQuery.trim());
      return (
        <div className="col-span-full py-16 bg-white rounded-2xl border border-slate-200 text-center">
          <Users size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-700">Tidak ada data anggota tim ditemukan</p>
          <p className="text-xs text-slate-400">
            {hasActiveFilters
              ? "Tidak ada anggota tim yang cocok dengan kriteria filter saat ini."
              : "Pastikan anggota tim telah terdaftar pada sistem atau ubah tanggal kehadiran."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setTeamStatusFilter("all");
                setPatternFilter("all");
                setTeamSearchQuery("");
              }}
              className="mt-3.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw size={12} />
              <span>Reset Semua Filter</span>
            </button>
          )}
        </div>
      );
    }

    const getTeamMemberCardClass = (m: TeamMemberAttendance) => {
      if (m.is_dinas_luar || m.attendance_type === "dinas_luar") {
        return "border-rose-200/90 bg-gradient-to-b from-rose-50/20 to-white";
      }
      if (m.is_wfa || m.attendance_type === "wfh") {
        return "border-indigo-200/90 bg-gradient-to-b from-indigo-50/20 to-white";
      }
      return "border-slate-200";
    };

    return filteredTeam.map((member) => (
      <div
        key={member.id}
        className={`bg-white rounded-2xl border p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4 ${getTeamMemberCardClass(member)}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-sm font-black overflow-hidden shrink-0 ${
              member.is_wfa || member.attendance_type === "wfh"
                ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                : "bg-rose-50 text-[#8B0000] border-rose-100"
            }`}>
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
              <div className="mt-1">
                {renderWorkPatternBadge(member.work_pattern)}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          {renderMemberStatusBadge(member)}
        </div>

        {/* Dinas Luar Info Banner */}
        {(member.is_dinas_luar || member.attendance_type === "dinas_luar") && member.status !== "Belum Masuk" && (
          <button
            type="button"
            onClick={() => setSelectedTeamDetail(member)}
            className="p-2.5 bg-rose-50 hover:bg-rose-100/70 border border-rose-200/70 rounded-xl text-xs flex items-start gap-2 text-left w-full transition cursor-pointer group"
            title="Klik untuk melihat form dinas luar & foto bukti"
          >
            <MapPin size={14} className="text-rose-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-black text-rose-700 tracking-wider block">Lokasi Dinas Luar</span>
                <span className="text-[10px] text-rose-500 font-bold group-hover:underline flex items-center gap-0.5">
                  <span>Lihat Form</span>
                  <ChevronRight size={11} />
                </span>
              </div>
              <span className="font-bold text-rose-950 text-xs truncate block mt-0.5">
                {member.dinas_luar_destination || "Tugas di luar kantor"}
              </span>
              {member.dinas_luar_status && (
                <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">
                  Persetujuan: {getDinasLuarStatusText(member.dinas_luar_status)}
                </span>
              )}
            </div>
          </button>
        )}

        {/* WFA Info Banner */}
        {(member.is_wfa || member.attendance_type === "wfh") && member.status !== "Belum Masuk" && (
          <button
            type="button"
            onClick={() => setSelectedTeamDetail(member)}
            className="p-2.5 bg-indigo-50/80 hover:bg-indigo-100/70 border border-indigo-200/70 rounded-xl text-xs flex items-start gap-2 text-left w-full transition cursor-pointer group"
            title="Klik untuk melihat foto bukti absensi WFA"
          >
            <Laptop size={14} className="text-indigo-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-black text-indigo-700 tracking-wider block">Absen WFA</span>
                <span className="text-[10px] text-indigo-500 font-bold group-hover:underline flex items-center gap-0.5">
                  <span>Lihat Foto Absen</span>
                  <ChevronRight size={11} />
                </span>
              </div>
              <span className="font-bold text-indigo-950 text-xs truncate block mt-0.5">
                Work From Anywhere
              </span>
            </div>
          </button>
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

        {/* View Form & Uploaded Photos Action Button */}
        {member.status !== "Belum Masuk" && (
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSelectedTeamDetail(member)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                member.is_dinas_luar || member.attendance_type === "dinas_luar"
                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {member.is_dinas_luar || member.attendance_type === "dinas_luar" ? (
                <>
                  <FileText size={13} className="text-rose-600" />
                  <span>Form Dinas Luar & Foto Absen</span>
                </>
              ) : (
                <>
                  <Camera size={13} className="text-slate-600" />
                  <span>Lihat Foto Unggahan Absen</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    ));
  };

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100 shadow-sm">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Akses Ditolak</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          Anda tidak memiliki hak akses persetujuan manajerial. Silakan hubungi Super Admin untuk mendapatkan izin akses.
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

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
              <span>Pusat Persetujuan & Monitoring</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Persetujuan & Monitoring Tim
            </h1>
            <p className="text-xs sm:text-sm text-rose-100/90 max-w-2xl leading-relaxed">
              Kelola persetujuan permohonan bawahan serta pantau presensi dan aktivitas tim secara real-time.
            </p>
          </div>

          {/* Action & Refresh Button */}
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(true)}
                className="px-4 py-2.5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm border border-rose-400/30"
                title="Hapus data riwayat transaksi dan berkas fisik lama per bulan atau per tahun"
              >
                <Trash2 size={14} />
                <span>Hapus Data Kedaluwarsa</span>
              </button>
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

      {/* Clean Date Period Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mr-1">
            <CalendarDays size={16} className="text-[#8B0000]" />
            <span>Filter Waktu:</span>
          </div>

          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setSelectedPeriod("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedPeriod === "all"
                  ? "bg-[#8B0000] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua Waktu
            </button>
            <button
              onClick={() => setSelectedPeriod("this_month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedPeriod === "this_month"
                  ? "bg-[#8B0000] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bulan Ini ({new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date())})
            </button>
            <button
              onClick={() => setSelectedPeriod("this_year")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedPeriod === "this_year"
                  ? "bg-[#8B0000] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tahun Ini ({new Date().getFullYear()})
            </button>
            <button
              onClick={() => setSelectedPeriod("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedPeriod === "custom"
                  ? "bg-[#8B0000] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Kustom
            </button>
          </div>

          {selectedPeriod === "custom" && (
            <div className="flex items-center gap-2 mt-2 sm:mt-0 animate-in fade-in">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                placeholder="Mulai"
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#8B0000]"
              />
              <span className="text-xs text-slate-400">s/d</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                placeholder="Selesai"
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#8B0000]"
              />
            </div>
          )}

          {/* Super Admin Company Selector */}
          {isSuperAdmin && companies.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <Building2 size={14} className="text-[#8B0000] shrink-0" />
              <span className="font-bold text-slate-700">Perusahaan:</span>
              <select
                value={selectedCompanyId || ""}
                onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
                className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer text-xs"
              >
                <option value="">Semua Perusahaan</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Super Admin Notice / Status Badge */}
        {isSuperAdmin && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
            <ShieldCheck size={14} className="text-amber-600 shrink-0" />
            <span>Mode Super Admin: Menampilkan seluruh pengajuan tanpa batasan hierarki</span>
          </div>
        )}
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
            <span>Monitoring Kehadiran Tim</span>
            {teamMembers.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700">
                {teamMembers.length} Anggota
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-2 sm:px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "history"
                ? "border-[#8B0000] text-[#8B0000]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <History size={16} />
            <span>Riwayat & Audit Log</span>
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

            {/* Pulang Awal (Bypass) */}
            {canApprove("early_out") && (
              <button
                onClick={() => setFilter(filter === "early_out" ? "all" : "early_out")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "early_out"
                    ? "bg-orange-50/80 border-orange-300 ring-2 ring-orange-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center">
                    <Clock size={16} />
                  </div>
                  <span className="text-base font-black text-orange-900">
                    {pendingCounts.early_out || items.filter(i => i.type === "early_out").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Pulang Awal</div>
                <div className="text-[10px] text-slate-400">Sebelum Waktu Shift</div>
              </button>
            )}

            {/* Payroll Batch */}
            {canApprove("payroll") && (
              <button
                onClick={() => setFilter(filter === "payroll" ? "all" : "payroll")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "payroll"
                    ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <DollarSign size={16} />
                  </div>
                  <span className="text-base font-black text-emerald-900">
                    {pendingCounts.payroll || items.filter(i => i.type === "payroll").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Payroll</div>
                <div className="text-[10px] text-slate-400">Batch Gaji Bulanan</div>
              </button>
            )}

            {/* Koreksi Absensi */}
            {canApprove("attendance_correction") && (
              <button
                onClick={() => setFilter(filter === "attendance_correction" ? "all" : "attendance_correction")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "attendance_correction"
                    ? "bg-cyan-50/80 border-cyan-300 ring-2 ring-cyan-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center">
                    <Clock size={16} />
                  </div>
                  <span className="text-base font-black text-cyan-900">
                    {pendingCounts.attendance_correction || items.filter(i => i.type === "attendance_correction").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Koreksi Absen</div>
                <div className="text-[10px] text-slate-400">Pengajuan Jam Absen</div>
              </button>
            )}

            {/* Dinas Luar */}
            {canApprove("dinas_luar") && (
              <button
                onClick={() => setFilter(filter === "dinas_luar" ? "all" : "dinas_luar")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "dinas_luar"
                    ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
                    <MapPin size={16} />
                  </div>
                  <span className="text-base font-black text-rose-900">
                    {pendingCounts.dinas_luar || items.filter(i => i.type === "dinas_luar").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Dinas Luar</div>
                <div className="text-[10px] text-slate-400">Tugas Luar Kantor</div>
              </button>
            )}

            {/* Absen Web */}
            {canApprove("web_attendance") && (
              <button
                onClick={() => setFilter(filter === "web_attendance" ? "all" : "web_attendance")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  filter === "web_attendance"
                    ? "bg-sky-50/80 border-sky-300 ring-2 ring-sky-500/20 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center">
                    <Laptop size={16} />
                  </div>
                  <span className="text-base font-black text-sky-900">
                    {pendingCounts.web_attendance || items.filter(i => i.type === "web_attendance").length}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">Absen Web & Manual</div>
                <div className="text-[10px] text-slate-400">Browser & Verifikasi Gagal</div>
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
              {canApprove("early_out") && (
                <button
                  onClick={() => setFilter("early_out")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "early_out"
                      ? "bg-orange-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Pulang Awal
                </button>
              )}
              {canApprove("payroll") && (
                <button
                  onClick={() => setFilter("payroll")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "payroll"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Payroll
                </button>
              )}
              {canApprove("attendance_correction") && (
                <button
                  onClick={() => setFilter("attendance_correction")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "attendance_correction"
                      ? "bg-cyan-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Koreksi Absen
                </button>
              )}
              {canApprove("web_attendance") && (
                <button
                  onClick={() => setFilter("web_attendance")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filter === "web_attendance"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Absen Web
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

      {/* TAB 2: MONITORING KEHADIRAN TIM */}
      {activeTab === "team" && (
        <div className="space-y-6">
          {/* Team Attendance Date Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Tanggal Kehadiran:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const today = getLocalDateString();
                    setTeamDate(today);
                    fetchTeamAttendance(today);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                    teamDate === getLocalDateString()
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => {
                    const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
                    setTeamDate(yesterday);
                    fetchTeamAttendance(yesterday);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                    teamDate === getLocalDateString(new Date(Date.now() - 86400000))
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Kemarin
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="team-date-picker" className="text-xs text-slate-500 font-medium">Pilih Tanggal:</label>
              <input
                id="team-date-picker"
                type="date"
                value={teamDate}
                onChange={(e) => {
                  setTeamDate(e.target.value);
                  fetchTeamAttendance(e.target.value);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#8B0000]"
              />
            </div>
          </div>

          {/* Top Summary Metrics - Interactive Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Total Tim Card */}
            <button
              type="button"
              onClick={() => setTeamStatusFilter("all")}
              className={`p-4.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
                teamStatusFilter === "all"
                  ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs text-slate-900"
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${teamStatusFilter === "all" ? "text-slate-300" : "text-slate-500"}`}>
                    Total Tim
                  </span>
                  {teamStatusFilter === "all" && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-white/20 text-white">
                      Aktif
                    </span>
                  )}
                </div>
                <div className={`text-xl font-black mt-0.5 ${teamStatusFilter === "all" ? "text-white" : "text-slate-900"}`}>
                  {teamStats.total}
                </div>
                <div className={`text-[10px] ${teamStatusFilter === "all" ? "text-slate-300" : "text-slate-400"}`}>
                  {teamStatusFilter === "all" ? "Semua karyawan" : "Karyawan terdaftar"}
                </div>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                teamStatusFilter === "all" ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"
              }`}>
                <Users size={20} />
              </div>
            </button>

            {/* Di Kantor Card */}
            <button
              type="button"
              onClick={() => setTeamStatusFilter(prev => prev === "di_kantor" ? "all" : "di_kantor")}
              className={`p-4.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
                teamStatusFilter === "di_kantor"
                  ? "bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/25 shadow-sm"
                  : "bg-white border-slate-200 hover:border-emerald-200 hover:shadow-xs text-slate-900"
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Di Kantor</span>
                  {teamStatusFilter === "di_kantor" && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-600 text-white">
                      Aktif
                    </span>
                  )}
                </div>
                <div className="text-xl font-black text-emerald-700 mt-0.5">{teamStats.diKantor}</div>
                <div className="text-[10px] text-emerald-600/80">Absen di kantor</div>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
                teamStatusFilter === "di_kantor"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-emerald-50 text-emerald-700 border-emerald-100"
              }`}>
                <Building2 size={20} />
              </div>
            </button>

            {/* Dinas Luar Card */}
            <button
              type="button"
              onClick={() => setTeamStatusFilter(prev => prev === "dinas_luar" ? "all" : "dinas_luar")}
              className={`p-4.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
                teamStatusFilter === "dinas_luar"
                  ? "bg-rose-50/90 border-rose-500 ring-2 ring-rose-500/25 shadow-sm"
                  : "bg-white border-rose-200/80 hover:border-rose-300 hover:shadow-xs bg-gradient-to-br from-rose-50/40 to-white text-slate-900"
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Dinas Luar</span>
                  {teamStatusFilter === "dinas_luar" && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white">
                      Aktif
                    </span>
                  )}
                </div>
                <div className="text-xl font-black text-rose-700 mt-0.5">{teamStats.dinasLuar}</div>
                <div className="text-[10px] text-rose-600/80">Tugas luar kantor</div>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
                teamStatusFilter === "dinas_luar"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-rose-100/70 text-rose-700 border-rose-200"
              }`}>
                <MapPin size={20} />
              </div>
            </button>

            {/* WFA Card */}
            <button
              type="button"
              onClick={() => setTeamStatusFilter(prev => prev === "wfa" ? "all" : "wfa")}
              className={`p-4.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
                teamStatusFilter === "wfa"
                  ? "bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/25 shadow-sm"
                  : "bg-white border-indigo-200/80 hover:border-indigo-300 hover:shadow-xs bg-gradient-to-br from-indigo-50/40 to-white text-slate-900"
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">WFA</span>
                  {teamStatusFilter === "wfa" && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-indigo-600 text-white">
                      Aktif
                    </span>
                  )}
                </div>
                <div className="text-xl font-black text-indigo-700 mt-0.5">{teamStats.wfa}</div>
                <div className="text-[10px] text-indigo-600/80">Work From Anywhere</div>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
                teamStatusFilter === "wfa"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-indigo-100/70 text-indigo-700 border-indigo-200"
              }`}>
                <Laptop size={20} />
              </div>
            </button>

            {/* Selesai Card */}
            <button
              type="button"
              onClick={() => setTeamStatusFilter(prev => prev === "finished" ? "all" : "finished")}
              className={`p-4.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
                teamStatusFilter === "finished"
                  ? "bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/25 shadow-sm"
                  : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-xs text-slate-900"
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Selesai</span>
                  {teamStatusFilter === "finished" && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-600 text-white">
                      Aktif
                    </span>
                  )}
                </div>
                <div className="text-xl font-black text-blue-700 mt-0.5">{teamStats.finished}</div>
                <div className="text-[10px] text-blue-600/80">Sudah check-out</div>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
                teamStatusFilter === "finished"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-blue-50 text-blue-700 border-blue-100"
              }`}>
                <CheckCircle2 size={20} />
              </div>
            </button>

            {/* Belum Masuk Card */}
            <button
              type="button"
              onClick={() => setTeamStatusFilter(prev => prev === "absent" ? "all" : "absent")}
              className={`p-4.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
                teamStatusFilter === "absent"
                  ? "bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/25 shadow-sm"
                  : "bg-white border-slate-200 hover:border-amber-200 hover:shadow-xs text-slate-900"
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Belum Masuk</span>
                  {teamStatusFilter === "absent" && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-600 text-white">
                      Aktif
                    </span>
                  )}
                </div>
                <div className="text-xl font-black text-amber-700 mt-0.5">{teamStats.absent}</div>
                <div className="text-[10px] text-amber-600/80">Belum absen</div>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
                teamStatusFilter === "absent"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-amber-50 text-amber-700 border-amber-100"
              }`}>
                <Clock size={20} />
              </div>
            </button>
          </div>

          {/* Pola Kehadiran Card Boxes (Office Hour vs Shift Hour vs Fleksibel) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Office Hour Card */}
            <button
              type="button"
              onClick={() => setPatternFilter(patternFilter === "office_hour" ? "all" : "office_hour")}
              className={`text-left w-full p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                patternFilter === "office_hour"
                  ? "bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-500/20 shadow-sm"
                  : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Office Hour</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Jam Kerja Reguler Kantor</p>
                  </div>
                </div>
                {patternFilter === "office_hour" ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                    Aktif
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">Klik Filter</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                <div className="bg-slate-50/80 rounded-xl p-2">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Total</div>
                  <div className="text-base font-black text-slate-900">{patternStats.office.total}</div>
                </div>
                <div className="bg-emerald-50/80 rounded-xl p-2">
                  <div className="text-[10px] text-emerald-600 font-bold uppercase">Hadir</div>
                  <div className="text-base font-black text-emerald-700">{patternStats.office.present}</div>
                </div>
                <div className="bg-amber-50/80 rounded-xl p-2">
                  <div className="text-[10px] text-amber-600 font-bold uppercase">Belum</div>
                  <div className="text-base font-black text-amber-700">{patternStats.office.absent}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Rasio Kehadiran</span>
                <span className="font-bold text-slate-700">
                  {patternStats.office.total > 0
                    ? Math.round((patternStats.office.present / patternStats.office.total) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      patternStats.office.total > 0
                        ? Math.round((patternStats.office.present / patternStats.office.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </button>

            {/* Shift Hour Card */}
            <button
              type="button"
              onClick={() => setPatternFilter(patternFilter === "shift" ? "all" : "shift")}
              className={`text-left w-full p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                patternFilter === "shift"
                  ? "bg-purple-50/60 border-purple-400 ring-2 ring-purple-500/20 shadow-sm"
                  : "bg-white border-slate-200 hover:border-purple-200 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Repeat size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Shift Hour</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Jadwal Jam Kerja Shift</p>
                  </div>
                </div>
                {patternFilter === "shift" ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white">
                    Aktif
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">Klik Filter</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                <div className="bg-slate-50/80 rounded-xl p-2">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Total</div>
                  <div className="text-base font-black text-slate-900">{patternStats.shift.total}</div>
                </div>
                <div className="bg-emerald-50/80 rounded-xl p-2">
                  <div className="text-[10px] text-emerald-600 font-bold uppercase">Hadir</div>
                  <div className="text-base font-black text-emerald-700">{patternStats.shift.present}</div>
                </div>
                <div className="bg-amber-50/80 rounded-xl p-2">
                  <div className="text-[10px] text-amber-600 font-bold uppercase">Belum</div>
                  <div className="text-base font-black text-amber-700">{patternStats.shift.absent}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Rasio Kehadiran</span>
                <span className="font-bold text-slate-700">
                  {patternStats.shift.total > 0
                    ? Math.round((patternStats.shift.present / patternStats.shift.total) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-purple-600 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      patternStats.shift.total > 0
                        ? Math.round((patternStats.shift.present / patternStats.shift.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </button>

            {/* Flexible Pattern Card */}
            <button
              type="button"
              onClick={() => setPatternFilter(patternFilter === "flexible" ? "all" : "flexible")}
              className={`text-left w-full p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                patternFilter === "flexible"
                  ? "bg-teal-50/60 border-teal-400 ring-2 ring-teal-500/20 shadow-sm"
                  : "bg-white border-slate-200 hover:border-teal-200 hover:shadow-xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Pola Fleksibel</h4>
                      <p className="text-[10px] text-slate-400 font-medium">Jam Kerja Bebas Mandiri</p>
                    </div>
                  </div>
                  {patternFilter === "flexible" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-600 text-white">
                      Aktif
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400">Klik Filter</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-center">
                  <div className="bg-slate-50/80 rounded-xl p-2">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Total Karyawan</div>
                    <div className="text-base font-black text-slate-900">{patternStats.flexible.total}</div>
                  </div>
                  <div className="bg-teal-50/80 rounded-xl p-2">
                    <div className="text-[10px] text-teal-700 font-bold uppercase">Sudah Check-In</div>
                    <div className="text-base font-black text-teal-700">{patternStats.flexible.present}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 p-2 rounded-xl bg-teal-50/80 border border-teal-200/60 flex items-center gap-2 text-[11px] text-teal-800 font-medium">
                <Sparkles size={13} className="text-teal-600 shrink-0" />
                <span>Bebas jam kerja, tanpa perhitungan terlambat / alpa.</span>
              </div>
            </button>
          </div>

          {/* Search bar, Active Status Indicator & Pattern Filter Pills */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari anggota tim berdasarkan nama, jabatan, atau pola..."
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {teamStatusFilter !== "all" && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                  <span className="text-[10px] uppercase text-slate-400 font-extrabold tracking-wider">Status:</span>
                  <span className={
                    (() => {
                      if (teamStatusFilter === "di_kantor") return "text-emerald-700";
                      if (teamStatusFilter === "dinas_luar") return "text-rose-700";
                      if (teamStatusFilter === "finished") return "text-blue-700";
                      return "text-amber-700";
                    })()
                  }>
                    {teamStatusFilter === "di_kantor" && "Di Kantor"}
                    {teamStatusFilter === "dinas_luar" && "Dinas Luar"}
                    {teamStatusFilter === "finished" && "Selesai"}
                    {teamStatusFilter === "absent" && "Belum Masuk"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTeamStatusFilter("all")}
                    className="ml-0.5 text-slate-400 hover:text-rose-600 transition"
                    title="Hapus filter status"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-500 mr-1">Filter Pola:</span>
                <button
                  onClick={() => setPatternFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    patternFilter === "all"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Semua ({teamMembers.length})
                </button>
                <button
                  onClick={() => setPatternFilter("office_hour")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    patternFilter === "office_hour"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Office Hour ({patternStats.office.total})
                </button>
                <button
                  onClick={() => setPatternFilter("shift")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    patternFilter === "shift"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Shift Hour ({patternStats.shift.total})
                </button>
                <button
                  onClick={() => setPatternFilter("flexible")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    patternFilter === "flexible"
                      ? "bg-teal-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Fleksibel ({patternStats.flexible.total})
                </button>
              </div>
            </div>
          </div>

          {/* Subordinate Attendance Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderTeamAttendanceContent()}
          </div>
        </div>
      )}

      {/* TAB 3: RIWAYAT & AUDIT LOG */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Sub-tab Switcher: Persetujuan vs Riwayat Absen */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              onClick={() => setHistoryTab("requests")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                historyTab === "requests"
                  ? "bg-[#8B0000] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <ClipboardList size={15} />
              <span>Riwayat Pengajuan & Persetujuan</span>
            </button>
            <button
              onClick={() => {
                setHistoryTab("attendance");
                if (attendanceHistory.length === 0) {
                  fetchAttendanceHistory(1);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                historyTab === "attendance"
                  ? "bg-[#8B0000] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <CalendarCheck size={15} />
              <span>Log Riwayat Absensi Karyawan</span>
              {attHistoryTotal > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  historyTab === "attendance" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {attHistoryTotal}
                </span>
              )}
            </button>
          </div>

          {/* SUB-TAB 1: REQUESTS AUDIT LOG */}
          {historyTab === "requests" && (
            <div className="space-y-6">
              {/* Filter Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <Filter size={14} className="text-slate-400" />
                    <span className="font-bold text-slate-600">Modul:</span>
                    <select
                      value={historyFilterType}
                      onChange={(e) => setHistoryFilterType(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="all">Semua Modul</option>
                      <option value="leave">Cuti</option>
                      <option value="permit">Izin</option>
                      <option value="overtime">Lembur</option>
                      <option value="reimbursement">Reimbursement</option>
                      <option value="fund_request">Pengajuan Dana</option>
                      <option value="attendance_correction">Koreksi Absen</option>
                      <option value="dinas_luar">Dinas Luar</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-600">Status:</span>
                    <select
                      value={historyFilterStatus}
                      onChange={(e) => setHistoryFilterStatus(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="all">Semua Status</option>
                      <option value="approved">Disetujui</option>
                      <option value="rejected">Ditolak</option>
                      <option value="edited">Diedit Pemohon</option>
                      <option value="deleted">Dihapus Pemohon/Admin</option>
                    </select>
                  </div>
                </div>

                <div className="relative w-full md:w-72">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari riwayat atau pemohon..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition-all"
                  />
                </div>
              </div>

              {/* History List */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                {loadingHistory ? (
                  <div className="p-8"><ListPageSkeleton /></div>
                ) : (() => {
                  const filtered = historyItems.filter((item) => {
                    if (!historySearchQuery.trim()) return true;
                    const q = historySearchQuery.toLowerCase();
                    return (
                      item.user_name?.toLowerCase().includes(q) ||
                      item.description?.toLowerCase().includes(q) ||
                      item.category?.toLowerCase().includes(q) ||
                      item.actor_name?.toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-16 text-center">
                        <History size={36} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-700">Belum ada riwayat aktivitas ditemukan</p>
                        <p className="text-xs text-slate-400 mt-1">Semua persetujuan, penolakan, perubahan, atau penghapusan akan tercatat di sini</p>
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4">Waktu</th>
                            <th className="py-3 px-4">Pemohon</th>
                            <th className="py-3 px-4">Kategori & Tindakan</th>
                            <th className="py-3 px-4">Deskripsi / Detail</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Diproses Oleh</th>
                            <th className="py-3 px-4">Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filtered.map((item, idx) => {
                            const isApproved = item.status === "approved";
                            const isRejected = item.status === "rejected";
                            const isDeleted = item.status === "deleted";
                            const isUpdated = item.status === "updated";

                            return (
                              <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                                  {item.created_at ? new Date(item.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "-"}
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                                  {item.user_name}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                    {item.category || item.type}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={item.description}>
                                  {item.description}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {isApproved && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 size={11} /> Disetujui
                                    </span>
                                  )}
                                  {isRejected && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                      <XCircle size={11} /> Ditolak
                                    </span>
                                  )}
                                  {isDeleted && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      <Trash2 size={11} /> Dihapus
                                    </span>
                                  )}
                                  {isUpdated && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      <Clock size={11} /> Diedit
                                    </span>
                                  )}
                                  {!isApproved && !isRejected && !isDeleted && !isUpdated && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                      {item.status}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                                  {item.actor_name || "Sistem"}
                                </td>
                                <td className="py-3 px-4 text-slate-400 italic text-[11px] max-w-xs truncate" title={item.remark || ""}>
                                  {item.remark || "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: LOG RIWAYAT ABSENSI KARYAWAN */}
          {historyTab === "attendance" && (
            <div className="space-y-6">
              {/* Attendance Filter Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <Filter size={14} className="text-slate-400" />
                    <span className="font-bold text-slate-600">Status:</span>
                    <select
                      value={attHistoryFilterStatus}
                      onChange={(e) => setAttHistoryFilterStatus(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="all">Semua Status</option>
                      <option value="present">Tepat Waktu / Hadir</option>
                      <option value="late">Terlambat</option>
                      <option value="absent">Belum Absen</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-600">Kanal / Metode:</span>
                    <select
                      value={attHistoryFilterChannel}
                      onChange={(e) => setAttHistoryFilterChannel(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="all">Semua Kanal</option>
                      <option value="web">Presensi Web (Browser)</option>
                      <option value="mobile">Aplikasi Mobile</option>
                    </select>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchAttendanceHistory(attHistoryPage)}
                    disabled={loadingAttHistory}
                    className="h-8 px-2.5 text-xs font-bold text-slate-700 rounded-xl"
                  >
                    <RefreshCw size={13} className={`mr-1 text-slate-500 ${loadingAttHistory ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                <div className="relative w-full md:w-72">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama karyawan atau email..."
                    value={attHistorySearch}
                    onChange={(e) => setAttHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition-all"
                  />
                </div>
              </div>

              {/* Attendance Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                {loadingAttHistory && (
                  <div className="p-8"><ListPageSkeleton /></div>
                )}
                {!loadingAttHistory && attendanceHistory.length === 0 && (
                  <div className="py-16 text-center">
                    <CalendarCheck size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700">Belum ada riwayat absensi pada filter ini</p>
                    <p className="text-xs text-slate-400 mt-1">Gunakan tombol filter waktu atau filter kanal di atas untuk memperluas pencarian</p>
                  </div>
                )}
                {!loadingAttHistory && attendanceHistory.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Tanggal & Jam</th>
                          <th className="py-3 px-4">Karyawan</th>
                          <th className="py-3 px-4">Pola Kehadiran</th>
                          <th className="py-3 px-4">Kanal Absen</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Lokasi & Tipe</th>
                          <th className="py-3 px-4 text-center">Bukti Selfie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendanceHistory.map((att: any, idx: number) => {
                          const checkInDate = att.check_in ? new Date(att.check_in) : null;
                          const checkOutDate = att.check_out ? new Date(att.check_out) : null;
                          const pattern = att.user?.attendance_type || "office_hour";
                          const isDinas = att.attendance_type === "dinas_luar" || Boolean(att.dinas_luar_destination);
                          const photoIn = att.check_in_photo || att.image_in_url || att.image_in;
                          const photoOut = att.check_out_photo || att.image_out_url || att.image_out;

                          return (
                            <tr key={att.id || idx} className="hover:bg-slate-50/80 transition-colors">
                              {/* Tanggal & Jam */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="font-bold text-slate-900">
                                  {checkInDate
                                    ? checkInDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
                                    : (att.date || "-")}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                  <span className="text-emerald-700 font-semibold">
                                    IN: {checkInDate ? checkInDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                                  </span>
                                  <span>•</span>
                                  <span className="text-blue-700 font-semibold">
                                    OUT: {checkOutDate ? checkOutDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                                  </span>
                                </div>
                              </td>

                              {/* Karyawan */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="font-bold text-slate-900">{att.user?.name || "Karyawan"}</div>
                                <div className="text-[11px] text-slate-400">{att.user?.role?.name || att.user?.email || "-"}</div>
                              </td>

                              {/* Pola Kehadiran */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                {renderAttendancePatternBadge(pattern)}
                              </td>

                              {/* Kanal Absen */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                {att.channel === "web" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                    <Laptop size={11} /> Presensi Web
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Smartphone size={11} /> Mobile App
                                  </span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                {renderAttendanceStatusTag(att.status)}
                              </td>

                              {/* Lokasi & Tipe */}
                              <td className="py-3 px-4 max-w-xs">
                                {isDinas ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 mb-0.5">
                                      <MapPin size={10} /> Dinas Luar
                                    </span>
                                    <p className="text-[11px] text-slate-600 truncate" title={att.dinas_luar_destination || att.check_in_address}>
                                      {att.dinas_luar_destination || att.check_in_address || "Tugas Luar Kantor"}
                                    </p>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 mb-0.5">
                                      <Building2 size={10} /> Di Kantor
                                    </span>
                                    <p className="text-[11px] text-slate-500 truncate" title={att.check_in_address || att.user?.office?.name}>
                                      {att.user?.office?.name || att.check_in_address || "Lokasi Kantor"}
                                    </p>
                                  </div>
                                )}
                              </td>

                              {/* Bukti Selfie */}
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  {photoIn ? (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImage({
                                        url: getStorageUrl(photoIn),
                                        title: `Selfie Masuk - ${att.user?.name || "Karyawan"} (${checkInDate ? checkInDate.toLocaleDateString("id-ID") : ""})`
                                      })}
                                      className="group relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 hover:border-[#8B0000] shadow-xs transition"
                                      title="Lihat Foto Masuk"
                                    >
                                      <img
                                        src={getStorageUrl(photoIn)}
                                        alt="IN"
                                        className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                                      />
                                      <span className="absolute bottom-0 right-0 bg-emerald-600 text-white text-[8px] font-black px-1 rounded-tl">IN</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-300 italic">-</span>
                                  )}

                                  {photoOut ? (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImage({
                                        url: getStorageUrl(photoOut),
                                        title: `Selfie Pulang - ${att.user?.name || "Karyawan"} (${checkOutDate ? checkOutDate.toLocaleDateString("id-ID") : ""})`
                                      })}
                                      className="group relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 hover:border-[#8B0000] shadow-xs transition"
                                      title="Lihat Foto Pulang"
                                    >
                                      <img
                                        src={getStorageUrl(photoOut)}
                                        alt="OUT"
                                        className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                                      />
                                      <span className="absolute bottom-0 right-0 bg-blue-600 text-white text-[8px] font-black px-1 rounded-tl">OUT</span>
                                    </button>
                                  ) : null}
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
                {attHistoryLastPage > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white">
                    <p className="text-xs text-slate-500 font-medium">
                      Halaman {attHistoryPage} dari {attHistoryLastPage} (Total {attHistoryTotal} Riwayat)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchAttendanceHistory(Math.max(1, attHistoryPage - 1))}
                        disabled={attHistoryPage <= 1 || loadingAttHistory}
                        className="h-8 px-3 text-xs font-bold"
                      >
                        <ChevronLeft size={14} className="mr-1" /> Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchAttendanceHistory(Math.min(attHistoryLastPage, attHistoryPage + 1))}
                        disabled={attHistoryPage >= attHistoryLastPage || loadingAttHistory}
                        className="h-8 px-3 text-xs font-bold"
                      >
                        Selanjutnya <ChevronRight size={14} className="ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TEAM ATTENDANCE & DINAS LUAR DETAIL MODAL */}
      {selectedTeamDetail && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-[#8B0000] border border-rose-100 flex items-center justify-center font-black text-sm shrink-0 overflow-hidden">
                  {selectedTeamDetail.photo_url ? (
                    <img
                      src={getStorageUrl(selectedTeamDetail.photo_url)}
                      alt={selectedTeamDetail.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    selectedTeamDetail.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    {selectedTeamDetail.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedTeamDetail.role} • {teamDate}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeamDetail(null)}
                className="p-1 hover:bg-slate-200 rounded-full transition text-slate-400 hover:text-slate-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Status & Work Pattern Badges */}
              <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipe:</span>
                  {selectedTeamDetail.is_dinas_luar || selectedTeamDetail.attendance_type === "dinas_luar" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                      <MapPin size={12} className="text-rose-600" />
                      <span>Dinas Luar</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Building2 size={12} className="text-emerald-600" />
                      <span>Di Kantor</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white text-slate-800 border border-slate-200">
                    {selectedTeamDetail.status}
                  </span>
                </div>
              </div>

              {/* Form Dinas Luar (if Dinas Luar) */}
              {(selectedTeamDetail.is_dinas_luar || selectedTeamDetail.attendance_type === "dinas_luar") && (
                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                    <FileText size={15} className="text-rose-600" />
                    <span>Formulir Keterangan Dinas Luar</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-rose-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lokasi / Destinasi</span>
                      <span className="font-bold text-slate-900 mt-0.5 block">
                        {selectedTeamDetail.dinas_luar_destination || "Tugas Luar Kantor"}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-rose-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Persetujuan Manajerial</span>
                      <span className="font-bold text-rose-700 mt-0.5 block">
                        {getDinasLuarStatusText(selectedTeamDetail.dinas_luar_status)}
                      </span>
                    </div>
                  </div>

                  {selectedTeamDetail.dinas_luar_notes && (
                    <div className="bg-white p-3 rounded-xl border border-rose-100 text-xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Catatan / Alasan Tugas</span>
                      <p className="text-slate-700 mt-1 leading-relaxed">
                        {selectedTeamDetail.dinas_luar_notes}
                      </p>
                    </div>
                  )}

                  {/* GPS Coordinates & Google Maps Link */}
                  {(selectedTeamDetail.latitude_in && selectedTeamDetail.longitude_in) && (
                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-rose-100 text-xs">
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin size={14} className="text-rose-600 shrink-0" />
                        <span className="font-mono text-[11px]">
                          {Number(selectedTeamDetail.latitude_in).toFixed(5)}, {Number(selectedTeamDetail.longitude_in).toFixed(5)}
                        </span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedTeamDetail.latitude_in},${selectedTeamDetail.longitude_in}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-800 underline"
                      >
                        <span>Lihat Maps</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Attendance Times Summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Waktu Masuk</span>
                  <span className="text-sm font-black text-slate-800 mt-0.5 block">
                    {(() => {
                      if (selectedTeamDetail.check_in_full) {
                        return new Date(selectedTeamDetail.check_in_full).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
                      }
                      if (selectedTeamDetail.check_in) {
                        return selectedTeamDetail.check_in + " WIB";
                      }
                      return "-- : --";
                    })()}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Waktu Pulang</span>
                  <span className="text-sm font-black text-slate-800 mt-0.5 block">
                    {(() => {
                      if (selectedTeamDetail.check_out_full) {
                        return new Date(selectedTeamDetail.check_out_full).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
                      }
                      if (selectedTeamDetail.check_out) {
                        return selectedTeamDetail.check_out + " WIB";
                      }
                      return "Belum Check-Out";
                    })()}
                  </span>
                </div>
              </div>

              {/* Foto Unggahan Saat Absen */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                  <Camera size={15} className="text-[#8B0000]" />
                  <span>Foto Unggahan Saat Absen</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Foto Check-in */}
                  <div className="rounded-2xl border border-slate-200 p-3 bg-slate-50 flex flex-col items-center">
                    <span className="text-[11px] font-bold text-slate-600 mb-2">Foto Selfie Check-In</span>
                    {selectedTeamDetail.image_in_url || selectedTeamDetail.image_in ? (
                      <button
                        type="button"
                        aria-label="Perbesar Foto Masuk"
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white aspect-[4/3] w-full flex items-center justify-center p-0 text-left"
                        onClick={() => {
                          const url = selectedTeamDetail.image_in_url || getStorageUrl(selectedTeamDetail.image_in || "");
                          setPreviewImage({ url, title: `Foto Masuk: ${selectedTeamDetail.name}` });
                        }}
                      >
                        <img
                          src={selectedTeamDetail.image_in_url || getStorageUrl(selectedTeamDetail.image_in || "")}
                          alt="Foto Check In"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://placehold.co/400x300?text=Foto+Masuk";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                          <Eye size={16} />
                          <span>Perbesar</span>
                        </div>
                      </button>
                    ) : (
                      <div className="w-full aspect-[4/3] rounded-xl border border-dashed border-slate-200 bg-white flex flex-col items-center justify-center text-slate-300 p-4 text-center">
                        <Camera size={24} className="mb-1" />
                        <span className="text-[10px]">Tidak ada foto masuk</span>
                      </div>
                    )}
                  </div>

                  {/* Foto Check-out */}
                  <div className="rounded-2xl border border-slate-200 p-3 bg-slate-50 flex flex-col items-center">
                    <span className="text-[11px] font-bold text-slate-600 mb-2">Foto Selfie Check-Out</span>
                    {selectedTeamDetail.image_out_url || selectedTeamDetail.image_out ? (
                      <button
                        type="button"
                        aria-label="Perbesar Foto Pulang"
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white aspect-[4/3] w-full flex items-center justify-center p-0 text-left"
                        onClick={() => {
                          const url = selectedTeamDetail.image_out_url || getStorageUrl(selectedTeamDetail.image_out || "");
                          setPreviewImage({ url, title: `Foto Pulang: ${selectedTeamDetail.name}` });
                        }}
                      >
                        <img
                          src={selectedTeamDetail.image_out_url || getStorageUrl(selectedTeamDetail.image_out || "")}
                          alt="Foto Check Out"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://placehold.co/400x300?text=Foto+Pulang";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                          <Eye size={16} />
                          <span>Perbesar</span>
                        </div>
                      </button>
                    ) : (
                      <div className="w-full aspect-[4/3] rounded-xl border border-dashed border-slate-200 bg-white flex flex-col items-center justify-center text-slate-300 p-4 text-center">
                        <Camera size={24} className="mb-1" />
                        <span className="text-[10px]">
                          {selectedTeamDetail.check_out ? "Tidak ada foto pulang" : "Belum check-out"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTeamDetail(null)}
                className="text-xs font-bold px-5"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PREVIEW MODAL */}
      {previewImage && (
        <div className="fixed inset-0 z-130 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-800 truncate mr-2">{previewImage.title}</h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 hover:bg-slate-200 rounded-full transition text-slate-400 hover:text-slate-600"
              >
                <XCircle size={18} />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-900/5 min-h-[320px]">
              <img
                src={previewImage.url}
                alt="Preview"
                className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://placehold.co/600x400?text=Foto+Gagal+Dimuat";
                }}
              />
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewImage(null)}
                className="text-xs font-bold px-4"
              >
                Tutup
              </Button>
            </div>
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

      {/* MODAL PEMBERSIHAN DATA KEDALUWARSA (SUPER ADMIN ONLY) */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-rose-100 bg-rose-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Hapus Data Kedaluwarsa</h3>
                  <p className="text-[11px] text-rose-700 font-medium">Pembersihan Transaksi & Berkas Fisik Server</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                disabled={isPurging}
                className="p-1 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Peringatan Keamanan:</p>
                  <p className="mt-0.5 text-amber-800">
                    Fitur ini akan menghapus riwayat transaksi pengajuan dan <strong>menghapus berkas fisik/lampiran di storage server</strong> pada bulan/tahun yang dipilih agar kapasitas server tetap hemat.
                  </p>
                </div>
              </div>

              {/* Scope Selection: Per Bulan vs Per Tahun vs Semua Waktu */}
              <div>
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Tipe Rentang Waktu yang Dihapus:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPurgeType("month")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      purgeType === "month"
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Per Bulan
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurgeType("year")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      purgeType === "year"
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Satu Tahun Penuh
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurgeType("all")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      purgeType === "all"
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Semua Waktu
                  </button>
                </div>
              </div>

              {/* Month & Year Selectors */}
              {purgeType === "month" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="purge-month-select" className="block text-xs font-bold text-slate-600 mb-1">Pilih Bulan</label>
                    <select
                      id="purge-month-select"
                      value={purgeMonth}
                      onChange={(e) => setPurgeMonth(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                    >
                      <option value="01">Januari</option>
                      <option value="02">Februari</option>
                      <option value="03">Maret</option>
                      <option value="04">April</option>
                      <option value="05">Mei</option>
                      <option value="06">Juni</option>
                      <option value="07">Juli</option>
                      <option value="08">Agustus</option>
                      <option value="09">September</option>
                      <option value="10">Oktober</option>
                      <option value="11">November</option>
                      <option value="12">Desember</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="purge-year-month-select" className="block text-xs font-bold text-slate-600 mb-1">Pilih Tahun</label>
                    <select
                      id="purge-year-month-select"
                      value={purgeYear}
                      onChange={(e) => setPurgeYear(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                    >
                      {[2023, 2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {purgeType === "year" && (
                <div>
                  <label htmlFor="purge-year-select" className="block text-xs font-bold text-slate-600 mb-1">Pilih Tahun yang Dihapus Seluruhnya</label>
                  <select
                    id="purge-year-select"
                    value={purgeYear}
                    onChange={(e) => setPurgeYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                  >
                    {[2023, 2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>Semua Data Tahun {y}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Module selection */}
              <div>
                <label htmlFor="purge-module-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kategori Modul yang Dihapus:
                </label>
                <select
                  id="purge-module-select"
                  value={purgeModule}
                  onChange={(e) => setPurgeModule(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                >
                  <option value="all">Semua Modul & Transaksi (Cuti, Lembur, Reimburse, Dana, Absen, Payroll)</option>
                  <option value="leaves">Hanya Pengajuan Cuti & Lampiran</option>
                  <option value="permits">Hanya Pengajuan Izin & Surat Dokter</option>
                  <option value="overtimes">Hanya Pengajuan Lembur</option>
                  <option value="reimbursements">Hanya Klaim Biaya (Reimbursement) & Struk</option>
                  <option value="fund_requests">Hanya Pengajuan Dana & Bukti Pengeluaran</option>
                  <option value="attendance_corrections">Hanya Koreksi Absensi</option>
                  <option value="attendances">Hanya Data Log Absensi</option>
                  <option value="payroll">Hanya Riwayat Rekap Payroll</option>
                </select>
              </div>

              {/* Confirmation input */}
              <div>
                <label htmlFor="purge-confirmation-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Konfirmasi Tindakan Permanen
                </label>
                <p className="text-[11px] text-slate-500 mb-1.5">
                  Ketik kata <span className="font-mono font-bold text-rose-600">HAPUS</span> di bawah untuk membuka tombol konfirmasi:
                </p>
                <input
                  id="purge-confirmation-input"
                  type="text"
                  placeholder="Ketik HAPUS..."
                  value={purgeConfirmation}
                  onChange={(e) => setPurgeConfirmation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 uppercase"
                />
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-200 flex gap-3">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                disabled={isPurging}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={isPurging || purgeConfirmation.trim().toUpperCase() !== "HAPUS"}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isPurging ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Membersihkan...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Konfirmasi Hapus Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
