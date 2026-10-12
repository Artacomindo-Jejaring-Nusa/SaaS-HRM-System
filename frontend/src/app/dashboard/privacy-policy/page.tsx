"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Camera,
  MapPin,
  Smartphone,
  FileText,
  CreditCard,
  UserCheck,
  Clock,
  Building2,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  Mail,
  ChevronRight,
  ExternalLink,
  Info,
  ShieldAlert,
  Server
} from "lucide-react";

interface PolicySection {
  id: string;
  number: string;
  title: string;
  icon: React.ElementType;
  audience: "all" | "employee" | "admin";
  badge: string;
  summary: string;
  content: string[];
  keyPoints?: string[];
  adminNotes?: string[];
}

const policySections: PolicySection[] = [
  {
    id: "legal-basis",
    number: "01",
    title: "Landasan Hukum, Definisi & Prinsip Pemrosesan Data",
    icon: Building2,
    audience: "all",
    badge: "Kepatuhan UU PDP No. 27/2022",
    summary:
      "Penjelasan kedudukan hukum antara Pengendali Data (Perusahaan Pemberi Kerja) dan Pemroses Data (PT. Artacomindo Jejaring Nusa) serta asas pelindungan data pribadi.",
    content: [
      "Kebijakan Privasi ini merupakan dokumen resmi yang mengikat bagi seluruh pengguna ekosistem aplikasi OnTime HRMS (platform web portal dan aplikasi seluler Android/iOS) yang dikembangkan dan dioperasikan oleh PT. Artacomindo Jejaring Nusa.",
      "Pemrosesan data pribadi pada platform ini tunduk sepenuhnya pada peraturan perundang-undangan Republik Indonesia, khususnya Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP), Peraturan Pemerintah No. 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik (PSTE), serta peraturan menteri terkait ketenagakerjaan.",
      "Dalam struktur operasional SaaS OnTime HRMS: Perusahaan/Organisasi tempat Karyawan bekerja bertindak sebagai PENGENDALI DATA PRIBADI (Data Controller) yang menentukan tujuan dan instruksi pemrosesan, sedangkan PT. Artacomindo Jejaring Nusa bertindak sebagai PEMROSES DATA PRIBADI (Data Processor) yang mengelola infrastruktur cloud, algoritma AI, dan sistem penyimpanan sesuai standar keamanan enterprise.",
      "Prinsip utama yang diterapkan adalah Prinsip Pembatasan Tujuan (Purpose Limitation), Prinsip Minimalisasi Data (Data Minimization), Prinsip Akuntabilitas (Accountability), dan Prinsip Integritas serta Kerahasiaan (Confidentiality & Integrity)."
    ],
    keyPoints: [
      "Karyawan sebagai Subjek Data memiliki hak penuh atas transparansi dan perlindungan data dirinya.",
      "Data tidak akan pernah dijual, disewakan, atau diperdagangkan kepada pihak ketiga komersial mana pun.",
      "Pemrosesan data hanya dilakukan untuk keperluan hubungan industrial dan manajemen operasional ketenagakerjaan yang sah."
    ],
    adminNotes: [
      "Super Admin wajib memastikan pendaftaran karyawan baru didasari persetujuan kerja atau perjanjian ketenagakerjaan yang sah.",
      "Super Admin bertanggung jawab menjaga kerahasiaan hak akses akun admin dan tidak membagikan kredensial kepada pihak tidak berwenang."
    ]
  },
  {
    id: "biometrics",
    number: "02",
    title: "Data Biometrik & Kecerdasan Buatan (AI Face Recognition)",
    icon: Camera,
    audience: "all",
    badge: "Enkripsi Vektor 128-Dimensi",
    summary:
      "Mekanisme penangkapan foto wajah saat presensi, konversi ke representasi numerik matematis, dan teknologi deteksi keaslian (Liveness Detection).",
    content: [
      "Aplikasi OnTime HRMS memanfaatkan teknologi Pengenalan Wajah Berbasis AI (ArcFace Deep Learning) untuk menjamin validitas kehadiran karyawan secara akurat, cepat, dan adil tanpa kontak fisik.",
      "Saat proses Pendaftaran Wajah (Face Enrollment) pertama kali dan saat pengambilan absensi masuk/pulang, sistem menangkap citra selfie karyawan. Citra ini secara otomatis diekstraksi menjadi representasi vektor matematis numerik 128-dimensi (embedding) yang dienkripsi.",
      "Algoritma pencocokan bekerja dengan membandingkan jarak kosinus (Cosine Distance) antara embedding presensi harian dengan embedding template registrasi yang telah disetujui Super Admin.",
      "Sistem dilengkapi modul Anti-Spoofing & Liveness Detection mutakhir guna menangkal manipulasi presensi menggunakan foto cetak, tampilan layar smartphone lain, rekaman video berulang, atau topeng 3D."
    ],
    keyPoints: [
      "Foto biometrik hanya digunakan untuk memverifikasi kesesuaian identitas saat presensi kerja.",
      "Representasi embedding vektor numerik tidak dapat direkonstruksi balik menjadi foto wajah mentah oleh pihak luar.",
      "Data biometrik disimpan di container server terenkripsi dengan proteksi firewall ketat."
    ],
    adminNotes: [
      "Super Admin memiliki menu 'Persetujuan Wajah' (Face Approval) untuk memvalidasi kemiripan foto karyawan sebelum embedding diaktifkan.",
      "Apabila karyawan mengalami perubahan fisik signifikan atau kendala perangkat, Super Admin berhak menyetujui pendaftaran ulang wajah (Re-enrollment) setelah verifikasi identitas fisik."
    ]
  },
  {
    id: "geolocation",
    number: "03",
    title: "Data Geografis, Koordinat GPS & Pelacakan Lapangan (Live Tracking)",
    icon: MapPin,
    audience: "all",
    badge: "Geofencing & Pelacakan Terbatas Shift",
    summary:
      "Ketentuan pembacaan koordinat lokasi GPS untuk validasi radius kantor cabang serta batasan ketat pelacakan latar belakang karyawan lapangan.",
    content: [
      "Sistem membaca koordinat garis lintang (Latitude), garis bujur (Longitude), serta akurasi sinyal satelit GPS saat karyawan menekan tombol absensi masuk atau absensi pulang.",
      "Validasi Radius Kantor (Geofencing): Koordinat presensi dicocokkan dengan titik koordinat resmi kantor cabang atau area proyek yang telah dikonfigurasi Super Admin. Presensi hanya dinyatakan valid jika berada di dalam batas radius toleransi yang ditetapkan perusahaan.",
      "Pelacakan Latar Belakang (Background Location Tracking / Live Tracking): Fitur ini HANYA aktif bagi karyawan dengan profil tugas lapangan, teknisi keliling, kurir logistik, atau dinas luar yang memerlukan pemantauan rute operasional.",
      "Kerahasiaan di Luar Jam Kerja: Pelacakan otomatis berhenti permanen saat karyawan menekan tombol 'Absen Pulang' atau saat shift kerja berakhir. OnTime HRMS sama sekali TIDAK MELAKUKAN pelacakan saat karyawan libur, cuti, atau di luar jadwal tugas dinas."
    ],
    keyPoints: [
      "Terdapat indikator status notifikasi aktif di bilah status ponsel (Foreground Service Notification) selama pelacakan lapangan berlangsung.",
      "Aplikasi meminta izin 'Akses Lokasi Selalu' (Background Location Permission) secara eksplisit dengan penjelasan tujuan sebelum diaktifkan.",
      "Riwayat rute perjalanan teknisi lapangan hanya tersimpan selama periode evaluasi penugasan operasional."
    ],
    adminNotes: [
      "Super Admin bertanggung jawab menentukan radius kantor cabang secara realistis agar tidak menyulitkan presensi karyawan di titik masuk kantor.",
      "Super Admin dan Manager hanya dapat memantau lokasi karyawan yang sedang berstatus shift aktif (Online/Bertugas)."
    ]
  },
  {
    id: "device-security",
    number: "04",
    title: "Data Perangkat (Device Binding) & Integritas Anti-Kecurangan",
    icon: Smartphone,
    audience: "all",
    badge: "1 Akun = 1 Perangkat Unik",
    summary:
      "Pencegahan titip absen, manipulasi lokasi palsu (Fake GPS), serta perlindungan akun melalui pengikatan identitas unik smartphone.",
    content: [
      "Untuk menjaga keadilan dan integritas presensi seluruh karyawan, OnTime HRMS menerapkan kebijakan Device Binding (1 akun karyawan terikat secara eksklusif pada 1 smartphone terdaftar).",
      "Saat pertama kali login, sistem mencatat pengidentifikasi unik perangkat (Device UUID, Model Smartphone, Versi Sistem Operasi Android/iOS, dan Status Keamanan Perangkat).",
      "Sistem Keamanan Aktif secara otomatis mendeteksi dan memblokir upaya presensi yang menggunakan aplikasi Fake GPS (Mock Location Provider), perangkat yang di-root atau di-jailbreak, serta aplikasi kloning atau emulator PC.",
      "Apabila karyawan mencoba login dari smartphone yang berbeda tanpa izin pelepasan ikatan (unbinding), sistem akan menolak otentikasi demi mencegah penyalahgunaan akun oleh rekan kerja."
    ],
    keyPoints: [
      "Device ID dicatat secara aman dalam bentuk hash kriptografi dan tidak digunakan untuk pelacakan aktivitas pribadi di luar aplikasi HRMS.",
      "Jika smartphone karyawan hilang, rusak, atau diganti baru, proses reset ikatan perangkat wajib diajukan secara resmi kepada Super Admin perusahaan."
    ],
    adminNotes: [
      "Super Admin memiliki wewenang pada menu Manajemen Karyawan untuk melakukan 'Reset Device ID' setelah memastikan kebenaran permohonan pergantian perangkat.",
      "Riwayat pergantian perangkat tercatat di Activity Logs untuk mencegah potensi manipulasi."
    ]
  },
  {
    id: "documents-claims",
    number: "05",
    title: "Data Transaksi, Lampiran Dokumen & Tanda Tangan Digital",
    icon: FileText,
    audience: "all",
    badge: "Penyimpanan Dokumen Terenkripsi",
    summary:
      "Pengelolaan berkas klaim biaya, surat izin dokter, odometer kendaraan operasional, serta keabsahan tanda tangan elektronik.",
    content: [
      "Karyawan dapat mengunggah berkas pendukung dalam rangka keperluan operasional ketenagakerjaan, seperti nota struk reimbursement, surat keterangan sakit dari dokter, foto odometer awal/akhir kendaraan dinas, serta dokumen perizinan lainnya.",
      "Seluruh berkas gambar (JPG, PNG) dan dokumen (PDF) disimpan pada penyimpanan berkas terisolasi (private object storage) dengan tautan akses sementara bertanda tangan (Signed URLs) yang kedaluwarsa otomatis.",
      "Tanda Tangan Digital (Digital Signature): Goresan tanda tangan elektronik yang dibuat pada modul pengajuan klaim, kasbon, atau approval berstatus sah secara internal dan disimpan bersama timestamp UTC+7 sebagai bukti persetujuan operasional."
    ],
    keyPoints: [
      "Dokumen medis seperti surat sakit dokter hanya dapat diakses oleh bagian HRD / Supervisor yang berwenang untuk validasi izin.",
      "Bukti transaksi keuangan disimpan secara aman untuk kebutuhan rekonsiliasi audit pembukuan internal perusahaan."
    ],
    adminNotes: [
      "Super Admin dan Approval Manager wajib memverifikasi keaslian dokumen nota klaim sebelum menyetujui pencairan dana.",
      "Dilarang menyebarluaskan lampiran dokumen pribadi karyawan di luar saluran operasional HRD yang sah."
    ]
  },
  {
    id: "payroll-tax",
    number: "06",
    title: "Data Finansial, Penggajian & Perpajakan (PPh 21 & BPJS)",
    icon: CreditCard,
    audience: "all",
    badge: "Kerahasiaan Finansial Berstandar Perbankan",
    summary:
      "Perlindungan nomor rekening bank, rincian komponen kompensasi, potongan iuran wajib, dan isolasi privasi antar-karyawan.",
    content: [
      "OnTime HRMS mengelola data finansial karyawan yang mencakup nomor rekening bank, nama bank, rincian gaji pokok, tunjangan kehadiran, tunjangan jabatan, bonus performa, potongan kasbon, iuran BPJS Ketenagakerjaan & Kesehatan, serta potongan PPh 21.",
      "Isolasi Privasi Absolut: Karyawan HANYA dapat melihat dan mengunduh slip gaji miliknya sendiri. Tidak ada fitur yang memungkinkan sesama rekan kerja melihat informasi kompensasi satu sama lain.",
      "Perhitungan payroll dilakukan di sisi server terlindung dengan formula otomatis yang disesuaikan dengan regulasi ketenagakerjaan dan kebijakan spesifik masing-masing perusahaan tenant."
    ],
    keyPoints: [
      "Data nomor rekening bank dienkripsi pada tingkat basis data untuk mencegah kebocoran finansial.",
      "Slip gaji resmi dalam format PDF dilindungi dengan token autentikasi terverifikasi."
    ],
    adminNotes: [
      "Akses modul Payroll hanya diberikan kepada pengguna dengan Role 'Finance' atau 'Super Admin' yang telah melalui penugasan resmi.",
      "Super Admin wajib mematuhi kode etik kerahasiaan gaji dan tidak boleh membuka data kompensasi karyawan kepada pihak yang tidak berkepentingan."
    ]
  },
  {
    id: "admin-governance",
    number: "07",
    title: "Tata Kelola Hak Akses & Kewajiban Super Admin Perusahaan",
    icon: UserCheck,
    audience: "admin",
    badge: "Role-Based Access Control (RBAC)",
    summary:
      "Tanggung jawab hukum dan manajerial Super Admin dalam mengelola akun, delegasi peran, dan audit kepatuhan data organisasi.",
    content: [
      "Super Admin adalah pemegang hak istimewa tertinggi pada tenant perusahaan yang bertanggung jawab langsung atas tata kelola data karyawan di lingkungan organisasinya.",
      "Penerapan Hak Akses Minimal (Principle of Least Privilege): Super Admin wajib mengonfigurasi Role & Permissions secara ketat. Berikan hak akses hanya sesuai kebutuhan fungsi jabatan (misal: Manager hanya melihat tim bawahannya, Finance hanya melihat modul klaim & payroll).",
      "Kewajiban Audit Rutin: Super Admin diwajibkan memeriksa menu 'Activity Logs' secara berkala untuk memonitor adanya aktivitas yang mencurigakan, mutasi data mendadak, atau upaya login yang tidak biasa.",
      "Penonaktifan Karyawan Resign: Begitu seorang karyawan mengakhiri masa kerjanya, Super Admin wajib segera menonaktifkan akun karyawan tersebut (Status Non-Aktif) guna memutus akses terhadap data internal perusahaan."
    ],
    keyPoints: [
      "Super Admin dilarang menyalahgunakan data pribadi karyawan untuk kepentingan di luar hubungan kerja.",
      "Segala tindakan Super Admin tercatat permanen pada Audit Trail sistem yang tidak dapat dimanipulasi."
    ]
  },
  {
    id: "user-rights",
    number: "08",
    title: "Hak-Hak Karyawan Selaku Subjek Data (Data Subject Rights)",
    icon: ShieldCheck,
    audience: "employee",
    badge: "Hak Perlindungan Karyawan",
    summary:
      "Hak untuk mengetahui data yang disimpan, hak meminta koreksi data profil, hak mengunduh salinan, dan transparansi presensi.",
    content: [
      "Sesuai ketentuan Bab VI UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, setiap karyawan yang terdaftar pada OnTime HRMS memiliki hak-hak yang dijamin hukum:",
      "1. Hak atas Informasi: Karyawan berhak mengetahui data apa saja yang dicatat oleh sistem, tujuan pemrosesan, dan siapa saja pihak internal yang berwenang mengaksesnya.",
      "2. Hak Mengakses & Portabilitas Data: Karyawan berhak meninjau seluruh riwayat absensi, saldo cuti, log lembur, dan mengunduh salinan slip gaji resmi miliknya dalam format digital.",
      "3. Hak Memperbaiki Data (Right to Rectification): Karyawan berhak mengajukan pembaruan jika terdapat ketidakakuratan data, seperti penggantian nomor telepon, alamat, nomor rekening, atau pendaftaran ulang foto profil/biometrik.",
      "4. Hak Mengajukan Keberatan & Klarifikasi: Karyawan berhak meminta klarifikasi melalui HRD apabila terdapat perselisihan catatan kehadiran atau koreksi jam kerja."
    ],
    keyPoints: [
      "Karyawan dapat menggunakan fitur 'Koreksi Absensi' di dashboard web atau aplikasi seluler untuk memperbaiki presensi yang terlewat.",
      "Semua permintaan koreksi ditinjau oleh atasan langsung dan HRD secara transparan."
    ]
  },
  {
    id: "retention-deletion",
    number: "09",
    title: "Masa Retensi, Pengarsipan & Penghapusan Data",
    icon: Clock,
    audience: "all",
    badge: "Retensi Kepatuhan Hukum",
    summary:
      "Jangka waktu penyimpanan catatan kehadiran, dokumen klaim, dan tata cara pembersihan data pasca pengakhiran hubungan kerja.",
    content: [
      "Data operasional kehadiran, rekam jejak lembur, perizinan, dan slip gaji disimpan selama masa hubungan kerja karyawan berlangsung secara aktif.",
      "Setelah hubungan kerja berakhir (PHK, pensiun, atau pengunduran diri), data diarsipkan dalam status non-aktif selama periode retensi hukum yang dipersyaratkan oleh regulasi perpajakan dan ketenagakerjaan Indonesia (umumnya 5 hingga 10 tahun untuk kepentingan audit resmi).",
      "Pemusnahan Data Biometrik: Template embedding wajah karyawan yang telah resmi berhenti dapat dihapus secara permanen dari basis data aktif atas permintaan tertulis Super Admin perusahaan.",
      "Pencadangan Sistem (Automated Backup): Salinan cadangan data disimpan di pusat data terlindung dengan enkripsi penuh dan dirotasi secara otomatis sesuai kebijakan disaster recovery."
    ],
    keyPoints: [
      "Akun karyawan yang telah non-aktif tidak akan dapat login kembali ke aplikasi seluler maupun portal web.",
      "Arsip data historis dilindungi dengan akses read-only yang diawasi ketat."
    ]
  },
  {
    id: "security-encryption",
    number: "10",
    title: "Keamanan Infrastruktur, Protokol Enkripsi & Audit Trail",
    icon: Lock,
    audience: "all",
    badge: "Keamanan Standar Industri",
    summary:
      "Spesifikasi perlindungan teknis meliputi TLS 1.3, AES-256, OAuth 2.0 Google, firewall aplikasi web, dan pemantauan anomali.",
    content: [
      "PT. Artacomindo Jejaring Nusa menerapkan arsitektur keamanan bertingkat (Defense-in-Depth) untuk melindungi infrastruktur SaaS OnTime HRMS:",
      "• Enkripsi in-Transit: Seluruh transmisi data antara aplikasi browser/seluler dengan server backend dilindungi protokol TLS 1.3 (HTTPS) dengan sertifikat SSL enkripsi 256-bit.",
      "• Enkripsi at-Rest: Seluruh data sensitif pada basis data MySQL dan penyimpanan file attachments dienkripsi menggunakan standar AES-256.",
      "• Otentikasi Berlapis: Menggunakan JSON Web Tokens (JWT) dengan rotasi refresh token otomatis, dukungan Google OAuth 2.0 resmi, serta session token yang tersimpan pada Secure Storage perangkat seluler dan Cookie HttpOnly pada web.",
      "• Audit Trail Komprehensif: Setiap aksi login, perubahan data profil, approval izin, hingga proses payroll dicatat lengkap dengan timestamp presisi milidetik, alamat IP, dan User Agent untuk mitigasi insiden siber."
    ],
    keyPoints: [
      "Pemeriksaan kerentanan (vulnerability assessment) dan pembaruan dependensi keamanan dilakukan secara berkala.",
      "Infrastruktur cloud dilengkapi perlindungan DDoS dan Web Application Firewall (WAF)."
    ]
  },
  {
    id: "contact-dpo",
    number: "11",
    title: "Kontak Resmi & Petugas Pelindungan Data (DPO)",
    icon: Mail,
    audience: "all",
    badge: "Layanan Bantuan Resmi",
    summary:
      "Saluran komunikasi resmi untuk pertanyaan privasi, pelaporan insiden data, serta konsultasi kepatuhan hukum.",
    content: [
      "Apabila Anda memiliki pertanyaan, klarifikasi, keluhan, atau ingin melaksanakan hak-hak subjek data sehubungan dengan Kebijakan Privasi ini, silakan menghubungi Petugas Pelindungan Data (Data Protection Officer / DPO) kami melalui saluran resmi berikut:",
      "• Nama Pengembang & Penyedia Layanan: PT. Artacomindo Jejaring Nusa",
      "• Produk Platform: OnTime HRMS (Enterprise SaaS Edition)",
      // "• Surel Khusus Pelindungan Data: privacy@artacomindo.com",
      // "• Surel Layanan & Bantuan Teknis: support@artacomindo.com",
      // "• Jam Operasional Layanan: Senin – Jumat (08:30 – 17:30 WIB, tidak termasuk hari libur nasional)",
      // "• Lokasi Kantor: Jakarta, Indonesia",
      "Perubahan Kebijakan: Kebijakan Privasi ini dapat diperbarui sewaktu-waktu seiring penyempurnaan fitur sistem atau perubahan regulasi pemerintah. Pembaruan signifikan akan diumumkan melalui bilah pengumuman di dashboard aplikasi."
    ],
    keyPoints: [
      "Karyawan dapat berkonsultasi terlebih dahulu dengan Admin HRD perusahaan masing-masing terkait data internal kepegawaian.",
      // "DPO PT. Artacomindo Jejaring Nusa siap melayani penyelidikan teknis dan kepatuhan sistem keamanan."
    ]
  }
];

export default function PrivacyPolicyDashboardPage() {
  const [activeTab, setActiveTab] = useState<"all" | "employee" | "admin">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    return policySections.filter((section) => {
      // Filter tab
      const matchesTab =
        activeTab === "all" ||
        section.audience === "all" ||
        section.audience === activeTab;

      // Filter search
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
            filteredSections.map((sec) => {
              const IconComp = sec.icon;
              return (
                <section
                  key={sec.id}
                  id={sec.id}
                  className="scroll-mt-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4 hover:border-rose-200 transition-colors"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center justify-center shrink-0 font-bold text-sm">
                        <IconComp size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-rose-800 dark:text-rose-400">
                            PASAL {sec.number}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                            {sec.badge}
                          </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                          {sec.title}
                        </h2>
                      </div>
                    </div>
                  </div>

                  {/* Summary Callout */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-750 text-xs text-slate-700 dark:text-slate-300 italic">
                    &quot;{sec.summary}&quot;
                  </div>

                  {/* Paragraphs */}
                  <div className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {sec.content.map((p) => (
                      <p key={`${sec.id}-p-${p.slice(0, 32)}`}>{p}</p>
                    ))}
                  </div>

                  {/* Key Points / Employee Highlights */}
                  {sec.keyPoints && sec.keyPoints.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 space-y-2">
                      <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Poin Perlindungan Utama bagi Karyawan:</span>
                      </div>
                      <ul className="space-y-1 text-xs text-emerald-950 dark:text-emerald-200 list-disc list-inside">
                        {sec.keyPoints.map((kp) => (
                          <li key={`${sec.id}-kp-${kp.slice(0, 32)}`} className="leading-relaxed">
                            {kp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Admin Notes / Governance Highlights */}
                  {sec.adminNotes && sec.adminNotes.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 space-y-2">
                      <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400" />
                        <span>Kewajiban Tata Kelola bagi Super Admin:</span>
                      </div>
                      <ul className="space-y-1 text-xs text-amber-950 dark:text-amber-200 list-disc list-inside">
                        {sec.adminNotes.map((an) => (
                          <li key={`${sec.id}-an-${an.slice(0, 32)}`} className="leading-relaxed">
                            {an}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })
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
