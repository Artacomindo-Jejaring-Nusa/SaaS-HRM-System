import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:signature/signature.dart';
import 'dart:convert';
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
  Map<String, dynamic>? _userProfile;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getOvertimes();
    final profile = await ApiService.getProfile();
    if (mounted) {
      setState(() {
        _overtimes = data ?? [];
        _userProfile = profile;
        _isLoading = false;
      });
    }
  }

  String _getFormattedDateIndonesian() {
    final now = DateTime.now();
    final months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return "${now.day} ${months[now.month - 1]} ${now.year}";
  }

  String _getOvertimePeriod(Map<String, dynamic> overtime) {
    if (overtime['title'] != null && overtime['title'].toString().isNotEmpty) {
      return overtime['title'];
    }
    final items = overtime['items'] as List<dynamic>? ?? [];
    String? dateStr;
    if (items.isNotEmpty) {
      dateStr = items.first['date'];
    } else {
      dateStr = overtime['date'];
    }
    if (dateStr == null || dateStr.isEmpty) {
      dateStr = overtime['created_at'];
    }
    if (dateStr != null && dateStr.isNotEmpty) {
      try {
        final parsed = DateTime.parse(dateStr);
        final months = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return "${months[parsed.month - 1]} ${parsed.year}";
      } catch (_) {}
    }
    return "";
  }

  Widget _buildDetailCell(String text, {bool isHeader = false, TextAlign align = TextAlign.center, bool isBold = false, bool isMuted = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
      child: Text(
        text,
        textAlign: align,
        style: GoogleFonts.inter(
          fontSize: 9.5,
          fontWeight: (isHeader || isBold) ? FontWeight.bold : FontWeight.normal,
          color: isHeader 
              ? const Color(0xFF1F4E79) 
              : (isMuted ? Colors.grey[400] : Colors.black),
        ),
      ),
    );
  }

  Widget _buildDetailTable1(Map<String, dynamic> overtime) {
    final employeeName = overtime['user']?['name'] ?? _userProfile?['name'] ?? '-';
    
    final dbItems = overtime['items'] as List<dynamic>? ?? [];
    final List<Map<String, dynamic>> itemsList = [];
    if (dbItems.isNotEmpty) {
      for (var item in dbItems) {
        itemsList.add({
          'start_time': item['start_time'] ?? '',
          'end_time': item['end_time'] ?? '',
        });
      }
    } else if (overtime['date'] != null) {
      itemsList.add({
        'start_time': overtime['start_time'] ?? '',
        'end_time': overtime['end_time'] ?? '',
      });
    }

    final int rowCount = itemsList.length;
    final int padCount = (5 - rowCount).clamp(0, 5);

    List<TableRow> tableRows = [];

    tableRows.add(
      TableRow(
        decoration: const BoxDecoration(color: Color(0xFFD9E1F2)),
        children: [
          _buildDetailCell("No", isHeader: true),
          _buildDetailCell("Nama", isHeader: true),
          _buildDetailCell("Jam Mulai", isHeader: true),
          _buildDetailCell("Jam Selesai", isHeader: true),
        ],
      ),
    );

    for (int i = 0; i < rowCount; i++) {
      final item = itemsList[i];
      final start = item['start_time'].toString().substring(0, 5);
      final end = item['end_time'].toString().substring(0, 5);
      tableRows.add(
        TableRow(
          children: [
            _buildDetailCell("${i + 1}", align: TextAlign.center),
            _buildDetailCell(employeeName, align: TextAlign.left, isBold: true),
            _buildDetailCell(start, align: TextAlign.center),
            _buildDetailCell(end, align: TextAlign.center),
          ],
        ),
      );
    }

    for (int i = 0; i < padCount; i++) {
      final idx = rowCount + i + 1;
      tableRows.add(
        TableRow(
          children: [
            _buildDetailCell("$idx", align: TextAlign.center, isMuted: true),
            _buildDetailCell(""),
            _buildDetailCell(""),
            _buildDetailCell(""),
          ],
        ),
      );
    }

    return Table(
      columnWidths: const {
        0: FixedColumnWidth(30),
        1: FlexColumnWidth(),
        2: FixedColumnWidth(70),
        3: FixedColumnWidth(70),
      },
      border: TableBorder.all(color: Colors.black, width: 0.8),
      children: tableRows,
    );
  }

  Widget _buildDetailTable2(Map<String, dynamic> overtime) {
    final dbItems = overtime['items'] as List<dynamic>? ?? [];
    final List<Map<String, dynamic>> itemsList = [];
    if (dbItems.isNotEmpty) {
      for (var item in dbItems) {
        itemsList.add({
          'date': item['date'] ?? '',
          'reason': item['reason'] ?? '',
        });
      }
    } else if (overtime['date'] != null) {
      itemsList.add({
        'date': overtime['date'] ?? '',
        'reason': overtime['reason'] ?? '',
      });
    }

    final int rowCount = itemsList.length;
    final int padCount = (5 - rowCount).clamp(0, 5);

    List<TableRow> tableRows = [];

    tableRows.add(
      TableRow(
        decoration: const BoxDecoration(color: Color(0xFFD9E1F2)),
        children: [
          _buildDetailCell("No", isHeader: true),
          _buildDetailCell("Untuk Melakukan Pekerjaan sebagaimana berikut ini :", isHeader: true, align: TextAlign.left),
        ],
      ),
    );

    for (int i = 0; i < rowCount; i++) {
      final item = itemsList[i];
      String formattedDate = '';
      if (item['date'].toString().isNotEmpty) {
        try {
          final parsedDate = DateTime.parse(item['date']);
          formattedDate = DateFormat('dd/MM/yyyy').format(parsedDate);
        } catch (_) {
          formattedDate = item['date'];
        }
      }
      final reasonText = item['reason'];
      tableRows.add(
        TableRow(
          children: [
            _buildDetailCell("${i + 1}", align: TextAlign.center),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
              child: RichText(
                textAlign: TextAlign.left,
                text: TextSpan(
                  style: GoogleFonts.inter(fontSize: 9.5, color: Colors.black),
                  children: [
                    TextSpan(text: formattedDate, style: const TextStyle(fontWeight: FontWeight.bold)),
                    if (formattedDate.isNotEmpty && reasonText.toString().isNotEmpty)
                      const TextSpan(text: " - "),
                    TextSpan(text: reasonText),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    for (int i = 0; i < padCount; i++) {
      final idx = rowCount + i + 1;
      tableRows.add(
        TableRow(
          children: [
            _buildDetailCell("$idx", align: TextAlign.center, isMuted: true),
            _buildDetailCell(""),
          ],
        ),
      );
    }

    return Table(
      columnWidths: const {
        0: FixedColumnWidth(30),
        1: FlexColumnWidth(),
      },
      border: TableBorder.all(color: Colors.black, width: 0.8),
      children: tableRows,
    );
  }

  Widget _buildDetailSignatures(Map<String, dynamic> overtime) {
    final status = overtime['status'] ?? 'pending';
    final employeeName = overtime['user']?['name'] ?? _userProfile?['name'] ?? 'Karyawan';
    final supervisorName = overtime['approver']?['name'] ?? overtime['user']?['supervisor']?['name'] ?? 'Operasional';

    String dateText = '';
    final createdAt = overtime['created_at'];
    if (createdAt != null && createdAt.toString().isNotEmpty) {
      try {
        final parsed = DateTime.parse(createdAt);
        final months = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        dateText = "Jakarta, ${parsed.day} ${months[parsed.month - 1]} ${parsed.year}";
      } catch (_) {
        dateText = "Jakarta, ${_getFormattedDateIndonesian()}";
      }
    } else {
      dateText = "Jakarta, ${_getFormattedDateIndonesian()}";
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            children: [
              Text(
                "Diketahui",
                style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.grey[800]),
              ),
              const SizedBox(height: 8),
              Container(
                height: 45,
                alignment: Alignment.center,
                child: status == 'approved'
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.green, width: 1.5),
                          borderRadius: BorderRadius.circular(4),
                          color: Colors.green[50],
                        ),
                        child: Text(
                          "VERIFIED",
                          style: GoogleFonts.inter(color: Colors.green, fontSize: 8, fontWeight: FontWeight.bold),
                        ),
                      )
                    : Text(
                        "— Belum Diverifikasi —",
                        style: GoogleFonts.inter(fontSize: 8, fontStyle: FontStyle.italic, color: Colors.grey[400]),
                      ),
              ),
              const SizedBox(height: 4),
              Text(
                "(Nazirin Nawawi)",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black),
              ),
              Text(
                "HR GA",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 8, color: Colors.grey[600]),
              ),
            ],
          ),
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Column(
            children: [
              Text(
                "Mengetahui",
                style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.grey[800]),
              ),
              const SizedBox(height: 8),
              Container(
                height: 45,
                alignment: Alignment.center,
                child: status == 'approved'
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.blue, width: 1.5),
                          borderRadius: BorderRadius.circular(4),
                          color: Colors.blue[50],
                        ),
                        child: Text(
                          "APPROVED",
                          style: GoogleFonts.inter(color: Colors.blue, fontSize: 8, fontWeight: FontWeight.bold),
                        ),
                      )
                    : status == 'rejected'
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.red, width: 1.5),
                              borderRadius: BorderRadius.circular(4),
                              color: Colors.red[50],
                            ),
                            child: Text(
                              "REJECTED",
                              style: GoogleFonts.inter(color: Colors.red, fontSize: 8, fontWeight: FontWeight.bold),
                            ),
                          )
                        : Text(
                            "— Belum Disetujui —",
                            style: GoogleFonts.inter(fontSize: 8, fontStyle: FontStyle.italic, color: Colors.grey[400]),
                          ),
              ),
              const SizedBox(height: 4),
              Text(
                "($supervisorName)",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black),
              ),
              Text(
                "Operasional",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 8, color: Colors.grey[600]),
              ),
            ],
          ),
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Column(
            children: [
              Text(
                dateText,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 7.5, color: Colors.grey[700]),
              ),
              Text(
                "Diajukan oleh:",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[800]),
              ),
              const SizedBox(height: 4),
              Container(
                height: 45,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[300]!),
                  borderRadius: BorderRadius.circular(4),
                  color: Colors.white,
                ),
                child: overtime['signature'] != null && overtime['signature'].toString().isNotEmpty
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: Builder(
                          builder: (context) {
                            final sigStr = overtime['signature'].toString();
                            if (sigStr.startsWith('data:image')) {
                              try {
                                final base64Data = sigStr.substring(sigStr.indexOf(',') + 1);
                                return Image.memory(
                                  base64Decode(base64Data),
                                  height: 45,
                                  width: double.infinity,
                                  fit: BoxFit.contain,
                                );
                              } catch (_) {}
                            }
                            return Image.network(
                              sigStr,
                              height: 45,
                              width: double.infinity,
                              fit: BoxFit.contain,
                              errorBuilder: (context, error, stackTrace) {
                                return Center(
                                  child: Text(
                                    "TTD",
                                    style: GoogleFonts.inter(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.grey[600]),
                                  ),
                                );
                              },
                            );
                          }
                        ),
                      )
                    : Center(
                        child: Text(
                          "— Tanpa TTD —",
                          style: GoogleFonts.inter(fontSize: 8, fontStyle: FontStyle.italic, color: Colors.grey[400]),
                        ),
                      ),
              ),
              const SizedBox(height: 4),
              Text(
                "($employeeName)",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black),
              ),
              Text(
                "Karyawan",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 8, color: Colors.transparent),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showDetailBottomSheet(Map<String, dynamic> overtime) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final status = overtime['status'] ?? 'pending';
        Color statusColor = Colors.orange;
        if (status == 'approved') statusColor = Colors.green;
        if (status == 'rejected') statusColor = Colors.red;
        if (status == 'draft') statusColor = Colors.grey;

        final officeName = overtime['user']?['office']?['name'] ?? _userProfile?['office']?['name'] ?? "KP Cakung";

        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: EdgeInsets.only(
            top: 16,
            left: 16,
            right: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.85,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Text(
                        "Detail Pengajuan Lembur",
                        style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          status.toUpperCase(),
                          style: TextStyle(color: statusColor, fontSize: 9, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.pop(ctx),
                  )
                ],
              ),
              const Divider(height: 1),
              const SizedBox(height: 12),
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: Colors.grey[300]!),
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4, offset: const Offset(0, 2)),
                          ],
                        ),
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        "Form. Lembur utk",
                                        style: GoogleFonts.inter(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF1F4E79),
                                        ),
                                      ),
                                      Text(
                                        officeName,
                                        style: GoogleFonts.inter(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF1F4E79),
                                          decoration: TextDecoration.underline,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text("Kepada Yth,", style: GoogleFonts.inter(fontSize: 8.5, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                                    Text("HRD - Personalia", style: GoogleFonts.inter(fontSize: 8.5, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                                    Text("PT. Narwastu Group", style: GoogleFonts.inter(fontSize: 8.5, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                                    Text("Di Tempat", style: GoogleFonts.inter(fontSize: 8.5, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text("Dengan Hormat,", style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                            const SizedBox(height: 2),
                            Text(
                              "Bersama ini diberitahukan bahwa kami menugaskan karyawan berikut untuk melakukan kerja lembur :",
                              style: GoogleFonts.inter(fontSize: 9.5, color: Colors.grey[800]),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              "Pada hari, Tanggal : ${_getOvertimePeriod(overtime)}",
                              style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.grey[800]),
                            ),
                            const SizedBox(height: 14),
                            Text(
                              "RINCIAN WAKTU LEMBUR",
                              style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[700]),
                            ),
                            const SizedBox(height: 6),
                            _buildDetailTable1(overtime),
                            const SizedBox(height: 14),
                            Text(
                              "PEKERJAAN YANG DILAKUKAN",
                              style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[700]),
                            ),
                            const SizedBox(height: 6),
                            _buildDetailTable2(overtime),
                            const SizedBox(height: 14),
                            Text(
                              "Demikian Untuk di ketahui",
                              style: GoogleFonts.inter(fontSize: 9.5, color: Colors.grey[800]),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              "Catatan : Form lembur di berikan ke HRD sebelum melakukan aktifitas",
                              style: GoogleFonts.inter(fontSize: 8.5, fontWeight: FontWeight.bold, fontStyle: FontStyle.italic, color: Colors.grey[600]),
                            ),
                            const SizedBox(height: 16),
                            Container(height: 0.8, color: Colors.grey[200]),
                            const SizedBox(height: 12),
                            _buildDetailSignatures(overtime),
                          ],
                        ),
                      ),
                      if (overtime['remark'] != null && overtime['remark'].toString().isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: status == 'rejected' ? Colors.red[50] : Colors.green[50],
                            border: Border.all(color: status == 'rejected' ? Colors.red[200]! : Colors.green[200]!),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                status == 'rejected' ? "Catatan Penolakan:" : "Catatan Persetujuan:",
                                style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 11, color: status == 'rejected' ? Colors.red[950] : Colors.green[950]),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                overtime['remark'],
                                style: GoogleFonts.inter(fontSize: 12, color: status == 'rejected' ? Colors.red[900] : Colors.green[900]),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _deleteOvertime(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Hapus Draf"),
        content: const Text("Apakah Anda yakin ingin menghapus draf pengajuan lembur ini?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Hapus", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    LoadingDialog.show(context, message: "Menghapus draf...");
    try {
      final res = await ApiService.deleteOvertime(id);
      LoadingDialog.hide(context);
      if (res['status'] == 'success') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Draf berhasil dihapus"), backgroundColor: Colors.green),
        );
        _fetchData();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? "Gagal menghapus draf"), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      LoadingDialog.hide(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Riwayat Lembur", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
      ),
      backgroundColor: const Color(0xFFF9FAFB),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF800000)))
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Riwayat Pengajuan Lembur", style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  Expanded(
                    child: _overtimes.isEmpty
                        ? Center(
                            child: Text(
                              "Belum ada riwayat pengajuan lembur",
                              style: GoogleFonts.inter(color: Colors.grey, fontSize: 14),
                            ),
                          )
                        : ListView.separated(
                            itemCount: _overtimes.length,
                            separatorBuilder: (c, i) => const SizedBox(height: 10),
                            itemBuilder: (ctx, index) {
                              final ot = _overtimes[index];
                              final String rawStatus = ot['status'] ?? 'pending';
                              final items = ot['items'] as List<dynamic>? ?? [];
                              final int entryCount = items.length;

                              Color statusColor;
                              String statusText;
                              if (rawStatus == 'approved') {
                                statusColor = Colors.green;
                                statusText = "Approved";
                              } else if (rawStatus == 'rejected') {
                                statusColor = Colors.red;
                                statusText = "Rejected";
                              } else if (rawStatus == 'draft') {
                                statusColor = Colors.grey;
                                statusText = "Draft";
                              } else {
                                statusColor = Colors.orange;
                                statusText = "Pending";
                              }

                              String descText = ot['title'] ?? '';
                              if (descText.isEmpty) {
                                if (items.isNotEmpty) {
                                  descText = items.first['reason'] ?? '-';
                                } else {
                                  descText = ot['reason'] ?? '-';
                                }
                              }

                              String dateRange = '';
                              if (items.isNotEmpty) {
                                if (items.length == 1) {
                                  dateRange = items.first['date'] ?? '';
                                } else {
                                  dateRange = "${items.first['date']} s/d ${items.last['date']}";
                                }
                              } else {
                                dateRange = ot['date'] ?? '';
                              }

                              return InkWell(
                                onTap: () => _showDetailBottomSheet(ot),
                                child: Container(
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.grey[200]!),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              descText,
                                              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              dateRange,
                                              style: GoogleFonts.inter(color: Colors.grey[600], fontSize: 12),
                                            ),
                                            if (entryCount > 1) ...[
                                              const SizedBox(height: 4),
                                              Text(
                                                "Total: $entryCount entry lembur",
                                                style: GoogleFonts.inter(color: Colors.grey[500], fontSize: 11),
                                              ),
                                            ]
                                          ],
                                        ),
                                      ),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                            decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                                            child: Text(statusText, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold)),
                                          ),
                                          const SizedBox(height: 6),
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              if (rawStatus == 'draft') ...[
                                                IconButton(
                                                  constraints: const BoxConstraints(),
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                  icon: const Icon(Icons.edit, color: Colors.blue, size: 20),
                                                  onPressed: () {
                                                    Navigator.push(
                                                      context,
                                                      MaterialPageRoute(
                                                        builder: (context) => OvertimeFormScreen(
                                                          userProfile: _userProfile,
                                                          existingOvertime: ot,
                                                          onSubmitted: _fetchData,
                                                        ),
                                                      ),
                                                    );
                                                  },
                                                ),
                                                IconButton(
                                                  constraints: const BoxConstraints(),
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                  icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                                                  onPressed: () => _deleteOvertime(ot['id']),
                                                ),
                                              ] else if (rawStatus != 'rejected') ...[
                                                Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    IconButton(
                                                      constraints: const BoxConstraints(),
                                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                      icon: Icon(Icons.picture_as_pdf, color: primaryColor, size: 20),
                                                      onPressed: () => ApiService.launchPdf('overtime', ot['id']),
                                                    ),
                                                    IconButton(
                                                      constraints: const BoxConstraints(),
                                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                      icon: const Icon(Icons.table_view, color: Colors.green, size: 20),
                                                      onPressed: () => ApiService.launchExcel('overtime', ot['id']),
                                                    ),
                                                  ],
                                                ),
                                              ]
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
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => OvertimeFormScreen(
                userProfile: _userProfile,
                onSubmitted: _fetchData,
              ),
            ),
          );
        },
        backgroundColor: primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}

class DottedLine extends StatelessWidget {
  final Color color;
  const DottedLine({this.color = const Color(0xFFBDBDBD), Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(double.infinity, 1),
      painter: _DottedLinePainter(color: color),
    );
  }
}

class _DottedLinePainter extends CustomPainter {
  final Color color;
  _DottedLinePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;
    
    double max = size.width;
    double dashWidth = 3;
    double dashSpace = 3;
    double startX = 0;
    while (startX < max) {
      canvas.drawLine(Offset(startX, 0), Offset(startX + dashWidth, 0), paint);
      startX += dashWidth + dashSpace;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class OvertimeFormScreen extends StatefulWidget {
  final Map<String, dynamic>? userProfile;
  final Map<String, dynamic>? existingOvertime;
  final VoidCallback onSubmitted;

  const OvertimeFormScreen({
    Key? key,
    required this.userProfile,
    this.existingOvertime,
    required this.onSubmitted,
  }) : super(key: key);

  @override
  _OvertimeFormScreenState createState() => _OvertimeFormScreenState();
}

class _OvertimeFormScreenState extends State<OvertimeFormScreen> {
  final Color primaryColor = const Color(0xFF800000);
  
  final _titleController = TextEditingController();
  List<Map<String, dynamic>> _items = [];
  
  final SignatureController _sigController = SignatureController(
    penStrokeWidth: 3,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );
  
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.existingOvertime != null) {
      final ot = widget.existingOvertime!;
      _titleController.text = ot['title'] ?? '';
      
      final dbItems = ot['items'] as List<dynamic>? ?? [];
      if (dbItems.isNotEmpty) {
        for (var item in dbItems) {
          _items.add({
            'date': DateTime.parse(item['date']),
            'start_time': _parseTimeOfDay(item['start_time']),
            'end_time': _parseTimeOfDay(item['end_time']),
            'reason': TextEditingController(text: item['reason']),
          });
        }
      } else if (ot['date'] != null) {
        _items.add({
          'date': DateTime.parse(ot['date']),
          'start_time': _parseTimeOfDay(ot['start_time']),
          'end_time': _parseTimeOfDay(ot['end_time']),
          'reason': TextEditingController(text: ot['reason']),
        });
      }
    }

    if (_items.isEmpty) {
      _addNewItem();
    }
  }

  TimeOfDay _parseTimeOfDay(String? timeStr) {
    if (timeStr == null || timeStr.isEmpty) return const TimeOfDay(hour: 17, minute: 0);
    try {
      final parts = timeStr.split(':');
      return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
    } catch (_) {
      return const TimeOfDay(hour: 17, minute: 0);
    }
  }

  void _addNewItem() {
    setState(() {
      _items.add({
        'date': DateTime.now(),
        'start_time': const TimeOfDay(hour: 17, minute: 0),
        'end_time': const TimeOfDay(hour: 19, minute: 0),
        'reason': TextEditingController(),
      });
    });
  }

  void _removeItem(int index) {
    if (_items.length > 1) {
      setState(() {
        _items[index]['reason'].dispose();
        _items.removeAt(index);
      });
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    for (var item in _items) {
      item['reason'].dispose();
    }
    _sigController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(int index) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _items[index]['date'] as DateTime,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime(2027),
    );
    if (picked != null && picked != _items[index]['date']) {
      setState(() {
        _items[index]['date'] = picked;
      });
    }
  }

  Future<void> _selectStartTime(int index) async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _items[index]['start_time'] as TimeOfDay,
    );
    if (picked != null && picked != _items[index]['start_time']) {
      setState(() {
        _items[index]['start_time'] = picked;
      });
    }
  }

  Future<void> _selectEndTime(int index) async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _items[index]['end_time'] as TimeOfDay,
    );
    if (picked != null && picked != _items[index]['end_time']) {
      setState(() {
        _items[index]['end_time'] = picked;
      });
    }
  }

  String _getFormattedDateIndonesian() {
    final now = DateTime.now();
    final months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return "${now.day} ${months[now.month - 1]} ${now.year}";
  }

  Widget _buildTableCell(String text, {bool isHeader = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: isHeader ? FontWeight.bold : FontWeight.normal,
          color: isHeader ? const Color(0xFF1F4E79) : Colors.black,
        ),
      ),
    );
  }

  Widget _buildFormTable() {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.black, width: 1),
      ),
      child: Table(
        columnWidths: const {
          0: FixedColumnWidth(30),
          1: FlexColumnWidth(),
          2: FixedColumnWidth(40),
        },
        border: const TableBorder(
          horizontalInside: BorderSide(color: Colors.black, width: 1),
          verticalInside: BorderSide(color: Colors.black, width: 1),
        ),
        children: [
          TableRow(
            decoration: const BoxDecoration(
              color: Color(0xFFD9E1F2),
            ),
            children: [
              _buildTableCell("No", isHeader: true),
              _buildTableCell("Rincian Jam & Pekerjaan Lembur", isHeader: true),
              _buildTableCell("Aksi", isHeader: true),
            ],
          ),
          ...List.generate(_items.length, (idx) {
            final item = _items[idx];
            return TableRow(
              children: [
                TableCell(
                  verticalAlignment: TableCellVerticalAlignment.middle,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      "${idx + 1}",
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[800]),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.calendar_today, size: 10, color: Colors.grey[600]),
                          const SizedBox(width: 4),
                          Text("Tanggal: ", style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[700])),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => _selectDate(idx),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
                                decoration: BoxDecoration(
                                  border: Border(bottom: BorderSide(color: Colors.grey[400]!)),
                                ),
                                child: Text(
                                  DateFormat('dd/MM/yyyy').format(item['date'] as DateTime),
                                  style: GoogleFonts.inter(fontSize: 10, color: Colors.black, fontWeight: FontWeight.w500),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.access_time, size: 10, color: Colors.grey[600]),
                          const SizedBox(width: 4),
                          Text("Mulai: ", style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[700])),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => _selectStartTime(idx),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
                                decoration: BoxDecoration(
                                  border: Border(bottom: BorderSide(color: Colors.grey[400]!)),
                                ),
                                child: Text(
                                  (item['start_time'] as TimeOfDay).format(context),
                                  style: GoogleFonts.inter(fontSize: 10, color: Colors.black),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text("Selesai: ", style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[700])),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => _selectEndTime(idx),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
                                decoration: BoxDecoration(
                                  border: Border(bottom: BorderSide(color: Colors.grey[400]!)),
                                ),
                                child: Text(
                                  (item['end_time'] as TimeOfDay).format(context),
                                  style: GoogleFonts.inter(fontSize: 10, color: Colors.black),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.work_outline, size: 10, color: Colors.grey[600]),
                          const SizedBox(width: 4),
                          Text("Pekerjaan: ", style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[700])),
                          Expanded(
                            child: TextField(
                              controller: item['reason'] as TextEditingController,
                              style: GoogleFonts.inter(fontSize: 10, color: Colors.black),
                              maxLines: null,
                              decoration: InputDecoration(
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
                                hintText: "Tulis rincian pekerjaan...",
                                hintStyle: GoogleFonts.inter(fontSize: 9, color: Colors.grey[400]),
                                enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey[400]!)),
                                focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Colors.blue)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                TableCell(
                  verticalAlignment: TableCellVerticalAlignment.middle,
                  child: IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.red, size: 18),
                    onPressed: _items.length > 1 ? () => _removeItem(idx) : null,
                  ),
                ),
              ],
            );
          }),
        ],
      ),
    );
  }

  Widget _buildSignaturesSection() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            children: [
              Text(
                "Diketahui",
                style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[800]),
              ),
              const SizedBox(height: 12),
              Container(
                height: 50,
                alignment: Alignment.center,
                child: Text(
                  "— HR GA —",
                  style: GoogleFonts.inter(fontSize: 9, fontStyle: FontStyle.italic, color: Colors.grey[400]),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                "(Nazirin Nawawi)",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black),
              ),
              Text(
                "HR GA",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 8, color: Colors.grey[600]),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            children: [
              Text(
                "Mengetahui",
                style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[800]),
              ),
              const SizedBox(height: 12),
              Container(
                height: 50,
                alignment: Alignment.center,
                child: Text(
                  "— Operasional —",
                  style: GoogleFonts.inter(fontSize: 9, fontStyle: FontStyle.italic, color: Colors.grey[400]),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                "(Operasional)",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black),
              ),
              Text(
                "Operasional",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 8, color: Colors.grey[600]),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            children: [
              Text(
                "Jakarta, ${_getFormattedDateIndonesian()}",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 8, color: Colors.grey[700]),
              ),
              Text(
                "Diajukan oleh:",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[800]),
              ),
              const SizedBox(height: 4),
              Container(
                height: 50,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[300]!),
                  borderRadius: BorderRadius.circular(4),
                  color: Colors.white,
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: Signature(controller: _sigController, height: 50, backgroundColor: Colors.white),
                ),
              ),
              GestureDetector(
                onTap: () => _sigController.clear(),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    "Hapus TTD",
                    style: GoogleFonts.inter(fontSize: 8, color: Colors.red[700], fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              Text(
                "(${widget.userProfile?['name'] ?? 'Karyawan'})",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black),
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.existingOvertime != null ? "Edit Draf Lembur" : "Form Pengajuan Lembur", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
      ),
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 6, offset: const Offset(0, 3)),
                  ],
                  border: Border.all(color: Colors.grey[300]!),
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "Form. Lembur utk",
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF1F4E79),
                                ),
                              ),
                              Text(
                                widget.userProfile?['office']?['name'] ?? "KP Cakung",
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF1F4E79),
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text("Kepada Yth,", style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                            Text("HRD - Personalia", style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                            Text("PT. Narwastu Group", style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                            Text("Di Tempat", style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text("Dengan Hormat,", style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                    const SizedBox(height: 4),
                    Text(
                      "Bersama ini diberitahukan bahwa kami menugaskan karyawan berikut untuk melakukan kerja lembur :",
                      style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[800]),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          "Pada hari, Tanggal : ",
                          style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[800]),
                        ),
                        Expanded(
                          child: TextField(
                            controller: _titleController,
                            style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black),
                            decoration: InputDecoration(
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              hintText: "Contoh: Juni 2026",
                              hintStyle: GoogleFonts.inter(fontSize: 10, color: Colors.grey[400]),
                              enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
                              focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Colors.blue)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "RINCIAN JAM & PEKERJAAN LEMBUR",
                          style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[800]),
                        ),
                        GestureDetector(
                          onTap: _addNewItem,
                          child: Row(
                            children: [
                              const Icon(Icons.add, size: 12, color: Colors.blue),
                              const SizedBox(width: 2),
                              Text(
                                "Tambah Rincian",
                                style: GoogleFonts.inter(color: Colors.blue, fontWeight: FontWeight.bold, fontSize: 10),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _buildFormTable(),
                    const SizedBox(height: 16),
                    Text(
                      "Demikian Untuk di ketahui",
                      style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[800]),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "Catatan : Form lembur di berikan ke HRD sebelum melakukan aktifitas",
                      style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, fontStyle: FontStyle.italic, color: Colors.grey[600]),
                    ),
                    const SizedBox(height: 20),
                    Container(height: 1, color: Colors.grey[300]),
                    const SizedBox(height: 16),
                    _buildSignaturesSection(),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : () => _submitForm('draft'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.grey[850],
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: const BorderSide(color: Colors.grey),
                        ),
                      ),
                      child: Text("SIMPAN DRAF", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : () => _submitForm('pending'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryColor,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text("KIRIM PENGAJUAN", style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submitForm(String status) async {
    final isDraft = status == 'draft';

    // Submitting requires a signature and filled items
    if (!isDraft) {
      if (_sigController.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Tanda tangan wajib diisi"), backgroundColor: Colors.red),
        );
        return;
      }
      
      for (var item in _items) {
        final reason = (item['reason'] as TextEditingController).text;
        if (reason.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Semua pekerjaan pada rincian lembur wajib diisi"), backgroundColor: Colors.red),
          );
          return;
        }
      }
    }

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: isDraft ? "Menyimpan draf..." : "Mengajukan lembur...");

    try {
      String? base64Sig;
      if (!_sigController.isEmpty) {
        final sigData = await _sigController.toPngBytes();
        if (sigData != null) {
          base64Sig = 'data:image/png;base64,${base64Encode(sigData)}';
        }
      }

      final List<Map<String, dynamic>> itemsPayload = _items.map((item) {
        final dateVal = item['date'] as DateTime;
        final startVal = item['start_time'] as TimeOfDay;
        final endVal = item['end_time'] as TimeOfDay;
        final reason = (item['reason'] as TextEditingController).text;

        final startStr = "${startVal.hour.toString().padLeft(2, '0')}:${startVal.minute.toString().padLeft(2, '0')}";
        final endStr = "${endVal.hour.toString().padLeft(2, '0')}:${endVal.minute.toString().padLeft(2, '0')}";

        return {
          'date': DateFormat('yyyy-MM-dd').format(dateVal),
          'start_time': startStr,
          'end_time': endStr,
          'reason': reason,
        };
      }).toList();

      final payload = {
        'title': _titleController.text,
        'status': status,
        'items': itemsPayload,
      };

      if (base64Sig != null) {
        payload['signature'] = base64Sig;
      }

      final Map<String, dynamic> res;
      if (widget.existingOvertime != null) {
        res = await ApiService.updateOvertime(widget.existingOvertime!['id'], payload);
      } else {
        res = await ApiService.submitOvertime(payload);
      }

      LoadingDialog.hide(context);
      if (res['status'] == 'success' || res['id'] != null) {
        Navigator.pop(context);
        widget.onSubmitted();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isDraft ? "Draf berhasil disimpan" : "Berhasil mengajukan lembur"),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        final msg = res['message'] ?? (res['errors']?.toString() ?? "Gagal memproses pengajuan lembur.");
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      LoadingDialog.hide(context);
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red),
      );
    }
  }
}
