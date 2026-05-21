import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../api/api_service.dart';
import '../widgets/skeleton_loading.dart';
import '../widgets/loading_overlay.dart';

class AttendanceCorrectionScreen extends StatefulWidget {
  @override
  _AttendanceCorrectionScreenState createState() =>
      _AttendanceCorrectionScreenState();
}

class _AttendanceCorrectionScreenState
    extends State<AttendanceCorrectionScreen> {
  List<dynamic> _corrections = [];
  bool _isLoading = true;

  final Color primaryColor = const Color(0xFF800000);

  @override
  void initState() {
    super.initState();
    _fetchCorrections();
  }

  Future<void> _fetchCorrections() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getAttendanceCorrections();
    if (mounted) {
      setState(() {
        _corrections = data ?? [];
        _isLoading = false;
      });
    }
  }

  void _showCreateModal() async {
    // First fetch attendance history
    final history = await ApiService.getAttendanceHistory();
    if (history == null || history.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Tidak ada riwayat absen yang bisa dikoreksi."),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    // State for form
    dynamic selectedAttendance;
    String correctionType = 'missing_checkout';
    TimeOfDay? correctedCheckOut;
    TimeOfDay? correctedCheckIn;
    final reasonController = TextEditingController();
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(25)),
              ),
              padding: EdgeInsets.only(
                left: 25,
                right: 25,
                top: 25,
                bottom: MediaQuery.of(context).viewInsets.bottom + 25,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text("Ajukan Koreksi Absen",
                            style: GoogleFonts.inter(
                                fontSize: 20, fontWeight: FontWeight.bold)),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      "Pilih absen yang ingin dikoreksi dan isi data yang benar.",
                      style: TextStyle(color: Colors.grey[600], fontSize: 13),
                    ),
                    const SizedBox(height: 20),

                    // Select Attendance
                    Text("Pilih Tanggal Absen",
                        style: GoogleFonts.outfit(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey[300]!),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<dynamic>(
                          value: selectedAttendance,
                          hint: const Text("-- Pilih tanggal absen --",
                              style: TextStyle(fontSize: 13)),
                          isExpanded: true,
                          items: history.map<DropdownMenuItem<dynamic>>((att) {
                            final date = att['date'] ?? '-';
                            final checkIn = att['check_in_time'] ?? '--:--';
                            final checkOut =
                                att['check_out_time'] ?? '❌ BELUM';
                            return DropdownMenuItem(
                              value: att,
                              child: Text(
                                "$date | Masuk: $checkIn | Pulang: $checkOut",
                                style: const TextStyle(fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }).toList(),
                          onChanged: (val) {
                            setModalState(() => selectedAttendance = val);
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Correction Type
                    Text("Jenis Koreksi",
                        style: GoogleFonts.outfit(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey[300]!),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: correctionType,
                          isExpanded: true,
                          items: const [
                            DropdownMenuItem(
                                value: 'missing_checkout',
                                child: Text("Lupa Absen Pulang",
                                    style: TextStyle(fontSize: 13))),
                            DropdownMenuItem(
                                value: 'wrong_time',
                                child: Text("Koreksi Waktu (Salah Jam)",
                                    style: TextStyle(fontSize: 13))),
                          ],
                          onChanged: (val) {
                            setModalState(() => correctionType = val!);
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Time Pickers
                    if (correctionType == 'wrong_time') ...[
                      Text("Jam Masuk yang Benar",
                          style: GoogleFonts.outfit(
                              fontSize: 14, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      _buildTimePicker(
                        context,
                        correctedCheckIn,
                        (picked) =>
                            setModalState(() => correctedCheckIn = picked),
                      ),
                      const SizedBox(height: 16),
                    ],

                    Text(
                        correctionType == 'missing_checkout'
                            ? "Jam Pulang Seharusnya"
                            : "Jam Pulang yang Benar",
                        style: GoogleFonts.outfit(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    _buildTimePicker(
                      context,
                      correctedCheckOut,
                      (picked) =>
                          setModalState(() => correctedCheckOut = picked),
                    ),
                    const SizedBox(height: 16),

                    // Reason
                    Text("Alasan Koreksi",
                        style: GoogleFonts.outfit(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: reasonController,
                      maxLines: 3,
                      decoration: InputDecoration(
                        hintText:
                            "Contoh: Lupa absen pulang karena terburu-buru...",
                        hintStyle:
                            const TextStyle(fontSize: 13, color: Colors.grey),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.all(14),
                      ),
                    ),
                    const SizedBox(height: 25),

                    // Submit Button
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                if (selectedAttendance == null) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content:
                                            Text("Pilih tanggal absen dulu!"),
                                        backgroundColor: Colors.red),
                                  );
                                  return;
                                }
                                if (correctedCheckOut == null) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content: Text(
                                            "Jam pulang koreksi wajib diisi!"),
                                        backgroundColor: Colors.red),
                                  );
                                  return;
                                }
                                if (reasonController.text.trim().isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content:
                                            Text("Alasan koreksi wajib diisi!"),
                                        backgroundColor: Colors.red),
                                  );
                                  return;
                                }

                                setModalState(() => isSubmitting = true);
                                LoadingDialog.show(context, message: "Mengajukan koreksi absen...");

                                try {
                                  final payload = <String, dynamic>{
                                    'attendance_id': selectedAttendance['id'],
                                    'correction_type': correctionType,
                                    'corrected_check_out':
                                        '${correctedCheckOut!.hour.toString().padLeft(2, '0')}:${correctedCheckOut!.minute.toString().padLeft(2, '0')}',
                                    'reason': reasonController.text.trim(),
                                  };

                                  if (correctedCheckIn != null &&
                                      correctionType == 'wrong_time') {
                                    payload['corrected_check_in'] =
                                        '${correctedCheckIn!.hour.toString().padLeft(2, '0')}:${correctedCheckIn!.minute.toString().padLeft(2, '0')}';
                                  }

                                  final result =
                                      await ApiService.submitAttendanceCorrection(
                                          payload);

                                  LoadingDialog.hide(context);

                                  if (result['status'] == 'success' ||
                                      result['status'] == true) {
                                    Navigator.pop(context);
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(result['message'] ??
                                            "Koreksi berhasil diajukan!"),
                                        backgroundColor: Colors.green,
                                      ),
                                    );
                                    _fetchCorrections();
                                  } else {
                                    setModalState(() => isSubmitting = false);
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(result['message'] ??
                                            "Gagal mengajukan koreksi."),
                                        backgroundColor: Colors.red,
                                      ),
                                    );
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
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(15)),
                        ),
                        child: isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2))
                            : Text("Kirim Pengajuan Koreksi",
                                style: GoogleFonts.outfit(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16)),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildTimePicker(
      BuildContext context, TimeOfDay? time, Function(TimeOfDay) onPicked) {
    return InkWell(
      onTap: () async {
        final picked = await showTimePicker(
          context: context,
          initialTime: time ?? TimeOfDay.now(),
          builder: (context, child) {
            return Theme(
              data: ThemeData.light().copyWith(
                colorScheme: ColorScheme.light(primary: primaryColor),
              ),
              child: child!,
            );
          },
        );
        if (picked != null) onPicked(picked);
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey[300]!),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(Icons.access_time, color: primaryColor, size: 20),
            const SizedBox(width: 10),
            Text(
              time != null
                  ? '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}'
                  : 'Pilih Waktu',
              style: TextStyle(
                  fontSize: 14,
                  color: time != null ? Colors.black87 : Colors.grey),
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'approved':
        return Colors.green;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  String _getStatusText(String status) {
    switch (status) {
      case 'approved':
        return 'Disetujui';
      case 'rejected':
        return 'Ditolak';
      default:
        return 'Menunggu';
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'approved':
        return Icons.check_circle;
      case 'rejected':
        return Icons.cancel;
      default:
        return Icons.hourglass_empty;
    }
  }

  String _getCorrectionTypeText(String type) {
    switch (type) {
      case 'missing_checkout':
        return 'Lupa Absen Pulang';
      case 'wrong_time':
        return 'Koreksi Waktu';
      default:
        return type;
    }
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '-';
    try {
      final dt = DateTime.parse(dateStr).toLocal();
      return DateFormat('dd MMM yyyy', 'id_ID').format(dt);
    } catch (e) {
      return dateStr;
    }
  }

  String _formatTime(String? dateStr) {
    if (dateStr == null) return '--:--';
    try {
      final dt = DateTime.parse(dateStr).toLocal();
      return DateFormat('HH:mm').format(dt);
    } catch (e) {
      return '--:--';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBFBFB),
      appBar: AppBar(
        title: Text("Koreksi Absen",
            style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateModal,
        backgroundColor: primaryColor,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text("Ajukan Koreksi",
            style: GoogleFonts.outfit(
                color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchCorrections,
        color: primaryColor,
        child: _isLoading
            ? const SimpleListSkeleton()
            : _corrections.isEmpty
                ? ListView(
                    children: [
                      SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                      Center(
                        child: Column(
                          children: [
                            Icon(Icons.edit_calendar_outlined,
                                size: 60, color: Colors.grey[300]),
                            const SizedBox(height: 15),
                            Text("Belum ada koreksi absen",
                                style: GoogleFonts.outfit(
                                    fontSize: 16,
                                    color: Colors.grey[500],
                                    fontWeight: FontWeight.w500)),
                            const SizedBox(height: 5),
                            Text("Klik tombol di bawah untuk mengajukan",
                                style: TextStyle(
                                    fontSize: 13, color: Colors.grey[400])),
                          ],
                        ),
                      ),
                    ],
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _corrections.length,
                    itemBuilder: (context, index) {
                      final item = _corrections[index];
                      final status = item['status'] ?? 'pending';
                      final statusColor = _getStatusColor(status);
                      final corrType = item['correction_type'] ?? '';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => _showDetailDialog(item),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Top Row: Type + Status
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: corrType == 'missing_checkout'
                                            ? Colors.orange.withOpacity(0.1)
                                            : Colors.blue.withOpacity(0.1),
                                        borderRadius:
                                            BorderRadius.circular(20),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(
                                            corrType == 'missing_checkout'
                                                ? Icons.timer_off
                                                : Icons.edit_calendar,
                                            size: 14,
                                            color:
                                                corrType == 'missing_checkout'
                                                    ? Colors.orange[700]
                                                    : Colors.blue[700],
                                          ),
                                          const SizedBox(width: 5),
                                          Text(
                                            _getCorrectionTypeText(corrType),
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: corrType ==
                                                      'missing_checkout'
                                                  ? Colors.orange[700]
                                                  : Colors.blue[700],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: statusColor.withOpacity(0.1),
                                        borderRadius:
                                            BorderRadius.circular(20),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(_getStatusIcon(status),
                                              size: 14, color: statusColor),
                                          const SizedBox(width: 4),
                                          Text(
                                            _getStatusText(status),
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: statusColor,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),

                                // Date info
                                Row(
                                  children: [
                                    Icon(Icons.calendar_today,
                                        size: 16, color: Colors.grey[500]),
                                    const SizedBox(width: 8),
                                    Text(
                                      "Tanggal Absen: ${_formatDate(item['attendance']?['check_in'])}",
                                      style: GoogleFonts.outfit(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.grey[800],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),

                                // Correction detail
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.grey[50],
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text("Data Asli",
                                                style: TextStyle(
                                                    fontSize: 10,
                                                    color: Colors.grey[500],
                                                    fontWeight:
                                                        FontWeight.w600)),
                                            const SizedBox(height: 2),
                                            Text(
                                              "Pulang: ${_formatTime(item['attendance']?['check_out']) == '--:--' ? '❌ Tidak Ada' : _formatTime(item['attendance']?['check_out'])}",
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w500),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Icon(Icons.arrow_forward,
                                          size: 16, color: primaryColor),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text("Koreksi",
                                                style: TextStyle(
                                                    fontSize: 10,
                                                    color: Colors.green[700],
                                                    fontWeight:
                                                        FontWeight.w600)),
                                            const SizedBox(height: 2),
                                            Text(
                                              "Pulang: ${item['corrected_check_out_time'] ?? '-'}",
                                              style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600,
                                                  color: Colors.green[700]),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 8),

                                // Reason
                                Text(
                                  item['reason'] ?? '',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey[600],
                                      fontStyle: FontStyle.italic),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }

  void _showDetailDialog(dynamic item) {
    final status = item['status'] ?? 'pending';
    showDialog(
      context: context,
      builder: (ctx) {
        return Dialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("Detail Koreksi",
                          style: GoogleFonts.outfit(
                              fontSize: 18, fontWeight: FontWeight.bold)),
                      IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(ctx)),
                    ],
                  ),
                  const Divider(),
                  _detailRow("Status", _getStatusText(status),
                      color: _getStatusColor(status)),
                  _detailRow("Jenis",
                      _getCorrectionTypeText(item['correction_type'] ?? '')),
                  _detailRow("Tanggal Absen",
                      _formatDate(item['attendance']?['check_in'])),
                  const SizedBox(height: 10),

                  // Before / After comparison
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey[200]!),
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                    color: Colors.red[50],
                                    borderRadius: BorderRadius.circular(10)),
                                child: Column(
                                  children: [
                                    Text("DATA ASLI",
                                        style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.red[400])),
                                    const SizedBox(height: 4),
                                    Text(
                                        "Masuk: ${_formatTime(item['attendance']?['check_in'])}",
                                        style: const TextStyle(fontSize: 12)),
                                    Text(
                                        "Pulang: ${item['attendance']?['check_out'] != null ? _formatTime(item['attendance']?['check_out']) : '❌ Kosong'}",
                                        style: const TextStyle(fontSize: 12)),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                    color: Colors.green[50],
                                    borderRadius: BorderRadius.circular(10)),
                                child: Column(
                                  children: [
                                    Text("KOREKSI",
                                        style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.green[600])),
                                    const SizedBox(height: 4),
                                    if (item['corrected_check_in_time'] != null)
                                      Text(
                                          "Masuk: ${item['corrected_check_in_time']}",
                                          style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.green[700],
                                              fontWeight: FontWeight.w600)),
                                    Text(
                                        "Pulang: ${item['corrected_check_out_time'] ?? '-'}",
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.green[700],
                                            fontWeight: FontWeight.w600)),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),

                  _detailRow("Alasan", item['reason'] ?? '-'),
                  if (item['remark'] != null)
                    _detailRow("Catatan HR", item['remark'],
                        color: status == 'rejected' ? Colors.red : Colors.green),
                  if (item['approver'] != null)
                    _detailRow(
                        "Diproses Oleh", item['approver']?['name'] ?? '-'),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String value, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey[600],
                    fontWeight: FontWeight.w500)),
          ),
          Expanded(
            child: Text(value,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: color ?? Colors.black87)),
          ),
        ],
      ),
    );
  }
}
