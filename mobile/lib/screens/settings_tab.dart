import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_service.dart';
import '../services/notification_service.dart';
import '../services/attendance_alarm_service.dart';
import 'face_registration_screen.dart';
import '../main.dart'; // Import global notifiers

class SettingsTab extends StatefulWidget {
  final VoidCallback onLogout;

  const SettingsTab({super.key, required this.onLogout});

  @override
  State<SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<SettingsTab> {
  final Color maroon = const Color(0xFF800000);
  bool _notifEnabled = true;
  bool _alarmEnabled = true;

  @override
  void initState() {
    super.initState();
    _notifEnabled = NotificationService().isEnabled;
    _alarmEnabled = AttendanceAlarmService().isEnabled;
    AttendanceAlarmService().syncWorkHoursFromBackend().then((_) {
      if (mounted) setState(() {});
    });
  }

  void _showChangePasswordDialog() {
    final currentController = TextEditingController();
    final newController = TextEditingController();
    final confirmController = TextEditingController();
    bool isLoading = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: Text(
            "Ganti Kata Sandi",
            style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDialogField("Kata Sandi Saat Ini", currentController, true),
              const SizedBox(height: 10),
              _buildDialogField("Kata Sandi Baru", newController, true),
              const SizedBox(height: 10),
              _buildDialogField(
                "Konfirmasi Kata Sandi",
                confirmController,
                true,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("Batal", style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: isLoading
                  ? null
                  : () async {
                      if (newController.text.length < 8) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(
                            content: Text("Kata sandi baru minimal 8 karakter"),
                            backgroundColor: Colors.red,
                          ),
                        );
                        return;
                      }
                      if (newController.text != confirmController.text) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(
                            content: Text("Konfirmasi kata sandi tidak cocok"),
                            backgroundColor: Colors.red,
                          ),
                        );
                        return;
                      }

                      setDialogState(() => isLoading = true);
                      final messenger = ScaffoldMessenger.of(context);
                      final result = await ApiService.changePassword(
                        currentController.text,
                        newController.text,
                        confirmController.text,
                      );
                      if (ctx.mounted) {
                        setDialogState(() => isLoading = false);
                      }

                      if (result['success']) {
                        if (ctx.mounted) {
                          Navigator.pop(ctx);
                        }
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text(result['message']),
                            backgroundColor: Colors.green,
                          ),
                        );
                      } else {
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(
                              content: Text(result['message']),
                              backgroundColor: Colors.red,
                            ),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: maroon,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Text("Ganti", style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDialogField(
    String label,
    TextEditingController controller,
    bool isPassword,
  ) {
    return TextField(
      controller: controller,
      obscureText: isPassword,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 15,
          vertical: 12,
        ),
      ),
    );
  }

  // --- SHOW INFO MODALS ---

  void _showInfoModal(
    String title,
    String content, {
    IconData icon = Icons.info_outline_rounded,
    String? subtitle,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
        height: MediaQuery.of(context).size.height * 0.82,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: maroon.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: maroon, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.outfit(
                          fontSize: 19,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF1E293B),
                        ),
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle,
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            color: Colors.grey[600],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.grey),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 16),
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Text(
                    content,
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      height: 1.65,
                      color: const Color(0xFF334155),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: maroon,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  "Tutup",
                  style: GoogleFonts.outfit(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showLanguageSelector() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(25)),
      ),
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 20),
          Text(
            "Pilih Bahasa",
            style: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 10),
          _langItem("Indonesia", "ID", Icons.flag_outlined),
          _langItem("English", "EN", Icons.flag_outlined),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _langItem(String name, String code, IconData icon) {
    return ListTile(
      leading: Icon(icon, color: maroon),
      title: Text(name),
      trailing: languageNotifier.value == code
          ? Icon(Icons.check_circle, color: maroon)
          : null,
      onTap: () async {
        languageNotifier.value = code;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('language', code);
        if (!mounted) return;
        Navigator.pop(context);
        setState(() {});
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(25, 20, 25, 10),
            child: Text(
              "Pengaturan",
              style: GoogleFonts.outfit(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),

          _buildSection("Akun & Keamanan"),
          _buildSettingItem(
            Icons.face_retouching_natural,
            "Pendaftaran Wajah",
            "Daftarkan atau cek status verifikasi wajah",
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const FaceRegistrationScreen(),
                ),
              );
            },
          ),
          _buildSettingItem(
            Icons.lock_reset_outlined,
            "Ganti Kata Sandi",
            "Perbarui kata sandi akun Anda",
            onTap: _showChangePasswordDialog,
          ),
          _buildSettingItem(
            Icons.notifications_none_outlined,
            "Notifikasi",
            "Atur pemberitahuan aplikasi",
            showSwitch: true,
            switchValue: _notifEnabled,
            onSwitchChanged: (val) async {
              await NotificationService().setEnabled(val);
              setState(() => _notifEnabled = val);
            },
          ),

          _buildSection("Preferensi"),
          _buildSettingItem(
            Icons.alarm_on_rounded,
            "Alarm Jam Absensi (Dering)",
            _alarmEnabled
                ? "Aktif • Berdering jam masuk (${AttendanceAlarmService().workStartTime}) & pulang (${AttendanceAlarmService().workEndTime})"
                : "Nonaktif • Alarm suara tidak akan berdering",
            showSwitch: true,
            switchValue: _alarmEnabled,
            onSwitchChanged: (val) async {
              final messenger = ScaffoldMessenger.of(context);
              await AttendanceAlarmService().setEnabled(val);
              if (!mounted) return;
              setState(() => _alarmEnabled = val);
              messenger.showSnackBar(
                SnackBar(
                  content: Text(val
                      ? "Alarm jam absensi diaktifkan"
                      : "Alarm jam absensi dinonaktifkan"),
                  duration: const Duration(seconds: 2),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),
          if (_alarmEnabled)
            _buildSettingItem(
              Icons.volume_up_outlined,
              "Uji Coba Dering Alarm",
              "Bunyikan sampel suara & notifikasi alarm",
              onTap: () async {
                final messenger = ScaffoldMessenger.of(context);
                await AttendanceAlarmService().testAlarm();
                if (mounted) {
                  messenger.showSnackBar(
                    const SnackBar(
                      content: Text("Memutar sampel dering alarm..."),
                      duration: Duration(seconds: 2),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
            ),
          _buildSettingItem(
            Icons.language_outlined,
            "Bahasa",
            languageNotifier.value == "ID" ? "Bahasa Indonesia" : "English",
            value: languageNotifier.value,
            onTap: _showLanguageSelector,
          ),

          _buildSection("Informasi"),
          _buildSettingItem(
            Icons.help_outline_rounded,
            "Pusat Bantuan",
            "FAQ dan panduan fitur aplikasi",
            onTap: () => _showInfoModal(
              "Pusat Bantuan",
              "Selamat datang di Pusat Bantuan OnTime HRMS!\n\n"
                  "1. ABSENSI WAJAH & LOKASI (GPS)\n"
                  "• Pastikan GPS perangkat aktif dengan akurasi tinggi dan Anda berada dalam radius kantor yang terdaftar.\n"
                  "• Posisikan wajah & mata tegak lurus menghadap lingkaran kamera. Kamera akan mendeteksi kestabilan wajah dan mengambil foto secara otomatis.\n"
                  "• Begitu foto berhasil ditangkap, tampilan kamera otomatis berhenti sehingga Anda boleh langsung melepas posisi wajah sementara sistem memproses dan memvalidasi data.\n"
                  "• Absen Dinas Luar: Karyawan yang bertugas di luar kantor wajib memilih tipe 'Dinas Luar' serta mengisi tujuan dan keterangan aktivitas dinas.\n\n"
                  "2. PENGAJUAN & PERSETUJUAN\n"
                  "• Cuti: Mengurangi saldo cuti tahunan atau hak cuti khusus secara otomatis setelah disetujui.\n"
                  "• Izin: Untuk keperluan izin datang terlambat, pulang awal, atau izin sakit (bisa melampirkan surat dokter).\n"
                  "• Klaim Biaya: Pengajuan klaim pengeluaran operasional, wajib melampirkan foto nota/struk pembayaran.\n"
                  "• Pengajuan Dana / Kasbon: Pengajuan dana operasional di muka sebelum transaksi dilakukan (tidak memerlukan nota).\n"
                  "• Lembur: Mengisi estimasi waktu lembur dan rincian pekerjaan yang dilakukan.\n"
                  "• Tukar Shift: Ajukan pergantian jadwal kerja langsung ke rekan satu tim lalu diverifikasi atasan.\n\n"
                  "3. MENU MANAJER\n"
                  "• Menu khusus bagi atasan/manajer yang diberi wewenang persetujuan oleh Admin.\n"
                  "• Menyetujui atau menolak permohonan bawahan secara berjenjang.\n"
                  "• Memantau kehadiran dan lokasi anggota tim secara langsung.\n\n"
                  "4. PELACAKAN LOKASI & KENDARAAN DINAS\n"
                  "• Pelacakan lokasi otomatis aktif saat jam shift kerja berlangsung.\n"
                  "• Log Kendaraan: Catat perjalanan dinas kendaraan kantor dengan mencantumkan tujuan dan foto odometer.\n\n"
                  "5. SLIP GAJI DIGITAL\n"
                  "• Rincian gaji bulanan terintegrasi potongan BPJS dan perhitungan pajak PPh 21.\n"
                  "• Unduh slip gaji dalam format PDF langsung dari menu Slip Gaji.\n\n"
                  "6. KEAMANAN PERANGKAT\n"
                  "• Satu akun karyawan terikat pada 1 perangkat untuk mencegah kecurangan.\n"
                  "• Apabila Anda mengganti perangkat baru, hubungi Admin atau tim IT perusahaan Anda.\n\n"
                  "7. BANTUAN & DUKUNGAN\n"
                  "• Jam Operasional: Senin – Jumat (08:30 – 17:30 WIB)\n"
                  "• Email: support@artacomindo.com\n"
                  "• PT. Artacomindo Jejaring Nusa",
              icon: Icons.help_outline_rounded,
              subtitle: "Panduan Penggunaan & FAQ",
            ),
          ),
          _buildSettingItem(
            Icons.policy_outlined,
            "Kebijakan Privasi",
            "Syarat dan ketentuan perlindungan data",
            onTap: () => _showInfoModal(
              "Kebijakan Privasi",
              "Kebijakan Privasi Aplikasi OnTime HRMS (PT. Artacomindo Jejaring Nusa)\n\n"
                  "Kerahasiaan dan keamanan data pribadi Anda merupakan komitmen utama kami. Dokumen ini menjelaskan pengumpulan, penggunaan, dan perlindungan data pada ekosistem OnTime HRMS:\n\n"
                  "1. PENGUMPULAN DATA BIOMETRIK WAJAH\n"
                  "• Foto selfie yang diambil saat pendaftaran wajah dan proses absensi diubah menjadi representasi vektor numerik 128-dimensi terenkripsi.\n"
                  "• Data biometrik hanya digunakan untuk memverifikasi keaslian dan kesesuaian identitas karyawan saat melakukan absensi masuk & pulang.\n"
                  "• Kami tidak pernah membagikan atau menjual data biometrik Anda kepada pihak ketiga mana pun.\n\n"
                  "2. DATA LOKASI GEOGRAFIS (GPS & BACKGROUND TRACKING)\n"
                  "• Koordinat GPS dikumpulkan pada saat absensi untuk memastikan kehadiran berada dalam radius kantor cabang yang sah (Geofencing).\n"
                  "• Layanan Lokasi Latar Belakang (Background Location) hanya aktif selama shift kerja berlangsung bagi teknisi/lapangan yang bertugas dengan indikator notifikasi aktif di bilah status. Pelacakan otomatis berhenti saat absen pulang.\n\n"
                  "3. DATA TRANSAKSI & DOKUMEN LAMPIRAN\n"
                  "• Foto nota klaim pengeluaran, surat keterangan dokter, foto odometer kendaraan, dan tanda tangan digital disimpan dengan aman di server internal perusahaan untuk keperluan audit dan persetujuan operasional.\n\n"
                  "4. DATA PERANGKAT (DEVICE ID) & KEAMANAN\n"
                  "• Pengidentifikasi unik perangkat smartphone (Device ID) dicatat untuk mencegah manipulasi, penggunaan akun ganda, atau pemasangan lokasi palsu (Fake GPS / Mock Location).\n\n"
                  "5. DATA PENGGAJIAN & KEUANGAN\n"
                  "• Informasi nomor rekening bank, rincian komponen gaji, dan pemotongan pajak PPh 21 dikelola secara ketat dengan protokol enkripsi enterprise dan hanya dapat diakses oleh bagian Finance & HRD yang berwenang.\n\n"
                  "6. HAK AKSES DAN PENGHAPUSAN DATA\n"
                  "• Karyawan berhak meninjau seluruh data riwayat kehadiran, dokumen pengajuan, dan mengajukan pembaruan data profil atau pendaftaran ulang biometrik wajah melalui Super Admin perusahaan.",
              icon: Icons.shield_outlined,
              subtitle: "Ketentuan Perlindungan & Keamanan Data",
            ),
          ),
          _buildSettingItem(
            Icons.info_outline_rounded,
            "Tentang Aplikasi",
            "Versi 2.1 Enterprise",
            onTap: () => _showInfoModal(
              "Tentang Aplikasi",
              "OnTime HRMS\n"
                  "Versi 2.1\n\n"
                  "Aplikasi Manajemen SDM modern dengan fitur:\n"
                  "• Absensi dengan Pengenalan Wajah Otomatis\n"
                  "• Validasi Lokasi Kantor (GPS)\n"
                  "• Alur Persetujuan Bertingkat (Cuti, Izin, Lembur, Klaim, Kasbon)\n"
                  "• Pelacakan Lokasi & Manajemen Kendaraan Dinas\n"
                  "• Tukar Shift & Kalender Kerja Tim\n"
                  "• Slip Gaji Digital (PPh 21 & BPJS)\n"
                  "• Keamanan Perangkat Tunggal\n\n"
                  "Dikembangkan oleh Tim Pengembang.\n"
                  "Hak Cipta © 2026 PT. Artacomindo Jejaring Nusa.\n"
                  "Seluruh hak cipta dilindungi undang-undang.",
              icon: Icons.info_outline_rounded,
              subtitle: "Informasi Sistem & Versi Aplikasi",
            ),
          ),

          const SizedBox(height: 30),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 25.0),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: widget.onLogout,
                icon: const Icon(Icons.logout_rounded, color: Colors.white),
                label: const Text(
                  "KELUAR AKUN",
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: maroon,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                  elevation: 0,
                ),
              ),
            ),
          ),
          const SizedBox(height: 50),
        ],
      ),
    );
  }

  Widget _buildSection(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(25, 25, 25, 10),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.outfit(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: Colors.grey[500],
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildSettingItem(
    IconData icon,
    String title,
    String subtitle, {
    String? value,
    bool showSwitch = false,
    bool switchValue = false,
    ValueChanged<bool>? onSwitchChanged,
    VoidCallback? onTap,
  }) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 25, vertical: 5),
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: maroon.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: maroon, size: 24),
      ),
      title: Text(
        title,
        style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(fontSize: 12, color: Colors.grey),
      ),
      trailing: showSwitch
          ? Switch(
              value: switchValue,
              onChanged: onSwitchChanged,
              activeThumbColor: maroon,
            )
          : (value != null
                ? Text(
                    value,
                    style: TextStyle(
                      color: maroon,
                      fontWeight: FontWeight.bold,
                    ),
                  )
                : const Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 16,
                    color: Colors.grey,
                  )),
      onTap: showSwitch ? null : onTap,
    );
  }
}
