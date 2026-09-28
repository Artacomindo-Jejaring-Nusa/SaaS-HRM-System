# Rancangan Ekosistem Omnichannel HRMS: Mobile & Web Dashboard (Karyawan)
**Platform:** OnTime HRMS v2.1 (Revisi)
**Fokus:** Antarmuka Pengguna Karyawan (Pemilik Akun Reguler / Teknisi)
**Pendekatan:** *High Parity* (Semirip Mungkin) dengan Penyesuaian Kapabilitas Perangkat.

> **Catatan Revisi v2.1:** Modul *Artacom Bot* dan *Face Recognition* dihapus dari Web Dashboard. Alur absensi Web disederhanakan menjadi *upload foto + approval*, dan ditambahkan fitur **Validasi Otomatis** di sisi Superadmin agar proses persetujuan harian tidak membebani tim HRD/Manajer.

---

## 📌 1. Prinsip Desain Utama
Tujuan utama rancangan ini adalah memastikan karyawan tidak perlu belajar dua antarmuka yang berbeda. Tata letak menu, skema warna, dan terminologi yang digunakan di aplikasi Android (Flutter) akan diduplikasi secara presisi di Web Dashboard (Next.js).

Perbedaan hanya terjadi pada **cara sistem di belakang layar mengeksekusi fitur fisik** (Kamera, GPS, dan Penyimpanan Lokal), dan pada **dua modul yang memang sengaja tidak disediakan di Web** karena pertimbangan performa dan keamanan: *Face Recognition* dan *Artacom Bot*.

---

## 📊 2. Matriks Komparasi Fitur (Feature Parity)

| Modul / Fitur | Aplikasi Mobile (Android/Flutter) | Web Dashboard (Next.js / PWA) |
| :--- | :--- | :--- |
| **Sistem Login** | Email/Pass + Biometrik (Sidik Jari/Face ID). | Email/Pass saja (Sesi *login* lebih pendek). |
| **Tampilan Beranda** | Kartu ringkasan gaji, sisa cuti, & tugas aktif. | Identik (Kartu ringkasan yang sama). |
| **Absensi Harian** | **Wajib:** *Face Recognition* ML on-device & GPS *Geofencing*. | **Foto + Approval:** Tanpa ML wajah. Karyawan unggah foto diri, status menunggu persetujuan Superadmin (kecuali sudah masuk daftar *Validasi Otomatis*). |
| **Pengajuan Cuti/Izin** | Form dinamis (langsung *update* kuota). | Identik (Pengalaman mengetik lebih nyaman). |
| **Penggajian (Payroll)**| Lihat ringkasan & *breakdown* komponen dinamis. | Identik + **Optimasi Unduh PDF Slip Gaji** ukuran A4. |
| **Klaim / Reimburse** | Unggah foto nota langsung dari kamera HP. | Unggah *file* (PDF/JPG/PNG) dari *file explorer* PC. |
| **Tugas & Kendaraan** | Mendukung input **Offline** (tersimpan di SQLite). | **Online Only** (Membutuhkan koneksi internet aktif). |
| **Artacom Bot** | *Rule-Based System*, *Offline*, *Context-Aware* (Sensor perangkat). | ❌ **Tidak Tersedia.** Bantuan diarahkan ke halaman FAQ/Pusat Bantuan statis. |
| **SOP & Pengumuman** | Baca PDF via *in-app viewer*. | Baca via *browser tab* atau unduh langsung. |

---

## 📱 3. Spesifikasi Detail: Aplikasi Mobile (Jalur Utama)
Aplikasi bertindak sebagai alat tempur utama di lapangan. Desainnya difokuskan pada kecepatan akses, keandalan di area susah sinyal, dan validasi keamanan. Bagian ini **tidak berubah** dari rancangan sebelumnya.

### A. Alur Absensi ML (Lokal)
1. Karyawan menekan "Absen Masuk".
2. Aplikasi mengaktifkan kamera dan menjalankan model YOLOv11 (Pendeteksi) & MobileNetV2 (Pengenal Identitas) secara *on-device*.
3. Jika vektor wajah cocok dengan data saat registrasi, dan titik koordinat GPS berada dalam radius proyek, absen dicatat otomatis (`Valid`).
4. *Fail-safe:* Jika sinyal hilang saat wajah cocok, data absen dienkripsi dan disimpan di *local storage* untuk dikirim otomatis saat sinyal kembali.

### B. Mode Luring (Offline Mode)
Untuk pengisian *Fleet Log* (Odometer kendaraan) dan *Checklist* Tugas, aplikasi menggunakan arsitektur *Offline-First*. Semua input masuk ke *database* SQLite lokal terlebih dahulu. Ikon "Awan disilang" akan muncul di sudut layar untuk memberi tahu karyawan bahwa data belum masuk ke *server* Laravel.

### C. Artacom Bot (Mobile Only)
Tetap eksklusif di aplikasi mobile karena memanfaatkan sensor perangkat (baterai, jam, lokasi) untuk memberi jawaban kontekstual secara *offline*. Modul ini **tidak direplikasi** ke Web pada versi ini untuk menghindari kompleksitas *maintenance* dua *engine* bot yang berbeda kapabilitasnya.

---

## 💻 4. Spesifikasi Detail: Web Dashboard (Jalur Fallback & Administrasi)
Web Dashboard dirancang agar bisa diakses dari laptop, PC kantor, atau *browser* HP lain saat perangkat utama karyawan rusak. Web ini dapat diinstal sebagai *Progressive Web App* (PWA) agar terasa seperti aplikasi *native*.

### A. Alur Absensi Web (Disederhanakan)
Karena memindahkan beban komputasi AI wajah ke *browser* terlalu berisiko dan tidak efisien, modul *Face Recognition* **dihilangkan sepenuhnya** dari Web. Alur absensi Web kini murni berbasis foto + persetujuan manual, tanpa perlu kolom alasan yang merepotkan karyawan:

1. Karyawan menekan "Absen via Web".
2. Sistem meminta karyawan mengambil/mengunggah **satu foto diri** (dari kamera *browser* atau *file explorer*), lalu otomatis mencatat *timestamp* server dan *IP Address* sebagai metadata pendukung (bukan syarat validasi).
3. Status absensi otomatis menjadi:
   - `Pending` (Kuning) — jika karyawan **belum** termasuk daftar *Validasi Otomatis*, menunggu keputusan Superadmin/Manajer.
   - `Valid` (Hijau) — **langsung tersahkan** jika karyawan termasuk daftar *Validasi Otomatis* (lihat bagian 4C).
4. Jam kerja tetap tercatat sejak foto diunggah, terlepas dari status *Pending*/*Valid*, sehingga tidak merugikan karyawan yang menunggu persetujuan.

### B. Kenyamanan Administratif
Untuk modul yang membutuhkan pembacaan data padat, Web memberikan UX yang lebih superior tanpa mengubah struktur menu:
* **Tabel Gaji:** Rincian komponen gaji (Earning/Deduction) yang panjang ditampilkan dalam format tabel layar lebar, memudahkan pengecekan pajak dan potongan.
* **Tukar Shift:** Tampilan kalender *full-screen* membuat karyawan lebih mudah melihat jadwal rekan kerja yang bisa diajak bertukar *shift*.
* **Pusat Bantuan (Pengganti Artacom Bot):** Panel statis berisi FAQ terstruktur per kategori (Keuangan, Cuti, Dokumen, Perangkat) dengan kolom pencarian sederhana — cukup untuk mengarahkan karyawan tanpa perlu *engine* bot terpisah.

### C. Fitur Baru — Validasi Otomatis (Superadmin)
Untuk mencegah Superadmin/HRD harus menyetujui absensi Web satu per satu setiap hari, ditambahkan mekanisme *whitelist* fleksibel di portal admin:

| Fitur | Deskripsi |
| :--- | :--- |
| **Toggle "Selalu Valid"** | Tombol per karyawan di halaman detail profil. Saat diaktifkan, seluruh absen Web karyawan tersebut langsung berstatus `Valid` tanpa antre approval. |
| **Validasi Massal (Bulk)** | Superadmin dapat memilih banyak karyawan sekaligus (mis. per divisi/lokasi) dan mengaktifkan "Selalu Valid" dalam satu aksi, untuk tim yang memang sering *fallback* ke Web. |
| **Masa Berlaku (Opsional)** | Saat mengaktifkan toggle, Superadmin bisa menentukan periode berlaku (mis. 30 hari) agar status otomatis kembali ke `Pending` dan ditinjau ulang, mencegah *whitelist* dilupakan selamanya. |
| **Jejak Audit (Audit Log)** | Setiap aktivasi/nonaktivasi toggle tercatat: siapa yang mengubah, kapan, dan untuk siapa — agar tetap dapat ditelusuri saat audit internal. |
| **Pengecualian Otomatis** | Meski toggle aktif, sistem tetap menandai `Pending` (butuh review manual) jika ditemukan anomali ringan, misalnya absen di luar jam kerja normal atau dari lokasi/IP yang sangat berbeda dari biasanya. Ini menjaga keseimbangan antara kemudahan dan kontrol. |
| **Notifikasi Ringkasan** | Alih-alih notifikasi per absen, Superadmin cukup menerima ringkasan harian/mingguan berisi jumlah absen `Pending` yang masih perlu ditinjau — mengurangi gangguan tanpa kehilangan visibilitas. |

> Pendekatan ini menjaga alur tetap sederhana: karyawan tepercaya (misalnya staf kantor yang memang jarang ke lapangan) tidak perlu menunggu approval harian, sementara kontrol tetap ada untuk kasus-kasus yang tidak biasa.

---

## 🔄 5. Arsitektur Sinkronisasi (Data State Management)
Kunci dari pengalaman ekosistem yang semirip mungkin adalah integrasi *Database* (MySQL) melalui *RESTful API* Laravel.

* **Single Source of Truth:** Jika karyawan mengajukan cuti di aplikasi *mobile* pada pukul 10:00, lalu membuka Web Dashboard pada pukul 10:01, data cuti tersebut sudah berstatus "Menunggu Persetujuan" di kedua layar.
* **Prioritas Absensi Mobile:** Jika terjadi *input* ganda (karyawan absen masuk di HP tanpa sinyal, lalu absen via Web), *server* Laravel akan memprioritaskan validasi dari **Aplikasi Mobile** (karena memiliki cap waktu kriptografis dari model ML Wajah) saat sinyal HP kembali terhubung, dan menimpa/menghapus data absen Web yang statusnya masih `Pending`. Jika absen Web sudah `Valid` (via Validasi Otomatis) sebelum data mobile masuk, sistem menandai kedua entri untuk ditinjau Superadmin agar tidak terjadi duplikasi jam kerja.
* **Penyimpanan Foto Absen Web:** Foto absen Web disimpan terkompresi di *storage* server (bukan diproses ML), cukup sebagai bukti visual pendukung approval — menjaga beban server tetap ringan.

---

## ✅ 6. Ringkasan Perubahan dari Versi Sebelumnya
1. **Dihapus:** Modul *Artacom Bot* di Web Dashboard → diganti Pusat Bantuan FAQ statis.
2. **Dihapus:** *Face Recognition* di Web (sebelumnya sudah tidak wajib, kini dihilangkan total dari alur).
3. **Disederhanakan:** Absen Web kini cukup unggah foto, tanpa kolom alasan wajib.
4. **Ditambahkan:** Fitur **Validasi Otomatis** (toggle per karyawan, bulk, masa berlaku, audit log, pengecualian anomali, notifikasi ringkasan) agar Superadmin tidak perlu approve manual setiap hari.
5. **Disesuaikan:** Logika *conflict resolution* sinkronisasi mempertimbangkan status `Valid` otomatis dari Web.
