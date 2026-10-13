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
import '../widgets/animated_helpers.dart';
import 'camera_capture_screen.dart';

// ──────────────────────────────────────────────
// Data model for each item row
// ──────────────────────────────────────────────
class _FundItemInput {
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
// Main Screen: Formulir & Live Preview Pengajuan Dana
// ──────────────────────────────────────────────
class FundRequestFormScreen extends StatefulWidget {
  final List<dynamic> employees;
  final VoidCallback onSubmitted;
  final Map<String, dynamic>? existingRequest;

  const FundRequestFormScreen({
    Key? key,
    required this.employees,
    required this.onSubmitted,
    this.existingRequest,
  }) : super(key: key);

  @override
  State<FundRequestFormScreen> createState() => _FundRequestFormScreenState();
}

class _FundRequestFormScreenState extends State<FundRequestFormScreen>
    with TickerProviderStateMixin {
  static const Color _primary = Color(0xFF800000);

  late TabController _tabController;
  final _currFmt = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  // ── Form controllers ──
  final _titleCtrl = TextEditingController();
  final _divisiCtrl = TextEditingController(text: "Operasional");
  final _empNameCtrl = TextEditingController();
  final _tujuanLainnyaCtrl = TextEditingController();

  String _selectedTujuan = "Pengadaan Baru";
  String _selectedPriority = "Normal";
  bool _isCustomEmployee = false;
  String? _chosenEmployeeName;
  List<_FundItemInput> _items = [_FundItemInput()];
  List<XFile> _pickedFiles = [];
  bool _isSubmitting = false;
  bool _isLoadingProfile = true;
  Map<String, dynamic>? _userProfile;

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
    _loadUserProfile();
    _initExistingRequest();
  }

  void _initExistingRequest() {
    if (widget.existingRequest == null) return;
    final r = widget.existingRequest!;
    _titleCtrl.text = r['title']?.toString() ?? r['reason']?.toString() ?? '';
    _divisiCtrl.text = r['divisi']?.toString() ?? 'Operasional';

    final prio = r['priority']?.toString() ?? 'Normal';
    if (['Normal', 'Urgent', 'Top Urgent'].contains(prio)) {
      _selectedPriority = prio;
    }

    final tuj = r['tujuan']?.toString() ?? 'Pengadaan Baru';
    if (['Pengadaan Baru', 'Dari Gudang', 'Kasbon / Operasional'].contains(tuj)) {
      _selectedTujuan = tuj;
    } else if (tuj.isNotEmpty) {
      _selectedTujuan = 'Lainnya';
      _tujuanLainnyaCtrl.text = tuj;
    }

    if (r['employee_name'] != null && r['employee_name'].toString().isNotEmpty) {
      _chosenEmployeeName = r['employee_name'].toString();
      _empNameCtrl.text = r['employee_name'].toString();
    }

    if (r['signature'] != null && r['signature'].toString().isNotEmpty) {
      _signatureBase64 = r['signature'].toString();
    }

    dynamic rawItems = r['items'];
    if (rawItems is String) {
      try {
        rawItems = jsonDecode(rawItems);
      } catch (_) {}
    }
    if (rawItems is List && rawItems.isNotEmpty) {
      _items = rawItems.map<_FundItemInput>((it) {
        final input = _FundItemInput();
        input.spesifikasiCtrl.text = it['spesifikasi']?.toString() ?? it['name']?.toString() ?? '';
        input.unitCtrl.text = it['unit']?.toString() ?? 'Pcs';
        input.qtyCtrl.text = (it['qty'] ?? 1).toString();
        input.hargaCtrl.text = (it['estimasi_harga'] ?? it['price'] ?? 0).toString();
        input.keteranganCtrl.text = it['keterangan']?.toString() ?? '';
        return input;
      }).toList();
    }
  }

  Future<void> _loadUserProfile() async {
    try {
      final profile = await ApiService.getProfile();
      if (mounted) {
        setState(() {
          _userProfile = profile;
          if (profile != null) {
            _chosenEmployeeName = profile['name'];
            if (profile['department'] != null &&
                profile['department'].toString().isNotEmpty) {
              _divisiCtrl.text = profile['department'];
            } else if (profile['role'] != null) {
              _divisiCtrl.text = profile['role']['name'] ?? "Operasional";
            }
          }
          _isLoadingProfile = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingProfile = false);
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _titleCtrl.dispose();
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
    return _chosenEmployeeName ?? _userProfile?['name'] ?? "";
  }

  String _terbilang(double nominal) {
    if (nominal <= 0) return "Nol Rupiah";
    final angka = [
      "",
      "Satu",
      "Dua",
      "Tiga",
      "Empat",
      "Lima",
      "Enam",
      "Tujuh",
      "Delapan",
      "Sembilan",
      "Sepuluh",
      "Sebelas"
    ];
    String konversi(int n) {
      if (n < 12) return angka[n];
      if (n < 20) return "${konversi(n - 10)} Belas";
      if (n < 100) return "${konversi(n ~/ 10)} Puluh ${konversi(n % 10)}";
      if (n < 200) return "Seratus ${konversi(n - 100)}";
      if (n < 1000) return "${konversi(n ~/ 100)} Ratus ${konversi(n % 100)}";
      if (n < 2000) return "Seribu ${konversi(n - 1000)}";
      if (n < 1000000) return "${konversi(n ~/ 1000)} Ribu ${konversi(n % 1000)}";
      if (n < 1000000000) {
        return "${konversi(n ~/ 1000000)} Juta ${konversi(n % 1000000)}";
      }
      if (n < 1000000000000) {
        return "${konversi(n ~/ 1000000000)} Milyar ${konversi(n % 1000000000)}";
      }
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

  // ── Validation & Open Preview Modal ──
  Future<void> _validateAndShowPreview() async {
    final empName = _employeeName().trim();
    if (empName.isEmpty) {
      _snack("Nama pemohon wajib diisi!", Colors.red);
      return;
    }

    if (_titleCtrl.text.trim().isEmpty) {
      _snack("Keperluan / Judul pengajuan dana wajib diisi!", Colors.red);
      return;
    }

    if (_items.isEmpty) {
      _snack("Minimal harus menyertakan 1 baris item!", Colors.red);
      return;
    }

    for (int idx = 0; idx < _items.length; idx++) {
      final i = _items[idx];
      final spesifikasi = i.spesifikasiCtrl.text.trim();
      final qty = int.tryParse(i.qtyCtrl.text) ?? 0;
      final harga = double.tryParse(i.hargaCtrl.text) ?? 0.0;

      if (spesifikasi.isEmpty) {
        _snack("Spesifikasi barang/jasa baris #${idx + 1} wajib diisi!", Colors.red);
        return;
      }
      if (qty <= 0) {
        _snack("Quantity baris #${idx + 1} harus lebih dari 0!", Colors.red);
        return;
      }
      if (harga <= 0) {
        _snack("Estimasi harga baris #${idx + 1} harus lebih dari Rp 0!", Colors.red);
        return;
      }
    }

    // Capture signature if drawn
    if (_signatureCtrl.isNotEmpty) {
      final image = await _signatureCtrl.toImage(width: 400, height: 150);
      if (image != null) {
        final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
        if (byteData != null) {
          final bytes = byteData.buffer.asUint8List();
          _signatureBase64 = "data:image/png;base64,${base64Encode(bytes)}";
        }
      }
    }

    if (_signatureCtrl.isEmpty && _signatureBase64 == null) {
      _snack("Tanda tangan digital pengaju wajib dibubuhkan!", Colors.red);
      return;
    }

    if (!mounted) return;
    _showPreviewModal();
  }

  // ── Submit API ──
  Future<void> _submit() async {
    final bool isEditing = widget.existingRequest != null;
    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: isEditing ? "Menyimpan perubahan pengajuan dana..." : "Mengirim pengajuan dana...");

    try {
      final itemsList = _items.map((i) {
        final qty = int.tryParse(i.qtyCtrl.text) ?? 1;
        final harga = double.tryParse(i.hargaCtrl.text) ?? 0.0;
        return {
          'spesifikasi': i.spesifikasiCtrl.text.trim(),
          'unit': i.unitCtrl.text.trim().isEmpty ? "Pcs" : i.unitCtrl.text.trim(),
          'qty': qty,
          'estimasi_harga': harga,
          'keterangan': i.keteranganCtrl.text.trim(),
        };
      }).toList();

      final payload = {
        'employee_name': _employeeName(),
        'title': _titleCtrl.text.trim(),
        'reason': _titleCtrl.text.trim(),
        'divisi': _divisiCtrl.text.trim().isEmpty ? "Operasional" : _divisiCtrl.text.trim(),
        'tujuan': _selectedTujuan == "Lainnya"
            ? _tujuanLainnyaCtrl.text.trim()
            : _selectedTujuan,
        'priority': _selectedPriority,
        'amount': _totalAmount.toString(),
        'items': jsonEncode(itemsList),
        if (_signatureBase64 != null) 'signature': _signatureBase64!,
      };

      final files = _pickedFiles.isNotEmpty ? _pickedFiles.map((e) => e.path).toList() : null;

      final res = isEditing
          ? await ApiService.updateFundRequest(widget.existingRequest!['id'], payload, filePaths: files)
          : await ApiService.submitFundRequest(
              payload,
              filePaths: files,
            );

      if (!mounted) return;
      LoadingDialog.hide(context);

      if (res['status'] == 'success') {
        widget.onSubmitted();
        Navigator.pop(context); // Close preview modal if opened
        Navigator.pop(context); // Close form screen
        _snack(isEditing ? "Pengajuan dana berhasil diperbarui!" : "Pengajuan dana berhasil dikirim! Menunggu persetujuan.", Colors.green);
      } else {
        setState(() => _isSubmitting = false);
        _snack("Gagal: ${res['message'] ?? 'Terjadi kesalahan sistem'}", Colors.red);
      }
    } catch (e) {
      if (mounted) {
        LoadingDialog.hide(context);
        setState(() => _isSubmitting = false);
        _snack("Error: ${e.toString()}", Colors.red);
      }
    }
  }

  void _showPreviewModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          height: MediaQuery.of(context).size.height * 0.90,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: const BoxDecoration(
                  color: _primary,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.account_balance_wallet_rounded,
                          color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Preview & Konfirmasi Pengajuan Dana",
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            "Periksa kembali data uang muka sebelum diajukan",
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
                          color: Colors.amber[50],
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.amber[300]!),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_rounded, size: 18, color: Colors.amber[900]),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                "Informasi Uang Muka / Cash Advance: Pengajuan ini adalah permohonan dana sebelum belanja. Dokumen nota / struk resmi (SPJ) akan diserahkan setelah uang dibelanjakan.",
                                style: GoogleFonts.inter(
                                    fontSize: 11, color: Colors.amber[950], height: 1.3),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Applicant summary
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.grey[50],
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.grey[200]!),
                        ),
                        child: Column(
                          children: [
                            _previewRow("Pemohon", _employeeName()),
                            const Divider(height: 14),
                            _previewRow("Keperluan", _titleCtrl.text),
                            const Divider(height: 14),
                            _previewRow("Divisi", _divisiCtrl.text),
                            const Divider(height: 14),
                            _previewRow("Tujuan Pengadaan",
                                _selectedTujuan == "Lainnya" ? _tujuanLainnyaCtrl.text : _selectedTujuan),
                            const Divider(height: 14),
                            _previewRow("Prioritas", _selectedPriority),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Total & Terbilang
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
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  "TOTAL ESTIMASI DANA:",
                                  style: GoogleFonts.inter(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                    color: Colors.amber[900],
                                  ),
                                ),
                                Text(
                                  _currFmt.format(_totalAmount),
                                  style: GoogleFonts.outfit(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 18,
                                    color: _primary,
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
                                color: Colors.amber[900],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Item breakdown
                      Text(
                        "RINCIAN ITEM BARANG / JASA (${_items.length} ITEM):",
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Colors.grey[700],
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      ..._items.asMap().entries.map((entry) {
                        final idx = entry.key;
                        final it = entry.value;
                        final qty = int.tryParse(it.qtyCtrl.text) ?? 1;
                        final harga = double.tryParse(it.hargaCtrl.text) ?? 0.0;
                        final subtotal = qty * harga;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.grey[200]!),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 24,
                                height: 24,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: Colors.grey[100],
                                  shape: BoxShape.circle,
                                ),
                                child: Text(
                                  "${idx + 1}",
                                  style: GoogleFonts.inter(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.grey[700]),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      it.spesifikasiCtrl.text.isEmpty
                                          ? "Item #${idx + 1}"
                                          : it.spesifikasiCtrl.text,
                                      style: GoogleFonts.inter(
                                          fontWeight: FontWeight.bold, fontSize: 12),
                                    ),
                                    Text(
                                      "$qty ${it.unitCtrl.text} x ${_currFmt.format(harga)}",
                                      style: GoogleFonts.inter(
                                          fontSize: 11, color: Colors.grey[600]),
                                    ),
                                    if (it.keteranganCtrl.text.isNotEmpty)
                                      Text(
                                        "Ket: ${it.keteranganCtrl.text}",
                                        style: GoogleFonts.inter(
                                            fontSize: 10,
                                            fontStyle: FontStyle.italic,
                                            color: Colors.grey[500]),
                                      ),
                                  ],
                                ),
                              ),
                              Text(
                                _currFmt.format(subtotal),
                                style: GoogleFonts.inter(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                    color: Colors.grey[900]),
                              ),
                            ],
                          ),
                        );
                      }),
                      const SizedBox(height: 16),

                      // Proposal Attachment
                      if (_pickedFiles.isNotEmpty) ...[
                        Text(
                          "PROPOSAL / RAB PENDUKUNG (${_pickedFiles.length} BERKAS)",
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: _primary,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          height: 90,
                          child: ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: _pickedFiles.length,
                            itemBuilder: (ctx, i) => Container(
                              width: 90,
                              margin: const EdgeInsets.only(right: 10),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.grey[300]!),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.file(File(_pickedFiles[i].path),
                                    fit: BoxFit.cover),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Signature preview
                      if (_signatureBase64 != null) ...[
                        Text(
                          "TANDA TANGAN PENGAJU",
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Colors.grey[700],
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          height: 70,
                          width: 160,
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.grey[300]!),
                          ),
                          child: Image.memory(
                            base64Decode(_signatureBase64!.split(',').last),
                            fit: BoxFit.contain,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // Footer Action Buttons
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
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(
                          "Edit Data",
                          style: GoogleFonts.outfit(
                              fontWeight: FontWeight.bold, color: Colors.grey[700]),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton.icon(
                        onPressed: _isSubmitting
                            ? null
                            : () {
                                Navigator.pop(ctx);
                                _submit();
                              },
                        icon: _isSubmitting
                            ? const SizedBox(
                                height: 16,
                                width: 16,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2),
                              )
                            : const Icon(Icons.send_rounded,
                                size: 16, color: Colors.white),
                        label: Text(
                          "Konfirmasi & Kirim",
                          style: GoogleFonts.outfit(
                              fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _primary,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
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

  Widget _previewRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
        ),
        Text(
          value.isEmpty ? "-" : value,
          style: GoogleFonts.inter(
              fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey[900]),
        ),
      ],
    );
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
          widget.existingRequest != null ? "Edit Pengajuan Dana" : "Formulir Pengajuan Dana",
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: _primary,
          indicatorWeight: 3,
          labelColor: _primary,
          unselectedLabelColor: Colors.grey[600],
          labelStyle:
              GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
          unselectedLabelStyle:
              GoogleFonts.inter(fontWeight: FontWeight.w500, fontSize: 13),
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
    final hPad = ResponsiveHelper.padding(context, 20);
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: EdgeInsets.only(
        left: hPad,
        right: hPad,
        top: hPad,
        bottom: MediaQuery.of(context).viewInsets.bottom + 100,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header Card ── (animated)
          FadeSlideIn(
            delay: const Duration(milliseconds: 0),
            child: Container(
              padding: EdgeInsets.all(ResponsiveHelper.padding(context, 16)),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey[200]!),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Image.asset('assets/images/artacom.png', height: ResponsiveHelper.isSmallPhone(context) ? 32 : 40),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "PENGAJUAN UANG MUKA / DANA",
                          style: GoogleFonts.outfit(
                            fontSize: ResponsiveHelper.fontSize(context, 13),
                            fontWeight: FontWeight.w900,
                            color: _primary,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "Permintaan dana operasional sebelum transaksi",
                          style: GoogleFonts.inter(
                            fontSize: ResponsiveHelper.fontSize(context, 11),
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // ── Notice Box ── (animated)
          FadeSlideIn(
            delay: const Duration(milliseconds: 80),
            child: Container(
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
                      "Pengajuan dana adalah permohonan uang muka sebelum pengeluaran. Nota & bukti belanja (SPJ) dilaporkan setelah dana digunakan.",
                      style: GoogleFonts.inter(
                          fontSize: ResponsiveHelper.fontSize(context, 11), color: Colors.amber[950], height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // ── SECTION 1: PEMOHON & TUJUAN ──
          FadeSlideIn(
            delay: const Duration(milliseconds: 160),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _sectionTitle("1. Data Pemohon & Tujuan"),
                const SizedBox(height: 10),
                _buildApplicantSection(),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── SECTION 2: KEPERLUAN & PRIORITAS & DIVISI ──
          FadeSlideIn(
            delay: const Duration(milliseconds: 240),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _sectionTitle("2. Keperluan & Prioritas"),
                const SizedBox(height: 10),
                _buildDetailsSection(),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── SECTION 3: ITEM BARANG / JASA ──
          FadeSlideIn(
            delay: const Duration(milliseconds: 320),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _sectionTitle("3. Item Barang / Jasa"),
                const SizedBox(height: 10),
                _buildItemsSection(),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── SECTION 4: PROPOSAL / RAB PENDUKUNG (OPSIONAL) ──
          FadeSlideIn(
            delay: const Duration(milliseconds: 400),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _sectionTitle("4. Dokumen Proposal / RAB Pendukung (Opsional)"),
                const SizedBox(height: 10),
                _buildAttachmentsSection(),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── SECTION 5: TANDA TANGAN DIGITAL ──
          FadeSlideIn(
            delay: const Duration(milliseconds: 480),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _sectionTitle("5. Tanda Tangan Pemohon"),
                const SizedBox(height: 10),
                _buildSignatureSection(),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // ── Action Buttons ── (animated)
          FadeSlideIn(
            delay: const Duration(milliseconds: 560),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      _tabController.animateTo(1);
                    },
                    icon: Icon(Icons.preview_rounded, size: ResponsiveHelper.iconSize(context, 18), color: _primary),
                    label: Text(
                      "Live Preview",
                      style: GoogleFonts.outfit(
                          fontWeight: FontWeight.bold, fontSize: ResponsiveHelper.fontSize(context, 13), color: _primary),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: const BorderSide(color: _primary),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: _validateAndShowPreview,
                    icon: Icon(Icons.remove_red_eye_rounded,
                        size: ResponsiveHelper.iconSize(context, 18), color: Colors.white),
                    label: Text(
                      "Preview & Ajukan",
                      style: GoogleFonts.outfit(
                          fontWeight: FontWeight.bold,
                          fontSize: ResponsiveHelper.fontSize(context, 14),
                          color: Colors.white),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _primary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Text(
      title,
      style: GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w800,
        color: Colors.grey[800],
        letterSpacing: 0.5,
      ),
    );
  }

  // ── Section 1: Pemohon & Tujuan ──
  Widget _buildApplicantSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Radio manual vs dropdown
          Row(
            children: [
              Expanded(
                child: RadioListTile<bool>(
                  title: Text("Pilih Karyawan",
                      style: GoogleFonts.inter(fontSize: 12)),
                  value: false,
                  groupValue: _isCustomEmployee,
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  activeColor: _primary,
                  onChanged: (val) {
                    setState(() {
                      _isCustomEmployee = false;
                      _chosenEmployeeName = _userProfile?['name'];
                    });
                  },
                ),
              ),
              Expanded(
                child: RadioListTile<bool>(
                  title: Text("Tulis Manual",
                      style: GoogleFonts.inter(fontSize: 12)),
                  value: true,
                  groupValue: _isCustomEmployee,
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  activeColor: _primary,
                  onChanged: (val) {
                    setState(() => _isCustomEmployee = true);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (_isCustomEmployee) ...[
            _textField("Nama Pemohon (Manual)", _empNameCtrl, Icons.person_rounded),
          ] else ...[
            if (_isLoadingProfile)
              const LinearProgressIndicator(color: _primary)
            else
              DropdownButtonFormField<String>(
                value: _chosenEmployeeName,
                decoration: _inputDecoration("Nama Pemohon", Icons.person_rounded),
                style: GoogleFonts.inter(fontSize: 13, color: Colors.black87),
                isExpanded: true,
                items: [
                  if (_userProfile != null)
                    DropdownMenuItem(
                      value: _userProfile!['name'],
                      child: Text("${_userProfile!['name']} (Saya)"),
                    ),
                  ...widget.employees.map((e) {
                    final name = e['name']?.toString() ?? "";
                    final dept = e['department']?.toString() ?? "Staff";
                    return DropdownMenuItem(
                      value: name,
                      child: Text("$name ($dept)"),
                    );
                  }).toList(),
                ],
                onChanged: (val) {
                  setState(() => _chosenEmployeeName = val);
                },
              ),
          ],
          const SizedBox(height: 16),

          // Tujuan Pengadaan
          Text(
            "TUJUAN PENGADAAN (OPSIONAL)",
            style: GoogleFonts.inter(
                fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700]),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              "Pengadaan Baru",
              "Dari Gudang",
              "Lainnya",
              "Tidak Ada / Kosong",
            ].map((t) {
              final isSel = _selectedTujuan == t;
              return ChoiceChip(
                label: Text(t, style: GoogleFonts.inter(fontSize: 12)),
                selected: isSel,
                selectedColor: _primary.withOpacity(0.12),
                labelStyle: GoogleFonts.inter(
                  color: isSel ? _primary : Colors.grey[700],
                  fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                ),
                side: BorderSide(color: isSel ? _primary : Colors.grey[300]!),
                onSelected: (_) {
                  setState(() => _selectedTujuan = t);
                },
              );
            }).toList(),
          ),
          if (_selectedTujuan == "Lainnya") ...[
            const SizedBox(height: 10),
            _textField(
                "Tuliskan Tujuan Pengadaan...", _tujuanLainnyaCtrl, Icons.edit_note_rounded),
          ],
        ],
      ),
    );
  }

  // ── Section 2: Keperluan, Divisi, Prioritas ──
  Widget _buildDetailsSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _textField(
            "Keperluan / Judul Pengajuan *",
            _titleCtrl,
            Icons.title_rounded,
            hint: "Contoh: Pembelian Sparepart / Laptop Kantor",
          ),
          const SizedBox(height: 14),
          _textField("Divisi (Div.)", _divisiCtrl, Icons.business_rounded,
              hint: "Contoh: Operasional / IT / HRGA"),
          const SizedBox(height: 16),

          // Prioritas
          Text(
            "PRIORITAS PENGAJUAN",
            style: GoogleFonts.inter(
                fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700]),
          ),
          const SizedBox(height: 8),
          Row(
            children: ["Normal", "Urgent", "Top Urgent"].map((p) {
              final isSel = _selectedPriority == p;
              Color pColor = Colors.blue;
              if (p == "Urgent") pColor = Colors.orange;
              if (p == "Top Urgent") pColor = Colors.red;

              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: InkWell(
                    onTap: () => setState(() => _selectedPriority = p),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: isSel ? pColor.withOpacity(0.12) : Colors.grey[50],
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isSel ? pColor : Colors.grey[300]!,
                          width: isSel ? 1.5 : 1,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        p,
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
                          color: isSel ? pColor : Colors.grey[700],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // ── Section 3: Item Barang / Jasa ──
  Widget _buildItemsSection() {
    return AnimatedSize(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: Column(
        children: [
          ..._items.asMap().entries.map((entry) {
            final idx = entry.key;
            final item = entry.value;
            final qty = int.tryParse(item.qtyCtrl.text) ?? 1;
            final harga = double.tryParse(item.hargaCtrl.text) ?? 0.0;
            final subtotal = qty * harga;

            return AnimatedListItem(
              key: ValueKey('item_$idx'),
              index: idx,
              child: Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: EdgeInsets.all(ResponsiveHelper.padding(context, 16)),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey[200]!),
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
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 250),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: _primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            "Item #${idx + 1}",
                            style: GoogleFonts.inter(
                                fontSize: ResponsiveHelper.fontSize(context, 11),
                                fontWeight: FontWeight.bold,
                                color: _primary),
                          ),
                        ),
                        if (_items.length > 1)
                          IconButton(
                            icon: const Icon(Icons.delete_outline_rounded,
                                size: 20, color: Colors.red),
                            onPressed: () {
                              setState(() {
                                item.dispose();
                                _items.removeAt(idx);
                              });
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _textField("Spesifikasi Barang / Jasa *", item.spesifikasiCtrl,
                        Icons.inventory_2_rounded,
                        hint: "Contoh: Baterai UPS 12V 7Ah"),
                    const SizedBox(height: 10),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        // On small screens, stack vertically
                        if (constraints.maxWidth < 300) {
                          return Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: _textField("Unit", item.unitCtrl, Icons.straighten_rounded,
                                        hint: "Pcs/Lbr"),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: _textField(
                                      "Qty *",
                                      item.qtyCtrl,
                                      Icons.numbers_rounded,
                                      isNumber: true,
                                      onChanged: (_) => setState(() {}),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              _textField(
                                "Harga Satuan (Rp) *",
                                item.hargaCtrl,
                                Icons.payments_rounded,
                                isNumber: true,
                                onChanged: (_) => setState(() {}),
                              ),
                            ],
                          );
                        }
                        return Row(
                          children: [
                            Expanded(
                              flex: 1,
                              child: _textField("Unit", item.unitCtrl, Icons.straighten_rounded,
                                  hint: "Pcs/Lbr"),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              flex: 1,
                              child: _textField(
                                "Qty *",
                                item.qtyCtrl,
                                Icons.numbers_rounded,
                                isNumber: true,
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              flex: 2,
                              child: _textField(
                                "Harga Satuan (Rp) *",
                                item.hargaCtrl,
                                Icons.payments_rounded,
                                isNumber: true,
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "Subtotal:",
                          style: GoogleFonts.inter(
                              fontSize: ResponsiveHelper.fontSize(context, 11),
                              fontWeight: FontWeight.bold,
                              color: Colors.grey[600]),
                        ),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 300),
                          transitionBuilder: (child, animation) =>
                              FadeTransition(opacity: animation, child: child),
                          child: Text(
                            _currFmt.format(subtotal),
                            key: ValueKey(subtotal),
                            style: GoogleFonts.inter(
                                fontWeight: FontWeight.bold,
                                fontSize: ResponsiveHelper.fontSize(context, 13),
                                color: _primary),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _textField(
                        "Tanggal / Keterangan (Opsional)", item.keteranganCtrl, Icons.notes_rounded,
                        hint: "Contoh: Untuk server lt. 2"),
                  ],
                ),
              ),
            );
          }),

          // Tombol Tambah Item (with smooth scale feedback)
          OutlinedButton.icon(
            onPressed: () {
              setState(() {
                _items.add(_FundItemInput());
              });
            },
            icon: const Icon(Icons.add_circle_outline_rounded, size: 18),
            label: Text("Tambah Baris Item",
                style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: ResponsiveHelper.fontSize(context, 13))),
            style: OutlinedButton.styleFrom(
              foregroundColor: _primary,
              side: const BorderSide(color: _primary),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 14),

          // Total Estimasi Card (animated on value change)
          AnimatedContainer(
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeOutCubic,
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _totalAmount > 0 ? Colors.amber[50] : Colors.grey[50],
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _totalAmount > 0 ? Colors.amber[300]! : Colors.grey[300]!,
                width: 1.5,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      "TOTAL ESTIMASI DANA:",
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold,
                        fontSize: ResponsiveHelper.fontSize(context, 11),
                        color: Colors.amber[900],
                      ),
                    ),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 350),
                      transitionBuilder: (child, animation) {
                        return SlideTransition(
                          position: Tween<Offset>(
                            begin: const Offset(0, 0.3),
                            end: Offset.zero,
                          ).animate(CurvedAnimation(
                            parent: animation,
                            curve: Curves.easeOutCubic,
                          )),
                          child: FadeTransition(opacity: animation, child: child),
                        );
                      },
                      child: Text(
                        _currFmt.format(_totalAmount),
                        key: ValueKey(_totalAmount),
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w900,
                          fontSize: ResponsiveHelper.fontSize(context, 18),
                          color: _primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  "Terbilang: ${_terbilang(_totalAmount)}",
                  style: GoogleFonts.inter(
                    fontStyle: FontStyle.italic,
                    fontSize: ResponsiveHelper.fontSize(context, 11),
                    color: Colors.amber[900],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Section 4: Proposal / RAB Pendukung (Opsional) ──
  Widget _buildAttachmentsSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.description_rounded, size: 20, color: Colors.grey[600]),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  "Proposal, penawaran harga, atau rincian RAB",
                  style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: () async {
              final choice = await showModalBottomSheet<String>(
                context: context,
                builder: (ctx) => Container(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ListTile(
                        leading: const Icon(Icons.camera_alt, color: _primary),
                        title: const Text("Kamera (Ambil Foto Berkas)"),
                        subtitle: const Text("Foto langsung dokumen / proposal"),
                        onTap: () => Navigator.pop(ctx, 'camera'),
                      ),
                      ListTile(
                        leading: const Icon(Icons.photo_library, color: _primary),
                        title: const Text("Galeri"),
                        subtitle: const Text("Pilih gambar dari album / galeri"),
                        onTap: () => Navigator.pop(ctx, 'gallery'),
                      ),
                    ],
                  ),
                ),
              );
              if (choice == null || !mounted) return;

              if (choice == 'camera') {
                try {
                  final XFile? captured = await Navigator.push<XFile?>(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const CameraCaptureScreen(
                        title: "Foto Berkas Proposal / RAB",
                        guideText: "Posisikan dokumen di dalam bingkai agar jelas terbaca",
                      ),
                    ),
                  );
                  if (captured != null && mounted) {
                    setState(() => _pickedFiles.add(captured));
                  }
                } catch (e) {
                  final picker = ImagePicker();
                  final img = await picker.pickImage(
                    source: ImageSource.camera,
                    maxWidth: 1600,
                    maxHeight: 1600,
                    imageQuality: 75,
                  );
                  if (img != null && mounted) {
                    setState(() => _pickedFiles.add(img));
                  }
                }
              } else {
                final picker = ImagePicker();
                final images = await picker.pickMultiImage(
                  maxWidth: 1600,
                  maxHeight: 1600,
                  imageQuality: 75,
                );
                if (images.isNotEmpty && mounted) {
                  setState(() => _pickedFiles.addAll(images));
                }
              }
            },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 18),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: Colors.grey[300]!, style: BorderStyle.solid),
              ),
              child: Column(
                children: [
                  Icon(Icons.cloud_upload_outlined, size: 32, color: _primary),
                  const SizedBox(height: 6),
                  Text(
                    "Pilih Berkas Proposal / Dokumen",
                    style: GoogleFonts.inter(
                        fontSize: 12, fontWeight: FontWeight.bold, color: _primary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    "Format gambar/dokumen pendukung (Maks. 10 berkas)",
                    style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[500]),
                  ),
                ],
              ),
            ),
          ),
          if (_pickedFiles.isNotEmpty) ...[
            const SizedBox(height: 12),
            SizedBox(
              height: 80,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _pickedFiles.length,
                itemBuilder: (ctx, i) => Stack(
                  children: [
                    Container(
                      width: 80,
                      margin: const EdgeInsets.only(right: 10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.grey[300]!),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.file(File(_pickedFiles[i].path),
                            fit: BoxFit.cover),
                      ),
                    ),
                    Positioned(
                      top: 2,
                      right: 12,
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _pickedFiles.removeAt(i));
                        },
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(
                            color: Colors.black54,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.close, size: 14, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Section 5: Signature Section ──
  Widget _buildSignatureSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Bubuhkan Tanda Tangan Digital *",
                style: GoogleFonts.inter(
                    fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey[700]),
              ),
              TextButton(
                onPressed: () {
                  _signatureCtrl.clear();
                  setState(() => _signatureBase64 = null);
                },
                child: Text(
                  "Bersihkan",
                  style: GoogleFonts.inter(
                      fontSize: 11, fontWeight: FontWeight.bold, color: Colors.red),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              height: 150,
              color: Colors.grey[50],
              child: Signature(
                controller: _signatureCtrl,
                backgroundColor: Colors.grey[100]!,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            "* Tanda tangan digital wajib dicantumkan sebelum mengajukan.",
            style: GoogleFonts.inter(fontSize: 10, color: Colors.amber[900]),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════
  //  TAB 2 — LIVE PREVIEW (Excel-like Document)
  // ═══════════════════════════════════════════════════════
  Widget _buildPreviewTab() {
    final now = DateTime.now();
    final dateStr = DateFormat('dd/MM/yyyy').format(now);
    final noStr = "FUND/${DateFormat('yyyyMMdd').format(now)}/DRAFT";

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
                    style: GoogleFonts.inter(
                        fontSize: 10, fontWeight: FontWeight.bold, color: Colors.blue[700]),
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
              width: 530, // fixed width for official document look
              padding: const EdgeInsets.all(18),
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
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _isSubmitting ? null : _validateAndShowPreview,
              icon: const Icon(Icons.send_rounded, size: 18, color: Colors.white),
              label: Text(
                "Review & Kirim Pengajuan Dana",
                style: GoogleFonts.outfit(
                    fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: _primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  // ── Document Sheet (Official Excel / Cetak Layout) ──
  Widget _buildDocumentSheet(String dateStr, String noStr) {
    final empName = _employeeName();
    final title = _titleCtrl.text.isEmpty ? "—" : _titleCtrl.text;
    final divisi = _divisiCtrl.text.isEmpty ? "Operasional" : _divisiCtrl.text;
    final tujuan = _selectedTujuan == "Lainnya"
        ? _tujuanLainnyaCtrl.text
        : _selectedTujuan;
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
                Image.asset('assets/images/artacom.png', height: 38),
                const SizedBox(height: 4),
                Text(
                  "PT ARTACOMINDO JEJARING NUSA",
                  style: GoogleFonts.inter(
                      fontWeight: FontWeight.w900, fontSize: 9, letterSpacing: 0.3),
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
                  _headerField("Date", dateStr),
                  const SizedBox(height: 4),
                  _headerField("No", noStr),
                ],
              ),
            ),
          ],
        ),
        const Divider(color: Colors.black, thickness: 1.5, height: 16),

        // ── PRIORITY BOXES ──
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            _priorityBox("NORMAL", _selectedPriority == "Normal"),
            const SizedBox(width: 8),
            _priorityBox("URGENT", _selectedPriority == "Urgent"),
            const SizedBox(width: 8),
            _priorityBox("TOP URGENT", _selectedPriority == "Top Urgent"),
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
                  _infoRow("Nama", empName.isEmpty ? "—" : empName),
                  const SizedBox(height: 4),
                  _infoRow("Tujuan", title),
                  const SizedBox(height: 4),
                  _infoRow("Div.", divisi),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _checkOption("Pengadaan Baru",
                    tujuan.toLowerCase().contains("pengadaan")),
                const SizedBox(height: 4),
                _checkOption(
                    "Dari Gudang", tujuan.toLowerCase().contains("gudang")),
              ],
            ),
          ],
        ),
        const SizedBox(height: 12),

        // ── TABLE ──
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: Colors.black, width: 1.5),
          ),
          child: Column(
            children: [
              // Table Header
              Container(
                color: Colors.grey[200],
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    _tableCell("No.", width: 30, isHeader: true),
                    _tableCell("Spesifikasi Barang / Jasa", flex: 3, isHeader: true, align: TextAlign.left),
                    _tableCell("Unit", width: 45, isHeader: true),
                    _tableCell("Quantity", width: 55, isHeader: true),
                    _tableCell("Estimasi Harga", width: 95, isHeader: true, align: TextAlign.right),
                    _tableCell("Tanggal / Keterangan", flex: 2, isHeader: true, align: TextAlign.left),
                  ],
                ),
              ),
              const Divider(color: Colors.black, height: 1, thickness: 1.5),

              // Rows: render input items + blank rows up to at least 6 rows
              ...List.generate(
                _items.length < 6 ? 6 : _items.length,
                (idx) {
                  final it = idx < _items.length ? _items[idx] : null;
                  final qty = it != null ? (int.tryParse(it.qtyCtrl.text) ?? 1) : null;
                  final harga = it != null ? (double.tryParse(it.hargaCtrl.text) ?? 0.0) : null;

                  return Container(
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: Colors.grey[300]!,
                          width: idx == (_items.length < 6 ? 5 : _items.length - 1) ? 0 : 0.8,
                        ),
                      ),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        _tableCell("${idx + 1}", width: 30),
                        _tableCell(
                          it?.spesifikasiCtrl.text ?? "",
                          flex: 3,
                          align: TextAlign.left,
                        ),
                        _tableCell(it?.unitCtrl.text ?? "", width: 45),
                        _tableCell(qty != null ? "$qty" : "", width: 55),
                        _tableCell(
                          harga != null && harga > 0 ? _currFmt.format(harga) : "",
                          width: 95,
                          align: TextAlign.right,
                        ),
                        _tableCell(
                          it?.keteranganCtrl.text ?? "",
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
                  border: Border(top: BorderSide(color: Colors.black, width: 1.5)),
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
                            fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 1),
                      ),
                    ),
                    const SizedBox(width: 45),
                    const SizedBox(width: 55),
                    SizedBox(
                      width: 95,
                      child: Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: Text(
                          _currFmt.format(total),
                          textAlign: TextAlign.right,
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.w900, fontSize: 10),
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
              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 9),
            ),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  border: Border.all(color: Colors.black),
                ),
                child: Text(
                  _terbilang(total),
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

        // ── APPROVAL BOXES (SEQUENTIAL WORKFLOW: PEMOHON, ATASAN, FINANCE, DIREKTUR) ──
        Builder(
          builder: (context) {
            final req = widget.existingRequest;
            final reqStatus = (req?['status'] ?? '').toString();
            final currentStep = req?['current_approval_step'] != null
                ? int.tryParse(req!['current_approval_step'].toString()) ?? 1
                : 1;
            final isSpvApproved = reqStatus == 'approved' ||
                reqStatus == 'approved_by_supervisor' ||
                currentStep > 1 ||
                req?['supervisor_approved_at'] != null;
            final isHrdApproved = reqStatus == 'approved' ||
                req?['hrd_approved_at'] != null ||
                currentStep > 2;
            final isDirutApproved = reqStatus == 'approved';

            return Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.black, width: 1),
              ),
              child: Column(
                children: [
                  // Header row
                  Container(
                    color: Colors.grey[200],
                    child: Row(
                      children: [
                        _approvalHeaderCell("1. PEMOHON"),
                        _approvalHeaderCell("2. ATASAN"),
                        _approvalHeaderCell("3. FINANCE"),
                        _approvalHeaderCell("4. DIREKTUR", isLast: true),
                      ],
                    ),
                  ),
                  const Divider(color: Colors.black, height: 1, thickness: 1),
                  // Content row
                  Row(
                    children: [
                      // 1. Requester
                      _approvalContentCell(
                        empName.isEmpty ? "REQUESTER" : empName,
                        isRequester: true,
                      ),
                      // 2. Atasan Langsung
                      _approvalContentCell(
                        "Atasan Langsung",
                        statusBadge: isSpvApproved ? "APPROVED ✓" : "PENDING",
                        isApproved: isSpvApproved,
                      ),
                      // 3. Finance & HRD
                      _approvalContentCell(
                        "Finance / HRD",
                        statusBadge: isHrdApproved ? "APPROVED ✓" : (isSpvApproved ? "PENDING" : "WAITING"),
                        isApproved: isHrdApproved,
                      ),
                      // 4. Direktur Utama
                      _approvalContentCell(
                        "Direktur Utama",
                        statusBadge: isDirutApproved ? "APPROVED ✓" : "WAITING",
                        isApproved: isDirutApproved,
                        isLast: true,
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        ),
        Builder(
          builder: (context) {
            final req = widget.existingRequest;
            final remark = (req?['remark'] ?? req?['notes'] ?? '').toString();
            if (remark.contains('[Disetujui Super Admin')) {
              return Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.amber[50],
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.amber[400]!, width: 1),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.shield_outlined, size: 14, color: Colors.amber[900]),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Catatan Otorisasi Darurat Super Admin:",
                            style: GoogleFonts.inter(fontSize: 8.5, fontWeight: FontWeight.bold, color: Colors.amber[900]),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            remark,
                            style: GoogleFonts.inter(fontSize: 8, color: Colors.amber[950]),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }
            return const SizedBox.shrink();
          },
        ),
      ],
    );
  }

  Widget _headerField(String label, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text("$label : ",
            style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold)),
        Text(value, style: GoogleFonts.inter(fontSize: 9)),
      ],
    );
  }

  Widget _priorityBox(String label, bool isChecked) {
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
                  style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, height: 1))
              : null,
        ),
        const SizedBox(width: 4),
        Text(label,
            style: GoogleFonts.inter(fontSize: 8, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _infoRow(String label, String value) {
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

  Widget _checkOption(String label, bool isChecked) {
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
                  style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, height: 1))
              : null,
        ),
        const SizedBox(width: 4),
        Text(label,
            style: GoogleFonts.inter(fontSize: 8, fontWeight: FontWeight.w500)),
      ],
    );
  }

  Widget _tableCell(
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

  Widget _approvalHeaderCell(String label, {bool isLast = false}) {
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

  Widget _approvalContentCell(
    String subText, {
    String? statusBadge,
    bool isApproved = false,
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
                    ? (_signatureBase64 != null
                        ? Image.memory(
                            base64Decode(_signatureBase64!.split(',').last),
                            fit: BoxFit.contain,
                          )
                        : Text("— Belum TTD —",
                            style: GoogleFonts.inter(
                                fontSize: 7,
                                color: Colors.grey,
                                fontStyle: FontStyle.italic)))
                    : (statusBadge != null
                        ? Container(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 4, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: isApproved ? Colors.green[50] : Colors.grey[100],
                              border: Border.all(
                                color: isApproved ? Colors.green[700]! : Colors.grey[400]!,
                                width: isApproved ? 1.2 : 0.8,
                              ),
                              borderRadius: BorderRadius.circular(2),
                            ),
                            child: Text(
                              statusBadge,
                              style: GoogleFonts.inter(
                                  fontSize: 6.5,
                                  fontWeight: isApproved ? FontWeight.w900 : FontWeight.bold,
                                  color: isApproved ? Colors.green[800] : Colors.grey[600]),
                            ),
                          )
                        : const SizedBox()),
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

  // ── Inputs Helpers ──
  Widget _textField(
    String label,
    TextEditingController controller,
    IconData icon, {
    bool isNumber = false,
    String? hint,
    ValueChanged<String>? onChanged,
  }) {
    return TextField(
      controller: controller,
      keyboardType: isNumber ? TextInputType.number : TextInputType.text,
      onChanged: onChanged,
      style: GoogleFonts.inter(fontSize: 13),
      decoration: _inputDecoration(label, icon, hint: hint),
    );
  }

  InputDecoration _inputDecoration(String label, IconData icon, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: Icon(icon, color: _primary, size: 20),
      labelStyle: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
      hintStyle: GoogleFonts.inter(fontSize: 12, color: Colors.grey[400]),
      filled: true,
      fillColor: Colors.grey[50],
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey[300]!),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey[300]!),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _primary, width: 1.5),
      ),
    );
  }
}
