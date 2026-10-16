"use client";

import React, { useState, useEffect } from "react";
import { X, Volume2, Bell, Globe, Laptop, Check } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Language } from "@/lib/translations";

interface AppSettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export default function AppSettingsModal({ isOpen, onClose }: AppSettingsModalProps) {
  const { language, setLanguage } = useLanguage();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);

  useEffect(() => {
    const savedSound = localStorage.getItem("app_sound_enabled");
    if (savedSound !== null) {
      setSoundEnabled(savedSound === "true");
    }
    const savedDigest = localStorage.getItem("app_digest_enabled");
    if (savedDigest !== null) {
      setEmailDigest(savedDigest === "true");
    }
  }, [isOpen]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("app_sound_enabled", String(next));
    toast.success(next ? "Suara notifikasi diaktifkan" : "Suara notifikasi dimatikan");
  };

  const toggleDigest = () => {
    const next = !emailDigest;
    setEmailDigest(next);
    localStorage.setItem("app_digest_enabled", String(next));
    toast.success(next ? "Email digest mingguan diaktifkan" : "Email digest mingguan dimatikan");
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    toast.success(lang === "id" ? "Bahasa diubah ke Bahasa Indonesia" : "Language switched to English");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <button 
        type="button" 
        aria-label="Tutup modal"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-default border-0"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 z-10">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Laptop size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Pengaturan Aplikasi</h3>
              <p className="text-[11px] text-gray-500">Kustomisasi preferensi tampilan & suara</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200/50 rounded-full transition-colors text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-6 space-y-5">
          {/* Bahasa Tampilan */}
          <div>
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Globe size={14} className="text-gray-400" /> Bahasa Tampilan
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleLanguageChange("id")}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all ${
                  language === "id"
                    ? "border-[#8B0000] bg-red-50 text-[#8B0000]"
                    : "border-gray-200 hover:bg-gray-50 text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🇮🇩</span>
                  <span>Indonesia</span>
                </div>
                {language === "id" && <Check size={14} />}
              </button>

              <button
                type="button"
                onClick={() => handleLanguageChange("en")}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all ${
                  language === "en"
                    ? "border-[#8B0000] bg-red-50 text-[#8B0000]"
                    : "border-gray-200 hover:bg-gray-50 text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🇬🇧</span>
                  <span>English</span>
                </div>
                {language === "en" && <Check size={14} />}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            {/* Suara Notifikasi */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Volume2 size={14} className="text-gray-400" /> Suara Notifikasi Pop-up
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Bunyikan audio halus saat persetujuan atau pesan baru masuk
                </p>
              </div>
              <button
                type="button"
                onClick={toggleSound}
                className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                  soundEnabled ? "bg-[#8B0000]" : "bg-gray-200"
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${
                  soundEnabled ? "right-0.5" : "left-0.5"
                }`} />
              </button>
            </div>

            {/* Email Digest */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Bell size={14} className="text-gray-400" /> Ringkasan Laporan Mingguan
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Kirim rekapitulasi kehadiran tim ke email terdaftar
                </p>
              </div>
              <button
                type="button"
                onClick={toggleDigest}
                className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                  emailDigest ? "bg-[#8B0000]" : "bg-gray-200"
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${
                  emailDigest ? "right-0.5" : "left-0.5"
                }`} />
              </button>
            </div>
          </div>

          {/* Version Info */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>SaaS HRM On Time</span>
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-[10px] text-gray-600 font-bold">
              v1.0.8-PRO
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
