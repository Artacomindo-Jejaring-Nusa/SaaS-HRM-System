import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import '../../api/api_service.dart';
import '../services/fcm_service.dart';
import '../widgets/skeleton_loading.dart';
import '../widgets/loading_overlay.dart';

class TaskScreen extends StatefulWidget {
  const TaskScreen({super.key});
  @override
  _TaskScreenState createState() => _TaskScreenState();
}

class _TaskScreenState extends State<TaskScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final Color primaryColor = const Color(0xFF800000);
  final Color secondaryColor = const Color(0xFFAD2831);
  StreamSubscription? _fcmSubscription;
  
  List<dynamic> _receivedTasks = [];
  List<dynamic> _sentTasks = [];
  bool _isLoading = true;
  bool _isManager = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _checkPermissions();
    _fetchTasks();

    // Listen for FCM messages to refresh UI in real-time
    _fcmSubscription = FcmService.onMessageReceived.listen((message) {
      debugPrint("Real-time task refresh triggered via FCM");
      _fetchTasks();
    });
  }

  @override
  void dispose() {
    _fcmSubscription?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _checkPermissions() async {
    final profile = await ApiService.getProfile();
    // In GreetDay, usually supervisors/above can assign tasks.
    // Based on our RBAC, roles like Supervisor, Manager, HR, Admin, etc.
    if (mounted) {
      setState(() {
        final role = profile?['role']?['slug'] ?? '';
        _isManager = ['super-admin', 'admin', 'hr', 'direktur', 'manager', 'supervisor'].contains(role);
      });
    }
  }

  Future<void> _fetchTasks() async {
    setState(() => _isLoading = true);
    final received = await ApiService.getTasks(type: 'received');
    final sent = await ApiService.getTasks(type: 'sent');
    
    if (mounted) {
      setState(() {
        _receivedTasks = received ?? [];
        _sentTasks = sent ?? [];
        _isLoading = false;
      });
    }
  }

  void _showCreateTaskModal() async {
    final subordinates = await ApiService.getSubordinates();
    if (subordinates == null || subordinates.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Tidak ada bawahan ditemukan untuk ditugaskan."))
      );
      return;
    }

    final titleController = TextEditingController();
    final descController = TextEditingController();
    DateTime dueDate = DateTime.now().add(const Duration(days: 1));
    dynamic selectedEmployee;
    String priority = 'medium';
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(25)),
          ),
          padding: EdgeInsets.only(
            left: 25, right: 25, top: 25,
            bottom: MediaQuery.of(context).viewInsets.bottom + 25,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("Buat Tugas Baru", style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.bold)),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                  ],
                ),
                const SizedBox(height: 20),
                
                // Employee Selection
                Text("Pilih Karyawan", style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!), borderRadius: BorderRadius.circular(12)),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<dynamic>(
                      isExpanded: true,
                      value: selectedEmployee,
                      hint: const Text("Pilih bawahan"),
                      items: subordinates.map((e) => DropdownMenuItem(
                        value: e,
                        child: Text(e['name']),
                      )).toList(),
                      onChanged: (val) => setModalState(() => selectedEmployee = val),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                TextField(
                  controller: titleController,
                  decoration: InputDecoration(
                    labelText: "Judul Tugas",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 16),

                TextField(
                  controller: descController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: "Deskripsi",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 16),

                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("Deadline", style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 8),
                          InkWell(
                            onTap: () async {
                              final picked = await showDatePicker(
                                context: context,
                                initialDate: dueDate,
                                firstDate: DateTime.now(),
                                lastDate: DateTime.now().add(const Duration(days: 365)),
                              );
                              if (picked != null) setModalState(() => dueDate = picked);
                            },
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!), borderRadius: BorderRadius.circular(12)),
                              child: Row(
                                children: [
                                  const Icon(Icons.calendar_today, size: 18, color: Colors.grey),
                                  const SizedBox(width: 8),
                                  Text(DateFormat('dd/MM/yyyy').format(dueDate)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 15),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("Prioritas", style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!), borderRadius: BorderRadius.circular(12)),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                isExpanded: true,
                                value: priority,
                                items: const [
                                  DropdownMenuItem(value: 'low', child: Text("Rendah")),
                                  DropdownMenuItem(value: 'medium', child: Text("Sedang")),
                                  DropdownMenuItem(value: 'high', child: Text("Tinggi")),
                                ],
                                onChanged: (val) => setModalState(() => priority = val!),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 25),

                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: isSubmitting ? null : () async {
                      if (selectedEmployee == null || titleController.text.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Lengkapi data tugas!")));
                        return;
                      }
                      setModalState(() => isSubmitting = true);
                      LoadingDialog.show(context, message: "Memberikan tugas baru...");

                      try {
                        final res = await ApiService.createTask({
                          'assigned_to': selectedEmployee['id'],
                          'title': titleController.text,
                          'description': descController.text,
                          'due_date': DateFormat('yyyy-MM-dd').format(dueDate),
                          'priority': priority,
                        });

                        LoadingDialog.hide(context);

                        if (res['status'] == 'success') {
                          Navigator.pop(context);
                          _fetchTasks();
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Tugas berhasil diberikan!"), backgroundColor: Colors.green));
                        } else {
                          setModalState(() => isSubmitting = false);
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? "Gagal memberikan tugas")));
                        }
                      } catch (e) {
                        LoadingDialog.hide(context);
                        setModalState(() => isSubmitting = false);
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red));
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: isSubmitting 
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text("BERIKAN TUGAS", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 10),
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
      backgroundColor: const Color(0xFFFBFBFB),
      appBar: AppBar(
        title: Text("Tugas & Tanggung Jawab", style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
        bottom: TabBar(
          controller: _tabController,
          labelColor: primaryColor,
          unselectedLabelColor: Colors.grey,
          indicatorColor: primaryColor,
          tabs: const [
            Tab(text: "Diterima"),
            Tab(text: "Diberikan"),
          ],
        ),
      ),
      floatingActionButton: _isManager ? FloatingActionButton(
        onPressed: _showCreateTaskModal,
        backgroundColor: primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ) : null,
      body: _isLoading 
        ? const SimpleListSkeleton()
        : TabBarView(
            controller: _tabController,
            children: [
              _buildTaskList(_receivedTasks, isReceived: true),
              _buildTaskList(_sentTasks, isReceived: false),
            ],
          ),
    );
  }

  Widget _buildTaskList(List<dynamic> tasks, {required bool isReceived}) {
    if (tasks.isEmpty) {
      return RefreshIndicator(
        onRefresh: _fetchTasks,
        child: ListView(
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.25),
            Center(
              child: Column(
                children: [
                  Icon(Icons.assignment_outlined, size: 80, color: Colors.grey[300]),
                  const SizedBox(height: 15),
                  Text(isReceived ? "Belum ada tugas untuk Anda" : "Anda belum memberikan tugas", 
                    style: GoogleFonts.outfit(fontSize: 16, color: Colors.grey[500])),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchTasks,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: tasks.length,
        itemBuilder: (context, index) {
          final task = tasks[index];
          return _buildTaskCard(task, isReceived);
        },
      ),
    );
  }

  Widget _buildTaskCard(dynamic task, bool isReceived) {
    final status = task['status'] ?? 'pending';
    final priority = task['priority']?.toString() ?? 'medium';
    
    Color priorityColor = Colors.blue;
    if (priority == 'high' || priority == '3') priorityColor = Colors.red;
    if (priority == 'medium' || priority == '2') priorityColor = Colors.orange;
    if (priority == 'low' || priority == '1') priorityColor = Colors.green;

    Color statusColor = Colors.orange;
    if (status == 'ongoing') statusColor = Colors.blue;
    if (status == 'completed') statusColor = Colors.green;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 3))],
      ),
      child: InkWell(
        onTap: () => _showTaskDetail(task, isReceived),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: priorityColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                    child: Text(priority.toString().toUpperCase(), style: TextStyle(color: priorityColor, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                    child: Text(status.toString().toUpperCase(), style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(task['title']?.toString() ?? 'Tanpa Judul', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(task['description']?.toString() ?? 'Tidak ada deskripsi.', style: TextStyle(color: Colors.grey[600], fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 14, color: Colors.grey[500]),
                  const SizedBox(width: 6),
                  Text("Deadline: ${task['due_date'] ?? task['deadline'] ?? '-'}", style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                  const Spacer(),
                  if (isReceived) ...[
                    Icon(Icons.person, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Text("Dari: ${task['creator']?['name'] ?? 'System'}", style: TextStyle(color: Colors.grey[600], fontSize: 11)),
                  ] else ...[
                    Icon(Icons.person_pin, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Text("Kpd: ${task['assignee']?['name'] ?? '-'}", style: TextStyle(color: Colors.grey[600], fontSize: 11)),
                  ],
                ],
              ),
              if (isReceived && status != 'completed') ...[
                const SizedBox(height: 15),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => _showTaskDetail(task, isReceived),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                    child: Text(status == 'pending' ? "MULAI KERJAKAN" : "LIHAT DETAIL / LANJUTKAN", 
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showTaskDetail(dynamic task, bool isReceived) {
    // Refresh task to get latest activities/progress
    List<dynamic> activities = task['activities'] ?? [];
    double progress = 0;
    if (activities.isNotEmpty) {
      int completed = activities.where((a) => a['status'] == 'completed').length;
      progress = completed / activities.length;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(25))),
          padding: const EdgeInsets.all(25),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("Detail Tugas", style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                  ],
                ),
                const SizedBox(height: 20),
                Text(task['title']?.toString() ?? 'Detail Tugas', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: primaryColor)),
                const SizedBox(height: 10),
                Text(task['description'] ?? 'Tidak ada deskripsi.', style: TextStyle(color: Colors.grey[700], fontSize: 15)),
                const SizedBox(height: 20),
                
                if (activities.isNotEmpty) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("Progress Kegiatan", style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold)),
                      Text("${(progress * 100).toInt()}%", style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: primaryColor)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: LinearProgressIndicator(
                      value: progress,
                      backgroundColor: Colors.grey[200],
                      color: primaryColor,
                      minHeight: 10,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text("Daftar Kegiatan:", style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  ...activities.map((activity) => _buildActivityItem(activity, isReceived, () async {
                    if (isReceived) {
                      await _showEvidenceUploadDialog(activity);
                      // Refresh context
                      _fetchTasks();
                      Navigator.pop(context);
                    }
                  })).toList(),
                  const SizedBox(height: 20),
                ],

                _buildDetailInfo("Status", task['status']?.toString().toUpperCase() ?? '-'),
                _buildDetailInfo("Prioritas", task['priority']?.toString().toUpperCase() ?? '-'),
                _buildDetailInfo("Deadline", (task['due_date'] ?? task['deadline'])?.toString() ?? '-'),
                _buildDetailInfo(isReceived ? "Pemberi Tugas" : "Penerima Tugas", 
                  isReceived ? (task['creator']?['name'] ?? 'System') : (task['assignee']?['name'] ?? '-')),
                
                const SizedBox(height: 30),
                // Only show main action button if no activities, or task is not completed
                if (isReceived && activities.isEmpty && task['status'] != 'completed') 
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        String nextStatus = task['status'] == 'pending' ? 'ongoing' : 'completed';
                        LoadingDialog.show(context, message: "Memperbarui status tugas...");
                        try {
                          final res = await ApiService.updateTaskStatus(task['id'], nextStatus);
                          LoadingDialog.hide(context);
                          if (res['status'] == 'success') {
                            Navigator.pop(context);
                            _fetchTasks();
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Task diupdate ke $nextStatus"), backgroundColor: Colors.green));
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? "Gagal memperbarui status")));
                          }
                        } catch (e) {
                          LoadingDialog.hide(context);
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red));
                        }
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: primaryColor, padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      child: Text(task['status'] == 'pending' ? "MULAI KERJAKAN" : "TANDAI SELESAI", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                
                if (!isReceived && task['status'] == 'pending')
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () async {
                        LoadingDialog.show(context, message: "Membatalkan tugas...");
                        try {
                          final res = await ApiService.deleteTask(task['id']);
                          LoadingDialog.hide(context);
                          if (res['status'] == 'success') {
                            Navigator.pop(context);
                            _fetchTasks();
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Tugas dibatalkan")));
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? "Gagal membatalkan tugas")));
                          }
                        } catch (e) {
                          LoadingDialog.hide(context);
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red));
                        }
                      },
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: const BorderSide(color: Colors.red), padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      child: const Text("BATALKAN TUGAS"),
                    ),
                  ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActivityItem(dynamic activity, bool isReceived, VoidCallback onTap) {
    bool isCompleted = activity['status'] == 'completed';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isCompleted ? Colors.green.withOpacity(0.05) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isCompleted ? Colors.green.withOpacity(0.3) : Colors.grey[200]!),
      ),
      child: Row(
        children: [
          Icon(
            isCompleted ? Icons.check_circle : Icons.radio_button_unchecked,
            color: isCompleted ? Colors.green : Colors.grey,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(activity['activity_name'] ?? '-', style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 14)),
                if (activity['description'] != null)
                  Text(activity['description'], style: TextStyle(fontSize: 12, color: Colors.grey[600])),
              ],
            ),
          ),
          if (isReceived && !isCompleted)
            ElevatedButton(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                minimumSize: const Size(80, 30),
                padding: const EdgeInsets.symmetric(horizontal: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text("Selesaikan", style: TextStyle(fontSize: 11, color: Colors.white)),
            )
          else if (isCompleted)
            const Text("Selesai", style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Future<void> _showEvidenceUploadDialog(dynamic activity) async {
    final picker = ImagePicker();
    XFile? photoBefore;
    XFile? photoAfter;
    final notesController = TextEditingController();
    bool isUploading = false;

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text("Upload Bukti Kegiatan", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(activity['activity_name'], style: const TextStyle(fontWeight: FontWeight.w500)),
                const SizedBox(height: 20),
                
                // Photo Before
                _buildPhotoPicker(
                  label: "Foto Sebelum (Opsional)",
                  file: photoBefore,
                  onTap: () async {
                    final img = await picker.pickImage(source: ImageSource.camera, imageQuality: 50);
                    if (img != null) setState(() => photoBefore = img);
                  },
                ),
                const SizedBox(height: 15),
                
                // Photo After
                _buildPhotoPicker(
                  label: "Foto Sesudah (Wajib)",
                  file: photoAfter,
                  onTap: () async {
                    final img = await picker.pickImage(source: ImageSource.camera, imageQuality: 50);
                    if (img != null) setState(() => photoAfter = img);
                  },
                ),
                const SizedBox(height: 15),
                
                TextField(
                  controller: notesController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: "Catatan (Opsional)",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text("Batal")),
            ElevatedButton(
              onPressed: (photoAfter == null || isUploading) ? null : () async {
                setState(() => isUploading = true);
                LoadingDialog.show(context, message: "Mengunggah bukti kegiatan...");
                try {
                  final res = await ApiService.uploadTaskEvidence(
                    activity['id'],
                    photoBefore: photoBefore?.path,
                    photoAfter: photoAfter?.path,
                    notes: notesController.text,
                  );
                  LoadingDialog.hide(context);
                  setState(() => isUploading = false);
                  
                  if (res['status'] == 'success') {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Bukti berhasil diupload"), backgroundColor: Colors.green));
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? "Gagal upload bukti")));
                  }
                } catch (e) {
                  LoadingDialog.hide(context);
                  setState(() => isUploading = false);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: ${e.toString()}"), backgroundColor: Colors.red));
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: primaryColor),
              child: isUploading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text("Simpan", style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotoPicker({required String label, XFile? file, required VoidCallback onTap}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
        const SizedBox(height: 5),
        InkWell(
          onTap: onTap,
          child: Container(
            height: 100,
            width: double.infinity,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey[300]!),
              borderRadius: BorderRadius.circular(10),
              image: file != null ? DecorationImage(image: FileImage(File(file.path)), fit: BoxFit.cover) : null,
            ),
            child: file == null ? const Icon(Icons.camera_alt, color: Colors.grey) : null,
          ),
        ),
      ],
    );
  }

  Widget _buildDetailInfo(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
