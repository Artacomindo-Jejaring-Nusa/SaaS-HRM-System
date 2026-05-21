import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';
import '../../widgets/loading_overlay.dart';

class OvertimeScreen extends StatefulWidget {
  @override
  _OvertimeScreenState createState() => _OvertimeScreenState();
}

class _OvertimeScreenState extends State<OvertimeScreen> {
  final Color primaryColor = const Color(0xFF800000);
  List<dynamic> _overtimes = [];
  bool _isLoading = true;
  bool _isSubmitting = false; // Moved to state class

  // Form State
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 17, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 19, minute: 0);
  final _reasonController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchOvertimes();
  }

  Future<void> _fetchOvertimes() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getOvertimes();
    if (mounted) {
      setState(() {
        _overtimes = data ?? [];
        _isLoading = false;
      });
    }
  }

  void _showAddOvertimeDialog() {
    // Reset form state on open
    _selectedDate = DateTime.now();
    _startTime = const TimeOfDay(hour: 17, minute: 0);
    _endTime = const TimeOfDay(hour: 19, minute: 0);
    _reasonController.clear();
    _isSubmitting = false;

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
                Text("Pengajuan Lembur", style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 20),
                
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx, 
                      initialDate: _selectedDate, 
                      firstDate: DateTime.now().subtract(const Duration(days: 7)), 
                      lastDate: DateTime.now().add(const Duration(days: 30))
                    );
                    if (picked != null) setModalState(() => _selectedDate = picked);
                  },
                  child: InputDecorator(
                    decoration: InputDecoration(labelText: "Tanggal Lembur", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                    child: Text(DateFormat('dd MMMM yyyy').format(_selectedDate)),
                  ),
                ),
                const SizedBox(height: 15),
                
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final picked = await showTimePicker(context: ctx, initialTime: _startTime);
                          if (picked != null) setModalState(() => _startTime = picked);
                        },
                        child: InputDecorator(
                          decoration: InputDecoration(labelText: "Mulai", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))), 
                          child: Text(_startTime.format(ctx))
                        ),
                      ),
                    ),
                    const SizedBox(width: 15),
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final picked = await showTimePicker(context: ctx, initialTime: _endTime);
                          if (picked != null) setModalState(() => _endTime = picked);
                        },
                        child: InputDecorator(
                          decoration: InputDecoration(labelText: "Selesai", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))), 
                          child: Text(_endTime.format(ctx))
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 15),
                
                TextField(
                  controller: _reasonController,
                  maxLines: 3,
                  decoration: InputDecoration(labelText: "Pekerjaan yang dilakukan", border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                ),
                const SizedBox(height: 20),
                
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : () async {
                      if (_reasonController.text.isEmpty) {
                        ScaffoldMessenger.of(stContext).showSnackBar(const SnackBar(content: Text("Alasan wajib diisi"), backgroundColor: Colors.red));
                        return;
                      }
                      
                      setModalState(() => _isSubmitting = true);
                      LoadingDialog.show(context, message: "Mengajukan lembur...");
                      
                      try {
                        final startStr = "${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}";
                        final endStr = "${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}";

                        final res = await ApiService.submitOvertime({
                          'date': DateFormat('yyyy-MM-dd').format(_selectedDate),
                          'start_time': startStr,
                          'end_time': endStr,
                          'reason': _reasonController.text,
                        });
                        
                        LoadingDialog.hide(context);
                        if (res['status'] == 'success' || res['id'] != null) {
                          Navigator.pop(ctx);
                          _fetchOvertimes();
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Berhasil mengajukan lembur"), backgroundColor: Colors.green));
                        } else {
                          final msg = res['message'] ?? (res['errors']?.toString() ?? "Gagal mengajukan lembur");
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
        title: Text("Riwayat Lembur", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: _isLoading 
          ? const SimpleListSkeleton() 
          : RefreshIndicator(
              onRefresh: _fetchOvertimes,
              child: _overtimes.isEmpty 
                  ? Center(child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.more_time, size: 80, color: Colors.grey[300]),
                        const SizedBox(height: 15),
                        const Text("Belum ada riwayat lembur"),
                      ],
                    ))
                  : ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: _overtimes.length,
                      itemBuilder: (context, index) {
                        final ot = _overtimes[index];
                        final status = ot['status'];
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
                                child: Icon(Icons.timer_outlined, color: statusColor),
                              ),
                              const SizedBox(width: 15),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(ot['reason'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16), maxLines: 1, overflow: TextOverflow.ellipsis),
                                    const SizedBox(height: 4),
                                    Text("${ot['date']} (${ot['start_time']} - ${ot['end_time']})", style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
                                  if (status != 'rejected')
                                    IconButton(
                                      constraints: BoxConstraints(),
                                      padding: EdgeInsets.only(top: 8),
                                      icon: Icon(Icons.picture_as_pdf, color: primaryColor, size: 20), 
                                      onPressed: () => ApiService.launchPdf('overtime', ot['id']),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddOvertimeDialog,
        backgroundColor: primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}
