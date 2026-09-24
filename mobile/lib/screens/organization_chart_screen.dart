import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../api/api_service.dart';

/// Model untuk simpul pegawai dalam struktur bagan organisasi
class OrgNode {
  final int id;
  final int? supervisorId;
  final String name;
  final String? email;
  final int? roleId;
  final String role;
  final String? costCenter;
  final String? photo;
  final String? supervisorName;

  final List<OrgNode> subordinates = [];
  int level = 0;
  bool isExpanded = true;

  // Layout coordinates for Visual Chart
  double x = 0.0;
  double y = 0.0;
  double subtreeWidth = 0.0;

  OrgNode({
    required this.id,
    this.supervisorId,
    required this.name,
    this.email,
    this.roleId,
    required this.role,
    this.costCenter,
    this.photo,
    this.supervisorName,
  });

  factory OrgNode.fromJson(Map<String, dynamic> json) {
    return OrgNode(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      supervisorId: json['supervisor_id'] != null
          ? (json['supervisor_id'] is int
              ? json['supervisor_id']
              : int.tryParse(json['supervisor_id'].toString()))
          : null,
      name: json['name']?.toString() ?? 'Karyawan',
      email: json['email']?.toString(),
      roleId: json['role_id'] != null
          ? (json['role_id'] is int
              ? json['role_id']
              : int.tryParse(json['role_id'].toString()))
          : null,
      role: json['role']?.toString() ?? 'Staff / Member',
      costCenter: json['cost_center']?.toString(),
      photo: json['photo']?.toString(),
      supervisorName: json['supervisor_name']?.toString(),
    );
  }

  int get totalSubordinatesCount {
    int count = subordinates.length;
    for (final child in subordinates) {
      count += child.totalSubordinatesCount;
    }
    return count;
  }
}

enum OrgViewMode { chart, list }

class OrganizationChartScreen extends StatefulWidget {
  const OrganizationChartScreen({super.key});

  @override
  State<OrganizationChartScreen> createState() => _OrganizationChartScreenState();
}

class _OrganizationChartScreenState extends State<OrganizationChartScreen> {
  final Color primaryColor = const Color(0xFF800000);
  final Color secondaryColor = const Color(0xFFB00000);
  final Color backgroundColor = const Color(0xFFF8FAFC);

  bool _isLoading = true;
  String? _errorMessage;

  List<OrgNode> _allNodes = [];
  List<OrgNode> _rootNodes = [];
  Map<int, OrgNode> _nodeMap = {};

  OrgViewMode _currentMode = OrgViewMode.chart;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  // InteractiveViewer Transformation Controller
  final TransformationController _transController = TransformationController();
  double _currentScale = 1.0;

  // Chart layout dimensions
  static const double nodeWidth = 220.0;
  static const double nodeHeight = 115.0;
  static const double horizontalSpacing = 30.0;
  static const double verticalSpacing = 70.0;

  double _totalChartWidth = 1000.0;
  double _totalChartHeight = 800.0;

  @override
  void initState() {
    super.initState();
    _transController.addListener(_onTransformChanged);
    _fetchOrganizationChart();
  }

  @override
  void dispose() {
    _transController.removeListener(_onTransformChanged);
    _transController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onTransformChanged() {
    final scale = _transController.value.getMaxScaleOnAxis();
    if ((scale - _currentScale).abs() > 0.05 && mounted) {
      setState(() => _currentScale = scale);
    }
  }

  Future<void> _fetchOrganizationChart() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.getOrganizationChart();
      if (res != null && res['chart'] is List) {
        final rawList = res['chart'] as List;
        final nodes = rawList.map((item) => OrgNode.fromJson(Map<String, dynamic>.from(item))).toList();
        _buildTree(nodes);
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
          _resetView();
        }
      } else {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = "Gagal memuat bagan organisasi. Silakan coba lagi.";
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = "Terjadi kesalahan: $e";
        });
      }
    }
  }

  void _buildTree(List<OrgNode> nodes) {
    _allNodes = nodes;
    _nodeMap = {for (var n in nodes) n.id: n};
    _rootNodes = [];

    // Clear subordinates to allow clean rebuilds
    for (var node in nodes) {
      node.subordinates.clear();
      node.level = 0;
    }

    // Connect children to parents
    for (var node in nodes) {
      if (node.supervisorId != null && _nodeMap.containsKey(node.supervisorId)) {
        _nodeMap[node.supervisorId]!.subordinates.add(node);
      } else {
        _rootNodes.add(node);
      }
    }

    // Sort subordinates by name for consistent layout
    for (var node in nodes) {
      node.subordinates.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    }

    // Calculate level for each node
    for (var root in _rootNodes) {
      _assignLevels(root, 0);
    }

    // Calculate visual positions
    _calculateLayout();
  }

  void _assignLevels(OrgNode node, int level) {
    node.level = level;
    for (var child in node.subordinates) {
      _assignLevels(child, level + 1);
    }
  }

  void _calculateLayout() {
    if (_rootNodes.isEmpty) return;

    double currentX = 40.0;
    for (var root in _rootNodes) {
      _measureSubtree(root);
      _positionSubtree(root, currentX, 40.0);
      currentX += root.subtreeWidth + horizontalSpacing;
    }

    _totalChartWidth = math.max(currentX + 40.0, 1200.0);

    // Compute max level to determine height
    int maxLevel = 0;
    for (var node in _allNodes) {
      if (node.level > maxLevel) maxLevel = node.level;
    }
    _totalChartHeight = math.max((maxLevel + 1) * (nodeHeight + verticalSpacing) + 200.0, 800.0);
  }

  double _measureSubtree(OrgNode node) {
    if (node.subordinates.isEmpty) {
      node.subtreeWidth = nodeWidth;
      return nodeWidth;
    }

    double totalChildrenWidth = 0.0;
    for (int i = 0; i < node.subordinates.length; i++) {
      if (i > 0) totalChildrenWidth += horizontalSpacing;
      totalChildrenWidth += _measureSubtree(node.subordinates[i]);
    }

    node.subtreeWidth = math.max(nodeWidth, totalChildrenWidth);
    return node.subtreeWidth;
  }

  void _positionSubtree(OrgNode node, double startX, double startY) {
    node.y = startY;

    if (node.subordinates.isEmpty) {
      node.x = startX + (node.subtreeWidth - nodeWidth) / 2;
      return;
    }

    double childX = startX;
    final double childY = startY + nodeHeight + verticalSpacing;

    for (var child in node.subordinates) {
      _positionSubtree(child, childX, childY);
      childX += child.subtreeWidth + horizontalSpacing;
    }

    // Center parent above all its children
    final firstChild = node.subordinates.first;
    final lastChild = node.subordinates.last;
    final double childrenCenter = (firstChild.x + (lastChild.x + nodeWidth)) / 2;
    node.x = childrenCenter - (nodeWidth / 2);
  }

  void _zoomIn() {
    final currentMatrix = _transController.value;
    final double scale = currentMatrix.getMaxScaleOnAxis();
    if (scale < 2.5) {
      _transController.value = currentMatrix.clone()..scale(1.25, 1.25);
    }
  }

  void _zoomOut() {
    final currentMatrix = _transController.value;
    final double scale = currentMatrix.getMaxScaleOnAxis();
    if (scale > 0.25) {
      _transController.value = currentMatrix.clone()..scale(0.8, 0.8);
    }
  }

  void _resetView() {
    // Center at top root node
    if (_rootNodes.isNotEmpty) {
      final firstRoot = _rootNodes.first;
      const double initialScale = 0.85;
      final Matrix4 matrix = Matrix4.identity();
      matrix.scale(initialScale, initialScale);
      
      final screenWidth = MediaQuery.of(context).size.width;
      final double targetCenterX = (firstRoot.x + nodeWidth / 2) * initialScale;
      final double offsetX = (screenWidth / 2) - targetCenterX;
      
      matrix.setTranslationRaw(offsetX.clamp(-500.0, 50.0), 30.0, 0.0);
      _transController.value = matrix;
    } else {
      _transController.value = Matrix4.identity();
    }
  }

  Color _getLevelColor(int level) {
    switch (level) {
      case 0:
        return const Color(0xFF800000); // Crimson / Executive
      case 1:
        return const Color(0xFF1E3A8A); // Indigo / Management
      case 2:
        return const Color(0xFF0F766E); // Teal / Lead
      case 3:
        return const Color(0xFF7C3AED); // Purple / Specialist
      default:
        return const Color(0xFF475569); // Slate / Staff
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.black87, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Bagan Organisasi",
              style: GoogleFonts.outfit(
                color: Colors.black87,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.lock_outline, size: 10, color: Colors.blue),
                      const SizedBox(width: 3),
                      Text(
                        "Hanya Dilihat",
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.blue[800],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  "${_allNodes.length} Anggota",
                  style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600]),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: "Muat Ulang",
            icon: const Icon(Icons.refresh_rounded, color: Colors.black87),
            onPressed: _fetchOrganizationChart,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildTopControlBar(),
          Expanded(
            child: _isLoading
                ? _buildLoadingState()
                : _errorMessage != null
                    ? _buildErrorState()
                    : _allNodes.isEmpty
                        ? _buildEmptyState()
                        : _currentMode == OrgViewMode.chart
                            ? _buildVisualChart()
                            : _buildHierarchicalList(),
          ),
        ],
      ),
    );
  }

  Widget _buildTopControlBar() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Column(
        children: [
          Row(
            children: [
              // Segmented Switcher (Chart vs List)
              Expanded(
                child: Container(
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(10),
                  ),
                  padding: const EdgeInsets.all(3),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _currentMode = OrgViewMode.chart),
                          child: Container(
                            decoration: BoxDecoration(
                              color: _currentMode == OrgViewMode.chart
                                  ? Colors.white
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: _currentMode == OrgViewMode.chart
                                  ? [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.06),
                                        blurRadius: 4,
                                        offset: const Offset(0, 1),
                                      ),
                                    ]
                                  : null,
                            ),
                            alignment: Alignment.center,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.account_tree_outlined,
                                  size: 16,
                                  color: _currentMode == OrgViewMode.chart
                                      ? primaryColor
                                      : Colors.grey[600],
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  "Bagan Grafik",
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    fontWeight: _currentMode == OrgViewMode.chart
                                        ? FontWeight.bold
                                        : FontWeight.normal,
                                    color: _currentMode == OrgViewMode.chart
                                        ? primaryColor
                                        : Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _currentMode = OrgViewMode.list),
                          child: Container(
                            decoration: BoxDecoration(
                              color: _currentMode == OrgViewMode.list
                                  ? Colors.white
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: _currentMode == OrgViewMode.list
                                  ? [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.06),
                                        blurRadius: 4,
                                        offset: const Offset(0, 1),
                                      ),
                                    ]
                                  : null,
                            ),
                            alignment: Alignment.center,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.format_list_bulleted_rounded,
                                  size: 16,
                                  color: _currentMode == OrgViewMode.list
                                      ? primaryColor
                                      : Colors.grey[600],
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  "Struktur Tim",
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    fontWeight: _currentMode == OrgViewMode.list
                                        ? FontWeight.bold
                                        : FontWeight.normal,
                                    color: _currentMode == OrgViewMode.list
                                        ? primaryColor
                                        : Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Search box
          Container(
            height: 38,
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(10),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: (val) {
                setState(() => _searchQuery = val.trim().toLowerCase());
              },
              style: GoogleFonts.inter(fontSize: 13),
              decoration: InputDecoration(
                hintText: "Cari nama atau jabatan...",
                hintStyle: GoogleFonts.inter(fontSize: 13, color: Colors.grey[500]),
                prefixIcon: Icon(Icons.search, size: 18, color: Colors.grey[500]),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 16, color: Colors.grey),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(vertical: 8),
                border: InputBorder.none,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(color: primaryColor),
          const SizedBox(height: 16),
          Text(
            "Memuat struktur organisasi...",
            style: GoogleFonts.outfit(color: Colors.grey[600], fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, size: 56, color: Colors.red[300]),
            const SizedBox(height: 16),
            Text(
              "Gagal Memuat Bagan",
              style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage ?? "Terjadi kendala saat memuat data",
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[600]),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _fetchOrganizationChart,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text("Coba Lagi"),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.account_tree_outlined, size: 64, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            "Bagan Organisasi Kosong",
            style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            "Belum ada data struktur pegawai untuk perusahaan Anda.",
            style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODE 1: VISUAL INTERACTIVE CHART (PAN & ZOOM)
  // ─────────────────────────────────────────────────────────────────────────────

  Widget _buildVisualChart() {
    return Stack(
      children: [
        // Pan & Zoom Canvas
        InteractiveViewer(
          transformationController: _transController,
          constrained: false,
          boundaryMargin: const EdgeInsets.all(800),
          minScale: 0.15,
          maxScale: 2.5,
          child: Container(
            width: _totalChartWidth,
            height: _totalChartHeight,
            color: backgroundColor,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Background subtle grid
                CustomPaint(
                  size: Size(_totalChartWidth, _totalChartHeight),
                  painter: _GridBackgroundPainter(),
                ),
                // Connector lines
                CustomPaint(
                  size: Size(_totalChartWidth, _totalChartHeight),
                  painter: _OrgConnectorPainter(
                    nodes: _allNodes,
                    nodeMap: _nodeMap,
                    nodeWidth: nodeWidth,
                    nodeHeight: nodeHeight,
                  ),
                ),
                // Node Cards
                for (var node in _allNodes)
                  Positioned(
                    left: node.x,
                    top: node.y,
                    child: _buildNodeCard(node),
                  ),
              ],
            ),
          ),
        ),

        // Floating Zoom / Reset Controls
        Positioned(
          right: 16,
          bottom: 20,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildFloatingControl(
                icon: Icons.add,
                tooltip: "Perbesar",
                onTap: _zoomIn,
              ),
              const SizedBox(height: 8),
              _buildFloatingControl(
                icon: Icons.remove,
                tooltip: "Perkecil",
                onTap: _zoomOut,
              ),
              const SizedBox(height: 8),
              _buildFloatingControl(
                icon: Icons.center_focus_strong_outlined,
                tooltip: "Pusatkan Bagan",
                onTap: _resetView,
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.75),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  "${(_currentScale * 100).toInt()}%",
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Read-only indicator pill at bottom left
        Positioned(
          left: 16,
          bottom: 20,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.touch_app_outlined, size: 14, color: primaryColor),
                const SizedBox(width: 5),
                Text(
                  "Ketuk profil untuk detail",
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[800],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFloatingControl({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 3,
      shadowColor: Colors.black26,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Tooltip(
          message: tooltip,
          child: Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            child: Icon(icon, size: 20, color: Colors.grey[800]),
          ),
        ),
      ),
    );
  }

  Widget _buildNodeCard(OrgNode node) {
    final bool isHighlighted = _searchQuery.isNotEmpty &&
        (node.name.toLowerCase().contains(_searchQuery) ||
            node.role.toLowerCase().contains(_searchQuery));

    final Color levelColor = _getLevelColor(node.level);

    return GestureDetector(
      onTap: () => _showEmployeeDetailSheet(node),
      child: Container(
        width: nodeWidth,
        height: nodeHeight,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isHighlighted ? primaryColor : Colors.grey[300]!,
            width: isHighlighted ? 2.5 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: isHighlighted
                  ? primaryColor.withOpacity(0.2)
                  : Colors.black.withOpacity(0.04),
              blurRadius: isHighlighted ? 12 : 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Top Level Color Stripe
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              child: Container(
                decoration: BoxDecoration(
                  color: levelColor,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      // Avatar
                      _buildAvatar(node, radius: 18),
                      const SizedBox(width: 10),
                      // Name & Cost Center
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              node.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                            if (node.costCenter != null && node.costCenter!.isNotEmpty)
                              Text(
                                node.costCenter!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  color: Colors.grey[500],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  // Role Badge
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: levelColor.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      node.role,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: levelColor,
                      ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  // Subordinate Indicator
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (node.subordinates.isNotEmpty)
                        Row(
                          children: [
                            Icon(Icons.people_alt_outlined, size: 12, color: Colors.grey[600]),
                            const SizedBox(width: 4),
                            Text(
                              "${node.subordinates.length} Bawahan",
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        )
                      else
                        const SizedBox.shrink(),
                      Icon(
                        Icons.chevron_right_rounded,
                        size: 14,
                        color: Colors.grey[400],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODE 2: HIERARCHICAL LIST VIEW (EXPANDABLE TREE)
  // ─────────────────────────────────────────────────────────────────────────────

  Widget _buildHierarchicalList() {
    final filteredRoots = _filterNodesForList(_rootNodes);

    if (filteredRoots.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.search_off_rounded, size: 52, color: Colors.grey[300]),
              const SizedBox(height: 12),
              Text(
                "Tidak ada pegawai yang cocok",
                style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                "Coba gunakan kata kunci pencarian yang lain.",
                style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[500]),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      children: [
        // Expand/Collapse All buttons
        Padding(
          padding: const EdgeInsets.only(bottom: 8.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () => _toggleExpandAll(true),
                icon: const Icon(Icons.unfold_more, size: 16),
                label: Text("Buka Semua", style: GoogleFonts.inter(fontSize: 12)),
              ),
              TextButton.icon(
                onPressed: () => _toggleExpandAll(false),
                icon: const Icon(Icons.unfold_less, size: 16),
                label: Text("Tutup Semua", style: GoogleFonts.inter(fontSize: 12)),
              ),
            ],
          ),
        ),
        for (var root in filteredRoots) _buildTreeListTile(root),
      ],
    );
  }

  void _toggleExpandAll(bool expand) {
    setState(() {
      for (var n in _allNodes) {
        n.isExpanded = expand;
      }
    });
  }

  List<OrgNode> _filterNodesForList(List<OrgNode> roots) {
    if (_searchQuery.isEmpty) return roots;
    return roots.where((root) => _matchesSearchRecursive(root)).toList();
  }

  bool _matchesSearchRecursive(OrgNode node) {
    if (node.name.toLowerCase().contains(_searchQuery) ||
        node.role.toLowerCase().contains(_searchQuery)) {
      return true;
    }
    for (var child in node.subordinates) {
      if (_matchesSearchRecursive(child)) return true;
    }
    return false;
  }

  Widget _buildTreeListTile(OrgNode node) {
    final bool hasChildren = node.subordinates.isNotEmpty;
    final Color levelColor = _getLevelColor(node.level);
    final bool isMatch = _searchQuery.isNotEmpty &&
        (node.name.toLowerCase().contains(_searchQuery) ||
            node.role.toLowerCase().contains(_searchQuery));

    // When searching, auto expand matching paths
    final bool isExpanded = _searchQuery.isNotEmpty ? true : node.isExpanded;
    final double indent = (node.level * 10.0).clamp(0.0, 30.0);

    return Padding(
      padding: EdgeInsets.only(left: indent),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isMatch ? primaryColor : Colors.grey[200]!,
                width: isMatch ? 2.0 : 1.0,
              ),
              boxShadow: [
                BoxShadow(
                  color: isMatch
                      ? primaryColor.withOpacity(0.08)
                      : Colors.black.withOpacity(0.02),
                  blurRadius: 5,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => _showEmployeeDetailSheet(node),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(6, 9, 10, 9),
                  child: Row(
                    children: [
                      // Colored level accent bar
                      Container(
                        width: 4,
                        height: 32,
                        decoration: BoxDecoration(
                          color: isMatch ? primaryColor : levelColor,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(width: 6),
                      // Expand/collapse trigger if has subordinates
                      if (hasChildren)
                        GestureDetector(
                          onTap: () {
                            setState(() => node.isExpanded = !node.isExpanded);
                          },
                          child: Container(
                            width: 24,
                            height: 24,
                            margin: const EdgeInsets.only(right: 6),
                            decoration: BoxDecoration(
                              color: levelColor.withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isExpanded
                                  ? Icons.keyboard_arrow_down
                                  : Icons.keyboard_arrow_right,
                              size: 16,
                              color: levelColor,
                            ),
                          ),
                        )
                      else
                        const SizedBox(width: 8),
                      // Avatar
                      _buildAvatar(node, radius: 17),
                      const SizedBox(width: 8),
                      // Name & Role & Cost Center
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              node.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Flexible(
                                  flex: 2,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 5,
                                      vertical: 1.5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: levelColor.withOpacity(0.08),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      node.role,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w600,
                                        color: levelColor,
                                      ),
                                    ),
                                  ),
                                ),
                                if (node.costCenter != null &&
                                    node.costCenter!.isNotEmpty) ...[
                                  const SizedBox(width: 4),
                                  Flexible(
                                    flex: 3,
                                    child: Text(
                                      "• ${node.costCenter}",
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(
                                        fontSize: 9.5,
                                        color: Colors.grey[500],
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                      // Subordinate count badge
                      if (hasChildren) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey[100],
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.people_alt_outlined,
                                size: 10,
                                color: Colors.grey[600],
                              ),
                              const SizedBox(width: 3),
                              Text(
                                "${node.subordinates.length}",
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey[700],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(width: 4),
                      Icon(
                        Icons.chevron_right_rounded,
                        size: 16,
                        color: Colors.grey[400],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          // Subordinates list
          if (hasChildren && isExpanded)
            for (var child in node.subordinates)
              if (_searchQuery.isEmpty || _matchesSearchRecursive(child))
                _buildTreeListTile(child),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // READ-ONLY EMPLOYEE DETAIL SHEET (STRICTLY VIEW ONLY)
  // ─────────────────────────────────────────────────────────────────────────────

  void _showEmployeeDetailSheet(OrgNode node) {
    final Color levelColor = _getLevelColor(node.level);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top drag handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                // Header with Read-Only Badge
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.blue.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.visibility_outlined, size: 14, color: Colors.blue),
                          const SizedBox(width: 4),
                          Text(
                            "Detail Profil (Hanya Dilihat)",
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Colors.blue[900],
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.pop(ctx),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Profile Main Info Card
                Row(
                  children: [
                    _buildAvatar(node, radius: 32),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            node.name,
                            style: GoogleFonts.outfit(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: levelColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              node.role,
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: levelColor,
                              ),
                            ),
                          ),
                          if (node.costCenter != null && node.costCenter!.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              "Divisi: ${node.costCenter}",
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Divider(height: 1),
                const SizedBox(height: 16),

                // Email Row
                if (node.email != null && node.email!.isNotEmpty) ...[
                  _buildDetailRow(
                    icon: Icons.email_outlined,
                    label: "Email Perusahaan",
                    value: node.email!,
                    actionWidget: IconButton(
                      icon: const Icon(Icons.copy_rounded, size: 18, color: Colors.grey),
                      tooltip: "Salin Email",
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: node.email!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("Email berhasil disalin"),
                            duration: Duration(seconds: 1),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                // Supervisor (Atasan Langsung)
                _buildSupervisorSection(node),
                const SizedBox(height: 14),

                // Direct Subordinates (Bawahan Langsung)
                _buildSubordinatesSection(node),
                const SizedBox(height: 20),

                // Read-only notice note
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber[50],
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber[200]!),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, size: 18, color: Colors.amber[900]),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          "Bagan organisasi ini bersifat informatif. Perubahan struktur hanya dapat dilakukan oleh Admin HR melalui portal web.",
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: Colors.amber[950],
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetailRow({
    required IconData icon,
    required String label,
    required String value,
    Widget? actionWidget,
  }) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.grey[100],
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 18, color: Colors.grey[700]),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[500]),
              ),
              Text(
                value,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
        ),
        ?actionWidget,
      ],
    );
  }

  Widget _buildSupervisorSection(OrgNode node) {
    final supervisor = node.supervisorId != null ? _nodeMap[node.supervisorId] : null;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.arrow_upward_rounded, size: 16, color: primaryColor),
              const SizedBox(width: 6),
              Text(
                "Atasan Langsung",
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (supervisor != null)
            InkWell(
              onTap: () {
                Navigator.pop(context);
                _showEmployeeDetailSheet(supervisor);
              },
              child: Row(
                children: [
                  _buildAvatar(supervisor, radius: 16),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          supervisor.name,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        Text(
                          supervisor.role,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Colors.grey[400]),
                ],
              ),
            )
          else
            Text(
              node.supervisorName ?? "Tidak memiliki atasan langsung (Pucuk Pimpinan / Direksi)",
              style: GoogleFonts.inter(
                fontSize: 12,
                fontStyle: FontStyle.italic,
                color: Colors.grey[500],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSubordinatesSection(OrgNode node) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.arrow_downward_rounded, size: 16, color: primaryColor),
                  const SizedBox(width: 6),
                  Text(
                    "Bawahan Langsung (${node.subordinates.length} orang)",
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                ],
              ),
              if (node.totalSubordinatesCount > node.subordinates.length)
                Text(
                  "Total Tim: ${node.totalSubordinatesCount}",
                  style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[500]),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (node.subordinates.isNotEmpty)
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 180),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: node.subordinates.length,
                separatorBuilder: (_, index) => const Divider(height: 10),
                itemBuilder: (ctx, i) {
                  final sub = node.subordinates[i];
                  return InkWell(
                    onTap: () {
                      Navigator.pop(context);
                      _showEmployeeDetailSheet(sub);
                    },
                    child: Row(
                      children: [
                        _buildAvatar(sub, radius: 15),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                sub.name,
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87,
                                ),
                              ),
                              Text(
                                sub.role,
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Colors.grey[400]),
                      ],
                    ),
                  );
                },
              ),
            )
          else
            Text(
              "Tidak memiliki bawahan langsung.",
              style: GoogleFonts.inter(
                fontSize: 12,
                fontStyle: FontStyle.italic,
                color: Colors.grey[500],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAvatar(OrgNode node, {double radius = 18}) {
    String? fixedUrl;
    if (node.photo != null && node.photo!.isNotEmpty) {
      fixedUrl = ApiService.fixUrl(node.photo!);
    }

    final hasValidUrl = fixedUrl != null && fixedUrl.startsWith('http');
    final initial = node.name.isNotEmpty ? node.name[0].toUpperCase() : 'U';

    return CircleAvatar(
      radius: radius,
      backgroundColor: primaryColor.withOpacity(0.1),
      backgroundImage: hasValidUrl ? NetworkImage(fixedUrl) : null,
      child: !hasValidUrl
          ? Text(
              initial,
              style: GoogleFonts.outfit(
                color: primaryColor,
                fontWeight: FontWeight.bold,
                fontSize: radius * 0.9,
              ),
            )
          : null,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM PAINTERS FOR VISUAL TREE & GRID
// ─────────────────────────────────────────────────────────────────────────────

class _GridBackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final dotPaint = Paint()
      ..color = const Color(0xFFCBD5E1).withOpacity(0.4)
      ..style = PaintingStyle.fill;

    const double step = 30.0;
    for (double x = 0; x < size.width; x += step) {
      for (double y = 0; y < size.height; y += step) {
        canvas.drawCircle(Offset(x, y), 1.0, dotPaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _OrgConnectorPainter extends CustomPainter {
  final List<OrgNode> nodes;
  final Map<int, OrgNode> nodeMap;
  final double nodeWidth;
  final double nodeHeight;

  _OrgConnectorPainter({
    required this.nodes,
    required this.nodeMap,
    required this.nodeWidth,
    required this.nodeHeight,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..color = const Color(0xFF94A3B8)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    for (var parent in nodes) {
      if (parent.subordinates.isEmpty) continue;

      final double parentBottomX = parent.x + (nodeWidth / 2);
      final double parentBottomY = parent.y + nodeHeight;

      if (parent.subordinates.length == 1) {
        // Direct vertical line to only child
        final child = parent.subordinates.first;
        final double childTopX = child.x + (nodeWidth / 2);
        final double childTopY = child.y;

        final path = Path();
        path.moveTo(parentBottomX, parentBottomY);
        path.lineTo(childTopX, childTopY);
        canvas.drawPath(path, linePaint);
      } else {
        // Branching connector: parent to midpoint Y, horizontal bar, down to children
        final double firstChildTopY = parent.subordinates.first.y;
        final double midY = parentBottomY + ((firstChildTopY - parentBottomY) / 2);

        // 1. Line down from parent to midY
        final parentPath = Path();
        parentPath.moveTo(parentBottomX, parentBottomY);
        parentPath.lineTo(parentBottomX, midY);
        canvas.drawPath(parentPath, linePaint);

        // 2. Horizontal line spanning from first child X to last child X
        final double minChildX = parent.subordinates.first.x + (nodeWidth / 2);
        final double maxChildX = parent.subordinates.last.x + (nodeWidth / 2);

        final horizPath = Path();
        horizPath.moveTo(minChildX, midY);
        horizPath.lineTo(maxChildX, midY);
        canvas.drawPath(horizPath, linePaint);

        // 3. Vertical lines from midY down to each child
        for (var child in parent.subordinates) {
          final double childTopX = child.x + (nodeWidth / 2);
          final double childTopY = child.y;

          final childPath = Path();
          childPath.moveTo(childTopX, midY);
          childPath.lineTo(childTopX, childTopY);
          canvas.drawPath(childPath, linePaint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _OrgConnectorPainter oldDelegate) {
    return oldDelegate.nodes != nodes;
  }
}
