import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';
import '../../widgets/loading_overlay.dart';

class ShiftSwapScreen extends StatefulWidget {
  @override
  _ShiftSwapScreenState createState() => _ShiftSwapScreenState();
}

class _ShiftSwapScreenState extends State<ShiftSwapScreen> with SingleTickerProviderStateMixin {
  final Color primaryColor = const Color(0xFF800000);
  late TabController _tabController;
  
  List<dynamic> _swaps = [];
  bool _isLoading = true;
  Map<String, dynamic>? _currentUser;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
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

      LoadingDialog.hide(context);
      if (res['status'] == 'success' || res['message']?.toString().contains('berhasil') == true) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? "Berhasil diproses"), backgroundColor: Colors.green));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? "Gagal memproses"), backgroundColor: Colors.red));
      }
    } catch (e) {
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
    // Filter logic
    final myRequests = _swaps.where((s) => s['requester_id'] == _currentUser?['id'] || (s['receiver_id'] == _currentUser?['id'] && s['status'] == 'pending_receiver')).toList();
    final managerReview = _swaps.where((s) => s['status'] == 'pending_manager' && _currentUser?['is_manager'] == true).toList();

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text("Tukar Shift", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
        bottom: TabBar(
          controller: _tabController,
          labelColor: primaryColor,
          unselectedLabelColor: Colors.grey,
          indicatorColor: primaryColor,
          labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: [
            const Tab(text: "PERMINTAAN SAYA"),
            Tab(text: "APPROVAL ${_currentUser?['is_manager'] == true ? '(MANAGER)' : ''}"),
          ],
        ),
      ),
      body: _isLoading 
          ? const SimpleListSkeleton() 
          : TabBarView(
              controller: _tabController,
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
    if (status == 'pending_manager') { statusText = "MENUNGGU MANAGER"; statusColor = Colors.orange; }
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
                    Text(swap['requester']['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12), textAlign: TextAlign.center, maxLines: 1),
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
                    Text(swap['receiver']['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12), textAlign: TextAlign.center, maxLines: 1),
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
              Expanded(child: Text("Alasan: ${swap['reason']}", style: TextStyle(color: Colors.grey[600], fontSize: 11, fontStyle: FontStyle.italic))),
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
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey[100]!)),
      child: Column(
        children: [
          Text(DateFormat('dd/MM').format(DateTime.parse(schedule['date'])), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
          Text(schedule['shift']['name'], style: TextStyle(color: Colors.grey[600], fontSize: 9)),
          Text("${schedule['shift']['start_time'].substring(0,5)}-${schedule['shift']['end_time'].substring(0,5)}", style: const TextStyle(fontSize: 8, color: Color(0xFF800000))),
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
    final emp = await ApiService.getEmployees();
    final mySched = await ApiService.getSchedules(userId: widget.currentUserId);
    if (mounted) {
      setState(() {
        _employees = (emp ?? []).where((e) {
          if (e['id'] == widget.currentUserId) return false;
          final roleName = (e['role'] != null && e['role']['name'] != null) 
              ? e['role']['name'].toString().toLowerCase() 
              : '';
          return roleName.contains('karyawan') || roleName.contains('staff') || roleName.contains('noc');
        }).toList();
        _mySchedules = mySched ?? [];
        _loadingData = false;
      });
    }
  }

  void _fetchReceiverSchedules(int id) async {
    setState(() => _receiverSchedules = []);
    final data = await ApiService.getSchedules(userId: id);
    if (mounted) {
      setState(() => _receiverSchedules = data ?? []);
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
            Text("Pilih rekan kerja dan jadwal yang ingin ditukar", style: TextStyle(color: Colors.grey[500], fontSize: 12)),
            const SizedBox(height: 20),
            
            if (_loadingData) 
               const Center(child: Padding(padding: EdgeInsets.all(20.0), child: CircularProgressIndicator()))
            else ...[
              // Select Employee
              _buildLabel("1. Pilih Rekan Kerja"),
              DropdownButtonFormField<int>(
                value: _selectedEmployeeId,
                decoration: _fieldDeco("Cari Karyawan..."),
                items: _employees.map((e) {
                  final roleText = (e['role'] != null && e['role']['name'] != null) 
                      ? " (${e['role']['name']})" 
                      : "";
                  return DropdownMenuItem(
                    value: e['id'] as int, 
                    child: Text("${e['name']}$roleText")
                  );
                }).toList(),
                onChanged: (val) {
                   setState(() {
                     _selectedEmployeeId = val;
                     _selectedReceiverSchedId = null;
                   });
                   _fetchReceiverSchedules(val!);
                },
              ),
              const SizedBox(height: 15),

              // Select My Sched
              _buildLabel("2. Jadwal Anda"),
              DropdownButtonFormField<int>(
                value: _selectedMySchedId,
                decoration: _fieldDeco("Pilih Jadwal Anda..."),
                items: _mySchedules.map((s) => DropdownMenuItem(value: s['id'] as int, child: Text("${DateFormat('dd/MM').format(DateTime.parse(s['date']))} - ${s['shift']['name']}"))).toList(),
                onChanged: (val) => setState(() => _selectedMySchedId = val),
              ),
              const SizedBox(height: 15),

              // Select Receiver Sched
              _buildLabel("3. Jadwal Tujuan"),
              DropdownButtonFormField<int>(
                value: _selectedReceiverSchedId,
                decoration: _fieldDeco(_selectedEmployeeId == null ? "Pilih rekan dulu..." : "Pilih Jadwal Rekan..."),
                items: _receiverSchedules.map((s) => DropdownMenuItem(value: s['id'] as int, child: Text("${DateFormat('dd/MM').format(DateTime.parse(s['date']))} - ${s['shift']['name']}"))).toList(),
                onChanged: _selectedEmployeeId == null ? null : (val) => setState(() => _selectedReceiverSchedId = val),
              ),
              const SizedBox(height: 15),

              _buildLabel("4. Alasan"),
              TextField(
                controller: _reasonController,
                decoration: _fieldDeco("Kenapa ingin tukar shift?"),
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
    
    print("Submitting Shift Swap: Receiver=$_selectedEmployeeId, MySched=$_selectedMySchedId, TargetSched=$_selectedReceiverSchedId");
    
    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Mengirim pengajuan tukar shift...");
    try {
      final res = await ApiService.submitShiftSwap({
        'receiver_id': _selectedEmployeeId,
        'requester_schedule_id': _selectedMySchedId,
        'receiver_schedule_id': _selectedReceiverSchedId,
        'reason': _reasonController.text,
      });
      
      print("API Response: $res");
      
      LoadingDialog.hide(context);
      if (res['status'] == 'success' || res['id'] != null) {
        widget.onSuccess();
      } else {
        setState(() => _isSubmitting = false);
        final msg = res['message'] ?? "Gagal mengirim pengajuan";
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red));
      }
    } catch (e) {
      print("Submit Error: $e");
      LoadingDialog.hide(context);
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red));
    }
  }
}
