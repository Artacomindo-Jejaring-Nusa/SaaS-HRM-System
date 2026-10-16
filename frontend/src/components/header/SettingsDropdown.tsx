"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Settings, User, Shield, Laptop, HelpCircle, LogOut, 
  ChevronRight, Mail, Sparkles 
} from "lucide-react";

interface SettingsDropdownProps {
  user: any;
  isSuperAdmin: boolean;
  onOpenProfile: () => void;
  onOpenSecurity: () => void;
  onOpenAppSettings: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}

export default function SettingsDropdown({
  user,
  isSuperAdmin,
  onOpenProfile,
  onOpenSecurity,
  onOpenAppSettings,
  onLogout,
  isLoggingOut,
}: SettingsDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
          isOpen ? "bg-red-50 text-[#8B0000]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
        }`}
        title="Pengaturan Akun & Aplikasi"
        aria-label="Menu Pengaturan"
      >
        <Settings size={18} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-60 animate-in fade-in zoom-in-95 duration-150">
          {/* User Summary Card */}
          <div className="p-4 bg-gradient-to-br from-gray-50 to-red-50/20 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center shrink-0">
                {user?.profile_photo_url ? (
                  <img src={user.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-gray-600 text-sm">
                    {(user?.name || "S").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-extrabold text-xs sm:text-sm text-gray-900 truncate">
                    {user?.name || "Super Admin"}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-gray-500 truncate mt-0.5">
                  <Mail size={12} className="shrink-0 text-gray-400" />
                  <span className="truncate">{user?.email || "Email belum disetel"}</span>
                </div>
                <div className="mt-1">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block ${
                    isSuperAdmin ? "bg-[#8B0000] text-white" : "bg-gray-100 text-gray-700"
                  }`}>
                    {user?.role?.name || (isSuperAdmin ? "Super Admin" : "Karyawan")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Menu Options */}
          <div className="p-2 space-y-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenProfile();
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-red-50 group-hover:text-[#8B0000] text-gray-600 flex items-center justify-center transition-colors">
                  <User size={15} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 group-hover:text-[#8B0000] transition-colors">
                    Profil Saya
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {isSuperAdmin ? "Ubah nama, email recovery, kontak & foto" : "Ganti foto profil & info akun"}
                  </p>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenSecurity();
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-[#8B0000] flex items-center justify-center">
                  <Shield size={15} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 group-hover:text-[#8B0000] transition-colors">
                    Keamanan Akun
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Ganti kata sandi & proteksi login
                  </p>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenAppSettings();
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <Laptop size={15} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    Preferensi Aplikasi
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Suara notifikasi & format tampilan
                  </p>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/help-center");
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                  <HelpCircle size={15} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
                    Pusat Bantuan
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Panduan sistem & kontak dukungan
                  </p>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Footer Logout */}
          <div className="p-2 border-t border-gray-100 bg-gray-50/50">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
            >
              <LogOut size={14} />
              <span>{isLoggingOut ? "Sedang Keluar..." : "Keluar dari Akun"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
