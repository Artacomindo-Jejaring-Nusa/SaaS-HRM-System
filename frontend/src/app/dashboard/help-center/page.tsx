"use client";

import React, { useState } from "react";
import { 
  Search, 
  HelpCircle, 
  CreditCard, 
  Calendar, 
  FileText, 
  Smartphone, 
  ChevronDown, 
  ChevronUp, 
  MessageSquare, 
  Mail, 
  ExternalLink,
  ShieldCheck,
  Clock,
  Laptop
} from "lucide-react";
import Link from "next/link";

interface FaqItem {
  question: string;
  answer: string;
  category: "finance" | "leave" | "document" | "device";
  tags: string[];
}

const faqData: FaqItem[] = [
  // 1. Keuangan & Payroll
  {
    category: "finance",
    question: "Kapan tanggal penggajian (payroll) diproses setiap bulannya?",
    answer: "Penggajian rutin diproses pada akhir periode kerja setiap bulan (biasanya tanggal 25 hingga hari kerja terakhir). Anda dapat memantau rincian komponen gaji (Gaji Pokok, Tunjangan, Potongan BPJS & Pajak) di menu Penggajian / Slip Gaji.",
    tags: ["gaji", "payroll", "tanggal", "transfer", "pembayaran"]
  },
  {
    category: "finance",
    question: "Bagaimana cara mengunduh Slip Gaji resmi dalam format PDF A4?",
    answer: "Buka menu 'Penggajian / Slip Gaji' di dashboard. Pilih bulan periode yang diinginkan, kemudian klik tombol 'Unduh Slip Gaji (PDF A4)'. Format dokumen telah dioptimalkan untuk ukuran standar A4 lengkap dengan rincian penghasilan dan potongan resmi.",
    tags: ["slip gaji", "pdf", "a4", "unduh", "cetak", "download"]
  },
  {
    category: "finance",
    question: "Bagaimana prosedur pengajuan Klaim / Reimbursement pengeluaran operasional?",
    answer: "Masuk ke menu 'Klaim Biaya' di sidebar. Klik 'Tambah Klaim', isi nominal, tanggal transaksi, deskripsi, dan lampirkan bukti nota/struk fisik atau digital (JPG, PNG, PDF). Pengajuan akan diverifikasi oleh Supervisor dan Finance Manager.",
    tags: ["reimburse", "klaim", "nota", "struk", "biaya"]
  },
  {
    category: "finance",
    question: "Bagaimana cara mengajukan Kasbon / Pengajuan Dana Operasional (Fund Request)?",
    answer: "Buka menu 'Pengajuan Dana' di bawah menu Administrasi. Tekan tombol 'Ajukan Dana Baru', tentukan estimasi kebutuhan dana operasional atau kasbon, dan tunggu approval bertahap sesuai workflow perusahaan.",
    tags: ["kasbon", "dana", "fund request", "advance", "pinjaman"]
  },

  // 2. Cuti & Perizinan
  {
    category: "leave",
    question: "Berapa sisa kuota cuti tahunan saya dan bagaimana cara mengeceknya?",
    answer: "Sisa kuota cuti tahunan dan cuti khusus Kemnaker dapat Anda lihat langsung di Kartu Ringkasan Beranda (Dashboard) dan halaman 'Permintaan Cuti'. Kuota otomatis berkurang setelah pengajuan cuti Anda disetujui.",
    tags: ["cuti", "kuota", "saldo", "sisa cuti", "tahunan"]
  },
  {
    category: "leave",
    question: "Apa perbedaan antara Pengajuan Cuti dan Pengajuan Izin?",
    answer: "Pengajuan Cuti digunakan untuk libur terjadwal yang memotong saldo cuti tahunan atau hak cuti Kemnaker. Pengajuan Izin digunakan untuk hal-hal situasional seperti izin sakit (dengan surat dokter), izin terlambat datang, atau izin pulang awal dinas.",
    tags: ["izin", "cuti", "sakit", "terlambat", "perbedaan"]
  },
  {
    category: "leave",
    question: "Bagaimana cara mengajukan Tukar Shift dengan rekan kerja?",
    answer: "Buka menu 'Tukar Shift' pada kelompok Kehadiran. Anda dapat melihat kalender jadwal rekan kerja satu tim, memilih tanggal shift yang ingin ditukar, dan mengirimkan permintaan tukar shift kepada rekan yang bersangkutan serta Supervisor.",
    tags: ["shift", "tukar shift", "jadwal", "rekan kerja", "ganti shift"]
  },

  // 3. Dokumen & SOP Perusahaan
  {
    category: "document",
    question: "Di mana saya bisa membaca SOP, Regulasi, dan Surat Keputusan Perusahaan?",
    answer: "Seluruh regulasi resmi perusahaan dapat diakses pada menu 'Dokumen Perusahaan' dan 'Pengumuman'. Dokumen dapat dibaca langsung di browser tab baru atau diunduh ke perangkat Anda.",
    tags: ["sop", "dokumen", "sk", "peraturan", "regulasi", "kebijakan"]
  },
  {
    category: "document",
    question: "Bagaimana cara melihat struktur organisasi perusahaan dan kontak rekan kerja?",
    answer: "Buka menu 'Struktur Organisasi' untuk bagan hierarki departemen, atau menu 'Direktori Karyawan' untuk mencari kontak email, nomor ekstensi, dan jabatan rekan kerja di seluruh kantor cabang.",
    tags: ["organisasi", "direktori", "kontak", "struktur", "rekan"]
  },

  // 4. Perangkat & Absensi Web
  {
    category: "device",
    question: "Bagaimana cara kerja Absensi via Web (Browser)?",
    answer: "Absensi via Web dirancang sebagai jalur fallback resmi jika smartphone Anda sedang diperbaiki atau bermasalah. Anda cukup menekan tombol 'Absen Masuk via Web' di Beranda, mengambil satu foto selfie dari webcam atau mengunggah file foto, lalu klik Kirim. Waktu server dan IP Address akan otomatis tercatat.",
    tags: ["absen web", "browser", "selfie", "fallback", "laptop"]
  },
  {
    category: "device",
    question: "Mengapa status absen Web saya bertuliskan 'Pending' (Kuning)?",
    answer: "Status 'Pending' berarti absensi web Anda telah berhasil tersimpan dengan waktu yang presisi, dan saat ini sedang menunggu tinjauan/persetujuan dari Superadmin atau HRD. Jam kerja Anda tetap dihitung sejak foto diunggah. Jika akun Anda telah dimasukkan ke daftar 'Validasi Otomatis' oleh Admin, absen web Anda selanjutnya akan langsung tersahkan (Hijau/Valid).",
    tags: ["pending", "approval", "persetujuan", "validasi otomatis", "kuning"]
  },
  {
    category: "device",
    question: "Apakah Face Recognition (ML AI) masih wajib di Web Dashboard?",
    answer: "Sesuai standar ekosistem OnTime HRMS v2.1, pengenalan biometrik AI Face Recognition on-device dijalankan di Aplikasi Mobile Android/Flutter. Pada Web Dashboard, alur disederhanakan murni berbasis unggah foto dan persetujuan / validasi otomatis agar lebih cepat dan andal di berbagai browser laptop.",
    tags: ["face recognition", "ai", "wajah", "ml", "biometrik", "web"]
  },
  {
    category: "device",
    question: "Apa yang harus saya lakukan jika berganti perangkat smartphone baru?",
    answer: "Aplikasi mobile mengunci 1 akun ke 1 Device ID fisik untuk keamanan. Jika Anda berganti HP baru, ajukan reset Device ID ke tim HRD / IT Support melalui portal admin atau hubungi Helpdesk resmi.",
    tags: ["ganti hp", "device id", "reset device", "perangkat baru"]
  }
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expandedIndices, setExpandedIndices] = useState<number[]>([0, 1]);

  const categories = [
    { id: "all", label: "Semua Kategori", icon: HelpCircle },
    { id: "device", label: "Perangkat & Absensi Web", icon: Smartphone },
    { id: "finance", label: "Keuangan & Payroll", icon: CreditCard },
    { id: "leave", label: "Cuti & Perizinan", icon: Calendar },
    { id: "document", label: "Dokumen & SOP", icon: FileText },
  ];

  const filteredFaqs = faqData.filter((item) => {
    const matchesCategory = activeCategory === "all" || item.category === activeCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query) ||
      item.tags.some((t) => t.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  const toggleExpand = (index: number) => {
    setExpandedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#8B0000] via-[#750000] to-[#500000] p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-rose-100 backdrop-blur-md border border-white/15">
            <HelpCircle size={14} className="text-rose-200" />
            <span>Pusat Bantuan & FAQ Karyawan • OnTime HRMS v2.1</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Ada yang bisa kami bantu hari ini?
          </h1>
          <p className="text-sm text-rose-100/90 leading-relaxed max-w-2xl">
            Temukan panduan lengkap seputar absensi via web, slip gaji, pengajuan cuti, regulasi perusahaan, dan solusi kendala teknis Anda di sini.
          </p>

          {/* Search Input Box */}
          <div className="pt-2">
            <div className="relative max-w-xl">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik kata kunci (contoh: absen web, slip gaji, saldo cuti, klaim)..."
                className="w-full rounded-xl bg-white pl-11 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 rounded-md"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Decorative Background Circles */}
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute right-32 -bottom-20 h-56 w-56 rounded-full bg-rose-400/10 blur-xl pointer-events-none" />
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-[#8B0000] text-white shadow-md shadow-rose-900/20 scale-[1.02]"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Icon size={14} className={isActive ? "text-white" : "text-slate-500"} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FAQ Accordion List (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <HelpCircle size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Tidak ada FAQ yang cocok dengan pencarian &quot;{searchQuery}&quot;
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Coba gunakan kata kunci yang lebih umum atau hubungi tim HRD jika pertanyaan Anda belum tercantum.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Reset Pencarian
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq, index) => {
              const isExpanded = expandedIndices.includes(index);
              return (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(index)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 focus:outline-none"
                  >
                    <span className="text-sm font-bold text-slate-900 leading-snug">
                      {faq.question}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                      <p>{faq.answer}</p>

                      {/* Tag badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400 font-medium">Topik terkait:</span>
                        {faq.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 text-[10px] font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Sidebar: Contact & Quick Links */}
        <div className="space-y-4">
          {/* Quick Help Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare size={16} className="text-[#8B0000]" />
              Butuh Bantuan Lebih Lanjut?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Jika ada kendala akun, perubahan jadwal shift darurat, atau pertanyaan gaji yang belum terjawab, hubungi tim support perusahaan.
            </p>

            <div className="space-y-2 pt-1 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Helpdesk HRD & IT</div>
                  <div className="text-[11px] text-slate-500">Senin - Jumat (08.30 - 17.30)</div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                  <Mail size={16} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Email HRD Support</div>
                  <div className="text-[11px] text-slate-500">hrd@narwasthu.com</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Navigation Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-white">
              <Laptop size={16} className="text-rose-400" />
              Pintas Cepat
            </h3>
            <div className="space-y-1.5 text-xs">
              <Link
                href="/dashboard"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-200"
              >
                <span>Beranda & Absen Web</span>
                <ExternalLink size={13} className="text-slate-400" />
              </Link>
              <Link
                href="/dashboard/leaves"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-200"
              >
                <span>Form Pengajuan Cuti</span>
                <ExternalLink size={13} className="text-slate-400" />
              </Link>
              <Link
                href="/dashboard/reimbursements"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-200"
              >
                <span>Form Pengajuan Klaim</span>
                <ExternalLink size={13} className="text-slate-400" />
              </Link>
              <Link
                href="/dashboard/documents"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-200"
              >
                <span>Dokumen SOP & Regulasi</span>
                <ExternalLink size={13} className="text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
