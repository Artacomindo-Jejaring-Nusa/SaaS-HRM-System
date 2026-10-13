import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../api/api_service.dart';
import '../widgets/skeleton_loading.dart';
import '../widgets/loading_overlay.dart';
import 'fund_request_form_screen.dart';

class FundRequestScreen extends StatefulWidget {
  const FundRequestScreen({super.key});

  @override
  State<FundRequestScreen> createState() => _FundRequestScreenState();
}

class _FundRequestScreenState extends State<FundRequestScreen> {
  final Color primaryColor = const Color(0xFF800000);
  List<dynamic> _requests = [];
  List<dynamic> _employees = [];
  bool _isLoading = true;
  final currencyFormatter = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    _fetchRequests();
    _fetchEmployees();
  }

  Future<void> _fetchEmployees() async {
    try {
      final emps = await ApiService.getEmployees();
      if (mounted) {
        setState(() {
          _employees = emps ?? [];
        });
      }
    } catch (e) {
      debugPrint("Error fetching employees: $e");
    }
  }

  Future<void> _fetchRequests() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getFundRequests();
    if (mounted) {
      setState(() {
        _requests = data ?? [];
        _isLoading = false;
      });
    }
  }

  String _terbilang(double nominal) {
    if (nominal <= 0) return "Nol Rupiah";
    final angka = [
      "", "Satu", "Dua", "Tiga", "Empat", "Lima",
      "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
    ];
    String konversi(int n) {
      if (n < 12) return angka[n];
      if (n < 20) return "${konversi(n - 10)} Belas";
      if (n < 100) return "${konversi(n ~/ 10)} Puluh ${konversi(n % 10)}";
      if (n < 200) return "Seratus ${konversi(n - 100)}";
      if (n < 1000) return "${konversi(n ~/ 100)} Ratus ${konversi(n % 100)}";
      if (n < 2000) return "Seribu ${konversi(n - 1000)}";
      if (n < 1000000) return "${konversi(n ~/ 1000)} Ribu ${konversi(n % 1000)}";
      if (n < 1000000000) return "${konversi(n ~/ 1000000)} Juta ${konversi(n % 1000000)}";
      if (n < 1000000000000) return "${konversi(n ~/ 1000000000)} Milyar ${konversi(n % 1000000000)}";
      return "";
    }
    String hasil = konversi(nominal.floor());
    hasil = hasil.replaceAll(RegExp(r'\s+'), ' ').trim();
    hasil = hasil
        .replaceAll("Satu Ratus", "Seratus")
        .replaceAll("Satu Puluh", "Sepuluh")
        .replaceAll("Satu Ribu", "Seribu");
    return "$hasil Rupiah";
  }

  List<dynamic> _extractItems(dynamic request) {
    if (request['items'] != null) {
      if (request['items'] is List) {
        return request['items'] as List;
      }
      if (request['items'] is String) {
        try {
          final parsed = jsonDecode(request['items']);
          if (parsed is List) return parsed;
        } catch (_) {}
      }
    }
    return [
      {
        'spesifikasi': request['title'] ?? request['reason'] ?? "Pengajuan Dana Operasional",
        'unit': 'Pcs',
        'qty': 1,
        'estimasi_harga': double.tryParse(request['amount']?.toString() ?? '0') ?? 0.0,
        'keterangan': request['reason'] ?? '',
      }
    ];
  }

  void _showAddDialog() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => FundRequestFormScreen(
          employees: _employees,
          onSubmitted: _fetchRequests,
        ),
      ),
    );
  }

  Future<void> _deleteRequest(int id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Hapus Pengajuan Dana?"),
        content: const Text("Pengajuan yang dihapus tidak dapat dikembalikan."),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text("Batal"),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text("Hapus", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      if (!mounted) return;
      LoadingDialog.show(context, message: "Menghapus pengajuan...");
      final res = await ApiService.deleteFundRequest(id);
      if (!mounted) return;
      LoadingDialog.hide(context);

      if (res['status'] == 'success') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Pengajuan dana berhasil dihapus."),
            backgroundColor: Colors.green,
          ),
        );
        _fetchRequests();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? "Gagal menghapus pengajuan."),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBFBFB),
      appBar: AppBar(
        title: Text(
          "Pengajuan Dana",
          style: GoogleFonts.inter(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchRequests,
          ),
        ],
      ),
      body: _isLoading
          ? const SimpleListSkeleton()
          : RefreshIndicator(
              onRefresh: _fetchRequests,
              child: _requests.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: _requests.length,
                      itemBuilder: (context, index) =>
                          _buildRequestCard(_requests[index]),
                    ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: primaryColor,
        onPressed: _showAddDialog,
        label: Text(
          "AJUKAN DANA",
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        icon: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.account_balance_wallet_outlined,
              size: 80, color: Colors.grey[300]),
          const SizedBox(height: 15),
          const Text("Belum ada pengajuan dana"),
        ],
      ),
    );
  }

  Widget _buildRequestCard(dynamic request) {
    final status = request['status'].toString();
    final step = request['current_approval_step'];
    final stepInfo = request['current_step_info'];
    Color statusColor = Colors.orange;
    String statusText = status.toUpperCase();

    if (status == 'approved') {
      statusColor = Colors.green;
      statusText = "DISETUJUI";
    } else if (status == 'rejected') {
      statusColor = Colors.red;
      statusText = "DITOLAK";
    } else if (status == 'approved_by_supervisor' ||
        (step != null && (int.tryParse(step.toString()) ?? 1) > 1)) {
      statusColor = Colors.blue;
      final stepNum = step != null ? (int.tryParse(step.toString()) ?? 1) : 2;
      statusText = stepInfo != null
          ? "ACC SPV (TAHAP ${stepInfo['step_number']}/${stepInfo['total_steps']})"
          : "ACC SPV (TAHAP $stepNum)";
    } else {
      statusText = "MENUNGGU SPV";
    }

    final priority = (request['priority'] ?? 'Normal').toString();
    Color priorityColor = Colors.blue;
    if (priority.toLowerCase() == 'urgent') priorityColor = Colors.orange;
    if (priority.toLowerCase() == 'top urgent' ||
        priority.toLowerCase() == 'top_urgent') {
      priorityColor = Colors.red;
    }

    final items = _extractItems(request);
    final amountVal = double.tryParse(request['amount']?.toString() ?? '0') ?? 0.0;
    final empName = request['employee_name'] ?? request['user']?['name'] ?? "";

    return InkWell(
      onTap: () => _showDetailModal(request),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Date, Priority & Status
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      DateFormat('dd MMM yyyy')
                          .format(DateTime.parse(request['created_at'])),
                      style: TextStyle(color: Colors.grey[600], fontSize: 13),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: priorityColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        priority.toUpperCase(),
                        style: GoogleFonts.inter(
                          color: priorityColor,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Title & Applicant
            Text(
              request['title'] ?? request['reason'] ?? "Pengajuan Dana",
              style: GoogleFonts.outfit(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            if (empName.toString().isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.person, size: 14, color: Colors.grey[600]),
                  const SizedBox(width: 4),
                  Text(
                    empName.toString(),
                    style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[700]),
                  ),
                  if (request['divisi'] != null &&
                      request['divisi'].toString().isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Text("•", style: TextStyle(color: Colors.grey[400])),
                    const SizedBox(width: 8),
                    Text(
                      request['divisi'].toString(),
                      style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                    ),
                  ],
                ],
              ),
            ],
            const SizedBox(height: 10),

            // Amount
            Text(
              currencyFormatter.format(amountVal),
              style: GoogleFonts.outfit(
                fontSize: 22,
                color: primaryColor,
                fontWeight: FontWeight.bold,
              ),
            ),

            // Items Summary
            if (items.isNotEmpty) ...[
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "Rincian ${items.length} Item:",
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey[700],
                    ),
                  ),
                  Text(
                    "Klik kartu untuk lihat dokumen resmi",
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      color: primaryColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ...items.take(2).map((it) {
                final sub = (double.tryParse(it['estimasi_harga']?.toString() ?? '0') ?? 0.0) *
                    (int.tryParse(it['qty']?.toString() ?? '1') ?? 1);
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Container(
                        width: 5,
                        height: 5,
                        decoration: BoxDecoration(
                          color: Colors.grey[400],
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          "${it['spesifikasi']} (${it['qty']} ${it['unit'] ?? 'Pcs'})",
                          style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[700]),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        currencyFormatter.format(sub),
                        style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                );
              }).toList(),
              if (items.length > 2)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    "+ ${items.length - 2} item lainnya...",
                    style: GoogleFonts.inter(
                        fontSize: 10, color: Colors.grey[500], fontStyle: FontStyle.italic),
                  ),
                ),
            ],

            // Proposal Image
            if (request['attachment'] != null) ...[
              const SizedBox(height: 14),
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  ApiService.fixUrl(request['attachment']),
                  height: 120,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (c, e, s) => Container(
                    height: 80,
                    color: Colors.grey[100],
                    child: const Center(
                        child: Icon(Icons.description_rounded, color: Colors.grey)),
                  ),
                ),
              ),
            ],

            // Rejection reason
            if (request['reject_reason'] != null) ...[
              const Divider(height: 24),
              Text(
                "Alasan Penolakan:",
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  color: Colors.red[700],
                ),
              ),
              const SizedBox(height: 4),
              Text(
                request['reject_reason'],
                style: TextStyle(
                  color: Colors.grey[800],
                  fontStyle: FontStyle.italic,
                  fontSize: 12,
                ),
              ),
            ],

            // Footer Actions: Detail & Delete (if pending)
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: () => _showDetailModal(request),
                  icon: const Icon(Icons.remove_red_eye_rounded, size: 16),
                  label: const Text("Lihat Lembar Dokumen"),
                  style: TextButton.styleFrom(
                    foregroundColor: primaryColor,
                    textStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
                if (status == 'pending') ...[
                  const SizedBox(width: 8),
                  IconButton(
                    icon: Icon(Icons.edit_outlined,
                        color: primaryColor, size: 20),
                    tooltip: "Edit Pengajuan",
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => FundRequestFormScreen(
                            employees: _employees,
                            existingRequest: request,
                            onSubmitted: _fetchRequests,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded,
                        color: Colors.red, size: 20),
                    tooltip: "Hapus Pengajuan",
                    onPressed: () => _deleteRequest(request['id']),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════════
  //  MODAL DETAIL: OFFICIAL DOCUMENT SHEET (EXCEL / CETAK VIEW)
  // ═════════════════════════════════════════════════════════════════
  void _showDetailModal(dynamic request) {
    final dateStr = DateFormat('dd/MM/yyyy')
        .format(DateTime.parse(request['created_at']));
    final noStr =
        "FUND/${DateFormat('yyyyMMdd').format(DateTime.parse(request['created_at']))}/#${request['id']}";
    final empName = request['employee_name'] ?? request['user']?['name'] ?? "—";
    final title = request['title'] ?? request['reason'] ?? "—";
    final divisi = request['divisi'] ?? "Operasional";
    final tujuan = (request['tujuan'] ?? "Pengadaan Baru").toString();
    final priority = (request['priority'] ?? "Normal").toString();
    final items = _extractItems(request);
    final totalAmount =
        double.tryParse(request['amount']?.toString() ?? '0') ?? 0.0;
    final status = request['status']?.toString() ?? 'pending';
    final supervisorApprovedAt = request['supervisor_approved_at'];
    final hrdApprovedAt = request['hrd_approved_at'];
    final signature = request['signature'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.92,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Modal Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: primaryColor,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.description_rounded,
                        color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Dokumen Pengajuan Dana",
                          style: GoogleFonts.outfit(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: Colors.white,
                          ),
                        ),
                        Text(
                          noStr,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: Colors.white70,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
            ),

            // Modal Body
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    // Official Document Sheet in Horizontal Scroll
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Container(
                        width: 530,
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey[300]!),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.06),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // ── HEADER ──
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Image.asset('assets/images/artacom.png',
                                        height: 38),
                                    const SizedBox(height: 4),
                                    Text(
                                      "PT ARTACOMINDO JEJARING NUSA",
                                      style: GoogleFonts.inter(
                                          fontWeight: FontWeight.w900,
                                          fontSize: 9,
                                          letterSpacing: 0.3),
                                    ),
                                  ],
                                ),
                                Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 8),
                                    child: Text(
                                      "PENGAJUAN UANG MUKA / PERMINTAAN DANA",
                                      textAlign: TextAlign.center,
                                      style: GoogleFonts.inter(
                                        fontWeight: FontWeight.w900,
                                        fontSize: 12,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ),
                                ),
                                SizedBox(
                                  width: 140,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      _sheetHeaderField("Date", dateStr),
                                      const SizedBox(height: 4),
                                      _sheetHeaderField("No", noStr),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const Divider(
                                color: Colors.black, thickness: 1.5, height: 16),

                            // ── PRIORITY CHECKLIST ──
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                _sheetPriorityBox("NORMAL", priority.toLowerCase() == "normal"),
                                const SizedBox(width: 8),
                                _sheetPriorityBox("URGENT", priority.toLowerCase() == "urgent"),
                                const SizedBox(width: 8),
                                _sheetPriorityBox("TOP URGENT",
                                    priority.toLowerCase().contains("top")),
                              ],
                            ),
                            const SizedBox(height: 8),

                            // ── INFO FIELDS & TUJUAN ──
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    children: [
                                      _sheetInfoRow("Nama", empName),
                                      const SizedBox(height: 4),
                                      _sheetInfoRow("Tujuan", title),
                                      const SizedBox(height: 4),
                                      _sheetInfoRow("Div.", divisi),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _sheetCheckOption(
                                        "Pengadaan Baru",
                                        tujuan.toLowerCase().contains("pengadaan")),
                                    const SizedBox(height: 4),
                                    _sheetCheckOption(
                                        "Dari Gudang",
                                        tujuan.toLowerCase().contains("gudang")),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            // ── TABLE ──
                            Container(
                              decoration: BoxDecoration(
                                border:
                                    Border.all(color: Colors.black, width: 1.5),
                              ),
                              child: Column(
                                children: [
                                  Container(
                                    color: Colors.grey[200],
                                    padding:
                                        const EdgeInsets.symmetric(vertical: 6),
                                    child: Row(
                                      children: [
                                        _sheetTableCell("No.", width: 30, isHeader: true),
                                        _sheetTableCell("Spesifikasi Barang / Jasa",
                                            flex: 3,
                                            isHeader: true,
                                            align: TextAlign.left),
                                        _sheetTableCell("Unit", width: 45, isHeader: true),
                                        _sheetTableCell("Quantity", width: 55, isHeader: true),
                                        _sheetTableCell("Estimasi Harga",
                                            width: 95,
                                            isHeader: true,
                                            align: TextAlign.right),
                                        _sheetTableCell("Tanggal / Keterangan",
                                            flex: 2,
                                            isHeader: true,
                                            align: TextAlign.left),
                                      ],
                                    ),
                                  ),
                                  const Divider(
                                      color: Colors.black, height: 1, thickness: 1.5),

                                  ...List.generate(
                                    items.length < 6 ? 6 : items.length,
                                    (idx) {
                                      final it = idx < items.length ? items[idx] : null;
                                      final qty = it != null ? (it['qty'] ?? 1) : null;
                                      final harga = it != null
                                          ? (double.tryParse(it['estimasi_harga']?.toString() ?? '0') ?? 0.0)
                                          : null;

                                      return Container(
                                        decoration: BoxDecoration(
                                          border: Border(
                                            bottom: BorderSide(
                                              color: Colors.grey[300]!,
                                              width: idx == (items.length < 6 ? 5 : items.length - 1) ? 0 : 0.8,
                                            ),
                                          ),
                                        ),
                                        padding: const EdgeInsets.symmetric(vertical: 4),
                                        child: Row(
                                          children: [
                                            _sheetTableCell("${idx + 1}", width: 30),
                                            _sheetTableCell(
                                              it?['spesifikasi']?.toString() ?? "",
                                              flex: 3,
                                              align: TextAlign.left,
                                            ),
                                            _sheetTableCell(
                                                it?['unit']?.toString() ?? "", width: 45),
                                            _sheetTableCell(
                                                qty != null ? "$qty" : "", width: 55),
                                            _sheetTableCell(
                                              harga != null && harga > 0
                                                  ? currencyFormatter.format(harga)
                                                  : "",
                                              width: 95,
                                              align: TextAlign.right,
                                            ),
                                            _sheetTableCell(
                                              it?['keterangan']?.toString() ?? "",
                                              flex: 2,
                                              align: TextAlign.left,
                                            ),
                                          ],
                                        ),
                                      );
                                    },
                                  ),

                                  // Total Row
                                  Container(
                                    color: Colors.amber[50],
                                    padding: const EdgeInsets.symmetric(vertical: 6),
                                    decoration: const BoxDecoration(
                                      border: Border(
                                          top: BorderSide(
                                              color: Colors.black, width: 1.5)),
                                    ),
                                    child: Row(
                                      children: [
                                        const SizedBox(width: 30),
                                        Expanded(
                                          flex: 3,
                                          child: Text(
                                            "TOTAL",
                                            textAlign: TextAlign.right,
                                            style: GoogleFonts.inter(
                                                fontWeight: FontWeight.w900,
                                                fontSize: 10,
                                                letterSpacing: 1),
                                          ),
                                        ),
                                        const SizedBox(width: 45),
                                        const SizedBox(width: 55),
                                        SizedBox(
                                          width: 95,
                                          child: Padding(
                                            padding: const EdgeInsets.only(right: 6),
                                            child: Text(
                                              currencyFormatter.format(totalAmount),
                                              textAlign: TextAlign.right,
                                              style: GoogleFonts.inter(
                                                  fontWeight: FontWeight.w900,
                                                  fontSize: 10),
                                            ),
                                          ),
                                        ),
                                        const Expanded(flex: 2, child: SizedBox()),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 10),

                            // ── TERBILANG ──
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "Terbilang : ",
                                  style: GoogleFonts.inter(
                                      fontWeight: FontWeight.bold, fontSize: 9),
                                ),
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.grey[50],
                                      border: Border.all(color: Colors.black),
                                    ),
                                    child: Text(
                                      _terbilang(totalAmount),
                                      style: GoogleFonts.inter(
                                          fontStyle: FontStyle.italic,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 9),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),

                            // ── APPROVAL BOXES ──
                            Container(
                              decoration: BoxDecoration(
                                border:
                                    Border.all(color: Colors.black, width: 1),
                              ),
                              child: Column(
                                children: [
                                  Container(
                                    color: Colors.grey[200],
                                    child: Row(
                                      children: [
                                        _sheetApprovalHeaderCell("DIRUT"),
                                        _sheetApprovalHeaderCell("FINANCE"),
                                        _sheetApprovalHeaderCell("UNIT HEAD"),
                                        _sheetApprovalHeaderCell("REQUESTER",
                                            isLast: true),
                                      ],
                                    ),
                                  ),
                                  const Divider(
                                      color: Colors.black, height: 1, thickness: 1),
                                  Row(
                                    children: [
                                      _sheetApprovalContentCell(
                                        "Direktur Utama",
                                        isVerified: status == 'approved' || hrdApprovedAt != null,
                                        isRejected: status == 'rejected',
                                      ),
                                      _sheetApprovalContentCell(
                                        "Pending Accounting",
                                        isVerified: status == 'approved' || hrdApprovedAt != null,
                                        isRejected: status == 'rejected',
                                      ),
                                      _sheetApprovalContentCell(
                                        "Pending Unit Head",
                                        isVerified: status == 'approved' ||
                                            status == 'approved_by_supervisor' ||
                                            supervisorApprovedAt != null,
                                        isRejected: status == 'rejected',
                                      ),
                                      _sheetApprovalContentCell(
                                        empName,
                                        signatureBase64: signature,
                                        isRequester: true,
                                        isLast: true,
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
                    const SizedBox(height: 20),

                    // Proposal Attachment (if any)
                    if (request['attachment'] != null) ...[
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          "Lampiran Dokumen / Proposal Pendukung:",
                          style: GoogleFonts.inter(
                              fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.network(
                          ApiService.fixUrl(request['attachment']),
                          fit: BoxFit.contain,
                          errorBuilder: (c, e, s) => Container(
                            height: 120,
                            color: Colors.grey[100],
                            child: const Center(
                                child: Text("Gagal memuat gambar lampiran")),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sheetHeaderField(String label, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text("$label : ",
            style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold)),
        Text(value, style: GoogleFonts.inter(fontSize: 9)),
      ],
    );
  }

  Widget _sheetPriorityBox(String label, bool isChecked) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.black, width: 1),
          ),
          alignment: Alignment.center,
          child: isChecked
              ? const Text("✓",
                  style: TextStyle(
                      fontSize: 8, fontWeight: FontWeight.bold, height: 1))
              : null,
        ),
        const SizedBox(width: 4),
        Text(label,
            style: GoogleFonts.inter(fontSize: 8, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _sheetInfoRow(String label, String value) {
    return Row(
      children: [
        SizedBox(
          width: 50,
          child: Text(label,
              style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold)),
        ),
        const Text(" : ", style: TextStyle(fontSize: 9)),
        Expanded(
          child: Container(
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.grey, width: 0.8)),
            ),
            child: Text(
              value,
              style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
      ],
    );
  }

  Widget _sheetCheckOption(String label, bool isChecked) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.black, width: 1),
          ),
          alignment: Alignment.center,
          child: isChecked
              ? const Text("✓",
                  style: TextStyle(
                      fontSize: 8, fontWeight: FontWeight.bold, height: 1))
              : null,
        ),
        const SizedBox(width: 4),
        Text(label,
            style: GoogleFonts.inter(fontSize: 8, fontWeight: FontWeight.w500)),
      ],
    );
  }

  Widget _sheetTableCell(
    String text, {
    double? width,
    int? flex,
    bool isHeader = false,
    TextAlign align = TextAlign.center,
  }) {
    final style = GoogleFonts.inter(
      fontSize: isHeader ? 8 : 8.5,
      fontWeight: isHeader ? FontWeight.w900 : FontWeight.normal,
      color: Colors.black87,
    );

    final child = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(text,
          style: style,
          textAlign: align,
          overflow: TextOverflow.ellipsis,
          maxLines: 1),
    );

    if (width != null) return SizedBox(width: width, child: child);
    return Expanded(flex: flex ?? 1, child: child);
  }

  Widget _sheetApprovalHeaderCell(String label, {bool isLast = false}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 3),
        decoration: BoxDecoration(
          border: isLast ? null : const Border(right: BorderSide(color: Colors.black)),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 8),
        ),
      ),
    );
  }

  Widget _sheetApprovalContentCell(
    String subText, {
    bool isVerified = false,
    bool isRejected = false,
    String? signatureBase64,
    bool isRequester = false,
    bool isLast = false,
  }) {
    return Expanded(
      child: Container(
        height: 62,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          border: isLast ? null : const Border(right: BorderSide(color: Colors.black)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Center(
                child: isRequester
                    ? (signatureBase64 != null && signatureBase64.isNotEmpty
                        ? (signatureBase64.startsWith('data:')
                            ? Image.memory(
                                base64Decode(signatureBase64.split(',').last),
                                fit: BoxFit.contain,
                              )
                            : Image.network(
                                ApiService.fixUrl(signatureBase64),
                                fit: BoxFit.contain,
                                errorBuilder: (c, e, s) => const Icon(
                                    Icons.draw_rounded, size: 16),
                              ))
                        : Text("— Belum TTD —",
                            style: GoogleFonts.inter(
                                fontSize: 7,
                                color: Colors.grey,
                                fontStyle: FontStyle.italic)))
                    : (isVerified
                        ? Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: Colors.green[50],
                              border: Border.all(color: Colors.green[700]!),
                              borderRadius: BorderRadius.circular(2),
                            ),
                            child: Text(
                              "VERIFIED",
                              style: GoogleFonts.inter(
                                  fontSize: 6.5,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.green[800]),
                            ),
                          )
                        : (isRejected
                            ? Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 4, vertical: 1),
                                decoration: BoxDecoration(
                                  color: Colors.red[50],
                                  border: Border.all(color: Colors.red[700]!),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                                child: Text(
                                  "REJECTED",
                                  style: GoogleFonts.inter(
                                      fontSize: 6.5,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.red[800]),
                                ),
                              )
                            : Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 4, vertical: 1),
                                decoration: BoxDecoration(
                                  color: Colors.grey[100],
                                  border: Border.all(color: Colors.grey[400]!),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                                child: Text(
                                  "PENDING",
                                  style: GoogleFonts.inter(
                                      fontSize: 6.5,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.grey[600]),
                                ),
                              ))),
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.only(top: 2),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Colors.grey, width: 0.8)),
              ),
              child: Text(
                subText,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 7,
                  fontWeight: isRequester ? FontWeight.bold : FontWeight.normal,
                  color: isRequester ? Colors.black : Colors.grey[700],
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
