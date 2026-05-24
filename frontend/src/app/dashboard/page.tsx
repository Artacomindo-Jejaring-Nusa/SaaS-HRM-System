"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Users, UserCheck, UserX, Calendar as CalendarIcon, 
  MoreVertical, Eye, Plus, Search, Filter, X, Clock, AlertCircle, CheckCircle,
  TrendingUp, TrendingDown, Briefcase, Activity, Coffee, FileText
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid } from 'recharts';
import Image from "next/image";

import { useAuth } from "@/contexts/AuthContext";
import { DashboardSkeleton } from "@/components/Skeleton";
import { useRouter } from "next/navigation";
import AttendanceMap from "@/components/AttendanceMap";

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

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewEmployeeId, setViewEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    // Normal dashboard behavior - no special redirect for admin
  }, [user]);

  useEffect(() => {
    async function fetchData() {
      try {
        const dashRes = await axiosInstance.get("/dashboard/summary");
        setData(dashRes.data.data);
      } catch (e) {
        console.error("Gagal mendapatkan data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading || authLoading) {
    return <DashboardSkeleton />;
  }

  const summary = data?.summary || {
    total_employees: 0,
    present_today: 0,
    late_today: 0,
    on_leave_today: 0,
    absent_today: 0,
  };

  const pendingApprovals = data?.pending_approvals || {
    leaves: 0,
    overtimes: 0,
    reimbursements: 0,
  };

  const attendanceTrends = data?.attendance_trends || [];
  const upcomingHolidays = data?.upcoming_holidays || [];
  const recentAnnouncements = data?.recent_announcements || [];
  const recentActivities = data?.recent_activities || [];
  const roleDistribution = data?.role_distribution || [];
  const todayAttendance = data?.today_attendance || [];
  const attendanceStats = data?.attendance_stats || { percentage: 0, late_count: 0, total_hours: 0, work_days: 0 };
  const calendarEvents = data?.calendar_events || [];
  const monthlyBreakdown = data?.monthly_breakdown || [];
  const overtimeSummary = data?.overtime_summary || [];
  const leaveDistribution = data?.leave_distribution || [];

  // Colors for charts
  const COLORS = ['#8B0000', '#991b1b', '#b91c1c', '#dc2626', '#fca5a5', '#ef4444', '#f87171'];
  const LEAVE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

  const pendingApprovalsChartData = [
    { name: 'Cuti', count: pendingApprovals.leaves, color: '#3b82f6' },
    { name: 'Lembur', count: pendingApprovals.overtimes, color: '#f59e0b' },
    { name: 'Klaim', count: pendingApprovals.reimbursements, color: '#10b981' }
  ];

  if (user?.role?.name === "Karyawan" || user?.role?.name === "Staff Karyawan") {
    return (
      <div className="w-full pb-8 animate-in fade-in duration-500 px-4 md:px-8">
        {/* Header Pegawai */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Personal Hub</h1>
            <p className="text-gray-500 font-medium">Selamat datang kembali, <span className="text-[#8B0000]">{user?.name}</span>. Apa rencana hebat hari ini?</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <div className="bg-[#fef2f2] p-2 rounded-xl text-[#8B0000]">
              <CalendarIcon size={20} />
            </div>
            <div className="pr-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Hari Ini</p>
              <p className="text-sm font-bold text-gray-900">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Personal Focus */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div 
                onClick={() => router.push('/dashboard/live-attendance')}
                className="bg-linear-to-br from-[#8B0000] to-[#5a0000] rounded-[2rem] p-6 text-white shadow-xl shadow-red-900/20 relative overflow-hidden group cursor-pointer hover:-translate-y-1 transition-transform"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                <p className="text-xs font-bold text-white/70 uppercase mb-2 tracking-widest">Live Attendance</p>
                <div className="text-4xl font-black mb-1">Face Recog</div>
                <p className="text-[10px] bg-white/20 inline-block px-2 py-1 mt-2 rounded-lg font-bold group-hover:bg-white group-hover:text-[#8B0000] transition-colors">ABSEN SEKARANG →</p>
              </div>
              
              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Sisa Jatah Cuti</p>
                  <div className="text-3xl font-black text-gray-900">{user?.leave_balance ?? 0} <span className="text-sm font-medium text-gray-400">Hari</span></div>
                </div>
                <button className="text-xs font-bold text-[#8B0000] flex items-center gap-1 mt-4 hover:gap-2 transition-all">
                  AJUKAN CUTI <Plus size={14} />
                </button>
              </div>

              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex flex-col justify-between" onClick={() => router.push('/dashboard/reimbursements')}>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Reimbursements</p>
                  <div className="text-3xl font-black text-gray-900">{pendingApprovals.reimbursements} <span className="text-sm font-medium text-gray-400">Klaim</span></div>
                </div>
                <button className="text-xs font-bold text-[#8B0000] flex items-center gap-1 mt-4 hover:gap-2 transition-all">
                  DAFTAR KLAIM <Plus size={14} />
                </button>
              </div>
            </div>

            {/* My Activity Chart */}
            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm shadow-gray-200/50">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Statistik Jam Kerja</h3>
                <div className="bg-gray-50 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-500">7 HARI TERAKHIR</div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={attendanceTrends}>
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="count" stroke="#8B0000" strokeWidth={4} dot={{ r: 4, fill: '#8B0000', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#8B0000', stroke: '#fff', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column: Information */}
          <div className="space-y-8">
            {/* Announcements */}
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
              <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-[#8B0000] rounded-full"></div>
                Pengumuman Terbaru
              </h3>
              <div className="space-y-4">
                {recentAnnouncements.length > 0 ? (
                  recentAnnouncements.map((ann, i) => (
                    <div key={ann.id} className="p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-red-100 hover:bg-red-50/30 transition-all cursor-pointer group" onClick={() => router.push('/dashboard/announcements')}>
                      <p className="text-[10px] font-bold text-[#8B0000] uppercase tracking-widest mb-1">{ann.user.name}</p>
                      <h4 className="font-bold text-gray-900 group-hover:text-[#8B0000] transition-colors">{ann.title}</h4>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium">
                        {new Date(ann.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-400 uppercase font-bold">Tidak ada pengumuman</p>
                  </div>
                )}
              </div>
            </div>

            {/* My Department Info */}
            <div className="bg-[#fef2f2] rounded-[2rem] p-8 border border-[#fee2e2] relative overflow-hidden">
               <div className="relative z-10">
                 <h3 className="font-black text-[#8B0000] text-2xl leading-none mb-1">Company Insight</h3>
                 <p className="text-red-700/60 font-medium text-sm">Team Activity Metrics</p>
                 <div className="mt-8 flex flex-col gap-2">
                    <div className="flex justify-between items-center bg-white/40 p-2 rounded-xl backdrop-blur-sm">
                       <span className="text-xs font-bold text-[#8B0000]">Kehadiran Tim Hari Ini</span>
                       <span className="text-sm font-black text-[#8B0000]">{Math.round((summary.present_today / summary.total_employees) * 100) || 0}%</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/40 p-2 rounded-xl backdrop-blur-sm">
                       <span className="text-xs font-bold text-[#8B0000]">Total Karyawan</span>
                       <span className="text-sm font-black text-[#8B0000]">{summary.total_employees}</span>
                    </div>
                 </div>
                 <p className="text-[11px] text-red-700/50 mt-4 font-bold tracking-tight uppercase">Satu Tim, Satu Tujuan.</p>
               </div>
               <div className="absolute bottom-0 right-0 opacity-10 -mr-8 -mb-8 scale-150">
                 <Users size={120} />
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-8 px-4 md:px-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-gray-900">Dashboard Admin</h1>
      </div>

      {/* SUMMARY STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Karyawan', value: summary.total_employees, icon: <Users size={18} />, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100' },
          { label: 'Hadir Hari Ini', value: summary.present_today, icon: <UserCheck size={18} />, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100' },
          { label: 'Terlambat', value: summary.late_today, icon: <Clock size={18} />, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100' },
          { label: 'Cuti/Izin', value: summary.on_leave_today, icon: <Coffee size={18} />, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100' },
          { label: 'Tidak Hadir', value: summary.absent_today, icon: <UserX size={18} />, color: 'bg-red-50 text-red-600', border: 'border-red-100' },
        ].map((stat, idx) => (
          <div key={idx} className={`bg-white rounded-2xl p-5 border ${stat.border} shadow-sm hover:shadow-md transition-shadow group`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.color}`}>
                {stat.icon}
              </div>
              <TrendingUp size={14} className="text-gray-300 group-hover:text-emerald-400 transition-colors" />
            </div>
            <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* TOP ROW GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
        
        {/* 1. Welcome Card (Col 1) */}
        <div className="bg-[#fef2f2] rounded-2xl p-6 pb-8 flex flex-col items-center border border-[#fee2e2] text-center h-[420px]">
          <div className="w-full flex justify-end shrink-0">
            <MoreVertical size={20} className="text-gray-400 cursor-pointer" />
          </div>
          <div className="flex-1 flex flex-col justify-center items-center min-h-0">
             <div className="relative w-full flex items-center justify-center mb-3 shrink-0">
                <Image src="/illustration.jpg" alt="Welcome" width={180} height={140} className="object-contain mix-blend-multiply hover:scale-105 transition-transform duration-300" priority />
             </div>
             <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide px-2 shrink-0">HELLO {user?.name}!</h2>
             <p className="text-xs text-gray-500 mt-1.5 px-3 leading-relaxed shrink-0">
               Selamat datang di pusat kendali SDM. Pantau kehadiran dan kelola pengajuan karyawan Anda di sini.
             </p>
          </div>
          <button onClick={() => router.push('/dashboard/live-attendance')} className="w-full max-w-[180px] bg-[#8B0000] text-white py-2.5 rounded-lg font-medium text-sm hover:bg-[#660000] transition mt-auto shrink-0">
            Live Records
          </button>
        </div>

        {/* 2. Monthly Performance (UX) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col gap-6 h-[420px]">
           <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
             <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
             Monthly Performance
           </h3>
           <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative w-32 h-32 mb-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                          data={[
                            { name: 'Present', value: attendanceStats.percentage },
                            { name: 'Absent', value: 100 - attendanceStats.percentage }
                          ]}
                          innerRadius={45}
                          outerRadius={60}
                          startAngle={90}
                          endAngle={450}
                          dataKey="value"
                       >
                          <Cell fill="#8B0000" />
                          <Cell fill="#f3f4f6" />
                       </Pie>
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-gray-900">{attendanceStats.percentage}%</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Hadir</span>
                 </div>
              </div>
              <div className="grid grid-cols-2 w-full gap-3 mt-2">
                 <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Terlambat</p>
                    <p className="text-lg font-black text-red-600">{attendanceStats.late_count}</p>
                 </div>
                 <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Jam</p>
                    <p className="text-lg font-black text-gray-900">{attendanceStats.total_hours}h</p>
                 </div>
              </div>
           </div>
        </div>

        {/* 3. Work Calendar & Events (UX) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col overflow-hidden h-[420px]">
           <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-6">
             <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
             Work Calendar
           </h3>
           <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
              {calendarEvents.length > 0 ? (
                calendarEvents.map((evt, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border flex items-center gap-3 ${evt.type === 'holiday' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${evt.type === 'holiday' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        <CalendarIcon size={14} />
                     </div>
                     <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{evt.title}</p>
                        <p className="text-[10px] font-medium text-gray-500">{new Date(evt.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                     </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                   <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-2">
                      <CalendarIcon size={24} />
                   </div>
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Events This Month</p>
                </div>
              )}
           </div>
        </div>

        {/* 4. Employee Distribution (Horizontal Bar) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col shadow-sm h-[420px]">
           <h3 className="font-bold text-gray-900 mb-2 text-sm flex items-center gap-2">
             <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
             Employee Distribution
           </h3>
           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
             {roleDistribution.reduce((sum, r) => sum + r.count, 0)} Total Karyawan
           </p>
           <div className="flex-1 overflow-y-auto pr-1 space-y-3">
             {roleDistribution
               .sort((a, b) => b.count - a.count)
               .map((item, idx) => {
                 const maxCount = Math.max(...roleDistribution.map(r => r.count), 1);
                 const percentage = Math.round((item.count / roleDistribution.reduce((s, r) => s + r.count, 0)) * 100);
                 return (
                   <div key={idx} className="group">
                     <div className="flex items-center justify-between mb-1.5">
                       <div className="flex items-center gap-2 min-w-0">
                         <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                         <span className="text-xs font-semibold text-gray-700 truncate">{item.role}</span>
                       </div>
                       <div className="flex items-center gap-2 shrink-0">
                         <span className="text-[10px] font-bold text-gray-400">{percentage}%</span>
                         <span className="text-xs font-black text-gray-900 w-6 text-right">{item.count}</span>
                       </div>
                     </div>
                     <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                       <div
                         className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-80"
                         style={{
                           width: `${(item.count / maxCount) * 100}%`,
                           backgroundColor: COLORS[idx % COLORS.length],
                         }}
                       />
                     </div>
                   </div>
                 );
               })}
           </div>
        </div>

      </div>

      {/* REAL-TIME ACTIVITY SECTION */}
      <div className="grid grid-cols-1 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm overflow-hidden">
           <div className="flex items-center justify-between mb-6">
             <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
               <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
               Real-time Live Location
             </h3>
             <button 
              onClick={() => router.push('/dashboard/attendance/map')} 
              className="text-[10px] font-black text-[#8B0000] hover:underline uppercase tracking-widest"
             >
               View Full Map
             </button>
           </div>
           {/* Add 'isolate z-0' here so Leaflet's high z-index panes don't overlap the fixed page header */}
           <div className="h-[400px] w-full rounded-xl overflow-hidden border border-gray-50 relative isolate z-0">
              <AttendanceMap />
           </div>
        </div>
      </div>

      {/* ANALYTICS CHARTS ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        
        {/* Weekly Attendance Trend (Line Chart) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
              Tren Kehadiran 7 Hari Terakhir
            </h3>
            <div className="bg-gray-50 px-3 py-1.5 rounded-xl text-[10px] font-bold text-gray-500 uppercase tracking-widest">Weekly</div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrends} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 700, color: '#111827' }}
                />
                <Line type="monotone" dataKey="count" name="Kehadiran" stroke="#8B0000" strokeWidth={3} dot={{ r: 5, fill: '#8B0000', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#8B0000', stroke: '#fff', strokeWidth: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leave Distribution (Pie Chart) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-6">
            <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
            Distribusi Cuti Bulan Ini
          </h3>
          {leaveDistribution.length > 0 ? (
            <>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={leaveDistribution} 
                      cx="50%"
                      cy="50%"
                      innerRadius={55} 
                      outerRadius={85} 
                      dataKey="count" 
                      nameKey="type"
                      isAnimationActive={false}
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
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 mt-auto">
                {leaveDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: LEAVE_COLORS[idx % LEAVE_COLORS.length] }}></span>
                      <span className="font-medium text-gray-600">{item.type}</span>
                    </div>
                    <span className="font-bold text-gray-800">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-3"><FileText size={24} /></div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Belum ada data cuti</p>
            </div>
          )}
        </div>
      </div>

      {/* MONTHLY BREAKDOWN & OVERTIME ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        
        {/* Monthly Attendance Breakdown (Stacked Bar Chart) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
              Rekap Kehadiran Bulanan
            </h3>
            <div className="bg-gray-50 px-3 py-1.5 rounded-xl text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          {monthlyBreakdown.length > 0 ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af', fontWeight: 600 }} interval={1} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="present" name="Hadir" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="late" name="Terlambat" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Belum ada data bulan ini</p>
            </div>
          )}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-50">
            <div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-sm bg-emerald-500"></span><span className="font-medium text-gray-500">Hadir Tepat Waktu</span></div>
            <div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-sm bg-amber-400"></span><span className="font-medium text-gray-500">Terlambat</span></div>
          </div>
        </div>

        {/* Overtime Summary + Upcoming Holidays */}
        <div className="flex flex-col gap-6">
          {/* Overtime Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex-1">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-4">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
              Lembur Bulan Ini
            </h3>
            {overtimeSummary.length > 0 ? (
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overtimeSummary} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="total_requests" name="Pengajuan" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[140px] flex items-center justify-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tidak ada lembur</p>
              </div>
            )}
          </div>

          {/* Upcoming Holidays */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex-1">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-4">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
              Hari Libur Mendatang
            </h3>
            <div className="space-y-3">
              {upcomingHolidays.length > 0 ? (
                upcomingHolidays.slice(0, 4).map((holiday) => (
                  <div key={holiday.id} className="flex items-center gap-3 p-2.5 bg-red-50/50 rounded-xl border border-red-100/50">
                    <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold leading-none">{new Date(holiday.date).toLocaleDateString('id-ID', { month: 'short' })}</span>
                      <span className="text-sm font-black leading-none">{new Date(holiday.date).getDate()}</span>
                    </div>
                    <p className="text-xs font-bold text-gray-700 truncate">{holiday.name}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 font-bold text-center py-4 uppercase tracking-widest">Tidak ada libur terdekat</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Today's Attendance Table (Replacing Recent Activities) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Today's Presence</h3>
            <button onClick={() => router.push('/dashboard/live-attendance')} className="text-xs font-bold text-[#8B0000] hover:underline">View Live</button>
          </div>
          
          <div className="overflow-x-auto flex-1 p-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-4 text-xs font-bold text-gray-900">Employee</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-900">NIK</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-900">Check In</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayAttendance.length > 0 ? (
                  todayAttendance.map((att) => (
                    <tr key={att.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100">
                            {att.photo_url ? (
                              <Image 
                                src={att.photo_url} 
                                alt="" 
                                width={32} 
                                height={32} 
                                className="object-cover" 
                                unoptimized 
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-gray-400">{att.user_name.charAt(0)}</span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-900">{att.user_name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500 font-medium">{att.nik || '-'}</td>
                      <td className="py-3.5 px-4 text-xs font-bold text-gray-900">{att.check_in}</td>
                      <td className="py-3.5 px-4 text-gray-400">
                        {att.status === 'late' ? (
                          <span className="bg-[#fee2e2] text-[#b91c1c] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Late</span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">On Time</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-xs text-gray-400 font-bold">No one has checked in yet today</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Announcements */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col h-[350px]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900">Announcements</h3>
            <button 
              onClick={() => router.push('/dashboard/announcements')}
              className="flex items-center gap-1 bg-[#fee2e2] text-[#b91c1c] px-2.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider hover:bg-[#fecaca] transition"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
             {recentAnnouncements.length > 0 ? (
               recentAnnouncements.map((ann) => (
                 <div key={ann.id} className="flex gap-4 p-3 rounded-lg hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                      <AlertCircle size={16} className="text-[#8B0000]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 truncate">{ann.title}</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{ann.user.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(ann.created_at).toLocaleDateString()}
                      </p>
                    </div>
                 </div>
               ))
             ) : (
               <div className="text-center py-10">
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No announcements</p>
               </div>
             )}
          </div>
        </div>

        {/* Pending Requests Chart (Replaces 2nd Work Calendar) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col h-[350px]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
              Pending Approvals
            </h3>
            <button 
              onClick={() => router.push('/dashboard/reimbursements')}
              className="text-[10px] font-black text-[#8B0000] hover:underline uppercase tracking-widest"
            >
              Cek Data
            </button>
          </div>
          <div className="flex-1 w-full relative min-h-0 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pendingApprovalsChartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 'bold' }} tickMargin={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {pendingApprovalsChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {pendingApprovalsChartData.map((item, id) => (
              <div key={id} className="text-center bg-gray-50 border border-gray-100 rounded-lg py-2">
                 <p className="text-sm font-black text-gray-900">{item.count}</p>
                 <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">{item.name}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* RECENT ACTIVITY TIMELINE */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mt-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <div className="w-1.5 h-4 bg-[#8B0000] rounded-full"></div>
            Aktivitas Terbaru
          </h3>
          <div className="bg-gray-50 px-3 py-1.5 rounded-xl text-[10px] font-bold text-gray-500 uppercase tracking-widest">Real-time</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recentActivities.length > 0 ? (
            recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition border border-transparent hover:border-gray-100 group">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100 shrink-0 mt-0.5">
                  {activity.photo_url ? (
                    <Image src={activity.photo_url} alt="" width={36} height={36} className="object-cover" unoptimized />
                  ) : (
                    <span className="text-[10px] font-bold text-gray-400">{activity.user_name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700"><span className="font-bold text-gray-900">{activity.user_name}</span>{' '}<span className="text-gray-500">{activity.description}</span></p>
                  <p className="text-[10px] text-gray-400 font-medium mt-1">{activity.time}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-8">
              <Activity size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Belum ada aktivitas</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
