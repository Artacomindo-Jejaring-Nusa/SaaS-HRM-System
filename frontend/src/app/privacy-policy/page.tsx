"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Clock,
  Printer,
  ArrowLeft,
  Info,
} from "lucide-react";
import { PrivacyPolicyViewer } from "@/components/privacy-policy/PrivacyPolicyViewer";

export default function PublicPrivacyPolicyPage() {
  const handlePrint = () => {
    if (typeof globalThis !== "undefined" && globalThis.print) {
      globalThis.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-800 transition-colors mr-2"
            >
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-800 text-white flex items-center justify-center font-bold text-sm shadow-md">
                OT
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                  OnTime HRMS
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  PT. Artacomindo Jejaring Nusa
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Cetak PDF</span>
            </button>
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-900 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              Portal Masuk
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-white via-rose-50/30 to-slate-50 dark:from-slate-900 dark:via-slate-900/60 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-900/50">
            <ShieldCheck size={14} />
            <span>Kepatuhan Undang-Undang PDP No. 27 Tahun 2022</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Kebijakan Privasi &amp; Pelindungan Data
          </h1>

          <p className="max-w-3xl mx-auto text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Transparansi menyeluruh terkait pengelolaan data biometrik ArcFace, pelacakan lokasi geofencing, integrasi perangkat, kompensasi payroll, serta pemrosesan data ketenagakerjaan pada platform OnTime HRMS.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
              <Info size={12} className="text-rose-800" />
              Versi 2.4 Enterprise
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
              <Clock size={12} className="text-rose-800" />
              12 Oktober 2026
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
              <Lock size={12} className="text-emerald-600" />
              Enkripsi AES-256 &amp; TLS 1.3
            </span>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PrivacyPolicyViewer />
      </main>
    </div>
  );
}
