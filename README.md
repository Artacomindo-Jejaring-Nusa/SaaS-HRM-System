# OnTime HRMS - Enterprise SaaS Solution

Sistem Informasi Manajemen Sumber Daya Manusia (HRMS) berbasis SaaS dengan arsitektur multi-tenant. Aplikasi ini dirancang untuk mengelola kehadiran, jadwal kerja, pengajuan cuti, dan klaim biaya (reimbursement) secara efisien untuk berbagai perusahaan dalam satu platform.

STATUS: PRODUCTION ON AIR (STABLE) 🚀

---

---

## Fitur Utama

Aplikasi ini mencakup modul-modul inti HRM yang sudah terintegrasi:

- **Authentication & Security**: 
  - **Multi-tenant isolation**: Pemisahan data antar tenant yang sangat ketat.
  - **Google Sign-In (OAuth 2.0)**: Login dengan akun Google terintegrasi di **Mobile (Flutter)** via `google_sign_in` v7.x dan **Web Dashboard (Next.js)** via Firebase Auth popup. Backend memverifikasi Google ID Token menggunakan `Google_Client`.
  - **Refresh Token System**: Mekanisme rotasi token otomatis (Refresh Token) untuk keamanan sesi backend yang lebih tangguh.
  - **Device-Bound Security**: Token di aplikasi mobile dikunci (binding) ke hardware ID perangkat unik untuk mencegah pencurian sesi. Google Login menggunakan device binding fleksibel (auto-update) karena autentikasi Google sudah aman secara inheren.
  - **Encrypted Storage**: Penyimpanan data sensitif di mobile menggunakan **hardware-based encryption (AES/XOR)** keyed ke fingerprint perangkat.
  - **Secure Cookies**: Implementasi HttpOnly, SameSite=Strict, dan Secure flags pada dashboard web.
  - **RBAC**: Role-based Access Control yang mendalam.
- **Manajemen SDM**: Data karyawan lengkap, request perubahan profil, upload foto, dan manajemen jabatan (Role).
- **Sistem Kehadiran Geofencing (Multi-Office) & Liveness**: Validasi ketat menggunakan GPS anti-mock dan deteksi wajah. Sekarang mendukung penentuan lokasi absensi di berbagai kantor cabang dengan radius yang dapat disesuaikan.
- **Live Tracking Teknisi**: Pemantauan lokasi dan rute pergerakan teknisi di lapangan secara real-time di latar belakang perangkat (Background Service), dengan dashboard pemetaan interaktif.
- **Koreksi Absen Mandiri**: Fitur pengajuan koreksi dengan workflow persetujuan (Approval) jika karyawan lupa absen pulang.
- **Delegasi & Manajemen WFH**: Memberikan izin kepada karyawan tertentu untuk absensi jarak jauh tanpa terpaku radius kantor, lengkap dengan pengumuman otomatis.
- **Alur Persetujuan Dinamis (Dynamic Approval Workflows)**: Sistem alur persetujuan berjenjang yang dapat disesuaikan per modul untuk 6 modul utama (Cuti, Izin, Lembur, Reimbursement, Pengajuan Dana, dan Koreksi Absen). Alur ini mendukung kombinasi persetujuan berbasis Jabatan (Role), User Tertentu (Specific User), dan Atasan Langsung (Supervisor-based) dengan mekanisme fallback otomatis ke logika default (Supervisor -> HR) apabila langkah dinamis tidak didefinisikan.
- **Tukar Shift (Shift Swap)**: Workflow pertukaran jadwal antar rekan kerja dengan notifikasi real-time (FCM) & sistem approval atasan.
- **Manajemen Kendaraan (Fleet Logging)**: Pencatatan operasional kendaraan efisien dengan alur 2-step (Keberangkatan & Kepulangan), validasi foto odometer, integrasi modal SOP & SK interaktif, serta notifikasi real-time ke Admin/HR saat kendaraan keluar/masuk.
- **Portofolio Manager (Mobile)**: Dashboard persetujuan terpadu bagi Manager untuk menyetujui Cuti, Lembur, Reimbursement, dan Log Kendaraan secara mobile.
- **Performance & Pagination**: Penanganan data skala besar dengan pagination di seluruh API dan proteksi error frontend (Array.isArray).
- **Manajemen Tugas (Tasks) & Evidence**: Pembagian tugas ke karyawan melalui dashboard admin/mobile, lengkap dengan fitur pelaporan aktivitas (foto Sebelum & Sesudah) serta verifikasi bukti kerja secara real-time.
- **Payrol & Slip Gaji Digital (PPh 21 TER)**: Sistem penggajian otomatis yang mendukung skema Pajak PPh 21 TER (PP 58 2023), BPJS (Kesehatan, JHT, JP, dsb), integrasi uang lembur (Overtime), dan rincian jam kerja. Karyawan dapat mengunduh slip PDF langsung dari aplikasi mobile secara aman.
- **Komunikasi & Pengumuman**: Broadcast pengumuman melalui Dashboard (Kotak Pesan) dan Email Premium (HTML).
- **Notifikasi Real-time & WebSocket**: Menggunakan native Laravel Reverb dengan notifikasi audio pintar di Web Dashboard.
- **Interactive Calendar Dashboard**: Dashboard kalender multifungsi dengan grafik pengajuan tertunda & integrasi API Pihak ketiga.
- **Sinkronisasi Hari Libur Nasional**: Sinkronisasi otomatis Hari Libur Nasional menggunakan proxy Google Calendar ICS Feed.
- **High-Availability Database (Enterprise)**: Arsitektur **Master-Slave Replication** (MySQL 8.4) dengan GTID Enabled untuk keamanan dan redundansi data.
- **Read-Write Splitting**: Optimasi performa Laravel dengan pemisahan trafik `Write` (Master) dan `Read` (Slave/Replica).

---

## Struktur Folder

```text
SaaS/
├── backend/                # Aplikasi Laravel 11 API (RESTful)
│   ├── app/                # Logika Bisnis (Auth, Attendance, Leave, Overtimes, dsb)
│   ├── database/           # Skema database & Migrations
│   └── routes/api.php      # Definisi API Endpoints
├── frontend/               # Dashboard Admin (Next.js 14)
│   ├── src/app/dashboard/  # Modul-modul Managerial HRMS
│   └── src/components/     # UI Components (Modern Design)
├── mobile/                 # Aplikasi Karyawan (Flutter & Dart)
│   ├── lib/api/            # Integrasi Mobile-to-Backend
│   └── lib/screens/        # UI/UX Mobile Modern (Inter Font, Natural Theme)
└── postman/                # Alat bantu testing (collection.json)
```

---

## Cara Setup (Docker) - REKOMENDASI CEPAT

Gunakan Docker untuk menjalankan seluruh stack (Backend, Frontend, MySQL, Redis, Nginx) secara otomatis:

1.  **Persiapan Environment**:
    Salin file `.env.docker` menjadi `.env` di direktori root.
    _(Pastikan file `.env` di folder `backend/` juga dikonfigurasi jika diperlukan secara lokal)._

2.  **Jalankan dengan Makefile (Disarankan)**:

    ```bash
    make start
    ```

    _Perintah ini akan melakukan build images dan menjalankan container secara otomatis._

3.  **Jalankan manual (Docker Compose)**:

    ```bash
    docker compose up -d
    ```

4.  **Akses Aplikasi**:
    - **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
    - **Backend API**: [http://localhost:8000/api](http://localhost:8000/api)
    - **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## Cara Setup (Lokal manual)

### Persiapan Backend

1. Masuk ke folder backend: `cd backend`
2. Install dependensi: `composer install`
3. Salin file environment: `cp .env.example .env` (Lakukan konfigurasi database)
4. Tambahkan `GOOGLE_CLIENT_ID` ke file `.env` backend untuk fitur Google Login.
5. Jalankan migrasi dan seeder: `php artisan migrate --seed`
6. Jalankan server: `php artisan serve`

### Persiapan Frontend (Next.js)

1. Masuk ke folder frontend: `cd frontend`
2. Install dependensi: `npm install`
3. Salin file environment: `cp .env.example .env.local`
4. Konfigurasi variabel `NEXT_PUBLIC_FIREBASE_*` untuk fitur Google Login di web.
5. Jalankan dev server: `npm run dev`

### Persiapan Mobile (Flutter)

1. Masuk ke folder mobile: `cd mobile`
2. Install dependensi: `flutter pub get`
3. Pastikan **Firebase** sudah dikonfigurasi (`google-services.json` untuk Android).
4. Jalankan aplikasi: `flutter run` (Gunakan Emulator atau Device fisik)

---

## Dokumentasi API

Daftar lengkap endpoint API dapat dilihat pada file berikut:

👉 **[DOKUMENTASI API LENGKAP](./API_DOCUMENTATION.md)**

---

---

## Arsitektur Sinkronisasi (Master-Slave)

Sistem ini dikonfigurasi untuk menangani skala besar dengan memisahkan beban database:
1.  **Master (hrms-mysql-master)**: Menangani seluruh query `INSERT`, `UPDATE`, `DELETE`.
2.  **Slave (hrms-mysql-slave)**: Menangani seluruh query `SELECT` (Read).
3.  **GTID Mode**: Sinkronisasi data dijamin konsisten menggunakan Global Transaction Identifier.
4.  **Sticky Sessions**: Laravel memastikan jika dalam satu request ada operasi tulis, maka operasi baca selanjutnya dalam request yang sama akan diarahkan ke Master untuk menjaga konsistensi data instan.

---

_Dikembangkan oleh Ahmad Rizki - PT. Artacomindo Jejaring Nusa - 2026_
