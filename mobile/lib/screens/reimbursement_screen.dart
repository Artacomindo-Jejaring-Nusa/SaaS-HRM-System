import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';
import 'reimbursement_form_screen.dart';


class ReimbursementScreen extends StatefulWidget {
  @override
  _ReimbursementScreenState createState() => _ReimbursementScreenState();
}

class _ReimbursementScreenState extends State<ReimbursementScreen> {
  final Color primaryColor = const Color(0xFF800000);
  List<dynamic> _claims = [];
  List<dynamic> _employees = [];
  bool _isLoading = true;
  final currencyFormatter = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    _fetchClaims();
    _fetchEmployees();
  }

  Future<void> _fetchEmployees() async {
    try {
      final emps = await ApiService.getEmployees();
      if (mounted) {
        setState(() {
          _employees = emps ?? [];
        });
      }
    } catch (e) {
      print("Error fetching employees: $e");
    }
  }

  Future<void> _fetchClaims() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getReimbursements();
    if (mounted) {
      setState(() {
        _claims = data ?? [];
        _isLoading = false;
      });
    }
  }

  void _showAddDialog() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ReimbursementFormScreen(
          employees: _employees,
          onSubmitted: _fetchClaims,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBFBFB),
      appBar: AppBar(
        title: Text(
          "Klaim Biaya",
          style: GoogleFonts.inter(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchClaims),
        ],
      ),
      body: _isLoading
          ? const SimpleListSkeleton()
          : RefreshIndicator(
              onRefresh: _fetchClaims,
              child: _claims.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: _claims.length,
                      itemBuilder: (context, index) =>
                          _buildClaimCard(_claims[index]),
                    ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: primaryColor,
        onPressed: _showAddDialog,
        label: Text(
          "AJUKAN KLAIM",
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        icon: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.payments_outlined, size: 80, color: Colors.grey[300]),
          const SizedBox(height: 15),
          const Text("Belum ada pengajuan klaim"),
        ],
      ),
    );
  }

  Widget _buildClaimCard(dynamic claim) {
    final status = claim['status'].toString().toLowerCase();
    Color statusColor = Colors.orange;
    if (status == 'approved') statusColor = Colors.green;
    if (status == 'rejected') statusColor = Colors.red;

    final priority = (claim['priority'] ?? 'Normal').toString();
    Color priorityColor = Colors.blue;
    if (priority.toLowerCase() == 'urgent') priorityColor = Colors.orange;
    if (priority.toLowerCase() == 'top urgent' || priority.toLowerCase() == 'top_urgent') priorityColor = Colors.red;

    return Container(
      margin: const EdgeInsets.only(bottom: 15),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                DateFormat(
                  'dd MMM yyyy',
                ).format(DateTime.parse(claim['created_at'])),
                style: TextStyle(color: Colors.grey[600], fontSize: 13),
              ),
              Row(
                children: [
                  if (status != 'rejected') ...[
                    IconButton(
                      constraints: const BoxConstraints(),
                      padding: EdgeInsets.zero,
                      icon: Icon(
                        Icons.picture_as_pdf,
                        color: primaryColor,
                        size: 20,
                      ),
                      onPressed: () =>
                          ApiService.launchPdf('reimbursement', claim['id']),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      constraints: const BoxConstraints(),
                      padding: EdgeInsets.zero,
                      icon: Icon(
                        Icons.table_view,
                        color: Colors.green,
                        size: 20,
                      ),
                      onPressed: () =>
                          ApiService.launchExcel('reimbursement', claim['id']),
                    ),
                  ],
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      status.toUpperCase(),
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              if (claim['divisi'] != null && claim['divisi'].toString().isNotEmpty) ...[
                Icon(Icons.business_rounded, size: 14, color: Colors.grey[500]),
                const SizedBox(width: 4),
                Text(
                  claim['divisi'].toString(),
                  style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                ),
                const SizedBox(width: 12),
              ],
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: priorityColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  priority.toUpperCase(),
                  style: GoogleFonts.inter(
                    color: priorityColor,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              if (claim['tujuan'] != null && claim['tujuan'].toString().isNotEmpty) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    "Tujuan: ${claim['tujuan']}",
                    style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600], fontStyle: FontStyle.italic),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 15),
          Text(
            claim['title'],
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (claim['employee_name'] != null && claim['employee_name'].toString().isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.person, size: 14, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  claim['employee_name'].toString(),
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: Colors.grey[700],
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 5),
          Text(
            currencyFormatter.format(double.parse(claim['amount'].toString())),
            style: GoogleFonts.outfit(
              fontSize: 18,
              color: primaryColor,
              fontWeight: FontWeight.bold,
            ),
          ),

          if (claim['items'] != null && claim['items'] is List && (claim['items'] as List).isNotEmpty) ...[
            const Divider(height: 30),
            Text(
              "Rincian Item:",
              style: GoogleFonts.inter(
                fontWeight: FontWeight.bold,
                fontSize: 12,
                color: Colors.grey[800],
              ),
            ),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[200]!),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: (claim['items'] as List).length,
                separatorBuilder: (context, idx) => Divider(height: 1, color: Colors.grey[200]),
                itemBuilder: (context, idx) {
                  final item = (claim['items'] as List)[idx];
                  final qty = item['qty'] ?? 1;
                  final price = double.tryParse(item['estimasi_harga'].toString()) ?? 0.0;
                  final subtotal = qty * price;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                item['spesifikasi']?.toString() ?? 'Item Tanpa Nama',
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                  color: Colors.black87,
                                ),
                              ),
                            ),
                            Text(
                              currencyFormatter.format(subtotal),
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                color: Colors.black87,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "$qty ${item['unit'] ?? 'Pcs'} x ${currencyFormatter.format(price)}",
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: Colors.grey[600],
                          ),
                        ),
                        if (item['keterangan'] != null && item['keterangan'].toString().isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            "Tgl/Ket: ${item['keterangan']}",
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              fontStyle: FontStyle.italic,
                              color: Colors.grey[500],
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),
          ],

          if (claim['attachment'] != null) ...[
            const SizedBox(height: 15),
            SizedBox(
              height: 150,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: (claim['attachment'] is List)
                    ? claim['attachment'].length
                    : 1,
                itemBuilder: (context, i) {
                  String? path = (claim['attachment'] is List)
                      ? claim['attachment'][i]
                      : claim['attachment'];
                  String imageUrl = path!;
                  imageUrl = ApiService.fixUrl(imageUrl);

                  return Container(
                    width: 250,
                    margin: const EdgeInsets.only(right: 10),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.network(
                        imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (c, e, s) => Container(
                          color: Colors.grey[100],
                          child: const Center(
                            child: Icon(Icons.broken_image, size: 20),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],

          if (claim['description'] != null) ...[
            const SizedBox(height: 10),
            Text(
              claim['description'],
              style: TextStyle(color: Colors.grey[600], fontSize: 13),
            ),
          ],
          if (claim['remark'] != null) ...[
            const Divider(height: 30),
            Text(
              "Catatan Admin:",
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 12,
                color: Colors.grey[800],
              ),
            ),
            const SizedBox(height: 5),
            Text(
              claim['remark'],
              style: TextStyle(
                color: Colors.red[700],
                fontStyle: FontStyle.italic,
                fontSize: 12,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
