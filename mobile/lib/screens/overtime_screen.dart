import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../api/api_service.dart';
import '../../widgets/loading_overlay.dart';

class OvertimeScreen extends StatefulWidget {
  const OvertimeScreen({Key? key}) : super(key: key);

  @override
  _OvertimeScreenState createState() => _OvertimeScreenState();
}

class _OvertimeScreenState extends State<OvertimeScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final Color primaryColor = const Color(0xFF800000);
  final Color secondaryColor = const Color(0xFFAD2831);

  List<dynamic> _receivedOvertimes = [];
  List<dynamic> _sentOvertimes = [];
  bool _isLoading = true;
  bool _canAssign = false;
  bool _canReceive = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _initScreen();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _initScreen() async {
    await _checkPermissions();
    await _fetchData();
  }

  Future<void> _checkPermissions() async {
    final profile = await ApiService.getProfile();
    if (mounted && profile != null) {
      final roleName = (profile['role']?['name'] ?? '').toString().toLowerCase();
      final roleSlug = (profile['role']?['slug'] ?? '').toString().toLowerCase();
      final isSuperAdmin = roleName.contains('super admin') || roleSlug == 'super-admin' || profile['role_id'] == 1;

      final Set<String> perms = {};
      if (profile['permission_slugs'] is List) {
        for (var p in profile['permission_slugs']) {
          if (p != null) perms.add(p.toString());
        }
      }
      if (profile['role'] != null && profile['role']['permissions'] is List) {
        for (var p in profile['role']['permissions']) {
          if (p is Map && p['slug'] != null) perms.add(p['slug'].toString());
        }
      }

      setState(() {
        _canAssign = isSuperAdmin ||
            perms.contains('assign-overtimes') ||
            perms.contains('manage-overtimes') ||
            ['super-admin', 'admin', 'hr', 'direktur', 'manager', 'supervisor'].contains(roleSlug);
        _canReceive = true;

        if (_canAssign && !_canReceive) {
          _tabController.index = 1;
        }
      });
    }
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final receivedData = await ApiService.getOvertimes(type: 'received');
      List<dynamic>? sentData;
      if (_canAssign) {
        sentData = await ApiService.getOvertimes(type: 'sent');
      }

      if (mounted) {
        setState(() {
          _receivedOvertimes = receivedData ?? [];
          _sentOvertimes = sentData ?? [];
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return "-";
    try {
      final dt = DateTime.parse(dateStr);
      return DateFormat('d MMM yyyy', 'id_ID').format(dt);
    } catch (_) {
      try {
        final dt = DateTime.parse(dateStr);
        return "${dt.day}/${dt.month}/${dt.year}";
      } catch (_) {
        return dateStr;
      }
    }
  }

  String _calculateDuration(String? start, String? end) {
    if (start == null || end == null) return "-";
    try {
      final sParts = start.split(':');
      final eParts = end.split(':');
      final sMin = int.parse(sParts[0]) * 60 + int.parse(sParts[1]);
      var eMin = int.parse(eParts[0]) * 60 + int.parse(eParts[1]);
      if (eMin < sMin) eMin += 24 * 60;
      final hours = ((eMin - sMin) / 60).toStringAsFixed(1);
      return "$hours Jam";
    } catch (_) {
      return "-";
    }
  }

  Future<void> _handleAccept(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Konfirmasi Terima Lembur", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        content: const Text("Apakah Anda yakin ingin menyetujui perintah lembur ini?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text("Ya, Setujui", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    LoadingDialog.show(context, message: "Menyetujui perintah lembur...");
    try {
      final res = await ApiService.respondOvertime(id, 'accept');
      LoadingDialog.hide(context);
      if (res['status'] == 'success') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Perintah lembur telah disetujui"), backgroundColor: Colors.green),
        );
        _fetchData();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? "Gagal menyetujui"), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      LoadingDialog.hide(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _handleReject(int id) async {
    final reasonController = TextEditingController();
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Tolak Perintah Lembur", style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.red[800])),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Mohon berikan alasan/komentar penolakan agar atasan Anda mengetahuinya:",
              style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[700]),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: "Contoh: Ada acara keluarga mendesak / kondisi tidak fit...",
                hintStyle: GoogleFonts.inter(fontSize: 12, color: Colors.grey[400]),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Colors.red),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          ElevatedButton(
            onPressed: () {
              if (reasonController.text.trim().isEmpty) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text("Alasan penolakan wajib diisi"), backgroundColor: Colors.red),
                );
                return;
              }
              Navigator.pop(ctx, true);
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text("Kirim Penolakan", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    LoadingDialog.show(context, message: "Mengirim penolakan...");
    try {
      final res = await ApiService.respondOvertime(id, 'reject', reason: reasonController.text.trim());
      LoadingDialog.hide(context);
      if (res['status'] == 'success') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Perintah lembur telah ditolak"), backgroundColor: Colors.orange),
        );
        _fetchData();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? "Gagal memproses penolakan"), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      LoadingDialog.hide(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
      );
    }
  }

  void _showDetailBottomSheet(Map<String, dynamic> overtime) {
    final isAssigned = overtime['assigned_by'] != null;
    final status = (overtime['status'] ?? 'pending').toString().toLowerCase();
    Color statusColor = Colors.orange;
    String statusLabel = isAssigned ? "Perlu Konfirmasi" : "Menunggu Approval";
    if (status == 'approved') {
      statusColor = Colors.green;
      statusLabel = "Disetujui";
    } else if (status == 'rejected') {
      statusColor = Colors.red;
      statusLabel = "Ditolak";
    }

    final effectiveDate = overtime['date'] ?? overtime['items']?[0]?['date'];
    final effectiveStart = overtime['start_time'] ?? overtime['items']?[0]?['start_time'];
    final effectiveEnd = overtime['end_time'] ?? overtime['items']?[0]?['end_time'];
    final assignerName = overtime['assigner']?['name'] ?? "Atasan / Supervisor";
    final employeeName = overtime['user']?['name'] ?? "-";

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: primaryColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.description_outlined, color: primaryColor, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      "Surat Perintah Lembur",
                      style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusLabel,
                    style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 16),
            Text(
              overtime['title'] ?? "Perintah Lembur",
              style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Text(
              overtime['reason'] ?? overtime['items']?[0]?['reason'] ?? "-",
              style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[700]),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[200]!),
              ),
              child: Column(
                children: [
                  _buildDetailRow("Pemberi Tugas", assignerName),
                  const SizedBox(height: 8),
                  _buildDetailRow("Penerima Tugas", employeeName),
                  const SizedBox(height: 8),
                  _buildDetailRow("Tanggal Lembur", _formatDate(effectiveDate)),
                  const SizedBox(height: 8),
                  _buildDetailRow("Waktu", "${effectiveStart ?? '-'} - ${effectiveEnd ?? '-'} (${_calculateDuration(effectiveStart, effectiveEnd)})"),
                ],
              ),
            ),
            if (overtime['rejection_reason'] != null && overtime['rejection_reason'].toString().isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.red[200]!),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Alasan Penolakan:", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.red[800])),
                    const SizedBox(height: 4),
                    Text(overtime['rejection_reason'].toString(), style: GoogleFonts.inter(fontSize: 12, color: Colors.red[900])),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      ApiService.launchPdf('overtime', overtime['id']);
                    },
                    icon: Icon(Icons.picture_as_pdf, size: 16, color: primaryColor),
                    label: Text("Cetak PDF", style: GoogleFonts.inter(color: primaryColor, fontWeight: FontWeight.bold)),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: primaryColor),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.grey[200],
                      foregroundColor: Colors.grey[800],
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Text("Tutup", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
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

  Widget _buildDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600])),
        Text(value, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87)),
      ],
    );
  }

  Widget _buildOvertimeCard(Map<String, dynamic> ot, {required bool isSentTab}) {
    final status = (ot['status'] ?? 'pending').toString().toLowerCase();
    final isAssigned = ot['assigned_by'] != null;
    final isPending = status == 'pending';
    final isApproved = status == 'approved';
    final isRejected = status == 'rejected';

    Color statusColor = isAssigned ? Colors.orange : Colors.blue.shade700;
    String statusText = isAssigned ? "Perlu Konfirmasi" : "Menunggu Approval";
    if (isApproved) {
      statusColor = Colors.green;
      statusText = "Disetujui";
    } else if (isRejected) {
      statusColor = Colors.red;
      statusText = "Ditolak";
    }

    final effectiveDate = ot['date'] ?? ot['items']?[0]?['date'];
    final effectiveStart = ot['start_time'] ?? ot['items']?[0]?['start_time'];
    final effectiveEnd = ot['end_time'] ?? ot['items']?[0]?['end_time'];
    final title = ot['title'] ?? "Perintah Lembur";
    final reason = ot['reason'] ?? ot['items']?[0]?['reason'] ?? "-";

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _showDetailBottomSheet(ot),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: Judul & Badge Status
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.black87),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isSentTab
                                ? "Kepada: ${ot['user']?['name'] ?? '-'}"
                                : (isAssigned ? "Oleh: ${ot['assigner']?['name'] ?? 'Atasan'}" : "Pengajuan Mandiri Anda"),
                            style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600]),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        statusText,
                        style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Date & Time info pill
                Row(
                  children: [
                    Icon(Icons.calendar_today_outlined, size: 13, color: Colors.grey[600]),
                    const SizedBox(width: 4),
                    Text(
                      _formatDate(effectiveDate),
                      style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey[800]),
                    ),
                    const SizedBox(width: 12),
                    Icon(Icons.access_time, size: 13, color: Colors.grey[600]),
                    const SizedBox(width: 4),
                    Text(
                      "${effectiveStart?.substring(0, 5) ?? '-'} - ${effectiveEnd?.substring(0, 5) ?? '-'}",
                      style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[700]),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: Colors.grey[100],
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _calculateDuration(effectiveStart, effectiveEnd),
                        style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[700]),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Reason / Task preview
                Text(
                  reason,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                ),

                // Rejection reason note if rejected
                if (isRejected && ot['rejection_reason'] != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade100),
                    ),
                    child: Text(
                      "Alasan Penolakan: ${ot['rejection_reason']}",
                      style: GoogleFonts.inter(fontSize: 11, color: Colors.red.shade800),
                    ),
                  ),
                ],

                // Action buttons for employee on pending received overtime ONLY IF it is an assignment
                if (!isSentTab && isPending && isAssigned) ...[
                  const SizedBox(height: 12),
                  const Divider(height: 1),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _handleReject(ot['id']),
                          icon: const Icon(Icons.close, size: 14, color: Colors.red),
                          label: Text("Tolak", style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.red)),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: Colors.red.shade300),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _handleAccept(ot['id']),
                          icon: const Icon(Icons.check, size: 14, color: Colors.white),
                          label: Text("Terima", style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green.shade600,
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: Text(
          "Perintah Lembur (SPKL)",
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 17),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
        bottom: _canAssign
            ? TabBar(
                controller: _tabController,
                labelColor: primaryColor,
                unselectedLabelColor: Colors.grey,
                indicatorColor: primaryColor,
                indicatorWeight: 3,
                tabs: const [
                  Tab(text: "Lembur Saya"),
                  Tab(text: "Perintah Diberikan"),
                ],
              )
            : null,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF800000)))
          : _canAssign
              ? TabBarView(
                  controller: _tabController,
                  children: [
                    _buildTabContent(_receivedOvertimes, isSentTab: false),
                    _buildTabContent(_sentOvertimes, isSentTab: true),
                  ],
                )
              : _buildTabContent(_receivedOvertimes, isSentTab: false),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddOvertimeOptions(context),
        backgroundColor: primaryColor,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text(_canAssign ? "Tambah Lembur" : "Ajukan Lembur", style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.white)),
      ),
    );
  }

  void _showAddOvertimeOptions(BuildContext context) {
    if (!_canAssign) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => OvertimeSelfApplyScreen(onSubmitted: _fetchData),
        ),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                "Pilih Jenis Pembuatan Lembur",
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(10)),
                  child: Icon(Icons.person_outline, color: Colors.blue.shade700),
                ),
                title: Text("Ajukan Lembur Mandiri", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14)),
                subtitle: Text("Mengajukan jam lembur untuk diri sendiri (masuk workflow approval)", style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade600)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => OvertimeSelfApplyScreen(onSubmitted: _fetchData),
                    ),
                  );
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: primaryColor.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                  child: Icon(Icons.assignment_outlined, color: primaryColor),
                ),
                title: Text("Tugaskan Lembur (SPKL)", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14)),
                subtitle: Text("Menerbitkan perintah lembur kepada karyawan lain atau divisi", style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade600)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => OvertimeAssignScreen(onSubmitted: _fetchData),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabContent(List<dynamic> items, {required bool isSentTab}) {
    if (items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _fetchData,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.25),
            Center(
              child: Column(
                children: [
                  Icon(Icons.schedule_outlined, size: 54, color: Colors.grey[300]),
                  const SizedBox(height: 12),
                  Text(
                    isSentTab ? "Belum ada perintah lembur yang Anda berikan" : "Tidak ada perintah lembur untuk Anda",
                    style: GoogleFonts.inter(color: Colors.grey[600], fontSize: 14),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchData,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final ot = items[index];
          return _buildOvertimeCard(ot, isSentTab: isSentTab);
        },
      ),
    );
  }
}

/// Screen untuk atasan/supervisor menerbitkan SPKL (Perintah Kerja Lembur) ke karyawan
class OvertimeAssignScreen extends StatefulWidget {
  final VoidCallback onSubmitted;
  const OvertimeAssignScreen({Key? key, required this.onSubmitted}) : super(key: key);

  @override
  _OvertimeAssignScreenState createState() => _OvertimeAssignScreenState();
}

class _OvertimeAssignScreenState extends State<OvertimeAssignScreen> {
  final Color primaryColor = const Color(0xFF800000);
  final _titleController = TextEditingController();
  final _reasonController = TextEditingController();

  DateTime _selectedDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 17, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 20, minute: 0);

  String _targetType = "users"; // 'users' or 'division'
  List<dynamic> _employees = [];
  List<dynamic> _roles = [];
  final List<int> _selectedEmployeeIds = [];
  int? _selectedRoleId;
  bool _isLoadingEmployees = true;
  bool _isSubmitting = false;
  String _employeeFilter = "";

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    final empsFuture = ApiService.getEmployees();
    final rolesFuture = ApiService.getRoles();
    final results = await Future.wait([empsFuture, rolesFuture]);
    if (mounted) {
      setState(() {
        _employees = results[0] ?? [];
        _roles = results[1] ?? [];
        _isLoadingEmployees = false;
      });
    }
  }

  Future<void> _submitAssignment() async {
    if (_targetType == 'users' && _selectedEmployeeIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Pilih minimal satu karyawan untuk ditugaskan"), backgroundColor: Colors.red),
      );
      return;
    }
    if (_targetType == 'division' && _selectedRoleId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Pilih divisi / jabatan penerima tugas lembur"), backgroundColor: Colors.red),
      );
      return;
    }
    if (_titleController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Judul perintah lembur wajib diisi"), backgroundColor: Colors.red),
      );
      return;
    }
    if (_reasonController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Deskripsi pekerjaan lembur wajib diisi"), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Menerbitkan perintah lembur...");

    try {
      final startStr = "${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}";
      final endStr = "${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}";
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);

      final payload = <String, dynamic>{
        'title': _titleController.text.trim(),
        'date': dateStr,
        'start_time': startStr,
        'end_time': endStr,
        'reason': _reasonController.text.trim(),
        'is_assignment': true,
      };

      if (_targetType == 'users') {
        payload['user_id'] = _selectedEmployeeIds;
      } else {
        payload['division_id'] = _selectedRoleId;
      }

      final res = await ApiService.submitOvertime(payload);
      LoadingDialog.hide(context);

      if (res['status'] == 'success' || res['data'] != null) {
        Navigator.pop(context);
        widget.onSubmitted();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Perintah lembur berhasil diterbitkan"), backgroundColor: Colors.green),
        );
      } else {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? "Gagal menerbitkan perintah"), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      LoadingDialog.hide(context);
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredEmps = _employees.where((e) {
      final name = (e['name'] ?? '').toString().toLowerCase();
      return name.contains(_employeeFilter.toLowerCase());
    }).toList();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text("Beri Perintah Lembur", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Target Type Selector (Karyawan vs Divisi)
            Text("TARGET PENUGASAN LEMBUR",
                style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700])),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _targetType = 'users'),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: _targetType == 'users' ? primaryColor.withOpacity(0.1) : Colors.grey.shade100,
                        border: Border.all(
                          color: _targetType == 'users' ? primaryColor : Colors.grey.shade300,
                          width: _targetType == 'users' ? 1.5 : 1,
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.person, size: 16, color: _targetType == 'users' ? primaryColor : Colors.grey),
                          const SizedBox(width: 6),
                          Text(
                            "Pilih Karyawan",
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: _targetType == 'users' ? primaryColor : Colors.grey.shade700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _targetType = 'division'),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: _targetType == 'division' ? primaryColor.withOpacity(0.1) : Colors.grey.shade100,
                        border: Border.all(
                          color: _targetType == 'division' ? primaryColor : Colors.grey.shade300,
                          width: _targetType == 'division' ? 1.5 : 1,
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.corporate_fare, size: 16, color: _targetType == 'division' ? primaryColor : Colors.grey),
                          const SizedBox(width: 6),
                          Text(
                            "Pilih Divisi / Jabatan",
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: _targetType == 'division' ? primaryColor : Colors.grey.shade700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            if (_targetType == 'users') ...[
              Text("DAFTAR KARYAWAN (${_selectedEmployeeIds.length} Dipilih)",
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700])),
              const SizedBox(height: 8),

              // Employee Search Field
              TextField(
                decoration: InputDecoration(
                  hintText: "Cari nama karyawan...",
                  prefixIcon: const Icon(Icons.search, size: 18),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onChanged: (val) => setState(() => _employeeFilter = val),
              ),
              const SizedBox(height: 8),

              // Employee select box
              Container(
                height: 140,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[300]!),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: _isLoadingEmployees
                    ? const Center(child: CircularProgressIndicator())
                    : ListView.builder(
                        itemCount: filteredEmps.length,
                        itemBuilder: (ctx, idx) {
                          final emp = filteredEmps[idx];
                          final empId = emp['id'] as int;
                          final isSelected = _selectedEmployeeIds.contains(empId);

                          return CheckboxListTile(
                            dense: true,
                            title: Text(emp['name'] ?? '-', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                            subtitle: Text(emp['role']?['name'] ?? 'Staff', style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
                            value: isSelected,
                            activeColor: primaryColor,
                            onChanged: (val) {
                              setState(() {
                                if (val == true) {
                                  _selectedEmployeeIds.add(empId);
                                } else {
                                  _selectedEmployeeIds.remove(empId);
                                }
                              });
                            },
                          );
                        },
                      ),
              ),
            ] else ...[
              Text("PILIH DIVISI / JABATAN PENERIMA",
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700])),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[300]!),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    isExpanded: true,
                    hint: Text("Pilih divisi / jabatan...", style: GoogleFonts.inter(fontSize: 13, color: Colors.grey)),
                    value: _selectedRoleId,
                    items: _roles.map<DropdownMenuItem<int>>((r) {
                      return DropdownMenuItem<int>(
                        value: r['id'] as int,
                        child: Text(r['name'] ?? 'Divisi', style: GoogleFonts.inter(fontSize: 13)),
                      );
                    }).toList(),
                    onChanged: (val) => setState(() => _selectedRoleId = val),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                "Semua karyawan dalam divisi ini akan menerima perintah lembur secara serentak.",
                style: GoogleFonts.inter(fontSize: 11, color: Colors.grey.shade600, fontStyle: FontStyle.italic),
              ),
            ],
            const SizedBox(height: 16),

            // Judul
            Text("JUDUL TUGAS LEMBUR", style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700])),
            const SizedBox(height: 6),
            TextField(
              controller: _titleController,
              decoration: InputDecoration(
                hintText: "Contoh: Hotfix Server & Payment API",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 16),

            // Tanggal
            Text("TANGGAL LEMBUR", style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700])),
            const SizedBox(height: 6),
            InkWell(
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: _selectedDate,
                  firstDate: DateTime.now().subtract(const Duration(days: 7)),
                  lastDate: DateTime.now().add(const Duration(days: 60)),
                );
                if (d != null) setState(() => _selectedDate = d);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[300]!),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(DateFormat('d MMMM yyyy', 'id_ID').format(_selectedDate), style: GoogleFonts.inter(fontSize: 13)),
                    const Icon(Icons.calendar_today, size: 16, color: Colors.grey),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Jam Mulai & Jam Selesai
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("JAM MULAI", style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700])),
                      const SizedBox(height: 6),
                      InkWell(
                        onTap: () async {
                          final t = await showTimePicker(context: context, initialTime: _startTime);
                          if (t != null) setState(() => _startTime = t);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey[300]!),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text("${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}",
                                  style: GoogleFonts.inter(fontSize: 13)),
                              const Icon(Icons.access_time, size: 16, color: Colors.grey),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("JAM SELESAI", style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700])),
                      const SizedBox(height: 6),
                      InkWell(
                        onTap: () async {
                          final t = await showTimePicker(context: context, initialTime: _endTime);
                          if (t != null) setState(() => _endTime = t);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey[300]!),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text("${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}",
                                  style: GoogleFonts.inter(fontSize: 13)),
                              const Icon(Icons.access_time, size: 16, color: Colors.grey),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Rincian Pekerjaan
            Text("RINCIAN TUGAS LEMBUR", style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700])),
            const SizedBox(height: 6),
            TextField(
              controller: _reasonController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: "Jelaskan instruksi tugas lembur yang harus dikerjakan karyawan...",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 24),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitAssignment,
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(
                  _isSubmitting ? "Menerbitkan..." : "Terbitkan Surat Perintah Lembur",
                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Screen untuk karyawan mengajukan lembur mandiri (masuk ke Approval Workflow Super Admin)
class OvertimeSelfApplyScreen extends StatefulWidget {
  final VoidCallback onSubmitted;
  const OvertimeSelfApplyScreen({Key? key, required this.onSubmitted}) : super(key: key);

  @override
  _OvertimeSelfApplyScreenState createState() => _OvertimeSelfApplyScreenState();
}

class _OvertimeSelfApplyScreenState extends State<OvertimeSelfApplyScreen> {
  final Color primaryColor = const Color(0xFF800000);
  final _titleController = TextEditingController();
  final _reasonController = TextEditingController();

  DateTime _selectedDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 17, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 20, minute: 0);
  bool _isSubmitting = false;

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 60)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _endTime,
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  Future<void> _submitSelfApply() async {
    if (_reasonController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Alasan atau rincian pekerjaan lembur wajib diisi"), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Mengirim permohonan lembur...");

    try {
      final startStr = "${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}";
      final endStr = "${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}";
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);

      final payload = {
        'title': _titleController.text.trim().isEmpty
            ? "Pengajuan Lembur - $dateStr"
            : _titleController.text.trim(),
        'date': dateStr,
        'start_time': startStr,
        'end_time': endStr,
        'reason': _reasonController.text.trim(),
        'is_assignment': false,
      };

      final res = await ApiService.submitOvertime(payload);
      LoadingDialog.hide(context);

      if (res['status'] == 'success' || res['data'] != null) {
        Navigator.pop(context);
        widget.onSubmitted();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Permohonan lembur berhasil diajukan dan sedang menunggu persetujuan"), backgroundColor: Colors.green),
        );
      } else {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? "Gagal mengajukan lembur"), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      LoadingDialog.hide(context);
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text("Pengajuan Lembur Mandiri", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.shade100),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.blue.shade700, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "Permohonan lembur mandiri akan diproses melalui alur persetujuan berjenjang (Approval Workflow) yang telah ditentukan Super Admin.",
                      style: GoogleFonts.inter(fontSize: 12, color: Colors.blue.shade900),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Judul Agenda
            Text("Judul / Agenda Lembur (Opsional)", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            TextField(
              controller: _titleController,
              decoration: InputDecoration(
                hintText: "Contoh: Penyelesaian Laporan Bulanan",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
            const SizedBox(height: 16),

            // Tanggal Lembur
            Text("Tanggal Lembur *", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            InkWell(
              onTap: _pickDate,
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade400),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(DateFormat('dd MMMM yyyy').format(_selectedDate), style: GoogleFonts.inter(fontSize: 14)),
                    const Icon(Icons.calendar_today, size: 18, color: Colors.grey),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Waktu Mulai & Selesai
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Jam Mulai *", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(height: 6),
                      InkWell(
                        onTap: () => _pickTime(true),
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade400),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(_startTime.format(context), style: GoogleFonts.inter(fontSize: 14)),
                              const Icon(Icons.access_time, size: 18, color: Colors.grey),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Jam Selesai *", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(height: 6),
                      InkWell(
                        onTap: () => _pickTime(false),
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade400),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(_endTime.format(context), style: GoogleFonts.inter(fontSize: 14)),
                              const Icon(Icons.access_time, size: 18, color: Colors.grey),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Alasan / Uraian Pekerjaan
            Text("Uraian Pekerjaan / Alasan Lembur *", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            TextField(
              controller: _reasonController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: "Jelaskan rincian tugas lembur yang Anda kerjakan...",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 24),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitSelfApply,
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(
                  _isSubmitting ? "Mengirimkan..." : "Kirim Permohonan Lembur",
                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
