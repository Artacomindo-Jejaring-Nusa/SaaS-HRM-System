# Dokumen Pengujian Blackbox (Blackbox Testing) - OnTime HRMS

Dokumen ini berisi skenario pengujian blackbox menyeluruh untuk seluruh modul dan fitur pada sistem OnTime HRMS, mencakup Backend API, Web Dashboard (Frontend), dan Mobile App.

## 1. 🔑 Autentikasi & Keamanan (Authentication & Security)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Login Standar** | Memasukkan email dan password yang valid | Berhasil login, menerima Access Token, masuk ke Dashboard/Home |
| | Memasukkan password yang salah atau email tidak terdaftar | Akses ditolak, muncul pesan error kredensial tidak valid |
| **Login Google** | Login via akun Google yang sah dengan `company_name` yang tepat | Sesi login terbentuk otomatis (SSO berhasil) tanpa password |
| **Logout** | Menekan tombol logout pada sesi yang sedang aktif | Sesi terhapus, token tidak bisa digunakan lagi, kembali ke layar Login |
| **Refresh Token** | Membiarkan sesi aktif, lalu sistem melakukan request dengan refresh token | Access token diperbarui otomatis di background tanpa memaksa user relogin |
| **Pemisahan Tenant** | User dari Perusahaan A mencoba mengakses data Perusahaan B | Sistem menolak akses (403/404) dan hanya menampilkan data Perusahaan A |
| **Device Binding** | Login menggunakan akun mobile di perangkat fisik yang berbeda | Akses ditolak atau meminta verifikasi pergantian perangkat (hardware ID mismatch) |

## 2. 👥 Manajemen Pegawai & Kantor (Employee & Office Management)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Daftar Pegawai** | HR/Admin membuka halaman daftar pegawai | Seluruh data pegawai tenant tampil beserta jabatannya |
| **Tambah Pegawai** | Menambahkan pegawai baru dengan data profil lengkap | Data tersimpan, pegawai baru bisa login ke sistem |
| **Manajemen WFH** | Mengaktifkan fitur "Toggle WFH" untuk pegawai A | Pegawai A dapat absen dari rumah (bypass validasi radius kantor) |
| **Manajemen Kantor** | Menambahkan kantor cabang baru dengan koordinat GPS & radius | Cabang baru tersimpan dan dapat dijadikan titik acuan absensi pegawai |

## 3. ⏰ Kehadiran & Shift (Attendance & Shift Management)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Check-in Absen** | Absen masuk di dalam radius kantor dengan foto wajah (Liveness) | Absen berhasil tercatat dengan timestamp dan status "Hadir" |
| | Absen masuk di luar radius kantor (dan tidak sedang WFH) | Absen ditolak dengan peringatan "Anda berada di luar radius kantor" |
| **Check-out Absen** | Melakukan absen pulang setelah jam kerja selesai | Jam kepulangan tercatat dan kalkulasi jam kerja dihitung |
| **Koreksi Absen** | Pegawai lupa absen pulang, lalu mengajukan koreksi absen mandiri | Pengajuan berstatus "Pending" dan masuk ke antrean Approval Atasan/HR |
| **Tukar Shift** | Pegawai A mengajukan tukar shift dengan Pegawai B | Pegawai B menerima notifikasi, setelah disetujui, diteruskan ke Atasan |
| | Atasan menyetujui pengajuan tukar shift Pegawai A & B | Jadwal shift Pegawai A dan B otomatis tertukar di kalender sistem |

## 4. 📅 Cuti, Lembur & Reimbursement (Leave, Overtime & Expense)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Pengajuan Cuti** | Mengajukan cuti tahunan dengan tanggal yang valid | Pengajuan berhasil, kuota cuti ditangguhkan sementara, status "Pending" |
| **Pengajuan Lembur** | Mengajukan lembur beserta deskripsi pekerjaan | Masuk ke antrean approval atasan |
| **Reimbursement** | Mengajukan klaim biaya dengan mengunggah lampiran (struk/nota) | Data klaim beserta file gambar/PDF berhasil diunggah dan menunggu persetujuan |
| **Approval Manager** | Manager menyetujui pengajuan cuti/lembur subordinat via Mobile | Status pengajuan berubah menjadi "Approved", notifikasi terkirim ke pemohon |

## 5. ⚙️ Alur Persetujuan Dinamis (Dynamic Approval Workflows)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Setup Workflow** | Admin membuat alur persetujuan Cuti: Step 1 (Supervisor), Step 2 (HR) | Alur persetujuan tersimpan dan aktif |
| **Eksekusi Workflow** | Pegawai mengajukan cuti | Notifikasi approval pertama masuk ke Supervisor. HR tidak bisa setuju sebelum Supervisor menyetujui |

## 6. 🚗 Manajemen Kendaraan / Fleet (Vehicle Logs)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Keberangkatan** | Mencatat log keberangkatan dengan foto odometer awal | Status log kendaraan menjadi "In Use", admin menerima notifikasi |
| **Kepulangan** | Mencatat log kepulangan dengan foto odometer akhir dan biaya tol/bensin | Kalkulasi jarak tempuh dan total biaya tersimpan menunggu validasi |
| **Validasi Log** | Admin me-review dan menyetujui log kendaraan | Log ditutup, biaya masuk ke rekap pengeluaran/reimbursement otomatis |

## 7. 📍 Live Tracking Teknisi (Field Worker Tracking)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Background GPS** | Aplikasi mobile berjalan di background sambil teknisi bergerak | Koordinat GPS terkirim ke server secara periodik |
| **Live Map Dashboard** | Admin membuka halaman Live Tracking | Posisi pin teknisi bergerak di peta secara real-time |
| **Riwayat Rute** | Admin melihat history perjalanan teknisi di tanggal tertentu | Jalur pergerakan teknisi tergambar di peta beserta rincian waktunya |

## 8. 📋 Tugas & Pekerjaan (Tasks & Evidences)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Update Status** | Pegawai mengubah status tugas menjadi "Done" | Status tugas ter-update di sistem |
| **Laporan Aktivitas** | Pegawai mengirim foto "Sebelum" dan "Sesudah" pada tugas | Bukti foto tersimpan dan dapat dilihat oleh pemberi tugas secara langsung |

## 9. 💰 Gaji & Payroll (Payroll Generation)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Generate Gaji** | Admin menjalankan proses generate gaji bulanan secara massal | Sistem mengkalkulasi PPh 21 TER, BPJS, absen, dan lembur secara akurat |
| **Slip Gaji PDF** | Pegawai menekan tombol unduh Slip Gaji di Mobile App | File PDF terunduh dengan data komponen gaji yang valid dan terenkripsi/aman |

## 10. 🏗️ Manajemen Proyek Konstruksi (Project Management)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Buat Proyek** | Membuat proyek baru dengan menetapkan nilai kontrak dan jadwal | Proyek aktif dan masuk ke dashboard KPI |
| **Anggaran (RAB)** | Menambahkan detail item RAB (Bahan baku, Jasa, dll) | Total RAB terakumulasi sesuai item yang dimasukkan |
| **Biaya Aktual** | Mencatat biaya pengeluaran proyek aktual | Indikator progres biaya (Actual vs Budget) terupdate |

## 11. 📡 Notifikasi & Sistem Reverb (Real-time WebSockets)
| Fitur | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- |
| **Notifikasi Instan** | Atasan menyetujui cuti pegawai | Web/Mobile pegawai seketika muncul pop-up notifikasi (dan bunyi audio) tanpa perlu direfresh |

---

*Catatan: Dokumen pengujian ini disesuaikan dengan fitur API Documentation dan arsitektur Multi-tenant, Geofencing, Live Tracking, Dynamic Approval, serta modul HRMS OnTime.*
