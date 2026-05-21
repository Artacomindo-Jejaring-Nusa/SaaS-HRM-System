import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:signature/signature.dart';
import 'dart:convert';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';
import '../../widgets/loading_overlay.dart';

class PermitScreen extends StatefulWidget {
  @override
  _PermitScreenState createState() => _PermitScreenState();
}

class _PermitScreenState extends State<PermitScreen> {
  final Color primaryColor = const Color(0xFF800000);
  List<dynamic> _permits = [];
  bool _isLoading = true;
  bool _isSubmitting = false;

  // Form State
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  String _type = 'Sakit';
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

  void _showAddPermitDialog() {
    // Reset form state on open
    _startDate = DateTime.now();
    _endDate = DateTime.now();
    _type = 'Sakit';
    _reasonController.clear();
    _sigController.clear();
    _isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent, // Ensure no default tint
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
                Text("Pengajuan Izin", style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 20),
                
                DropdownButtonFormField<String>(
                  value: _type,
                  decoration: InputDecoration(labelText: "Jenis Izin", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                  items: ['Sakit', 'Dinas Luar (WFA)', 'Izin Terlambat', 'Izin Pulang Cepat', 'Keperluan Pribadi', 'Lainnya']
                      .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                      .toList(),
                  onChanged: (val) => setModalState(() => _type = val!),
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
                            firstDate: DateTime.now().subtract(const Duration(days: 7)), 
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
                
                Text("Tanda Tangan:", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14)),
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
                      if (_sigController.isEmpty) {
                        ScaffoldMessenger.of(stContext).showSnackBar(const SnackBar(content: Text("Tanda tangan wajib diisi"), backgroundColor: Colors.red));
                        return;
                      }
                      
                      setModalState(() => _isSubmitting = true);
                      LoadingDialog.show(context, message: "Mengajukan izin...");
                      
                      try {
                        final sigData = await _sigController.toPngBytes();
                        if (sigData == null) {
                          LoadingDialog.hide(context);
                          setModalState(() => _isSubmitting = false);
                          return;
                        }
                        
                        final base64Sig = base64Encode(sigData);
                        
                        final res = await ApiService.submitPermit({
                          'type': _type,
                          'start_date': DateFormat('yyyy-MM-dd').format(_startDate),
                          'end_date': DateFormat('yyyy-MM-dd').format(_endDate),
                          'reason': _reasonController.text,
                          'signature': 'data:image/png;base64,$base64Sig',
                        });
                        
                        LoadingDialog.hide(context);
                        if (res['status'] == 'success' || res['id'] != null) {
                          Navigator.pop(ctx);
                          _fetchPermits();
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Berhasil mengajukan Izin"), backgroundColor: Colors.green));
                        } else {
                          final msg = res['message'] ?? (res['errors']?.toString() ?? "Gagal mengajukan Izin.");
                          setModalState(() => _isSubmitting = false);
                          ScaffoldMessenger.of(stContext).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red));
                        }
                      } catch (e) {
                         LoadingDialog.hide(context);
                         setModalState(() => _isSubmitting = false);
                         ScaffoldMessenger.of(stContext).showSnackBar(SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red));
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: primaryColor, padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    child: _isSubmitting 
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text("KIRIM PENGAJUAN", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
                            final status = permit['status'];
                            Color statusColor = Colors.orange;
                            if (status == 'approved') statusColor = Colors.green;
                            if (status == 'rejected') statusColor = Colors.red;

                            return Container(
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
                                        Text(permit['type'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                        const SizedBox(height: 4),
                                        Text("${permit['start_date']} s/d ${permit['end_date']}", style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                        decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                                        child: Text(status.toUpperCase(), style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold)),
                                      ),
                                      if (status == 'approved')
                                        IconButton(
                                          constraints: BoxConstraints(),
                                          padding: EdgeInsets.only(top: 8),
                                          icon: Icon(Icons.picture_as_pdf, color: primaryColor, size: 20), 
                                          onPressed: () => ApiService.launchPdf('permit', permit['id']),
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
        onPressed: _showAddPermitDialog,
        backgroundColor: primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}
