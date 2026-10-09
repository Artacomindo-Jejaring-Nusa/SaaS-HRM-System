import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';
import '../../widgets/loading_overlay.dart';

class ShiftSwapScreen extends StatefulWidget {
  const ShiftSwapScreen({super.key});

  @override
  State<ShiftSwapScreen> createState() => _ShiftSwapScreenState();
}

class _ShiftSwapScreenState extends State<ShiftSwapScreen> {
  final Color primaryColor = const Color(0xFF800000);
  
  List<dynamic> _swaps = [];
  bool _isLoading = true;
  Map<String, dynamic>? _currentUser;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  bool _canApprove(Map<String, dynamic>? user) {
    if (user == null) return false;
    final roleName = (user['role']?['name'] ?? user['role_name'] ?? '').toString().toLowerCase();
    if (roleName.contains('super admin') || roleName.contains('superadmin') || user['role_id'] == 1) {
      return true;
    }
    final rawPerms = user['role']?['permissions'] ?? user['permissions'];
    if (rawPerms is List) {
      for (var p in rawPerms) {
        final slug = p is Map ? p['name']?.toString() : p.toString();
        if (slug == 'approve-shift-swaps') return true;
      }
    }
    return false;
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final user = await ApiService.getProfile();
    final swaps = await ApiService.getShiftSwaps();
    if (mounted) {
      setState(() {
        _currentUser = user;
        _swaps = swaps ?? [];
        _isLoading = false;
      });
    }
  }

  Future<void> _handleAction(int id, String status, {String? remark, bool isManager = false}) async {
    LoadingDialog.show(context, message: "Memproses respon Anda...");
    try {
      Map<String, dynamic> res;
      if (isManager) {
        res = await ApiService.approveShiftSwap(id, status);
      } else {
        res = await ApiService.respondShiftSwap(id, status, remark: remark);
      }

      if (!mounted) return;
      LoadingDialog.hide(context);
      if (res['status'] == 'success' || res['message']?.toString().contains('berhasil') == true) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? "Berhasil diproses"), backgroundColor: Colors.green));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? "Gagal memproses"), backgroundColor: Colors.red));
      }
    } catch (e) {
      if (!mounted) return;
      LoadingDialog.hide(context);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red));
    }
    _loadData();
  }

  void _showAddSwapDialog() async {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _AddSwapModal(
        currentUserId: _currentUser?['id'],
        onSuccess: () {
          Navigator.pop(ctx);
          _loadData();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: Colors.grey[50],
        appBar: AppBar(
          title: Text("Tukar Shift", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18)),
          backgroundColor: Colors.white,
          foregroundColor: Colors.black,
          elevation: 0.5,
        ),
        body: const SimpleListSkeleton(),
      );
    }

    final canApprove = _canApprove(_currentUser);
    final myRequests = _swaps.where((s) => s['requester_id'] == _currentUser?['id'] || (s['receiver_id'] == _currentUser?['id'] && s['status'] == 'pending_receiver')).toList();
    final managerReview = _swaps.where((s) => s['status'] == 'pending_manager').toList();

    if (canApprove) {
      return DefaultTabController(
        length: 2,
        child: Scaffold(
          backgroundColor: Colors.grey[50],
          appBar: AppBar(
            title: Text("Tukar Shift", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18)),
            backgroundColor: Colors.white,
            foregroundColor: Colors.black,
            elevation: 0.5,
            bottom: TabBar(
              labelColor: primaryColor,
              unselectedLabelColor: Colors.grey,
              indicatorColor: primaryColor,
              labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13),
              tabs: [
                const Tab(text: "PERMINTAAN SAYA"),
                Tab(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text("APPROVAL"),
                      if (managerReview.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            "${managerReview.length}",
                            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          body: TabBarView(
            children: [
              _buildSwapList(myRequests),
              _buildSwapList(managerReview, isManagerView: true),
            ],
          ),
          floatingActionButton: FloatingActionButton(
            onPressed: _showAddSwapDialog,
            backgroundColor: primaryColor,
            child: const Icon(Icons.add, color: Colors.white),
          ),
        ),
      );
    }

    // Tampilan Karyawan Biasa: Hilangkan Tab Approval
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text("Tukar Shift", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
      ),
      body: _buildSwapList(myRequests),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddSwapDialog,
        backgroundColor: primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildSwapList(List<dynamic> list, {bool isManagerView = false}) {
    if (list.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.swap_horizontal_circle_outlined, size: 80, color: Colors.grey[200]),
            const SizedBox(height: 10),
            Text("Tidak ada data", style: TextStyle(color: Colors.grey[400])),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(15),
        itemCount: list.length,
        itemBuilder: (context, index) {
          final swap = list[index];
          return _SwapCard(
            swap: swap, 
            currentUserId: _currentUser?['id'], 
            isManager: _currentUser?['is_manager'] == true,
            isManagerView: isManagerView,
            onAction: (status, {remark}) => _handleAction(swap['id'], status, remark: remark, isManager: isManagerView),
          );
        },
      ),
    );
  }
}

class _SwapCard extends StatelessWidget {
  final dynamic swap;
  final int? currentUserId;
  final bool isManager;
  final bool isManagerView;
  final Function(String status, {String? remark}) onAction;

  const _SwapCard({required this.swap, this.currentUserId, required this.isManager, required this.onAction, this.isManagerView = false});

  @override
  Widget build(BuildContext context) {
    final status = swap['status'];
    Color statusColor = Colors.orange;
    String statusText = "PENDING";
    
    if (status == 'pending_receiver') { statusText = "MENUNGGU REKAN"; statusColor = Colors.blue; }
    if (status == 'pending_manager') { statusText = "MENUNGGU ATASAN"; statusColor = Colors.orange; }
    if (status == 'approved') { statusText = "BERHASIL"; statusColor = Colors.green; }
    if (status == 'rejected') { statusText = "DITOLAK"; statusColor = Colors.red; }

    final isReceiver = swap['receiver_id'] == currentUserId;

    return Container(
      margin: const EdgeInsets.only(bottom: 15),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                child: Text(statusText, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              Text(DateFormat('dd MMM yyyy, HH:mm').format(DateTime.parse(swap['created_at'])), style: TextStyle(color: Colors.grey[400], fontSize: 10)),
            ],
          ),
          const SizedBox(height: 15),
          Row(
            children: [
              Expanded(
                child: Column(
                  children: [
                    Text(swap['requester']?['name'] ?? 'Pengaju', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12), textAlign: TextAlign.center, maxLines: 1),
                    const SizedBox(height: 5),
                    _buildShiftSmall(swap['requester_schedule']),
                  ],
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 10),
                child: Icon(Icons.compare_arrows, color: Colors.grey),
              ),
              Expanded(
                child: Column(
                  children: [
                    Text(swap['receiver']?['name'] ?? 'Rekan', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12), textAlign: TextAlign.center, maxLines: 1),
                    const SizedBox(height: 5),
                    _buildShiftSmall(swap['receiver_schedule']),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 15),
          const Divider(height: 1),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.info_outline, size: 14, color: Colors.grey),
              const SizedBox(width: 5),
              Expanded(child: Text("Alasan: ${swap['reason'] ?? '-'}", style: TextStyle(color: Colors.grey[600], fontSize: 11, fontStyle: FontStyle.italic))),
            ],
          ),
          
          // ACTIONS
          if (status == 'pending_receiver' && isReceiver)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Row(
                children: [
                  Expanded(child: OutlinedButton(onPressed: () => onAction('rejected'), child: const Text("TOLAK"))),
                  const SizedBox(width: 10),
                  Expanded(child: ElevatedButton(onPressed: () => onAction('approved_by_receiver'), style: ElevatedButton.styleFrom(backgroundColor: Colors.blue), child: const Text("TERIMA", style: TextStyle(color: Colors.white)))),
                ],
              ),
            ),

          if (status == 'pending_manager' && isManagerView)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Row(
                children: [
                  Expanded(child: OutlinedButton(onPressed: () => onAction('rejected'), child: const Text("REJECT"))),
                  const SizedBox(width: 10),
                  Expanded(child: ElevatedButton(onPressed: () => onAction('approved'), style: ElevatedButton.styleFrom(backgroundColor: Colors.green), child: const Text("APPROVE", style: TextStyle(color: Colors.white)))),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildShiftSmall(dynamic schedule) {
    if (schedule == null) return const Text("-");
    final shiftName = schedule['shift']?['name'] ?? 'Shift';
    final startTime = (schedule['shift']?['start_time'] ?? '').toString();
    final endTime = (schedule['shift']?['end_time'] ?? '').toString();
    final timeStr = (startTime.length >= 5 && endTime.length >= 5) 
        ? "${startTime.substring(0, 5)}-${endTime.substring(0, 5)}" 
        : "";

    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey[100]!)),
      child: Column(
        children: [
          Text(DateFormat('dd/MM').format(DateTime.parse(schedule['date'])), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
          Text(shiftName, style: TextStyle(color: Colors.grey[600], fontSize: 9)),
          if (timeStr.isNotEmpty)
            Text(timeStr, style: const TextStyle(fontSize: 8, color: Color(0xFF800000))),
        ],
      ),
    );
  }
}

// MODAL CONTENT
class _AddSwapModal extends StatefulWidget {
  final int? currentUserId;
  final VoidCallback onSuccess;
  const _AddSwapModal({required this.onSuccess, this.currentUserId});

  @override
  __AddSwapModalState createState() => __AddSwapModalState();
}

class __AddSwapModalState extends State<_AddSwapModal> {
  bool _loadingData = true;
  bool _isSubmitting = false;
  List<dynamic> _employees = [];
  List<dynamic> _mySchedules = [];
  List<dynamic> _receiverSchedules = [];

  int? _selectedEmployeeId;
  int? _selectedMySchedId;
  int? _selectedReceiverSchedId;
  final _reasonController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchInit();
  }

  void _fetchInit() async {
    // 1. Ambil rekan kerja sesama pola shift
    final emp = await ApiService.getEmployees(attendanceType: 'shift');
    
    // 2. Ambil jadwal shift pengaju mulai bulan ini
    final now = DateTime.now();
    final startOfMonth = DateFormat('yyyy-MM-01').format(now);
    final mySched = await ApiService.getSchedules(userId: widget.currentUserId, startDate: startOfMonth);
    
    if (mounted) {
      setState(() {
        _employees = (emp ?? []).where((e) => e['id'] != widget.currentUserId && (e['attendance_type'] == 'shift' || e['attendance_type'] == null)).toList();
        _mySchedules = (mySched ?? []).where((s) => s['shift'] != null).toList();
        _loadingData = false;
      });
    }
  }

  void _fetchReceiverSchedules(int id) async {
    setState(() {
      _receiverSchedules = [];
      _selectedReceiverSchedId = null;
    });
    final now = DateTime.now();
    final startOfMonth = DateFormat('yyyy-MM-01').format(now);
    final data = await ApiService.getSchedules(userId: id, startDate: startOfMonth);
    if (mounted) {
      setState(() => _receiverSchedules = (data ?? []).where((s) => s['shift'] != null).toList());
    }
  }

  String _formatScheduleDisplay(dynamic s) {
    if (s == null || s['date'] == null) return "-";
    try {
      final date = DateTime.parse(s['date']);
      final dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      final dayName = dayNames[date.weekday - 1];
      final dateStr = DateFormat('dd MMM yyyy').format(date);
      final shiftName = s['shift']?['name'] ?? 'Shift';
      final startTime = (s['shift']?['start_time'] ?? '').toString();
      final endTime = (s['shift']?['end_time'] ?? '').toString();
      String timeStr = '';
      if (startTime.length >= 5 && endTime.length >= 5) {
        timeStr = ' (${startTime.substring(0, 5)} - ${endTime.substring(0, 5)})';
      }
      return "$dayName, $dateStr — $shiftName$timeStr";
    } catch (_) {
      return s['date'].toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 20, right: 20, top: 20),
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(30))),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),
            Text("Ajukan Tukar Shift", style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 5),
            Text("Pilih rekan kerja shift dan tentukan jadwal yang ingin ditukar", style: TextStyle(color: Colors.grey[500], fontSize: 12)),
            const SizedBox(height: 20),
            
            if (_loadingData) 
               const Center(child: Padding(padding: EdgeInsets.all(20.0), child: CircularProgressIndicator()))
            else ...[
              // 1. Select Employee
              _buildLabel("1. Pilih Rekan Kerja (Pola Shift)"),
              if (_employees.isEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 15),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.shade200),
                  ),
                  child: Text(
                    "Tidak ditemukan rekan kerja lain dengan pola kehadiran shift.",
                    style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                  ),
                )
              else
                DropdownButtonFormField<int>(
                  value: _selectedEmployeeId,
                  decoration: _fieldDeco("Pilih Rekan Kerja..."),
                  isExpanded: true,
                  items: _employees.map((e) {
                    final roleText = (e['role'] != null && e['role']['name'] != null) 
                        ? " (${e['role']['name']})" 
                        : "";
                    return DropdownMenuItem(
                      value: e['id'] as int, 
                      child: Text("${e['name']}$roleText", overflow: TextOverflow.ellipsis)
                    );
                  }).toList(),
                  onChanged: (val) {
                     if (val == null) return;
                     setState(() {
                       _selectedEmployeeId = val;
                       _selectedReceiverSchedId = null;
                     });
                     _fetchReceiverSchedules(val);
                  },
                ),
              const SizedBox(height: 15),

              // 2. Select My Sched
              _buildLabel("2. Jadwal Anda (Dilepas)"),
              if (_mySchedules.isEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, size: 18, color: Colors.amber.shade800),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          "Anda belum memiliki jadwal shift aktif di bulan ini.",
                          style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                        ),
                      ),
                    ],
                  ),
                )
              else
                DropdownButtonFormField<int>(
                  value: _selectedMySchedId,
                  decoration: _fieldDeco("Pilih Jadwal Anda..."),
                  isExpanded: true,
                  items: _mySchedules.map((s) {
                    return DropdownMenuItem(
                      value: s['id'] as int, 
                      child: Text(_formatScheduleDisplay(s), overflow: TextOverflow.ellipsis)
                    );
                  }).toList(),
                  onChanged: (val) => setState(() => _selectedMySchedId = val),
                ),
              const SizedBox(height: 15),

              // 3. Select Receiver Sched
              _buildLabel("3. Jadwal Rekan (Diambil)"),
              if (_selectedEmployeeId != null && _receiverSchedules.isEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Text(
                    "Rekan kerja ini belum memiliki jadwal shift aktif di bulan ini.",
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                  ),
                )
              else
                DropdownButtonFormField<int>(
                  value: _selectedReceiverSchedId,
                  decoration: _fieldDeco(_selectedEmployeeId == null ? "Pilih rekan dulu..." : "Pilih Jadwal Rekan (Tanggal & Shift)..."),
                  isExpanded: true,
                  items: _receiverSchedules.map((s) {
                    return DropdownMenuItem(
                      value: s['id'] as int, 
                      child: Text(_formatScheduleDisplay(s), overflow: TextOverflow.ellipsis)
                    );
                  }).toList(),
                  onChanged: _selectedEmployeeId == null ? null : (val) => setState(() => _selectedReceiverSchedId = val),
                ),
              const SizedBox(height: 15),

              _buildLabel("4. Alasan"),
              TextField(
                controller: _reasonController,
                decoration: _fieldDeco("Contoh: Ada urusan keluarga mendesak..."),
                maxLines: 2,
              ),
              const SizedBox(height: 25),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF800000), 
                    padding: const EdgeInsets.symmetric(vertical: 18), 
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                    elevation: 10,
                    shadowColor: const Color(0xFF800000).withOpacity(0.3),
                  ),
                  child: _isSubmitting 
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text("KIRIM PENGAJUAN", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                ),
              ),
              const SizedBox(height: 30),
            ]
          ],
        ),
      ),
    );
  }

  InputDecoration _fieldDeco(String hint) => InputDecoration(
    hintText: hint,
    filled: true,
    fillColor: Colors.grey[50],
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(15), borderSide: BorderSide(color: Colors.grey[200]!)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(15), borderSide: BorderSide(color: Colors.grey[100]!)),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  );

  Widget _buildLabel(String text) => Padding(padding: const EdgeInsets.only(bottom: 8, left: 4), child: Text(text.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey, letterSpacing: 0.8)));

  void _submit() async {
    if (_selectedEmployeeId == null || _selectedMySchedId == null || _selectedReceiverSchedId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Mohon lengkapi semua pilihan")));
      return;
    }
    
    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Mengirim pengajuan tukar shift...");
    try {
      final res = await ApiService.submitShiftSwap({
        'receiver_id': _selectedEmployeeId,
        'requester_schedule_id': _selectedMySchedId,
        'receiver_schedule_id': _selectedReceiverSchedId,
        'reason': _reasonController.text,
      });
      
      if (!mounted) return;
      LoadingDialog.hide(context);
      if (res['status'] == 'success' || res['id'] != null) {
        widget.onSuccess();
      } else {
        setState(() => _isSubmitting = false);
        final msg = res['message'] ?? "Gagal mengirim pengajuan";
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red));
      }
    } catch (e) {
      if (!mounted) return;
      LoadingDialog.hide(context);
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red));
    }
  }
}
