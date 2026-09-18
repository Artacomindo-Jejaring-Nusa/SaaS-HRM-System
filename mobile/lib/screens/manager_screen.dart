import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../api/api_service.dart';
import '../widgets/skeleton_loading.dart';

class ManagerScreen extends StatefulWidget {
  @override
  _ManagerScreenState createState() => _ManagerScreenState();
}

class _ManagerScreenState extends State<ManagerScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<String, dynamic>? _pendingCounts;
  List<dynamic> _teamAttendance = [];
  List<dynamic> _filteredTeam = [];
  bool _isLoading = true;
  String _searchQuery = "";
  final TextEditingController _searchController = TextEditingController();

  final Color primaryColor = const Color(0xFF800000);
  final Color primaryDark = const Color(0xFF5A0000);
  final Color accentColor = const Color(0xFFB00000);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final counts = await ApiService.getManagerPendingCount();
    final team = await ApiService.getTeamAttendance();
    if (mounted) {
      setState(() {
        _pendingCounts = counts;
        _teamAttendance = team ?? [];
        _filteredTeam = _teamAttendance;
        _isLoading = false;
      });
    }
  }

  void _filterTeam(String query) {
    setState(() {
      _searchQuery = query.toLowerCase();
      if (_searchQuery.isEmpty) {
        _filteredTeam = _teamAttendance;
      } else {
        _filteredTeam = _teamAttendance.where((member) {
          final name = (member['name'] ?? '').toString().toLowerCase();
          final role = (member['role'] ?? '').toString().toLowerCase();
          return name.contains(_searchQuery) || role.contains(_searchQuery);
        }).toList();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: Text(
          "Portal Manager",
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 20, color: Colors.white),
        ),
        backgroundColor: primaryColor,
        elevation: 0,
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white),
            tooltip: "Muat Ulang",
            onPressed: _loadData,
          ),
        ],
      ),
      body: _isLoading
          ? const CardAndListSkeleton()
          : RefreshIndicator(
              onRefresh: _loadData,
              color: primaryColor,
              child: Column(
                children: [
                  _buildSummaryHeader(),
                  _buildTabBar(),
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _buildApprovalTab(),
                        _buildTeamTab(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildSummaryHeader() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [primaryColor, primaryDark],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.2), width: 1),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildSummaryCard("Cuti", _pendingCounts?['leave'] ?? 0, Icons.calendar_month_rounded, "leave"),
            _buildSummaryCard("Izin", _pendingCounts?['permit'] ?? 0, Icons.assignment_turned_in_rounded, "permit"),
            _buildSummaryCard("Lembur", _pendingCounts?['overtime'] ?? 0, Icons.more_time_rounded, "overtime"),
            _buildSummaryCard("Klaim", _pendingCounts?['reimbursement'] ?? 0, Icons.payments_rounded, "reimbursement"),
            _buildSummaryCard("Fleet", _pendingCounts?['vehicle_log'] ?? 0, Icons.directions_car_rounded, "vehicle_log"),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCard(String label, int count, IconData icon, String type) {
    return InkWell(
      onTap: () {
        String title = label == "Cuti"
            ? "Pengajuan Cuti"
            : label == "Izin"
                ? "Pengajuan Izin"
                : label == "Lembur"
                    ? "Pengajuan Lembur"
                    : label == "Klaim"
                        ? "Pengajuan Klaim"
                        : "Log Kendaraan";
        _showApprovalList(title, type);
      },
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: count > 0 ? Colors.amber.withOpacity(0.25) : Colors.white.withOpacity(0.18),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: count > 0 ? Colors.amberAccent : Colors.white, size: 20),
            ),
            const SizedBox(height: 6),
            Text(
              "$count",
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withOpacity(0.85),
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      color: primaryDark,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.15),
          borderRadius: BorderRadius.circular(14),
        ),
        child: TabBar(
          controller: _tabController,
          indicator: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 4,
                offset: const Offset(0, 2),
              )
            ],
          ),
          indicatorSize: TabBarIndicatorSize.tab,
          labelColor: primaryColor,
          unselectedLabelColor: Colors.white.withOpacity(0.85),
          labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14),
          unselectedLabelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 14),
          tabs: [
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_circle_outline_rounded, size: 18),
                  const SizedBox(width: 8),
                  const Text("Persetujuan"),
                  if ((_pendingCounts?['total'] ?? 0) > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                      child: Text(
                        "${_pendingCounts!['total']}",
                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.people_outline_rounded, size: 18),
                  const SizedBox(width: 8),
                  const Text("Tim Saya"),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildApprovalTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 30),
      children: [
        _buildApprovalSection(
          title: "Pengajuan Cuti",
          type: "leave",
          icon: Icons.calendar_today_rounded,
          color: const Color(0xFFF59E0B),
          desc: "Persetujuan izin cuti tahunan, sakit, dan khusus",
        ),
        _buildApprovalSection(
          title: "Pengajuan Izin",
          type: "permit",
          icon: Icons.assignment_turned_in_rounded,
          color: const Color(0xFF8B5CF6),
          desc: "Persetujuan izin terlambat, pulang cepat, sakit, dll.",
        ),
        _buildApprovalSection(
          title: "Pengajuan Lembur",
          type: "overtime",
          icon: Icons.access_time_filled_rounded,
          color: const Color(0xFFEF4444),
          desc: "Validasi jam kerja lembur dan instruksi tugas",
        ),
        _buildApprovalSection(
          title: "Pengajuan Klaim",
          type: "reimbursement",
          icon: Icons.monetization_on_rounded,
          color: const Color(0xFF10B981),
          desc: "Verifikasi nota pengeluaran operasional / medis",
        ),
        _buildApprovalSection(
          title: "Log Kendaraan",
          type: "vehicle_log",
          icon: Icons.directions_car_filled_rounded,
          color: const Color(0xFF6366F1),
          desc: "Validasi penggunaan fleet dan jarak tempuh",
        ),
      ],
    );
  }

  Widget _buildApprovalSection({
    required String title,
    required String type,
    required IconData icon,
    required Color color,
    required String desc,
  }) {
    int count = _pendingCounts?[type] ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          )
        ],
        border: Border.all(color: Colors.grey.withOpacity(0.12)),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _showApprovalList(title, type),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: color, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.black87),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        desc,
                        style: TextStyle(color: Colors.grey[500], fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: count > 0 ? color.withOpacity(0.15) : Colors.grey.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              "$count pengajuan menunggu",
                              style: TextStyle(
                                color: count > 0 ? color : Colors.grey[600],
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Colors.grey),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showApprovalList(String title, String type) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    final List<dynamic>? items = await ApiService.getManagerPendingRequests(type);
    if (mounted) Navigator.pop(context); // Close loading dialog

    if (items == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Gagal mengambil data pengajuan."), backgroundColor: Colors.red),
        );
      }
      return;
    }

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Container(
            height: MediaQuery.of(context).size.height * 0.85,
            decoration: const BoxDecoration(
              color: Color(0xFFF9FAFB),
              borderRadius: BorderRadius.vertical(top: Radius.circular(25)),
            ),
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  height: 5,
                  width: 45,
                  decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(10)),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold)),
                            Text("${items.length} pengajuan perlu ditinjau", style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: items.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.task_alt_rounded, size: 64, color: Colors.green[300]),
                              const SizedBox(height: 12),
                              Text("Semua Beres!", style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              Text("Tidak ada pengajuan $title yang pending.", style: TextStyle(color: Colors.grey[500], fontSize: 13)),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: items.length,
                          itemBuilder: (context, index) => _buildApprovalListItem(items[index], type, () {
                            setSheetState(() {
                              items.removeAt(index);
                            });
                          }),
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildApprovalListItem(dynamic item, String type, VoidCallback onItemProcessed) {
    String name = item['user']?['name'] ?? "Pegawai";
    String role = item['user']?['role']?['name'] ?? "Staff";
    String date = "";
    String info = "";
    String subtitle = "";

    if (type == 'reimbursement') {
      return _buildReimbursementApprovalCard(item, onItemProcessed);
    }

    if (type == 'leave') {
      date = "${item['start_date']} s/d ${item['end_date']}";
      info = "Jenis: ${item['type'] ?? 'Cuti'}\nAlasan: ${item['reason'] ?? '-'}";
      subtitle = "${item['total_days'] ?? 1} Hari";
    } else if (type == 'permit') {
      final startDate = item['start_date'] ?? '-';
      final endDate = item['end_date'];
      date = (endDate != null && endDate != startDate) ? "$startDate s/d $endDate" : startDate;
      final cat = item['category'] ?? 'I';
      String catLabel = cat == 'I'
          ? 'Izin'
          : cat == 'S'
              ? 'Sakit'
              : cat == 'A'
                  ? 'Alpha'
                  : 'Lainnya';
      String typeName = item['type'] ?? catLabel;
      String potongGaji = (item['is_deducted'] == true || item['is_deducted'] == 1) ? ' • Potong Gaji' : ' • Tidak Potong';
      String suratDokter = (item['has_doctor_note'] == true || item['has_doctor_note'] == 1) ? ' • Ada Surat Dokter' : '';
      info = "Kategori: [$cat] $catLabel ($typeName$potongGaji$suratDokter)\nAlasan: ${item['reason'] ?? '-'}";
      subtitle = catLabel;
    } else if (type == 'overtime') {
      date = "${item['date']}";
      info = "Pukul: ${item['start_time']} - ${item['end_time']}\nTugas: ${item['notes'] ?? item['reason'] ?? '-'}";
      subtitle = "Lembur";
    } else if (type == 'vehicle_log') {
      date = "${item['vehicle']?['name'] ?? item['vehicle_name'] ?? 'Kendaraan'} (${item['vehicle']?['license_plate'] ?? item['plate_number'] ?? '-'})";
      info = "Tujuan: ${item['destination'] ?? '-'}\nJarak: ${item['distance'] ?? item['end_mileage'] ?? '-'} KM";
      subtitle = "Fleet Log";
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
        border: Border.all(color: Colors.grey.withOpacity(0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: primaryColor.withOpacity(0.1),
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : "U",
                  style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15)),
                    Text(role, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: (type == 'permit' ? Colors.purple : Colors.blue).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  subtitle,
                  style: TextStyle(
                    color: type == 'permit' ? Colors.purple[700] : Colors.blue,
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
          const Divider(height: 20),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF9FAFB),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.withOpacity(0.1)),
            ),
            child: Row(
              children: [
                const Icon(Icons.event_note_rounded, size: 18, color: Colors.grey),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(date, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            info,
            style: const TextStyle(fontSize: 13, height: 1.4, color: Colors.black87),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _promptRemarkAndAction(type, item['id'], 'rejected', onItemProcessed),
                  icon: const Icon(Icons.close_rounded, size: 16),
                  label: const Text("Tolak"),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _handleApproval(type, item['id'], 'approved', null, onItemProcessed),
                  icon: const Icon(Icons.check_rounded, size: 16),
                  label: const Text("Setujui"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green[700],
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildReimbursementApprovalCard(dynamic item, VoidCallback onItemProcessed) {
    String name = item['employee_name'] ?? item['user']?['name'] ?? "Pegawai";
    String role = item['user']?['role']?['name'] ?? "Staff";
    String divisi = item['divisi'] ?? (item['user']?['role']?['name'] ?? "Operasional");
    String tujuan = item['tujuan'] ?? "-";
    String title = item['title'] ?? "Klaim Biaya";
    String desc = item['description'] ?? "-";
    String priority = item['priority'] ?? "Normal";
    double amount = double.tryParse(item['amount'].toString()) ?? 0;
    String dateStr = item['created_at'] != null 
        ? DateFormat('dd MMM yyyy, HH:mm').format(DateTime.parse(item['created_at']))
        : '-';

    // Extract items
    List<dynamic> itemsList = [];
    if (item['items'] != null) {
      if (item['items'] is List) {
        itemsList = item['items'];
      } else if (item['items'] is String) {
        try {
          final decoded = jsonDecode(item['items']);
          if (decoded is List) itemsList = decoded;
        } catch (_) {}
      }
    }

    // Extract attachments
    List<String> attachments = [];
    if (item['attachment'] != null) {
      if (item['attachment'] is List) {
        attachments = (item['attachment'] as List).map((e) => e.toString()).toList();
      } else if (item['attachment'] is String) {
        final str = item['attachment'].toString();
        if (str.trim().startsWith('[') && str.trim().endsWith(']')) {
          try {
            final decoded = jsonDecode(str);
            if (decoded is List) attachments = decoded.map((e) => e.toString()).toList();
          } catch (_) {}
        } else if (str.isNotEmpty) {
          attachments = [str];
        }
      }
    }

    Color priorityColor = Colors.blue;
    if (priority.toLowerCase().contains('urgent')) {
      priorityColor = priority.toLowerCase().contains('top') ? Colors.red : Colors.orange;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
        border: Border.all(color: Colors.grey.withOpacity(0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Requester & Badges
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: const Color(0xFF10B981).withOpacity(0.12),
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : "K",
                  style: GoogleFonts.outfit(color: const Color(0xFF059669), fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15)),
                    Text("$role • $divisi", style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                    Text(dateStr, style: TextStyle(color: Colors.grey[400], fontSize: 11)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      "Klaim Biaya",
                      style: TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.bold, fontSize: 11),
                    ),
                  ),
                  if (priority != 'Normal') ...[
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: priorityColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        priority,
                        style: TextStyle(color: priorityColor, fontWeight: FontWeight.bold, fontSize: 10),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),

          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 12),

          // Judul & Keperluan
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF9FAFB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.withOpacity(0.12)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.receipt_long_rounded, size: 16, color: Color(0xFF059669)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        title,
                        style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
                      ),
                    ),
                  ],
                ),
                if (tujuan != '-' && tujuan.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text("Tujuan / Keperluan: $tujuan", style: TextStyle(fontSize: 12, color: Colors.grey[700])),
                ],
                if (desc != '-' && desc.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text("Keterangan: $desc", style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                ],
              ],
            ),
          ),

          // Total Nominal Highlight Box
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFECFDF5), Color(0xFFD1FAE5)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFA7F3D0)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("TOTAL PENGAJUAN", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF065F46), letterSpacing: 0.5)),
                    const SizedBox(height: 2),
                    Text(
                      "Rp " + NumberFormat("#,###", "id_ID").format(amount),
                      style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w900, color: const Color(0xFF047857)),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4),
                    ],
                  ),
                  child: const Icon(Icons.monetization_on_rounded, color: Color(0xFF059669), size: 24),
                ),
              ],
            ),
          ),

          // Items Breakdown Table
          if (itemsList.isNotEmpty) ...[
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "Rincian Item Pengeluaran (${itemsList.length}):",
                  style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey[800]),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.withOpacity(0.2)),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: itemsList.length,
                separatorBuilder: (ctx, i) => Divider(height: 1, color: Colors.grey.withOpacity(0.15)),
                itemBuilder: (ctx, idx) {
                  final itm = itemsList[idx];
                  final spesifikasi = itm['spesifikasi'] ?? itm['name'] ?? '-';
                  final qty = itm['qty'] ?? 1;
                  final unit = itm['unit'] ?? 'Pcs';
                  final harga = double.tryParse((itm['estimasi_harga'] ?? itm['harga'] ?? 0).toString()) ?? 0;
                  final subtotal = double.tryParse((itm['subtotal'] ?? (qty * harga)).toString()) ?? (qty * harga);
                  final ket = itm['keterangan'] ?? itm['notes'] ?? '';

                  return Padding(
                    padding: const EdgeInsets.all(10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 20,
                          height: 20,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Colors.grey[100],
                            shape: BoxShape.circle,
                          ),
                          child: Text("${idx + 1}", style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(spesifikasi.toString(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              const SizedBox(height: 2),
                              Text(
                                "$qty $unit @ Rp ${NumberFormat('#,###', 'id_ID').format(harga)}",
                                style: TextStyle(color: Colors.grey[600], fontSize: 11),
                              ),
                              if (ket.toString().isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text("Ket: $ket", style: TextStyle(color: Colors.grey[500], fontSize: 10, fontStyle: FontStyle.italic)),
                              ],
                            ],
                          ),
                        ),
                        Text(
                          "Rp ${NumberFormat('#,###', 'id_ID').format(subtotal)}",
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF065F46)),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],

          // Attachments Section
          if (attachments.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              "Bukti Nota / Kuitansi (${attachments.length} foto):",
              style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey[800]),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 80,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: attachments.length,
                itemBuilder: (ctx, aIdx) {
                  final rawPath = attachments[aIdx];
                  final fullUrl = rawPath.startsWith('http') 
                      ? ApiClient.fixUrl(rawPath) 
                      : ApiClient.fixUrl("${ApiClient.storageUrl}/$rawPath");

                  return GestureDetector(
                    onTap: () => _showImagePreviewDialog(fullUrl),
                    child: Container(
                      width: 80,
                      margin: const EdgeInsets.only(right: 10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.grey.withOpacity(0.25)),
                        image: DecorationImage(
                          image: NetworkImage(fullUrl),
                          fit: BoxFit.cover,
                        ),
                      ),
                      child: Container(
                        alignment: Alignment.bottomRight,
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          gradient: LinearGradient(
                            colors: [Colors.transparent, Colors.black.withOpacity(0.6)],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                        child: const Icon(Icons.zoom_in, color: Colors.white, size: 16),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],

          // Signature
          if (item['signature'] != null && item['signature'].toString().isNotEmpty) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                const Icon(Icons.draw_rounded, size: 16, color: Colors.grey),
                const SizedBox(width: 6),
                Text("Tanda Tangan Pemohon:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey[700])),
              ],
            ),
            const SizedBox(height: 6),
            Container(
              height: 50,
              width: 140,
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.withOpacity(0.2)),
              ),
              child: Image.memory(
                base64Decode(item['signature'].toString().split(',').last),
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          ],

          // Actions
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _promptRemarkAndAction('reimbursement', item['id'], 'rejected', onItemProcessed),
                  icon: const Icon(Icons.close_rounded, size: 16),
                  label: const Text("Tolak"),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _handleApproval('reimbursement', item['id'], 'approved', null, onItemProcessed),
                  icon: const Icon(Icons.check_rounded, size: 16),
                  label: const Text("Setujui"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green[700],
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showImagePreviewDialog(String imageUrl) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxHeight: 600),
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(16),
              ),
              clipBehavior: Clip.antiAlias,
              child: InteractiveViewer(
                minScale: 0.8,
                maxScale: 4.0,
                child: Image.network(
                  imageUrl,
                  fit: BoxFit.contain,
                  errorBuilder: (ctx, err, stack) => const Center(
                    child: Text("Gagal memuat gambar", style: TextStyle(color: Colors.white)),
                  ),
                ),
              ),
            ),
            IconButton(
              onPressed: () => Navigator.of(ctx).pop(),
              icon: const CircleAvatar(
                backgroundColor: Colors.black54,
                child: Icon(Icons.close, color: Colors.white, size: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _promptRemarkAndAction(String type, int id, String status, VoidCallback onItemProcessed) {
    final remarkController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: Text(
          status == 'approved' ? "Setujui Pengajuan" : "Tolak Pengajuan",
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              status == 'approved'
                  ? "Tambahkan catatan persetujuan (opsional):"
                  : "Masukkan alasan penolakan:",
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: remarkController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: "Tulis catatan...",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Batal")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: status == 'approved' ? Colors.green : Colors.red,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              _handleApproval(type, id, status, remarkController.text.trim(), onItemProcessed);
            },
            child: Text(status == 'approved' ? "Ya, Setujui" : "Ya, Tolak"),
          ),
        ],
      ),
    );
  }

  void _handleApproval(
    String type,
    int id,
    String status,
    String? remark,
    VoidCallback onItemProcessed,
  ) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    final res = await ApiService.updateManagerRequestStatus(type, id, status, remark: remark);
    if (mounted) Navigator.pop(context); // Close loading

    if (res['status'] == 'success') {
      onItemProcessed();
      _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? "Pengajuan berhasil diproses."),
            backgroundColor: status == 'approved' ? Colors.green : Colors.red,
          ),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? "Gagal memproses pengajuan."),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Widget _buildTeamTab() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          color: Colors.white,
          child: TextField(
            controller: _searchController,
            onChanged: _filterTeam,
            decoration: InputDecoration(
              hintText: "Cari anggota tim...",
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, size: 18),
                      onPressed: () {
                        _searchController.clear();
                        _filterTeam('');
                      },
                    )
                  : null,
              filled: true,
              fillColor: const Color(0xFFF3F4F6),
              contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        Expanded(
          child: _filteredTeam.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.people_outline_rounded, size: 60, color: Colors.grey[400]),
                      const SizedBox(height: 12),
                      Text(
                        _searchQuery.isEmpty ? "Belum ada anggota tim terdaftar" : "Anggota tidak ditemukan",
                        style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.grey[600]),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _filteredTeam.length,
                  itemBuilder: (context, index) {
                    final sub = _filteredTeam[index];
                    Color statusColor = Colors.grey;
                    if (sub['status'] == 'Hadir') statusColor = Colors.green;
                    if (sub['status'] == 'Selesai') statusColor = Colors.blue;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.03),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                        border: Border.all(color: Colors.grey.withOpacity(0.1)),
                      ),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        leading: CircleAvatar(
                          radius: 22,
                          backgroundColor: primaryColor.withOpacity(0.1),
                          backgroundImage: (sub['photo_url'] != null && sub['photo_url'].toString().isNotEmpty)
                              ? NetworkImage(sub['photo_url'])
                              : null,
                          child: (sub['photo_url'] == null || sub['photo_url'].toString().isEmpty)
                              ? Text(
                                  (sub['name'] != null && sub['name'].toString().isNotEmpty)
                                      ? sub['name'][0].toUpperCase()
                                      : "P",
                                  style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold),
                                )
                              : null,
                        ),
                        title: Text(
                          sub['name'] ?? "Pegawai",
                          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(sub['role'] ?? "Staff", style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(Icons.login_rounded, size: 14, color: Colors.green),
                                const SizedBox(width: 4),
                                Text(sub['check_in'] ?? "--:--", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                const SizedBox(width: 16),
                                const Icon(Icons.logout_rounded, size: 14, color: Colors.red),
                                const SizedBox(width: 4),
                                Text(sub['check_out'] ?? "--:--", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ],
                        ),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            sub['status'] ?? "Belum Masuk",
                            style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 11),
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
