"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { 
  Search, 
  Calendar, 
  ShieldCheck, 
  X, 
  Info, 
  Settings2, 
  Home, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Building2,
  CalendarRange
} from "lucide-react";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useDebounce } from "@/hooks/useDebounce";
import { TableSkeleton } from "@/components/Skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Pagination from "@/components/Pagination";

interface Role {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  nik?: string;
  role?: Role;
  role_id: number;
  profile_photo_url?: string;
  is_wfh: boolean;
  wfh_start_date?: string;
  wfh_end_date?: string;
}

interface PaginationData {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

type WfaFilterTab = "all" | "active" | "scheduled" | "office";

const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
};

const getDaysRemaining = (endDate?: string, todayStr?: string) => {
  if (!endDate) return null;
  const end = new Date(endDate);
  const today = new Date(todayStr || new Date().toISOString().split("T")[0]);
  const diffTime = end.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

function EmployeeWfaStatusBadge({ 
  isDateActive, 
  isScheduledFuture, 
  isWfh 
}: Readonly<{ 
  isDateActive: boolean; 
  isScheduledFuture: boolean; 
  isWfh: boolean; 
}>) {
  if (isDateActive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>🏡 WFA Aktif</span>
      </span>
    );
  }

  if (isScheduledFuture) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={11} />
        <span>📅 Terjadwal</span>
      </span>
    );
  }

  if (isWfh) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight bg-gray-100 text-gray-500 border border-gray-200">
        <span>Kedaluwarsa</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight bg-slate-50 text-slate-500 border border-slate-200">
      <Building2 size={11} className="text-slate-400" />
      <span>Di Kantor</span>
    </span>
  );
}

function EmployeeWfaRow({
  emp,
  todayStr,
  isSelected,
  onToggleSelect,
  onOpenModal,
}: Readonly<{
  emp: Employee;
  todayStr: string;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onOpenModal: (emp: Employee) => void;
}>) {
  const isDateActive = Boolean(
    emp.is_wfh && 
    emp.wfh_start_date && 
    emp.wfh_end_date && 
    todayStr >= emp.wfh_start_date && 
    todayStr <= emp.wfh_end_date
  );

  const isScheduledFuture = Boolean(
    emp.is_wfh && 
    emp.wfh_start_date && 
    todayStr < emp.wfh_start_date
  );

  const remainingDays = isDateActive ? getDaysRemaining(emp.wfh_end_date, todayStr) : null;

  return (
    <tr 
      key={emp.id} 
      className={`hover:bg-indigo-50/20 transition-colors ${isSelected ? "bg-indigo-50/40" : ""}`}
    >
      <td className="px-4 py-3 text-center">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onToggleSelect(emp.id)}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-9 border border-gray-100 shadow-2xs">
            <AvatarImage src={emp.profile_photo_url} alt={emp.name} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-black text-xs">
              {emp.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-gray-900 truncate">{emp.name}</span>
            <span className="text-[11px] text-gray-400 truncate">{emp.email}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-semibold">
          {emp.role?.name || "Karyawan"}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <EmployeeWfaStatusBadge 
          isDateActive={isDateActive} 
          isScheduledFuture={isScheduledFuture} 
          isWfh={Boolean(emp.is_wfh)} 
        />
      </td>
      <td className="px-4 py-3">
        {emp.is_wfh && emp.wfh_start_date ? (
          <div className="flex flex-col">
            <span className="font-semibold text-gray-800 text-[11px]">
              {formatDate(emp.wfh_start_date)} - {formatDate(emp.wfh_end_date)}
            </span>
            {isDateActive && remainingDays !== null && (
              <span className="text-[10px] text-emerald-600 font-bold">
                {remainingDays === 0 ? "Berakhir hari ini" : `Sisa ${remainingDays} hari`}
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-[11px] italic">Presensi kantor normal</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <PermissionGuard slug="manage-wfh">
          <button
            type="button"
            onClick={() => onOpenModal(emp)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isDateActive
                ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/80"
                : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200/80"
            }`}
          >
            <Settings2 size={13} />
            <span>{isDateActive ? "Ubah / Stop" : "Atur WFA"}</span>
          </button>
        </PermissionGuard>
      </td>
    </tr>
  );
}

function WFHContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [page, setPage] = useState(1);
  const [filterTab, setFilterTab] = useState<WfaFilterTab>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalMode, setModalMode] = useState<"single" | "bulk">("single");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [wfhData, setWfhData] = useState({
    is_wfh: true,
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  });

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterTab]);

  useEffect(() => {
    fetchEmployees(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, filterTab]);

  const fetchEmployees = async (pageNum = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        search: debouncedSearch,
        is_wfh: filterTab,
        per_page: "15"
      });
      const response = await axiosInstance.get(`/employees?${params.toString()}`);
      const { data, ...paginator } = response.data.data;
      setEmployees(data || []);
      setPagination(paginator);
    } catch (e) {
      console.error("Gagal mendapatkan data karyawan", e);
      toast.error("Gagal memuat data karyawan");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(employees.map(emp => emp.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleOpenSingleModal = (emp: Employee) => {
    setModalMode("single");
    setSelectedEmployee(emp);
    
    // Default to active with either existing dates or next 7 days
    const isCurrentlyActive = !!(emp.is_wfh && emp.wfh_start_date && emp.wfh_end_date && 
      todayStr >= emp.wfh_start_date && todayStr <= emp.wfh_end_date);

    setWfhData({
      is_wfh: !isCurrentlyActive,
      start_date: emp.wfh_start_date || todayStr,
      end_date: emp.wfh_end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    });
    setIsModalOpen(true);
  };

  const handleOpenBulkModal = () => {
    if (selectedIds.length === 0) {
      toast.warning("Pilih minimal satu karyawan untuk pengaturan massal.");
      return;
    }
    setModalMode("bulk");
    setSelectedEmployee(null);
    setWfhData({
      is_wfh: true,
      start_date: todayStr,
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEmployee(null);
  };

  const applyPresetDays = (days: number) => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + (days - 1));
    setWfhData(prev => ({
      ...prev,
      is_wfh: true,
      start_date: start.toISOString().split("T")[0],
      end_date: end.toISOString().split("T")[0]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (modalMode === "single" && selectedEmployee) {
        await axiosInstance.post(`/employees/${selectedEmployee.id}/toggle-wfh`, wfhData);
        toast.success(
          wfhData.is_wfh
            ? `Izin WFA berhasil diaktifkan untuk ${selectedEmployee.name}`
            : `Izin WFA berhasil dinonaktifkan untuk ${selectedEmployee.name}`
        );
      } else if (modalMode === "bulk") {
        await axiosInstance.post(`/employees/bulk-wfh`, {
          ...wfhData,
          ids: selectedIds
        });
        toast.success(
          wfhData.is_wfh
            ? `Izin WFA berhasil diaktifkan untuk ${selectedIds.length} karyawan terpilih`
            : `Izin WFA dinonaktifkan untuk ${selectedIds.length} karyawan terpilih`
        );
        setSelectedIds([]);
      }
      handleCloseModal();
      fetchEmployees(page);
    } catch (error: unknown) {
      console.error(error);
      let errorMsg = "Gagal memperbarui status WFA.";
      if (typeof error === "object" && error !== null && "response" in error) {
        const responseData = (error as { response?: { data?: { message?: string } } }).response?.data;
        if (responseData?.message) errorMsg = responseData.message;
      }
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold mb-1">
            <Home size={13} className="text-indigo-300" />
            <span>Fitur Khusus Super Admin & HR</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
            <span>Manajemen WFA</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Work From Anywhere
            </span>
          </h1>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Aktifkan izin kerja fleksibel untuk karyawan tertentu. Karyawan dengan status WFA aktif dapat melakukan absensi dari mana saja tanpa terkena peringatan radius kantor, dengan verifikasi wajah Face AI tetap berjalan.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          {selectedIds.length > 0 && (
            <button 
              onClick={handleOpenBulkModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Settings2 size={16} />
              Atur WFA Massal ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Explanatory Info Card */}
      <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start gap-3.5 text-indigo-950 text-xs">
        <div className="p-2 rounded-xl bg-indigo-100/80 text-indigo-700 shrink-0 mt-0.5">
          <Info size={18} />
        </div>
        <div className="space-y-1 leading-relaxed">
          <p className="font-bold text-indigo-900 text-[13px]">
            Bagaimana Cara Kerja WFA di Sistem Presensi?
          </p>
          <ul className="list-disc pl-4 space-y-0.5 text-indigo-800">
            <li><b>Aktivasi oleh Super Admin:</b> Karyawan yang diberi izin WFA akan menerima notifikasi langsung di akun mereka.</li>
            <li><b>Layar Absen Karyawan:</b> Pada halaman Presensi Live, tab <b>🏡 WFA</b> otomatis muncul dan batasan radius geofencing dinonaktifkan.</li>
            <li><b>Laporan & Monitoring:</b> Kehadiran otomatis dilabeli sebagai <b>WFA</b> (berbeda dari Di Kantor dan Dinas Luar) untuk mempermudah audit HRD.</li>
          </ul>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterTab("active")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === "active"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>WFA Aktif</span>
          </button>
          <button
            onClick={() => setFilterTab("scheduled")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === "scheduled"
                ? "bg-amber-600 text-white shadow-sm shadow-amber-600/20"
                : "text-amber-700 bg-amber-50 hover:bg-amber-100/70"
            }`}
          >
            <Clock size={12} />
            <span>Terjadwal</span>
          </button>
          <button
            onClick={() => setFilterTab("office")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === "office"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-gray-600 bg-gray-100 hover:bg-gray-200/70"
            }`}
          >
            <Building2 size={12} />
            <span>Di Kantor (Normal)</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/40 overflow-hidden">
        {loading && (
          <div className="p-8">
            <TableSkeleton rows={6} cols={5} />
          </div>
        )}

        {!loading && employees.length === 0 && (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
              <Home size={26} />
            </div>
            <h3 className="text-base font-bold text-gray-800">Tidak ada data karyawan ditemukan</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              {searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}". Coba kata kunci lain.` : "Belum ada karyawan pada filter ini."}
            </p>
          </div>
        )}

        {!loading && employees.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="px-4 py-3.5 w-10 text-center">
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll}
                      checked={selectedIds.length === employees.length && employees.length > 0}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    Karyawan
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    Posisi / Jabatan
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">
                    Status Izin
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    Periode WFA
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-gray-500 uppercase tracking-wider text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {employees.map((emp) => (
                  <EmployeeWfaRow
                    key={emp.id}
                    emp={emp}
                    todayStr={todayStr}
                    isSelected={selectedIds.includes(emp.id)}
                    onToggleSelect={handleSelectRow}
                    onOpenModal={handleOpenSingleModal}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/40">
            <Pagination 
              currentPage={pagination.current_page} 
              lastPage={pagination.last_page} 
              total={pagination.total} 
              onPageChange={setPage} 
            />
          </div>
        )}
      </div>

      {/* Modern Configuration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-slate-900 text-white">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                  <Home size={11} />
                  {modalMode === "bulk" ? "Massal" : "Individual"}
                </div>
                <h3 className="font-black text-xl text-white tracking-tight">
                  {modalMode === "bulk" ? "Pengaturan WFA Massal" : "Konfigurasi Izin WFA"}
                </h3>
                <p className="text-xs text-slate-300">
                  {modalMode === "bulk" 
                    ? `Mengatur izin WFA untuk ${selectedIds.length} karyawan terpilih` 
                    : selectedEmployee?.name}
                </p>
              </div>
              <button 
                onClick={handleCloseModal} 
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Toggle WFA Status */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    wfhData.is_wfh ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-500"
                  }`}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-gray-900 block">Status Izin WFA</span>
                    <span className={`text-[11px] font-black uppercase tracking-wider ${
                      wfhData.is_wfh ? "text-emerald-600" : "text-gray-400"
                    }`}>
                      {wfhData.is_wfh ? "AKTIF (Bisa Absen dari Mana Saja)" : "NONAKTIF (Presensi di Kantor)"}
                    </span>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => setWfhData(prev => ({ ...prev, is_wfh: !prev.is_wfh }))}
                  className={`w-14 h-7 rounded-full transition-all relative cursor-pointer ${
                    wfhData.is_wfh ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${
                    wfhData.is_wfh ? "right-1" : "left-1"
                  }`} />
                </button>
              </div>

              {wfhData.is_wfh && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Quick Preset Durations */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                      <Sparkles size={13} className="text-indigo-500" />
                      Pilihan Durasi Cepat
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Hari Ini", days: 1 },
                        { label: "3 Hari", days: 3 },
                        { label: "7 Hari (1 Mg)", days: 7 },
                        { label: "14 Hari (2 Mg)", days: 14 },
                        { label: "30 Hari (1 Bln)", days: 30 },
                      ].map((preset) => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => applyPresetDays(preset.days)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 transition-all cursor-pointer active:scale-95"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Range Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider flex items-center gap-1">
                        <Calendar size={12} className="text-gray-400" />
                        Mulai Tanggal
                      </label>
                      <input 
                        type="date"
                        required={wfhData.is_wfh}
                        className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={wfhData.start_date}
                        onChange={(e) => setWfhData({ ...wfhData, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider flex items-center gap-1">
                        <CalendarRange size={12} className="text-gray-400" />
                        Sampai Tanggal
                      </label>
                      <input 
                        type="date"
                        required={wfhData.is_wfh}
                        min={wfhData.start_date}
                        className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={wfhData.end_date}
                        onChange={(e) => setWfhData({ ...wfhData, end_date: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Information Callout */}
                  <div className="p-3.5 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900 leading-relaxed">
                    <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-indigo-950">Apa yang terjadi setelah disimpan?</p>
                      <p className="text-[11px] text-indigo-800 mt-0.5">
                        Karyawan akan otomatis menerima notifikasi personal di aplikasi dan tab <b>🏡 WFA</b> akan muncul di layar absen tanpa kunci geofencing kantor.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="flex-1 h-11 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WFHPage() {
  return (
    <PermissionGuard slug="manage-wfh">
      <Suspense fallback={<div className="p-10 text-center text-gray-400">Memuat modul WFA...</div>}>
        <WFHContent />
      </Suspense>
    </PermissionGuard>
  );
}
