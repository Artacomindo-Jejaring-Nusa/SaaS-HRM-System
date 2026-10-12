"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  UserCheck,
  Clock,
  Printer,
  CheckCircle2,
  ExternalLink,
  Info,
  ShieldAlert,
  Server,
} from "lucide-react";
import { PrivacyPolicyViewer } from "@/components/privacy-policy/PrivacyPolicyViewer";

export default function PrivacyPolicyDashboardPage() {
  const handlePrint = () => {
    if (typeof globalThis !== "undefined" && globalThis.print) {
      globalThis.print();
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Hero Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 rounded-3xl p-6 sm:p-8 lg:p-10 text-white shadow-xl border border-rose-900/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-80 h-80 bg-red-800/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold backdrop-blur-md">
              <ShieldCheck size={14} className="text-rose-400" />
              <span>Dokumen Resmi &amp; Kepatuhan Regulasi UU PDP</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Kebijakan Privasi &amp; Perlindungan Data Pribadi
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Komitmen transparansi penuh ekosistem OnTime HRMS (PT. Artacomindo Jejaring Nusa) dalam menjamin keamanan data biometrik, lokasi presensi, finansial payroll, serta integritas informasi bagi seluruh Karyawan dan Super Admin Perusahaan.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-sm">
                <Info size={12} className="text-rose-300" />
                Versi 2.4 Enterprise
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-sm">
                <Clock size={12} className="text-rose-300" />
                Terakhir Diperbarui: 12 Oktober 2026
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-sm">
                <Lock size={12} className="text-emerald-400" />
                Enkripsi TLS 1.3 &amp; AES-256
              </span>
            </div>
          </div>

          <div className="flex flex-row lg:flex-col gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all shadow-sm hover:shadow"
            >
              <Printer size={15} />
              <span>Cetak / Simpan PDF</span>
            </button>
            <Link
              href="/privacy-policy"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold transition-all shadow-md hover:shadow-lg"
            >
              <ExternalLink size={15} />
              <span>Buka Versi Publik</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Role-Based Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-white to-rose-50/50 dark:from-slate-900 dark:to-slate-800/80 p-5 rounded-2xl border border-rose-100 dark:border-slate-800 shadow-sm space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
              <UserCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Bagi Karyawan (Subjek Data Pribadi)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transparansi penuh data presensi, slip gaji, dan lokasi Anda
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Data foto selfie diubah menjadi vektor numerik terenkripsi tanpa dapat disalahgunakan pihak ketiga. Lokasi GPS hanya dibaca saat jam shift aktif, dan rincian gaji Anda bersifat privat tidak dapat diakses rekan kerja lain.
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-rose-800 dark:text-rose-400">
            <CheckCircle2 size={13} />
            <span>Hak koreksi &amp; transparansi audit log dijamin</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              <Server size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Bagi Super Admin &amp; Tim HR (Tata Kelola Data)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Akuntabilitas pengawasan, persetujuan, dan hak akses
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Super Admin memikul tanggung jawab hukum untuk mengelola otorisasi Role-Based Access Control (RBAC), memverifikasi persetujuan wajah (Face Approval), menjaga kerahasiaan master payroll, dan memonitor Activity Logs organisasi.
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <ShieldAlert size={13} />
            <span>Kewajiban kepatuhan regulasi ketenagakerjaan RI</span>
          </div>
        </div>
      </div>

      {/* Main Policy Viewer Component */}
      <PrivacyPolicyViewer />
    </div>
  );
}
