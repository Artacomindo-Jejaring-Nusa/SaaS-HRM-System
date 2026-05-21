import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'dart:convert';
import 'package:image_picker/image_picker.dart';
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

  void _showAddDialog() {
    final amountController = TextEditingController();
    final reasonController = TextEditingController();
    XFile? pickedFile;
    bool isSubmitting = false;

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
            top: 30,
            bottom: MediaQuery.of(context).viewInsets.bottom + 30,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      "Pengajuan Dana",
                      style: GoogleFonts.inter(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 25),
                _buildTextField(
                  "Nominal (Rp)",
                  amountController,
                  Icons.payments_rounded,
                  isNumber: true,
                ),
                const SizedBox(height: 15),
                _buildTextField(
                  "Keperluan / Alasan",
                  reasonController,
                  Icons.description_rounded,
                  maxLines: 3,
                ),
                const SizedBox(height: 20),
                Text(
                  "Lampiran Pendukung (Opsional)",
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 10),
                GestureDetector(
                  onTap: isSubmitting
                      ? null
                      : () async {
                          final picker = ImagePicker();
                          final image = await picker.pickImage(
                            source: ImageSource.gallery,
                            imageQuality: 50,
                          );
                          if (image != null) {
                            setModalState(() {
                              pickedFile = image;
                            });
                          }
                        },
                  child: Container(
                    height: 120,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(color: Colors.grey[300]!),
                    ),
                    child: pickedFile != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(15),
                            child: Image.file(
                              File(pickedFile!.path),
                              fit: BoxFit.cover,
                            ),
                          )
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.add_a_photo_outlined,
                                size: 30,
                                color: primaryColor,
                              ),
                              const SizedBox(height: 5),
                              const Text(
                                "Pilih Foto",
                                style: TextStyle(color: Colors.grey, fontSize: 12),
                              ),
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: 30),
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15),
                      ),
                    ),
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            if (amountController.text.isEmpty ||
                                reasonController.text.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text("Mohon isi semua data!"),
                                ),
                              );
                              return;
                            }

                            setModalState(() => isSubmitting = true);
                            LoadingDialog.show(context, message: "Mengirim pengajuan dana...");

                            try {
                              String? base64Image;
                              if (pickedFile != null) {
                                final bytes = await File(pickedFile!.path).readAsBytes();
                                base64Image = base64Encode(bytes);
                              }

                              final res = await ApiService.submitFundRequest({
                                'amount': amountController.text,
                                'reason': reasonController.text,
                                'attachment': base64Image,
                              });

                              LoadingDialog.hide(context);

                              if (mounted) {
                                if (res['status'] == 'success') {
                                  Navigator.pop(context);
                                  _fetchRequests();
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text("Pengajuan berhasil dikirim!"),
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
                    child: isSubmitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : Text(
                            "KIRIM PENGAJUAN",
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                  ),
                ),
              ],
            ),
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
    Color statusColor = Colors.orange;
    String statusText = status.toUpperCase();

    if (status == 'approved') {
      statusColor = Colors.green;
      statusText = "DISETUJUI";
    } else if (status == 'rejected') {
      statusColor = Colors.red;
      statusText = "DITOLAK";
    } else if (status == 'approved_by_supervisor') {
      statusColor = Colors.blue;
      statusText = "ACC SPV";
    } else {
      statusText = "PENDING";
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
