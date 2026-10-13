import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:signature/signature.dart';
import 'dart:convert';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';
import '../../widgets/loading_overlay.dart';
import '../widgets/animated_helpers.dart';

class LeaveScreen extends StatefulWidget {
  @override
  _LeaveScreenState createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  final Color primaryColor = const Color(0xFF800000);
  List<dynamic> _leaves = [];
  bool _isLoading = true;
  int _leaveBalance = 0;
  Map<String, dynamic>? _userProfile;

  @override
  void initState() {
    super.initState();
    _fetchLeaves();
  }

  Future<void> _fetchLeaves() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getLeaves();
    final profile = await ApiService.getProfile();
    if (mounted) {
      setState(() {
        _leaves = data ?? [];
        _userProfile = profile;
        _leaveBalance = profile?['leave_balance'] ?? 0;
        _isLoading = false;
      });
    }
  }

  Future<void> _deleteLeave(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Batalkan Pengajuan Cuti?", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        content: Text(
          "Apakah Anda yakin ingin membatalkan atau menghapus pengajuan cuti ini?",
          style: GoogleFonts.inter(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text("Batal", style: GoogleFonts.inter(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: Text("Ya, Batalkan", style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    LoadingDialog.show(context, message: "Membatalkan pengajuan...");
    try {
      final res = await ApiService.deleteLeave(id);
      LoadingDialog.hide(context);
      if (res['status'] == 'success') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Pengajuan cuti berhasil dibatalkan"), backgroundColor: Colors.green),
        );
        _fetchLeaves();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? "Gagal membatalkan pengajuan"), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      LoadingDialog.hide(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final hPad = ResponsiveHelper.padding(context, 16);
    return Scaffold(
      appBar: AppBar(
        title: Text("Cuti Karyawan", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: ResponsiveHelper.fontSize(context, 16))),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
      ),
      backgroundColor: const Color(0xFFF9FAFB),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF800000)))
          : Padding(
              padding: EdgeInsets.symmetric(horizontal: hPad, vertical: 16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Leave Balance Card (Animated)
                  FadeSlideIn(
                    delay: Duration.zero,
                    child: Container(
                      width: double.infinity,
                      padding: EdgeInsets.all(ResponsiveHelper.padding(context, 16)),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [primaryColor, const Color(0xFF5A0000)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(color: primaryColor.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4)),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text("Sisa Cuti Tahunan Anda", style: GoogleFonts.inter(color: Colors.white70, fontSize: ResponsiveHelper.fontSize(context, 12))),
                              const SizedBox(height: 4),
                              Text("$_leaveBalance Hari", style: GoogleFonts.inter(color: Colors.white, fontSize: ResponsiveHelper.fontSize(context, 24), fontWeight: FontWeight.bold)),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.15),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.beach_access_rounded, color: Colors.white, size: 28),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 100),
                    child: Text("Riwayat Pengajuan Cuti", style: GoogleFonts.inter(fontSize: ResponsiveHelper.fontSize(context, 15), fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 10),
                  Expanded(
                    child: _leaves.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.event_busy_rounded, size: 64, color: Colors.grey[300]),
                                const SizedBox(height: 12),
                                Text(
                                  "Belum ada riwayat pengajuan cuti",
                                  style: GoogleFonts.inter(color: Colors.grey, fontSize: 14),
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            physics: const BouncingScrollPhysics(),
                            itemCount: _leaves.length,
                            separatorBuilder: (c, i) => const SizedBox(height: 10),
                            itemBuilder: (ctx, index) {
                              final leave = _leaves[index];
                              final String rawStatus = leave['status'] ?? 'pending';
                              final remark = leave['remark']?.toString() ?? '';
                              final supervisorRemark = leave['supervisor_remark']?.toString() ?? '';
                              final isSuperAdmin = remark.contains('[Disetujui Super Admin') || supervisorRemark.contains('[Disetujui Super Admin');
                              
                              Color statusColor;
                              String statusText;
                              IconData statusIcon;
                              if (rawStatus == 'approved') {
                                statusColor = Colors.green;
                                statusText = "Approved";
                                statusIcon = Icons.check_circle_rounded;
                              } else if (rawStatus == 'rejected') {
                                statusColor = Colors.red;
                                statusText = "Rejected";
                                statusIcon = Icons.cancel_rounded;
                              } else if (rawStatus == 'pending_hr') {
                                statusColor = Colors.blue;
                                statusText = "Menunggu HRD";
                                statusIcon = Icons.hourglass_top_rounded;
                              } else {
                                statusColor = Colors.orange;
                                statusText = "Pending Atasan";
                                statusIcon = Icons.access_time_rounded;
                              }

                              return AnimatedListItem(
                                index: index,
                                child: ScaleOnTap(
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (context) => LeaveFormScreen(
                                          userProfile: _userProfile,
                                          leaveBalance: _leaveBalance,
                                          existingLeave: leave,
                                          isReadOnly: rawStatus == 'approved' || rawStatus == 'rejected',
                                          onSubmitted: _fetchLeaves,
                                        ),
                                      ),
                                    );
                                  },
                                  child: Container(
                                    padding: EdgeInsets.all(ResponsiveHelper.padding(context, 14)),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(color: Colors.grey[200]!, width: 1.2),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.02),
                                          blurRadius: 6,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Expanded(
                                              child: Row(
                                                children: [
                                                  Container(
                                                    padding: const EdgeInsets.all(6),
                                                    decoration: BoxDecoration(
                                                      color: primaryColor.withOpacity(0.08),
                                                      borderRadius: BorderRadius.circular(8),
                                                    ),
                                                    child: Icon(Icons.date_range_rounded, size: 16, color: primaryColor),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Expanded(
                                                    child: Text(
                                                      leave['type'] ?? 'Cuti',
                                                      style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: ResponsiveHelper.fontSize(context, 13.5)),
                                                      overflow: TextOverflow.ellipsis,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                              decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(statusIcon, size: 11, color: statusColor),
                                                  const SizedBox(width: 4),
                                                  Text(statusText, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold)),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            Icon(Icons.calendar_today_outlined, size: 12, color: Colors.grey[500]),
                                            const SizedBox(width: 4),
                                            Text(
                                              "${leave['start_date']} s/d ${leave['end_date']}",
                                              style: GoogleFonts.inter(color: Colors.grey[700], fontSize: 11.5, fontWeight: FontWeight.w500),
                                            ),
                                          ],
                                        ),
                                        if (leave['reason'] != null && leave['reason'].toString().isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          Text(
                                            "Ket: ${leave['reason']}",
                                            style: GoogleFonts.inter(color: Colors.grey[600], fontSize: 11),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                        if (isSuperAdmin) ...[
                                          const SizedBox(height: 6),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: Colors.amber[50],
                                              borderRadius: BorderRadius.circular(6),
                                              border: Border.all(color: Colors.amber[300]!, width: 0.8),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(Icons.shield_rounded, size: 12, color: Colors.amber[800]),
                                                const SizedBox(width: 4),
                                                Text(
                                                  "Disetujui via Super Admin",
                                                  style: GoogleFonts.inter(fontSize: 9.5, color: Colors.amber[900], fontWeight: FontWeight.bold),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                        const Divider(height: 16, thickness: 0.7),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              "Ketuk untuk lihat dokumen",
                                              style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[500], fontStyle: FontStyle.italic),
                                            ),
                                            Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                if (rawStatus == 'pending' || rawStatus == 'pending_supervisor' || rawStatus == 'pending_hr') ...[
                                                  IconButton(
                                                    constraints: const BoxConstraints(),
                                                    padding: const EdgeInsets.only(right: 8),
                                                    icon: Icon(Icons.edit_outlined, color: primaryColor, size: 18),
                                                    tooltip: 'Edit Pengajuan',
                                                    onPressed: () {
                                                      Navigator.push(
                                                        context,
                                                        MaterialPageRoute(
                                                          builder: (context) => LeaveFormScreen(
                                                            userProfile: _userProfile,
                                                            leaveBalance: _leaveBalance,
                                                            existingLeave: leave,
                                                            onSubmitted: _fetchLeaves,
                                                          ),
                                                        ),
                                                      );
                                                    },
                                                  ),
                                                  IconButton(
                                                    constraints: const BoxConstraints(),
                                                    padding: const EdgeInsets.only(right: 8),
                                                    icon: const Icon(Icons.delete_outline, color: Colors.red, size: 18),
                                                    tooltip: 'Batalkan Pengajuan',
                                                    onPressed: () => _deleteLeave(leave['id']),
                                                  ),
                                                ],
                                                if (rawStatus != 'rejected') ...[
                                                  IconButton(
                                                    constraints: const BoxConstraints(),
                                                    padding: const EdgeInsets.only(right: 6),
                                                    icon: Icon(Icons.picture_as_pdf, color: primaryColor, size: 18),
                                                    tooltip: 'Unduh PDF',
                                                    onPressed: () => ApiService.launchPdf('leave', leave['id']),
                                                  ),
                                                  IconButton(
                                                    constraints: const BoxConstraints(),
                                                    padding: EdgeInsets.zero,
                                                    icon: const Icon(Icons.table_view, color: Colors.green, size: 18),
                                                    tooltip: 'Unduh Excel',
                                                    onPressed: () => ApiService.launchExcel('leave', leave['id']),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
      floatingActionButton: ScaleOnTap(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => LeaveFormScreen(
                userProfile: _userProfile,
                leaveBalance: _leaveBalance,
                onSubmitted: _fetchLeaves,
              ),
            ),
          );
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: primaryColor,
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(color: primaryColor.withOpacity(0.4), blurRadius: 10, offset: const Offset(0, 4)),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.add_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 6),
              Text("AJUKAN CUTI", style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}


class DottedLine extends StatelessWidget {
  final Color color;
  const DottedLine({this.color = const Color(0xFFBDBDBD), Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(double.infinity, 1),
      painter: _DottedLinePainter(color: color),
    );
  }
}

class _DottedLinePainter extends CustomPainter {
  final Color color;
  _DottedLinePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;
    
    double max = size.width;
    double dashWidth = 3;
    double dashSpace = 3;
    double startX = 0;
    while (startX < max) {
      canvas.drawLine(Offset(startX, 0), Offset(startX + dashWidth, 0), paint);
      startX += dashWidth + dashSpace;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class LeaveFormScreen extends StatefulWidget {
  final Map<String, dynamic>? userProfile;
  final int leaveBalance;
  final VoidCallback onSubmitted;
  final Map<String, dynamic>? existingLeave;
  final bool isReadOnly;

  const LeaveFormScreen({
    Key? key,
    required this.userProfile,
    required this.leaveBalance,
    required this.onSubmitted,
    this.existingLeave,
    this.isReadOnly = false,
  }) : super(key: key);

  @override
  _LeaveFormScreenState createState() => _LeaveFormScreenState();
}

class _LeaveFormScreenState extends State<LeaveFormScreen> {
  final Color primaryColor = const Color(0xFF800000);
  
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  final _typeController = TextEditingController(text: 'Cuti Tahunan');
  final _reasonController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  
  final SignatureController _sigController = SignatureController(
    penStrokeWidth: 3,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );
  
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.existingLeave != null) {
      final leave = widget.existingLeave!;
      if (leave['start_date'] != null) {
        try {
          _startDate = DateTime.parse(leave['start_date']);
        } catch (_) {}
      }
      if (leave['end_date'] != null) {
        try {
          _endDate = DateTime.parse(leave['end_date']);
        } catch (_) {}
      }
      _typeController.text = leave['type']?.toString() ?? 'Cuti Tahunan';
      _reasonController.text = leave['reason']?.toString() ?? '';
      _addressController.text = leave['leave_address']?.toString() ?? '';
      _phoneController.text = leave['emergency_phone']?.toString() ?? '';
    }
  }

  @override
  void dispose() {
    _typeController.dispose();
    _reasonController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    _sigController.dispose();
    super.dispose();
  }

  Widget _buildPartSection({required String title, required Widget child, bool isFirst = false}) {
    return Container(
      decoration: BoxDecoration(
        border: Border(
          top: isFirst ? BorderSide.none : BorderSide(color: Colors.grey[400]!, width: 1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              border: Border(bottom: BorderSide(color: Colors.grey[400]!, width: 1)),
            ),
            child: Text(
              title.toUpperCase(),
              style: GoogleFonts.inter(
                fontSize: 9,
                fontWeight: FontWeight.bold,
                decoration: TextDecoration.underline,
                color: Colors.grey[800],
                letterSpacing: 0.5,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: child,
          ),
        ],
      ),
    );
  }

  Widget _buildFieldRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        SizedBox(
          width: 90,
          child: Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[700], fontSize: 10)),
        ),
        Text(" : ", style: GoogleFonts.inter(color: Colors.grey[400], fontSize: 10)),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                child: Text(value, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[850], fontSize: 10)),
              ),
              const DottedLine(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildInputRow(String label, TextEditingController controller, {required String hint}) {
    if (widget.isReadOnly) {
      return _buildFieldRow(label, controller.text.isNotEmpty ? controller.text : '-');
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        SizedBox(
          width: 90,
          child: Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[700], fontSize: 10)),
        ),
        Text(" : ", style: GoogleFonts.inter(color: Colors.grey[400], fontSize: 10)),
        Expanded(
          child: Column(
            children: [
              TextFormField(
                controller: controller,
                style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[850], fontWeight: FontWeight.w500),
                decoration: InputDecoration(
                  hintText: hint,
                  hintStyle: GoogleFonts.inter(fontSize: 10, color: Colors.grey[400]),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  border: InputBorder.none,
                ),
              ),
              const DottedLine(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPurposeRow() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: 90,
          child: Text("Purpose", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[700], fontSize: 10)),
        ),
        Text(" : ", style: GoogleFonts.inter(color: Colors.grey[400], fontSize: 10)),
        Expanded(
          child: widget.isReadOnly
              ? Text(_typeController.text, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 10, color: primaryColor))
              : DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _typeController.text,
                    isDense: true,
                    style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[850], fontWeight: FontWeight.w500),
                    items: [
                      'Cuti Tahunan',
                      'Cuti Sakit',
                      'Cuti Melahirkan',
                      'Cuti Alasan Penting',
                      'Lainnya',
                    ].map((type) => DropdownMenuItem(value: type, child: Text(type))).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _typeController.text = val);
                    },
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildPeriodRow() {
    final dateFormat = DateFormat('dd MMMM yyyy');
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        SizedBox(
          width: 90,
          child: Text("Period of leave", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[700], fontSize: 10)),
        ),
        Text(" : ", style: GoogleFonts.inter(color: Colors.grey[400], fontSize: 10)),
        Expanded(
          child: widget.isReadOnly
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      child: Text("${dateFormat.format(_startDate)} s/d ${dateFormat.format(_endDate)}", style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.grey[850], fontSize: 10)),
                    ),
                    const DottedLine(),
                  ],
                )
              : Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: _startDate,
                            firstDate: DateTime(2020),
                            lastDate: DateTime(2030),
                          );
                          if (picked != null) {
                            setState(() {
                              _startDate = picked;
                              if (_endDate.isBefore(_startDate)) _endDate = _startDate;
                            });
                          }
                        },
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              child: Text(dateFormat.format(_startDate), style: GoogleFonts.inter(color: Colors.grey[850], fontSize: 10, fontWeight: FontWeight.w500)),
                            ),
                            const DottedLine(),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text("to", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 9, color: Colors.grey[600])),
                    ),
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: _endDate,
                            firstDate: _startDate,
                            lastDate: DateTime(2030),
                          );
                          if (picked != null) setState(() => _endDate = picked);
                        },
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              child: Text(dateFormat.format(_endDate), style: GoogleFonts.inter(color: Colors.grey[850], fontSize: 10, fontWeight: FontWeight.w500)),
                            ),
                            const DottedLine(),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildDaysRow() {
    final diff = _endDate.difference(_startDate).inDays + 1;
    final totalDays = diff > 0 ? "$diff hari" : "1 hari";
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        SizedBox(
          width: 90,
          child: Text("Number of days", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[700], fontSize: 10)),
        ),
        Text(" : ", style: GoogleFonts.inter(color: Colors.grey[400], fontSize: 10)),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                child: Text(totalDays, style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.grey[850], fontSize: 10)),
              ),
              const DottedLine(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPartISignatures() {
    final hasExistingSig = widget.existingLeave != null && widget.existingLeave!['signature'] != null;
    final sigStr = widget.existingLeave?['signature']?.toString();

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Row(
          children: [
            Text("Date: ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[700], fontSize: 10)),
            Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  child: Text(
                    widget.existingLeave != null && widget.existingLeave!['created_at'] != null
                        ? DateFormat('dd/MM/yyyy').format(DateTime.parse(widget.existingLeave!['created_at']))
                        : DateFormat('dd/MM/yyyy').format(DateTime.now()),
                    style: GoogleFonts.inter(color: Colors.grey[850], fontSize: 10, fontWeight: FontWeight.w500),
                  ),
                ),
                const SizedBox(width: 70, child: DottedLine()),
              ],
            ),
          ],
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text("Name / Signature:", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[700], fontSize: 9)),
            const SizedBox(height: 4),
            Container(
              width: 120,
              height: 50,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey[300]!),
                borderRadius: BorderRadius.circular(4),
                color: Colors.white,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: hasExistingSig && _sigController.isEmpty
                    ? Image.memory(
                        base64Decode(sigStr!.contains(',') ? sigStr.split(',').last : sigStr),
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Signature(controller: _sigController, height: 50, backgroundColor: Colors.white),
                      )
                    : Signature(controller: _sigController, height: 50, backgroundColor: Colors.white),
              ),
            ),
            if (!widget.isReadOnly)
              GestureDetector(
                onTap: () => setState(() {
                  _sigController.clear();
                }),
                child: Padding(
                  padding: const EdgeInsets.only(top: 2, bottom: 2),
                  child: Text("Hapus / Tanda Tangan Ulang", style: GoogleFonts.inter(fontSize: 8, color: Colors.red[700], fontWeight: FontWeight.bold)),
                ),
              )
            else
              const SizedBox(height: 4),
            Text(widget.userProfile?['name'] ?? widget.existingLeave?['user']?['name'] ?? '-', style: GoogleFonts.inter(fontSize: 9, color: Colors.grey[800], fontWeight: FontWeight.bold)),
          ],
        ),
      ],
    );
  }

  Widget _buildPlaceholderRow(String label) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 10)),
        ),
        Text(" : ", style: GoogleFonts.inter(color: Colors.grey[400], fontSize: 10)),
        SizedBox(
          width: 50,
          child: Column(
            children: [
              Text("—", style: GoogleFonts.inter(color: Colors.grey[500], fontSize: 10, fontWeight: FontWeight.w600)),
              const DottedLine(),
            ],
          ),
        ),
        const SizedBox(width: 4),
        Text("days", style: GoogleFonts.inter(color: Colors.grey[500], fontSize: 10)),
      ],
    );
  }

  Widget _buildStaticCheckbox(bool checked, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border.all(
              color: checked
                  ? (label.toLowerCase().contains("not") ? Colors.red : Colors.green)
                  : Colors.grey[400]!,
              width: checked ? 1.5 : 1,
            ),
            borderRadius: BorderRadius.circular(2),
            color: checked
                ? (label.toLowerCase().contains("not") ? Colors.red.withOpacity(0.1) : Colors.green.withOpacity(0.1))
                : Colors.white,
          ),
          child: checked
              ? Icon(
                  Icons.check,
                  size: 10,
                  color: label.toLowerCase().contains("not") ? Colors.red : Colors.green[800],
                )
              : null,
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 9,
            color: checked
                ? (label.toLowerCase().contains("not") ? Colors.red[800] : Colors.green[900])
                : Colors.grey[600],
            fontWeight: checked ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildStampBadge({required String label, required Color color, String? approverName, String? date}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        border: Border.all(color: color, width: 1.5),
        borderRadius: BorderRadius.circular(4),
        color: color.withOpacity(0.08),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: GoogleFonts.inter(
              fontSize: 9,
              fontWeight: FontWeight.w900,
              color: color,
              letterSpacing: 1.0,
            ),
          ),
          if (approverName != null && approverName.isNotEmpty) ...[
            const SizedBox(height: 1),
            Text(
              approverName,
              style: GoogleFonts.inter(
                fontSize: 7.5,
                fontWeight: FontWeight.bold,
                color: color,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (date != null && date.isNotEmpty) ...[
            Text(
              date,
              style: GoogleFonts.inter(
                fontSize: 7,
                color: color.withOpacity(0.85),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSuperAdminBanner(String note) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.amber[50],
        border: Border.all(color: Colors.amber[400]!, width: 1.2),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined, size: 16, color: Colors.amber[900]),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Persetujuan Otorisasi Khusus Super Admin",
                  style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.amber[900]),
                ),
                const SizedBox(height: 2),
                Text(
                  note,
                  style: GoogleFonts.inter(fontSize: 9, color: Colors.amber[950], height: 1.3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hPad = ResponsiveHelper.padding(context, 16);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.isReadOnly
              ? "Pratinjau Dokumen Cuti"
              : (widget.existingLeave != null ? "Edit Pengajuan Cuti" : "Form Pengajuan Cuti"),
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: ResponsiveHelper.fontSize(context, 16)),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
      ),
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: EdgeInsets.all(hPad),
          child: Column(
            children: [
              // Sisa Cuti bar
              FadeSlideIn(
                delay: Duration.zero,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.amber[50],
                    border: Border.all(color: Colors.amber[200]!),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.info_outline_rounded, size: 16, color: Colors.amber[900]),
                          const SizedBox(width: 6),
                          Text("Sisa Cuti Karyawan", style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber[900])),
                        ],
                      ),
                      Text("${widget.leaveBalance} Hari", style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.amber[900])),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Paper card document style
              FadeSlideIn(
                delay: const Duration(milliseconds: 100),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10, offset: const Offset(0, 4)),
                    ],
                  ),
                  padding: EdgeInsets.all(ResponsiveHelper.padding(context, 16)),
                  child: Column(
                    children: [
                      // Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Image.asset(
                            'assets/images/artacom.png',
                            height: ResponsiveHelper.isSmallPhone(context) ? 30 : 38,
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) {
                              return Text(
                                "ART ACOM",
                                style: GoogleFonts.inter(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  color: const Color(0xFF800000),
                                ),
                              );
                            },
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                "LEAVE APPLICATION FORM",
                                style: GoogleFonts.inter(fontSize: ResponsiveHelper.fontSize(context, 11), fontWeight: FontWeight.bold, color: Colors.black),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                "NO. : HRD-${widget.existingLeave?['id'] ?? 'XXX'}/LF/${DateTime.now().month}/${DateTime.now().year.toString().substring(2)}",
                                style: GoogleFonts.inter(fontSize: 8, color: Colors.grey[600]),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Container(height: 3, color: Colors.black),
                      const SizedBox(height: 2),
                      Container(height: 1, color: Colors.black),
                      const SizedBox(height: 12),

                      // Outer border container for 4-part form layout
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey[400]!, width: 1),
                        ),
                        child: Column(
                          children: [
                            // Part I
                            _buildPartSection(
                              title: "Part I - To be completed by employee",
                              isFirst: true,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildFieldRow("Name", widget.userProfile?['name'] ?? widget.existingLeave?['user']?['name'] ?? '-'),
                                  const SizedBox(height: 8),
                                  _buildFieldRow("Position", widget.userProfile?['role']?['name'] ?? widget.existingLeave?['user']?['role']?['name'] ?? '-'),
                                  const SizedBox(height: 8),
                                  _buildFieldRow("Departement", widget.userProfile?['office']?['name'] ?? widget.userProfile?['company']?['name'] ?? widget.existingLeave?['user']?['office']?['name'] ?? '-'),
                                  const SizedBox(height: 8),
                                  _buildPurposeRow(),
                                  const SizedBox(height: 8),
                                  _buildInputRow("Keterangan", _reasonController, hint: "Tulis alasan cuti..."),
                                  const SizedBox(height: 8),
                                  _buildPeriodRow(),
                                  const SizedBox(height: 8),
                                  _buildDaysRow(),
                                  const SizedBox(height: 8),
                                  _buildInputRow("Leave Address", _addressController, hint: "Alamat selama cuti..."),
                                  const SizedBox(height: 8),
                                  _buildInputRow("Contact #", _phoneController, hint: "No. HP darurat..."),
                                  const SizedBox(height: 12),
                                  _buildPartISignatures(),
                                ],
                              ),
                            ),

                            // Part II - HRD Dept
                            Builder(builder: (context) {
                              final rawStatus = widget.existingLeave?['status']?.toString().toLowerCase() ?? '';
                              final isHrApproved = rawStatus == 'approved' || rawStatus == 'pending_hr' || widget.existingLeave?['hr_approved_at'] != null;
                              final hrName = widget.existingLeave?['hr_approver']?['name'] ?? widget.existingLeave?['hrApprover']?['name'] ?? 'HRD Dept';
                              final hrDate = widget.existingLeave?['hr_approved_at'] ?? widget.existingLeave?['updated_at'];
                              final formattedHrDate = hrDate != null ? DateFormat('dd/MM/yyyy').format(DateTime.parse(hrDate.toString())) : '';

                              return _buildPartSection(
                                title: "Part II - To be completed by HRD Dept",
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _buildPlaceholderRow("Leave eligibility, Current Year"),
                                    const SizedBox(height: 6),
                                    _buildPlaceholderRow("  Previous Year c/f"),
                                    const SizedBox(height: 6),
                                    _buildPlaceholderRow("  Total"),
                                    const SizedBox(height: 6),
                                    _buildPlaceholderRow("Less No. of day to be taken"),
                                    const SizedBox(height: 6),
                                    _buildPlaceholderRow("Balance Leave"),
                                    const SizedBox(height: 12),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Row(
                                          children: [
                                            Text("Date: ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                            if (isHrApproved && formattedHrDate.isNotEmpty)
                                              Padding(
                                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                                child: Text(formattedHrDate, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 9, color: Colors.black87)),
                                              )
                                            else
                                              const SizedBox(width: 60, child: DottedLine()),
                                          ],
                                        ),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.center,
                                          children: [
                                            Text("Name / Signature:", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 8)),
                                            const SizedBox(height: 4),
                                            if (isHrApproved)
                                              _buildStampBadge(label: "APPROVED", color: Colors.green.shade800, approverName: hrName, date: formattedHrDate)
                                            else ...[
                                              const SizedBox(height: 16),
                                              const SizedBox(width: 90, child: DottedLine()),
                                            ],
                                          ],
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            }),

                            // Part III - Dept Manager
                            Builder(builder: (context) {
                              final rawStatus = widget.existingLeave?['status']?.toString().toLowerCase() ?? '';
                              final spvApprovedAt = widget.existingLeave?['supervisor_approved_at'];
                              final isSpvApproved = rawStatus == 'approved' || rawStatus == 'pending_hr' || spvApprovedAt != null;
                              final isSpvRejected = rawStatus == 'rejected' && widget.existingLeave?['supervisor_approved_by'] != null;
                              final spvName = widget.existingLeave?['supervisor_approver']?['name'] ?? widget.existingLeave?['supervisorApprover']?['name'] ?? widget.userProfile?['supervisor']?['name'] ?? 'Supervisor';
                              final spvDate = spvApprovedAt != null ? DateFormat('dd/MM/yyyy').format(DateTime.parse(spvApprovedAt.toString())) : '';
                              final spvRemark = widget.existingLeave?['supervisor_remark']?.toString() ?? '';
                              final hasSpvSuperAdmin = spvRemark.contains('[Disetujui Super Admin');

                              return _buildPartSection(
                                title: "Part III - To be completed by Department Manager",
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (hasSpvSuperAdmin) _buildSuperAdminBanner(spvRemark),
                                    Row(
                                      children: [
                                        Text("Leave Permit : ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                        const SizedBox(width: 8),
                                        _buildStaticCheckbox(isSpvApproved, "Approved"),
                                        const SizedBox(width: 12),
                                        _buildStaticCheckbox(isSpvRejected, "Not Approved"),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        SizedBox(
                                          width: 50,
                                          child: Text("Remark", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                        ),
                                        Text(" : ", style: GoogleFonts.inter(color: Colors.grey[400], fontSize: 9)),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              if (spvRemark.isNotEmpty)
                                                Padding(
                                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                                  child: Text(spvRemark, style: GoogleFonts.inter(fontSize: 9, color: Colors.grey[850])),
                                                ),
                                              const DottedLine(),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Row(
                                          children: [
                                            Text("Date: ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                            if (isSpvApproved && spvDate.isNotEmpty)
                                              Padding(
                                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                                child: Text(spvDate, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 9, color: Colors.black87)),
                                              )
                                            else
                                              const SizedBox(width: 60, child: DottedLine()),
                                          ],
                                        ),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.center,
                                          children: [
                                            Text("Name / Signature:", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 8)),
                                            const SizedBox(height: 4),
                                            if (isSpvApproved)
                                              _buildStampBadge(label: "APPROVED", color: const Color(0xFF1E40AF), approverName: spvName, date: spvDate)
                                            else if (isSpvRejected)
                                              _buildStampBadge(label: "REJECTED", color: Colors.red.shade800, approverName: spvName, date: spvDate)
                                            else ...[
                                              const SizedBox(height: 16),
                                              const SizedBox(width: 90, child: DottedLine()),
                                            ],
                                          ],
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            }),

                            // Part IV - Director
                            Builder(builder: (context) {
                              final rawStatus = widget.existingLeave?['status']?.toString().toLowerCase() ?? '';
                              final isFinalApproved = rawStatus == 'approved';
                              final isFinalRejected = rawStatus == 'rejected' && widget.existingLeave?['supervisor_approved_by'] == null;
                              final dirDate = widget.existingLeave?['updated_at'] != null ? DateFormat('dd/MM/yyyy').format(DateTime.parse(widget.existingLeave!['updated_at'].toString())) : '';
                              final finalRemark = widget.existingLeave?['remark']?.toString() ?? '';
                              final hasSuperAdminOverride = finalRemark.contains('[Disetujui Super Admin');
                              final approverName = widget.existingLeave?['hr_approver']?['name'] ?? widget.existingLeave?['approver']?['name'] ?? 'Director';

                              return _buildPartSection(
                                title: "Part IV - To be completed by Director",
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (hasSuperAdminOverride) _buildSuperAdminBanner(finalRemark),
                                    Row(
                                      children: [
                                        Text("Leave Permit : ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                        const SizedBox(width: 8),
                                        _buildStaticCheckbox(isFinalApproved, "Approved"),
                                        const SizedBox(width: 12),
                                        _buildStaticCheckbox(isFinalRejected, "Not Approved"),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        SizedBox(
                                          width: 50,
                                          child: Text("Remark", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                        ),
                                        Text(" : ", style: GoogleFonts.inter(color: Colors.grey[400], fontSize: 9)),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              if (finalRemark.isNotEmpty)
                                                Padding(
                                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                                  child: Text(finalRemark, style: GoogleFonts.inter(fontSize: 9, color: Colors.grey[850])),
                                                ),
                                              const DottedLine(),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Row(
                                          children: [
                                            Text("Date: ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                            if (isFinalApproved && dirDate.isNotEmpty)
                                              Padding(
                                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                                child: Text(dirDate, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 9, color: Colors.black87)),
                                              )
                                            else
                                              const SizedBox(width: 60, child: DottedLine()),
                                          ],
                                        ),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.center,
                                          children: [
                                            Text("Name / Signature:", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 8)),
                                            const SizedBox(height: 4),
                                            if (isFinalApproved)
                                              _buildStampBadge(label: "APPROVED", color: Colors.green.shade800, approverName: approverName, date: dirDate)
                                            else if (isFinalRejected)
                                              _buildStampBadge(label: "REJECTED", color: Colors.red.shade800, approverName: approverName, date: dirDate)
                                            else ...[
                                              const SizedBox(height: 16),
                                              const SizedBox(width: 90, child: DottedLine()),
                                            ],
                                          ],
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            }),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Action Buttons
              if (widget.isReadOnly) ...[
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: BorderSide(color: Colors.grey[400]!),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: Text("KEMBALI", style: GoogleFonts.inter(color: Colors.grey[800], fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.picture_as_pdf, color: Colors.white, size: 18),
                        onPressed: () {
                          if (widget.existingLeave != null) {
                            ApiService.launchPdf('leave', widget.existingLeave!['id']);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        label: Text("UNDUH PDF RESMI", style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ] else ...[
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: const BorderSide(color: Colors.grey),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: Text("BATAL", style: GoogleFonts.inter(color: Colors.grey[700], fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _isSubmitting ? null : _submitLeaveForm,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: _isSubmitting
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : Text(widget.existingLeave != null ? "SIMPAN PERUBAHAN" : "KIRIM PENGAJUAN", style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submitLeaveForm() async {
    final bool isEditing = widget.existingLeave != null;
    final bool hasExistingSig = isEditing && widget.existingLeave!['signature'] != null;

    if (_sigController.isEmpty && !hasExistingSig) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Tanda tangan wajib diisi"), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: isEditing ? "Menyimpan perubahan cuti..." : "Mengajukan cuti...");

    try {
      String? base64Sig;
      if (_sigController.isNotEmpty) {
        final sigData = await _sigController.toPngBytes();
        if (sigData != null) {
          base64Sig = 'data:image/png;base64,${base64Encode(sigData)}';
        }
      } else if (hasExistingSig) {
        base64Sig = widget.existingLeave!['signature'];
      }

      final leaveType = _typeController.text.trim().isEmpty ? 'Cuti Tahunan' : _typeController.text.trim();

      final payload = {
        'type': leaveType,
        'start_date': DateFormat('yyyy-MM-dd').format(_startDate),
        'end_date': DateFormat('yyyy-MM-dd').format(_endDate),
        'reason': _reasonController.text,
        'leave_address': _addressController.text,
        'emergency_phone': _phoneController.text,
        if (base64Sig != null) 'signature': base64Sig,
      };

      final res = isEditing
          ? await ApiService.updateLeave(widget.existingLeave!['id'], payload)
          : await ApiService.submitLeave(payload);

      LoadingDialog.hide(context);
      if (res['status'] == 'success' || res['id'] != null) {
        Navigator.pop(context);
        widget.onSubmitted();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isEditing ? "Berhasil memperbarui cuti" : "Berhasil mengajukan cuti"),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        final msg = res['message'] ?? (res['errors']?.toString() ?? "Gagal memproses cuti.");
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      LoadingDialog.hide(context);
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red),
      );
    }
  }
}

