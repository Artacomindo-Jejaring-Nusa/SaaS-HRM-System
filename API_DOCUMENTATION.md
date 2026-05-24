# Dokumentasi API Endpoints 🛠️

Seluruh request API harus menyertakan header `Accept: application/json`. Untuk endpoint yang membutuhkan autentikasi, sertakan header `Authorization: Bearer {token}`.

## 🔑 Autentikasi
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/login` | Login user & mendapatkan token |
| `POST` | `/api/login-google` | Login via Google Sign-In (kirim `id_token` & `company_name`) |
| `POST` | `/api/logout` | Logout user & menghapus token |
| `POST` | `/api/refresh-token` | Refresh access token menggunakan refresh token |
| `GET` | `/api/user` | Mendapatkan data profil user saat ini |
| `GET` | `/api/companies/search` | Cari perusahaan berdasarkan nama (`?q=keyword`) |

### Login Google - Request Body
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs...",   // Google ID Token dari Firebase/GoogleSignIn
  "company_name": "Narwasthu Artha Tama",    // Nama perusahaan tenant
  "device_id": "abc123",                      // (Opsional) Device ID untuk mobile
  "fcm_token": "dIiYe0tu..."                 // (Opsional) FCM Token untuk push notification
}
```

## 👥 Manajemen Pegawai
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/employees` | List semua pegawai (Tenant-specific) |
| `POST` | `/api/employees` | Registrasi pegawai baru |
| `GET` | `/api/employees/{id}` | Detail data pegawai |
| `PUT` | `/api/employees/{id}` | Update data pegawai |
| `DELETE` | `/api/employees/{id}` | Hapus data pegawai |
| `POST` | `/api/employees/{id}/toggle-wfh` | Konfigurasi WFH Individual Karyawan |
| `POST` | `/api/employees/bulk-wfh` | Pengaturan status WFH Karyawan massal |

## ⏰ Kehadiran & Shift
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/attendance/check-in` | Absensi masuk (Geo/Selfie) |
| `POST` | `/api/attendance/check-out` | Absensi pulang |
| `GET` | `/api/attendance/today` | Status absensi hari ini |
| `GET` | `/api/attendance/summary` | Ringkasan kehadiran (hadir, telat, alpha, cuti) |
| `GET` | `/api/attendance-corrections` | Daftar riwayat pengajuan koreksi absen |
| `POST` | `/api/attendance-corrections` | Mengajukan koreksi absen mandiri |
| `POST` | `/api/attendance-corrections/{id}/approve` | [HR/Admin] Menyetujui pengajuan koreksi absen |
| `POST` | `/api/attendance-corrections/{id}/reject` | [HR/Admin] Menolak pengajuan koreksi absen |
| `GET` | `/api/attendance/history` | Riwayat absensi user |
| `GET` | `/api/attendance/export` | Export laporan absensi ke Excel |
| `GET` | `/api/shifts` | List semua jam kerja/shift |
| `POST` | `/api/shifts` | Buat master shift baru |
| `GET` | `/api/shift-swap` | List riwayat tukar shift user |
| `POST` | `/api/shift-swap` | Ajukan pertukaran shift baru |
| `POST` | `/api/shift-swap/{id}/respond` | Respon rekan (Terima/Tolak) |
| `POST` | `/api/shift-swap/{id}/approve` | Approval akhir Manager/Atasan |
| `GET` | `/api/shift-swap/report` | Laporan audit semua tukar shift |
| `GET` | `/api/shift-swap/export` | Export laporan tukar shift ke Excel |

## 📅 Cuti, Lembur & Reimbursement
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/leave` | List pengajuan cuti |
| `POST` | `/api/leave` | Ajukan cuti baru |
| `POST` | `/api/leave/{id}/approve` | Persetujuan cuti |
| `POST` | `/api/leave/{id}/reject` | Penolakan cuti |
| `GET` | `/api/overtimes` | List pengajuan lembur |
| `POST` | `/api/overtimes` | Ajukan lembur baru |
| `POST` | `/api/overtimes/{id}/approve` | Persetujuan lembur |
| `POST` | `/api/overtimes/{id}/reject` | Penolakan lembur |
| `GET` | `/api/reimbursements` | List klaim biaya |
| `POST` | `/api/reimbursements` | Ajukan klaim baru (Support multiple `attachments[]` as files) |
| `POST` | `/api/reimbursements/{id}/approve` | Persetujuan klaim biaya |

## 🏢 Portofolio Manager (Mobile)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/manager/pending-requests` | List seluruh pengajuan tertunda dari subordinat (Cuti, Lembur, Klaim, Log Kendaraan) |
| `DELETE` | `/api/manager/pending-requests/{id}` | Hapus/Batalkan pengajuan tertunda dari subordinat |

## 💰 Gaji & Payroll
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/salary` | List slip gaji karyawan (Admin View) |
| `GET` | `/api/payroll/my-history` | List riwayat slip gaji pribadi (Employee View) |
| `GET` | `/api/payroll/settings` | [Admin] Ambil konfigurasi BPJS & Pajak TER |
| `POST` | `/api/payroll/settings` | [Admin] Update konfigurasi Payroll |
| `POST` | `/api/payroll/generate` | [Admin] Generate gaji bulanan massal |
| `GET` | `/api/payroll/history` | [Admin] Lihat rekapitulasi data payroll |
| `GET` | `/api/payroll/export` | [Admin] Export rekap gaji ke Excel |
| `GET` | `/api/payroll/download-slip/{id}` | Download Slip PDF (Support `?token=...` via Browser) |

## 📋 Tugas & Pekerjaan
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/tasks/{id}/status` | Update status tugas (Todo/Done) |
| `POST` | `/api/tasks/{id}/activities` | Kirim laporan aktivitas (Bukti Foto & Catatan) |
| `GET` | `/api/tasks/{id}/activities` | Lihat riwayat aktivitas/bukti kerja tugas |

## 🚗 Manajemen Fleet & Travel Expense
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/vehicle-logs` | List riwayat penggunaan kendaraan |
| `GET` | `/api/vehicle-logs/vehicles` | List kendaraan yang pernah digunakan (autocomplete) |
| `GET` | `/api/vehicle-logs/report` | Laporan mileage (ringkasan jarak & biaya) |
| `GET` | `/api/vehicle-logs/{id}` | Detail log kendaraan spesifik |
| `POST` | `/api/vehicle-logs/departure` | Catat keberangkatan (KM Awal + Foto) |
| `POST` | `/api/vehicle-logs/{id}/return` | Catat kepulangan (KM Akhir + Foto + Biaya) |
| `POST` | `/api/vehicle-logs/{id}/approve` | [Admin/Mgr] Validasi log kendaraan |
| `POST` | `/api/vehicle-logs/{id}/reject` | [Admin/Mgr] Tolak log kendaraan |
| `DELETE` | `/api/vehicle-logs/{id}` | Hapus log (status: departure/rejected) |

 ## 📢 Pengumuman & Hari Libur
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/announcements` | List semua pengumuman |
| `POST` | `/api/announcements` | Buat pengumuman baru |
| `GET` | `/api/holidays` | List kalender hari libur |
| `POST` | `/api/holidays` | Tambah hari libur internal |

## 🏗️ Manajemen Proyek (Konstruksi)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/projects/dashboard` | Dashboard KPI ringkasan proyek |
| `GET` | `/api/projects` | List semua proyek (filter: status, search) |
| `POST` | `/api/projects` | Buat proyek baru |
| `GET` | `/api/projects/{id}` | Detail proyek + summary RAB vs aktual |
| `PUT` | `/api/projects/{id}` | Update data proyek |
| `DELETE` | `/api/projects/{id}` | Hapus proyek |
| `POST` | `/api/projects/{id}/budgets` | Tambah item RAB (Rencana Anggaran Biaya) |
| `PUT` | `/api/projects/{id}/budgets/{bid}` | Update item RAB |
| `DELETE` | `/api/projects/{id}/budgets/{bid}` | Hapus item RAB |
| `POST` | `/api/projects/{id}/costs` | Catat biaya aktual proyek |
| `POST` | `/api/projects/{id}/costs/{cid}/approve` | Setujui biaya proyek |
| `POST` | `/api/projects/{id}/costs/{cid}/reject` | Tolak biaya proyek |
| `POST` | `/api/projects/{id}/contracts` | Tambah kontrak proyek |
| `PUT` | `/api/projects/{id}/contracts/{cid}` | Update kontrak |
| `DELETE` | `/api/projects/{id}/contracts/{cid}` | Hapus kontrak |
| `POST` | `/api/projects/{id}/schedules` | Tambah jadwal/milestone proyek |
| `PUT` | `/api/projects/{id}/schedules/{sid}` | Update jadwal |
| `DELETE` | `/api/projects/{id}/schedules/{sid}` | Hapus jadwal |
| `POST` | `/api/projects/{id}/cash-flows` | Catat transaksi arus kas |
| `DELETE` | `/api/projects/{id}/cash-flows/{cfid}` | Hapus transaksi arus kas |

## 📍 Live Tracking Teknisi
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/tracking/update` | [Mobile] Update koordinat GPS teknisi (background) |
| `GET` | `/api/tracking/live` | [Admin] Ambil posisi terakhir semua teknisi aktif |
| `GET` | `/api/tracking/history/{userId}` | [Admin] Ambil riwayat rute teknisi hari ini |

## 🛠️ Sistem & Settings
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/roles` | List semua jabatan |
| `GET` | `/api/permissions` | List semua hak akses |
| `GET` | `/api/activity-logs` | Lihat riwayat aktivitas sistem |
| `GET` | `/api/notifications` | List notifikasi & pesan |
| `PUT` | `/api/notifications/{id}/read` | Tandai notifikasi sudah dibaca |
| `POST` | `/api/notifications/read-all` | Tandai semua sudah dibaca |
| `POST` | `/api/notifications-clear` | Hapus seluruh riwayat notifikasi |
| `POST` | `/api/profile/update` | Update data profil user |
| `POST` | `/api/profile/upload-photo` | Upload foto profil |
| `POST` | `/api/user/change-password` | Ganti password user |
| `POST` | `/api/notifications/update-fcm-token` | Update token FCM untuk push notification |
| `POST` | `/api/broadcasting/auth` | Autentikasi koneksi WebSocket (Laravel Reverb) |

## 🏢 Manajemen Kantor & Cabang
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/offices` | List semua kantor cabang |
| `POST` | `/api/offices` | Tambah kantor cabang baru |
| `GET` | `/api/offices/{id}` | Detail kantor cabang |
| `PUT` | `/api/offices/{id}` | Update data kantor cabang |
| `DELETE` | `/api/offices/{id}` | Hapus kantor cabang |

## ⚙️ Alur Persetujuan Dinamis (Approval Workflows)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/approval-workflows` | Mengambil semua alur persetujuan kustom aktif |
| `GET` | `/api/approval-workflows/modules` | List modul yang didukung (cuti, izin, lembur, reimbursement, request dana, koreksi absen) |
| `GET` | `/api/approval-workflows/roles` | List semua role/jabatan untuk dropdown approver |
| `GET` | `/api/approval-workflows/users` | List semua user perusahaan untuk dropdown approver |
| `GET` | `/api/approval-workflows/{moduleKey}` | Detail alur persetujuan modul spesifik |
| `POST` | `/api/approval-workflows` | Simpan/update alur persetujuan kustom beserta langkah-langkahnya (HRD/Super Admin) |

### Simpan Workflow - Request Body
```json
{
  "module_key": "leave",
  "name": "Alur Persetujuan Cuti Karyawan",
  "is_active": true,
  "flow_json": null,
  "steps": [
    {
      "step_number": 1,
      "approver_type": "supervisor",
      "approver_role_id": null,
      "approver_user_id": null,
      "sla_hours": 24
    },
    {
      "step_number": 2,
      "approver_type": "role",
      "approver_role_id": 3,
      "approver_user_id": null,
      "sla_hours": 48
    }
  ]
}
```

---
## 📡 Real-time WebSockets (Laravel Reverb)
Aplikasi menggunakan **Laravel Reverb** untuk notifikasi instan. Developer harus melakukan subscribe ke channel berikut setelah login sukses:

### 1. Subscribe Channel
| Channel Type | Nama Channel | Deskripsi |
| :--- | :--- | :--- |
| `Private` | `notifications.{user_id}` | Untuk menerima notifikasi sistem & audio feedback (Approval/Rejection). |

### 2. Listen Events
| Event Class | Nama Event di Channel | Kegunaan |
| :--- | :--- | :--- |
| `NotificationCreated` | `.NotificationCreated` | Dikirim saat ada notifikasi baru, klaim biaya disetujui, atau absen via mobile berhasil. |

---
*Gunakan file `postman/collection.json` untuk dokumentasi lebih detail (contoh body request & response).*)

