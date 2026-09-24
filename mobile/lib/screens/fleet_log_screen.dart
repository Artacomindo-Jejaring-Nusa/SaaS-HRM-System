import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../api/api_service.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../widgets/skeleton_loading.dart';
import '../../widgets/loading_overlay.dart';

class FleetLogScreen extends StatefulWidget {
  @override
  _FleetLogScreenState createState() => _FleetLogScreenState();
}

class _FleetLogScreenState extends State<FleetLogScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  List<dynamic> _logs = [];
  List<dynamic> _vehicles = [];
  final Color primaryColor = const Color(0xFF800000);
  String _activeFilter = 'all';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final logsFuture = ApiService.getVehicleLogs();
      final vehiclesFuture = ApiService.getAvailableVehicles();

      final results = await Future.wait([logsFuture, vehiclesFuture]);
      if (mounted) {
        setState(() {
          _logs = (results[0] as List<dynamic>?) ?? [];
          _vehicles = (results[1] as List<dynamic>?) ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<dynamic> get _filteredLogs {
    if (_activeFilter == 'all') return _logs;
    if (_activeFilter == 'pending') {
      return _logs.where((l) => l['status'] == 'pending').toList();
    }
    if (_activeFilter == 'approved') {
      return _logs.where((l) => l['status'] == 'approved').toList();
    }
    if (_activeFilter == 'in_use') {
      return _logs.where((l) => l['status'] == 'in_use' || l['status'] == 'departure').toList();
    }
    if (_activeFilter == 'completed') {
      return _logs.where((l) => l['status'] == 'completed' || l['status'] == 'validated').toList();
    }
    if (_activeFilter == 'rejected') {
      return _logs.where((l) => l['status'] == 'rejected').toList();
    }
    return _logs;
  }

  int get _countActive => _logs.where((l) => l['status'] == 'approved' || l['status'] == 'in_use' || l['status'] == 'departure').length;
  int get _countPending => _logs.where((l) => l['status'] == 'pending').length;
  int get _countCompleted => _logs.where((l) => l['status'] == 'completed' || l['status'] == 'validated').length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: Text(
          "Peminjaman Kendaraan",
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: Colors.white,
            fontSize: 18,
          ),
        ),
        backgroundColor: primaryColor,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            tooltip: "SOP & Regulasi",
            icon: const Icon(Icons.info_outline_rounded, color: Colors.white),
            onPressed: () => _showSOPModal(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14),
          tabs: const [
            Tab(text: "Peminjaman Saya", icon: Icon(Icons.history_rounded, size: 20)),
            Tab(text: "Katalog Armada", icon: Icon(Icons.directions_car_filled_rounded, size: 20)),
          ],
        ),
      ),
      body: _isLoading
          ? const CardAndListSkeleton()
          : TabBarView(
              controller: _tabController,
              children: [
                _buildMyLoansTab(),
                _buildCatalogTab(),
              ],
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openLoanRequestSheet(),
        backgroundColor: primaryColor,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: Text(
          "Ajukan Peminjaman",
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: Colors.white,
            fontSize: 14,
          ),
        ),
      ),
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TAB 1: PEMINJAMAN SAYA
  // ════════════════════════════════════════════════════════════════════════════
  Widget _buildMyLoansTab() {
    return RefreshIndicator(
      onRefresh: _fetchData,
      color: primaryColor,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatCards(),
            const SizedBox(height: 18),
            _buildFilterChips(),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "Daftar Pengajuan & Perjalanan",
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                Text(
                  "${_filteredLogs.length} Data",
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _filteredLogs.isEmpty
                ? _buildEmptyState()
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _filteredLogs.length,
                    itemBuilder: (context, index) =>
                        _buildLoanCard(_filteredLogs[index]),
                  ),
            const SizedBox(height: 80), // spacing for FAB
          ],
        ),
      ),
    );
  }

  Widget _buildStatCards() {
    return Row(
      children: [
        Expanded(
          child: _buildMetricCard(
            "Aktif",
            _countActive.toString(),
            Icons.commute_rounded,
            const Color(0xFF0D9488),
            const Color(0xFFE6FFFA),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMetricCard(
            "Menunggu",
            _countPending.toString(),
            Icons.pending_actions_rounded,
            const Color(0xFFD97706),
            const Color(0xFFFFFBEB),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMetricCard(
            "Selesai",
            _countCompleted.toString(),
            Icons.check_circle_rounded,
            const Color(0xFF2563EB),
            const Color(0xFFEFF6FF),
          ),
        ),
      ],
    );
  }

  Widget _buildMetricCard(
    String label,
    String value,
    IconData icon,
    Color color,
    Color bg,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.withOpacity(0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      {'id': 'all', 'label': 'Semua'},
      {'id': 'pending', 'label': 'Menunggu'},
      {'id': 'approved', 'label': 'Siap Pakai'},
      {'id': 'in_use', 'label': 'Berjalan'},
      {'id': 'completed', 'label': 'Selesai'},
      {'id': 'rejected', 'label': 'Ditolak'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((f) {
          final isSelected = _activeFilter == f['id'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(
                f['label']!,
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  color: isSelected ? Colors.white : Colors.grey[700],
                ),
              ),
              selected: isSelected,
              selectedColor: primaryColor,
              backgroundColor: Colors.white,
              checkmarkColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected ? primaryColor : Colors.grey.withOpacity(0.2),
                ),
              ),
              onSelected: (_) {
                setState(() => _activeFilter = f['id']!);
              },
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 20),
      alignment: Alignment.center,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.directions_car_outlined, size: 48, color: Colors.grey[400]),
          ),
          const SizedBox(height: 16),
          Text(
            "Tidak Ada Data Peminjaman",
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.grey[700],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            "Anda belum memiliki pengajuan peminjaman kendaraan yang sesuai filter ini.",
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[500]),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => _openLoanRequestSheet(),
            icon: const Icon(Icons.add, size: 18),
            label: const Text("Ajukan Peminjaman Baru"),
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoanCard(Map<String, dynamic> log) {
    final status = log['status'] ?? 'pending';
    final vehicleName = log['vehicle_name'] ?? 'Kendaraan';
    final plateNumber = log['plate_number'] ?? '-';
    final destination = log['destination'] ?? '-';
    final purpose = log['purpose'] ?? '-';
    final depDate = log['departure_date'] ?? '-';
    final retDate = log['return_date'] ?? '-';
    final depTime = log['departure_time'] ?? '';
    final retTime = log['return_time'] ?? '';
    final driverType = log['driver_type'] ?? 'self';
    final driverName = log['driver_name'] ?? '-';
    final approvalStep = log['current_approval_step'];

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.withOpacity(0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: () => _showLogDetail(log),
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Vehicle info + Status badge
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: _getStatusColor(status).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        Icons.directions_car_rounded,
                        color: _getStatusColor(status),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            vehicleName,
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.grey[100],
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.grey[300]!),
                                ),
                                child: Text(
                                  plateNumber,
                                  style: GoogleFonts.robotoMono(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                    color: Colors.grey[800],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                driverType == 'driver' ? "Supir: $driverName" : "Driver Sendiri",
                                style: GoogleFonts.outfit(
                                  fontSize: 11,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    _buildBadge(status),
                  ],
                ),

                // Approval Step Pill (if pending in dynamic workflow)
                if (status == 'pending' && approvalStep != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.layers_rounded, size: 14, color: Color(0xFFD97706)),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            "Alur Persetujuan: Tahap $approvalStep",
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFFB45309),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const Divider(height: 22),

                // Schedule & Destination
                Row(
                  children: [
                    const Icon(Icons.calendar_month_outlined, size: 15, color: Colors.grey),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        "$depDate ${depTime.isNotEmpty ? '($depTime)' : ''} s/d $retDate ${retTime.isNotEmpty ? '($retTime)' : ''}",
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.place_outlined, size: 15, color: Colors.grey),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        destination,
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: Colors.grey[700],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.assignment_outlined, size: 15, color: Colors.grey),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        purpose,
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),

                // Contextual Action Buttons
                if (status == 'approved') ...[
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 42,
                    child: ElevatedButton.icon(
                      onPressed: () => _openDepartureForm(log: log),
                      icon: const Icon(Icons.play_circle_fill_rounded, size: 18),
                      label: Text(
                        "Mulai Perjalanan (Catat KM Awal)",
                        style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0D9488),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ] else if (status == 'in_use' || status == 'departure') ...[
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 42,
                    child: ElevatedButton.icon(
                      onPressed: () => _openReturnForm(log),
                      icon: const Icon(Icons.check_circle_rounded, size: 18),
                      label: Text(
                        "Selesaikan Perjalanan (Catat KM Akhir)",
                        style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBadge(String status) {
    Color color = _getStatusColor(status);
    String label = "MENUNGGU";
    if (status == 'pending') label = "MENUNGGU";
    if (status == 'approved') label = "SIAP PAKAI";
    if (status == 'in_use' || status == 'departure') label = "BERJALAN";
    if (status == 'completed') label = "VALIDASI";
    if (status == 'validated') label = "SELESAI";
    if (status == 'rejected') label = "DITOLAK";

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: GoogleFonts.outfit(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 10,
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'approved':
        return const Color(0xFF0D9488); // Teal
      case 'in_use':
      case 'departure':
        return const Color(0xFF2563EB); // Blue
      case 'completed':
        return const Color(0xFFD97706); // Amber
      case 'validated':
        return const Color(0xFF16A34A); // Green
      case 'rejected':
        return const Color(0xFFDC2626); // Red
      case 'pending':
      default:
        return const Color(0xFFEA580C); // Orange
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TAB 2: KATALOG ARMADA KENDARAAN
  // ════════════════════════════════════════════════════════════════════════════
  Widget _buildCatalogTab() {
    return RefreshIndicator(
      onRefresh: _fetchData,
      color: primaryColor,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Katalog & Ketersediaan Armada",
              style: GoogleFonts.outfit(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              "Daftar kendaraan operasional kantor beserta status ketersediaannya saat ini.",
              style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[600]),
            ),
            const SizedBox(height: 16),
            _vehicles.isEmpty
                ? _buildEmptyVehiclesState()
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _vehicles.length,
                    itemBuilder: (context, index) {
                      final v = _vehicles[index];
                      final isAvailable = v['is_available'] == true;
                      final vName = v['vehicle_name'] ?? 'Kendaraan';
                      final plate = v['plate_number'] ?? '-';
                      final statusLabel = v['status_label'] ?? (isAvailable ? 'Tersedia' : 'Sedang Digunakan');
                      final currentUser = v['current_user'];
                      final destination = v['destination'];
                      final until = v['until'];

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: isAvailable
                                ? const Color(0xFF10B981).withOpacity(0.3)
                                : Colors.grey.withOpacity(0.15),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.02),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: isAvailable
                                        ? const Color(0xFFECFDF5)
                                        : const Color(0xFFFFFBEB),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    Icons.directions_car_filled_rounded,
                                    color: isAvailable
                                        ? const Color(0xFF10B981)
                                        : const Color(0xFFD97706),
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        vName,
                                        style: GoogleFonts.outfit(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Colors.grey[100],
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: Colors.grey[300]!),
                                        ),
                                        child: Text(
                                          plate,
                                          style: GoogleFonts.robotoMono(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 11,
                                            color: Colors.grey[800],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: isAvailable
                                        ? const Color(0xFFECFDF5)
                                        : const Color(0xFFFFFBEB),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: isAvailable
                                          ? const Color(0xFF10B981)
                                          : const Color(0xFFD97706),
                                    ),
                                  ),
                                  child: Text(
                                    statusLabel,
                                    style: GoogleFonts.outfit(
                                      color: isAvailable
                                          ? const Color(0xFF047857)
                                          : const Color(0xFFB45309),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                              ],
                            ),

                            if (!isAvailable) ...[
                              const Divider(height: 20),
                              Row(
                                children: [
                                  const Icon(Icons.person_outline_rounded, size: 15, color: Colors.grey),
                                  const SizedBox(width: 6),
                                  Text(
                                    "Dipakai oleh: ${currentUser ?? '-'}",
                                    style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[700]),
                                  ),
                                ],
                              ),
                              if (destination != null) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(Icons.place_outlined, size: 15, color: Colors.grey),
                                    const SizedBox(width: 6),
                                    Text(
                                      "Tujuan: $destination",
                                      style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[700]),
                                    ),
                                  ],
                                ),
                              ],
                              if (until != null) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(Icons.event_outlined, size: 15, color: Colors.grey),
                                    const SizedBox(width: 6),
                                    Text(
                                      "Perkiraan Kembali: $until",
                                      style: GoogleFonts.outfit(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFFB45309),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],

                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              height: 38,
                              child: OutlinedButton.icon(
                                onPressed: () {
                                  _openLoanRequestSheet(
                                    preselectedVehicle: vName,
                                    preselectedPlate: plate,
                                  );
                                },
                                icon: const Icon(Icons.calendar_today_rounded, size: 16),
                                label: Text(
                                  isAvailable ? "Pinjam Unit Ini" : "Ajukan Reservasi Jadwal",
                                  style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: primaryColor,
                                  side: BorderSide(color: primaryColor),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyVehiclesState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      alignment: Alignment.center,
      child: Column(
        children: [
          Icon(Icons.directions_car_filled_outlined, size: 48, color: Colors.grey[400]),
          const SizedBox(height: 12),
          Text(
            "Belum Ada Armada Terdaftar",
            style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15),
          ),
          const SizedBox(height: 4),
          Text(
            "Unit armada kendaraan akan otomatis terdaftar saat Anda mengajukan peminjaman.",
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[600]),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => _openLoanRequestSheet(),
            icon: const Icon(Icons.add, size: 18),
            label: const Text("Input Peminjaman Kendaraan"),
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ACTIONS & MODALS
  // ════════════════════════════════════════════════════════════════════════════

  void _openLoanRequestSheet({String? preselectedVehicle, String? preselectedPlate}) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _LoanRequestSheet(
        knownVehicles: _vehicles,
        preselectedVehicle: preselectedVehicle,
        preselectedPlate: preselectedPlate,
      ),
    );
    if (result == true) {
      _fetchData();
    }
  }

  void _openDepartureForm({Map<String, dynamic>? log}) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _DepartureFormScreen(log: log),
      ),
    );
    if (result == true) _fetchData();
  }

  void _openReturnForm(Map<String, dynamic> log) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _ReturnFormScreen(
          logId: log['id'],
          startKm: log['odometer_start'] ?? 0,
          vehicleName: log['vehicle_name'] ?? 'Kendaraan',
          plateNumber: log['plate_number'] ?? '',
        ),
      ),
    );
    if (result == true) _fetchData();
  }

  void _showLogDetail(Map<String, dynamic> log) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _DetailModal(
        log: log,
        onStartTrip: () {
          Navigator.pop(context);
          _openDepartureForm(log: log);
        },
        onEndTrip: () {
          Navigator.pop(context);
          _openReturnForm(log);
        },
      ),
    );
  }

  void _showSOPModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _SOPModal(),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FORM SHEET 1: AJUKAN PEMINJAMAN KENDARAAN (LOAN REQUEST)
// ════════════════════════════════════════════════════════════════════════════
class _LoanRequestSheet extends StatefulWidget {
  final List<dynamic> knownVehicles;
  final String? preselectedVehicle;
  final String? preselectedPlate;

  const _LoanRequestSheet({
    required this.knownVehicles,
    this.preselectedVehicle,
    this.preselectedPlate,
  });

  @override
  _LoanRequestSheetState createState() => _LoanRequestSheetState();
}

class _LoanRequestSheetState extends State<_LoanRequestSheet> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _vehicleNameController = TextEditingController();
  final TextEditingController _plateNumberController = TextEditingController();
  final TextEditingController _destinationController = TextEditingController();
  final TextEditingController _purposeController = TextEditingController();
  final TextEditingController _driverNameController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  DateTime _departureDate = DateTime.now();
  DateTime _returnDate = DateTime.now();
  TimeOfDay _departureTime = const TimeOfDay(hour: 8, minute: 0);
  TimeOfDay _returnTime = const TimeOfDay(hour: 17, minute: 0);

  String _driverType = 'self'; // 'self' or 'driver'
  String? _selectedVehicleKey;
  bool _isSubmitting = false;

  final Color primaryColor = const Color(0xFF800000);

  @override
  void initState() {
    super.initState();
    if (widget.preselectedVehicle != null) {
      _vehicleNameController.text = widget.preselectedVehicle!;
      _plateNumberController.text = widget.preselectedPlate ?? '';
      _selectedVehicleKey = "${widget.preselectedVehicle}|${widget.preselectedPlate}";
    } else if (widget.knownVehicles.isNotEmpty) {
      final first = widget.knownVehicles.first;
      _vehicleNameController.text = first['vehicle_name'] ?? '';
      _plateNumberController.text = first['plate_number'] ?? '';
      _selectedVehicleKey = "${first['vehicle_name']}|${first['plate_number']}";
    }
  }

  void _onVehicleSelected(String? val) {
    if (val == null) return;
    setState(() {
      _selectedVehicleKey = val;
      if (val == 'OTHER') {
        _vehicleNameController.clear();
        _plateNumberController.clear();
      } else {
        final parts = val.split('|');
        _vehicleNameController.text = parts[0];
        _plateNumberController.text = parts.length > 1 ? parts[1] : '';
      }
    });
  }

  Future<void> _pickDate(bool isDeparture) async {
    final initialDate = isDeparture ? _departureDate : _returnDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 90)),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: ColorScheme.light(primary: primaryColor),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isDeparture) {
          _departureDate = picked;
          if (_returnDate.isBefore(_departureDate)) {
            _returnDate = _departureDate;
          }
        } else {
          _returnDate = picked;
        }
      });
    }
  }

  Future<void> _pickTime(bool isDeparture) async {
    final initialTime = isDeparture ? _departureTime : _returnTime;
    final picked = await showTimePicker(
      context: context,
      initialTime: initialTime,
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: ColorScheme.light(primary: primaryColor),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isDeparture) {
          _departureTime = picked;
        } else {
          _returnTime = picked;
        }
      });
    }
  }

  void _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final depDateStr = DateFormat('yyyy-MM-dd').format(_departureDate);
    final retDateStr = DateFormat('yyyy-MM-dd').format(_returnDate);
    final depTimeStr = "${_departureTime.hour.toString().padLeft(2, '0')}:${_departureTime.minute.toString().padLeft(2, '0')}";
    final retTimeStr = "${_returnTime.hour.toString().padLeft(2, '0')}:${_returnTime.minute.toString().padLeft(2, '0')}";

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Mengirim permohonan peminjaman...");

    try {
      final payload = {
        'vehicle_name': _vehicleNameController.text.trim(),
        'plate_number': _plateNumberController.text.trim().toUpperCase(),
        'purpose': _purposeController.text.trim(),
        'destination': _destinationController.text.trim(),
        'departure_date': depDateStr,
        'return_date': retDateStr,
        'departure_time': depTimeStr,
        'return_time': retTimeStr,
        'driver_type': _driverType,
        'driver_name': _driverType == 'driver' ? _driverNameController.text.trim() : null,
        'notes': _notesController.text.trim().isNotEmpty ? _notesController.text.trim() : null,
      };

      final result = await ApiService.submitLoanRequest(payload);
      LoadingDialog.hide(context);

      if (result['status'] == 'success') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? "Pengajuan peminjaman berhasil dikirim!"),
            backgroundColor: const Color(0xFF16A34A),
          ),
        );
        Navigator.pop(context, true);
      } else {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? "Gagal mengajukan peminjaman"),
            backgroundColor: Colors.red,
          ),
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

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Sheet
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Form Peminjaman Kendaraan",
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      Text(
                        "Alur persetujuan atasan akan otomatis diterapkan",
                        style: GoogleFonts.outfit(fontSize: 11, color: Colors.grey[600]),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const Divider(height: 24),

              // Pilihan Kendaraan
              Text(
                "PILIH KENDARAAN",
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[700],
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 8),

              if (widget.knownVehicles.isNotEmpty) ...[
                DropdownButtonFormField<String>(
                  value: _selectedVehicleKey,
                  decoration: InputDecoration(
                    prefixIcon: Icon(Icons.directions_car_filled_rounded, color: primaryColor, size: 20),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                  items: [
                    ...widget.knownVehicles.map((v) {
                      final key = "${v['vehicle_name']}|${v['plate_number']}";
                      return DropdownMenuItem<String>(
                        value: key,
                        child: Text(
                          "${v['vehicle_name']} (${v['plate_number']})",
                          style: GoogleFonts.outfit(fontSize: 13),
                        ),
                      );
                    }).toList(),
                    DropdownMenuItem<String>(
                      value: 'OTHER',
                      child: Text(
                        "+ Masukkan Kendaraan Lain Secara Manual",
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: primaryColor,
                        ),
                      ),
                    ),
                  ],
                  onChanged: _onVehicleSelected,
                ),
                const SizedBox(height: 12),
              ],

              if (_selectedVehicleKey == 'OTHER' || widget.knownVehicles.isEmpty) ...[
                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: TextFormField(
                        controller: _vehicleNameController,
                        decoration: InputDecoration(
                          labelText: "Nama Kendaraan *",
                          hintText: "Misal: Avanza Veloz",
                          prefixIcon: Icon(Icons.directions_car, color: primaryColor, size: 18),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        ),
                        validator: (v) => v!.trim().isEmpty ? "Wajib diisi" : null,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: TextFormField(
                        controller: _plateNumberController,
                        textCapitalization: TextCapitalization.characters,
                        decoration: InputDecoration(
                          labelText: "Plat Nomor *",
                          hintText: "B 1234 CD",
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        ),
                        validator: (v) => v!.trim().isEmpty ? "Wajib diisi" : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],

              // Jadwal Peminjaman
              Text(
                "JADWAL PERJALANAN",
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[700],
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 8),

              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickDate(true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey[300]!),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Tgl Keberangkatan", style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                            const SizedBox(height: 2),
                            Text(
                              DateFormat('dd MMM yyyy').format(_departureDate),
                              style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () => _pickTime(true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey[300]!),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("Jam", style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                          const SizedBox(height: 2),
                          Text(
                            "${_departureTime.hour.toString().padLeft(2, '0')}:${_departureTime.minute.toString().padLeft(2, '0')}",
                            style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickDate(false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey[300]!),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Tgl Kepulangan", style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                            const SizedBox(height: 2),
                            Text(
                              DateFormat('dd MMM yyyy').format(_returnDate),
                              style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () => _pickTime(false),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey[300]!),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("Jam", style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                          const SizedBox(height: 2),
                          Text(
                            "${_returnTime.hour.toString().padLeft(2, '0')}:${_returnTime.minute.toString().padLeft(2, '0')}",
                            style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Driver Option
              Text(
                "PENGEMUDI",
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[700],
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: Center(
                        child: Text(
                          "Bawa Sendiri",
                          style: GoogleFonts.outfit(
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            color: _driverType == 'self' ? Colors.white : Colors.grey[700],
                          ),
                        ),
                      ),
                      selected: _driverType == 'self',
                      selectedColor: primaryColor,
                      onSelected: (_) => setState(() => _driverType = 'self'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ChoiceChip(
                      label: Center(
                        child: Text(
                          "Driver Kantor",
                          style: GoogleFonts.outfit(
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            color: _driverType == 'driver' ? Colors.white : Colors.grey[700],
                          ),
                        ),
                      ),
                      selected: _driverType == 'driver',
                      selectedColor: primaryColor,
                      onSelected: (_) => setState(() => _driverType = 'driver'),
                    ),
                  ),
                ],
              ),

              if (_driverType == 'driver') ...[
                const SizedBox(height: 10),
                TextFormField(
                  controller: _driverNameController,
                  decoration: InputDecoration(
                    labelText: "Nama Driver / Supir",
                    hintText: "Contoh: Pak Budi (Supir Kantor)",
                    prefixIcon: const Icon(Icons.person, size: 18),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
              ],
              const SizedBox(height: 14),

              // Detail Tujuan & Keperluan
              TextFormField(
                controller: _destinationController,
                decoration: InputDecoration(
                  labelText: "Tujuan Perjalanan *",
                  hintText: "Contoh: Gedung BEI Lt. 14, SCBD Jakarta",
                  prefixIcon: Icon(Icons.place_rounded, color: primaryColor, size: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (v) => v!.trim().isEmpty ? "Tujuan perjalanan wajib diisi" : null,
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _purposeController,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: "Keperluan / Urusan Dinas *",
                  hintText: "Contoh: Presentasi penawaran project ERP dengan Direksi Klien",
                  prefixIcon: Icon(Icons.business_center_rounded, color: primaryColor, size: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (v) => v!.trim().isEmpty ? "Keperluan wajib diisi" : null,
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _notesController,
                decoration: InputDecoration(
                  labelText: "Catatan Tambahan (Opsional)",
                  hintText: "Misal: Butuh e-Toll kantor atau request ban serep dicek",
                  prefixIcon: const Icon(Icons.notes_rounded, size: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),

              const SizedBox(height: 24),

              // Submit Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: _isSubmitting
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          "KIRIM PENGAJUAN PEMINJAMAN",
                          style: GoogleFonts.outfit(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            fontSize: 14,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FORM SCREEN 2: KEBERANGKATAN (KM AWAL & FOTO ODOMETER)
// ════════════════════════════════════════════════════════════════════════════
class _DepartureFormScreen extends StatefulWidget {
  final Map<String, dynamic>? log;
  const _DepartureFormScreen({this.log});

  @override
  _DepartureFormScreenState createState() => _DepartureFormScreenState();
}

class _DepartureFormScreenState extends State<_DepartureFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _vehicleNameController = TextEditingController();
  final TextEditingController _plateNumberController = TextEditingController();
  final TextEditingController _destinationController = TextEditingController();
  final TextEditingController _purposeController = TextEditingController();
  final TextEditingController _odometerController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  File? _image;
  bool _isSubmitting = false;
  final Color primaryColor = const Color(0xFF800000);

  @override
  void initState() {
    super.initState();
    if (widget.log != null) {
      _vehicleNameController.text = widget.log!['vehicle_name'] ?? '';
      _plateNumberController.text = widget.log!['plate_number'] ?? '';
      _destinationController.text = widget.log!['destination'] ?? '';
      _purposeController.text = widget.log!['purpose'] ?? '';
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: source,
      imageQuality: 60,
    );
    if (pickedFile != null) {
      setState(() => _image = File(pickedFile.path));
    }
  }

  void _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_image == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Silakan ambil foto bukti odometer awal kendaraan"),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Mencatat keberangkatan perjalanan...");

    try {
      final data = <String, String>{
        'odometer_start': _odometerController.text.trim(),
        'departure_date': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'vehicle_name': _vehicleNameController.text.trim(),
        'plate_number': _plateNumberController.text.trim().toUpperCase(),
        'destination': _destinationController.text.trim(),
        'purpose': _purposeController.text.trim(),
      };
      if (_notesController.text.trim().isNotEmpty) {
        data['notes'] = _notesController.text.trim();
      }

      final int? logId = widget.log?['id'];
      final result = await ApiService.submitDeparture(data, _image!.path, id: logId);

      LoadingDialog.hide(context);

      if (result['status'] == 'success') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? "Keberangkatan berhasil dicatat! Selamat berkendara."),
            backgroundColor: const Color(0xFF16A34A),
          ),
        );
        Navigator.pop(context, true);
      } else {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? "Gagal mencatat keberangkatan"),
            backgroundColor: Colors.red,
          ),
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

  @override
  Widget build(BuildContext context) {
    final isFromLoan = widget.log != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Pencatatan Keberangkatan",
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: primaryColor,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isFromLoan) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE6FFFA),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF99F6E4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.verified_rounded, color: Color(0xFF0D9488), size: 24),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Peminjaman Telah Disetujui",
                              style: GoogleFonts.outfit(
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF0F766E),
                                fontSize: 13,
                              ),
                            ),
                            Text(
                              "${widget.log!['vehicle_name']} (${widget.log!['plate_number']}) — Tujuan: ${widget.log!['destination']}",
                              style: GoogleFonts.outfit(fontSize: 11, color: Colors.black87),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              if (!isFromLoan) ...[
                Text("Informasi Kendaraan", style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15)),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _vehicleNameController,
                  decoration: InputDecoration(
                    labelText: "Nama Kendaraan *",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  validator: (v) => v!.isEmpty ? "Wajib diisi" : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _plateNumberController,
                  decoration: InputDecoration(
                    labelText: "Plat Nomor *",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  validator: (v) => v!.isEmpty ? "Wajib diisi" : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _destinationController,
                  decoration: InputDecoration(
                    labelText: "Tujuan *",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  validator: (v) => v!.isEmpty ? "Wajib diisi" : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _purposeController,
                  decoration: InputDecoration(
                    labelText: "Keperluan *",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  validator: (v) => v!.isEmpty ? "Wajib diisi" : null,
                ),
                const SizedBox(height: 20),
              ],

              Text("Odometer Keberangkatan", style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 10),
              TextFormField(
                controller: _odometerController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: "KM Awal (Odometer Saat Berangkat) *",
                  hintText: "Contoh: 45200",
                  prefixIcon: Icon(Icons.speed_rounded, color: primaryColor),
                  suffixText: "KM",
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return "KM Awal wajib diisi";
                  if (int.tryParse(v.trim()) == null) return "Harus berupa angka";
                  return null;
                },
              ),
              const SizedBox(height: 15),

              Text(
                "Foto Dashboard / Odometer Awal *",
                style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey[700]),
              ),
              const SizedBox(height: 8),

              InkWell(
                onTap: () {
                  showModalBottomSheet(
                    context: context,
                    builder: (ctx) => SafeArea(
                      child: Wrap(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.camera_alt),
                            title: const Text("Kamera"),
                            onTap: () {
                              Navigator.pop(ctx);
                              _pickImage(ImageSource.camera);
                            },
                          ),
                          ListTile(
                            leading: const Icon(Icons.photo_library),
                            title: const Text("Galeri"),
                            onTap: () {
                              Navigator.pop(ctx);
                              _pickImage(ImageSource.gallery);
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                },
                child: Container(
                  width: double.infinity,
                  height: 180,
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey[300]!),
                  ),
                  child: _image == null
                      ? Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.camera_alt_rounded, color: primaryColor, size: 44),
                            const SizedBox(height: 8),
                            Text(
                              "Ambil Foto Odometer Awal",
                              style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.grey[700]),
                            ),
                            Text(
                              "Pastikan angka KM dan indikator terlihat jelas",
                              style: GoogleFonts.outfit(fontSize: 11, color: Colors.grey[500]),
                            ),
                          ],
                        )
                      : ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.file(_image!, fit: BoxFit.cover),
                        ),
                ),
              ),

              const SizedBox(height: 15),
              TextFormField(
                controller: _notesController,
                decoration: InputDecoration(
                  labelText: "Catatan Kondisi Unit (Opsional)",
                  hintText: "Misal: Bensin setengah tank, kondisi ban baik",
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),

              const SizedBox(height: 30),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : _handleSubmit,
                  icon: const Icon(Icons.play_arrow_rounded, color: Colors.white),
                  label: Text(
                    "MULAI PERJALANAN SEKARANG",
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontSize: 14,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FORM SCREEN 3: KEPULANGAN (KM AKHIR & BIAYA)
// ════════════════════════════════════════════════════════════════════════════
class _ReturnFormScreen extends StatefulWidget {
  final int logId;
  final int startKm;
  final String vehicleName;
  final String plateNumber;

  const _ReturnFormScreen({
    required this.logId,
    required this.startKm,
    required this.vehicleName,
    required this.plateNumber,
  });

  @override
  _ReturnFormScreenState createState() => _ReturnFormScreenState();
}

class _ReturnFormScreenState extends State<_ReturnFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _kmController = TextEditingController();
  final TextEditingController _fuelController = TextEditingController();
  final TextEditingController _tollController = TextEditingController();
  final TextEditingController _parkController = TextEditingController();

  File? _odometerPhoto;
  List<File> _expensePhotos = [];
  bool _isSubmitting = false;
  final Color primaryColor = const Color(0xFF800000);

  Future<void> _pickOdometerPhoto(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 60);
    if (picked != null) setState(() => _odometerPhoto = File(picked.path));
  }

  Future<void> _pickExpenses() async {
    final picked = await ImagePicker().pickMultiImage(imageQuality: 60);
    if (picked.isNotEmpty) {
      setState(() => _expensePhotos.addAll(picked.map((e) => File(e.path))));
    }
  }

  void _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_odometerPhoto == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Silakan foto bukti odometer kepulangan"),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Mencatat kepulangan perjalanan...");

    try {
      final data = {
        'return_date': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'odometer_end': _kmController.text.trim(),
        'fuel_cost': _fuelController.text.trim().isEmpty ? "0" : _fuelController.text.trim(),
        'toll_cost': _tollController.text.trim().isEmpty ? "0" : _tollController.text.trim(),
        'parking_cost': _parkController.text.trim().isEmpty ? "0" : _parkController.text.trim(),
      };

      final result = await ApiService.submitReturn(
        widget.logId,
        data,
        odometerPhotoPath: _odometerPhoto!.path,
        expenseFiles: _expensePhotos.map((e) => e.path).toList(),
      );

      LoadingDialog.hide(context);

      if (result['status'] == 'success') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? "Perjalanan selesai dicatat!"),
            backgroundColor: const Color(0xFF16A34A),
          ),
        );
        Navigator.pop(context, true);
      } else {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? "Gagal menyelesaikan perjalanan"),
            backgroundColor: Colors.red,
          ),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Pencatatan Kepulangan",
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: primaryColor,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.grey[300]!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.directions_car, color: primaryColor, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "${widget.vehicleName} (${widget.plateNumber})",
                            style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          Text(
                            "KM Awal Keberangkatan: ${widget.startKm} KM",
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: primaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              Text("Odometer Kepulangan", style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 10),
              TextFormField(
                controller: _kmController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: "KM Akhir (Saat Tiba Kembali) *",
                  hintText: "Harus lebih besar dari ${widget.startKm}",
                  prefixIcon: Icon(Icons.speed_rounded, color: primaryColor),
                  suffixText: "KM",
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return "KM Akhir wajib diisi";
                  final parsed = int.tryParse(v.trim());
                  if (parsed == null) return "Harus berupa angka";
                  if (parsed < widget.startKm) return "Harus >= KM Awal (${widget.startKm})";
                  return null;
                },
              ),
              const SizedBox(height: 15),

              Text(
                "Foto Odometer Kepulangan *",
                style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey[700]),
              ),
              const SizedBox(height: 8),

              InkWell(
                onTap: () {
                  showModalBottomSheet(
                    context: context,
                    builder: (ctx) => SafeArea(
                      child: Wrap(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.camera_alt),
                            title: const Text("Kamera"),
                            onTap: () {
                              Navigator.pop(ctx);
                              _pickOdometerPhoto(ImageSource.camera);
                            },
                          ),
                          ListTile(
                            leading: const Icon(Icons.photo_library),
                            title: const Text("Galeri"),
                            onTap: () {
                              Navigator.pop(ctx);
                              _pickOdometerPhoto(ImageSource.gallery);
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                },
                child: Container(
                  height: 160,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey[300]!),
                  ),
                  child: _odometerPhoto == null
                      ? Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.camera_alt_rounded, color: primaryColor, size: 40),
                            const SizedBox(height: 8),
                            Text(
                              "Ambil Foto Odometer Akhir",
                              style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.grey[700]),
                            ),
                          ],
                        )
                      : ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.file(_odometerPhoto!, fit: BoxFit.cover),
                        ),
                ),
              ),

              const SizedBox(height: 24),
              Text(
                "Biaya Operasional Perjalanan (Opsional)",
                style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15),
              ),
              const SizedBox(height: 10),

              _buildCostField("Biaya BBM (Rp)", _fuelController, Icons.local_gas_station_rounded),
              _buildCostField("Biaya Tol (Rp)", _tollController, Icons.toll_rounded),
              _buildCostField("Biaya Parkir / Lainnya (Rp)", _parkController, Icons.local_parking_rounded),

              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _pickExpenses,
                icon: const Icon(Icons.receipt_long_rounded, size: 18),
                label: Text(
                  _expensePhotos.isEmpty
                      ? "Unggah Foto Struk Biaya (Opsional)"
                      : "${_expensePhotos.length} Struk Terpilih",
                  style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: primaryColor,
                  side: BorderSide(color: primaryColor),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),

              const SizedBox(height: 30),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : _handleSubmit,
                  icon: const Icon(Icons.check_circle_outline_rounded, color: Colors.white),
                  label: Text(
                    "KIRIM LAPORAN SELESAI PERJALANAN",
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontSize: 14,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCostField(String label, TextEditingController c, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextFormField(
        controller: c,
        keyboardType: TextInputType.number,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, size: 18, color: primaryColor),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL 4: DETAIL LOG & APPROVAL TIMELINE TRACKER
// ════════════════════════════════════════════════════════════════════════════
class _DetailModal extends StatelessWidget {
  final Map<String, dynamic> log;
  final VoidCallback onStartTrip;
  final VoidCallback onEndTrip;

  const _DetailModal({
    required this.log,
    required this.onStartTrip,
    required this.onEndTrip,
  });

  @override
  Widget build(BuildContext context) {
    final status = log['status'] ?? 'pending';
    final vehicleName = log['vehicle_name'] ?? 'Kendaraan';
    final plateNumber = log['plate_number'] ?? '-';
    final destination = log['destination'] ?? '-';
    final purpose = log['purpose'] ?? '-';
    final depDate = log['departure_date'] ?? '-';
    final retDate = log['return_date'] ?? '-';
    final depTime = log['departure_time'] ?? '';
    final retTime = log['return_time'] ?? '';
    final driverType = log['driver_type'] ?? 'self';
    final driverName = log['driver_name'] ?? '-';
    final startKm = log['odometer_start'];
    final endKm = log['odometer_end'];
    final distance = log['distance'];
    final remark = log['remark'];

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.all(22),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Detail Peminjaman",
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    Text(
                      "$vehicleName ($plateNumber)",
                      style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[600]),
                    ),
                  ],
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const Divider(height: 20),

            // Approval Timeline Tracker
            Text(
              "ALUR & STATUS PROSES",
              style: GoogleFonts.outfit(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 12),

            _buildTimelineItem(
              title: "1. Pengajuan Peminjaman",
              subtitle: "Diajukan untuk $depDate ($depTime) s/d $retDate ($retTime)",
              isCompleted: true,
              isActive: status == 'pending',
            ),
            _buildTimelineItem(
              title: "2. Persetujuan Atasan",
              subtitle: status == 'pending'
                  ? (log['current_approval_step'] != null
                      ? "Menunggu Persetujuan Tahap ${log['current_approval_step']}"
                      : "Menunggu Peninjauan Atasan")
                  : (status == 'rejected'
                      ? "Ditolak${remark != null ? ': $remark' : ''}"
                      : "Disetujui${remark != null ? ' ($remark)' : ''}"),
              isCompleted: status != 'pending' && status != 'rejected',
              isActive: status == 'pending',
              isError: status == 'rejected',
            ),
            _buildTimelineItem(
              title: "3. Keberangkatan & KM Awal",
              subtitle: startKm != null
                  ? "KM Awal: $startKm KM"
                  : (status == 'approved' ? "Siap jalan, catat KM awal" : "Menunggu"),
              isCompleted: startKm != null,
              isActive: status == 'approved',
            ),
            _buildTimelineItem(
              title: "4. Kepulangan & KM Akhir",
              subtitle: endKm != null
                  ? "KM Akhir: $endKm KM (Total Jarak: ${distance ?? '-'} KM)"
                  : (status == 'in_use' || status == 'departure' ? "Sedang berjalan" : "Menunggu"),
              isCompleted: endKm != null,
              isActive: status == 'in_use' || status == 'departure',
            ),
            _buildTimelineItem(
              title: "5. Validasi Selesai",
              subtitle: status == 'validated' ? "Log divalidasi oleh Manajemen" : "Pengecekan akhir",
              isCompleted: status == 'validated',
              isActive: status == 'completed',
              isLast: true,
            ),

            const Divider(height: 24),

            // Detail Fields
            Text(
              "INFORMASI LENGKAP",
              style: GoogleFonts.outfit(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 10),

            _buildRow("Tujuan Perjalanan", destination),
            _buildRow("Keperluan Dinas", purpose),
            _buildRow("Pengemudi", driverType == 'driver' ? "Supir ($driverName)" : "Driver Sendiri"),
            if (log['notes'] != null && log['notes'].toString().isNotEmpty)
              _buildRow("Catatan", log['notes']),

            if (startKm != null || endKm != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey[200]!),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatCol("KM Awal", "${startKm ?? '-'}"),
                    _buildStatCol("KM Akhir", "${endKm ?? '-'}"),
                    _buildStatCol("Total Jarak", distance != null ? "$distance KM" : "—"),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 20),

            // Contextual Action Buttons
            if (status == 'approved') ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: onStartTrip,
                  icon: const Icon(Icons.play_circle_fill_rounded, color: Colors.white),
                  label: Text(
                    "Mulai Perjalanan Sekarang",
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D9488),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ] else if (status == 'in_use' || status == 'departure') ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: onEndTrip,
                  icon: const Icon(Icons.check_circle_rounded, color: Colors.white),
                  label: Text(
                    "Selesaikan Perjalanan & Catat KM Akhir",
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Widget _buildTimelineItem({
    required String title,
    required String subtitle,
    required bool isCompleted,
    required bool isActive,
    bool isError = false,
    bool isLast = false,
  }) {
    Widget icon = Icon(Icons.circle, size: 10, color: Colors.grey[400]);

    if (isError) {
      icon = const Icon(Icons.cancel_rounded, size: 16, color: Colors.red);
    } else if (isCompleted) {
      icon = const Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF16A34A));
    } else if (isActive) {
      icon = const Icon(Icons.radio_button_checked_rounded, size: 16, color: Color(0xFFD97706));
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 24,
            child: Column(
              children: [
                icon,
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: isCompleted ? const Color(0xFF16A34A) : Colors.grey[200],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontWeight: isActive || isCompleted ? FontWeight.bold : FontWeight.w500,
                      fontSize: 13,
                      color: isError ? Colors.red : Colors.black87,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[600])),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCol(String label, String val) {
    return Column(
      children: [
        Text(label, style: GoogleFonts.outfit(fontSize: 10, color: Colors.grey[600])),
        const SizedBox(height: 2),
        Text(
          val,
          style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF800000)),
        ),
      ],
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL 5: SOP & REGULASI KENDARAAN OPERASIONAL
// ════════════════════════════════════════════════════════════════════════════
class _SOPModal extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.all(22),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "SOP Peminjaman Kendaraan Dinas",
                  style: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const Divider(height: 20),
            _buildSOP(
              Icons.rule_rounded,
              "Pengajuan & Persetujuan",
              "Pengajuan wajib disubmit minimal 1 hari sebelum keberangkatan dan harus disetujui atasan/manajemen sebelum unit digunakan.",
            ),
            _buildSOP(
              Icons.camera_alt_rounded,
              "Pencatatan Odometer & Bukti",
              "Driver wajib memotret odometer dashboard sebelum jalan (KM Awal) dan saat kembali (KM Akhir) dengan angka yang terlihat jelas.",
            ),
            _buildSOP(
              Icons.badge_rounded,
              "Kualifikasi Driver",
              "Pengemudi wajib memiliki SIM A yang masih berlaku dan menjaga keselamatan serta mematuhi aturan lalu lintas.",
            ),
            _buildSOP(
              Icons.receipt_long_rounded,
              "Struk BBM & Tol",
              "Biaya operasional BBM dan tol wajib menyertakan foto struk/kuitansi fisik untuk diverifikasi.",
            ),
            _buildSOP(
              Icons.cleaning_services_rounded,
              "Kebersihan & Kunci",
              "Kendaraan harus dikembalikan dalam keadaan bersih, tanpa sampah, dan kunci diserahkan kembali ke GA/Security.",
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF800000),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(
                  "SAYA MEMAHAMI SOP",
                  style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Widget _buildSOP(IconData icon, String title, String desc) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF1F2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 20, color: const Color(0xFF800000)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 2),
                Text(desc, style: GoogleFonts.outfit(color: Colors.grey[600], fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
