"use client";

import { useEffect, useState, Suspense } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Search, 
  Settings, 
  X, 
  Users, 
  Sparkles, 
  CheckSquare, 
  Square, 
  Layers, 
  UserCheck, 
  AlertCircle,
  CalendarCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Pagination from "@/components/Pagination";
import { TableSkeleton } from "@/components/Skeleton";
import { useSearchParams } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
  leave_balance?: number;
}

interface PaginationData {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

type TargetType = "selected" | "all" | "role";
type BulkMode = "set" | "adjust";

interface IndividualModalProps {
  readonly employee: Employee;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function IndividualLeaveModal({ employee, isOpen, onClose, onSuccess }: Readonly<IndividualModalProps>) {
  const [balance, setBalance] = useState<number | "">(employee.leave_balance ?? 12);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('_method', 'PUT');
      data.append('leave_balance', balance.toString());
      data.append('name', employee.name);
      data.append('email', employee.email);
      data.append('role_id', employee.role_id.toString());

      await axiosInstance.post(`/employees/${employee.id}`, data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      alert("Sisa jatah cuti berhasil diperbarui!");
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error(error);
      const errorMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Terjadi kesalahan saat menyimpan data.";
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Ubah Jatah Cuti Karyawan</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Nama Karyawan</p>
              <p className="text-sm font-bold text-gray-900">{employee.name}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="individual-balance-input" className="text-xs font-semibold text-gray-700 block">
                Set Sisa Cuti Baru (Hari)
              </label>
              <input 
                id="individual-balance-input"
                type="number" 
                min="0"
                max="100"
                required
                autoFocus
                className="w-full px-3 py-2 text-lg font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000]"
                value={balance}
                onChange={(e) => setBalance(e.target.value ? Number.parseInt(e.target.value, 10) : "")}
              />
              <p className="text-[11px] text-gray-500 italic">
                Standar cuti tahunan umum adalah 12 hari kerja per tahun.
              </p>
            </div>
          </div>
          
          <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
            <button 
              type="button" 
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || balance === ""}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#800000] rounded-lg hover:bg-[#660000] transition-colors disabled:opacity-50 inline-flex items-center"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Sisa Cuti"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BulkModalProps {
  readonly isOpen: boolean;
  readonly targetType: TargetType;
  readonly setTargetType: (t: TargetType) => void;
  readonly selectedIds: readonly number[];
  readonly totalEmployees: number;
  readonly roles: readonly Role[];
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

interface BulkLeavePayload {
  mode: BulkMode;
  amount: number | "";
  target_type: TargetType;
  reason: string;
  user_ids?: readonly number[];
  role_id?: number | "";
}

function BulkLeaveModal({
  isOpen,
  targetType,
  setTargetType,
  selectedIds,
  totalEmployees,
  roles,
  onClose,
  onSuccess
}: Readonly<BulkModalProps>) {
  const [selectedRoleId, setSelectedRoleId] = useState<number | "">("");
  const [mode, setMode] = useState<BulkMode>("set");
  const [amount, setAmount] = useState<number | "">(12);
  const [reason, setReason] = useState("Penyesuaian Jatah Cuti");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const getConfirmationText = () => {
    if (targetType === "selected") {
      return `Terapkan perubahan jatah cuti pada ${selectedIds.length} karyawan terpilih?`;
    }
    if (targetType === "all") {
      return `Terapkan perubahan jatah cuti pada SEMUA (${totalEmployees}) karyawan?`;
    }
    return `Terapkan perubahan jatah cuti pada seluruh karyawan dengan peran yang dipilih?`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount === "") {
      alert("Masukkan jumlah hari cuti.");
      return;
    }

    if (targetType === "selected" && selectedIds.length === 0) {
      alert("Pilih minimal satu karyawan dari daftar tabel.");
      return;
    }

    if (targetType === "role" && !selectedRoleId) {
      alert("Pilih posisi / peran tujuan.");
      return;
    }

    if (!confirm(getConfirmationText())) return;

    setIsSubmitting(true);
    try {
      const payload: BulkLeavePayload = {
        mode,
        amount,
        target_type: targetType,
        reason,
      };

      if (targetType === "selected") {
        payload.user_ids = selectedIds;
      } else if (targetType === "role") {
        payload.role_id = selectedRoleId;
      }

      const res = await axiosInstance.post("/employees/bulk-leave-balance", payload);
      alert(res.data?.message || "Berhasil memperbarui jatah cuti massal!");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal memperbarui jatah cuti massal.";
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetCardClass = (type: TargetType) => {
    if (targetType === type) {
      return "border-[#800000] bg-red-50/30 text-[#800000] ring-1 ring-[#800000]";
    }
    if (type === "selected" && selectedIds.length === 0) {
      return "border-gray-200 bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed";
    }
    return "border-gray-200 hover:border-gray-300 text-gray-700 bg-white";
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-[#800000] flex items-center justify-center font-bold">
              ⚡
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Pengaturan Jatah Cuti Massal (Bulk Update)</h3>
              <p className="text-[11px] text-gray-500">Perbarui hak cuti banyak karyawan secara instan.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Target Selection */}
            <div>
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-2">
                1. Target Karyawan
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTargetType("selected")}
                  disabled={selectedIds.length === 0}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${getTargetCardClass("selected")}`}
                >
                  <UserCheck className="w-4 h-4 mb-2" />
                  <div>
                    <p className="text-xs font-bold">Terpilih</p>
                    <p className="text-[10px] text-gray-500">{selectedIds.length} Orang</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType("all")}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${getTargetCardClass("all")}`}
                >
                  <Users className="w-4 h-4 mb-2" />
                  <div>
                    <p className="text-xs font-bold">Semua</p>
                    <p className="text-[10px] text-gray-500">{totalEmployees} Karyawan</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType("role")}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${getTargetCardClass("role")}`}
                >
                  <Layers className="w-4 h-4 mb-2" />
                  <div>
                    <p className="text-xs font-bold">Per Peran</p>
                    <p className="text-[10px] text-gray-500">Berdasarkan Role</p>
                  </div>
                </button>
              </div>

              {targetType === "role" && (
                <div className="mt-3">
                  <label htmlFor="bulk-role-select" className="text-xs font-semibold text-gray-700 block mb-1">
                    Pilih Posisi/Peran
                  </label>
                  <select
                    id="bulk-role-select"
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value ? Number.parseInt(e.target.value, 10) : "")}
                    className="w-full h-9 px-3 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#800000]"
                    required
                  >
                    <option value="">-- Pilih Peran / Posisi --</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Mode Selection */}
            <div>
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-2">
                2. Metode Pembaruan
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode("set")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    mode === "set"
                      ? "border-[#800000] bg-red-50/30 text-[#800000] ring-1 ring-[#800000]"
                      : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                  }`}
                >
                  <p className="text-xs font-bold">Set Nilai Sama</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Semua disetel ke angka tertentu (misal: 12)</p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("adjust")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    mode === "adjust"
                      ? "border-[#800000] bg-red-50/30 text-[#800000] ring-1 ring-[#800000]"
                      : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                  }`}
                >
                  <p className="text-xs font-bold">Penyesuaian (+ / -)</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Tambah atau potong saldo berjalan</p>
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <label htmlFor="bulk-amount-input" className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                3. {mode === "set" ? "Jumlah Hari Baru" : "Jumlah Hari Penyesuaian (+/-)"}
              </label>
              <div className="relative">
                <input 
                  id="bulk-amount-input"
                  type="number" 
                  min={mode === "set" ? 0 : -50}
                  max="100"
                  required
                  className="w-full px-3.5 py-2.5 text-base font-bold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800000]"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number.parseInt(e.target.value, 10) : "")}
                  placeholder={mode === "set" ? "12" : "+1 atau -1"}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  Hari
                </span>
              </div>
              <p className="text-[11px] text-gray-500 italic">
                {mode === "set" 
                  ? "Contoh: Masukkan '12' untuk mengatur saldo seluruh target menjadi 12 hari."
                  : "Contoh: Masukkan '1' untuk menambah 1 hari (misal bonus cuti bersama) atau '-1' untuk memotong."}
              </p>
            </div>

            {/* Reason Input */}
            <div className="space-y-1.5">
              <label htmlFor="bulk-reason-input" className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                4. Catatan / Alasan (Opsional)
              </label>
              <input 
                id="bulk-reason-input"
                type="text" 
                maxLength={255}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#800000]"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Pembaruan Saldo Cuti Awal Tahun 2026"
              />
            </div>
          </div>
          
          <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-slate-50">
            <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Aksi ini akan dicatat di log audit aktivitas.</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting || amount === ""}
                className="px-5 py-2 text-xs font-bold text-white bg-[#800000] rounded-xl hover:bg-[#660000] transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
              >
                {isSubmitting ? "Memproses..." : "Terapkan Perubahan"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeaveBalancesContent() {
  const { hasPermission } = useAuth();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [searchQuery, setSearchQuery] = useState(urlSearch || "");
  const [page, setPage] = useState(1);

  // Selection states for Bulk Action
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTargetType, setBulkTargetType] = useState<TargetType>("selected");

  useEffect(() => {
    fetchEmployees(page);
    fetchRoles();
  }, [searchQuery, page, urlSearch]);

  const fetchEmployees = async (p = 1) => {
    try {
      setLoading(true);
      const s = urlSearch || searchQuery;
      const response = await axiosInstance.get(`/employees?page=${p}&search=${s}`);
      const { data, ...paginator } = response.data.data;
      setEmployees(data || []);
      setPagination(paginator);
    } catch (e) {
      console.error("Gagal mendapatkan data karyawan", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await axiosInstance.get("/roles");
      if (res.data?.data) {
        setRoles(res.data.data);
      }
    } catch (e) {
      console.error("Gagal memuat roles", e);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === employees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleOpenBulkModal = (target?: TargetType) => {
    if (target) {
      setBulkTargetType(target);
    } else if (selectedIds.length > 0) {
      setBulkTargetType("selected");
    } else {
      setBulkTargetType("all");
    }
    setIsBulkModalOpen(true);
  };

  const getRoleDisplayName = (emp: Employee) => {
    if (emp.role?.name) return emp.role.name;
    if (emp.role_id === 1) return "Super Admin";
    if (emp.role_id === 2) return "HR";
    return "Karyawan";
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAllSelected = employees.length > 0 && selectedIds.length === employees.length;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="dash-page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="dash-page-title flex items-center gap-2.5">
            <CalendarCheck className="w-6 h-6 text-[#800000]" />
            Pengaturan Hak Cuti Karyawan
          </h1>
          <p className="dash-page-desc">Kelola dan sesuaikan saldo sisa cuti tahunan milik setiap karyawan secara terpusat atau massal.</p>
        </div>

        {hasPermission('edit-employees') && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenBulkModal("all")}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
            >
              <Users className="w-4 h-4 text-gray-500" />
              Set Semua Karyawan
            </button>

            <button
              type="button"
              onClick={() => handleOpenBulkModal(selectedIds.length > 0 ? "selected" : "all")}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#800000] text-white hover:bg-[#660000] transition-all shadow-sm flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              ⚡ Atur Massal {selectedIds.length > 0 ? `(${selectedIds.length} Terpilih)` : ""}
            </button>
          </div>
        )}
      </div>

      {/* Floating Selection Bar (if items selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="bg-[#800000] text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {selectedIds.length} Karyawan Terpilih
            </div>
            <span className="text-xs text-red-900 font-medium hidden sm:inline">
              Pilih tindakan untuk memperbarui jatah cuti karyawan yang dicentang.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenBulkModal("selected")}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#800000] text-white hover:bg-[#660000] transition-colors"
            >
              Ubah Saldo Terpilih
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white p-3 border border-gray-100 rounded-xl shadow-sm">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Cari nama atau email karyawan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="dash-table-container">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={6} cols={5} /></div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Tidak ada data karyawan ditemukan.
          </div>
        ) : (
          <div className="dash-table-wrapper">
            <table className="dash-table">
              <thead>
                <tr>
                  {hasPermission('edit-employees') && (
                    <th className="w-10 text-center">
                      <button 
                        type="button" 
                        onClick={handleSelectAll} 
                        className="text-gray-400 hover:text-[#800000] transition-colors"
                        title={isAllSelected ? "Batal pilih semua" : "Pilih semua di halaman ini"}
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#800000]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                  )}
                  <th>Info Pekerja</th>
                  <th>Posisi/Peran</th>
                  <th className="text-center">Sisa Cuti Saat Ini</th>
                  {hasPermission('edit-employees') && <th className="text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const isSelected = selectedIds.includes(emp.id);
                  const isLow = (emp.leave_balance || 0) <= 2;
                  const balanceBadgeClass = isLow 
                    ? "bg-red-50 text-red-600 border-red-200" 
                    : "bg-green-50 text-green-700 border-green-200";

                  return (
                    <tr 
                      key={emp.id} 
                      className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-red-50/40' : ''}`}
                    >
                      {hasPermission('edit-employees') && (
                        <td className="text-center">
                          <button 
                            type="button" 
                            onClick={() => handleToggleSelect(emp.id)} 
                            className="text-gray-400 hover:text-[#800000] transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#800000]" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 border border-gray-100">
                            <AvatarImage src={emp.profile_photo_url} alt={emp.name} />
                            <AvatarFallback className="bg-gray-100 text-gray-500 font-bold uppercase text-[10px]">
                              {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 leading-tight">{emp.name}</span>
                            <span className="text-[10px] text-gray-500 font-medium">{emp.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md">
                          {getRoleDisplayName(emp)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black tracking-wide border ${balanceBadgeClass}`}>
                          {emp.leave_balance ?? 12} Hari
                        </div>
                      </td>
                      {hasPermission('edit-employees') && (
                        <td className="text-right">
                          <button 
                            type="button"
                            className="dash-btn dash-btn-outline h-8 px-3 text-xs inline-flex items-center gap-1.5 hover:bg-gray-100" 
                            title="Sesuaikan Jatah Cuti"
                            onClick={() => setSelectedEmployee(emp)}
                          >
                            <Settings size={14} />
                            Ubah Cuti
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination && pagination.total > 0 && (
          <Pagination 
            currentPage={pagination.current_page} 
            lastPage={pagination.last_page} 
            total={pagination.total} 
            onPageChange={setPage} 
          />
        )}
      </div>

      {/* Individual Modal */}
      {selectedEmployee && (
        <IndividualLeaveModal
          employee={selectedEmployee}
          isOpen={Boolean(selectedEmployee)}
          onClose={() => setSelectedEmployee(null)}
          onSuccess={() => fetchEmployees(pagination?.current_page || 1)}
        />
      )}

      {/* Bulk Modal */}
      <BulkLeaveModal
        isOpen={isBulkModalOpen}
        targetType={bulkTargetType}
        setTargetType={setBulkTargetType}
        selectedIds={selectedIds}
        totalEmployees={pagination?.total || employees.length}
        roles={roles}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={() => {
          setSelectedIds([]);
          fetchEmployees(pagination?.current_page || 1);
        }}
      />
    </div>
  );
}

export default function LeaveBalancesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500"><TableSkeleton rows={5} cols={5} /></div>}>
      <LeaveBalancesContent />
    </Suspense>
  );
}
