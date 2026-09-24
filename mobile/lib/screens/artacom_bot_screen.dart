library;

/// ArtacomBotScreen — Full chat UI for Artacom Bot.
///
/// Premium chat interface with:
/// - Animated bot avatar with mood system
/// - Chat bubbles (user right, bot left)
/// - Static action chips & permanent categories dock (no typing required)
/// - Rich inline card widgets
/// - Proactive greeting on entry
/// - Smooth scroll & micro-animations

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../bot/artacom_bot_engine.dart';
import '../bot/bot_response.dart';
import '../api/api_service.dart';
import '../widgets/bot_cards.dart';
import 'leave_screen.dart';
import 'overtime_screen.dart';
import 'salary_screen.dart';
import 'kpi_screen.dart';
import 'reimbursement_screen.dart';
import 'task_screen.dart';
import 'fleet_log_screen.dart';
import 'document_screen.dart';
import 'permit_screen.dart';
import 'shift_swap_screen.dart';
import 'fund_request_screen.dart';
import 'leaderboard_screen.dart';

class ArtacomBotScreen extends StatefulWidget {
  final String userName;
  final Map<String, dynamic>? attendanceData;

  const ArtacomBotScreen({
    super.key,
    this.userName = 'User',
    this.attendanceData,
  });

  @override
  State<ArtacomBotScreen> createState() => _ArtacomBotScreenState();
}

class _ArtacomBotScreenState extends State<ArtacomBotScreen>
    with TickerProviderStateMixin {
  final ArtacomBotEngine _engine = ArtacomBotEngine();
  final ScrollController _scrollController = ScrollController();

  final List<_ChatMessage> _messages = [];
  final Map<String, dynamic> _userData = {};
  bool _isTyping = false;
  bool _isLoadingData = true;

  // Bot mood state
  String _currentMood = 'neutral';

  static const Color _primaryColor = Color(0xFF800000);

  @override
  void initState() {
    super.initState();
    _initializeBot();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initializeBot() async {
    // Load user data in parallel
    setState(() => _isLoadingData = true);

    try {
      final results = await Future.wait([
        ApiService.getLeaves().catchError((_) => null),
        ApiService.getSalaries().catchError((_) => null),
        ApiService.getTasks().catchError((_) => null),
        ApiService.getOvertimes().catchError((_) => null),
      ]);

      final leaves = results[0];
      final salaries = results[1];
      final tasks = results[2];
      final overtimes = results[3];

      // Calculate leave balance
      if (leaves != null) {
        final total = 12; // Default annual leave
        final used = leaves.where((l) =>
            l['status'] == 'approved' || l['status'] == 'disetujui').length;
        final pending = leaves.where((l) =>
            l['status'] == 'pending' || l['status'] == 'menunggu').length;
        _userData['leave'] = {
          'total': total,
          'used': used,
          'remaining': total - used,
          'pending': pending,
        };
      }

      // Latest salary
      if (salaries != null && salaries.isNotEmpty) {
        final latest = salaries.first;
        _userData['salary'] = {
          'status': latest['status'] ?? 'Tercatat',
          'period': latest['period'] ?? latest['month'] ?? 'Bulan ini',
          'amount': latest['total_salary'] ?? latest['net_salary'] ?? 0,
        };
      }

      // Tasks
      if (tasks != null) {
        final totalTasks = tasks.length;
        final pendingTasks = tasks.where((t) =>
            t['status'] != 'completed' && t['status'] != 'selesai').length;
        _userData['task'] = {
          'total': totalTasks,
          'pending': pendingTasks,
          'completed': totalTasks - pendingTasks,
        };
      }

      // Overtimes
      if (overtimes != null) {
        final totalOt = overtimes.length;
        final pendingOt = overtimes.where((o) => o['status'] == 'pending').length;
        final approvedOt = overtimes.where((o) =>
            o['status'] == 'approved' || o['status'] == 'disetujui').length;
        _userData['overtime'] = {
          'total': totalOt,
          'pending': pendingOt,
          'approved': approvedOt,
        };
      }

      if (widget.attendanceData != null) {
        final checkIn = widget.attendanceData!['check_in'] ?? widget.attendanceData!['time_in'];
        final checkOut = widget.attendanceData!['check_out'] ?? widget.attendanceData!['time_out'];
        _userData['attendance'] = {
          'check_in': checkIn ?? 'Belum ada',
          'check_out': checkOut ?? 'Belum ada',
          'status': widget.attendanceData!['status'] ?? (checkIn != null ? 'Hadir' : 'Belum Absen'),
        };
      } else {
        _userData['attendance'] = {
          'check_in': 'Belum ada',
          'check_out': 'Belum ada',
          'status': 'Belum Absen',
        };
      }
    } catch (e) {
      debugPrint('Bot data load error: $e');
    }

    setState(() => _isLoadingData = false);

    // Send proactive greeting
    await Future.delayed(const Duration(milliseconds: 300));
    final greeting = _engine.getProactiveGreeting(
      widget.userName,
      attendanceData: widget.attendanceData,
    );
    _addBotMessage(greeting);
  }

  void _addBotMessage(BotResponse response) {
    setState(() {
      _currentMood = response.mood;
      _messages.add(_ChatMessage(
        text: response.message,
        isUser: false,
        response: response,
        timestamp: DateTime.now(),
      ));
    });
    _scrollToBottom();
  }

  void _addUserMessage(String text) {
    setState(() {
      _messages.add(_ChatMessage(
        text: text,
        isUser: true,
        timestamp: DateTime.now(),
      ));
    });
    _scrollToBottom();
  }

  void _handleAction(String actionCode, [String? label]) {
    // Check if it's a direct navigation action
    if (actionCode.startsWith('NAV_')) {
      _navigateToScreen(actionCode);
      return;
    }

    final displayText = label ?? actionCode;
    _addUserMessage(displayText);

    // Simulate natural bot thinking
    setState(() => _isTyping = true);
    Future.delayed(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() => _isTyping = false);
      final response = _engine.resolveNode(actionCode, userData: _userData);
      _addBotMessage(response);
    });
  }

  void _navigateToScreen(String actionCode) {
    Widget? screen;
    switch (actionCode) {
      case 'NAV_LEAVE':
      case 'NAV_LEAVE_FORM':
      case 'NAV_LEAVE_HISTORY':
        screen = LeaveScreen();
        break;
      case 'NAV_OVERTIME':
        screen = OvertimeScreen();
        break;
      case 'NAV_SALARY':
        screen = SalaryScreen();
        break;
      case 'NAV_KPI':
        screen = KpiScreen();
        break;
      case 'NAV_REIMBURSEMENT':
        screen = ReimbursementScreen();
        break;
      case 'NAV_TASK':
        screen = TaskScreen();
        break;
      case 'NAV_FLEET':
        screen = FleetLogScreen();
        break;
      case 'NAV_DOCUMENT':
        screen = DocumentScreen();
        break;
      case 'NAV_PERMIT':
        screen = PermitScreen();
        break;
      case 'NAV_SHIFT_SWAP':
        screen = ShiftSwapScreen();
        break;
      case 'NAV_FUND_REQUEST':
        screen = FundRequestScreen();
        break;
      case 'NAV_LEADERBOARD':
        screen = LeaderboardScreen();
        break;
      case 'NAV_HOME':
      case 'NAV_ATTENDANCE':
      case 'NAV_HISTORY':
      case 'NAV_CORRECTION':
        // Navigate back to dashboard tab
        Navigator.pop(context, actionCode);
        return;
    }

    if (screen != null) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => screen!));
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ════════════════════════════════════════════════════════
  // BUILD
  // ════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildHeader(),
        Expanded(
          child: _isLoadingData
              ? _buildLoadingState()
              : _buildChatList(),
        ),
        if (_isTyping) _buildTypingIndicator(),
        _buildInputArea(),
      ],
    );
  }

  // ── Header ──
  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          _buildBotAvatar(size: 44),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Artacom Bot',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: _primaryColor,
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: Colors.green[400],
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Online • ${_getMoodLabel()}',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _primaryColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'RBS v2.0',
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: _primaryColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Bot Avatar with mood ──
  Widget _buildBotAvatar({double size = 36}) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: _getMoodGradient(),
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: _getMoodGradient().first.withValues(alpha: 0.4),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Center(
        child: Text(
          _getMoodEmoji(),
          style: TextStyle(fontSize: size * 0.45),
        ),
      ),
    );
  }

  String _getMoodEmoji() {
    switch (_currentMood) {
      case 'happy': return '😊';
      case 'concerned': return '😟';
      case 'sleepy': return '😴';
      case 'excited': return '🤩';
      case 'urgent': return '🚨';
      default: return '🤖';
    }
  }

  String _getMoodLabel() {
    switch (_currentMood) {
      case 'happy': return 'Senang';
      case 'concerned': return 'Khawatir';
      case 'sleepy': return 'Ngantuk';
      case 'excited': return 'Semangat!';
      case 'urgent': return 'DARURAT';
      default: return 'Siap Bantu';
    }
  }

  List<Color> _getMoodGradient() {
    switch (_currentMood) {
      case 'happy': return [const Color(0xFF4CAF50), const Color(0xFF81C784)];
      case 'concerned': return [Colors.orange, Colors.amber];
      case 'sleepy': return [Colors.indigo, Colors.blue];
      case 'excited': return [const Color(0xFFF57C00), const Color(0xFFFFB74D)];
      case 'urgent': return [Colors.red, const Color(0xFFEF5350)];
      default: return [_primaryColor, const Color(0xFFB00000)];
    }
  }

  // ── Loading State ──
  Widget _buildLoadingState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildBotAvatar(size: 60),
          const SizedBox(height: 20),
          Text(
            'Artacom Bot sedang mempersiapkan data...',
            style: GoogleFonts.inter(color: Colors.grey[600]),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: 180,
            child: LinearProgressIndicator(
              color: _primaryColor,
              backgroundColor: _primaryColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ],
      ),
    );
  }

  // ── Chat List ──
  Widget _buildChatList() {
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final message = _messages[index];
        return _buildChatBubble(message);
      },
    );
  }

  // ── Chat Bubble ──
  Widget _buildChatBubble(_ChatMessage message) {
    if (message.isUser) {
      return _buildUserBubble(message);
    }
    return _buildBotBubble(message);
  }

  Widget _buildUserBubble(_ChatMessage message) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            _formatTime(message.timestamp),
            style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[400]),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF800000), Color(0xFFAA2222)],
                ),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                  bottomLeft: Radius.circular(20),
                  bottomRight: Radius.circular(4),
                ),
                boxShadow: [
                  BoxShadow(
                    color: _primaryColor.withValues(alpha: 0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Text(
                message.text,
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBotBubble(_ChatMessage message) {
    final response = message.response;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildBotAvatar(size: 32),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Message bubble
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(4),
                      topRight: Radius.circular(20),
                      bottomLeft: Radius.circular(20),
                      bottomRight: Radius.circular(20),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                    border: Border.all(
                      color: Colors.grey.withValues(alpha: 0.12),
                    ),
                  ),
                  child: Text(
                    message.text,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      height: 1.5,
                      color: Colors.black87,
                    ),
                  ),
                ),

                // Rich Card Widget (if applicable)
                if (response?.uiComponent != null)
                  _buildRichCard(response!),

                // Direct Screen Navigation button if node has navigationTarget
                if (response?.navigationTarget != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: InkWell(
                      onTap: () => _navigateToScreen(response!.navigationTarget!),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 9),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF800000), Color(0xFFAA2222)],
                          ),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: _primaryColor.withValues(alpha: 0.25),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.open_in_new_rounded,
                                color: Colors.white, size: 15),
                            const SizedBox(width: 6),
                            Text(
                              'Buka Halaman Sekarang',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                // Action buttons
                if (response?.actionButtons != null &&
                    response!.actionButtons!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: BotQuickReplyChips(
                      actions: response.actionButtons!
                          .map((a) => {
                                'label': a.label,
                                'actionCode': a.actionCode,
                              })
                          .toList(),
                      onTapWithLabel: (code, label) =>
                          _handleAction(code, label),
                    ),
                  ),

                // Timestamp
                Padding(
                  padding: const EdgeInsets.only(top: 4, left: 4),
                  child: Text(
                    _formatTime(message.timestamp),
                    style: GoogleFonts.inter(
                        fontSize: 10, color: Colors.grey[400]),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRichCard(BotResponse response) {
    switch (response.uiComponent) {
      case 'BotLeaveBalanceCard':
        final data = response.dataPayload;
        if (data != null) {
          return BotLeaveBalanceCard(
            total: data['total'] ?? 12,
            used: data['used'] ?? 0,
            remaining: data['remaining'] ?? 12,
          );
        }
        return const SizedBox.shrink();
      case 'BotSalaryStatusCard':
        if (response.dataPayload != null) {
          return BotSalaryStatusCard(data: response.dataPayload!);
        }
        return const SizedBox.shrink();
      case 'BotEmergencyCard':
        return const BotEmergencyCard();
      case 'BotStreakBadgeCard':
        final data = response.dataPayload;
        if (data != null) {
          return BotStreakBadgeCard(
            streakDays: data['streak_days'] ?? 0,
            badgeName: data['badge_name'] ?? 'Badge',
            leaderboardRank: data['leaderboard_rank'],
          );
        }
        return const SizedBox.shrink();
      case 'BotPerformanceGauge':
        final data = response.dataPayload;
        if (data != null) {
          return BotPerformanceGauge(
            score: (data['score'] ?? 0).toDouble(),
            period: data['period'] ?? 'Bulan ini',
          );
        }
        return const SizedBox.shrink();
      default:
        return const SizedBox.shrink();
    }
  }

  // ── Typing Indicator ──
  Widget _buildTypingIndicator() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Row(
        children: [
          _buildBotAvatar(size: 28),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _TypingDot(delay: 0),
                const SizedBox(width: 4),
                _TypingDot(delay: 200),
                const SizedBox(width: 4),
                _TypingDot(delay: 400),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Static Summary Dock (No typing required) ──
  Widget _buildInputArea() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.analytics_rounded,
                          size: 15, color: _primaryColor),
                      const SizedBox(width: 6),
                      Text(
                        'RINGKASAN CEPAT',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: _primaryColor,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  InkWell(
                    onTap: () => _handleAction('root', '🏠 Menu Utama'),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      child: Row(
                        children: [
                          Icon(Icons.home_rounded,
                              size: 14, color: Colors.grey[600]),
                          const SizedBox(width: 4),
                          Text(
                            'Menu Utama',
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey[700],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildPermanentDockChip(
                        '📊 Semua Ringkasan', 'summary_all',
                        isHighlight: true),
                    _buildPermanentDockChip(
                        '⏱️ Absensi Hari Ini', 'summary_attendance'),
                    _buildPermanentDockChip('🏖️ Sisa Cuti', 'summary_leave'),
                    _buildPermanentDockChip('💰 Status Gaji', 'summary_salary'),
                    _buildPermanentDockChip('📋 Tugas Aktif', 'summary_task'),
                    _buildPermanentDockChip(
                        '⏳ Jam Lembur', 'summary_overtime'),
                    _buildPermanentDockChip('📈 Review KPI', 'summary_kpi'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPermanentDockChip(String label, String code,
      {bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _handleAction(code, label),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: isHighlight
                  ? _primaryColor.withValues(alpha: 0.08)
                  : const Color(0xFFF6F7F9),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isHighlight
                    ? _primaryColor.withValues(alpha: 0.35)
                    : Colors.grey.withValues(alpha: 0.22),
              ),
            ),
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: isHighlight ? FontWeight.w700 : FontWeight.w600,
                color: isHighlight ? _primaryColor : const Color(0xFF333333),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _formatTime(DateTime time) {
    final h = time.hour.toString().padLeft(2, '0');
    final m = time.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

// ═══════════════════════════════════════════════════════════
// CHAT MESSAGE MODEL
// ═══════════════════════════════════════════════════════════

class _ChatMessage {
  final String text;
  final bool isUser;
  final BotResponse? response;
  final DateTime timestamp;

  const _ChatMessage({
    required this.text,
    required this.isUser,
    this.response,
    required this.timestamp,
  });
}

// ═══════════════════════════════════════════════════════════
// TYPING DOT ANIMATION
// ═══════════════════════════════════════════════════════════

class _TypingDot extends StatefulWidget {
  final int delay;
  const _TypingDot({required this.delay});

  @override
  State<_TypingDot> createState() => _TypingDotState();
}

class _TypingDotState extends State<_TypingDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _animation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _controller.repeat(reverse: true);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: Colors.grey[400]!.withValues(alpha: 0.4 + _animation.value * 0.6),
            shape: BoxShape.circle,
          ),
        );
      },
    );
  }
}
