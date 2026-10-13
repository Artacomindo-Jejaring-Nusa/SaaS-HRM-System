import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:signature/signature.dart';
import 'dart:convert';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';
import '../../widgets/loading_overlay.dart';

class PermitScreen extends StatefulWidget {
  const PermitScreen({super.key});

  @override
  State<PermitScreen> createState() => _PermitScreenState();
}

class _PermitScreenState extends State<PermitScreen> {
  final Color primaryColor = const Color(0xFF800000);
  List<dynamic> _permits = [];
  bool _isLoading = true;
  bool _isSubmitting = false;

  final Map<String, String> _categoryLabels = {
    'I': 'Izin',
    'A': 'Alpha/Mangkir',
    'S': 'Sakit',
    'L': 'Lainnya',
  };

  final Map<String, Color> _categoryColors = {
    'I': Colors.blue,
    'A': Colors.red,
    'S': Colors.orange.shade700,
    'L': Colors.grey,
  };

  final Map<String, List<String>> _subTypes = {
    'I': ['Izin Terlambat', 'Izin Pulang Cepat', 'Keperluan Pribadi'],
    'S': ['Sakit'],
    'L': ['Dinas Luar (WFA)', 'Duka Cita', 'Menikah', 'Lainnya'],
  };

  // Form State
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  String _category = 'I';
  String _type = 'Izin Terlambat';
  final _reasonController = TextEditingController();
  final SignatureController _sigController = SignatureController(
    penStrokeWidth: 3,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );

  @override
  void initState() {
    super.initState();
    _fetchPermits();
  }

  Future<void> _fetchPermits() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getPermits();
    if (mounted) {
      setState(() {
        _permits = data ?? [];
        _isLoading = false;
      });
    }
  }

  Future<void> _deletePermit(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Batalkan Pengajuan Izin", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        content: const Text("Apakah Anda yakin ingin membatalkan/menghapus permohonan izin ini?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Tidak")),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Ya, Batalkan", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    LoadingDialog.show(context, message: "Membatalkan izin...");
    try {
      final res = await ApiService.deletePermit(id);
      if (!mounted) return;
      LoadingDialog.hide(context);
      if (res['status'] == 'success') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Permohonan izin berhasil dibatalkan"), backgroundColor: Colors.green),
        );
        _fetchPermits();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? "Gagal membatalkan izin"), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      if (!mounted) return;
      LoadingDialog.hide(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
      );
    }
  }

  void _showAddPermitDialog({Map<String, dynamic>? existingPermit}) {
    // Setup form state on open
    if (existingPermit != null) {
      _category = existingPermit['category'] ?? 'I';
      _type = existingPermit['type'] ?? (_subTypes[_category]?.first ?? 'Izin Terlambat');
      try {
        _startDate = DateTime.parse(existingPermit['start_date']);
      } catch (_) {
        _startDate = DateTime.now();
      }
      try {
        _endDate = DateTime.parse(existingPermit['end_date']);
      } catch (_) {
        _endDate = _startDate;
      }
      _reasonController.text = existingPermit['reason'] ?? '';
      _sigController.clear();
      _isSubmitting = false;
    } else {
      _startDate = DateTime.now();
      _endDate = DateTime.now();
      _category = 'I';
      _type = 'Izin Terlambat';
      _reasonController.clear();
      _sigController.clear();
      _isSubmitting = false;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (stContext, setModalState) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(25)),
          ),
          padding: EdgeInsets.only(bottom: MediaQuery.of(stContext).viewInsets.bottom, left: 25, right: 25, top: 25),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  existingPermit != null ? "Edit Pengajuan Izin" : "Pengajuan Izin",
                  style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                
                DropdownButtonFormField<String>(
                  initialValue: _category,
                  decoration: InputDecoration(labelText: "Kategori Izin", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                  items: const [
                    DropdownMenuItem(value: 'I', child: Text('[I] Izin')),
                    DropdownMenuItem(value: 'S', child: Text('[S] Sakit')),
                    DropdownMenuItem(value: 'L', child: Text('[L] Lainnya')),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setModalState(() {
                        _category = val;
                        final subList = _subTypes[_category] ?? ['Lainnya'];
                        _type = subList.first;
                      });
                    }
                  },
                ),
                const SizedBox(height: 15),
                
                DropdownButtonFormField<String>(
                  initialValue: (_subTypes[_category]?.contains(_type) ?? false) ? _type : (_subTypes[_category]?.first ?? 'Lainnya'),
                  decoration: InputDecoration(labelText: "Detail Tipe", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                  items: (_subTypes[_category] ?? ['Lainnya'])
                      .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setModalState(() => _type = val);
                    }
                  },
                ),
                const SizedBox(height: 15),
                
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final date = await showDatePicker(
                            context: ctx, 
                            initialDate: _startDate, 
                            firstDate: DateTime.now().subtract(const Duration(days: 30)), 
                            lastDate: DateTime(2027)
                          );
                          if (date != null) {
                            setModalState(() {
                              _startDate = date;
                              if (_endDate.isBefore(_startDate)) {
                                _endDate = _startDate;
                              }
                            });
                          }
                        },
                        child: InputDecorator(
                          decoration: InputDecoration(labelText: "Mulai", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                          child: Text(DateFormat('dd/MM/yyyy').format(_startDate)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 15),
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final date = await showDatePicker(
                            context: ctx, 
                            initialDate: _endDate.isBefore(_startDate) ? _startDate : _endDate, 
                            firstDate: _startDate, 
                            lastDate: DateTime(2027)
                          );
                          if (date != null) setModalState(() => _endDate = date);
                        },
                        child: InputDecorator(
                          decoration: InputDecoration(labelText: "Selesai", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                          child: Text(DateFormat('dd/MM/yyyy').format(_endDate)),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 15),
                
                TextField(
                  controller: _reasonController,
                  maxLines: 3,
                  decoration: InputDecoration(labelText: "Alasan", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                ),
                const SizedBox(height: 15),
                
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("Tanda Tangan:", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14)),
                    if (existingPermit != null && existingPermit['signature'] != null)
                      Text("(Sudah ada TTD tersimpan)", style: GoogleFonts.inter(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey[600])),
                  ],
                ),
                const SizedBox(height: 10),
                Container(
                  decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!), borderRadius: BorderRadius.circular(10)),
                  child: Signature(controller: _sigController, height: 150, backgroundColor: Colors.grey[50]!),
                ),
                TextButton(onPressed: () => _sigController.clear(), child: const Text("Hapus Tanda Tangan")),
                
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : () async {
                      final bool hasExistingSig = existingPermit != null &&
                          existingPermit['signature'] != null &&
                          existingPermit['signature'].toString().isNotEmpty;

                      if (_sigController.isEmpty && !hasExistingSig) {
                        ScaffoldMessenger.of(stContext).showSnackBar(const SnackBar(content: Text("Tanda tangan wajib diisi"), backgroundColor: Colors.red));
                        return;
                      }
                      
                      setModalState(() => _isSubmitting = true);
                      LoadingDialog.show(context, message: existingPermit != null ? "Memperbarui izin..." : "Mengajukan izin...");
                      
                      try {
                        String? base64Sig;
                        if (!_sigController.isEmpty) {
                          final sigData = await _sigController.toPngBytes();
                          if (sigData != null) {
                            base64Sig = 'data:image/png;base64,${base64Encode(sigData)}';
                          }
                        } else if (hasExistingSig) {
                          base64Sig = existingPermit['signature'];
                        }

                        final payload = {
                          'category': _category,
                          'type': _type,
                          'start_date': DateFormat('yyyy-MM-dd').format(_startDate),
                          'end_date': DateFormat('yyyy-MM-dd').format(_endDate),
                          'reason': _reasonController.text,
                          if (base64Sig != null) 'signature': base64Sig,
                        };
                        
                        final Map<String, dynamic> res;
                        if (existingPermit != null) {
                          res = await ApiService.updatePermit(existingPermit['id'], payload);
                        } else {
                          res = await ApiService.submitPermit(payload);
                        }
                        
                        if (!mounted) return;
                        LoadingDialog.hide(context);
                        
                        if (res['status'] == 'success' || res['id'] != null) {
                           if (ctx.mounted) {
                             Navigator.pop(ctx);
                           }
                           _fetchPermits();
                           if (context.mounted) {
                             ScaffoldMessenger.of(context).showSnackBar(
                               SnackBar(
                                 content: Text(existingPermit != null ? "Berhasil memperbarui pengajuan izin" : "Berhasil mengajukan Izin"),
                                 backgroundColor: Colors.green,
                               ),
                             );
                           }
                        } else {
                           final msg = res['message'] ?? (res['errors']?.toString() ?? "Gagal memproses Izin.");
                           setModalState(() => _isSubmitting = false);
                           if (stContext.mounted) {
                             ScaffoldMessenger.of(stContext).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red));
                           }
                        }
                      } catch (e) {
                         if (mounted) {
                           LoadingDialog.hide(context);
                           setModalState(() => _isSubmitting = false);
                           if (stContext.mounted) {
                             ScaffoldMessenger.of(stContext).showSnackBar(SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red));
                           }
                         }
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: primaryColor, padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    child: _isSubmitting 
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(existingPermit != null ? "SIMPAN PERUBAHAN" : "KIRIM PENGAJUAN", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 25),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showDetailBottomSheet(Map<String, dynamic> permit) {
    final status = (permit['status'] ?? 'pending').toString().toLowerCase();
    final category = permit['category'] ?? 'I';
    final categoryLabel = _categoryLabels[category] ?? category;
    final categoryColor = _categoryColors[category] ?? Colors.blue;
    final isDeducted = permit['is_deducted'] == true;
    final hasDoctorNote = permit['has_doctor_note'] == true;

    Color statusColor = Colors.orange;
    if (status == 'approved') statusColor = Colors.green;
    if (status == 'rejected') statusColor = Colors.red;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("Detail Permohonan Izin", style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(status.toUpperCase(), style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey[200]!),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text("Tipe Izin:", style: GoogleFonts.inter(color: Colors.grey[600], fontSize: 12)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: categoryColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text("[$category] $categoryLabel", style: TextStyle(color: categoryColor, fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(permit['type'] ?? '-', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
                    const Divider(height: 20),
                    Row(
                      children: [
                        Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 6),
                        Text("${permit['start_date']} s/d ${permit['end_date']}", style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        if (category == 'S') ...[
                          Icon(hasDoctorNote ? Icons.check_circle_outline : Icons.highlight_off, color: hasDoctorNote ? Colors.green : Colors.orange, size: 14),
                          const SizedBox(width: 4),
                          Text(hasDoctorNote ? "Ada Surat Dokter" : "Tanpa Surat Dokter", style: TextStyle(color: hasDoctorNote ? Colors.green : Colors.orange, fontSize: 11)),
                          const SizedBox(width: 12),
                        ],
                        Icon(isDeducted ? Icons.money_off : Icons.monetization_on_outlined, color: isDeducted ? Colors.red : Colors.green, size: 14),
                        const SizedBox(width: 4),
                        Text(isDeducted ? "Potong Gaji" : "Tidak Potong Gaji", style: TextStyle(color: isDeducted ? Colors.red : Colors.green, fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    if (permit['reason'] != null && permit['reason'].toString().isNotEmpty) ...[
                      const Divider(height: 20),
                      Text("Alasan:", style: GoogleFonts.inter(color: Colors.grey[600], fontSize: 11, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(permit['reason'].toString(), style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[850])),
                    ],
                  ],
                ),
              ),
              if (permit['remark'] != null && permit['remark'].toString().isNotEmpty) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: status == 'rejected' ? Colors.red[50] : Colors.green[50],
                    border: Border.all(color: status == 'rejected' ? Colors.red[200]! : Colors.green[200]!),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        status == 'rejected' ? "Catatan Penolakan:" : "Catatan Atasan:",
                        style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 11, color: status == 'rejected' ? Colors.red[950] : Colors.green[950]),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        permit['remark'],
                        style: GoogleFonts.inter(fontSize: 12, color: status == 'rejected' ? Colors.red[900] : Colors.green[900]),
                      ),
                    ],
                  ),
                ),
              ],
              if (status == 'pending' || status.startsWith('pending')) ...[
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(ctx);
                          _deletePermit(permit['id']);
                        },
                        icon: const Icon(Icons.delete_outline, size: 16, color: Colors.red),
                        label: const Text("BATALKAN", style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: Colors.red.shade300),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.pop(ctx);
                          _showAddPermitDialog(existingPermit: permit);
                        },
                        icon: const Icon(Icons.edit, size: 16, color: Colors.white),
                        label: const Text("EDIT IZIN", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue.shade700,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Izin Karyawan", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: _isLoading 
          ? const CardAndListSkeleton() 
          : RefreshIndicator(
              onRefresh: _fetchPermits,
              child: Column(
                children: [
                  // HEADER INFO
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.all(20),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: primaryColor.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: primaryColor.withOpacity(0.1)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: primaryColor.withOpacity(0.1), shape: BoxShape.circle),
                          child: Icon(Icons.info_outline, color: primaryColor, size: 24),
                        ),
                        const SizedBox(width: 15),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "Informasi Perizinan",
                                style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                "Gunakan menu ini untuk izin sakit, terlambat, atau keperluan mendesak lainnya.",
                                style: TextStyle(color: Colors.grey[700], fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // DAFTAR RIWAYAT Izin
                  Expanded(
                    child: _permits.isEmpty 
                      ? Center(child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.assignment_outlined, size: 80, color: Colors.grey[300]),
                            const SizedBox(height: 15),
                            const Text("Belum ada riwayat Izin"),
                          ],
                        ))
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          itemCount: _permits.length,
                          itemBuilder: (context, index) {
                            final permit = _permits[index];
                            final status = (permit['status'] ?? 'pending').toString().toLowerCase();
                            Color statusColor = Colors.orange;
                            if (status == 'approved') statusColor = Colors.green;
                            if (status == 'rejected') statusColor = Colors.red;

                            final String category = permit['category'] ?? 'I';
                            final String categoryLabel = _categoryLabels[category] ?? category;
                            final Color categoryColor = _categoryColors[category] ?? Colors.blue;

                            final bool isDeducted = permit['is_deducted'] == true;
                            final bool hasDoctorNote = permit['has_doctor_note'] == true;

                            return InkWell(
                              onTap: () => _showDetailBottomSheet(permit),
                              borderRadius: BorderRadius.circular(15),
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 15),
                                padding: const EdgeInsets.all(15),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(15),
                                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 5))],
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                                      child: Icon(Icons.assignment_turned_in_outlined, color: statusColor),
                                    ),
                                    const SizedBox(width: 15),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            crossAxisAlignment: CrossAxisAlignment.center,
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  permit['type'] ?? '-', 
                                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: categoryColor.withOpacity(0.1),
                                                  border: Border.all(color: categoryColor.withOpacity(0.3)),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  "[$category] $categoryLabel",
                                                  style: TextStyle(color: categoryColor, fontSize: 9, fontWeight: FontWeight.bold),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 6),
                                          Text("${permit['start_date']} s/d ${permit['end_date']}", style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                                          const SizedBox(height: 6),
                                          Row(
                                            children: [
                                              if (category == 'S') ...[
                                                Icon(
                                                  hasDoctorNote ? Icons.check_circle_outline : Icons.highlight_off,
                                                  color: hasDoctorNote ? Colors.green : Colors.orange,
                                                  size: 13,
                                                ),
                                                const SizedBox(width: 3),
                                                Text(
                                                  hasDoctorNote ? "Sakit + Surat" : "Sakit tanpa Surat",
                                                  style: TextStyle(
                                                    color: hasDoctorNote ? Colors.green : Colors.orange,
                                                    fontSize: 10,
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                              ],
                                              Icon(
                                                isDeducted ? Icons.money_off : Icons.monetization_on_outlined,
                                                color: isDeducted ? Colors.red : Colors.green,
                                                size: 13,
                                              ),
                                              const SizedBox(width: 3),
                                              Text(
                                                isDeducted ? "Potong Gaji" : "Tidak Potong",
                                                style: TextStyle(
                                                  color: isDeducted ? Colors.red : Colors.green,
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                          decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                                          child: Text(status.toUpperCase(), style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold)),
                                        ),
                                        if (status == 'pending' || status.startsWith('pending'))
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                constraints: const BoxConstraints(),
                                                padding: const EdgeInsets.only(top: 8),
                                                icon: const Icon(Icons.edit, color: Colors.blue, size: 20),
                                                tooltip: "Edit Izin",
                                                onPressed: () => _showAddPermitDialog(existingPermit: permit),
                                              ),
                                              const SizedBox(width: 4),
                                              IconButton(
                                                constraints: const BoxConstraints(),
                                                padding: const EdgeInsets.only(top: 8),
                                                icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                                                tooltip: "Batalkan Izin",
                                                onPressed: () => _deletePermit(permit['id']),
                                              ),
                                            ],
                                          ),
                                        if (status == 'approved')
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                constraints: const BoxConstraints(),
                                                padding: const EdgeInsets.only(top: 8),
                                                icon: Icon(Icons.picture_as_pdf, color: primaryColor, size: 20), 
                                                onPressed: () => ApiService.launchPdf('permit', permit['id']),
                                              ),
                                              const SizedBox(width: 8),
                                              IconButton(
                                                constraints: const BoxConstraints(),
                                                padding: const EdgeInsets.only(top: 8),
                                                icon: const Icon(Icons.table_view, color: Colors.green, size: 20), 
                                                onPressed: () => ApiService.launchExcel('permit', permit['id']),
                                              ),
                                            ],
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                  ),
                ],
              ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddPermitDialog(),
        backgroundColor: primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}
