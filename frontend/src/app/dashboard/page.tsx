"use client";

import { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Users, UserCheck, UserX, Calendar as CalendarIcon, 
  Plus, Search, Clock, AlertCircle,
  Activity, Coffee, FileText, Cake, Laptop,
  ShieldCheck, RefreshCw, ArrowRight, Building2,
  DollarSign, CheckSquare, CreditCard, Wallet, Car,
  ClipboardList, Award, ChevronRight, MapPin
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid 
} from 'recharts';
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

import { useAuth, isSuperAdminUser } from "@/contexts/AuthContext";
import { DashboardSkeleton } from "@/components/Skeleton";
import AttendanceMap from "@/components/AttendanceMap";
import EmployeeDashboardHome from "@/components/EmployeeDashboardHome";

interface DashboardData {
  summary: {
    total_employees: number;
    present_today: number;
    late_today: number;
    on_leave_today: number;
    absent_today: number;
  };
  pending_approvals: {
    leaves: number;
    overtimes: number;
    reimbursements: number;
  };
  attendance_trends: Array<{
    date: string;
    day: string;
    count: number;
  }>;
  upcoming_holidays: Array<{
    id: number;
    name: string;
    date: string;
  }>;
  recent_announcements: Array<{
    id: number;
    title: string;
    content: string;
    created_at: string;
    user: { name: string };
  }>;
  upcoming_birthdays?: Array<{
    id: number;
    name: string;
    role_name: string;
    date_of_birth: string;
    birth_day: number;
    formatted_birthday: string;
    is_today: boolean;
    days_until: number;
    phone_number: string | null;
  }>;
  recent_activities: Array<{
    id: number;
    user_name: string;
    action: string;
    description: string;
    time: string;
    photo_url: string | null;
  }>;
  role_distribution: Array<{
    role: string;
    count: number;
  }>;
  today_attendance: Array<{
    id: number;
    user_name: string;
    nik: string;
    check_in: string;
    status: string;
    photo_url: string | null;
  }>;
  attendance_stats: {
    percentage: number;
    late_count: number;
    total_hours: number;
    work_days: number;
  };
  calendar_events: Array<{
    type: 'holiday' | 'leave' | 'shift';
    title: string;
    date: string;
  }>;
  monthly_breakdown: Array<{
    date: string;
    label: string;
    present: number;
    late: number;
    total: number;
  }>;
  overtime_summary: Array<{
    week: string;
    total_requests: number;
    total_hours: number;
  }>;
  leave_distribution: Array<{
    type: string;
    count: number;
  }>;
}

const defaultDashboardData: DashboardData = {
  summary: {
    total_employees: 0,
    present_today: 0,
    late_today: 0,
    on_leave_today: 0,
    absent_today: 0,
  },
  pending_approvals: {
    leaves: 0,
    overtimes: 0,
    reimbursements: 0,
  },
  attendance_trends: [],
  upcoming_holidays: [],
  recent_announcements: [],
  upcoming_birthdays: [],
  recent_activities: [],
  role_distribution: [],
  today_attendance: [],
  attendance_stats: {
    percentage: 0,
    late_count: 0,
    total_hours: 0,
    work_days: 0,
  },
  calendar_events: [],
  monthly_breakdown: [],
  overtime_summary: [],
  leave_distribution: [],
};

export default function DashboardPage() {
  const { user, hasPermission, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'auto' | 'admin' | 'employee'>('auto');
  const [todaySearchQuery, setTodaySearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  // Detailed manager pending counts
  const [managerCounts, setManagerCounts] = useState<{
    leave: number;
    overtime: number;
    reimbursement: number;
    permit: number;
    fund_request: number;
    vehicle_log: number;
    payroll?: number;
    early_out?: number;
    attendance_correction?: number;
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
    total: 0,
  });

  // Real-time clock & date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
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
          year: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async (isSilent = false) => {
    if (authLoading) return;
    if (!user || !isSuperAdminUser(user)) {
      setLoading(false);
      return;
    }

    try {
      if (!isSilent) setLoading(true);
      setRefreshing(true);

      const [dashRes, countRes] = await Promise.all([
        axiosInstance.get("/dashboard/summary", { timeout: 12000 }).catch((e) => {
          console.warn("Summary fetch error:", e);
          return null;
        }),
        axiosInstance.get("/manager/pending-count", { timeout: 10000 }).catch((e) => {
          console.warn("Manager pending count fetch error:", e);
          return null;
        })
      ]);

      if (dashRes?.data?.data) {
        setData(dashRes.data.data);
      } else {
        setData((prev) => prev || defaultDashboardData);
      }

      if (countRes?.data?.data) {
        setManagerCounts(countRes.data.data);
      }
    } catch (e) {
      console.error("Gagal mendapatkan data dashboard", e);
      setData((prev) => prev || defaultDashboardData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    await fetchData(true);
    toast.success("Data dashboard telah diperbarui.");
  };

  // Only Super Admin gets the executive/admin overview dashboard
  const isSuperAdmin = isSuperAdminUser(user);

  // If not Super Admin, ALWAYS render Employee Dashboard (no switch to admin)
  if (!isSuperAdmin) {
    return (
      <div className="w-full">
        <EmployeeDashboardHome canSwitchToAdmin={false} />
      </div>
    );
  }

  // If Super Admin toggled to employee view
  if (viewMode === 'employee') {
    return (
      <div className="w-full">
        <EmployeeDashboardHome
          canSwitchToAdmin={true}
          onSwitchToAdmin={() => setViewMode('admin')}
        />
      </div>
    );
  }

  if (authLoading || (loading && !data)) {
    return <DashboardSkeleton />;
  }

  const summary = data?.summary || {
    total_employees: 0,
    present_today: 0,
    late_today: 0,
    on_leave_today: 0,
    absent_today: 0,
  };

  const attendanceTrends = data?.attendance_trends || [];
  const upcomingHolidays = data?.upcoming_holidays || [];
  const recentAnnouncements = data?.recent_announcements || [];
  const upcomingBirthdays = data?.upcoming_birthdays || [];
  const recentActivities = data?.recent_activities || [];
  const roleDistribution = data?.role_distribution || [];
  const todayAttendance = data?.today_attendance || [];
  const attendanceStats = data?.attendance_stats || { percentage: 0, late_count: 0, total_hours: 0, work_days: 0 };
  const calendarEvents = data?.calendar_events || [];
  const displayEvents = calendarEvents.length > 0
    ? calendarEvents
    : upcomingHolidays.map((h) => ({
        type: 'holiday' as const,
        title: h.name,
        date: h.date,
      }));
  const monthlyBreakdown = data?.monthly_breakdown || [];
  const overtimeSummary = data?.overtime_summary || [];
  const leaveDistribution = data?.leave_distribution || [];

  // Colors for charts
  const COLORS = ['#8B0000', '#991b1b', '#b91c1c', '#dc2626', '#ea580c', '#d97706', '#65a30d', '#0284c7'];
  const LEAVE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

  const totalEmployeesCount = summary.total_employees || 1;
  const presentPercent = Math.round((summary.present_today / totalEmployeesCount) * 100);
  const latePercent = Math.round((summary.late_today / totalEmployeesCount) * 100);

  // Filtered today's attendance records
  const filteredTodayAttendance = todayAttendance.filter((att) => {
    if (!todaySearchQuery.trim()) return true;
    const q = todaySearchQuery.toLowerCase();
    return (
      att.user_name.toLowerCase().includes(q) ||
      Boolean(att.nik?.toLowerCase().includes(q)) ||
      Boolean(att.status?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full pb-12 px-4 md:px-8 space-y-6 animate-in fade-in duration-300">
      
      {/* 1. EXECUTIVE TOP HEADER BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#8B0000] via-[#700000] to-[#4A0000] p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold text-rose-100 backdrop-blur-md">
              <ShieldCheck size={14} className="text-amber-300" />
              <span>Portal Super Admin • Enterprise HRMS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Pusat Kendali & Analitik Eksekutif
            </h1>
            <p className="text-xs sm:text-sm text-rose-100/90 max-w-2xl leading-relaxed">
              Pantau kehadiran real-time, antrean persetujuan seluruh unit, dan operasional perusahaan secara komprehensif.
            </p>
          </div>

          {/* Right Controls: Clock & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-black/25 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-left shrink-0">
              <div className="text-[10px] text-rose-200 font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock size={11} />
                <span>{currentDate || "Hari Ini"}</span>
              </div>
              <div className="text-sm font-black tracking-tight text-white mt-0.5">
                {currentTime}
              </div>
            </div>

            <Link
              href="/dashboard/approvals"
              className="px-3.5 py-2.5 bg-white text-[#8B0000] hover:bg-rose-50 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm shrink-0"
            >
              <CheckSquare size={14} />
              <span>Pusat Persetujuan</span>
              {managerCounts.total > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#8B0000] text-white">
                  {managerCounts.total}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setViewMode('employee')}
              className="px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-bold backdrop-blur-md transition-all flex items-center gap-2 shadow-sm shrink-0"
              title="Pratinjau tampilan dashboard sebagai karyawan"
            >
              <Laptop size={14} />
              <span>Tampilan Karyawan</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center justify-center shadow-sm disabled:opacity-50 shrink-0"
              title="Perbarui Data Dashboard"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin text-amber-300" : ""} />
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -bottom-12 h-60 w-60 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      </div>

      {/* 2. SUMMARY KPI METRIC CARDS (5 Cards Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Card 1: Total Karyawan */}
        <div className="bg-white rounded-2xl p-4.5 sm:p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Karyawan</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <Users size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">{summary.total_employees}</div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
              <Building2 size={12} className="text-slate-400" />
              <span>Aktif terdaftar di sistem</span>
            </div>
          </div>
        </div>

        {/* Card 2: Hadir Hari Ini */}
        <div className="bg-white rounded-2xl p-4.5 sm:p-5 border border-emerald-200 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between bg-gradient-to-b from-emerald-50/20 to-white group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Hadir Hari Ini</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200">
              <UserCheck size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-800 tracking-tight">{summary.present_today}</div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{presentPercent}% Tingkat Kehadiran</span>
            </div>
          </div>
        </div>

        {/* Card 3: Terlambat */}
        <div className="bg-white rounded-2xl p-4.5 sm:p-5 border border-amber-200 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between bg-gradient-to-b from-amber-50/20 to-white group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Terlambat</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-800 tracking-tight">{summary.late_today}</div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-700 font-medium">
              <AlertCircle size={12} className="text-amber-500" />
              <span>{latePercent}% dari total hadir</span>
            </div>
          </div>
        </div>

        {/* Card 4: Cuti / Izin */}
        <div className="bg-white rounded-2xl p-4.5 sm:p-5 border border-purple-200 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between bg-gradient-to-b from-purple-50/20 to-white group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Cuti & Izin</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center border border-purple-200">
              <Coffee size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-purple-900 tracking-tight">{summary.on_leave_today}</div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-purple-700 font-medium">
              <CalendarIcon size={12} className="text-purple-500" />
              <span>Izin/Cuti disetujui</span>
            </div>
          </div>
        </div>

        {/* Card 5: Belum Absen */}
        <div className="bg-white rounded-2xl p-4.5 sm:p-5 border border-rose-200 shadow-xs hover:border-rose-300 transition-all flex flex-col justify-between col-span-2 sm:col-span-1 bg-gradient-to-b from-rose-50/20 to-white group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Belum Masuk</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center border border-rose-200">
              <UserX size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-rose-800 tracking-tight">{summary.absent_today}</div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-rose-600 font-medium">
              <span>Belum ada log presensi</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. EXECUTIVE ACTION HUB & INSIGHTS (4 Cols Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Col 1: Pusat Pintasan Eksekutif */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
                Pusat Kendali Cepat
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                Pintasan
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Akses cepat modul manajerial dan pengelolaan sistem perusahaan:
            </p>

            <div className="space-y-2">
              <Link
                href="/dashboard/approvals"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-[#8B0000] flex items-center justify-center">
                    <CheckSquare size={15} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-[#8B0000] block">
                      Portal Persetujuan
                    </span>
                    <span className="text-[10px] text-slate-400">Verifikasi pengajuan tim</span>
                  </div>
                </div>
                {managerCounts.total > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#8B0000] text-white">
                    {managerCounts.total}
                  </span>
                )}
              </Link>

              <Link
                href="/dashboard/employees"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                    <Users size={15} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-blue-900 block">
                      Data Karyawan
                    </span>
                    <span className="text-[10px] text-slate-400">Kelola master pegawai</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/face-approval"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Award size={15} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-amber-900 block">
                      Persetujuan Wajah
                    </span>
                    <span className="text-[10px] text-slate-400">Verifikasi foto biometrik</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          <Link
            href="/dashboard/live-attendance"
            className="w-full mt-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition text-center flex items-center justify-center gap-2 shadow-xs"
          >
            <Activity size={14} className="text-emerald-400" />
            <span>Monitoring Live Kehadiran</span>
          </Link>
        </div>

        {/* Col 2: Performa Kehadiran Bulanan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
              Performa Bulan Ini
            </h3>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
              Statistik
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center my-3">
            <div className="relative w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Present', value: attendanceStats.percentage || 1 },
                      { name: 'Absent', value: Math.max(0, 100 - (attendanceStats.percentage || 0)) }
                    ]}
                    innerRadius={44}
                    outerRadius={58}
                    startAngle={90}
                    endAngle={450}
                    dataKey="value"
                  >
                    <Cell fill="#8B0000" />
                    <Cell fill="#f1f5f9" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-900">{attendanceStats.percentage}%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hadir</span>
              </div>
            </div>

            <div className="grid grid-cols-2 w-full gap-2 mt-3">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Terlambat</div>
                <div className="text-base font-black text-rose-700 mt-0.5">{attendanceStats.late_count}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Total Jam</div>
                <div className="text-base font-black text-slate-900 mt-0.5">{attendanceStats.total_hours}h</div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 text-center">
            Berdasarkan kalkulasi {attendanceStats.work_days || 0} hari kerja aktif
          </div>
        </div>

        {/* Col 3: Kalender Kerja & Hari Libur */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
              Agenda & Libur Terdekat
            </h3>
            <Link href="/dashboard/holidays" className="text-[11px] font-bold text-[#8B0000] hover:underline">
              Kelola
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[250px] pr-1">
            {displayEvents.length > 0 ? (
              displayEvents.slice(0, 5).map((evt) => (
                <div
                  key={`${evt.type}-${evt.date}-${evt.title}`}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                    evt.type === 'holiday' 
                      ? 'bg-rose-50/60 border-rose-100' 
                      : 'bg-blue-50/60 border-blue-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    evt.type === 'holiday' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    <CalendarIcon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{evt.title}</p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {new Date(evt.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400">
                <CalendarIcon size={24} className="mx-auto mb-1 opacity-40" />
                <p className="text-xs font-semibold">Tidak ada agenda libur terdekat</p>
              </div>
            )}
          </div>

          <div className="pt-2 text-[11px] text-slate-400 text-center border-t border-slate-100">
            Sinkronisasi otomatis dengan kalender nasional
          </div>
        </div>

        {/* Col 4: Distribusi Karyawan per Jabatan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
              Distribusi Jabatan
            </h3>
            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {roleDistribution.reduce((sum, r) => sum + r.count, 0)} Pegawai
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[250px] pr-1">
            {roleDistribution.length > 0 ? (
              roleDistribution
                .sort((a, b) => b.count - a.count)
                .slice(0, 6)
                .map((item, idx) => {
                  const maxCount = Math.max(...roleDistribution.map(r => r.count), 1);
                  const totalRolesCount = roleDistribution.reduce((s, r) => s + r.count, 0) || 1;
                  const percentage = Math.round((item.count / totalRolesCount) * 100);
                  return (
                    <div key={item.role} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 truncate max-w-[140px]">{item.role}</span>
                        <span className="text-[11px] font-black text-slate-900">{item.count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(item.count / maxCount) * 100}%`,
                            backgroundColor: COLORS[idx % COLORS.length]
                          }}
                        />
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="py-12 text-center text-slate-400">
                <Users size={24} className="mx-auto mb-1 opacity-40" />
                <p className="text-xs font-semibold">Belum ada data jabatan</p>
              </div>
            )}
          </div>

          <Link
            href="/dashboard/roles"
            className="pt-2 text-[11px] font-bold text-[#8B0000] hover:underline text-center border-t border-slate-100 block"
          >
            Kelola Struktur Role & Hak Akses →
          </Link>
        </div>

      </div>

      {/* 4. REAL-TIME LIVE LOCATION SECTION */}
      {hasPermission('view-attendance-map') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
                Live Tracking & Titik Lokasi Presensi
              </h3>
              <p className="text-xs text-slate-500">
                Pemantauan koordinat GPS absensi masuk dan dinas luar karyawan secara real-time.
              </p>
            </div>
            <Link 
              href="/dashboard/attendance/map" 
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#8B0000] border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <MapPin size={13} />
              <span>Buka Peta Penuh</span>
            </Link>
          </div>
          <div className="h-[380px] w-full rounded-2xl overflow-hidden border border-slate-200 relative isolate z-0">
            <AttendanceMap />
          </div>
        </div>
      )}

      {/* 5. MULTI-CATEGORY PENDING APPROVALS HUB */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
              Antrean Permohonan Persetujuan (Pending Approvals)
            </h3>
            <p className="text-xs text-slate-500">
              Permohonan bawahan dan staf yang menunggu respon persetujuan Super Admin / Manajemen.
            </p>
          </div>
          <Link
            href="/dashboard/approvals"
            className="text-xs font-black text-[#8B0000] hover:underline flex items-center gap-1"
          >
            <span>Buka Portal Lengkap</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "Cuti", count: managerCounts.leave, color: "text-blue-700 bg-blue-50 border-blue-200", icon: CalendarIcon, type: "leave" },
            { label: "Izin", count: managerCounts.permit, color: "text-purple-700 bg-purple-50 border-purple-200", icon: ClipboardList, type: "permit" },
            { label: "Lembur", count: managerCounts.overtime, color: "text-amber-700 bg-amber-50 border-amber-200", icon: Clock, type: "overtime" },
            { label: "Klaim Biaya", count: managerCounts.reimbursement, color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CreditCard, type: "reimbursement" },
            { label: "Kasbon / Dana", count: managerCounts.fund_request, color: "text-teal-700 bg-teal-50 border-teal-200", icon: Wallet, type: "fund_request" },
            { label: "Log Armada", count: managerCounts.vehicle_log, color: "text-indigo-700 bg-indigo-50 border-indigo-200", icon: Car, type: "vehicle_log" },
            { label: "Koreksi Absen", count: managerCounts.attendance_correction || 0, color: "text-cyan-700 bg-cyan-50 border-cyan-200", icon: Clock, type: "attendance_correction" },
            { label: "Payroll", count: managerCounts.payroll || 0, color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: DollarSign, type: "payroll" },
          ].map((item) => {
            const IconComp = item.icon;
            return (
              <Link
                key={item.type}
                href={`/dashboard/approvals`}
                className={`p-3.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all hover:scale-102 hover:shadow-xs ${item.color}`}
              >
                <IconComp size={18} className="mb-1.5 opacity-80" />
                <span className="text-xl font-black leading-tight">{item.count}</span>
                <span className="text-[11px] font-bold mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 6. ANALYTICS CHARTS ROW (Weekly Attendance & Leave Distribution) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Weekly Attendance Trend (Line Chart) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
                Tren Kehadiran 7 Hari Terakhir
              </h3>
              <p className="text-xs text-slate-500">Jumlah karyawan hadir setiap hari pada minggu aktif.</p>
            </div>
            <div className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              Mingguan
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrends} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                  labelStyle={{ fontWeight: 700, color: '#0f172a' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Kehadiran"
                  stroke="#8B0000"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#8B0000', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#8B0000', stroke: '#fff', strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leave Distribution (Donut Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
              Distribusi Tipe Cuti
            </h3>
            <p className="text-xs text-slate-500">Kategori cuti yang diambil bulan ini.</p>
          </div>

          {leaveDistribution.length > 0 ? (
            <>
              <div className="h-[180px] w-full my-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={leaveDistribution} 
                      cx="50%"
                      cy="50%"
                      innerRadius={50} 
                      outerRadius={75} 
                      dataKey="count" 
                      nameKey="type"
                    >
                      {leaveDistribution.map((_, index) => (
                        <Cell 
                          key={`leave-${index}`} 
                          fill={LEAVE_COLORS[index % LEAVE_COLORS.length]} 
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 pt-3 border-t border-slate-100">
                {leaveDistribution.slice(0, 4).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: LEAVE_COLORS[idx % LEAVE_COLORS.length] }} />
                      <span className="font-medium text-slate-700 truncate">{item.type}</span>
                    </div>
                    <span className="font-bold text-slate-900">{item.count} hari</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-slate-400">
              <FileText size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">Belum ada pengajuan cuti</p>
            </div>
          )}
        </div>
      </div>

      {/* 7. MONTHLY BREAKDOWN & OVERTIME ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monthly Attendance Breakdown (Stacked Bar Chart) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
                Rekap Kehadiran Bulanan
              </h3>
              <p className="text-xs text-slate-500">Perbandingan presensi tepat waktu dan keterlambatan per hari.</p>
            </div>
            <div className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          {monthlyBreakdown.length > 0 ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} interval={1} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="present" name="Hadir Tepat Waktu" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="late" name="Terlambat" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-slate-400">
              <p className="text-xs font-semibold">Belum ada data kehadiran bulan ini</p>
            </div>
          )}

          <div className="flex items-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="font-semibold text-slate-600">Hadir Tepat Waktu</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-amber-400" />
              <span className="font-semibold text-slate-600">Terlambat</span>
            </div>
          </div>
        </div>

        {/* Overtime Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
              Lembur Bulan Ini
            </h3>
            <p className="text-xs text-slate-500">Frekuensi pengajuan lembur per minggu.</p>
          </div>

          {overtimeSummary.length > 0 ? (
            <div className="h-[180px] w-full my-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overtimeSummary} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="total_requests" name="Pengajuan" fill="#8B0000" radius={[6, 6, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400">
              <Clock size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">Tidak ada lembur tercatat</p>
            </div>
          )}

          <Link
            href="/dashboard/overtimes"
            className="pt-3 text-[11px] font-bold text-[#8B0000] hover:underline text-center border-t border-slate-100 block"
          >
            Buka Laporan Lembur Karyawan →
          </Link>
        </div>
      </div>

      {/* 8. OPERATIONAL DATA: TODAY'S PRESENCE & ANNOUNCEMENTS & BIRTHDAYS */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Presensi Hari Ini (2 Cols) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Presensi Terkini Hari Ini</h3>
              <p className="text-[11px] text-slate-500">Daftar kehadiran karyawan yang telah masuk.</p>
            </div>
            
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama / NIK..."
                value={todaySearchQuery}
                onChange={(e) => setTodaySearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#8B0000]"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-4">Karyawan</th>
                  <th className="py-2.5 px-4">NIK</th>
                  <th className="py-2.5 px-4">Jam Masuk</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTodayAttendance.length > 0 ? (
                  filteredTodayAttendance.slice(0, 6).map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#8B0000] border border-rose-100 flex items-center justify-center font-black text-xs shrink-0 overflow-hidden">
                            {att.photo_url ? (
                              <Image 
                                src={att.photo_url} 
                                alt="" 
                                width={32} 
                                height={32} 
                                className="w-full h-full object-cover" 
                                unoptimized 
                              />
                            ) : (
                              att.user_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="font-bold text-slate-900 truncate max-w-[150px]">{att.user_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{att.nik || '-'}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{att.check_in}</td>
                      <td className="py-3 px-4">
                        {att.status === 'late' ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Terlambat
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Tepat Waktu
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-xs text-slate-400 font-semibold">
                      Tidak ada data presensi yang cocok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-right">
            <Link
              href="/dashboard/live-attendance"
              className="text-xs font-bold text-[#8B0000] hover:underline"
            >
              Lihat Seluruh Log Kehadiran Hari Ini →
            </Link>
          </div>
        </div>

        {/* Pengumuman Perusahaan (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
                Pengumuman
              </h3>
              <Link
                href="/dashboard/announcements"
                className="flex items-center gap-1 text-[11px] font-bold text-[#8B0000] hover:underline"
              >
                <Plus size={13} /> Tambah
              </Link>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[260px] pr-1">
              {recentAnnouncements.length > 0 ? (
                recentAnnouncements.slice(0, 4).map((ann) => (
                  <div key={ann.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{ann.title}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{ann.content}</p>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/50">
                      <span>{ann.user?.name || "Admin"}</span>
                      <span>{new Date(ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <AlertCircle size={24} className="mx-auto mb-1 opacity-40" />
                  <p className="text-xs font-semibold">Belum ada pengumuman</p>
                </div>
              )}
            </div>
          </div>

          <Link
            href="/dashboard/announcements"
            className="pt-2 text-[11px] font-bold text-[#8B0000] hover:underline text-center border-t border-slate-100 block"
          >
            Kelola Papan Pengumuman →
          </Link>
        </div>

        {/* Ulang Tahun Bulan Ini (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Cake size={16} className="text-[#8B0000]" />
                Ulang Tahun Bulan Ini
              </h3>
              <Link href="/dashboard/birthdays" className="text-[11px] font-bold text-[#8B0000] hover:underline">
                Semua
              </Link>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[260px] pr-1">
              {upcomingBirthdays.length > 0 ? (
                upcomingBirthdays.slice(0, 4).map((b) => (
                  <div 
                    key={b.id} 
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                      b.is_today 
                        ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300/40' 
                        : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                        b.is_today ? 'bg-amber-500 text-white' : 'bg-rose-100 text-[#8B0000]'
                      }`}>
                        {b.is_today ? '🎂' : b.birth_day}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 truncate">
                          {b.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 truncate">{b.formatted_birthday}</p>
                      </div>
                    </div>

                    {b.phone_number && (
                      <button
                        onClick={() => {
                          const cleanPhone = b.phone_number?.replaceAll(/\D/g, "").replace(/^0/, "62");
                          const msg = `Selamat Ulang Tahun Bpk/Ibu ${b.name}! 🎉🎂 Semoga sehat selalu & sukses di PT Narwasthu Artha Tama!`;
                          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg font-bold shrink-0 transition"
                      >
                        WA
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Cake size={24} className="mx-auto mb-1 opacity-40" />
                  <p className="text-xs font-semibold">Tidak ada ulang tahun bulan ini</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 text-center border-t border-slate-100">
            Daftar otomatis terupdate setiap bulan
          </div>
        </div>

      </div>

      {/* 9. RECENT AUDIT LOG TIMELINE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full" />
              Aktivitas Sistem & Audit Log Terakhir
            </h3>
            <p className="text-xs text-slate-500">Rekap pergerakan transaksi dan aktivitas terbaru pada sistem.</p>
          </div>
          <Link
            href="/dashboard/activity-logs"
            className="text-xs font-black text-[#8B0000] hover:underline"
          >
            Lihat Semua Log →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recentActivities.length > 0 ? (
            recentActivities.slice(0, 6).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                  {activity.photo_url ? (
                    <Image src={activity.photo_url} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    activity.user_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-800">
                    <span className="font-bold text-slate-900">{activity.user_name}</span>{" "}
                    <span className="text-slate-600">{activity.description}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-8 text-slate-400">
              <Activity size={24} className="mx-auto mb-1 opacity-40" />
              <p className="text-xs font-semibold">Belum ada aktivitas tercatat</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
