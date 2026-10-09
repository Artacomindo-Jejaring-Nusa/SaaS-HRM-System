import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../api/api_service.dart';
import '../widgets/skeleton_loading.dart';
import '../widgets/loading_overlay.dart';

class FundRequestScreen extends StatefulWidget {
  @override
  _FundRequestScreenState createState() => _FundRequestScreenState();
}

class _FundRequestScreenState extends State<FundRequestScreen> {
  final Color primaryColor = const Color(0xFF800000);
  List<dynamic> _requests = [];
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
    if (nominal == 0) return "Nol Rupiah";
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

  void _showAddDialog() {
    final amountController = TextEditingController();
    final reasonController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          height: MediaQuery.of(context).size.height * 0.75,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
          ),
          padding: EdgeInsets.only(
            left: 25,
            right: 25,
            top: 25,
            bottom: MediaQuery.of(context).viewInsets.bottom + 25,
          ),
          child: SingleChildScrollView(
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
                          "Pengajuan Dana",
                          style: GoogleFonts.inter(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          "Permintaan Uang Muka / Cash Advance",
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Info Advance Fund
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber[50],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber[200]!),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline, size: 18, color: Colors.amber[900]),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          "Pengajuan dana adalah permohonan uang muka sebelum pengeluaran. Nota & bukti belanja dilaporkan setelah dana digunakan.",
                          style: GoogleFonts.inter(fontSize: 11, color: Colors.amber[950], height: 1.3),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                _buildTextField(
                  "Nominal Dana (Rp)",
                  amountController,
                  Icons.payments_rounded,
                  isNumber: true,
                ),
                const SizedBox(height: 15),
                _buildTextField(
                  "Keperluan / Alasan Pengajuan",
                  reasonController,
                  Icons.description_rounded,
                  maxLines: 3,
                ),
                const SizedBox(height: 30),

                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 0,
                    ),
                    icon: const Icon(Icons.remove_red_eye_rounded, size: 18, color: Colors.white),
                    label: Text(
                      "Review & Preview Pengajuan",
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: Colors.white,
                      ),
                    ),
                    onPressed: () {
                      final amountText = amountController.text.trim();
                      final reasonText = reasonController.text.trim();
                      final amountVal = double.tryParse(amountText.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0.0;

                      if (amountVal <= 0 || reasonText.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("Mohon isi nominal dana dan keperluan dengan lengkap!"),
                            backgroundColor: Colors.red,
                          ),
                        );
                        return;
                      }

                      _showPreviewDialog(amountVal, reasonText);
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showPreviewDialog(double amountVal, String reasonText) {
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          height: MediaQuery.of(context).size.height * 0.75,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Header
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
                      child: const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Preview Pengajuan Dana",
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            "Periksa kembali data permohonan uang muka",
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: Colors.white70,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white70),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),

              // Body
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Notice
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.blue[50],
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.blue[200]!),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_rounded, size: 18, color: Colors.blue[800]),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                "Pengajuan dana adalah permohonan uang muka sebelum pembelian. Bukti nota (SPJ) akan dilaporkan setelah dana digunakan.",
                                style: GoogleFonts.inter(fontSize: 11, color: Colors.blue[900], height: 1.3),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Nominal Card
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.amber[50],
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.amber[300]!, width: 1.5),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "TOTAL NOMINAL PENGAJUAN:",
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Colors.amber[900],
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              currencyFormatter.format(amountVal),
                              style: GoogleFonts.outfit(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: primaryColor,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              "Terbilang: ${_terbilang(amountVal)}",
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontStyle: FontStyle.italic,
                                color: Colors.amber[900],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Keperluan Card
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.grey[50],
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.grey[200]!),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "KEPERLUAN / ALASAN:",
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.grey[600],
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              reasonText,
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Colors.grey[900],
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Footer Actions
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: Colors.grey[200]!)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: BorderSide(color: Colors.grey[300]!),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(
                          "Edit Data",
                          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.grey[700]),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton.icon(
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                setModalState(() => isSubmitting = true);
                                LoadingDialog.show(context, message: "Mengirim pengajuan dana...");

                                try {
                                  final res = await ApiService.submitFundRequest(
                                    {
                                      'amount': amountVal.toString(),
                                      'reason': reasonText,
                                      'title': reasonText,
                                    },
                                  );

                                  LoadingDialog.hide(context);

                                  if (mounted) {
                                    if (res['status'] == 'success') {
                                      Navigator.pop(ctx); // Close preview
                                      Navigator.pop(context); // Close add sheet
                                      _fetchRequests();
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text("Pengajuan dana berhasil dikirim! Menunggu persetujuan."),
                                          backgroundColor: Colors.green,
                                        ),
                                      );
                                    } else {
                                      setModalState(() => isSubmitting = false);
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text("Gagal: ${res['message']}"),
                                          backgroundColor: Colors.red,
                                        ),
                                      );
                                    }
                                  }
                                } catch (e) {
                                  LoadingDialog.hide(context);
                                  if (mounted) {
                                    setModalState(() => isSubmitting = false);
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text("Error: ${e.toString()}"),
                                        backgroundColor: Colors.red,
                                      ),
                                    );
                                  }
                                }
                              },
                        icon: isSubmitting
                            ? const SizedBox(
                                height: 16,
                                width: 16,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Icon(Icons.send_rounded, size: 16, color: Colors.white),
                        label: Text(
                          "Konfirmasi & Kirim",
                          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
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

  Widget _buildTextField(
    String label,
    TextEditingController controller,
    IconData icon, {
    bool isNumber = false,
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      keyboardType: isNumber ? TextInputType.number : TextInputType.text,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: primaryColor),
        filled: true,
        fillColor: Colors.grey[50],
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(15),
          borderSide: BorderSide.none,
        ),
      ),
    );
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
    } else if (status == 'approved_by_supervisor' || (step != null && (int.tryParse(step.toString()) ?? 1) > 1)) {
      statusColor = Colors.blue;
      final stepNum = step != null ? (int.tryParse(step.toString()) ?? 1) : 2;
      statusText = stepInfo != null ? "ACC SPV (TAHAP ${stepInfo['step_number']}/${stepInfo['total_steps']})" : "ACC SPV (TAHAP $stepNum)";
    } else {
      statusText = "MENUNGGU SPV";
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 15),
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                DateFormat('dd MMM yyyy')
                    .format(DateTime.parse(request['created_at'])),
                style: TextStyle(color: Colors.grey[600], fontSize: 13),
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
          const SizedBox(height: 15),
          Text(
            currencyFormatter.format(double.parse(request['amount'].toString())),
            style: GoogleFonts.outfit(
              fontSize: 22,
              color: primaryColor,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            request['reason'],
            style: GoogleFonts.outfit(
              fontSize: 14,
              color: Colors.black87,
            ),
          ),
          if (request['attachment'] != null) ...[
            const SizedBox(height: 15),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                ApiService.fixUrl(request['attachment']),
                height: 150,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (c, e, s) => Container(
                  height: 150,
                  color: Colors.grey[100],
                  child: const Center(child: Icon(Icons.broken_image)),
                ),
              ),
            ),
          ],
          if (request['reject_reason'] != null) ...[
            const Divider(height: 30),
            Text(
              "Alasan Penolakan:",
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 12,
                color: Colors.red[700],
              ),
            ),
            const SizedBox(height: 5),
            Text(
              request['reject_reason'],
              style: TextStyle(
                color: Colors.grey[800],
                fontStyle: FontStyle.italic,
                fontSize: 12,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
