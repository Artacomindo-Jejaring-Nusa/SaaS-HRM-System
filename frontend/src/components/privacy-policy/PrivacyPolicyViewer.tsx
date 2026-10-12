"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { policySections } from "@/lib/privacy-policy-data";
import { PolicySectionCard } from "./PolicySectionCard";

export function PrivacyPolicyViewer() {
  const [activeTab, setActiveTab] = useState<"all" | "employee" | "admin">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    return policySections.filter((section) => {
      const matchesTab =
        activeTab === "all" ||
        section.audience === "all" ||
        section.audience === activeTab;

      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesTab;

      const matchesSearch =
        section.title.toLowerCase().includes(query) ||
        section.summary.toLowerCase().includes(query) ||
        section.badge.toLowerCase().includes(query) ||
        section.content.some((c) => c.toLowerCase().includes(query)) ||
        Boolean(section.keyPoints?.some((kp) => kp.toLowerCase().includes(query))) ||
        Boolean(section.adminNotes?.some((an) => an.toLowerCase().includes(query)));

      return matchesTab && matchesSearch;
    });
  }, [activeTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Filter Tabs & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Role Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === "all"
                ? "bg-rose-800 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Semua Ketentuan ({policySections.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("employee")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === "employee"
                ? "bg-rose-800 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Panduan Karyawan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("admin")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === "admin"
                ? "bg-rose-800 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Kewajiban Super Admin
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kata kunci (cth: biometrik, gps, gaji)..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Main Content Layout: Sidebar Table of Contents + Policy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Quick Jump Sidebar */}
        <div className="lg:col-span-1 hidden lg:block">
          <div className="sticky top-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Daftar Pasal Kebijakan
            </h3>
            <nav className="space-y-1 max-h-[70vh] overflow-y-auto pr-1 text-xs">
              {policySections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition-colors group"
                >
                  <span className="truncate pr-2">
                    <span className="font-bold text-slate-400 group-hover:text-rose-700 mr-1.5">
                      {sec.number}.
                    </span>
                    {sec.title}
                  </span>
                  <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 text-rose-700 shrink-0" />
                </a>
              ))}
            </nav>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                PT. Artacomindo Jejaring Nusa
              </p>
              <p>Pengembang &amp; Pengelola Sistem OnTime HRMS</p>
            </div>
          </div>
        </div>

        {/* Policy Sections List */}
        <div className="lg:col-span-3 space-y-5">
          {filteredSections.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 text-center space-y-2">
              <AlertTriangle className="mx-auto text-amber-500" size={28} />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Tidak ada pasal yang cocok dengan pencarian &quot;{searchQuery}&quot;
              </p>
              <p className="text-xs text-slate-500">
                Coba gunakan kata kunci lain seperti biometrik, gps, gaji, atau device.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTab("all");
                }}
                className="mt-2 text-xs font-semibold text-rose-800 hover:underline"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            filteredSections.map((sec) => (
              <PolicySectionCard key={sec.id} section={sec} />
            ))
          )}

          {/* Footer Statement */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
            <ShieldCheck size={28} className="mx-auto text-rose-800 dark:text-rose-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Pernyataan Kepatuhan PT. Artacomindo Jejaring Nusa
            </h3>
            <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
              Kami terus memperbarui infrastruktur dan kepatuhan hukum OnTime HRMS demi melindungi privasi seluruh karyawan dan mendukung terciptanya lingkungan kerja yang adil, transparan, dan modern di seluruh Indonesia.
            </p>
            <p className="text-xs font-bold text-rose-900 dark:text-rose-400 pt-2">
              PT. Artacomindo Jejaring Nusa • OnTime HRMS Enterprise
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
