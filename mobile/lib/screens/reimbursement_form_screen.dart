import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:signature/signature.dart';
import 'dart:io';
import 'dart:convert';
import 'dart:ui' as ui;
import 'package:image_picker/image_picker.dart';
import '../api/api_service.dart';
import '../widgets/loading_overlay.dart';

// ──────────────────────────────────────────────
// Data model for each item row
// ──────────────────────────────────────────────
class _ItemInput {
  final TextEditingController spesifikasiCtrl = TextEditingController();
  final TextEditingController unitCtrl = TextEditingController(text: "Pcs");
  final TextEditingController qtyCtrl = TextEditingController(text: "1");
  final TextEditingController hargaCtrl = TextEditingController(text: "0");
  final TextEditingController keteranganCtrl = TextEditingController();

  void dispose() {
    spesifikasiCtrl.dispose();
    unitCtrl.dispose();
    qtyCtrl.dispose();
    hargaCtrl.dispose();
    keteranganCtrl.dispose();
  }
}

// ──────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────
class ReimbursementFormScreen extends StatefulWidget {
  final List<dynamic> employees;
  final VoidCallback onSubmitted;

  const ReimbursementFormScreen({
    Key? key,
    required this.employees,
    required this.onSubmitted,
  }) : super(key: key);

  @override
  State<ReimbursementFormScreen> createState() =>
      _ReimbursementFormScreenState();
}

class _ReimbursementFormScreenState extends State<ReimbursementFormScreen>
    with SingleTickerProviderStateMixin {
  static const Color _primary = Color(0xFF800000);

  late TabController _tabController;
  final _currFmt = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  // ── Form controllers ──
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _divisiCtrl = TextEditingController(text: "Operasional");
  final _empNameCtrl = TextEditingController();
  final _tujuanLainnyaCtrl = TextEditingController();

  String _selectedTujuan = "";
  String _selectedPriority = "Normal";
  bool _isCustomEmployee = false;
  String? _chosenEmployeeName;
  List<_ItemInput> _items = [_ItemInput()];
  List<XFile> _pickedFiles = [];
  bool _isSubmitting = false;

  // Signature
  final SignatureController _signatureCtrl = SignatureController(
    penStrokeWidth: 2.5,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
    exportPenColor: Colors.black,
  );
  String? _signatureBase64;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _divisiCtrl.dispose();
    _empNameCtrl.dispose();
    _tujuanLainnyaCtrl.dispose();
    _signatureCtrl.dispose();
    for (final i in _items) {
      i.dispose();
    }
    super.dispose();
  }

  // ── Helpers ──
  double get _totalAmount => _items.fold(0.0, (sum, i) {
        final qty = int.tryParse(i.qtyCtrl.text) ?? 1;
        final harga = double.tryParse(i.hargaCtrl.text) ?? 0.0;
        return sum + (qty * harga);
      });

  String _employeeName() {
    if (_isCustomEmployee) return _empNameCtrl.text;
    return _chosenEmployeeName ?? "";
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

  // ── Submit ──
  Future<void> _submit() async {
    if (_titleCtrl.text.isEmpty) {
      _snack("Isi keperluan / judul!", Colors.red);
      return;
    }
    for (final i in _items) {
      if (i.spesifikasiCtrl.text.isEmpty ||
          i.unitCtrl.text.isEmpty ||
          i.qtyCtrl.text.isEmpty ||
          i.hargaCtrl.text.isEmpty) {
        _snack("Tolong isi spesifikasi, unit, qty, dan harga untuk semua baris item.", Colors.red);
        return;
      }
    }

    // Capture signature if drawn
    if (_signatureCtrl.isNotEmpty) {
      final image = await _signatureCtrl.toImage(
        width: 400,
        height: 150,
      );
      if (image != null) {
        final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
        if (byteData != null) {
          final bytes = byteData.buffer.asUint8List();
          _signatureBase64 = "data:image/png;base64,${base64Encode(bytes)}";
        }
      }
    }

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Mengajukan klaim biaya...");

    try {
      final itemsList = _items.map((i) {
        final qty = int.tryParse(i.qtyCtrl.text) ?? 1;
        final harga = double.tryParse(i.hargaCtrl.text) ?? 0.0;
        return {
          'spesifikasi': i.spesifikasiCtrl.text,
          'unit': i.unitCtrl.text,
          'qty': qty,
          'estimasi_harga': harga,
          'keterangan': i.keteranganCtrl.text,
        };
      }).toList();

      final res = await ApiService.submitReimbursement(
        {
          'title': _titleCtrl.text,
          'amount': _totalAmount.toString(),
          'description': _descCtrl.text.isEmpty ? _titleCtrl.text : _descCtrl.text,
          'divisi': _divisiCtrl.text,
          'tujuan': _selectedTujuan == "Lainnya" ? _tujuanLainnyaCtrl.text : _selectedTujuan,
          'priority': _selectedPriority,
          'employee_name': _employeeName(),
          'items': jsonEncode(itemsList),
          if (_signatureBase64 != null) 'signature': _signatureBase64!,
        },
        filePaths: _pickedFiles.map((e) => e.path).toList(),
      );

      LoadingDialog.hide(context);

      if (mounted) {
        if (res['status'] == 'success') {
          widget.onSubmitted();
          Navigator.pop(context);
          _snack("Klaim berhasil diajukan!", Colors.green);
        } else {
          setState(() => _isSubmitting = false);
          _snack("Gagal: ${res['message'] ?? 'Status Error'}", Colors.red);
        }
      }
    } catch (e) {
      LoadingDialog.hide(context);
      setState(() => _isSubmitting = false);
      _snack("Error: ${e.toString()}", Colors.red);
    }
  }

  void _snack(String msg, Color bg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: bg),
    );
  }

  // ─────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBFBFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
        title: Text(
          "Formulir Pengajuan Dana",
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: _primary,
          indicatorWeight: 3,
          labelColor: _primary,
          unselectedLabelColor: Colors.grey[600],
          labelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
          unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w500, fontSize: 13),
          tabs: const [
            Tab(
              icon: Icon(Icons.edit_document, size: 18),
              text: "Form Pengajuan",
            ),
            Tab(
              icon: Icon(Icons.preview, size: 18),
              text: "Live Preview",
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildFormTab(),
          _buildPreviewTab(),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════
  //  TAB 1 — FORM PENGAJUAN
  // ═══════════════════════════════════════════════════════
  Widget _buildFormTab() {
    return SingleChildScrollView(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 100,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey[200]!),
            ),
            child: Row(
              children: [
                Image.asset('assets/images/artacom.png', height: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "FORM PENGAJUAN DANA",
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        "PT ARTACOMINDO JEJARING NUSA",
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey[700],
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Section: Nama Pemohon ──
          _sectionTitle("NAMA PEMOHON / KARYAWAN"),
          const SizedBox(height: 8),
          _isCustomEmployee
              ? _textField("Nama Pemohon (Manual)", _empNameCtrl, Icons.person_rounded)
              : DropdownButtonFormField<String>(
                  value: _chosenEmployeeName,
                  decoration: _dropdownDecor("Pilih Karyawan", Icons.person_outline_rounded),
                  items: [
                    const DropdownMenuItem(value: null, child: Text("-- Pilih Karyawan --")),
                    ...widget.employees.map((emp) => DropdownMenuItem(
                          value: emp['name'].toString(),
                          child: Text(emp['name'].toString()),
                        )),
                  ],
                  onChanged: (val) {
                    setState(() {
                      _chosenEmployeeName = val;
                      if (val != null) {
                        try {
                          final emp = widget.employees.firstWhere(
                            (e) => e['name'].toString() == val,
                          );
                          if (emp['role'] != null) {
                            _divisiCtrl.text = emp['role']['name'] ?? "Operasional";
                          }
                        } catch (_) {
                          // Employee not found, ignore
                        }
                      }
                    });
                  },
                ),
          Row(
            children: [
              Checkbox(
                value: _isCustomEmployee,
                activeColor: _primary,
                onChanged: (val) => setState(() {
                  _isCustomEmployee = val ?? false;
                  if (!_isCustomEmployee) {
                    _chosenEmployeeName = null;
                  } else {
                    _empNameCtrl.clear();
                  }
                }),
              ),
              Text(
                "Tulis Nama Manual / Custom",
                style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[700]),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // ── Section: Keperluan / Judul ──
          _sectionTitle("KEPERLUAN / JUDUL"),
          const SizedBox(height: 8),
          _textField("Contoh: Pembelian Laptop Kantor Baru", _titleCtrl, Icons.title_rounded),
          const SizedBox(height: 16),

          // ── Section: Divisi ──
          _sectionTitle("DIVISI (DIV.)"),
          const SizedBox(height: 8),
          _textField("Operasional", _divisiCtrl, Icons.business_rounded),
          const SizedBox(height: 16),

          // ── Row: Tujuan + Prioritas ──
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionTitle("TUJUAN PENGADAAN"),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedTujuan,
                      decoration: _dropdownDecor("Tujuan", Icons.info_outline_rounded),
                      isExpanded: true,
                      items: const [
                        DropdownMenuItem(value: "", child: Text("Tidak Ada / Kosong")),
                        DropdownMenuItem(value: "Pengadaan Baru", child: Text("Pengadaan Baru")),
                        DropdownMenuItem(value: "Dari Gudang", child: Text("Dari Gudang")),
                        DropdownMenuItem(value: "Lainnya", child: Text("Lainnya")),
                      ],
                      onChanged: (val) => setState(() => _selectedTujuan = val!),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionTitle("PRIORITAS"),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedPriority,
                      decoration: _dropdownDecor("Prioritas", Icons.warning_amber_rounded),
                      isExpanded: true,
                      items: const [
                        DropdownMenuItem(value: "Normal", child: Text("Normal")),
                        DropdownMenuItem(value: "Urgent", child: Text("Urgent")),
                        DropdownMenuItem(value: "Top Urgent", child: Text("Top Urgent")),
                      ],
                      onChanged: (val) => setState(() => _selectedPriority = val!),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (_selectedTujuan == "Lainnya") ...[
            const SizedBox(height: 12),
            _textField("Tujuan Lainnya", _tujuanLainnyaCtrl, Icons.edit_note_rounded),
          ],
          const SizedBox(height: 24),

          // ═══════════════════════════════════
          //  ITEM BARANG / JASA
          // ═══════════════════════════════════
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _sectionTitle("ITEM BARANG / JASA"),
              TextButton.icon(
                onPressed: () => setState(() => _items.add(_ItemInput())),
                icon: Icon(Icons.add_circle_outline, color: _primary, size: 18),
                label: Text(
                  "+ Tambah Baris",
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: _primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ..._buildItemCards(),
          const SizedBox(height: 16),

          // ── TOTAL ESTIMASI ──
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.amber[50],
              border: Border.all(color: Colors.amber[300]!, width: 1.5),
              borderRadius: BorderRadius.circular(14),
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
                      _currFmt.format(_totalAmount),
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w900,
                        fontSize: 17,
                        color: Colors.amber[950],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  "Terbilang: ${_terbilang(_totalAmount)}",
                  style: GoogleFonts.inter(
                    fontStyle: FontStyle.italic,
                    fontSize: 11,
                    color: Colors.amber[800],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── Catatan ──
          _sectionTitle("CATATAN / KETERANGAN PENGAJUAN"),
          const SizedBox(height: 8),
          _textField("Catatan pengajuan (opsional)", _descCtrl, Icons.description_rounded, maxLines: 3),
          const SizedBox(height: 24),

          // ── Tanda Tangan Digital ──
          _sectionTitle("TANDA TANGAN PENGAJU (DIAJUKAN OLEH)"),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey[300]!),
            ),
            child: Column(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                  child: Signature(
                    controller: _signatureCtrl,
                    height: 150,
                    backgroundColor: Colors.grey[50]!,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "Tanda Tangan Digital",
                        style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                      ),
                      TextButton(
                        onPressed: () {
                          _signatureCtrl.clear();
                          setState(() => _signatureBase64 = null);
                        },
                        child: Text(
                          "Bersihkan",
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: _primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 14, color: Colors.grey[500]),
                const SizedBox(width: 6),
                Text(
                  "Tanda tangan digital wajib dicantumkan sebelum mengajukan.",
                  style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[500]),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── Lampiran Bukti / Nota ──
          _sectionTitle("BUKTI NOTA / LAMPIRAN DUKUNGAN"),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _isSubmitting ? null : _pickImages,
            child: Container(
              height: 150,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.grey[300]!),
              ),
              child: _pickedFiles.isNotEmpty
                  ? ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.all(8),
                      itemCount: _pickedFiles.length,
                      itemBuilder: (context, i) => Container(
                        width: 130,
                        margin: const EdgeInsets.only(right: 10),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.file(File(_pickedFiles[i].path), fit: BoxFit.cover),
                        ),
                      ),
                    )
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_a_photo_outlined, size: 36, color: _primary),
                        const SizedBox(height: 8),
                        Text(
                          "Klik untuk upload foto nota/resi",
                          style: GoogleFonts.inter(color: Colors.grey[500], fontSize: 12),
                        ),
                        Text(
                          "Bisa melampirkan lebih dari 1 gambar",
                          style: GoogleFonts.inter(color: Colors.grey[400], fontSize: 10),
                        ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 32),

          // ── Buttons ──
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _isSubmitting ? null : () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.grey[700],
                    side: BorderSide(color: Colors.grey[300]!),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text("Batal", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : _submit,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded, size: 18, color: Colors.white),
                  label: Text(
                    "Kirim Pengajuan",
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _primary,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  // ── item cards builder ──
  List<Widget> _buildItemCards() {
    return List.generate(_items.length, (i) {
      final item = _items[i];
      return Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey[200]!, width: 1.5),
        ),
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          "NO ${i + 1}",
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.w900,
                            fontSize: 10,
                            color: _primary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        "Baris Item #${i + 1}",
                        style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ],
                  ),
                  if (_items.length > 1)
                    InkWell(
                      onTap: () => setState(() {
                        _items[i].dispose();
                        _items.removeAt(i);
                      }),
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.red[50],
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.close, size: 16, color: Colors.red[600]),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  _textField("Spesifikasi / Nama Barang Jasa", item.spesifikasiCtrl, Icons.shopping_bag_outlined),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: _textField("Unit", item.unitCtrl, Icons.category_outlined),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _textField("Qty", item.qtyCtrl, Icons.format_list_numbered, isNumber: true),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: _textField("Harga Satuan", item.hargaCtrl, Icons.payments_outlined, isNumber: true),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: Container(
                          height: 52,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: Colors.amber[50],
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.amber[200]!),
                          ),
                          alignment: Alignment.centerLeft,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text("Subtotal", style: GoogleFonts.inter(fontSize: 9, color: Colors.grey[600])),
                              Text(
                                _currFmt.format(
                                  (int.tryParse(item.qtyCtrl.text) ?? 1) *
                                      (double.tryParse(item.hargaCtrl.text) ?? 0.0),
                                ),
                                style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.amber[900]),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _textField("Tanggal/Keterangan (Opsional)", item.keteranganCtrl, Icons.notes_rounded),
                ],
              ),
            ),
          ],
        ),
      );
    });
  }

  // ═══════════════════════════════════════════════════════
  //  TAB 2 — LIVE PREVIEW (Excel-like Document)
  // ═══════════════════════════════════════════════════════
  Widget _buildPreviewTab() {
    final now = DateTime.now();
    final dateStr = DateFormat('dd/MM/yyyy').format(now);
    final noStr = "REIM/${DateFormat('yyyyMMdd').format(now)}/DRAFT";

    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          // Auto-update badge
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.blue[100]!),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.blue[50],
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    "Auto Update",
                    style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.blue[700]),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    "LIVE PREVIEW (TAMPILAN EXCEL / CETAK)",
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Colors.grey[600],
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Document preview — scrollable horizontally
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Container(
              width: 520, // fixed width for document look
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey[300]!),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: _buildDocumentSheet(dateStr, noStr),
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  // ── Document Sheet (Excel-like) ──
  Widget _buildDocumentSheet(String dateStr, String noStr) {
    final empName = _employeeName();
    final title = _titleCtrl.text;
    final divisi = _divisiCtrl.text;
    final tujuan = _selectedTujuan == "Lainnya" ? _tujuanLainnyaCtrl.text : _selectedTujuan;
    final total = _totalAmount;

    return Column(
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
                Image.asset('assets/images/artacom.png', height: 40),
                const SizedBox(height: 4),
                Text(
                  "PT ARTACOMINDO JEJARING NUSA",
                  style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 9, letterSpacing: 0.3),
                ),
              ],
            ),
            SizedBox(
              width: 150,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _headerField("Date", dateStr),
                  const SizedBox(height: 4),
                  _headerField("No", noStr),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // ── TITLE ──
        Center(
          child: Text(
            "PENGAJUAN UANG MUKA / PERMINTAAN DANA",
            style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 0.5),
          ),
        ),
        const SizedBox(height: 8),

        // ── PRIORITY CHECKBOXES ──
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _priorityBox("NORMAL", _selectedPriority.toLowerCase() == "normal"),
                _priorityBox("URGENT", _selectedPriority.toLowerCase() == "urgent"),
                _priorityBox("TOP URGENT",
                    _selectedPriority.toLowerCase() == "top urgent" ||
                        _selectedPriority.toLowerCase() == "top_urgent"),
              ],
            ),
          ],
        ),
        const SizedBox(height: 8),

        // ── INFO FIELDS ──
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                children: [
                  _infoRow("Nama", empName.isEmpty ? "—" : empName),
                  const SizedBox(height: 4),
                  _infoRow("Div.", divisi.isEmpty ? "—" : divisi),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                children: [
                  _infoRow("Tujuan", title.isEmpty ? "—" : title),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      _tujuanBox("Pengadaan Baru", tujuan.toLowerCase().contains("pengadaan")),
                      const SizedBox(width: 8),
                      _tujuanBox("Dari Gudang", tujuan.toLowerCase().contains("gudang")),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // ── ITEMS TABLE ──
        Table(
          border: TableBorder.all(color: Colors.black, width: 1.2),
          columnWidths: const {
            0: FixedColumnWidth(28),
            1: FlexColumnWidth(3),
            2: FixedColumnWidth(40),
            3: FixedColumnWidth(40),
            4: FlexColumnWidth(2),
            5: FlexColumnWidth(2),
          },
          children: [
            // Header
            TableRow(
              decoration: const BoxDecoration(color: Color(0xFFFFFFCC)),
              children: [
                _tCell("No.", bold: true, center: true),
                _tCell("Spesifikasi Barang / Jasa", bold: true),
                _tCell("Unit", bold: true, center: true),
                _tCell("Qty", bold: true, center: true),
                _tCell("Estimasi Harga", bold: true, right: true),
                _tCell("Tanggal/Keterangan", bold: true),
              ],
            ),
            // Data rows
            ..._items.asMap().entries.map((entry) {
              final idx = entry.key;
              final item = entry.value;
              final qty = int.tryParse(item.qtyCtrl.text) ?? 0;
              final harga = double.tryParse(item.hargaCtrl.text) ?? 0;
              return TableRow(
                children: [
                  _tCell("${idx + 1}", center: true),
                  _tCell(item.spesifikasiCtrl.text.isEmpty ? "—" : item.spesifikasiCtrl.text),
                  _tCell(item.unitCtrl.text.isEmpty ? "—" : item.unitCtrl.text, center: true),
                  _tCell("$qty", center: true),
                  _tCell(_currFmt.format(harga), right: true),
                  _tCell(item.keteranganCtrl.text),
                ],
              );
            }),
            // Pad empty rows to at least 5
            ...List.generate(
              (_items.length < 5 ? 5 - _items.length : 0),
              (i) => TableRow(
                children: [
                  _tCell("${_items.length + i + 1}", center: true, gray: true),
                  _tCell(""),
                  _tCell(""),
                  _tCell(""),
                  _tCell(""),
                  _tCell(""),
                ],
              ),
            ),
            // TOTAL
            TableRow(
              children: [
                TableCell(
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    child: Text(
                      "T O T A L",
                      textAlign: TextAlign.right,
                      style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 8, letterSpacing: 2),
                    ),
                  ),
                ),
                // Merge: occupy cols 1-3 as part of total label via empty cells
                _tCell(""),
                _tCell(""),
                _tCell(""),
                TableCell(
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    color: const Color(0xFFFFFFCC),
                    child: Text(
                      _currFmt.format(total),
                      textAlign: TextAlign.right,
                      style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 9),
                    ),
                  ),
                ),
                _tCell(""),
              ],
            ),
          ],
        ),
        const SizedBox(height: 8),

        // ── TERBILANG ──
        Text("Terbilang", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontStyle: FontStyle.italic, fontSize: 8)),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.black, width: 1.2),
          ),
          child: Text(
            _terbilang(total),
            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 8),
          ),
        ),
        const SizedBox(height: 12),

        // ── SIGNATURE TABLE ──
        Table(
          border: TableBorder.all(color: Colors.black, width: 1.2),
          children: [
            TableRow(
              children: [
                _tCell("DIRUT", bold: true, center: true),
                _tCell("FINANCE", bold: true, center: true),
                _tCell("UNIT HEAD", bold: true, center: true),
                _tCell("REQUESTER", bold: true, center: true),
              ],
            ),
            TableRow(
              children: [
                // DIRUT
                _sigCell("— Belum Disetujui —"),
                // FINANCE
                _sigCell("— Belum Diverifikasi —"),
                // UNIT HEAD
                _sigCell("— Belum Diverifikasi —"),
                // REQUESTER
                TableCell(
                  child: Container(
                    height: 50,
                    padding: const EdgeInsets.all(4),
                    alignment: Alignment.center,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (_signatureBase64 != null)
                          Image.memory(
                            base64Decode(_signatureBase64!.split(',').last),
                            height: 28,
                            fit: BoxFit.contain,
                          )
                        else if (_signatureCtrl.isNotEmpty)
                          Text("✍ TTD Ready", style: GoogleFonts.inter(fontSize: 7, color: Colors.green[700], fontWeight: FontWeight.bold))
                        else
                          Text("— Belum TTD —", style: GoogleFonts.inter(fontSize: 7, color: Colors.grey[400], fontStyle: FontStyle.italic)),
                        const SizedBox(height: 2),
                        Text(
                          empName.isEmpty ? "—" : empName,
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 7),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            TableRow(
              children: [
                _tCell(""),  // no border simulation — left two cols
                _tCell(""),
                _tCell("Posting\nAccounting", bold: true, center: true, fontSize: 7),
                _tCell("PROCUREMENT", bold: true, center: true, fontSize: 7),
              ],
            ),
          ],
        ),
      ],
    );
  }

  // ─────────────────────────────────────────────────────
  // Helper Widgets
  // ─────────────────────────────────────────────────────
  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: Colors.grey[800],
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _textField(
    String label,
    TextEditingController ctrl,
    IconData icon, {
    bool isNumber = false,
    int maxLines = 1,
  }) {
    return TextField(
      controller: ctrl,
      keyboardType: isNumber ? TextInputType.number : TextInputType.text,
      maxLines: maxLines,
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: GoogleFonts.inter(fontSize: 13),
        prefixIcon: Icon(icon, color: _primary, size: 20),
        filled: true,
        fillColor: Colors.grey[50],
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey[200]!, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: _primary.withOpacity(0.5), width: 1.5),
        ),
      ),
    );
  }

  InputDecoration _dropdownDecor(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      labelStyle: GoogleFonts.inter(fontSize: 13),
      prefixIcon: Icon(icon, color: _primary, size: 20),
      filled: true,
      fillColor: Colors.grey[50],
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey[200]!, width: 1),
      ),
    );
  }

  // ── Document helpers ──
  Widget _headerField(String label, String value) {
    return Row(
      children: [
        Text("$label : ", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 8)),
        Expanded(
          child: Container(
            padding: const EdgeInsets.only(bottom: 2),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.black, width: 0.8)),
            ),
            child: Text(value, style: GoogleFonts.inter(fontSize: 8)),
          ),
        ),
      ],
    );
  }

  Widget _priorityBox(String label, bool checked) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.black, width: 0.8),
            ),
            alignment: Alignment.center,
            child: checked
                ? Text("✓", style: GoogleFonts.inter(fontSize: 7, fontWeight: FontWeight.w900))
                : null,
          ),
          const SizedBox(width: 4),
          Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 8)),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Row(
      children: [
        SizedBox(
          width: 40,
          child: Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 8)),
        ),
        Text(" : ", style: GoogleFonts.inter(fontSize: 8)),
        Expanded(
          child: Container(
            padding: const EdgeInsets.only(bottom: 2),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.grey, width: 0.5, style: BorderStyle.solid)),
            ),
            child: Text(
              value,
              style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 8),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
      ],
    );
  }

  Widget _tujuanBox(String label, bool checked) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.black, width: 0.8),
            color: checked ? Colors.black : null,
          ),
          alignment: Alignment.center,
          child: checked
              ? const Text("✓", style: TextStyle(fontSize: 6, color: Colors.white, fontWeight: FontWeight.w900))
              : null,
        ),
        const SizedBox(width: 3),
        Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 7)),
      ],
    );
  }

  Widget _tCell(String text, {bool bold = false, bool center = false, bool right = false, bool gray = false, double fontSize = 8}) {
    return TableCell(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
        child: Text(
          text,
          textAlign: center ? TextAlign.center : (right ? TextAlign.right : TextAlign.left),
          style: GoogleFonts.inter(
            fontWeight: bold ? FontWeight.bold : FontWeight.normal,
            fontSize: fontSize,
            color: gray ? Colors.grey[400] : Colors.black,
          ),
        ),
      ),
    );
  }

  Widget _sigCell(String text) {
    return TableCell(
      child: Container(
        height: 50,
        alignment: Alignment.center,
        child: Text(
          text,
          style: GoogleFonts.inter(fontSize: 7, color: Colors.grey[400], fontStyle: FontStyle.italic),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  // ── Image picker ──
  Future<void> _pickImages() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text("Kamera"),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text("Galeri"),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    final picker = ImagePicker();
    if (source == ImageSource.gallery) {
      final images = await picker.pickMultiImage(imageQuality: 50);
      if (images.isNotEmpty) setState(() => _pickedFiles = images);
    } else {
      final img = await picker.pickImage(source: source, imageQuality: 50);
      if (img != null) setState(() => _pickedFiles = [img]);
    }
  }
}
