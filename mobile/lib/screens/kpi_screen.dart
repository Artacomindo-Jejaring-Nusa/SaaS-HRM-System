import 'package:flutter/material.dart';
import '../api/api_service.dart';
import '../widgets/skeleton_loading.dart';

class KpiScreen extends StatefulWidget {
  @override
  _KpiScreenState createState() => _KpiScreenState();
}

class _KpiScreenState extends State<KpiScreen> {
  List<dynamic> _kpis = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadKpis();
  }

  Future<void> _loadKpis() async {
    setState(() => _isLoading = true);
    final data = await ApiService.getKpis();
    if (mounted) {
      // Filter only published ones for employees (usually backend already filters, but being safe)
      setState(() {
        _kpis = data?.where((e) => e['status'] == 'published').toList() ?? [];
        _isLoading = false;
      });
    }
  }

  Color _getScoreColor(num score) {
    if (score >= 80) return Colors.green;
    if (score >= 60) return Colors.amber;
    return Colors.red;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text('KPI Review', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black,
        actions: [
          IconButton(icon: Icon(Icons.refresh), onPressed: _loadKpis),
        ],
      ),
      body: _isLoading
          ? const KpiSkeleton()
          : _kpis.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  padding: EdgeInsets.all(20),
                  itemCount: _kpis.length,
                  itemBuilder: (context, index) {
                    final kpi = _kpis[index];
                    final score = kpi['score_total'] ?? 0;
                    
                    return Container(
                      margin: EdgeInsets.only(bottom: 20),
                      padding: EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(25),
                        border: Border.all(color: Colors.grey.shade100),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.03),
                            blurRadius: 10,
                            offset: Offset(0, 5),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: Colors.red[50],
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          kpi['period'] ?? '-',
                                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF8B0000)),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    kpi['user']?['name'] != null 
                                      ? 'Untuk: ${kpi['user']['name']}' 
                                      : 'Review Kinerja Anda',
                                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
                                  ),
                                  if (kpi['user']?['role']?['name'] != null)
                                    Text(
                                      kpi['user']['role']['name'],
                                      style: TextStyle(fontSize: 11, color: Colors.grey[600], fontWeight: FontWeight.w600),
                                    ),
                                ],
                              ),
                              Container(
                                width: 50,
                                height: 50,
                                decoration: BoxDecoration(
                                  color: _getScoreColor(score).withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(15),
                                ),
                                child: Center(
                                  child: Text(
                                    score.toString(),
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      color: _getScoreColor(score),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 20),
                          Divider(color: Colors.grey.shade50),
                          SizedBox(height: 10),
                          _buildScoreRow('Kedisplinan', kpi['score_discipline'] ?? 0, Colors.green),
                          _buildScoreRow('Skill Teknis', kpi['score_technical'] ?? 0, Colors.blue),
                          _buildScoreRow('Kerjasama', kpi['score_cooperation'] ?? 0, Colors.amber),
                          _buildScoreRow('Attitude', kpi['score_attitude'] ?? 0, Colors.red),
                          SizedBox(height: 20),
                          if (kpi['achievements'] != null && kpi['achievements'].toString().isNotEmpty)
                            _buildSection('Pencapaian:', kpi['achievements'], Colors.green.shade700),
                          if (kpi['improvements'] != null && kpi['improvements'].toString().isNotEmpty)
                            _buildSection('Peningkatan:', kpi['improvements'], Colors.blue.shade700),
                          SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Row(
                                  children: [
                                    Icon(Icons.verified_user_rounded, size: 14, color: Colors.grey[600]),
                                    const SizedBox(width: 5),
                                    Expanded(
                                      child: Text(
                                        'Penilai: ${kpi['reviewer']?['name'] ?? 'Super Admin'}',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey[600]),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              TextButton.icon(
                                onPressed: () => ApiService.launchPdf('kpi', kpi['id']),
                                icon: const Icon(Icons.picture_as_pdf, size: 15, color: Color(0xFF8B0000)),
                                label: const Text('Download PDF', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF8B0000))),
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                                  visualDensity: VisualDensity.compact,
                                  backgroundColor: const Color(0xFF8B0000).withOpacity(0.06),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }

  Widget _buildScoreRow(String label, num score, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey.shade600)),
          ),
          Expanded(
            flex: 5,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(5),
              child: LinearProgressIndicator(
                value: score / 100,
                backgroundColor: color.withOpacity(0.1),
                valueColor: AlwaysStoppedAnimation<Color>(color),
                minHeight: 6,
              ),
            ),
          ),
          SizedBox(width: 10),
          Text(score.toString(), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _buildSection(String title, String content, Color color) {
    return Container(
      margin: EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.all(15),
      width: double.infinity,
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(15),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: color)),
          SizedBox(height: 5),
          Text(
            content,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.black87, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.analytics_outlined, size: 80, color: Colors.grey.shade200),
          SizedBox(height: 20),
          Text(
            'BELUM ADA REVIEW KPI',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 1.2),
          ),
          SizedBox(height: 8),
          Text(
            'Laporan performa Anda akan muncul di sini\nsetelah dipublikasikan oleh HR.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Colors.grey.shade400, height: 1.5),
          ),
        ],
      ),
    );
  }
}
