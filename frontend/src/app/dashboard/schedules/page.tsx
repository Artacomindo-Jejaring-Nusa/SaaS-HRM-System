"use client";

import { useEffect, useRef, useState } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  Edit2, 
  Trash2, 
  LayoutGrid, 
  List, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Columns,
  Settings,
  X,
  FileDown,
  Users,
  Info
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionGuard } from "@/components/PermissionGuard";
import { TableSkeleton } from "@/components/Skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Schedule {
  id: number;
  user_id: number;
  shift_id: number;
  date: string;
  user?: { name: string; email: string; profile_photo_url?: string; attendance_type?: string };
  shift?: { name: string; start_time: string; end_time: string; color?: string };
}

interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

interface User {
  id: number;
  name: string;
  role?: { name: string };
  attendance_type?: string;
  profile_photo_url?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// Scrollable Column Picker
function ScrollColumn({
  items,
  selected,
  onSelect,
  title
}: {
  items: string[];
  selected: string;
  onSelect: (val: string) => void;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const selectedEl = containerRef.current.querySelector('[data-selected="true"]') as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selected]);

  return (
    <div className="flex-1">
      <p className="text-[10px] font-bold text-gray-400 uppercase text-center mb-1">{title}</p>
      <div 
        ref={containerRef}
        className="h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 space-y-0.5 custom-scrollbar text-center shadow-inner"
      >
        {items.map((item) => {
          const isSelected = item === selected;
          return (
            <button
              key={item}
              type="button"
              data-selected={isSelected}
              onClick={() => onSelect(item)}
              className={`w-full py-1 text-xs font-bold rounded-md transition-all ${
                isSelected
                  ? 'bg-[#8B0000] text-white shadow-xs font-black'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Scroll Time Picker with Hour and Minute columns
function ScrollTimePicker({
  value,
  onChange,
  label,
  iconColor = "text-emerald-600"
}: {
  value: string;
  onChange: (val: string) => void;
  label: string;
  iconColor?: string;
}) {
  const [hour, minute] = (value || "08:00").slice(0, 5).split(":");
  const currentH = hour || "08";
  const currentM = minute || "00";

  const handleHourSelect = (h: string) => {
    onChange(`${h}:${currentM}`);
  };

  const handleMinuteSelect = (m: string) => {
    onChange(`${currentH}:${m}`);
  };

  return (
    <div className="space-y-1.5 bg-gray-50/80 p-3 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <Clock size={13} className={iconColor} />
          {label}
        </label>
        <span className="text-xs font-black text-[#8B0000] bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-2xs">
          {currentH}:{currentM} WIB
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <ScrollColumn 
          items={HOURS} 
          selected={currentH} 
          onSelect={handleHourSelect} 
          title="Jam" 
        />
        <span className="font-black text-gray-300 text-lg self-center mt-3">:</span>
        <ScrollColumn 
          items={MINUTES} 
          selected={currentM} 
          onSelect={handleMinuteSelect} 
          title="Menit" 
        />
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "calendar" | "roster">("roster");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const { hasPermission } = useAuth();

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Data
  const [scheduleData, setScheduleData] = useState({ user_id: "", shift_id: "", date: "" });
  const [shiftData, setShiftData] = useState({ name: "", start_time: "08:00", end_time: "17:00" });
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);

  useEffect(() => {
    fetchSchedules(currentDate);
    fetchShifts();
    fetchEmployees();
  }, [currentDate]); 

  // Filter only employees with attendance_type === 'shift'
  const shiftEmployees = allEmployees.filter(emp => emp.attendance_type === 'shift');

  const fetchSchedules = async (date: Date) => {
    try {
      setLoading(true);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const response = await axiosInstance.get(`/schedules?month=${month}&year=${year}&per_page=500`);
      const resData = response.data.data;
      setSchedules(Array.isArray(resData) ? resData : (resData?.data || []));
    } catch (e) {
      console.error("Gagal mengambil data jadwal", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchShifts = async () => {
    try {
      const response = await axiosInstance.get("/shifts?per_page=100");
      const resData = response.data.data;
      const shiftList = Array.isArray(resData) ? resData : (resData?.data || []);
      setShifts(shiftList);
      if (shiftList.length > 0 && !scheduleData.shift_id) {
        setScheduleData(prev => ({ ...prev, shift_id: String(shiftList[0].id) }));
      }
    } catch (e) {
      console.error("Gagal ambil data shift", e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axiosInstance.get("/employees?per_page=500");
      const resData = response.data.data;
      setAllEmployees(Array.isArray(resData) ? resData : (resData?.data || []));
    } catch (e) {
      console.error("Gagal ambil data karyawan", e);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleData.user_id || !scheduleData.shift_id || !scheduleData.date) {
      toast.error("Harap lengkapi nama karyawan shift, jenis shift, dan tanggal");
      return;
    }
    setIsSubmitting(true);
    try {
      await axiosInstance.post("/schedules", scheduleData);
      toast.success("Jadwal shift berhasil disimpan");
      setIsScheduleModalOpen(false);
      fetchSchedules(currentDate);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal membuat jadwal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    toast("Hapus jadwal penugasan shift ini?", {
      action: {
        label: "Hapus",
        onClick: async () => {
          try {
            await axiosInstance.delete(`/schedules/${id}`);
            toast.success("Jadwal berhasil dihapus");
            fetchSchedules(currentDate);
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal menghapus jadwal");
          }
        },
      },
    });
  };

  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftData.name.trim() || !shiftData.start_time || !shiftData.end_time) {
      toast.error("Harap lengkapi nama shift, jam masuk, dan jam pulang");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingShiftId) {
        await axiosInstance.put(`/shifts/${editingShiftId}`, shiftData);
        toast.success("Shift berhasil diperbarui");
      } else {
        await axiosInstance.post("/shifts", shiftData);
        toast.success("Shift baru berhasil ditambahkan");
      }
      setShiftData({ name: "", start_time: "08:00", end_time: "17:00" });
      setEditingShiftId(null);
      fetchShifts();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyimpan shift");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShift = async (id: number) => {
    toast("Hapus master shift ini?", {
      description: "Jadwal penugasan yang memakai shift ini akan terpengaruh.",
      action: {
        label: "Hapus",
        onClick: async () => {
          try {
            await axiosInstance.delete(`/shifts/${id}`);
            toast.success("Shift berhasil dihapus");
            fetchShifts();
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal menghapus shift");
          }
        },
      },
    });
  };

  const handleOpenAddSchedule = (date?: string, userId?: number | string) => {
    setScheduleData({
      user_id: userId ? String(userId) : (shiftEmployees[0] ? String(shiftEmployees[0].id) : ""),
      shift_id: shifts[0] ? String(shifts[0].id) : "",
      date: date || new Date().toISOString().split('T')[0]
    });
    setIsScheduleModalOpen(true);
  };

  // Filter Shift Employees by Search
  const filteredShiftEmployees = shiftEmployees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (emp.role?.name && emp.role.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Calendar Helpers
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const getShiftBadgeStyle = (name?: string) => {
    const n = (name || '').toLowerCase();
    if (n.includes('pagi') || n.includes('morning')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (n.includes('siang') || n.includes('afternoon')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (n.includes('malam') || n.includes('night') || n.includes('noc')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    
    const days = [];
    // Padding for start day
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 border-b border-r border-gray-100 bg-gray-50/20"></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySchedules = schedules.filter(s => s.date === dateStr);
      const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

      days.push(
        <div key={d} className={`h-32 border-b border-r border-gray-100 p-2 hover:bg-gray-50/80 transition-colors group relative ${isToday ? 'bg-red-50/20' : ''}`}>
          <div className="flex justify-between items-start mb-1.5">
            <span className={`text-xs font-bold leading-none w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#8B0000] text-white shadow-xs' : 'text-gray-500 font-semibold'}`}>
              {d}
            </span>
            {daySchedules.length > 0 && (
              <span className="text-[9px] font-black text-[#8B0000] bg-red-100/60 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                {daySchedules.length} Shift
              </span>
            )}
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[75px] pr-0.5 custom-scrollbar">
            {daySchedules.map((s, idx) => (
              <div 
                key={idx} 
                className={`text-[10px] px-2 py-1 rounded-lg border shadow-xs flex items-center justify-between group/item hover:border-[#8B0000]/40 transition-all cursor-pointer ${getShiftBadgeStyle(s.shift?.name)}`}
                onClick={() => { if(hasPermission('manage-schedules')) handleDeleteSchedule(s.id); }}
                title="Klik untuk menghapus jadwal penugasan ini"
              >
                <div className="flex-1 min-w-0 pr-1">
                  <p className="font-bold text-gray-900 truncate tracking-tight">{s.user?.name}</p>
                  <p className="text-[8px] font-bold uppercase tracking-wider opacity-80">{s.shift?.name} ({s.shift?.start_time.slice(0,5)})</p>
                </div>
                <PermissionGuard slug="manage-schedules">
                  <Trash2 size={10} className="text-gray-400 hover:text-red-600 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0" />
                </PermissionGuard>
              </div>
            ))}
          </div>
          <PermissionGuard slug="manage-schedules">
            <button 
              onClick={() => handleOpenAddSchedule(dateStr)}
              className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-6 h-6 bg-[#8B0000] text-white rounded-lg flex items-center justify-center shadow-md transition-all transform scale-75 group-hover:scale-100 active:scale-90"
              title="Tambah shift di tanggal ini"
            >
               <Plus size={13} />
            </button>
          </PermissionGuard>
        </div>
      );
    }

    // End Padding
    const remainingDays = (7 - ((startDay + totalDays) % 7)) % 7;
    for (let i = 0; i < remainingDays; i++) {
       days.push(<div key={`empty-end-${i}`} className="h-32 border-b border-r border-gray-100 bg-gray-50/20"></div>);
    }

    return days;
  };

  return (
    <div className="animate-in fade-in duration-500 min-h-screen pb-20 space-y-6">
      {/* Page Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Penjadwalan & Shift</h1>
          <p className="dash-page-desc">
            Atur penugasan jadwal kerja harian khusus karyawan bertipe <strong>Shift</strong>. Toleransi keterlambatan otomatis berlaku sesuai pengaturan profil perusahaan & payroll.
          </p>
        </div>
        <div className="dash-page-actions flex flex-wrap gap-2 items-center">
           <div className="flex bg-white rounded-xl p-1 border border-gray-200 shadow-xs mr-2">
              <button 
                onClick={() => setViewMode("roster")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'roster' ? 'bg-[#8B0000] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <Columns size={15} />
                Roster Shift
              </button>
              <button 
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-[#8B0000] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <LayoutGrid size={15} />
                Kalender
              </button>
              <button 
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-[#8B0000] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <List size={15} />
                Daftar Tabel
              </button>
           </div>
          <PermissionGuard slug="manage-schedules">
            <button 
              onClick={() => window.open(`${axiosInstance.defaults.baseURL}/schedules/export`, '_blank')}
              className="dash-btn dash-btn-outline"
            >
              <FileDown size={15} />
              Export Roster
            </button>
            <button 
              onClick={() => setIsShiftModalOpen(true)}
              className="dash-btn dash-btn-outline group"
            >
              <Settings size={15} className="group-hover:rotate-90 transition-transform" />
              Master Shift ({shifts.length})
            </button>
            <button 
              onClick={() => handleOpenAddSchedule()}
              className="dash-btn dash-btn-primary"
            >
              <Plus size={15} />
              Buat Jadwal Shift
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs text-blue-900 gap-3">
        <div className="flex items-center gap-2.5">
          <Info size={16} className="text-blue-600 shrink-0" />
          <span>
            <strong>Aturan Absensi Shift:</strong> Toleransi keterlambatan yang disetel pada <strong>Profil Perusahaan</strong> dan <strong>Pengaturan Payroll</strong> tetap berlaku untuk setiap jam masuk shift karyawan.
          </span>
        </div>
        <span className="font-bold text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md shrink-0">
          {shiftEmployees.length} Karyawan Shift
        </span>
      </div>

      {viewMode === "calendar" ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Calendar Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900">
                {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
                <button 
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => setCurrentDate(new Date())}
                  className="px-2.5 py-1 text-xs font-bold text-gray-700 hover:text-[#8B0000] transition-colors"
                >
                  Bulan Ini
                </button>
                <button 
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-600">
              {shifts.map(sh => (
                <div key={sh.id} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${sh.name.toLowerCase().includes('pagi') ? 'bg-emerald-500' : sh.name.toLowerCase().includes('siang') ? 'bg-amber-500' : sh.name.toLowerCase().includes('malam') || sh.name.toLowerCase().includes('noc') ? 'bg-indigo-500' : 'bg-blue-500'}`}></span>
                  <span>{sh.name} ({sh.start_time.slice(0,5)}-{sh.end_time.slice(0,5)})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-100/60">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
              <div key={day} className="py-2.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {renderCalendar()}
          </div>
        </div>
      ) : viewMode === "roster" ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-gray-900">Roster Mingguan Karyawan Shift</h2>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
                <button 
                  onClick={() => setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => setCurrentDate(new Date())}
                  className="px-2.5 py-1 text-xs font-bold text-gray-700 hover:text-[#8B0000] transition-colors"
                >
                  Minggu Ini
                </button>
                <button 
                  onClick={() => setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Search Shift Employee */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Cari karyawan shift..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs bg-white rounded-lg border border-gray-200 focus:outline-none focus:border-[#8B0000] w-56 font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="sticky left-0 z-20 bg-gray-50/90 p-3.5 border-b border-r border-gray-200 w-64 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Karyawan Shift ({filteredShiftEmployees.length})
                  </th>
                  {[...Array(7)].map((_, i) => {
                    const d = new Date(currentDate);
                    const dayOffset = (d.getDay() === 0 ? -6 : 1) - d.getDay();
                    d.setDate(d.getDate() + dayOffset + i);
                    const isToday = new Date().toDateString() === d.toDateString();
                    return (
                      <th key={i} className={`p-3 border-b border-gray-200 text-center min-w-[130px] ${isToday ? 'bg-red-50/40 font-bold' : ''}`}>
                        <p className="text-[11px] font-bold text-gray-500 uppercase">{d.toLocaleDateString('id-ID', { weekday: 'short' })}</p>
                        <p className={`text-base font-black ${isToday ? 'text-[#8B0000]' : 'text-gray-900'}`}>{d.getDate()}</p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredShiftEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-gray-500">
                      <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-600">
                        <Users size={22} />
                      </div>
                      <p className="font-bold text-sm text-gray-800">Belum ada karyawan bertipe &ldquo;Shift&rdquo;</p>
                      <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                        Karyawan bertipe <em>Office Hour</em> otomatis mengikuti jam kantor. Untuk menjadwalkan shift operasional / NOC, ubah Pola Kehadiran karyawan menjadi <strong>Shift</strong> di menu Data Karyawan.
                      </p>
                      <Link 
                        href="/dashboard/employees"
                        className="inline-block mt-3 px-3.5 py-1.5 text-xs font-bold bg-[#8B0000] text-white rounded-lg hover:bg-[#6c0000] transition-colors"
                      >
                        Buka Data Karyawan
                      </Link>
                    </td>
                  </tr>
                ) : (
                  filteredShiftEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50/60 transition-colors group">
                      <td className="sticky left-0 z-20 bg-white border-b border-r border-gray-200 p-3 group-hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8 rounded-lg border border-gray-200">
                            <AvatarImage src={emp.profile_photo_url} />
                            <AvatarFallback className="bg-[#8B0000]/10 text-[#8B0000] font-bold text-xs">
                              {emp.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-xs truncate">{emp.name}</p>
                            <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">{emp.role?.name || 'Shift Worker'}</p>
                          </div>
                        </div>
                      </td>
                      {[...Array(7)].map((_, i) => {
                        const d = new Date(currentDate);
                        const dayOffset = (d.getDay() === 0 ? -6 : 1) - d.getDay();
                        d.setDate(d.getDate() + dayOffset + i);
                        const dStr = d.toISOString().split('T')[0];
                        const s = schedules.find(sc => sc.user_id === emp.id && sc.date === dStr);
                        return (
                          <td key={i} className="p-1.5 border-b border-gray-100 align-middle">
                            {s ? (
                              <div 
                                className={`p-2 rounded-xl border text-center transition-all cursor-pointer relative group/item hover:shadow-xs ${getShiftBadgeStyle(s.shift?.name)}`}
                                onClick={() => { if(hasPermission('manage-schedules')) handleDeleteSchedule(s.id); }}
                                title="Klik untuk menghapus jadwal ini"
                              >
                                 <span className="text-[10px] font-bold block truncate">{s.shift?.name}</span>
                                 <span className="text-[9px] font-medium opacity-75 block">{s.shift?.start_time.slice(0,5)} - {s.shift?.end_time.slice(0,5)}</span>
                                 <PermissionGuard slug="manage-schedules">
                                    <div className="absolute top-1 right-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                       <Trash2 size={10} className="text-gray-400 hover:text-red-600" />
                                    </div>
                                 </PermissionGuard>
                              </div>
                            ) : (
                              <PermissionGuard slug="manage-schedules">
                                <button 
                                  onClick={() => handleOpenAddSchedule(dStr, emp.id)}
                                  className="w-full h-10 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-700 transition-all group/btn"
                                  title={`Tugaskan shift ke ${emp.name} pada ${dStr}`}
                                >
                                  <Plus size={14} className="group-hover/btn:scale-125 transition-transform" />
                                </button>
                              </PermissionGuard>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="dash-table-container">
          {loading ? (
             <div className="p-6"><TableSkeleton rows={6} cols={5} /></div>
          ) : schedules.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                 <CalendarIcon size={22} />
              </div>
              <p className="text-gray-700 font-bold text-sm">Belum ada penugasan shift pada periode ini.</p>
              <p className="text-xs text-gray-400 mt-1">Klik tombol &ldquo;Buat Jadwal Shift&rdquo; di atas untuk menetapkan shift karyawan.</p>
            </div>
          ) : (
            <div className="dash-table-wrapper">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Karyawan Shift</th>
                    <th>Tanggal</th>
                    <th>Nama Shift</th>
                    <th>Waktu Kerja</th>
                    <PermissionGuard slug="manage-schedules">
                       <th className="text-right">Aksi</th>
                    </PermissionGuard>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-7 rounded-lg border border-gray-200">
                            <AvatarImage src={s.user?.profile_photo_url} />
                            <AvatarFallback className="bg-[#8B0000]/10 text-[#8B0000] font-bold text-xs">
                              {s.user?.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-gray-900 text-xs leading-none">{s.user?.name}</p>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">{s.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-gray-600 font-medium">
                        {new Date(s.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getShiftBadgeStyle(s.shift?.name)}`}>
                          {s.shift?.name}
                        </span>
                      </td>
                      <td className="text-xs text-gray-600 font-medium">
                        {s.shift?.start_time.slice(0,5)} - {s.shift?.end_time.slice(0,5)} WIB
                      </td>
                      <PermissionGuard slug="manage-schedules">
                        <td className="text-right">
                           <button onClick={() => handleDeleteSchedule(s.id)} className="dash-action-btn delete" title="Hapus Jadwal"><Trash2 size={13}/></button>
                        </td>
                      </PermissionGuard>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Assign Schedule */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Tetapkan Jadwal Shift</h2>
                <p className="text-xs text-gray-400">Pilih karyawan shift, jenis shift, dan tanggal</p>
              </div>
              <button onClick={() => setIsScheduleModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSchedule} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Karyawan Shift</label>
                <select 
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] text-xs font-medium text-gray-900 transition-all cursor-pointer"
                  value={scheduleData.user_id}
                  onChange={e => setScheduleData({...scheduleData, user_id: e.target.value})}
                  required
                >
                  <option value="">-- Pilih Karyawan Shift ({shiftEmployees.length}) --</option>
                  {shiftEmployees.map(emp => {
                    const roleDisplay = emp.role?.name ? ` • ${emp.role.name}` : '';
                    return <option key={emp.id} value={emp.id}>{emp.name}{roleDisplay}</option>;
                  })}
                </select>
                {shiftEmployees.length === 0 && (
                  <p className="text-[11px] text-amber-600 font-medium">
                    Belum ada karyawan bertipe &ldquo;Shift&rdquo;. Atur Pola Kehadiran karyawan di menu Data Karyawan.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Jenis Master Shift</label>
                <select 
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] text-xs font-medium text-gray-900 transition-all cursor-pointer"
                  value={scheduleData.shift_id}
                  onChange={e => setScheduleData({...scheduleData, shift_id: e.target.value})}
                  required
                >
                  <option value="">-- Pilih Shift ({shifts.length}) --</option>
                  {shifts.map(sh => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.start_time.slice(0,5)} - {sh.end_time.slice(0,5)})
                    </option>
                  ))}
                </select>
                {shifts.length === 0 && (
                  <p className="text-[11px] text-amber-600 font-medium">Belum ada master shift. Buat master shift terlebih dahulu di tombol &ldquo;Master Shift&rdquo;.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Tanggal Penugasan</label>
                <input 
                  type="date"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] text-xs font-medium text-gray-900 transition-all"
                  value={scheduleData.date}
                  onChange={e => setScheduleData({...scheduleData, date: e.target.value})}
                  required
                />
              </div>
              <div className="pt-3 flex gap-2">
                <button type="button" onClick={() => setIsScheduleModalOpen(false)} className="flex-1 h-10 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">Batal</button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || shiftEmployees.length === 0 || shifts.length === 0}
                  className="flex-1 h-10 rounded-lg bg-[#8B0000] text-white text-xs font-bold hover:bg-[#6c0000] transition-all shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Jadwal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manage Shifts (Scrollable Wheel/Column Time Picker) */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Manajemen Master Shift</h2>
                <p className="text-xs text-gray-400">Atur template jam kerja shift (Pagi, Siang, Malam/NOC, dll)</p>
              </div>
              <button onClick={() => setIsShiftModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col md:flex-row gap-6 overflow-hidden">
               {/* Shift Form */}
               <div className="w-full md:w-1/2 bg-white p-4 rounded-xl border border-gray-200 space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-900">
                      {editingShiftId ? "Edit Shift" : "Tambah Shift Baru"}
                    </h3>
                    {editingShiftId && (
                      <button 
                        type="button" 
                        onClick={() => { setEditingShiftId(null); setShiftData({name:"", start_time:"08:00", end_time:"17:00"}); }} 
                        className="text-[11px] font-bold text-red-600 hover:underline"
                      >
                        Batal Edit
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleShiftSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700">Nama Shift</label>
                      <input 
                        className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium focus:outline-none focus:border-[#8B0000]"
                        placeholder="Misal: Shift Pagi, NOC Shift 1, dsb"
                        value={shiftData.name}
                        onChange={e => setShiftData({...shiftData, name: e.target.value})}
                        required
                      />
                    </div>

                    {/* Scrollable Column Time Pickers */}
                    <div className="space-y-3">
                       <ScrollTimePicker 
                          label="Jam Masuk" 
                          value={shiftData.start_time} 
                          onChange={(val) => setShiftData(prev => ({ ...prev, start_time: val }))}
                          iconColor="text-emerald-600"
                       />

                       <ScrollTimePicker 
                          label="Jam Pulang" 
                          value={shiftData.end_time} 
                          onChange={(val) => setShiftData(prev => ({ ...prev, end_time: val }))}
                          iconColor="text-amber-600"
                       />
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-9.5 rounded-lg bg-[#8B0000] text-white text-xs font-bold hover:bg-[#6c0000] transition-all shadow-xs disabled:opacity-50"
                    >
                       {isSubmitting ? "Menyimpan..." : editingShiftId ? "Perbarui Shift" : "Simpan Shift Baru"}
                    </button>
                  </form>
               </div>

               {/* Shift List */}
               <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                  <h3 className="text-xs font-bold text-gray-900 mb-3">Daftar Shift Aktif ({shifts.length})</h3>
                  <div className="space-y-2">
                    {shifts.map(sh => (
                      <div key={sh.id} className="p-3 rounded-xl border border-gray-200 bg-white flex items-center justify-between hover:border-gray-300 transition-all">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[#8B0000]">
                             <Clock size={16} />
                           </div>
                           <div>
                              <p className="font-bold text-gray-900 text-xs">{sh.name}</p>
                              <p className="text-[10px] text-gray-500 font-semibold">{sh.start_time.slice(0,5)} - {sh.end_time.slice(0,5)} WIB</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-1">
                           <button 
                            onClick={() => { 
                              setEditingShiftId(sh.id); 
                              setShiftData({
                                name: sh.name, 
                                start_time: sh.start_time.slice(0,5), 
                                end_time: sh.end_time.slice(0,5)
                              }); 
                            }} 
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" 
                            title="Edit Shift"
                          >
                            <Edit2 size={13} />
                          </button>
                           <button 
                            onClick={() => handleDeleteShift(sh.id)} 
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors" 
                            title="Hapus Shift"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {shifts.length === 0 && (
                      <div className="p-8 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                        Belum ada data shift. Masukkan nama shift dan scroll jam & menit di samping untuk membuat shift baru.
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
