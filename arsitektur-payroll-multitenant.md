# Arsitektur & Alur Kerja Sistem Payroll Dinamis Multi-Tenant (SaaS)
**Modul:** Dynamic Payroll Management (Fully Agnostic System)
**Konsep Utama:** Component-Based Payroll Engine + Trigger/Condition Engine

---

## 📌 Ringkasan Konsep

Sistem payroll SaaS harus bisa melayani banyak perusahaan (tenant) dengan aturan gaji, tunjangan, potongan, dan bonus yang **sepenuhnya berbeda satu sama lain** — tanpa perlu mengubah source code tiap kali ada perusahaan baru dengan kebijakan unik.

Untuk mencapai ini, sistem dibangun di atas 3 pilar:
1. **Component-Based Engine** — HRD merakit sendiri komponen gaji (tunjangan/potongan).
2. **Trigger/Condition Engine** — menentukan *kapan* sebuah komponen otomatis muncul (termasuk bonus di hari-hari tertentu).
3. **Snapshot Architecture** — hasil payroll yang sudah terbit tidak pernah berubah walau template komponen diubah di kemudian hari.

---

## ⚙️ Alur Kerja (Workflow) Sistem Payroll

### 1. Pembuatan Master Komponen Gaji (Payroll Components)
HRD perusahaan mendefinisikan komponen tunjangan/potongan mereka sendiri di Web Dashboard.

- **Tipe Komponen:** `Earning` (Pendapatan) atau `Deduction` (Potongan)
- **Aturan Kalkulasi (Calculation Rule):**
  - **Fixed** — nilai tetap tiap bulan (contoh: Tunjangan Jabatan Rp 5.000.000)
  - **Attendance-Based** — dikalikan hari hadir (contoh: Uang Makan Rp 50.000 × Hari Hadir)
  - **Percentage** — persentase dari komponen lain (contoh: BPJS 1% dari Gaji Pokok)
  - **Formula/Expression** — kombinasi rumus lebih kompleks, disimpan sebagai expression string aman (misal via `symfony/expression-language`), contoh:
    `base_salary * 0.01` atau `IF(attendance_days >= 20, 500000, 250000)`
  - **Ad-Hoc** — nilai ditentukan manual pada bulan berjalan (Bonus Tahunan, THR, dsb.)

### 2. Trigger/Condition Engine — "Kapan komponen ini otomatis muncul?"
Bagian ini yang membuat sistem benar-benar *agnostic* terhadap kalender/kebijakan tiap perusahaan. Calculation Rule menjawab **"berapa nilainya"**, sedangkan Trigger menjawab **"kapan dia muncul"**. Disimpan di tabel terpisah `component_triggers`:

| Tipe Trigger | Contoh Kasus |
|---|---|
| `fixed_calendar_date` | Bonus ulang tahun perusahaan, tiap 17 Agustus |
| `date_range` (configurable per tahun) | THR, muncul otomatis H-7 sebelum tanggal Lebaran yang di-input HRD tiap tahun |
| `employee_anniversary` | Bonus tiap karyawan mencapai X tahun masa kerja |
| `recurring_monthly` | Komponen tetap tiap bulan (default untuk Fixed) |
| `manual` | HRD trigger sendiri lewat tombol "Add Variable" saat draft payroll |

Dengan ini, Perusahaan A bisa set "bonus tiap 17 Agustus", Perusahaan B set "bonus tiap ulang tahun karyawan" — tanpa developer perlu sentuh kode sama sekali.

### 3. Penugasan Komponen ke Karyawan (Component Assignment)
Hierarki penempelan komponen ke karyawan:
- **Level Global** — otomatis berlaku untuk seluruh karyawan (misal potongan PPh 21 TER)
- **Level Role/Jabatan** — otomatis berlaku untuk jabatan tertentu (misal Tunjangan Lapangan khusus teknisi)
- **Level Individual** — khusus satu karyawan sesuai kontrak kerjanya

### 4. Eksekusi Penggajian Bulanan (The "Payroll Run")
1. **Pilih Periode** — HRD memilih rentang tanggal (misal 1–30 September)
2. **Kalkulasi Latar Belakang** — sistem menarik data absensi, lembur, cuti (status *Approved*) dari modul terkait
3. **Evaluasi Trigger** — sistem mengecek `component_triggers` mana saja yang aktif untuk periode ini
4. **Eksekusi Rumus** — mesin menghitung total berdasarkan `calculation_rule` tiap komponen yang ter-trigger
5. **Generate Draft** — hasil sementara ditampilkan sebagai tabel (Draft Slip Gaji)

### 5. Penyesuaian Manual / Ad-Hoc
Sebelum draft disahkan, HRD punya fleksibilitas penuh:
- **Tambah/Ubah Baris** — klik "Add Variable" untuk bonus dadakan atau penalti khusus yang tidak ada di aturan tertulis
- **Finalisasi** — tekan "Lock & Publish" → sistem generate PDF slip gaji + kirim notifikasi (push/WhatsApp) ke aplikasi mobile karyawan

---

## 🗄️ Model Relasi Database (Mental Model)

Desain database memanjang ke bawah (banyak baris), bukan melebar ke samping (banyak kolom).

```
companies
  id, name, ...

payroll_components
  id, company_id, name, type (earning/deduction),
  calculation_rule (fixed | attendance | percentage | formula | adhoc),
  formula_expression (nullable, untuk tipe formula)

component_triggers
  id, component_id, trigger_type
  (fixed_calendar_date | date_range | employee_anniversary | recurring_monthly | manual),
  config (JSON — misal {"date": "08-17"} atau {"years_of_service": 5})

employee_components
  employee_id, component_id, base_amount

payslips
  id, employee_id, period_month, period_year, net_salary, status

payslip_details   -- (Tabel Inti, bersifat SNAPSHOT / immutable)
  id, payslip_id, component_name, type (earning/deduction), amount
```

**Prinsip kunci:** `payroll_components` & `component_triggers` = *template hidup* (bisa terus diedit HRD), sedangkan `payslip_details` = *arsip mati* (snapshot nama & nilai, tidak terikat foreign key hidup ke template). Ini memastikan perubahan rumus bulan depan tidak pernah mengubah slip gaji bulan-bulan sebelumnya secara retroaktif.

---

## 🖥️ Dynamic Form Rendering (Frontend)

Karena tiap `calculation_rule` butuh input berbeda:
- `Fixed` → input 1 angka nominal
- `Attendance-Based` → input rate harian
- `Percentage` → input persentase + dropdown komponen sumber
- `Formula` → input expression builder (dengan daftar variabel yang bisa dipakai: `base_salary`, `attendance_days`, dst.)

Dashboard HRD merender form secara dinamis berdasarkan `type` yang dipilih — sama seperti aplikasi mobile yang cukup melakukan *looping* pada `payslip_details` tanpa tahu logika di baliknya.

---

## ✅ Keunggulan Pendekatan Ini

1. **Agnostic & Scalable** — cocok untuk model bisnis SaaS; tiap perusahaan bisa punya sistem payroll 100% berbeda tanpa mengubah source code aplikasi.
2. **Fleksibel untuk Bonus Situasional** — trigger engine menangani bonus hari-hari tertentu (ulang tahun perusahaan, THR, anniversary karyawan) secara otomatis dan configurable per tenant.
3. **Aman secara Historis** — snapshot architecture memastikan slip gaji lama tidak pernah berubah walau template diedit.
4. **Frontend Sederhana** — baik dashboard HRD maupun mobile app karyawan cukup mengandalkan struktur data generik (`type` + `payslip_details`), tanpa hardcode logika bisnis.
5. **Tetap Fleksibel untuk Kasus Tak Terduga** — fitur Ad-Hoc/manual tetap tersedia sebagai jalan keluar untuk kebijakan yang tidak tercakup aturan otomatis.
