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

class _FleetLogScreenState extends State<FleetLogScreen> {
  bool _isLoading = true;
  List<dynamic> _logs = [];
  Map<String, dynamic>? _report;
  final Color primaryColor = Color(0xFF800000);

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final logs = await ApiService.getVehicleLogs();
      final report = await ApiService.getVehicleReport();
      if (mounted) {
        setState(() {
          _logs = logs ?? [];
          _report = report;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Color(0xFFFBFBFB),
      appBar: AppBar(
        title: Text(
          "Fleet & Vehicle Log",
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        backgroundColor: primaryColor,
        elevation: 0,
        centerTitle: true,
        iconTheme: IconThemeData(color: Colors.white),
      ),
      body: _isLoading
          ? const CardAndListSkeleton()
          : RefreshIndicator(
              onRefresh: _fetchData,
              color: primaryColor,
              child: SingleChildScrollView(
                padding: EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSummaryCard(),
                    SizedBox(height: 25),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "Riwayat Perjalanan",
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        TextButton.icon(
                          onPressed: () => _showSOPModal(),
                          icon: Icon(Icons.description_outlined, size: 20),
                          label: Text("SOP & SK"),
                          style: TextButton.styleFrom(
                            foregroundColor: primaryColor,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 10),
                    _logs.isEmpty
                        ? _buildEmptyState()
                        : ListView.builder(
                            shrinkWrap: true,
                            physics: NeverScrollableScrollPhysics(),
                            itemCount: _logs.length,
                            itemBuilder: (context, index) =>
                                _buildLogCard(_logs[index]),
                          ),
                  ],
                ),
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openDepartureForm(),
        backgroundColor: primaryColor,
        icon: Icon(Icons.add_road, color: Colors.white),
        label: Text(
          "CATAT PERJALANAN",
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
      ),
    );
  }

  Widget _buildSummaryCard() {
    if (_report == null) return Container();
    final summary = _report!['summary'];
    return Container(
      padding: EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [primaryColor, Color(0xFFB00000)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(25),
        boxShadow: [
          BoxShadow(
            color: primaryColor.withOpacity(0.3),
            blurRadius: 15,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildStatItem(
                "Total Perjalanan",
                summary['total_trips'].toString(),
                Icons.directions_car,
              ),
              _buildStatItem(
                "Jarak (KM)",
                summary['total_distance'].toString(),
                Icons.speed,
              ),
            ],
          ),
          Divider(color: Colors.white24, height: 30),
          /* Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Total Biaya Perjalanan",
                style: GoogleFonts.outfit(color: Colors.white70, fontSize: 12),
              ),
              Text(
                NumberFormat.currency(
                  locale: 'id',
                  symbol: 'Rp ',
                  decimalDigits: 0,
                ).format(
                  double.tryParse(summary['total_cost'].toString()) ?? 0,
                ),
                style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ), */
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon) {
    return Row(
      children: [
        Container(
          padding: EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white10,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
        SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: GoogleFonts.outfit(color: Colors.white70, fontSize: 10),
            ),
            Text(
              value,
              style: GoogleFonts.outfit(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          Icon(Icons.directions_off, size: 60, color: Colors.grey[300]),
          SizedBox(height: 15),
          Text(
            "Belum ada riwayat perjalanan",
            style: TextStyle(color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }

  Widget _buildLogCard(Map<String, dynamic> log) {
    bool isCompleted =
        log['status'] == 'completed' || log['status'] == 'approved';
    return Container(
      margin: EdgeInsets.only(bottom: 15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: InkWell(
        onTap: () => _showLogDetail(log),
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: _getStatusColor(log['status']).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: Icon(
                      Icons.commute,
                      color: _getStatusColor(log['status']),
                    ),
                  ),
                  SizedBox(width: 15),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          log['vehicle_name'] ?? 'Kendaraan',
                          style: GoogleFonts.outfit(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                        Text(
                          log['plate_number'] ?? '',
                          style: GoogleFonts.outfit(
                            color: Colors.grey[500],
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _buildBadge(log['status']),
                ],
              ),
              SizedBox(height: 15),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildTripNode(
                    "Keberangkatan",
                    _formatDate(log['departure_date']),
                    log['odometer_start'].toString() + " KM",
                  ),
                  Icon(Icons.arrow_forward, color: Colors.grey[300], size: 16),
                  _buildTripNode(
                    "Kepulangan",
                    isCompleted ? _formatDate(log['return_date']) : "—",
                    isCompleted ? log['odometer_end'].toString() + " KM" : "—",
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTripNode(String title, String date, String km) {
    return Expanded(
      child: Column(
        crossAxisAlignment: title == "Keberangkatan"
            ? CrossAxisAlignment.start
            : CrossAxisAlignment.end,
        children: [
          Text(
            title,
            style: TextStyle(
              color: Colors.grey[400],
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            date,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
          Text(
            km,
            style: TextStyle(
              color: primaryColor,
              fontWeight: FontWeight.w900,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(String status) {
    Color color = _getStatusColor(status);
    String label = status.toUpperCase();
    if (status == 'departure') label = 'PERJALANAN';
    if (status == 'completed') label = 'MENUNGGU';
    if (status == 'approved') label = 'DIVALIDASI';

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 9,
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'departure':
        return Colors.blue;
      case 'completed':
        return Colors.orange;
      case 'approved':
        return Colors.green;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _formatDate(String? date) {
    if (date == null) return "—";
    try {
      DateTime dt = DateTime.parse(date);
      return DateFormat('dd MMM yyyy').format(dt);
    } catch (e) {
      return "—";
    }
  }

  void _showLogDetail(Map<String, dynamic> log) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _DetailModal(log: log),
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

  void _openDepartureForm() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => _DepartureFormScreen()),
    );
    if (result == true) _fetchData();
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// INTERNAL WIDGETS & FORMS
// ════════════════════════════════════════════════════════════════════════════════════════════

class _DepartureFormScreen extends StatefulWidget {
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
  final TextEditingController _dateController = TextEditingController(
    text: DateFormat('yyyy-MM-dd').format(DateTime.now()),
  );

  File? _image;
  bool _isSubmitting = false;

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 50,
    );
    if (pickedFile != null) {
      setState(() => _image = File(pickedFile.path));
    }
  }

  void _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_image == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Silakan foto odometer keberangkatan")),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Mencatat keberangkatan perjalanan...");
    try {
      final data = {
        'vehicle_name': _vehicleNameController.text,
        'plate_number': _plateNumberController.text,
        'destination': _destinationController.text,
        'purpose': _purposeController.text,
        'odometer_start': _odometerController.text,
        'departure_date': _dateController.text,
      };

      final result = await ApiService.submitDeparture(data, _image!.path);
      LoadingDialog.hide(context);

      if (result['status'] == 'success') {
        Navigator.pop(context, true);
      } else {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['message'] ?? "Gagal menyimpan")),
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
          "Pencatatan Keberangkatan",
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        backgroundColor: Color(0xFF800000),
        iconTheme: IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Informasi Kendaraan",
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              SizedBox(height: 15),
              _buildField(
                "Nama Kendaraan *",
                _vehicleNameController,
                Icons.car_rental,
              ),
              _buildField(
                "Plat Nomor *",
                _plateNumberController,
                Icons.numbers,
              ),
              SizedBox(height: 20),
              Text(
                "Detail Perjalanan",
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              SizedBox(height: 15),
              _buildField("Tujuan *", _destinationController, Icons.map),
              _buildField(
                "Keperluan *",
                _purposeController,
                Icons.business_center,
              ),
              _buildField(
                "Odometer Awal (KM) *",
                _odometerController,
                Icons.speed,
                isNumber: true,
              ),
              SizedBox(height: 15),
              Text(
                "Bukti Foto Odometer",
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: Colors.grey[700],
                ),
              ),
              SizedBox(height: 10),
              InkWell(
                onTap: _pickImage,
                child: Container(
                  width: double.infinity,
                  height: 150,
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(
                      color: Colors.grey[300]!,
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: _image == null
                      ? Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.camera_alt,
                              color: Colors.grey,
                              size: 40,
                            ),
                            Text(
                              "Ambil Foto KM Awal",
                              style: TextStyle(color: Colors.grey),
                            ),
                          ],
                        )
                      : ClipRRect(
                          borderRadius: BorderRadius.circular(15),
                          child: Image.file(_image!, fit: BoxFit.cover),
                        ),
                ),
              ),
              SizedBox(height: 30),
              SizedBox(
                width: double.infinity,
                height: 55,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Color(0xFF800000),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(15),
                    ),
                  ),
                  child: _isSubmitting
                      ? CircularProgressIndicator(color: Colors.white)
                      : Text(
                          "MULAI PERJALANAN",
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
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

  Widget _buildField(
    String label,
    TextEditingController controller,
    IconData icon, {
    bool isNumber = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: TextFormField(
        controller: controller,
        keyboardType: isNumber ? TextInputType.number : TextInputType.text,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, color: Color(0xFF800000), size: 20),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          filled: true,
          fillColor: Colors.white,
        ),
        validator: (v) => v!.isEmpty ? "Wajib diisi" : null,
      ),
    );
  }
}

class _DetailModal extends StatelessWidget {
  final Map<String, dynamic> log;
  const _DetailModal({required this.log});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      padding: EdgeInsets.all(25),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Detail Log Kendaraan",
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: Icon(Icons.close),
              ),
            ],
          ),
          SizedBox(height: 20),
          _buildInfoRow("Status", log['status'].toUpperCase(), isBadge: true),
          _buildInfoRow(
            "Kendaraan",
            "${log['vehicle_name']} (${log['plate_number']})",
          ),
          _buildInfoRow("Tujuan", log['destination']),
          _buildInfoRow("Keperluan", log['purpose']),
          Divider(height: 30),
          Row(
            children: [
              Expanded(child: _buildKM("KM AWAL", log['odometer_start'])),
              Expanded(child: _buildKM("KM AKHIR", log['odometer_end'] ?? "—")),
              Expanded(
                child: _buildKM(
                  "TOTAL JARAK",
                  (log['distance'] != null ? "${log['distance']} KM" : "—"),
                ),
              ),
            ],
          ),
          /* if (log['total_cost'] != null &&
              (double.tryParse(log['total_cost'].toString()) ?? 0) > 0) ...[
            Divider(height: 30),
            Text(
              "RINCIAN BIAYA",
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 10,
                color: Colors.grey,
              ),
            ),
            SizedBox(height: 10),
            _buildCostRow("BBM", log['fuel_cost']),
            _buildCostRow("Tol", log['toll_cost']),
            _buildCostRow(
              "Lainnya",
              (double.tryParse((log['other_cost'] ?? 0).toString()) ?? 0) +
                  (double.tryParse((log['parking_cost'] ?? 0).toString()) ?? 0),
            ),
            Divider(),
            _buildCostRow("TOTAL", log['total_cost'], isTotal: true),
          ], */
          SizedBox(height: 30),
          if (log['status'] == 'departure')
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: () => _openReturnForm(context),
                icon: Icon(Icons.check_circle_outline, color: Colors.white),
                label: Text(
                  "SELESAIKAN PERJALANAN",
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green[700],
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                ),
              ),
            ),
          SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isBadge = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600])),
          Text(value, style: TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildKM(String label, dynamic value) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: Colors.grey,
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: 5),
        Text(
          value.toString(),
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: Color(0xFF800000),
          ),
        ),
      ],
    );
  }

  Widget _buildCostRow(String label, dynamic value, {bool isTotal = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            NumberFormat.currency(
              locale: 'id',
              symbol: 'Rp ',
              decimalDigits: 0,
            ).format(double.tryParse(value.toString()) ?? 0),
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: isTotal ? 16 : 13,
            ),
          ),
        ],
      ),
    );
  }

  void _openReturnForm(BuildContext context) {
    Navigator.pop(context);
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            _ReturnFormScreen(logId: log['id'], startKm: log['odometer_start']),
      ),
    );
  }
}

class _ReturnFormScreen extends StatefulWidget {
  final int logId;
  final int startKm;
  _ReturnFormScreen({required this.logId, required this.startKm});
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

  void _pickOdometer() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 50,
    );
    if (picked != null) setState(() => _odometerPhoto = File(picked.path));
  }

  void _pickExpenses() async {
    final picked = await ImagePicker().pickMultiImage(imageQuality: 50);
    if (picked.isNotEmpty)
      setState(() => _expensePhotos.addAll(picked.map((e) => File(e.path))));
  }

  void _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_odometerPhoto == null) return;

    setState(() => _isSubmitting = true);
    LoadingDialog.show(context, message: "Mencatat kepulangan perjalanan...");
    try {
      final data = {
        'return_date': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'odometer_end': _kmController.text,
        'fuel_cost': _fuelController.text.isEmpty ? "0" : _fuelController.text,
        'toll_cost': _tollController.text.isEmpty ? "0" : _tollController.text,
        'parking_cost': _parkController.text.isEmpty ? "0" : _parkController.text,
      };

      final result = await ApiService.submitReturn(
        widget.logId,
        data,
        odometerPhotoPath: _odometerPhoto!.path,
        expenseFiles: _expensePhotos.map((e) => e.path).toList(),
      );

      LoadingDialog.hide(context);
      if (result['status'] == 'success') {
        Navigator.pop(context, true);
      } else {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(result['message'] ?? "Gagal")));
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
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        backgroundColor: Color(0xFF800000),
        iconTheme: IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Odometer Akhir",
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 10),
              TextFormField(
                controller: _kmController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: "KM Akhir *",
                  hintText: "KM Awal: ${widget.startKm}",
                  border: OutlineInputBorder(),
                ),
                validator: (v) => v!.isEmpty || int.parse(v) <= widget.startKm
                    ? "Harus > ${widget.startKm}"
                    : null,
              ),
              SizedBox(height: 15),
              InkWell(
                onTap: _pickOdometer,
                child: Container(
                  height: 120,
                  width: double.infinity,
                  color: Colors.grey[100],
                  child: _odometerPhoto == null
                      ? Icon(Icons.camera_alt)
                      : Image.file(_odometerPhoto!, fit: BoxFit.cover),
                ),
              ),
              /* SizedBox(height: 25),
              Text(
                "Biaya Perjalanan (Opsional)",
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 10),
              _buildSmallField("Biaya BBM", _fuelController),
              _buildSmallField("Biaya Tol", _tollController),
              _buildSmallField("Biaya Parkir/Lainnya", _parkController),
              SizedBox(height: 10),
              TextButton.icon(
                onPressed: _pickExpenses,
                icon: Icon(Icons.add_photo_alternate),
                label: Text("Upload Lampiran Struk (${_expensePhotos.length})"),
              ), */
              SizedBox(height: 30),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleSubmit,
                  child: Text(
                    "KIRIM LAPORAN",
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Color(0xFF800000),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSmallField(String label, TextEditingController c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextFormField(
        controller: c,
        keyboardType: TextInputType.number,
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(),
        ),
      ),
    );
  }
}

class _SOPModal extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      padding: EdgeInsets.all(25),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "SOP & Peraturan Kendaraan",
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: Icon(Icons.close),
              )
            ],
          ),
          SizedBox(height: 15),
          _buildSOPItem(
            Icons.speed,
            "Pengecekan Odometer",
            "Wajib memotret odometer awal & akhir dengan jelas sebelum dan sesudah perjalanan.",
          ),
          _buildSOPItem(
            Icons.badge_outlined,
            "Kualifikasi Driver",
            "Driver wajib memiliki SIM A yang masih berlaku dan dalam kondisi fisik yang sehat.",
          ),
          _buildSOPItem(
            Icons.build_circle_outlined,
            "Pengecekan Unit",
            "Cek air radiator, oli mesin, tekanan ban, dan fungsi rem sebelum kendaraan dinyalakan.",
          ),
          _buildSOPItem(
            Icons.cleaning_services,
            "Kebersihan Unit",
            "Dilarang meninggalkan sampah, merokok, atau makan makanan berbau tajam di dalam mobil.",
          ),
          _buildSOPItem(
            Icons.report_problem,
            "Insiden & Kecelakaan",
            "Jika terjadi tabrakan, segera ambil foto bukti, cari saksi, dan lapor ke HR/GA dalam < 1 jam.",
          ),
          _buildSOPItem(
            Icons.local_parking,
            "Parkir & Keamanan",
            "Pastikan mobil terparkir di tempat aman, gunakan kunci ganda, dan jangan tinggalkan barang berharga.",
          ),
          _buildSOPItem(
            Icons.local_gas_station,
            "Manajemen BBM",
            "Gunakan jenis BBM sesuai spesifikasi kendaraan. Simpan struk asli untuk pelaporan.",
          ),
          _buildSOPItem(
            Icons.vpn_key_outlined,
            "Pengembalian Kunci",
            "Kunci dan STNK harus segera dikembalikan ke bagian GA/Security setelah perjalanan selesai.",
          ),
          _buildSOPItem(
            Icons.health_and_safety_outlined,
            "Perlengkapan Darurat",
            "Pastikan ban serep, dongkrak, dan kotak P3K tersedia di dalam kendaraan sebelum berangkat.",
          ),
          SizedBox(height: 25),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: Color(0xFF800000),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                "SAYA MENGERTI",
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildSOPItem(IconData icon, String title, String desc) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 22, color: Color(0xFF800000)),
          SizedBox(width: 15),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                Text(
                  desc,
                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportModal extends StatelessWidget {
  final Map<String, dynamic> report;
  _ReportModal({required this.report});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      padding: EdgeInsets.all(25),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            "Laporan Mileage & Biaya",
            style: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 20),
          // Simple breakdown logic here based on report data
          _buildDetail(
            "Total Perjalanan",
            report['summary']['total_trips'].toString(),
          ),
          _buildDetail(
            "Total Jarak Tempuh",
            "${report['summary']['total_distance']} KM",
          ),
          /* _buildDetail(
            "Total Biaya BBM",
            "Rp ${report['summary']['total_fuel_cost']}",
          ),
          _buildDetail(
            "Total Biaya Tol",
            "Rp ${report['summary']['total_toll_cost']}",
          ),
          Divider(),
          _buildDetail(
            "Grand Total",
            "Rp " +
                NumberFormat("#,###").format(
                  double.tryParse(report['summary']['total_cost'].toString()) ??
                      0,
                ),
            bold: true,
          ), */
          SizedBox(height: 30),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: Text("Tutup"),
          ),
          SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildDetail(String l, String v, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(l),
          Text(
            v,
            style: TextStyle(
              fontWeight: bold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}
