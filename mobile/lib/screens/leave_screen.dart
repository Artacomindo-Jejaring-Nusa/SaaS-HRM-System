import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:signature/signature.dart';
import 'dart:convert';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';
import '../../widgets/loading_overlay.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Cuti Karyawan", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
      ),
      backgroundColor: const Color(0xFFF9FAFB),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF800000)))
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Leave Balance Card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: primaryColor,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(color: primaryColor.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 4)),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Sisa Cuti Tahunan Anda", style: GoogleFonts.inter(color: Colors.white70, fontSize: 12)),
                        const SizedBox(height: 4),
                        Text("$_leaveBalance Hari", style: GoogleFonts.inter(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text("Riwayat Pengajuan Cuti", style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  Expanded(
                    child: _leaves.isEmpty
                        ? Center(
                            child: Text(
                              "Belum ada riwayat pengajuan cuti",
                              style: GoogleFonts.inter(color: Colors.grey, fontSize: 14),
                            ),
                          )
                        : ListView.separated(
                            itemCount: _leaves.length,
                            separatorBuilder: (c, i) => const SizedBox(height: 10),
                            itemBuilder: (ctx, index) {
                              final leave = _leaves[index];
                              final String rawStatus = leave['status'] ?? 'pending';
                              
                              Color statusColor;
                              String statusText;
                              if (rawStatus == 'approved') {
                                statusColor = Colors.green;
                                statusText = "Approved";
                              } else if (rawStatus == 'rejected') {
                                statusColor = Colors.red;
                                statusText = "Rejected";
                              } else {
                                statusColor = Colors.orange;
                                statusText = "Pending";
                              }

                              return Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: Colors.grey[200]!),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          leave['type'] ?? 'Cuti',
                                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          "${leave['start_date']} s/d ${leave['end_date']}",
                                          style: GoogleFonts.inter(color: Colors.grey[600], fontSize: 12),
                                        ),
                                        if (leave['reason'] != null && leave['reason'].toString().isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          Text(
                                            "Ket: ${leave['reason']}",
                                            style: GoogleFonts.inter(color: Colors.grey[500], fontSize: 11),
                                          ),
                                        ]
                                      ],
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                          decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                                          child: Text(statusText, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold)),
                                        ),
                                        if (rawStatus != 'rejected')
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                constraints: const BoxConstraints(),
                                                padding: const EdgeInsets.only(top: 8),
                                                icon: Icon(Icons.picture_as_pdf, color: primaryColor, size: 20), 
                                                onPressed: () => ApiService.launchPdf('leave', leave['id']),
                                              ),
                                              const SizedBox(width: 8),
                                              IconButton(
                                                constraints: const BoxConstraints(),
                                                padding: const EdgeInsets.only(top: 8),
                                                icon: const Icon(Icons.table_view, color: Colors.green, size: 20), 
                                                onPressed: () => ApiService.launchExcel('leave', leave['id']),
                                              ),
                                            ],
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
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
        backgroundColor: primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
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

  const LeaveFormScreen({
    Key? key,
    required this.userProfile,
    required this.leaveBalance,
    required this.onSubmitted,
  }) : super(key: key);

  @override
  _LeaveFormScreenState createState() => _LeaveFormScreenState();
}

class _LeaveFormScreenState extends State<LeaveFormScreen> {
  final Color primaryColor = const Color(0xFF800000);
  
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  String _type = 'Cuti Tahunan';
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
  void dispose() {
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
              TextField(
                controller: controller,
                style: GoogleFonts.inter(color: Colors.grey[850], fontSize: 10, fontWeight: FontWeight.w500),
                decoration: InputDecoration(
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  border: InputBorder.none,
                  hintText: hint,
                  hintStyle: GoogleFonts.inter(color: Colors.grey[400], fontSize: 10),
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
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 90,
          child: Text("Purpose", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[700], fontSize: 10)),
        ),
        Text(" : ", style: GoogleFonts.inter(color: Colors.grey[400], fontSize: 10)),
        Expanded(
          child: Wrap(
            spacing: 8,
            runSpacing: 6,
            children: ["Cuti Tahunan", "Cuti Melahirkan", "Cuti Alasan Penting", "Lainnya"].map((type) {
              final isSelected = _type == type;
              return GestureDetector(
                onTap: () => setState(() => _type = type),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey[500]!, width: 1.2),
                        borderRadius: BorderRadius.circular(2),
                        color: isSelected ? const Color(0xFF0056B3) : Colors.transparent,
                      ),
                      child: isSelected
                          ? const Icon(Icons.check, size: 8, color: Colors.white)
                          : null,
                    ),
                    const SizedBox(width: 4),
                    Text(type, style: GoogleFonts.inter(fontSize: 9, color: Colors.grey[800], fontWeight: FontWeight.w500)),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildPeriodRow() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text("Periode of leave required from : ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[700], fontSize: 10)),
        Expanded(
          child: GestureDetector(
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: _startDate,
                firstDate: DateTime.now().subtract(const Duration(days: 30)),
                lastDate: DateTime(2027),
              );
              if (date != null) {
                setState(() {
                  _startDate = date;
                  if (_endDate.isBefore(_startDate)) {
                    _endDate = _startDate;
                  }
                });
              }
            },
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  child: Text(DateFormat('dd/MM/yyyy').format(_startDate), style: GoogleFonts.inter(color: Colors.grey[850], fontSize: 10, fontWeight: FontWeight.w500)),
                ),
                const DottedLine(),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Text("to", style: GoogleFonts.inter(color: Colors.grey[500], fontSize: 10, fontWeight: FontWeight.w500)),
        ),
        Expanded(
          child: GestureDetector(
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: _endDate.isBefore(_startDate) ? _startDate : _endDate,
                firstDate: _startDate,
                lastDate: DateTime(2027),
              );
              if (date != null) {
                setState(() => _endDate = date);
              }
            },
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  child: Text(DateFormat('dd/MM/yyyy').format(_endDate), style: GoogleFonts.inter(color: Colors.grey[850], fontSize: 10, fontWeight: FontWeight.w500)),
                ),
                const DottedLine(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDaysRow() {
    final difference = _endDate.difference(_startDate).inDays + 1;
    final totalDays = difference > 0 ? "$difference hari" : "—";
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
                  child: Text(DateFormat('dd/MM/yyyy').format(DateTime.now()), style: GoogleFonts.inter(color: Colors.grey[850], fontSize: 10, fontWeight: FontWeight.w500)),
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
                child: Signature(controller: _sigController, height: 50, backgroundColor: Colors.white),
              ),
            ),
            GestureDetector(
              onTap: () => _sigController.clear(),
              child: Padding(
                padding: const EdgeInsets.only(top: 2, bottom: 2),
                child: Text("Hapus TTD", style: GoogleFonts.inter(fontSize: 8, color: Colors.red[700], fontWeight: FontWeight.bold)),
              ),
            ),
            Text(widget.userProfile?['name'] ?? '-', style: GoogleFonts.inter(fontSize: 9, color: Colors.grey[800], fontWeight: FontWeight.bold)),
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
          width: 11,
          height: 11,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[400]!, width: 1),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: GoogleFonts.inter(fontSize: 9, color: Colors.grey[500], fontWeight: FontWeight.w500)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Form Pengajuan Cuti", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
      ),
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              // Sisa Cuti bar
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.amber[50],
                  border: Border.all(color: Colors.amber[200]!),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("Sisa Cuti Karyawan", style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber[900])),
                    Text("${widget.leaveBalance} Hari", style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber[900])),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Paper card document style
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 6, offset: const Offset(0, 3)),
                  ],
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    // Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Image.asset(
                          'assets/images/artacom.png',
                          height: 36,
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
                              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              "NO. : HRD-XXX/LF/${DateTime.now().month}/${DateTime.now().year.toString().substring(2)}",
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
                                _buildFieldRow("Name", widget.userProfile?['name'] ?? '-'),
                                const SizedBox(height: 8),
                                _buildFieldRow("Position", widget.userProfile?['role']?['name'] ?? '-'),
                                const SizedBox(height: 8),
                                _buildFieldRow("Departement", widget.userProfile?['office']?['name'] ?? widget.userProfile?['company']?['name'] ?? '-'),
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
                          // Part II
                          _buildPartSection(
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
                                        const SizedBox(width: 60, child: DottedLine()),
                                      ],
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.center,
                                      children: [
                                        Text("Name / Signature:", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 8)),
                                        const SizedBox(height: 20),
                                        const SizedBox(width: 90, child: DottedLine()),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          // Part III
                          _buildPartSection(
                            title: "Part III - To be completed by Department Manager",
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text("Leave Permit : ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                    const SizedBox(width: 8),
                                    _buildStaticCheckbox(false, "Approved"),
                                    const SizedBox(width: 12),
                                    _buildStaticCheckbox(false, "Not Approved"),
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
                                    const Expanded(child: DottedLine()),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                const DottedLine(),
                                const SizedBox(height: 12),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Row(
                                      children: [
                                        Text("Date: ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                        const SizedBox(width: 60, child: DottedLine()),
                                      ],
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.center,
                                      children: [
                                        Text("Name / Signature:", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 8)),
                                        const SizedBox(height: 20),
                                        const SizedBox(width: 90, child: DottedLine()),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          // Part IV
                          _buildPartSection(
                            title: "Part IV - To be completed by Director",
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text("Leave Permit : ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                    const SizedBox(width: 8),
                                    _buildStaticCheckbox(false, "Approved"),
                                    const SizedBox(width: 12),
                                    _buildStaticCheckbox(false, "Not Approved"),
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
                                    const Expanded(child: DottedLine()),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                const DottedLine(),
                                const SizedBox(height: 12),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Row(
                                      children: [
                                        Text("Date: ", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 9)),
                                        const SizedBox(width: 60, child: DottedLine()),
                                      ],
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.center,
                                      children: [
                                        Text("Name / Signature:", style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.grey[600], fontSize: 8)),
                                        const SizedBox(height: 20),
                                        const SizedBox(width: 90, child: DottedLine()),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Action Buttons
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
                          : Text("KIRIM PENGAJUAN", style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submitLeaveForm() async {
    if (_sigController.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Tanda tangan wajib diisi"), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Mengajukan cuti...");

    try {
      final sigData = await _sigController.toPngBytes();
      if (sigData == null) {
        LoadingDialog.hide(context);
        setState(() => _isSubmitting = false);
        return;
      }

      final base64Sig = base64Encode(sigData);

      final res = await ApiService.submitLeave({
        'type': _type,
        'start_date': DateFormat('yyyy-MM-dd').format(_startDate),
        'end_date': DateFormat('yyyy-MM-dd').format(_endDate),
        'reason': _reasonController.text,
        'leave_address': _addressController.text,
        'emergency_phone': _phoneController.text,
        'signature': 'data:image/png;base64,$base64Sig',
      });

      LoadingDialog.hide(context);
      if (res['status'] == 'success' || res['id'] != null) {
        Navigator.pop(context);
        widget.onSubmitted();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Berhasil mengajukan cuti"), backgroundColor: Colors.green),
        );
      } else {
        final msg = res['message'] ?? (res['errors']?.toString() ?? "Gagal mengajukan cuti.");
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
