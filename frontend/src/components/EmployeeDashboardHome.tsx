"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  CalendarCheck
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import axiosInstance from "@/lib/axios";
import WebAttendanceModal from "@/components/WebAttendanceModal";

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
    return <span className="text-slate-400">Memeriksa...</span>;
  }
  if (!isCheckedIn) {
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[11px]">
        Belum Absen
      </span>
    );
  }
  if (isCheckedOut) {
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1">
        <CheckCircle2 size={12} />
        Selesai Kerja
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px] flex items-center gap-1">
      <Clock size={12} />
      Sedang Bekerja
    </span>
  );
}

function renderWebApprovalStatusBadge(webApprovalStatus?: string) {
  if (webApprovalStatus === "valid") {
    return (
      <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
        <CheckCircle2 size={10} /> Valid (Otomatis)
      </span>
    );
  }
  if (webApprovalStatus === "pending") {
    return (
      <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
        <Clock size={10} /> Menunggu Verifikasi Super Admin
      </span>
    );
  }
  return null;
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
        className="w-full py-3 bg-gradient-to-r from-[#8B0000] to-[#6a0000] hover:from-[#a10000] hover:to-[#7a0000] text-white rounded-xl text-xs font-bold shadow-md shadow-rose-900/20 transition-all flex items-center justify-center gap-2 active:scale-98"
      >
        <Laptop size={15} />
        <span>Absen Masuk via Web</span>
      </button>
    );
  }
  if (!isCheckedOut) {
    return (
      <button
        type="button"
        onClick={() => onOpenAttendance("out")}
        className="w-full py-3 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 active:scale-98"
      >
        <CheckCircle2 size={15} />
        <span>Absen Pulang via Web</span>
      </button>
    );
  }
  return (
    <div className="text-center py-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200 flex items-center justify-center gap-1.5">
      <CheckCircle2 size={15} className="text-emerald-600" />
      <span>Kehadiran Hari Ini Lengkap</span>
    </div>
  );
}

interface EmployeeWebAttendanceCardProps {
  readonly user: any;
  readonly todayAttendance: any;
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
    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#8B0000] flex items-center justify-center border border-rose-100">
              <Laptop size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Absensi via Web
              </h2>
              <p className="text-[11px] text-slate-500">
                Pencatatan Kehadiran Browser
              </p>
            </div>
          </div>

          {user?.is_web_auto_validated ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck size={12} className="text-emerald-600" />
              Auto-Valid
            </span>
          ) : (
            <span 
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
              title="Absensi web memerlukan persetujuan Super Admin"
            >
              <Clock size={12} className="text-amber-600" />
              Verifikasi Super Admin
            </span>
          )}
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Status Hari Ini:</span>
            {renderAttendanceStatusBadge(loadingAttendance, isCheckedIn, isCheckedOut)}
          </div>

          <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Clock size={12} className="text-slate-400" />
              Jadwal Kerja:
            </span>
            <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
              {user?.attendance_type === "shift" && (!user?.today_shift && (!user?.schedule_label || user?.schedule_label === "Tidak Ada Shift"))
                ? "Tidak Ada Shift"
                : (user?.schedule_label || (user?.work_start_time ? `${user.work_start_time} - ${user.work_end_time}` : "08:30 - 17:30"))}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Masuk</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">
                {checkInTime ? checkInTime.substring(0, 5) + " WIB" : "-- : --"}
              </div>
              {isWebRecord && checkInTime && (
                <div className="mt-1">
                  {renderWebApprovalStatusBadge(webApprovalStatus)}
                </div>
              )}
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Pulang</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">
                {checkOutTime ? checkOutTime.substring(0, 5) + " WIB" : "-- : --"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        {renderAttendanceActionButton(isCheckedIn, isCheckedOut, onOpenAttendance)}
        <p className="text-[11px] text-center text-slate-400">
          Absen web memerlukan satu foto selfie via kamera browser/file.
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
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(true);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [attendanceModalType, setAttendanceModalType] = useState<"in" | "out">("in");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [greeting, setGreeting] = useState<string>("Selamat Datang");
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [activeTasksCount, setActiveTasksCount] = useState<number>(0);
  const [latestSalary, setLatestSalary] = useState<any>(null);
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

  // Fetch summary data (tasks, announcements, salary, manager pending)
  const fetchSummaryData = useCallback(async () => {
    try {
      // Announcements
      const annRes = await axiosInstance.get("/announcements");
      const annData = annRes.data?.data?.data || annRes.data?.data || [];
      setAnnouncements(annData.slice(0, 3));
    } catch (e) {
      console.warn("Failed to fetch announcements:", e);
    }

    try {
      // Tasks
      const taskRes = await axiosInstance.get("/tasks");
      const tasks = taskRes.data?.data?.data || taskRes.data?.data || [];
      const pendingTasks = tasks.filter((t: any) => t.status !== "completed");
      setActiveTasksCount(pendingTasks.length);
    } catch (e) {
      console.warn("Failed to fetch tasks:", e);
    }

    try {
      // Latest Salary
      const salRes = await axiosInstance.get("/salaries");
      const salaries = salRes.data?.data?.data || salRes.data?.data || [];
      if (salaries.length > 0) {
        setLatestSalary(salaries[0]);
      }
    } catch (e) {
      console.warn("Failed to fetch salaries:", e);
    }

    try {
      // Reimbursements
      const remRes = await axiosInstance.get("/reimbursements");
      const rems = remRes.data?.data?.data || remRes.data?.data || [];
      const pendings = rems.filter((r: any) => r.status === "pending");
      const totalAmount = pendings.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      setReimbursementStats({
        pendingCount: pendings.length,
        totalPending: totalAmount,
      });
    } catch (e) {
      console.warn("Failed to fetch reimbursements:", e);
    }

    // Manager Pending Count
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

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#8B0000] via-[#750000] to-[#500000] p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 p-1 border-2 border-white/20 shadow-inner flex items-center justify-center overflow-hidden">
                {user?.profile_photo_url ? (
                  <img
                    src={user.profile_photo_url}
                    alt={user.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <UserIcon size={36} className="text-white/80" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#8B0000] rounded-full shadow-sm" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-semibold text-rose-100 backdrop-blur-md">
                <Building2 size={12} />
                <span>{user?.office?.name || "Kantor Utama"}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {greeting}, {user?.name || "Karyawan"}!
              </h1>
              <p className="text-xs text-rose-100/90 font-medium">
                {user?.role?.name || "Staff Karyawan"} • NIK: {(user as any)?.nik || "-"}
              </p>
            </div>
          </div>

          {/* Right Side: Clock & Admin Switcher if available */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="bg-black/20 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-left sm:text-right">
              <div className="text-[11px] text-rose-200 font-medium flex items-center gap-1 sm:justify-end">
                <Clock size={12} />
                <span>Waktu Sistem:</span>
              </div>
              <div className="text-base sm:text-lg font-black tracking-tight text-white">
                {currentTime}
              </div>
            </div>

            {canSwitchToAdmin && onSwitchToAdmin && (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
              >
                <Laptop size={14} className="text-[#8B0000]" />
                <span>Beralih ke Portal Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background */}
        <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/5 blur-xl pointer-events-none" />
      </div>

      {/* Manager Approval Hub Banner (Visible if user has approval role / manager) */}
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
                  : "Semua pengajuan bawahan Anda saat ini telah ditinjau."}
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

          {/* Background subtle glow */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/10 blur-2xl pointer-events-none" />
        </div>
      )}

      {/* Main Grid Layout: Attendance Card (Left) & Key Summary Metrics (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Web Attendance Card (5 Cols) */}
        <EmployeeWebAttendanceCard
          user={user}
          todayAttendance={todayAttendance}
          loadingAttendance={loadingAttendance}
          onOpenAttendance={handleOpenAttendance}
        />

        {/* Summary Metrics Cards (7 Cols) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Ringkasan Gaji Terakhir */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Gaji & Penggajian
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CreditCard size={16} />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900">
                {latestSalary?.net_salary
                  ? formatRupiah(latestSalary.net_salary)
                  : formatRupiah((user as any)?.basic_salary || 0)}
              </div>
              <p className="text-[11px] text-slate-500">
                {latestSalary?.period
                  ? `Periode ${latestSalary.period}`
                  : "Estimasi Take Home Pay Bulan Ini"}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
              <Link
                href="/dashboard/payroll"
                className="text-[#8B0000] hover:text-[#b30000] flex items-center gap-1"
              >
                <span>Lihat Rincian Slip</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 2: Sisa Saldo Cuti */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Sisa Saldo Cuti
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <CalendarCheck size={16} />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900">
                {user?.leave_balance ?? 12} Hari
              </div>
              <p className="text-[11px] text-slate-500">
                Cuti Kemnaker: {user?.kemnaker_leave_balance ?? 0} Hari
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
              <Link
                href="/dashboard/leaves"
                className="text-[#8B0000] hover:text-[#b30000] flex items-center gap-1"
              >
                <span>Ajukan Cuti Baru</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 3: Tugas Aktif */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Tugas Aktif
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <ClipboardList size={16} />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900">
                {activeTasksCount} Tugas
              </div>
              <p className="text-[11px] text-slate-500">
                {activeTasksCount > 0 ? "Perlu diselesaikan" : "Semua tugas selesai"}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
              <Link
                href="/dashboard/tasks"
                className="text-[#8B0000] hover:text-[#b30000] flex items-center gap-1"
              >
                <span>Buka Daftar Tugas</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 4: Klaim & Kasbon Pending */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Klaim & Kasbon Pending
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Wallet size={16} />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900">
                {reimbursementStats.pendingCount} Pengajuan
              </div>
              <p className="text-[11px] text-slate-500">
                Total: {formatRupiah(reimbursementStats.totalPending)}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
              <Link
                href="/dashboard/reimbursements"
                className="text-[#8B0000] hover:text-[#b30000] flex items-center gap-1"
              >
                <span>Status Reimburse</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons Grid (Filtered Dynamically by Permissions) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sparkles size={16} className="text-[#8B0000]" />
          Layanan & Aksi Cepat Mandiri
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
          {[
            {
              name: "Ajukan Cuti",
              href: "/dashboard/leaves",
              icon: CalendarCheck,
              bgColor: "bg-rose-100",
              textColor: "text-[#8B0000]",
              hoverBg: "hover:bg-rose-50",
              hoverBorder: "hover:border-rose-200",
              hoverText: "group-hover:text-[#8B0000]",
              permission: "view-leaves"
            },
            {
              name: "Ajukan Izin",
              href: "/dashboard/permits",
              icon: ClipboardList,
              bgColor: "bg-amber-100",
              textColor: "text-amber-800",
              hoverBg: "hover:bg-amber-50",
              hoverBorder: "hover:border-amber-200",
              hoverText: "group-hover:text-amber-800",
              permission: "view-permits"
            },
            {
              name: "Klaim Biaya",
              href: "/dashboard/reimbursements",
              icon: CreditCard,
              bgColor: "bg-emerald-100",
              textColor: "text-emerald-800",
              hoverBg: "hover:bg-emerald-50",
              hoverBorder: "hover:border-emerald-200",
              hoverText: "group-hover:text-emerald-800",
              permission: "view-reimbursements"
            },
            {
              name: "Ajukan Dana",
              href: "/dashboard/fund-requests",
              icon: Wallet,
              bgColor: "bg-blue-100",
              textColor: "text-blue-800",
              hoverBg: "hover:bg-blue-50",
              hoverBorder: "hover:border-blue-200",
              hoverText: "group-hover:text-blue-800",
              permission: "view-fund-requests"
            },
            {
              name: "Lembur",
              href: "/dashboard/overtimes",
              icon: Clock,
              bgColor: "bg-purple-100",
              textColor: "text-purple-800",
              hoverBg: "hover:bg-purple-50",
              hoverBorder: "hover:border-purple-200",
              hoverText: "group-hover:text-purple-800",
              permission: "view-overtimes"
            },
            {
              name: "Tukar Shift",
              href: "/dashboard/shift-swap",
              icon: Repeat,
              bgColor: "bg-teal-100",
              textColor: "text-teal-800",
              hoverBg: "hover:bg-teal-50",
              hoverBorder: "hover:border-teal-200",
              hoverText: "group-hover:text-teal-800",
              permission: "view-shift-swaps"
            },
            {
              name: "Log Armada",
              href: "/dashboard/fleet-logs",
              icon: Car,
              bgColor: "bg-indigo-100",
              textColor: "text-indigo-800",
              hoverBg: "hover:bg-indigo-50",
              hoverBorder: "hover:border-indigo-200",
              hoverText: "group-hover:text-indigo-800",
              permission: "view-vehicle-logs"
            },
            {
              name: "Pusat Bantuan",
              href: "/dashboard/help-center",
              icon: HelpCircle,
              bgColor: "bg-rose-100",
              textColor: "text-[#8B0000]",
              hoverBg: "hover:bg-rose-50",
              hoverBorder: "hover:border-rose-200",
              hoverText: "group-hover:text-[#8B0000]",
            },
          ]
            .filter((action) => action.permission ? hasPermission(action.permission) : true)
            .map((action) => {
              const ActionIcon = action.icon;
              return (
                <Link
                  key={action.name}
                  href={action.href}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-50 ${action.hoverBg} border border-slate-200 ${action.hoverBorder} transition-all group text-center`}
                >
                  <div className={`w-10 h-10 rounded-xl ${action.bgColor} ${action.textColor} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                    <ActionIcon size={18} />
                  </div>
                  <span className={`text-xs font-bold text-slate-700 ${action.hoverText}`}>
                    {action.name}
                  </span>
                </Link>
              );
            })}
        </div>
      </div>

      {/* Bottom Row: Latest Announcements & Quick Document Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Announcements */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bell size={16} className="text-[#8B0000]" />
              Pengumuman & Informasi Terbaru
            </h2>
            <Link
              href="/dashboard/announcements"
              className="text-xs font-semibold text-[#8B0000] hover:underline"
            >
              Lihat Semua
            </Link>
          </div>

          <div className="space-y-3">
            {announcements.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                Belum ada pengumuman terbaru.
              </div>
            ) : (
              announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-600">
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

        {/* Quick Documents & SOP */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-[#8B0000]" />
              Dokumen & Regulasi Perusahaan
            </h2>
            <Link
              href="/dashboard/documents"
              className="text-xs font-semibold text-[#8B0000] hover:underline"
            >
              Lihat Semua
            </Link>
          </div>

          <div className="space-y-2.5 text-xs">
            <Link
              href="/dashboard/documents"
              className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <FileText size={16} className="text-slate-500" />
                <span className="font-semibold text-slate-800">
                  Standar Operasional Prosedur (SOP) Lapangan
                </span>
              </div>
              <ArrowRight size={13} className="text-slate-400" />
            </Link>

            <Link
              href="/dashboard/documents"
              className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <FileText size={16} className="text-slate-500" />
                <span className="font-semibold text-slate-800">
                  Peraturan Perusahaan & Kode Etik Kerja
                </span>
              </div>
              <ArrowRight size={13} className="text-slate-400" />
            </Link>

            <Link
              href="/dashboard/help-center"
              className="flex items-center justify-between p-3 bg-rose-50/50 hover:bg-rose-50 rounded-xl border border-rose-100 transition-colors text-[#8B0000]"
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle size={16} className="text-[#8B0000]" />
                <span className="font-semibold">
                  Pusat Bantuan & Panduan FAQ Absensi
                </span>
              </div>
              <ArrowRight size={13} className="text-[#8B0000]" />
            </Link>
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
