import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:geolocator/geolocator.dart';
import '../api/api_service.dart';
import 'profile_screen.dart';
import 'riwayat_screen.dart';
import '../services/notification_service.dart';
import '../services/attendance_alarm_service.dart';

import 'package:intl/intl.dart';
import 'attendance_screen.dart';
import 'settings_tab.dart';
import 'leave_screen.dart';
import 'permit_screen.dart';
import 'overtime_screen.dart';
import 'salary_screen.dart';
import 'task_screen.dart';
import 'reimbursement_screen.dart';
import 'holiday_screen.dart';
import 'kpi_screen.dart';
import 'manager_screen.dart';
import 'shift_swap_screen.dart';
import 'attendance_correction_screen.dart';
import 'leaderboard_screen.dart';
import 'fleet_log_screen.dart';
import 'document_screen.dart';
import 'fund_request_screen.dart';
import 'artacom_bot_screen.dart';
import 'organization_chart_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../widgets/skeleton_loading.dart';

class DashboardScreen extends StatefulWidget {
  @override
  _DashboardScreenState createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;
  String _userName = "Memuat...";
  String _userRole = "";
  String? _profilePhotoUrl;
  bool _isManager = false;
  String? _attendanceType;
  bool _isWfhActive = false;
  Set<String> _permissions = {};

  bool _hasPermission(String slug, [String? fallbackSlug]) {
    final lowerRole = _userRole.toLowerCase();
    if (lowerRole == 'super admin' || lowerRole == 'superadmin' || lowerRole.contains('super admin')) {
      return true;
    }
    if (_permissions.contains(slug)) return true;
    if (fallbackSlug != null && _permissions.contains(fallbackSlug)) return true;
    return false;
  }

  // Custom Menu
  List<String> _pinnedMenuIds = ['absen', 'cuti', 'klaim', 'lembur'];
  bool _isMenuExpanded = false;
  Map<String, dynamic>? _attendanceData;
  String? _scheduleLabel;
  String? _shiftName;
  List<dynamic> _announcements = [];
  List<dynamic> _holidays = [];
  bool _hasUnreadNotification = false;
  int _pendingTaskCount = 0;
  bool _isLoadingContent = true;
  bool _isProcessingAttendance = false;

  final Color primaryColor = Color(0xFF800000);
  final Color secondaryColor = Color(0xFFB00000);

  @override
  void initState() {
    super.initState();
    _refreshData();
    NotificationService().startPolling();
  }

  Future<void> _refreshData() async {
    setState(() => _isLoadingContent = true);
    await Future.wait([
      _fetchProfile(),
      _fetchAttendance(),
      _loadPinnedMenus(),
      _fetchDashboardContent(),
      _fetchNotifications(),
    ]);
    if (mounted) setState(() => _isLoadingContent = false);
  }

  Future<void> _fetchNotifications() async {
    try {
      final notifs = await ApiService.getNotifications();
      if (notifs != null && mounted) {
        setState(() {
          _hasUnreadNotification = notifs.any(
            (n) => n['is_read'] == false || n['is_read'] == 0,
          );
        });
      }
    } catch (e) {
      print("Error fetching notifications: $e");
    }
  }

  Future<void> _fetchDashboardContent() async {
    try {
      final ann = await ApiService.getAnnouncements();
      final hol = await ApiService.getHolidays();
      final tasks = await ApiService.getTasks();
      if (mounted) {
        setState(() {
          _announcements = ann ?? [];
          _holidays = hol ?? [];
          if (tasks != null) {
            _pendingTaskCount = tasks.where((t) => t['status'] != 'completed' && t['status'] != 'cancelled').length;
          }
        });
      }
    } catch (e) {
      print("Error fetching dash content: $e");
    }
  }

  Future<void> _loadPinnedMenus() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList('pinned_menus');
    if (saved != null && saved.isNotEmpty) {
      if (mounted) {
        setState(() {
          _pinnedMenuIds = List.from(saved);
        });
      }
    }
  }

  Future<void> _fetchAttendance() async {
    final data = await ApiService.getTodayAttendance();
    if (mounted) {
      setState(() {
        _attendanceData = data;
      });
    }
  }

  void _showAnnouncementDetail(Map<String, dynamic> announcement) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          child: Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.7,
            ),
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header dengan icon dan judul
                Row(
                  children: [
                    Container(
                      padding: EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: primaryColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        Icons.campaign,
                        color: primaryColor,
                        size: 28,
                      ),
                    ),
                    SizedBox(width: 16),
                    Expanded(
                      child: Text(
                        announcement['title'] ?? "Pengumuman",
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: primaryColor,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.close, size: 24),
                      onPressed: () => Navigator.of(context).pop(),
                      padding: EdgeInsets.zero,
                      constraints: BoxConstraints(),
                    ),
                  ],
                ),
                SizedBox(height: 16),
                // Tanggal pembuat pengumuman
                Row(
                  children: [
                    Icon(
                      Icons.calendar_today,
                      size: 14,
                      color: Colors.grey[600],
                    ),
                    SizedBox(width: 8),
                    Text(
                      DateFormat('dd MMMM yyyy, HH:mm')
                          .format(DateTime.parse(announcement['created_at'] ?? DateTime.now().toIso8601String())),
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                    SizedBox(width: 16),
                    if (announcement['user'] != null) ...[
                      Icon(
                        Icons.person_outline,
                        size: 14,
                        color: Colors.grey[600],
                      ),
                      SizedBox(width: 8),
                      Text(
                        announcement['user']['name'] ?? 'Admin',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ],
                ),
                SizedBox(height: 20),
                Divider(height: 1, thickness: 1),
                SizedBox(height: 20),
                // Konten pengumuman - scrollable
                Flexible(
                  child: SingleChildScrollView(
                    child: Text(
                      announcement['content'] ?? "Tidak ada konten.",
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        height: 1.6,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                ),
                SizedBox(height: 20),
                // Tombol tutup
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: Text(
                      "Tutup",
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _formatTime(String? dateTimeStr) {
    if (dateTimeStr == null) return "--:--";
    try {
      final DateTime dt = DateTime.parse(dateTimeStr).toLocal();
      return DateFormat('HH:mm').format(dt);
    } catch (e) {
      return "--:--";
    }
  }

  @override
  void dispose() {
    NotificationService().stopPolling();
    super.dispose();
  }

  Future<void> _fetchProfile() async {
    final userData = await ApiService.getProfile();
    if (userData != null && mounted) {
      String? rawUrl = userData['profile_photo_url'];
      rawUrl = ApiService.fixUrl(rawUrl);
      setState(() {
        _userName = userData['name'] ?? "Karyawan";
        String roleName = "";
        if (userData['role'] != null) {
          roleName = userData['role']['name'] ?? "";
          _userRole = roleName;
        }
        _profilePhotoUrl = rawUrl;
        
        // Extract permissions from permission_slugs or role.permissions
        final Set<String> perms = {};
        if (userData['permission_slugs'] is List) {
          for (var p in userData['permission_slugs']) {
            if (p != null) perms.add(p.toString());
          }
        }
        if (userData['role'] != null && userData['role']['permissions'] is List) {
          for (var p in userData['role']['permissions']) {
            if (p is Map && p['slug'] != null) {
              perms.add(p['slug'].toString());
            }
          }
        }
        _permissions = perms;

        // Determine Manager Portal access:
        if (userData['can_access_manager_portal'] == false) {
          _isManager = false;
        } else if (userData['can_access_manager_portal'] == true) {
          _isManager = true;
        } else if (userData['role_id'] == 1 ||
            (userData['role'] != null && userData['role']['id'] == 1) ||
            (userData['role'] != null && userData['role']['name'] == 'Super Admin')) {
          _isManager = true;
        } else if (userData['is_manager'] != null) {
          _isManager = userData['is_manager'] == true;
        } else {
          _isManager = _hasPermission('view-manager-portal') ||
              _hasPermission('manage-approvals') ||
              _hasPermission('view-approvals') ||
              _hasPermission('approve-leaves') ||
              _hasPermission('approve-permits') ||
              _hasPermission('approve-overtimes') ||
              _hasPermission('approve-reimbursements') ||
              _hasPermission('approve-fund-requests') ||
              _hasPermission('approve-vehicle-logs') ||
              _hasPermission('approve-shift-swaps') ||
              _hasPermission('approve-project-costs') ||
              _hasPermission('approve-payroll') ||
              _hasPermission('approve-attendance-corrections');
        }

        final int maxIndex = _isManager ? 5 : 4;
        if (_selectedIndex > maxIndex) {
          _selectedIndex = 0;
        }

        _attendanceType = userData['attendance_type'];
        _isWfhActive = userData['is_wfh_active'] == true;
        final isShiftWorker = _attendanceType == 'shift';
        final hasShiftToday = userData['today_shift'] != null;

        if (isShiftWorker && !hasShiftToday) {
          _scheduleLabel = userData['schedule_label'] ?? 'Tidak Ada Shift';
          _shiftName = 'Tidak Ada Shift';
        } else {
          _scheduleLabel = userData['schedule_label'] ??
              "${userData['work_start_time'] ?? '08:30'} - ${userData['work_end_time'] ?? '17:30'}";
          _shiftName = userData['shift_name'];
        }
      });

      // Sync and start ringing alarm service
      AttendanceAlarmService().updateWorkHours(
        startTime: userData['work_start_time']?.toString(),
        endTime: userData['work_end_time']?.toString(),
      );
      AttendanceAlarmService().start();
    }
  }

  Future<Position> _determinePosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return Future.error('GPS belum diaktifkan.');

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return Future.error('Izin lokasi ditolak.');
    }
    
    return await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
  }

  Future<void> _showDinasLuarDialog() async {
    final destinationController = TextEditingController();
    final notesController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.amber[50],
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.business_center, color: Colors.amber, size: 24),
            ),
            const SizedBox(width: 10),
            Text(
              "Absen Dinas Luar",
              style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Absen dinas luar tidak dibatasi radius kantor dan akan otomatis diteruskan ke Supervisor untuk persetujuan.",
              style: TextStyle(color: Colors.grey[600], fontSize: 12),
            ),
            const SizedBox(height: 15),
            TextField(
              controller: destinationController,
              decoration: InputDecoration(
                labelText: "Tujuan Dinas Luar *",
                hintText: "Contoh: Kantor Klien PT ABC / Proyek Lapangan",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                prefixIcon: const Icon(Icons.location_on_outlined),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notesController,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: "Keterangan Kegiatan (Opsional)",
                hintText: "Catatan tugas dinas luar...",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                prefixIcon: const Icon(Icons.note_alt_outlined),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text("Batal"),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () {
              if (destinationController.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("Tujuan Dinas Luar wajib diisi!"), backgroundColor: Colors.red),
                );
                return;
              }
              Navigator.pop(ctx, true);
            },
            child: const Text("Lanjut Selfie", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final dynamic res = await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (c) => AttendanceScreen(
            isCheckIn: true,
            attendanceType: 'dinas_luar',
            dinasLuarDestination: destinationController.text.trim(),
            dinasLuarNotes: notesController.text.trim(),
          ),
        ),
      );
      if (res != null) {
        _refreshData();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Absen Dinas Luar Berhasil! Menunggu persetujuan Supervisor."),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  Future<void> _onAbsenTapped() async {
    final bool isCheckIn = _attendanceData?['check_in'] == null;

    if (!isCheckIn) {
      // Langsung buka kamera untuk Absen Pulang
      final dynamic res = await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (c) => const AttendanceScreen(isCheckIn: false),
        ),
      );
      if (res != null) {
        _refreshData();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Absen Pulang Berhasil!"), backgroundColor: Colors.green),
        );
      }
      return;
    }

    // Pilihan Absen Masuk: WFA (jika aktif), Kantor, atau Dinas Luar
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Container(
        padding: const EdgeInsets.fromLTRB(25, 16, 25, 28),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(10)),
            ),
            const SizedBox(height: 20),
            Text(
              "Pilih Jenis Presensi Masuk",
              style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Text(
              _isWfhActive 
                ? "Anda memiliki izin WFA aktif. Anda dapat memilih Presensi WFA untuk absen dari mana saja."
                : "Pilih Absen Kantor jika berada di kantor, atau Dinas Luar jika bertugas di luar area kantor.",
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600], fontSize: 13),
            ),
            const SizedBox(height: 20),

            // Card Khusus WFA (Hanya muncul jika diizinkan oleh Super Admin)
            if (_isWfhActive) ...[
              GestureDetector(
                onTap: () async {
                  Navigator.pop(context);
                  final dynamic res = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (c) => const AttendanceScreen(isCheckIn: true, attendanceType: 'wfh'),
                    ),
                  );
                  if (res != null) {
                    _refreshData();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("Absen WFA Berhasil! Selamat bekerja."),
                        backgroundColor: Color(0xFF4F46E5),
                      ),
                    );
                  }
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF3730A3), Color(0xFF4F46E5)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF4F46E5).withOpacity(0.35),
                        blurRadius: 14,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.18),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(Icons.roofing_rounded, color: Colors.white, size: 28),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  "Presensi WFA",
                                  style: GoogleFonts.outfit(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF10B981).withOpacity(0.3),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFF34D399).withOpacity(0.6)),
                                  ),
                                  child: const Text(
                                    "Izin Aktif",
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 3),
                            Text(
                              "Bebas absen dari mana saja tanpa batasan radius kantor",
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.88),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white70, size: 16),
                    ],
                  ),
                ),
              ),
            ],

            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () async {
                      Navigator.pop(context);
                      final dynamic res = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (c) => const AttendanceScreen(isCheckIn: true, attendanceType: 'office'),
                        ),
                      );
                      if (res != null) {
                        _refreshData();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text("Absensi Berhasil!"), backgroundColor: Colors.green),
                        );
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      decoration: BoxDecoration(
                        color: primaryColor,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [BoxShadow(color: primaryColor.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 5))],
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.face_retouching_natural, color: Colors.white, size: 28),
                          SizedBox(height: 8),
                          Text("Absen Kantor", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                          Text("(Selfie / Normal)", style: TextStyle(color: Colors.white70, fontSize: 10)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      Navigator.pop(context);
                      _showDinasLuarDialog();
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      decoration: BoxDecoration(
                        color: Colors.amber[700],
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [BoxShadow(color: Colors.amber.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 5))],
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.business_center, color: Colors.white, size: 28),
                          SizedBox(height: 8),
                          Text("Dinas Luar", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                          Text("(Luar Kantor)", style: TextStyle(color: Colors.white70, fontSize: 10)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  void _onItemTapped(int index) {
    setState(() => _selectedIndex = index);
  }

  void _handleLogout() async {
    NotificationService().stopPolling();
    await ApiService.logout();
    if (mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 4 && hour < 11) return "Selamat Pagi,";
    if (hour >= 11 && hour < 15) return "Selamat Siang,";
    if (hour >= 15 && hour < 18) return "Selamat Sore,";
    return "Selamat Malam,";
  }

  DateTime? _lastPressedAt;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) async {
          if (didPop) return;

          if (_selectedIndex != 0) {
            setState(() => _selectedIndex = 0);
            return;
          }

          final now = DateTime.now();
          if (_lastPressedAt == null ||
              now.difference(_lastPressedAt!) > const Duration(seconds: 2)) {
            _lastPressedAt = now;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text("Tekan sekali lagi untuk keluar"),
                duration: Duration(seconds: 2),
              ),
            );
            return;
          }

          Navigator.of(context).pop();
        },
        child: Scaffold(
          backgroundColor: const Color(0xFFFBFBFB),
          body: RefreshIndicator(
            onRefresh: _refreshData,
            color: primaryColor,
            child: SafeArea(
              child: Stack(
                children: [
                  _isLoadingContent
                      ? const DashboardSkeleton()
                      : _getBody(),
                  if (_isProcessingAttendance)
                    Container(
                      color: Colors.black54,
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const CircularProgressIndicator(color: Colors.white),
                            const SizedBox(height: 20),
                            Text(
                              "Memproses Absensi Cepat...",
                              style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          floatingActionButton:
              (_selectedIndex == 0 && _attendanceData?['check_out'] == null)
              ? Container(
                  height: 50,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(28),
                    gradient: LinearGradient(
                      colors: [primaryColor, secondaryColor],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: primaryColor.withValues(alpha: 0.35),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: ElevatedButton.icon(
                    onPressed: _onAbsenTapped,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                    ),
                    icon: const Icon(
                      Icons.face_retouching_natural,
                      color: Colors.white,
                      size: 20,
                    ),
                    label: Text(
                      _attendanceData?['check_in'] == null
                          ? "ABSEN SEKARANG"
                          : "ABSEN PULANG",
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 0.8,
                        fontSize: 13,
                      ),
                    ),
                  ),
                )
              : null,
          floatingActionButtonLocation:
              FloatingActionButtonLocation.centerFloat,
          bottomNavigationBar: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                top: BorderSide(
                  color: Colors.black.withValues(alpha: 0.06),
                  width: 1,
                ),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 16,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: BottomNavigationBar(
              elevation: 0,
              backgroundColor: Colors.transparent,
              currentIndex: _selectedIndex.clamp(0, _isManager ? 5 : 4),
              onTap: _onItemTapped,
              selectedItemColor: primaryColor,
              unselectedItemColor: const Color(0xFF94A3B8),
              showUnselectedLabels: true,
              type: BottomNavigationBarType.fixed,
              selectedFontSize: 11,
              unselectedFontSize: 10,
              selectedLabelStyle: GoogleFonts.outfit(fontWeight: FontWeight.bold, height: 1.3),
              unselectedLabelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w500, height: 1.3),
              iconSize: 22,
              items: [
                BottomNavigationBarItem(
                  icon: const Icon(Icons.home_outlined),
                  activeIcon: const Icon(Icons.home),
                  label: "Beranda",
                ),
                BottomNavigationBarItem(
                  icon: const Icon(Icons.smart_toy_outlined),
                  activeIcon: const Icon(Icons.smart_toy),
                  label: "Asisten",
                ),
                BottomNavigationBarItem(
                  icon: const Icon(Icons.list_alt_outlined),
                  activeIcon: const Icon(Icons.list_alt),
                  label: "Riwayat",
                ),
                BottomNavigationBarItem(
                  icon: const Icon(Icons.person_outline),
                  activeIcon: const Icon(Icons.person),
                  label: "Profil",
                ),
                if (_isManager)
                  BottomNavigationBarItem(
                    icon: const Icon(Icons.admin_panel_settings_outlined),
                    activeIcon: const Icon(Icons.admin_panel_settings),
                    label: "Manajer",
                  ),
                BottomNavigationBarItem(
                  icon: const Icon(Icons.settings_outlined),
                  activeIcon: const Icon(Icons.settings),
                  label: "Pengaturan",
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Map<String, Map<String, dynamic>> _getMenuItems() {
    final items = {
      'absen': {
        'icon': Icons.camera_front,
        'label': 'Absen',
        'color': primaryColor,
        'onTap': () => _onAbsenTapped(),
      },
      'cuti': {
        'icon': Icons.calendar_month,
        'label': 'Cuti',
        'color': Colors.orange[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => LeaveScreen()),
        ),
      },
      'permit': {
        'icon': Icons.assignment_turned_in_outlined,
        'label': 'Izin',
        'color': Colors.blueGrey[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => PermitScreen()),
        ),
      },
      'klaim': {
        'icon': Icons.payments_outlined,
        'label': 'Klaim',
        'color': Colors.blue[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => ReimbursementScreen()),
        ),
      },
      'lembur': {
        'icon': Icons.more_time,
        'label': 'Lembur',
        'color': Colors.red[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => OvertimeScreen()),
        ),
      },
      'gaji': {
        'icon': Icons.receipt_long,
        'label': 'Gaji',
        'color': Colors.green[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => SalaryScreen()),
        ),
      },
      'tugas': {
        'icon': Icons.task,
        'label': 'Tugas',
        'color': Colors.teal[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => TaskScreen()),
        ),
      },
      'libur': {
        'icon': Icons.event_available,
        'label': 'Libur',
        'color': Colors.deepOrange[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => HolidayScreen()),
        ),
      },
      'riwayat': {
        'icon': Icons.history_edu,
        'label': 'Riwayat',
        'color': Colors.purple[800],
        'onTap': () => _onItemTapped(2),
      },
      'kpi': {
        'icon': Icons.star_rate_rounded,
        'label': 'Review KPI',
        'color': Color(0xFF8B0000),
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => KpiScreen()),
        ),
      },
      'swap': {
        'icon': Icons.swap_horizontal_circle,
        'label': 'Tukar Shift',
        'color': primaryColor,
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => ShiftSwapScreen()),
        ),
      },
      'koreksi': {
        'icon': Icons.edit_calendar,
        'label': 'Koreksi Absen',
        'color': Colors.deepPurple[700],
        'onTap': () async {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => AttendanceCorrectionScreen()),
          );
          _refreshData();
        },
      },
      'leaderboard': {
        'icon': Icons.emoji_events,
        'label': 'Leaderboard',
        'color': Colors.amber[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => LeaderboardScreen()),
        ),
      },
      'fleet': {
        'icon': Icons.directions_car_filled,
        'label': 'Fleet Log',
        'color': Colors.indigo[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => FleetLogScreen()),
        ),
      },
      'dokumen': {
        'icon': Icons.description_outlined,
        'label': 'Dokumen',
        'color': Colors.blue[900],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => DocumentScreen()),
        ),
      },
      'dana': {
        'icon': Icons.account_balance_wallet_outlined,
        'label': 'Pengajuan Dana',
        'color': Colors.brown[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => FundRequestScreen()),
        ),
      },
      'proyek': {
        'icon': Icons.engineering_outlined,
        'label': 'Management Project',
        'color': Colors.orange[900],
        'onTap': () => _showUnderDevelopmentAlert(context),
      },
      'organisasi': {
        'icon': Icons.account_tree_outlined,
        'label': 'Organisasi',
        'color': Colors.indigo[800],
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const OrganizationChartScreen()),
        ),
      },
    };

    // Filter dynamic menu items based on Super Admin configured permissions
    if (!_hasPermission('apply-attendances', 'view-attendances')) {
      items.remove('absen');
    }
    if (!_hasPermission('view-leaves', 'apply-leaves')) {
      items.remove('cuti');
    }
    if (!_hasPermission('view-permits', 'apply-permits')) {
      items.remove('permit');
    }
    if (!_hasPermission('view-reimbursements', 'apply-reimbursements')) {
      items.remove('klaim');
    }
    if (!_hasPermission('view-overtimes', 'apply-overtimes')) {
      items.remove('lembur');
    }
    if (!_hasPermission('view-salaries')) {
      items.remove('gaji');
    }
    if (!_hasPermission('view-tasks', 'manage-tasks') && !_hasPermission('assign-tasks') && !_hasPermission('receive-tasks')) {
      items.remove('tugas');
    }
    if (!_hasPermission('view-kpis')) {
      items.remove('kpi');
    }
    if (!_hasPermission('view-shift-swaps', 'apply-shift-swaps')) {
      items.remove('swap');
    } else if (!_isManager && _attendanceType != 'shift') {
      items.remove('swap');
    }
    if (!_hasPermission('manage-attendance-corrections')) {
      items.remove('koreksi');
    }
    if (!_hasPermission('view-vehicle-logs', 'apply-vehicle-logs')) {
      items.remove('fleet');
    }
    if (!_hasPermission('view-documents')) {
      items.remove('dokumen');
    }
    if (!_hasPermission('view-fund-requests', 'apply-fund-requests')) {
      items.remove('dana');
    }
    if (!_hasPermission('view-projects')) {
      items.remove('proyek');
    }
    if (!_hasPermission('view-organization', 'view-directory')) {
      items.remove('organisasi');
    }
    if (!_hasPermission('manage-holidays', 'view-attendances')) {
      items.remove('libur');
    }
    if (!_hasPermission('view-attendances')) {
      items.remove('riwayat');
    }

    return items;
  }

  void _showUnderDevelopmentAlert(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext context) {
        return BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
          child: Dialog(
            backgroundColor: Colors.transparent,
            insetPadding: EdgeInsets.symmetric(horizontal: 20),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Blurry background effect
                Positioned.fill(
                  child: GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(color: Colors.transparent),
                  ),
                ),
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.all(30),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(30),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 20,
                        spreadRadius: 5,
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.amber[50],
                          borderRadius: BorderRadius.circular(25),
                        ),
                        child: Icon(
                          Icons.engineering,
                          color: Colors.amber[900],
                          size: 50,
                        ),
                      ),
                      SizedBox(height: 25),
                      Text(
                        "Dalam Pengembangan",
                        style: GoogleFonts.outfit(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      SizedBox(height: 15),
                      Text(
                        "Fitur Manajemen Proyek sedang dalam pengembangan",
                        textAlign: TextAlign.center,
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          color: Colors.grey[600],
                          height: 1.5,
                        ),
                      ),
                      SizedBox(height: 30),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => Navigator.pop(context),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.black87,
                            foregroundColor: Colors.white,
                            padding: EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(15),
                            ),
                            elevation: 0,
                          ),
                          child: Text(
                            "Paham, Terimakasih",
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                      SizedBox(height: 10),
                      Text(
                        "© 2026 On Time HRMS",
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.grey[400],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showAturModal() {
    final allItems = _getMenuItems();
    List<String> tempPinned = List.from(_pinnedMenuIds);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(25)),
              ),
              padding: const EdgeInsets.all(25),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Atur Akses Cepat",
                    style: GoogleFonts.outfit(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    "Pilih maksimal 4 menu favorit Anda.",
                    style: TextStyle(color: Colors.grey[600], fontSize: 13),
                  ),
                  const SizedBox(height: 25),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: allItems.keys.map((id) {
                      final isSelected = tempPinned.contains(id);
                      final item = allItems[id]!;
                      return FilterChip(
                        selected: isSelected,
                        label: Text(item['label']),
                        selectedColor: primaryColor.withOpacity(0.2),
                        checkmarkColor: primaryColor,
                        onSelected: (selected) {
                          setModalState(() {
                            if (selected) {
                              if (tempPinned.length < 4) {
                                tempPinned.add(id);
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text("Maksimal 4 menu"),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              }
                            } else {
                              tempPinned.remove(id);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 40),
                  SizedBox(
                    width: double.infinity,
                    height: 55,
                    child: ElevatedButton(
                      onPressed: () async {
                        if (tempPinned.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text("Pilih minimal 1 menu"),
                            ),
                          );
                          return;
                        }
                        setState(() {
                          _pinnedMenuIds = List.from(tempPinned);
                        });
                        final prefs = await SharedPreferences.getInstance();
                        await prefs.setStringList(
                          'pinned_menus',
                          _pinnedMenuIds,
                        );
                        Navigator.pop(context);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryColor,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(15),
                        ),
                      ),
                      child: const Text(
                        "Simpan Perubahan",
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _getBody() {
    final effectiveIndex = _selectedIndex.clamp(0, _isManager ? 5 : 4);
    switch (effectiveIndex) {
      case 0:
        return _buildHomeContent();
      case 1:
        return ArtacomBotScreen(
          userName: _userName,
          attendanceData: _attendanceData,
        );
      case 2:
        return RiwayatScreen();
      case 3:
        return ProfileScreen();
      case 4:
        if (_isManager) return ManagerScreen();
        return SettingsTab(onLogout: _handleLogout);
      case 5:
        return SettingsTab(onLogout: _handleLogout);
      default:
        return _buildHomeContent();
    }
  }

  Widget _buildHomeContent() {
    final allItems = _getMenuItems();
    final activePinnedIds = _pinnedMenuIds
        .where((id) => allItems.containsKey(id))
        .toList();
    if (activePinnedIds.length < 4) {
      for (final id in allItems.keys) {
        if (!activePinnedIds.contains(id)) {
          activePinnedIds.add(id);
          if (activePinnedIds.length == 4) break;
        }
      }
    }
    final pinnedItems = activePinnedIds.map((id) => allItems[id]!).toList();
    final otherItems = allItems.keys
        .where((id) => !activePinnedIds.contains(id))
        .map((id) => allItems[id]!)
        .toList();

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. TOP PROFILE HEADER
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Stack(
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              gradient: LinearGradient(
                                colors: [primaryColor, secondaryColor],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: primaryColor.withValues(alpha: 0.25),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            padding: const EdgeInsets.all(2),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(14),
                              child: (_profilePhotoUrl != null && _profilePhotoUrl!.isNotEmpty)
                                  ? Image.network(
                                      _profilePhotoUrl!,
                                      fit: BoxFit.cover,
                                      errorBuilder: (context, error, stackTrace) => _buildAvatarFallback(),
                                    )
                                  : _buildAvatarFallback(),
                            ),
                          ),
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              width: 14,
                              height: 14,
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981),
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2.5),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _getGreeting(),
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              _userName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.outfit(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF0F172A),
                                letterSpacing: -0.2,
                              ),
                            ),
                            if (_userRole.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 3),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: primaryColor.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: primaryColor.withValues(alpha: 0.15)),
                                  ),
                                  child: Text(
                                    _userRole,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(
                                      fontSize: 10,
                                      color: primaryColor,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: () async {
                    await Navigator.pushNamed(context, '/notifications');
                    _refreshData();
                  },
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        const Icon(
                          Icons.notifications_none_rounded,
                          color: Color(0xFF1E293B),
                          size: 24,
                        ),
                        if (_hasUnreadNotification)
                          Positioned(
                            right: 10,
                            top: 10,
                            child: Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: const Color(0xFFEF4444),
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 1.5),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. HERO ATTENDANCE CARD
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0),
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFF8B0000),
                    Color(0xFF6F0000),
                    Color(0xFF4A0000),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF8B0000).withValues(alpha: 0.35),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: Stack(
                  children: [
                    Positioned(
                      top: -30,
                      right: -30,
                      child: Container(
                        width: 140,
                        height: 140,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.06),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: -40,
                      left: -20,
                      child: Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.04),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(22.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "PRESENSI HARI INI",
                                    style: GoogleFonts.outfit(
                                      color: Colors.white.withValues(alpha: 0.75),
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.2,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _attendanceData?['check_in'] != null
                                        ? (_attendanceData?['check_out'] != null
                                            ? "Selesai Kerja"
                                            : "Sedang Bekerja")
                                        : "Belum Absen",
                                    style: GoogleFonts.outfit(
                                      color: Colors.white,
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: -0.3,
                                    ),
                                  ),
                                ],
                              ),
                              _buildStatusBadge(),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              if (_scheduleLabel != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.schedule_rounded, color: Colors.white, size: 13),
                                      const SizedBox(width: 6),
                                      Text(
                                        "Jadwal: $_scheduleLabel",
                                        style: GoogleFonts.outfit(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              if (_isWfhActive)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF4338CA).withValues(alpha: 0.45),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFF818CF8).withValues(alpha: 0.5)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.roofing_rounded, color: Colors.white, size: 13),
                                      const SizedBox(width: 5),
                                      Text(
                                        "Izin WFA Aktif",
                                        style: GoogleFonts.outfit(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: _buildTimeTrackCard(
                                  label: "Jam Masuk",
                                  time: _formatTime(_attendanceData?['check_in']),
                                  icon: Icons.login_rounded,
                                  isActive: _attendanceData?['check_in'] != null,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _buildTimeTrackCard(
                                  label: "Jam Pulang",
                                  time: _formatTime(_attendanceData?['check_out']),
                                  icon: Icons.logout_rounded,
                                  isActive: _attendanceData?['check_out'] != null,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 3. TASK ALERT (if pending tasks)
          if (_pendingTaskCount > 0) ...[
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.red.withValues(alpha: 0.04),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.assignment_late_rounded, color: Color(0xFFB91C1C), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Tugas Belum Selesai",
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF991B1B),
                            ),
                          ),
                          Text(
                            "Ada $_pendingTaskCount tugas yang perlu segera dikerjakan.",
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              color: const Color(0xFFB91C1C),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => TaskScreen()),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF991B1B),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 0,
                        visualDensity: VisualDensity.compact,
                      ),
                      child: Text(
                        "Buka",
                        style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],

          // 4. AKSES CEPAT (QUICK ACTIONS)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 4,
                      height: 18,
                      decoration: BoxDecoration(
                        color: primaryColor,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      "Akses Cepat",
                      style: GoogleFonts.outfit(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: () => _showAturModal(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: primaryColor.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: primaryColor.withValues(alpha: 0.15)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.tune_rounded, size: 13, color: primaryColor),
                        const SizedBox(width: 4),
                        Text(
                          "Atur",
                          style: GoogleFonts.outfit(
                            color: primaryColor,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0),
            child: GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 5,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 0.76,
              children: [
                ...pinnedItems.map(
                  (item) => _buildQuickAction(
                    item['icon'],
                    item['label'],
                    item['color'],
                    item['onTap'],
                  ),
                ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => setState(() => _isMenuExpanded = !_isMenuExpanded),
                    borderRadius: BorderRadius.circular(18),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: _isMenuExpanded
                                  ? primaryColor
                                  : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: _isMenuExpanded
                                    ? primaryColor
                                    : const Color(0xFFE2E8F0),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 8,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: Icon(
                              _isMenuExpanded ? Icons.close_rounded : Icons.apps_rounded,
                              color: _isMenuExpanded ? Colors.white : const Color(0xFF475569),
                              size: 24,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _isMenuExpanded ? "Tutup" : "Lainnya",
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // EXPANDED MENU DRAWER
          if (_isMenuExpanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 4,
                  mainAxisSpacing: 16,
                  crossAxisSpacing: 10,
                  childAspectRatio: 0.88,
                  children: [
                    ...otherItems.map(
                      (item) => _buildNavIcon(
                        item['icon'] as IconData,
                        item['label'] as String,
                        item['color'] as Color,
                        onTap: item['onTap'] as VoidCallback,
                      ),
                    ),
                    _buildNavIcon(
                      Icons.logout_rounded,
                      "Keluar",
                      const Color(0xFFEF4444),
                      onTap: _handleLogout,
                    ),
                  ],
                ),
              ),
            ),

          // 5. UNIFIED AGENDA & ANNOUNCEMENTS SECTION
          if (_holidays.isNotEmpty || _announcements.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 14),
              child: Row(
                children: [
                  Container(
                    width: 4,
                    height: 18,
                    decoration: BoxDecoration(
                      color: primaryColor,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    "Agenda & Informasi",
                    style: GoogleFonts.outfit(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      "${_holidays.length + _announcements.length}",
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 110,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                scrollDirection: Axis.horizontal,
                itemCount: _holidays.length + _announcements.length,
                itemBuilder: (context, index) {
                  if (index < _holidays.length) {
                    final hol = _holidays[index];
                    return Container(
                      width: 270,
                      margin: const EdgeInsets.only(right: 12),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.amber.withValues(alpha: 0.05),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(
                              Icons.event_available_rounded,
                              color: Color(0xFFD97706),
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFDE68A),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    "LIBUR NASIONAL",
                                    style: GoogleFonts.outfit(
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF92400E),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  hol['name'] ?? "Hari Libur",
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: const Color(0xFF1E293B),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  DateFormat('dd MMMM yyyy').format(DateTime.parse(hol['date'])),
                                  style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    color: const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  } else {
                    final ann = _announcements[index - _holidays.length];
                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _showAnnouncementDetail(ann),
                        borderRadius: BorderRadius.circular(18),
                        child: Container(
                          width: 270,
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.04),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: primaryColor.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Icon(
                                  Icons.campaign_rounded,
                                  color: primaryColor,
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: primaryColor.withValues(alpha: 0.08),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        "PENGUMUMAN",
                                        style: GoogleFonts.outfit(
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                          color: primaryColor,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      ann['title'] ?? "Pengumuman",
                                      style: GoogleFonts.outfit(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF1E293B),
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    Text(
                                      DateFormat('dd MMM yyyy').format(
                                        DateTime.parse(ann['created_at'] ?? DateTime.now().toIso8601String()),
                                      ),
                                      style: GoogleFonts.outfit(
                                        fontSize: 11,
                                        color: const Color(0xFF64748B),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }
                },
              ),
            ),
          ],

          const SizedBox(height: 110),
        ],
      ),
    );
  }

  Widget _buildStatusBadge() {
    final hasCheckIn = _attendanceData?['check_in'] != null;
    final hasCheckOut = _attendanceData?['check_out'] != null;

    if (!hasCheckIn) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.radio_button_unchecked, color: Colors.white70, size: 12),
            const SizedBox(width: 5),
            Text(
              "Standby",
              style: GoogleFonts.outfit(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      );
    }

    if (hasCheckOut) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFF10B981).withValues(alpha: 0.25),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFF34D399)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle_rounded, color: Color(0xFF6EE7B7), size: 13),
            const SizedBox(width: 5),
            Text(
              "Selesai",
              style: GoogleFonts.outfit(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      );
    }

    final String type = (_attendanceData?['attendance_type'] ?? '').toString();
    final bool isWfa = type == 'wfh';
    final bool isDinasLuar = type == 'dinas_luar';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: isWfa
            ? const Color(0xFF6366F1).withValues(alpha: 0.3)
            : (isDinasLuar
                ? const Color(0xFFF59E0B).withValues(alpha: 0.3)
                : const Color(0xFF10B981).withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isWfa
              ? const Color(0xFF818CF8)
              : (isDinasLuar ? const Color(0xFFFBBF24) : const Color(0xFF34D399)),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: isWfa
                  ? const Color(0xFFA5B4FC)
                  : (isDinasLuar ? const Color(0xFFFDE68A) : const Color(0xFF34D399)),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            isWfa ? "WFA Aktif" : (isDinasLuar ? "Dinas Luar" : "Aktif Bekerja"),
            style: GoogleFonts.outfit(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeTrackCard({
    required String label,
    required String time,
    required IconData icon,
    required bool isActive,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: isActive ? 0.16 : 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withValues(alpha: isActive ? 0.25 : 0.12),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                icon,
                size: 14,
                color: isActive ? const Color(0xFFFCD34D) : Colors.white60,
              ),
              const SizedBox(width: 6),
              Text(
                label.toUpperCase(),
                style: GoogleFonts.outfit(
                  color: Colors.white.withValues(alpha: 0.7),
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            time,
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarFallback() {
    return Container(
      color: Colors.white.withValues(alpha: 0.15),
      alignment: Alignment.center,
      child: Text(
        _userName.isNotEmpty ? _userName[0].toUpperCase() : "U",
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 20,
        ),
      ),
    );
  }

  Widget _buildQuickAction(
    IconData icon,
    String label,
    Color color,
    VoidCallback onTap,
  ) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.09),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: color.withValues(alpha: 0.16)),
                  boxShadow: [
                    BoxShadow(
                      color: color.withValues(alpha: 0.08),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    Icon(icon, color: color, size: 24),
                    if (label == 'Tugas' && _pendingTaskCount > 0)
                      Positioned(
                        right: -3,
                        top: -3,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: Color(0xFFEF4444),
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            "$_pendingTaskCount",
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF1E293B),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavIcon(
    IconData icon,
    String label,
    Color color, {
    VoidCallback? onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: color.withValues(alpha: 0.14)),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  Icon(icon, color: color, size: 22),
                  if (label == 'Tugas' && _pendingTaskCount > 0)
                    Positioned(
                      right: -3,
                      top: -3,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Color(0xFFEF4444),
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          "$_pendingTaskCount",
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 8,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF334155),
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
