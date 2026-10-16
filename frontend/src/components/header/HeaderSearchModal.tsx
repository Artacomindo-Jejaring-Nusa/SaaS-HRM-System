"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, X, LayoutDashboard, Users, Clock, Calendar, 
  CreditCard, Wallet, CheckSquare, Shield, ArrowRight,
  Sparkles, FileText, Settings, User
} from "lucide-react";
import axiosInstance from "@/lib/axios";

export interface SearchItem {
  id: string;
  title: string;
  description?: string;
  href: string;
  category: "Menu" | "Pegawai" | "Aksi Cepat";
  icon?: React.ReactNode;
}

interface HeaderSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile?: () => void;
  onToggleLanguage?: () => void;
}

const STATIC_MENU_ITEMS: SearchItem[] = [
  { id: "dash", title: "Dashboard Utama", description: "Ringkasan statistik & KPI", href: "/dashboard", category: "Menu", icon: <LayoutDashboard size={16} /> },
  { id: "appr", title: "Portal Persetujuan & Monitoring", description: "Verifikasi pengajuan & absensi tim", href: "/dashboard/approvals", category: "Menu", icon: <CheckSquare size={16} /> },
  { id: "flow", title: "Alur Persetujuan (Workflow)", description: "Konfigurasi hierarki approval bertingkat", href: "/dashboard/approval-workflow", category: "Menu", icon: <Shield size={16} /> },
  { id: "emp", title: "Data Karyawan & Pegawai", description: "Kelola biodata, jabatan & penempatan", href: "/dashboard/employees", category: "Menu", icon: <Users size={16} /> },
  { id: "face", title: "Approval Registrasi Wajah", description: "Verifikasi pendaftaran biometrik", href: "/dashboard/face-approval", category: "Menu", icon: <User size={16} /> },
  { id: "live", title: "Live Tracking & Lokasi", description: "Pantau posisi petugas di lapangan", href: "/dashboard/live-tracking", category: "Menu", icon: <Clock size={16} /> },
  { id: "att", title: "Riwayat Presensi & Absensi", description: "Rekap log jam masuk & pulang", href: "/dashboard/attendance", category: "Menu", icon: <Clock size={16} /> },
  { id: "corr", title: "Koreksi Absen", description: "Perbaikan log absen bermasalah", href: "/dashboard/attendance-corrections", category: "Menu", icon: <Clock size={16} /> },
  { id: "swap", title: "Tukar Shift Kerja", description: "Permohonan pertukaran jadwal rekan", href: "/dashboard/shift-swap", category: "Menu", icon: <Clock size={16} /> },
  { id: "sched", title: "Jadwal & Shift Karyawan", description: "Master roster & rotasi tim", href: "/dashboard/schedules", category: "Menu", icon: <Calendar size={16} /> },
  { id: "leave", title: "Permohonan Cuti", description: "Pengajuan & sisa cuti tahunan", href: "/dashboard/leaves", category: "Menu", icon: <Calendar size={16} /> },
  { id: "permit", title: "Permohonan Izin Kerja", description: "Izin sakit, urusan dinas & dispensasi", href: "/dashboard/permits", category: "Menu", icon: <FileText size={16} /> },
  { id: "ot", title: "Pengajuan Lembur", description: "Catatan jam lembur & surat perintah", href: "/dashboard/overtimes", category: "Menu", icon: <Clock size={16} /> },
  { id: "reimb", title: "Klaim Biaya (Reimbursement)", description: "Klaim operasional, BBM & medis", href: "/dashboard/reimbursements", category: "Menu", icon: <CreditCard size={16} /> },
  { id: "fund", title: "Pengajuan Dana Operasional", description: "Permintaan kas bon & anggaran kegiatan", href: "/dashboard/fund-requests", category: "Menu", icon: <Wallet size={16} /> },
  { id: "pay", title: "Penggajian (Payroll)", description: "Batch gaji, slip gaji & komponen", href: "/dashboard/payroll", category: "Menu", icon: <CreditCard size={16} /> },
  { id: "roles", title: "Manajemen Jabatan & Akses", description: "Atur role & permission sistem", href: "/dashboard/roles", category: "Menu", icon: <Shield size={16} /> },
  { id: "comp", title: "Profil Perusahaan", description: "Identitas kantor, logo & legalitas", href: "/dashboard/company", category: "Menu", icon: <Settings size={16} /> },
];

export default function HeaderSearchModal({
  isOpen,
  onClose,
  onOpenProfile,
  onToggleLanguage,
}: HeaderSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [employeeResults, setEmployeeResults] = useState<SearchItem[]>([]);
  const [isSearchingEmployee, setIsSearchingEmployee] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search for employees
  useEffect(() => {
    if (!query.trim()) {
      setEmployeeResults([]);
      setIsSearchingEmployee(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingEmployee(true);
      try {
        const res = await axiosInstance.get(`/employees?search=${encodeURIComponent(query)}&per_page=5`);
        const list = res.data?.data?.data || res.data?.data || [];
        const items: SearchItem[] = list.map((emp: any) => ({
          id: `emp_${emp.id}`,
          title: emp.name,
          description: `${emp.role?.name || "Karyawan"} • NIK: ${emp.nik || emp.id}`,
          href: `/dashboard/employees?search=${encodeURIComponent(emp.name)}`,
          category: "Pegawai",
          icon: <User size={16} />
        }));
        setEmployeeResults(items);
      } catch (err) {
        console.error("Failed to query employees", err);
      } finally {
        setIsSearchingEmployee(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Filter static menu items
  const filteredMenus = STATIC_MENU_ITEMS.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }).slice(0, 8);

  // Quick Action items
  const quickActions: SearchItem[] = [
    {
      id: "qa_profile",
      title: "Edit Profil & Email Super Admin",
      description: "Perbarui identitas & email akun untuk pemulihan login",
      href: "#profile",
      category: "Aksi Cepat",
      icon: <Settings size={16} />
    },
    {
      id: "qa_lang",
      title: "Ganti Bahasa (Indonesia / English)",
      description: "Alihkan bahasa tampilan dashboard",
      href: "#language",
      category: "Aksi Cepat",
      icon: <Sparkles size={16} />
    }
  ];

  const allItems: SearchItem[] = [
    ...filteredMenus,
    ...employeeResults,
    ...quickActions.filter(qa => !query.trim() || qa.title.toLowerCase().includes(query.toLowerCase()))
  ];

  const handleSelectItem = useCallback((item: SearchItem) => {
    if (item.href === "#profile") {
      onClose();
      onOpenProfile?.();
      return;
    }
    if (item.href === "#language") {
      onClose();
      onToggleLanguage?.();
      return;
    }
    onClose();
    router.push(item.href);
  }, [onClose, onOpenProfile, onToggleLanguage, router]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % (allItems.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        handleSelectItem(allItems[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-100 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <Search size={20} className="text-[#8B0000] shrink-0" />
          <input 
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Ketik untuk mencari menu, pegawai, laporan, atau aksi cepat..."
            className="w-full bg-transparent text-sm sm:text-base font-medium text-gray-900 placeholder-gray-400 focus:outline-none"
            aria-label="Cari seluruh sistem"
          />
          {query ? (
            <button 
              type="button" 
              onClick={() => setQuery("")}
              className="p-1 hover:bg-gray-200/60 rounded-full text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
          ) : (
            <span className="hidden sm:inline-flex items-center text-[10px] font-bold text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-xs">
              ESC untuk tutup
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-3 space-y-4 max-h-[60vh] divide-y divide-gray-50">
          {allItems.length === 0 ? (
            <div className="py-16 text-center">
              <Search size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-bold text-gray-700">Tidak ada hasil ditemukan</p>
              <p className="text-xs text-gray-400 mt-1">Coba gunakan kata kunci lain seperti "Cuti", "Lembur", atau nama karyawan.</p>
            </div>
          ) : (
            <>
              {/* Category: Menu */}
              {filteredMenus.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Menu & Navigasi Halaman
                  </p>
                  <div className="space-y-1 mt-1">
                    {filteredMenus.map((item) => {
                      const idx = allItems.findIndex((it) => it.id === item.id);
                      const isSelected = idx === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectItem(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all group ${
                            isSelected ? "bg-[#8B0000] text-white shadow-sm" : "hover:bg-gray-50 text-gray-800"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-white/20 text-white" : "bg-red-50 text-[#8B0000]"
                            }`}>
                              {item.icon}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs sm:text-sm font-bold truncate ${isSelected ? "text-white" : "text-gray-900"}`}>
                                {item.title}
                              </p>
                              {item.description && (
                                <p className={`text-[11px] truncate ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <ArrowRight size={14} className={`shrink-0 transition-transform ${isSelected ? "text-white translate-x-1" : "text-gray-300 group-hover:translate-x-0.5"}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category: Pegawai */}
              {(isSearchingEmployee || employeeResults.length > 0) && (
                <div className="pt-2">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Data Pegawai / Karyawan
                    </p>
                    {isSearchingEmployee && <span className="text-[10px] text-gray-400 animate-pulse">Mencari...</span>}
                  </div>
                  <div className="space-y-1 mt-1">
                    {employeeResults.map((item) => {
                      const idx = allItems.findIndex((it) => it.id === item.id);
                      const isSelected = idx === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectItem(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all group ${
                            isSelected ? "bg-[#8B0000] text-white shadow-sm" : "hover:bg-gray-50 text-gray-800"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                              isSelected ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                            }`}>
                              {item.title.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs sm:text-sm font-bold truncate ${isSelected ? "text-white" : "text-gray-900"}`}>
                                {item.title}
                              </p>
                              <p className={`text-[11px] truncate ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                                {item.description}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                          }`}>
                            Buka Detail
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category: Quick Actions */}
              <div className="pt-2">
                <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Tindakan & Pengaturan Cepat
                </p>
                <div className="space-y-1 mt-1">
                  {quickActions.map((item) => {
                    const idx = allItems.findIndex((it) => it.id === item.id);
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all group ${
                          isSelected ? "bg-[#8B0000] text-white shadow-sm" : "hover:bg-gray-50 text-gray-800"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"
                          }`}>
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs sm:text-sm font-bold truncate ${isSelected ? "text-white" : "text-gray-900"}`}>
                              {item.title}
                            </p>
                            <p className={`text-[11px] truncate ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isSelected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          Aksi
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Shortcut Instructions */}
        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded text-[10px] text-gray-600 font-bold">↑</kbd> <kbd className="font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded text-[10px] text-gray-600 font-bold">↓</kbd> Navigasi</span>
            <span><kbd className="font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded text-[10px] text-gray-600 font-bold">↵</kbd> Pilih</span>
            <span><kbd className="font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded text-[10px] text-gray-600 font-bold">ESC</kbd> Batal</span>
          </div>
          <span className="font-bold text-[#8B0000]">Narwasthu Global Search</span>
        </div>
      </div>
    </div>
  );
}
