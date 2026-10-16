"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { toast } from "sonner";
import { Language } from "@/lib/translations";
import { useLanguage } from "@/contexts/LanguageContext";

interface LanguageDropdownProps {
  language?: Language;
  setLanguage?: (lang: Language) => void;
}

export default function LanguageDropdown({ language: propLang, setLanguage: propSetLang }: LanguageDropdownProps = {}) {
  const context = useLanguage();
  const language = propLang || context.language;
  const setLanguage = propSetLang || context.setLanguage;

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

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    setIsOpen(false);
    toast.success(
      lang === "id"
        ? "Bahasa berhasil diubah ke Bahasa Indonesia"
        : "Language switched to English successfully"
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-200/80 text-gray-700 text-xs font-bold shadow-xs hover:border-gray-300 focus:outline-none"
        title="Ubah Bahasa / Switch Language"
        aria-label="Pilih Bahasa"
      >
        <span className="text-sm leading-none">{language === "id" ? "🇮🇩" : "🇬🇧"}</span>
        <span className="uppercase tracking-wider font-extrabold">{language}</span>
        <ChevronDown size={12} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-60 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-gray-50 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Globe size={12} /> Pilih Bahasa
            </span>
            <span className="text-[9px] bg-red-50 text-[#8B0000] font-bold px-1.5 py-0.5 rounded">
              Bilingual
            </span>
          </div>

          <div className="p-1 space-y-1">
            <button
              type="button"
              onClick={() => handleSelect("id")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-colors ${
                language === "id" ? "bg-red-50 text-[#8B0000]" : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">🇮🇩</span>
                <div className="flex flex-col">
                  <span className="font-bold">Bahasa Indonesia</span>
                  <span className="text-[10px] text-gray-400 font-normal">Bahasa utama sistem</span>
                </div>
              </div>
              {language === "id" && <Check size={16} className="text-[#8B0000]" />}
            </button>

            <button
              type="button"
              onClick={() => handleSelect("en")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-colors ${
                language === "en" ? "bg-red-50 text-[#8B0000]" : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">🇬🇧</span>
                <div className="flex flex-col">
                  <span className="font-bold">English</span>
                  <span className="text-[10px] text-gray-400 font-normal">Global interface language</span>
                </div>
              </div>
              {language === "en" && <Check size={16} className="text-[#8B0000]" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
