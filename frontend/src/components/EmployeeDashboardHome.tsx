"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  Laptop,
  CreditCard,
  ClipboardList,
  Wallet,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Car,
  Repeat,
  FileText,
  Bell,
  User as UserIcon,
  Building2,
  Sparkles,
  CalendarCheck,
  CheckSquare
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import axiosInstance from "@/lib/axios";
import WebAttendanceModal from "@/components/WebAttendanceModal";

interface EmployeeUser {
  id?: number | string;
  name?: string;
  email?: string;
  nik?: string;
  basic_salary?: number;
  profile_photo_url?: string;
  attendance_type?: string;
  today_shift?: unknown;
  schedule_label?: string;
  work_start_time?: string;
  work_end_time?: string;
  role?: { id?: number; name?: string };
  office?: { id?: number; name?: string };
  leave_balance?: number;
  is_web_auto_validated?: boolean;
}

interface TodayAttendanceData {
  check_in?: boolean | string;
  checkIn?: string;
  check_out?: boolean | string;
  checkOut?: string;
  check_in_time?: string;
  check_out_time?: string;
  date?: string;
  web_approval_status?: string;
  work_duration?: string;
  notes?: string;
  channel?: string;
  is_web_attendance?: boolean;
}

interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  created_at: string;
  user?: { name: string };
}

interface TaskItem {
  id: number;
  title: string;
  status: string;
}

interface SalaryItem {
  id: number;
  period: string;
  net_salary: number;
}

interface ReimbursementItem {
  id: number;
  amount: number | string;
  status: string;
}

interface EmployeeDashboardHomeProps {
  readonly onSwitchToAdmin?: () => void;
  readonly canSwitchToAdmin?: boolean;
}

const formatRupiah = (val: number | string) => {
  const num = Number(val) || 0;
  return "Rp " + num.toLocaleString("id-ID");
};

function renderAttendanceStatusBadge(loadingAttendance: boolean, isCheckedIn: boolean, isCheckedOut: boolean) {
  if (loadingAttendance) {
    return <span className="text-slate-400 text-xs">Memeriksa...</span>;
  }
  if (!isCheckedIn) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
        <span>Belum Absen</span>
      </span>
    );
  }
  if (isCheckedOut) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
        <CheckCircle2 size={12} />
        <span>Selesai Kerja</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span>Sedang Bekerja</span>
    </span>
  );
}

function renderWebApprovalStatusBadge(webApprovalStatus?: string) {
  if (webApprovalStatus === "valid") {
    return (
      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
        <CheckCircle2 size={10} /> Valid Otomatis
      </span>
    );
  }
  if (webApprovalStatus === "pending") {
    return (
      <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5">
        <Clock size={10} /> Menunggu Verifikasi
      </span>
    );
  }
  return null;
}

function getScheduleDisplayLabel(user: EmployeeUser | null): string {
  if (user?.attendance_type === "shift" && (!user?.today_shift && (!user?.schedule_label || user?.schedule_label === "Tidak Ada Shift"))) {
    return "Tidak Ada Shift";
  }
  if (user?.schedule_label) {
    return user.schedule_label;
  }
  if (user?.work_start_time) {
    return `${user.work_start_time} - ${user.work_end_time} WIB`;
  }
  return "08:30 - 17:30 WIB";
}

function renderAttendanceActionButton(
  isCheckedIn: boolean,
  isCheckedOut: boolean,
  onOpenAttendance: (type: "in" | "out") => void
) {
  if (!isCheckedIn) {
    return (
      <button
        type="button"
        onClick={() => onOpenAttendance("in")}
        className="w-full py-3.5 bg-gradient-to-r from-[#8B0000] via-[#a00000] to-[#700000] hover:from-[#a00000] hover:to-[#5a0000] text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/15 transition-all flex items-center justify-center gap-2 active:scale-98 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30"
      >
        <Laptop size={16} />
        <span>Absen Masuk via Web</span>
      </button>
    );
  }
  if (!isCheckedOut) {
    return (
      <button
        type="button"
        onClick={() => onOpenAttendance("out")}
        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/15 transition-all flex items-center justify-center gap-2 active:scale-98 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
      >
        <CheckCircle2 size={16} />
        <span>Absen Pulang via Web</span>
      </button>
    );
  }
  return (
    <div className="text-center py-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center justify-center gap-2">
      <CheckCircle2 size={16} className="text-emerald-600" />
      <span>Presensi Hari Ini Telah Lengkap</span>
    </div>
  );
}

interface EmployeeWebAttendanceCardProps {
  readonly user: EmployeeUser | null;
  readonly todayAttendance: TodayAttendanceData | null;
  readonly loadingAttendance: boolean;
  readonly onOpenAttendance: (type: "in" | "out") => void;
}

function EmployeeWebAttendanceCard({
  user,
  todayAttendance,
  loadingAttendance,
  onOpenAttendance,
}: EmployeeWebAttendanceCardProps) {
  const isCheckedIn = Boolean(todayAttendance?.check_in || todayAttendance?.checkIn);
  const isCheckedOut = Boolean(todayAttendance?.check_out || todayAttendance?.checkOut);
  const checkInTime = todayAttendance?.check_in_time || todayAttendance?.checkIn;
  const checkOutTime = todayAttendance?.check_out_time || todayAttendance?.checkOut;
  const webApprovalStatus = todayAttendance?.web_approval_status;
  const isWebRecord = todayAttendance?.channel === "web" || todayAttendance?.is_web_attendance;

  return (
    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between space-y-4">
      <div className="space-y-4">
        {/* Header Title & Channel Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#8B0000] flex items-center justify-center border border-rose-100 shrink-0">
              <Laptop size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-snug">
                Presensi via Web
              </h2>
              <p className="text-[11px] text-slate-500">
                Pencatatan Kehadiran Browser
              </p>
            </div>
          </div>

          {user?.is_web_auto_validated ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck size={12} className="text-emerald-600" />
              <span>Auto-Valid</span>
            </span>
          ) : (
            <span 
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
              title="Absensi web memerlukan persetujuan Super Admin"
            >
              <Clock size={12} className="text-amber-600" />
              <span>Verifikasi Admin</span>
            </span>
          )}
        </div>

        {/* Status Box */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Status Kehadiran:</span>
            {renderAttendanceStatusBadge(loadingAttendance, isCheckedIn, isCheckedOut)}
          </div>

          <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-200">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Clock size={12} className="text-slate-400" />
              <span>Jadwal Shift:</span>
            </span>
            <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
              {getScheduleDisplayLabel(user)}
            </span>
          </div>

          {/* Times Grid */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Jam Masuk</div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {checkInTime ? checkInTime.substring(0, 5) + " WIB" : "-- : --"}
              </div>
              {isWebRecord && checkInTime && (
                <div className="mt-1">
                  {renderWebApprovalStatusBadge(webApprovalStatus)}
                </div>
              )}
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Jam Pulang</div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {checkOutTime ? checkOutTime.substring(0, 5) + " WIB" : "-- : --"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button & Note */}
      <div className="space-y-2 pt-1">
        {renderAttendanceActionButton(isCheckedIn, isCheckedOut, onOpenAttendance)}
        <p className="text-[11px] text-center text-slate-400 font-medium">
          Absen web memerlukan satu foto selfie via kamera browser/laptop.
        </p>
      </div>
    </div>
  );
}

export default function EmployeeDashboardHome({
  onSwitchToAdmin,
  canSwitchToAdmin = false,
}: EmployeeDashboardHomeProps) {
  const { user, isManager, hasPermission } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendanceData | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(true);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [attendanceModalType, setAttendanceModalType] = useState<"in" | "out">("in");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [greeting, setGreeting] = useState<string>("Selamat Datang");
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [activeTasksCount, setActiveTasksCount] = useState<number>(0);
  const [latestSalary, setLatestSalary] = useState<SalaryItem | null>(null);
  const [managerPendingTotal, setManagerPendingTotal] = useState<number>(0);
  const [reimbursementStats, setReimbursementStats] = useState<{ pendingCount: number; totalPending: number }>({
    pendingCount: 0,
    totalPending: 0,
  });

  // Realtime clock and greeting
  useEffect(() => {
    const updateTimeAndGreeting = () => {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 4 && hour < 11) setGreeting("Selamat Pagi");
      else if (hour >= 11 && hour < 15) setGreeting("Selamat Siang");
      else if (hour >= 15 && hour < 18) setGreeting("Selamat Sore");
      else setGreeting("Selamat Malam");

      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WIB"
      );

      setCurrentDate(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        })
      );
    };

    updateTimeAndGreeting();
    const timer = setInterval(updateTimeAndGreeting, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's attendance
  const fetchTodayAttendance = useCallback(async () => {
    try {
      setLoadingAttendance(true);
      const res = await axiosInstance.get("/attendance/today");
      setTodayAttendance(res.data?.data || null);
    } catch (e) {
      console.warn("Failed to fetch today attendance:", e);
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  // Fetch summary data
  const fetchSummaryData = useCallback(async () => {
    try {
      const annRes = await axiosInstance.get("/announcements");
      const annData = annRes.data?.data?.data || annRes.data?.data || [];
      setAnnouncements(annData.slice(0, 3));
    } catch (e) {
      console.warn("Failed to fetch announcements:", e);
    }

    try {
      const taskRes = await axiosInstance.get("/tasks");
      const tasks: TaskItem[] = taskRes.data?.data?.data || taskRes.data?.data || [];
      const pendingTasks = tasks.filter((t: TaskItem) => t.status !== "completed");
      setActiveTasksCount(pendingTasks.length);
    } catch (e) {
      console.warn("Failed to fetch tasks:", e);
    }

    try {
      const salRes = await axiosInstance.get("/salaries");
      const salaries = salRes.data?.data?.data || salRes.data?.data || [];
      if (salaries.length > 0) {
        setLatestSalary(salaries[0]);
      }
    } catch (e) {
      console.warn("Failed to fetch salaries:", e);
    }

    try {
      const remRes = await axiosInstance.get("/reimbursements");
      const rems: ReimbursementItem[] = remRes.data?.data?.data || remRes.data?.data || [];
      const pendings = rems.filter((r: ReimbursementItem) => r.status === "pending");
      const totalAmount = pendings.reduce((sum: number, r: ReimbursementItem) => sum + (Number(r.amount) || 0), 0);
      setReimbursementStats({
        pendingCount: pendings.length,
        totalPending: totalAmount,
      });
    } catch (e) {
      console.warn("Failed to fetch reimbursements:", e);
    }

    if (isManager) {
      try {
        const mgrRes = await axiosInstance.get("/manager/pending-count");
        if (mgrRes.data?.data) {
          setManagerPendingTotal(Number(mgrRes.data.data.total) || 0);
        }
      } catch (e) {
        console.warn("Failed to fetch manager pending count:", e);
      }
    }
  }, [isManager]);

  useEffect(() => {
    fetchTodayAttendance();
    fetchSummaryData();
  }, [fetchTodayAttendance, fetchSummaryData]);

  const handleOpenAttendance = (type: "in" | "out") => {
    setAttendanceModalType(type);
    setIsAttendanceModalOpen(true);
  };

  const handleAttendanceSuccess = () => {
    fetchTodayAttendance();
  };

  // Weekly days progress tracker (Monday to Sunday)
  const currentWeekDays = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);

    const days = [];
    const dayNames = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.toDateString() === now.toDateString();
      const isPast = d < now && !isToday;
      const isFuture = d > now && !isToday;

      days.push({
        name: dayNames[i],
        date: d.getDate(),
        fullDate: d.toISOString().split("T")[0],
        isToday,
        isPast,
        isFuture,
      });
    }
    return days;
  }, []);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* 1. TOP WELCOME BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#8B0000] via-[#750000] to-[#500000] p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 p-1 border-2 border-white/20 shadow-inner flex items-center justify-center overflow-hidden">
                {user?.profile_photo_url ? (
                  <Image
                    src={user.profile_photo_url}
                    alt={user.name || "Karyawan"}
                    width={80}
                    height={80}
                    unoptimized
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <UserIcon size={36} className="text-white/80" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#8B0000] rounded-full shadow-sm" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-bold text-rose-100 backdrop-blur-md">
                <Building2 size={12} />
                <span>{user?.office?.name || "Kantor Pusat"}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {greeting}, {user?.name || "Karyawan"}!
              </h1>
              <p className="text-xs text-rose-100/90 font-medium">
                {user?.role?.name || "Staff Karyawan"} • NIK: {(user as EmployeeUser)?.nik || "-"}
              </p>
            </div>
          </div>

          {/* Right Side: Clock & Admin Switcher if available */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="bg-black/25 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 text-left sm:text-right">
              <div className="text-[11px] text-rose-200 font-bold uppercase tracking-wider flex items-center gap-1 sm:justify-end">
                <Clock size={12} />
                <span>{currentDate || "Waktu Sistem"}</span>
              </div>
              <div className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                {currentTime}
              </div>
            </div>

            {canSwitchToAdmin && onSwitchToAdmin && (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 shrink-0 active:scale-98"
              >
                <Laptop size={14} className="text-[#8B0000]" />
                <span>Beralih ke Portal Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 h-52 w-52 rounded-full bg-white/5 blur-2xl pointer-events-none" />
      </div>

      {/* 2. MANAGER / APPROVER HUB BANNER (if user has approval role) */}
      {isManager && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 p-5 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-amber-400/30 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3.5 z-10">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
              <ShieldCheck size={26} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-md">
                  Portal Manager & Approver
                </span>
                {managerPendingTotal > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-white text-rose-700 text-xs font-black animate-pulse shadow-sm">
                    {managerPendingTotal} Menunggu Review
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-1">
                Pusat Persetujuan & Monitoring Tim
              </h2>
              <p className="text-xs text-amber-100">
                {managerPendingTotal > 0 
                  ? `Ada ${managerPendingTotal} permohonan bawahan/tim yang memerlukan respon persetujuan Anda.`
                  : "Semua permohonan tim Anda saat ini telah ditinjau."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 z-10 shrink-0">
            <Link
              href="/dashboard/approvals"
              className="w-full sm:w-auto px-5 py-2.5 bg-white text-rose-800 hover:bg-amber-50 rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 group"
            >
              <span>Buka Pusat Persetujuan</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/10 blur-2xl pointer-events-none" />
        </div>
      )}

      {/* 3. PRIMARY ROW: WEB ATTENDANCE (5 COLS) & 4 PERSONAL KPIS (7 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Web Attendance Card */}
        <EmployeeWebAttendanceCard
          user={user}
          todayAttendance={todayAttendance}
          loadingAttendance={loadingAttendance}
          onOpenAttendance={handleOpenAttendance}
        />

        {/* Right: Personal Metric Cards (4 Cards) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Card 1: Gaji & Penggajian */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Gaji & Penggajian
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <CreditCard size={16} />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                {latestSalary?.net_salary
                  ? formatRupiah(latestSalary.net_salary)
                  : formatRupiah((user as EmployeeUser)?.basic_salary || 0)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {latestSalary?.period
                  ? `Slip Periode ${latestSalary.period}`
                  : "Estimasi Take Home Pay Bulan Ini"}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-semibold">
              <Link
                href="/dashboard/payroll"
                className="text-[#8B0000] hover:text-[#b30000] flex items-center gap-1 font-bold"
              >
                <span>Lihat Rincian Slip</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 2: Sisa Saldo Cuti */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Sisa Saldo Cuti
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                  <CalendarCheck size={16} />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                {user?.leave_balance ?? 12} Hari
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Cuti Kemnaker: {user?.kemnaker_leave_balance ?? 0} Hari
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-semibold">
              <Link
                href="/dashboard/leaves"
                className="text-[#8B0000] hover:text-[#b30000] flex items-center gap-1 font-bold"
              >
                <span>Ajukan Cuti Baru</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 3: Tugas Aktif */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Tugas & Target Aktif
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                  <ClipboardList size={16} />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                {activeTasksCount} Tugas
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {activeTasksCount > 0 ? "Perlu diselesaikan" : "Semua tugas telah beres"}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-semibold">
              <Link
                href="/dashboard/tasks"
                className="text-[#8B0000] hover:text-[#b30000] flex items-center gap-1 font-bold"
              >
                <span>Buka Lembar Tugas</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 4: Klaim & Kasbon Pending */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Klaim & Kasbon
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
                  <Wallet size={16} />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                {reimbursementStats.pendingCount} Pengajuan
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Total: {formatRupiah(reimbursementStats.totalPending)}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-semibold">
              <Link
                href="/dashboard/reimbursements"
                className="text-[#8B0000] hover:text-[#b30000] flex items-center gap-1 font-bold"
              >
                <span>Status Klaim Biaya</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* 4. WEEKLY ATTENDANCE RHYTHM (Status Kehadiran Minggu Ini) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
              Ritme Kehadiran Minggu Ini
            </h2>
            <p className="text-xs text-slate-500">
              Pantau kepatuhan jam kerja harian Anda pada periode minggu ini.
            </p>
          </div>
          <Link
            href="/dashboard/attendance"
            className="text-xs font-bold text-[#8B0000] hover:underline flex items-center gap-1"
          >
            <span>Riwayat Lengkap</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {currentWeekDays.map((day) => {
            const isToday = day.isToday;
            const isCheckedInToday = isToday && (todayAttendance?.check_in || todayAttendance?.checkIn);

            let cardBgClass = "bg-white border-slate-100 opacity-60";
            if (isToday) {
              cardBgClass = "bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 shadow-xs";
            } else if (day.isPast) {
              cardBgClass = "bg-slate-50 border-slate-200";
            }

            let statusIndicator: React.ReactNode;
            if (isToday) {
              if (isCheckedInToday) {
                statusIndicator = <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Hadir hari ini" />;
              } else {
                statusIndicator = <span className="inline-block w-2 h-2 rounded-full bg-rose-400" title="Belum absen hari ini" />;
              }
            } else if (day.isPast) {
              statusIndicator = <span className="inline-block w-2 h-2 rounded-full bg-slate-400" title="Hari berlalu" />;
            } else {
              statusIndicator = <span className="inline-block w-2 h-2 rounded-full bg-slate-200" title="Mendatang" />;
            }

            return (
              <div
                key={day.fullDate}
                className={`p-3 rounded-xl border text-center transition-all ${cardBgClass}`}
              >
                <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-[#8B0000]" : "text-slate-400"}`}>
                  {day.name}
                </div>
                <div className={`text-base font-black mt-1 ${isToday ? "text-[#8B0000]" : "text-slate-800"}`}>
                  {day.date}
                </div>
                <div className="mt-1.5">
                  {statusIndicator}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. LAYANAN & AKSI CEPAT MANDIRI (9 TILES GRID) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={16} className="text-[#8B0000]" />
            Layanan & Aksi Cepat Mandiri
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">Pusat Pengajuan Online</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
          {[
            {
              name: "Ajukan Cuti",
              href: "/dashboard/leaves",
              icon: CalendarCheck,
              bgColor: "bg-blue-50",
              textColor: "text-blue-700",
              borderColor: "border-blue-100 hover:border-blue-300",
              permission: "view-leaves"
            },
            {
              name: "Ajukan Izin",
              href: "/dashboard/permits",
              icon: ClipboardList,
              bgColor: "bg-purple-50",
              textColor: "text-purple-700",
              borderColor: "border-purple-100 hover:border-purple-300",
              permission: "view-permits"
            },
            {
              name: "Klaim Biaya",
              href: "/dashboard/reimbursements",
              icon: CreditCard,
              bgColor: "bg-emerald-50",
              textColor: "text-emerald-700",
              borderColor: "border-emerald-100 hover:border-emerald-300",
              permission: "view-reimbursements"
            },
            {
              name: "Ajukan Dana",
              href: "/dashboard/fund-requests",
              icon: Wallet,
              bgColor: "bg-teal-50",
              textColor: "text-teal-700",
              borderColor: "border-teal-100 hover:border-teal-300",
              permission: "view-fund-requests"
            },
            {
              name: "Lembur",
              href: "/dashboard/overtimes",
              icon: Clock,
              bgColor: "bg-amber-50",
              textColor: "text-amber-700",
              borderColor: "border-amber-100 hover:border-amber-300",
              permission: "view-overtimes"
            },
            {
              name: "Koreksi Absen",
              href: "/dashboard/attendance-corrections",
              icon: CheckSquare,
              bgColor: "bg-cyan-50",
              textColor: "text-cyan-700",
              borderColor: "border-cyan-100 hover:border-cyan-300",
            },
            {
              name: "Tukar Shift",
              href: "/dashboard/shift-swap",
              icon: Repeat,
              bgColor: "bg-indigo-50",
              textColor: "text-indigo-700",
              borderColor: "border-indigo-100 hover:border-indigo-300",
              permission: "view-shift-swaps"
            },
            {
              name: "Log Armada",
              href: "/dashboard/fleet-logs",
              icon: Car,
              bgColor: "bg-slate-100",
              textColor: "text-slate-800",
              borderColor: "border-slate-200 hover:border-slate-400",
              permission: "view-vehicle-logs"
            },
            {
              name: "Pusat Bantuan",
              href: "/dashboard/help-center",
              icon: HelpCircle,
              bgColor: "bg-rose-50",
              textColor: "text-[#8B0000]",
              borderColor: "border-rose-100 hover:border-rose-300",
            },
          ]
            .filter((action) => action.permission ? hasPermission(action.permission) : true)
            .map((action) => {
              const ActionIcon = action.icon;
              return (
                <Link
                  key={action.name}
                  href={action.href}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl bg-white border ${action.borderColor} transition-all group text-center hover:shadow-xs`}
                >
                  <div className={`w-10 h-10 rounded-xl ${action.bgColor} ${action.textColor} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                    <ActionIcon size={18} />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900 leading-tight">
                    {action.name}
                  </span>
                </Link>
              );
            })}
        </div>
      </div>

      {/* 6. BOTTOM ROW: ANNOUNCEMENTS & COMPANY DOCUMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Announcements */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Bell size={16} className="text-[#8B0000]" />
                Pengumuman & Informasi Terbaru
              </h2>
              <Link
                href="/dashboard/announcements"
                className="text-xs font-bold text-[#8B0000] hover:underline"
              >
                Lihat Semua
              </Link>
            </div>

            <div className="space-y-3">
              {announcements.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                  <Bell size={24} className="mx-auto mb-1 opacity-40" />
                  <p className="font-semibold">Belum ada pengumuman terbaru.</p>
                </div>
              ) : (
                announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-bold text-slate-700">
                        {ann.user?.name || "Manajemen"}
                      </span>
                      <span>
                        {ann.created_at
                          ? new Date(ann.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : ""}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">{ann.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            href="/dashboard/announcements"
            className="pt-2 text-[11px] font-bold text-[#8B0000] hover:underline text-center border-t border-slate-100 block"
          >
            Buka Arsip Pengumuman Lengkap →
          </Link>
        </div>

        {/* Company Regulations & Quick Documents */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText size={16} className="text-[#8B0000]" />
                Dokumen & Panduan Staf
              </h2>
              <Link
                href="/dashboard/documents"
                className="text-xs font-bold text-[#8B0000] hover:underline"
              >
                Lihat Semua
              </Link>
            </div>

            <div className="space-y-2.5 text-xs">
              <Link
                href="/dashboard/documents"
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 group-hover:text-slate-900 block">
                      Standar Operasional Prosedur (SOP) Lapangan
                    </span>
                    <span className="text-[10px] text-slate-400">Prosedur resmi operasional kantor & proyek</span>
                  </div>
                </div>
                <ArrowRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/documents"
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 group-hover:text-slate-900 block">
                      Peraturan Perusahaan & Kode Etik
                    </span>
                    <span className="text-[10px] text-slate-400">Hak dan kewajiban ketenagakerjaan</span>
                  </div>
                </div>
                <ArrowRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/help-center"
                className="flex items-center justify-between p-3 bg-rose-50/50 hover:bg-rose-50 rounded-xl border border-rose-100 transition-colors group text-[#8B0000]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-[#8B0000] flex items-center justify-center shrink-0">
                    <HelpCircle size={16} />
                  </div>
                  <div>
                    <span className="font-bold block">
                      Pusat Bantuan & Panduan FAQ Absensi
                    </span>
                    <span className="text-[10px] text-rose-600/80">Solusi kendala absensi dan perizinan</span>
                  </div>
                </div>
                <ArrowRight size={13} className="text-[#8B0000] group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 text-center border-t border-slate-100">
            Hubungi tim HR jika Anda membutuhkan dokumen personal tambahan
          </div>
        </div>

      </div>

      {/* Web Attendance Modal */}
      <WebAttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        onSuccess={handleAttendanceSuccess}
        defaultType={attendanceModalType}
        isAutoValidated={Boolean(user?.is_web_auto_validated)}
      />
    </div>
  );
}
