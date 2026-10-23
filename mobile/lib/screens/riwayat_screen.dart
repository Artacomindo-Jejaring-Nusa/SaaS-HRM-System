import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../api/api_service.dart';
import '../widgets/skeleton_loading.dart';

class RiwayatScreen extends StatefulWidget {
  @override
  _RiwayatScreenState createState() => _RiwayatScreenState();
}

class _RiwayatScreenState extends State<RiwayatScreen> {
  List<dynamic> _attendances = [];
  bool _isLoading = true;

  final Color maroon = Color(0xFF800000);

  @override
  void initState() {
    super.initState();
    _loadAttendance();
  }

  void _loadAttendance() async {
    final data = await ApiService.getAttendanceHistory();
    if (mounted) {
      setState(() {
        _attendances = data ?? [];
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Padding(
          padding: EdgeInsets.fromLTRB(25, 25, 25, 15),
          child: Text("Riwayat Absensi", style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.bold)),
        ),

        // Content
        Expanded(
          child: _isLoading
              ? const SimpleListSkeleton()
              : _attendances.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.history, size: 80, color: Colors.grey[300]),
                          SizedBox(height: 15),
                          Text("Belum ada riwayat absensi", style: GoogleFonts.outfit(color: Colors.grey[400], fontSize: 16)),
                          SizedBox(height: 10),
                          Text("Data akan muncul setelah Anda\nmelakukan absensi.", textAlign: TextAlign.center, style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      color: maroon,
                      onRefresh: () async => _loadAttendance(),
                      child: ListView.builder(
                        padding: EdgeInsets.symmetric(horizontal: 20),
                        itemCount: _attendances.length,
                        itemBuilder: (context, index) {
                          final item = _attendances[index];

                          // Mapping field dari Attendance model Laravel
                          final date = item['date'] ?? '-';
                          final checkIn = item['check_in_time'] ?? '--:--';
                          final checkOut = item['check_out_time'] ?? '--:--';
                          final status = item['status'] ?? 'unknown';
                          final location = item['check_in_location'] ?? '';
                          final attendanceType = item['attendance_type'] ?? '';

                          Color statusColor;
                          String statusLabel;
                          IconData statusIcon;

                          switch (status) {
                            case 'present':
                              statusColor = Colors.green;
                              statusLabel = 'Hadir';
                              statusIcon = Icons.check_circle;
                              break;
                            case 'late':
                              statusColor = Colors.orange;
                              statusLabel = 'Terlambat';
                              statusIcon = Icons.warning_amber;
                              break;
                            case 'absent':
                              statusColor = Colors.red;
                              statusLabel = 'Absen';
                              statusIcon = Icons.cancel;
                              break;
                            case 'no_schedule':
                              statusColor = Colors.blue;
                              statusLabel = 'Tanpa Jadwal';
                              statusIcon = Icons.event_busy;
                              break;
                            default:
                              statusColor = Colors.grey;
                              statusLabel = status;
                              statusIcon = Icons.info;
                          }

                          return Container(
                            margin: EdgeInsets.only(bottom: 12),
                            padding: EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(15),
                              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: Offset(0, 2))],
                            ),
                            child: Row(
                              children: [
                                // Status Icon
                                Container(
                                  padding: EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: statusColor.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(statusIcon, color: statusColor, size: 24),
                                ),
                                SizedBox(width: 15),
                                // Detail
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(date, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14)),
                                          if (attendanceType == 'wfh') ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFF4F46E5).withValues(alpha: 0.12),
                                                borderRadius: BorderRadius.circular(6),
                                                border: Border.all(color: const Color(0xFF818CF8).withValues(alpha: 0.5)),
                                              ),
                                              child: const Text(
                                                "WFA",
                                                style: TextStyle(
                                                  color: Color(0xFF4338CA),
                                                  fontSize: 9.5,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ] else if (attendanceType == 'dinas_luar') ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: Colors.amber.withValues(alpha: 0.12),
                                                borderRadius: BorderRadius.circular(6),
                                                border: Border.all(color: Colors.amber.withValues(alpha: 0.5)),
                                              ),
                                              child: const Text(
                                                "Dinas Luar",
                                                style: TextStyle(
                                                  color: Colors.amber,
                                                  fontSize: 9.5,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      SizedBox(height: 4),
                                      Row(
                                        children: [
                                          Icon(Icons.login, size: 14, color: Colors.grey),
                                          SizedBox(width: 4),
                                          Text(checkIn, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                                          SizedBox(width: 15),
                                          Icon(Icons.logout, size: 14, color: Colors.grey),
                                          SizedBox(width: 4),
                                          Text(checkOut, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                                        ],
                                      ),
                                      if (location.isNotEmpty)
                                        Padding(
                                          padding: EdgeInsets.only(top: 4),
                                          child: Row(
                                            children: [
                                              Icon(Icons.location_on, size: 12, color: Colors.grey[400]),
                                              SizedBox(width: 4),
                                              Expanded(
                                                child: Text(location, style: TextStyle(fontSize: 10, color: Colors.grey[400]), overflow: TextOverflow.ellipsis),
                                              ),
                                            ],
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                // Status Badge
                                Container(
                                  padding: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: statusColor.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(statusLabel, style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 11)),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
