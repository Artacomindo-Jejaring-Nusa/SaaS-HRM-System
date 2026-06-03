import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'dart:convert';
import 'package:image_picker/image_picker.dart';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';
import '../../widgets/loading_overlay.dart';

class ReimbursementItemInput {
  final TextEditingController spesifikasiController = TextEditingController();
  final TextEditingController unitController = TextEditingController(text: "Pcs");
  final TextEditingController qtyController = TextEditingController(text: "1");
  final TextEditingController hargaController = TextEditingController(text: "0");
  final TextEditingController keteranganController = TextEditingController();

  void dispose() {
    spesifikasiController.dispose();
    unitController.dispose();
    qtyController.dispose();
    hargaController.dispose();
    keteranganController.dispose();
  }
}

class ReimbursementScreen extends StatefulWidget {
  @override
  _ReimbursementScreenState createState() => _ReimbursementScreenState();
}

class _ReimbursementScreenState extends State<ReimbursementScreen> {
  final Color primaryColor = const Color(0xFF800000);
  List<dynamic> _claims = [];
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
    _fetchClaims();
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
      print("Error fetching employees: $e");
    }
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

  String terbilang(double nominal) {
    if (nominal == 0) return "Nol Rupiah";
    final angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    
    String konversi(int n) {
      if (n < 12) return angka[n];
      if (n < 20) return konversi(n - 10) + " Belas";
      if (n < 100) return konversi(n ~/ 10) + " Puluh " + konversi(n % 10);
      if (n < 200) return "Seratus " + konversi(n - 100);
      if (n < 1000) return konversi(n ~/ 100) + " Ratus " + konversi(n % 100);
      if (n < 2000) return "Seribu " + konversi(n - 1000);
      if (n < 1000000) return konversi(n ~/ 1000) + " Ribu " + konversi(n % 1000);
      if (n < 1000000000) return konversi(n ~/ 1000000) + " Juta " + konversi(n % 1000000);
      if (n < 1000000000000) return konversi(n ~/ 1000000000) + " Milyar " + konversi(n % 1000000000);
      return "";
    }
    
    String hasil = konversi(nominal.floor());
    hasil = hasil.replaceAll(RegExp(r'\s+'), ' ').trim();
    hasil = hasil.replaceAll("Satu Ratus", "Seratus")
                 .replaceAll("Satu Puluh", "Sepuluh")
                 .replaceAll("Satu Ribu", "Seribu");
    return "$hasil Rupiah";
  }

  void _showAddDialog() {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    final divisiController = TextEditingController(text: "Operasional");
    String selectedTujuan = "";
    String selectedPriority = "Normal";
    final tujuanLainnyaController = TextEditingController();
    List<XFile> pickedFiles = [];
    bool isSubmitting = false;
    bool isCustomEmployee = false;
    String? chosenEmployeeName;
    final employeeNameController = TextEditingController();
    List<ReimbursementItemInput> itemInputs = [ReimbursementItemInput()];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          final totalAmount = itemInputs.fold<double>(0.0, (sum, input) {
            final qty = int.tryParse(input.qtyController.text) ?? 1;
            final harga = double.tryParse(input.hargaController.text) ?? 0.0;
            return sum + (qty * harga);
          });

          return Container(
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
                  isCustomEmployee
                      ? _buildTextField(
                          "Nama Pemohon (Manual)",
                          employeeNameController,
                          Icons.person_rounded,
                        )
                      : DropdownButtonFormField<String>(
                          value: chosenEmployeeName,
                          decoration: InputDecoration(
                            labelText: "Nama Karyawan / Pemohon",
                            prefixIcon: Icon(Icons.person_outline_rounded, color: primaryColor),
                            filled: true,
                            fillColor: Colors.grey[50],
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(15),
                              borderSide: BorderSide.none,
                            ),
                          ),
                          items: [
                            const DropdownMenuItem(value: null, child: Text("-- Pilih Karyawan --")),
                            ..._employees.map((emp) => DropdownMenuItem(
                              value: emp['name'].toString(),
                              child: Text(emp['name'].toString()),
                            )),
                          ],
                          onChanged: (val) {
                            setModalState(() {
                              chosenEmployeeName = val;
                              if (val != null) {
                                final emp = _employees.firstWhere(
                                  (e) => e['name'].toString() == val,
                                  orElse: () => null,
                                );
                                if (emp != null && emp['role'] != null) {
                                  divisiController.text = emp['role']['name'] ?? "Operasional";
                                }
                              }
                            });
                          },
                        ),
                  Row(
                    children: [
                      Checkbox(
                        value: isCustomEmployee,
                        activeColor: primaryColor,
                        onChanged: (val) {
                          setModalState(() {
                            isCustomEmployee = val ?? false;
                            if (!isCustomEmployee) {
                              chosenEmployeeName = null;
                            } else {
                              employeeNameController.clear();
                            }
                          });
                        },
                      ),
                      Text(
                        "Tulis Nama Manual / Custom",
                        style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[700]),
                      ),
                    ],
                  ),
                  const SizedBox(height: 15),
                  _buildTextField(
                    "Keperluan / Judul",
                    titleController,
                    Icons.title_rounded,
                  ),
                  const SizedBox(height: 15),
                  _buildTextField(
                    "Divisi",
                    divisiController,
                    Icons.business_rounded,
                  ),
                  const SizedBox(height: 15),
                  DropdownButtonFormField<String>(
                    value: selectedTujuan,
                    decoration: InputDecoration(
                      labelText: "Tujuan Penggunaan Dana (Opsional)",
                      prefixIcon: Icon(Icons.info_outline_rounded, color: primaryColor),
                      filled: true,
                      fillColor: Colors.grey[50],
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(15),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(value: "", child: Text("Tidak ada / Kosongkan")),
                      DropdownMenuItem(value: "Pengadaan Baru", child: Text("Pengadaan Baru")),
                      DropdownMenuItem(value: "Penggantian (Reimbursement)", child: Text("Penggantian (Reimbursement)")),
                      DropdownMenuItem(value: "Lainnya", child: Text("Lainnya")),
                    ],
                    onChanged: (val) {
                      setModalState(() {
                        selectedTujuan = val!;
                      });
                    },
                  ),
                  if (selectedTujuan == "Lainnya") ...[
                    const SizedBox(height: 15),
                    _buildTextField(
                      "Tujuan Lainnya",
                      tujuanLainnyaController,
                      Icons.edit_note_rounded,
                    ),
                  ],
                  const SizedBox(height: 15),
                  DropdownButtonFormField<String>(
                    value: selectedPriority,
                    decoration: InputDecoration(
                      labelText: "Prioritas Pengajuan",
                      prefixIcon: Icon(Icons.warning_amber_rounded, color: primaryColor),
                      filled: true,
                      fillColor: Colors.grey[50],
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(15),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(value: "Normal", child: Text("Normal")),
                      DropdownMenuItem(value: "Urgent", child: Text("Urgent")),
                      DropdownMenuItem(value: "Top Urgent", child: Text("Top Urgent")),
                    ],
                    onChanged: (val) {
                      setModalState(() {
                        selectedPriority = val!;
                      });
                    },
                  ),
                  const SizedBox(height: 25),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "Item Barang / Jasa",
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.add_circle_outline, color: primaryColor),
                        onPressed: () {
                          setModalState(() {
                            itemInputs.add(ReimbursementItemInput());
                          });
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ...List.generate(itemInputs.length, (i) {
                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 15),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15),
                        side: BorderSide(color: Colors.grey[200]!, width: 1.5),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  "Baris Item #${i + 1}",
                                  style: GoogleFonts.inter(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: Colors.black87,
                                  ),
                                ),
                                if (itemInputs.length > 1)
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                                    onPressed: () {
                                      setModalState(() {
                                        itemInputs[i].dispose();
                                        itemInputs.removeAt(i);
                                      });
                                    },
                                  ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            _buildTextField(
                              "Spesifikasi / Nama Barang Jasa",
                              itemInputs[i].spesifikasiController,
                              Icons.shopping_bag_outlined,
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  flex: 2,
                                  child: _buildTextField(
                                    "Unit (e.g. Pcs, Box)",
                                    itemInputs[i].unitController,
                                    Icons.category_outlined,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  flex: 1,
                                  child: _buildTextField(
                                    "Qty",
                                    itemInputs[i].qtyController,
                                    Icons.format_list_numbered_rounded,
                                    isNumber: true,
                                    onChanged: (val) {
                                      setModalState(() {});
                                    },
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  flex: 2,
                                  child: _buildTextField(
                                    "Harga Satuan (Rp)",
                                    itemInputs[i].hargaController,
                                    Icons.payments_outlined,
                                    isNumber: true,
                                    onChanged: (val) {
                                      setModalState(() {});
                                    },
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  flex: 2,
                                  child: Container(
                                    height: 55,
                                    padding: const EdgeInsets.symmetric(horizontal: 12),
                                    decoration: BoxDecoration(
                                      color: Colors.grey[50],
                                      borderRadius: BorderRadius.circular(15),
                                    ),
                                    alignment: Alignment.centerLeft,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          "Subtotal",
                                          style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[600]),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          currencyFormatter.format(
                                            (int.tryParse(itemInputs[i].qtyController.text) ?? 1) *
                                            (double.tryParse(itemInputs[i].hargaController.text) ?? 0.0)
                                          ),
                                          style: GoogleFonts.inter(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                            color: Colors.black87,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            _buildTextField(
                              "Tanggal/Keterangan (Opsional)",
                              itemInputs[i].keteranganController,
                              Icons.notes_rounded,
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 5),
                  OutlinedButton.icon(
                    onPressed: () {
                      setModalState(() {
                        itemInputs.add(ReimbursementItemInput());
                      });
                    },
                    icon: const Icon(Icons.add_rounded),
                    label: const Text("Tambah Baris Item"),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: primaryColor,
                      side: BorderSide(color: primaryColor),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.amber[50],
                      border: Border.all(color: Colors.amber[200]!, width: 1.5),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              "TOTAL ESTIMASI:",
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                color: Colors.amber[900],
                              ),
                            ),
                            Text(
                              currencyFormatter.format(totalAmount),
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.w900,
                                fontSize: 16,
                                color: Colors.amber[950],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          "Terbilang: ${terbilang(totalAmount)}",
                          style: GoogleFonts.inter(
                            fontStyle: FontStyle.italic,
                            fontSize: 11,
                            color: Colors.amber[900],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  _buildTextField(
                    "Catatan / Keterangan Pengajuan",
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
                              if (titleController.text.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text("Isi keperluan / judul!"),
                                  ),
                                );
                                return;
                              }

                              bool itemsValid = true;
                              for (var input in itemInputs) {
                                if (input.spesifikasiController.text.isEmpty ||
                                    input.unitController.text.isEmpty ||
                                    input.qtyController.text.isEmpty ||
                                    input.hargaController.text.isEmpty) {
                                  itemsValid = false;
                                  break;
                                }
                              }
                              if (!itemsValid) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text("Tolong isi spesifikasi, unit, qty, dan harga untuk semua baris item."),
                                  ),
                                );
                                return;
                              }

                              setModalState(() => isSubmitting = true);
                              LoadingDialog.show(context, message: "Mengajukan klaim biaya...");

                              try {
                                final itemsList = itemInputs.map((input) {
                                  final qty = int.tryParse(input.qtyController.text) ?? 1;
                                  final harga = double.tryParse(input.hargaController.text) ?? 0.0;
                                  return {
                                    'spesifikasi': input.spesifikasiController.text,
                                    'unit': input.unitController.text,
                                    'qty': qty,
                                    'estimasi_harga': harga,
                                    'keterangan': input.keteranganController.text,
                                  };
                                }).toList();

                                final res = await ApiService.submitReimbursement(
                                  {
                                    'title': titleController.text,
                                    'amount': totalAmount.toString(),
                                    'description': descController.text.isEmpty ? titleController.text : descController.text,
                                    'divisi': divisiController.text,
                                    'tujuan': selectedTujuan == "Lainnya" ? tujuanLainnyaController.text : selectedTujuan,
                                    'priority': selectedPriority,
                                    'employee_name': isCustomEmployee ? employeeNameController.text : (chosenEmployeeName ?? ""),
                                    'items': jsonEncode(itemsList),
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
          );
        },
      ),
    ).then((_) {
      for (var input in itemInputs) {
        input.dispose();
      }
    });
  }

  Widget _buildTextField(
    String label,
    TextEditingController controller,
    IconData icon, {
    bool isNumber = false,
    int maxLines = 1,
    ValueChanged<String>? onChanged,
  }) {
    return TextField(
      controller: controller,
      keyboardType: isNumber ? TextInputType.number : TextInputType.text,
      maxLines: maxLines,
      onChanged: onChanged,
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

    final priority = (claim['priority'] ?? 'Normal').toString();
    Color priorityColor = Colors.blue;
    if (priority.toLowerCase() == 'urgent') priorityColor = Colors.orange;
    if (priority.toLowerCase() == 'top urgent' || priority.toLowerCase() == 'top_urgent') priorityColor = Colors.red;

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
                  if (status != 'rejected') ...[
                    IconButton(
                      constraints: const BoxConstraints(),
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
                    IconButton(
                      constraints: const BoxConstraints(),
                      padding: EdgeInsets.zero,
                      icon: Icon(
                        Icons.table_view,
                        color: Colors.green,
                        size: 20,
                      ),
                      onPressed: () =>
                          ApiService.launchExcel('reimbursement', claim['id']),
                    ),
                  ],
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
          const SizedBox(height: 10),
          Row(
            children: [
              if (claim['divisi'] != null && claim['divisi'].toString().isNotEmpty) ...[
                Icon(Icons.business_rounded, size: 14, color: Colors.grey[500]),
                const SizedBox(width: 4),
                Text(
                  claim['divisi'].toString(),
                  style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                ),
                const SizedBox(width: 12),
              ],
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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
              if (claim['tujuan'] != null && claim['tujuan'].toString().isNotEmpty) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    "Tujuan: ${claim['tujuan']}",
                    style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600], fontStyle: FontStyle.italic),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
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
          if (claim['employee_name'] != null && claim['employee_name'].toString().isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.person, size: 14, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  claim['employee_name'].toString(),
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: Colors.grey[700],
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 5),
          Text(
            currencyFormatter.format(double.parse(claim['amount'].toString())),
            style: GoogleFonts.outfit(
              fontSize: 18,
              color: primaryColor,
              fontWeight: FontWeight.bold,
            ),
          ),

          if (claim['items'] != null && claim['items'] is List && (claim['items'] as List).isNotEmpty) ...[
            const Divider(height: 30),
            Text(
              "Rincian Item:",
              style: GoogleFonts.inter(
                fontWeight: FontWeight.bold,
                fontSize: 12,
                color: Colors.grey[800],
              ),
            ),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[200]!),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: (claim['items'] as List).length,
                separatorBuilder: (context, idx) => Divider(height: 1, color: Colors.grey[200]),
                itemBuilder: (context, idx) {
                  final item = (claim['items'] as List)[idx];
                  final qty = item['qty'] ?? 1;
                  final price = double.tryParse(item['estimasi_harga'].toString()) ?? 0.0;
                  final subtotal = qty * price;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                item['spesifikasi']?.toString() ?? 'Item Tanpa Nama',
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                  color: Colors.black87,
                                ),
                              ),
                            ),
                            Text(
                              currencyFormatter.format(subtotal),
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                color: Colors.black87,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "$qty ${item['unit'] ?? 'Pcs'} x ${currencyFormatter.format(price)}",
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: Colors.grey[600],
                          ),
                        ),
                        if (item['keterangan'] != null && item['keterangan'].toString().isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            "Tgl/Ket: ${item['keterangan']}",
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              fontStyle: FontStyle.italic,
                              color: Colors.grey[500],
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),
          ],

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
