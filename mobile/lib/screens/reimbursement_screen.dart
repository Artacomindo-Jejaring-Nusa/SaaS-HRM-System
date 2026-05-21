import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:image_picker/image_picker.dart';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';
import '../../widgets/loading_overlay.dart';

class ReimbursementScreen extends StatefulWidget {
  @override
  _ReimbursementScreenState createState() => _ReimbursementScreenState();
}

class _ReimbursementScreenState extends State<ReimbursementScreen> {
  final Color primaryColor = const Color(0xFF800000);
  List<dynamic> _claims = [];
  bool _isLoading = true;
  final currencyFormatter = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    _fetchClaims();
  }

  Future<void> _fetchClaims() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getReimbursements();
    if (mounted) {
      setState(() {
        _claims = data ?? [];
        _isLoading = false;
      });
    }
  }

  void _showAddDialog() {
    final titleController = TextEditingController();
    final amountController = TextEditingController();
    final descController = TextEditingController();
    List<XFile> pickedFiles = [];
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          height: MediaQuery.of(context).size.height * 0.85,
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
                      "Ajukan Klaim",
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
                  "Judul Klaim (Contoh: Bensin)",
                  titleController,
                  Icons.title_rounded,
                ),
                const SizedBox(height: 15),
                _buildTextField(
                  "Nominal (Rp)",
                  amountController,
                  Icons.payments_rounded,
                  isNumber: true,
                ),
                const SizedBox(height: 15),
                _buildTextField(
                  "Keterangan",
                  descController,
                  Icons.description_rounded,
                  maxLines: 3,
                ),
                const SizedBox(height: 20),
                Text(
                  "Lampiran Bukti / Nota",
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
                          final source =
                              await showModalBottomSheet<ImageSource>(
                                context: context,
                                builder: (context) => Container(
                                  padding: const EdgeInsets.all(20),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      ListTile(
                                        leading: const Icon(Icons.camera_alt),
                                        title: const Text("Kamera"),
                                        onTap: () => Navigator.pop(
                                          context,
                                          ImageSource.camera,
                                        ),
                                      ),
                                      ListTile(
                                        leading: const Icon(
                                          Icons.photo_library,
                                        ),
                                        title: const Text("Galeri"),
                                        onTap: () => Navigator.pop(
                                          context,
                                          ImageSource.gallery,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );

                          if (source != null) {
                            final picker = ImagePicker();
                            if (source == ImageSource.gallery) {
                              final images = await picker.pickMultiImage(
                                imageQuality: 50,
                              );
                              if (images.isNotEmpty) {
                                setModalState(() {
                                  pickedFiles = images;
                                });
                              }
                            } else {
                              final image = await picker.pickImage(
                                source: source,
                                imageQuality: 50,
                              );
                              if (image != null) {
                                setModalState(() {
                                  pickedFiles = [image];
                                });
                              }
                            }
                          }
                        },
                  child: Container(
                    height: 150,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(
                        color: Colors.grey[300]!,
                        style: BorderStyle.none,
                      ),
                    ),
                    child: pickedFiles.isNotEmpty
                        ? ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: pickedFiles.length,
                            itemBuilder: (context, i) => Container(
                              width: 150,
                              margin: const EdgeInsets.only(right: 10),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(15),
                                child: Image.file(
                                  File(pickedFiles[i].path),
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                          )
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.add_a_photo_outlined,
                                size: 40,
                                color: primaryColor,
                              ),
                              const SizedBox(height: 10),
                              const Text(
                                "Ambil Foto Nota",
                                style: TextStyle(color: Colors.grey),
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
                            if (titleController.text.isEmpty ||
                                amountController.text.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text("Isi judul dan nominal!"),
                                ),
                              );
                              return;
                            }

                            setModalState(() => isSubmitting = true);
                            LoadingDialog.show(context, message: "Mengajukan klaim biaya...");

                            try {
                              final res = await ApiService.submitReimbursement(
                                {
                                  'title': titleController.text,
                                  'amount': amountController.text,
                                  'description': descController.text,
                                },
                                filePaths: pickedFiles
                                    .map((e) => e.path)
                                    .toList(),
                              );

                              LoadingDialog.hide(context);

                              if (mounted) {
                                if (res['status'] == 'success') {
                                  Navigator.pop(context);
                                  _fetchClaims();
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text("Klaim berhasil diajukan!"),
                                      backgroundColor: Colors.green,
                                    ),
                                  );
                                } else {
                                  setModalState(() => isSubmitting = false);
                                  print("SUBMIT_FAILED: $res");
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        "Gagal: ${res['message'] ?? 'Status Error'}",
                                      ),
                                      backgroundColor: Colors.red,
                                    ),
                                  );
                                }
                              }
                            } catch (e) {
                              LoadingDialog.hide(context);
                              setModalState(() => isSubmitting = false);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text("Error: ${e.toString()}"),
                                  backgroundColor: Colors.red,
                                ),
                              );
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
          "Klaim Biaya",
          style: GoogleFonts.inter(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchClaims),
        ],
      ),
      body: _isLoading
          ? const SimpleListSkeleton()
          : RefreshIndicator(
              onRefresh: _fetchClaims,
              child: _claims.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: _claims.length,
                      itemBuilder: (context, index) =>
                          _buildClaimCard(_claims[index]),
                    ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: primaryColor,
        onPressed: _showAddDialog,
        label: Text(
          "AJUKAN KLAIM",
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
          Icon(Icons.payments_outlined, size: 80, color: Colors.grey[300]),
          const SizedBox(height: 15),
          const Text("Belum ada pengajuan klaim"),
        ],
      ),
    );
  }

  Widget _buildClaimCard(dynamic claim) {
    final status = claim['status'].toString().toLowerCase();
    Color statusColor = Colors.orange;
    if (status == 'approved') statusColor = Colors.green;
    if (status == 'rejected') statusColor = Colors.red;

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
                DateFormat(
                  'dd MMM yyyy',
                ).format(DateTime.parse(claim['created_at'])),
                style: TextStyle(color: Colors.grey[600], fontSize: 13),
              ),
              Row(
                children: [
                  if (status != 'rejected')
                    IconButton(
                      constraints: BoxConstraints(),
                      padding: EdgeInsets.zero,
                      icon: Icon(
                        Icons.picture_as_pdf,
                        color: primaryColor,
                        size: 20,
                      ),
                      onPressed: () =>
                          ApiService.launchPdf('reimbursement', claim['id']),
                    ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      status.toUpperCase(),
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 15),
          Text(
            claim['title'],
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            currencyFormatter.format(double.parse(claim['amount'].toString())),
            style: GoogleFonts.outfit(
              fontSize: 18,
              color: primaryColor,
              fontWeight: FontWeight.bold,
            ),
          ),

          if (claim['attachment'] != null) ...[
            const SizedBox(height: 15),
            SizedBox(
              height: 150,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: (claim['attachment'] is List)
                    ? claim['attachment'].length
                    : 1,
                itemBuilder: (context, i) {
                  String? path = (claim['attachment'] is List)
                      ? claim['attachment'][i]
                      : claim['attachment'];
                  String imageUrl = path!;
                  imageUrl = ApiService.fixUrl(imageUrl);

                  return Container(
                    width: 250,
                    margin: const EdgeInsets.only(right: 10),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.network(
                        imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (c, e, s) => Container(
                          color: Colors.grey[100],
                          child: const Center(
                            child: Icon(Icons.broken_image, size: 20),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],

          if (claim['description'] != null) ...[
            const SizedBox(height: 10),
            Text(
              claim['description'],
              style: TextStyle(color: Colors.grey[600], fontSize: 13),
            ),
          ],
          if (claim['remark'] != null) ...[
            const Divider(height: 30),
            Text(
              "Catatan Admin:",
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 12,
                color: Colors.grey[800],
              ),
            ),
            const SizedBox(height: 5),
            Text(
              claim['remark'],
              style: TextStyle(
                color: Colors.red[700],
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
