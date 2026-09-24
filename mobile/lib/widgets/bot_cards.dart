library;

/// Bot Card Widgets — Rich inline chat cards for Artacom Bot.
///
/// These custom widgets render structured data (cuti, gaji, K3, etc.)
/// directly inside the chat conversation as beautiful, interactive cards.

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ═══════════════════════════════════════════════════════════
// 🌴 LEAVE BALANCE CARD
// ═══════════════════════════════════════════════════════════

class BotLeaveBalanceCard extends StatelessWidget {
  final int total;
  final int used;
  final int remaining;

  const BotLeaveBalanceCard({
    super.key,
    required this.total,
    required this.used,
    required this.remaining,
  });

  @override
  Widget build(BuildContext context) {
    final progress = total > 0 ? used / total : 0.0;
    final color = remaining > 3 ? const Color(0xFF2E7D32) : remaining > 0 ? Colors.orange : Colors.red;
    
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withValues(alpha: 0.1), color.withValues(alpha: 0.05)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.calendar_today, color: color, size: 18),
              const SizedBox(width: 8),
              Text(
                'Sisa Cuti Tahunan',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _statItem('Total', '$total', Colors.grey[700]!),
              _statItem('Terpakai', '$used', Colors.orange[700]!),
              _statItem('Sisa', '$remaining', color),
            ],
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              backgroundColor: Colors.grey[200],
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${(progress * 100).toInt()}% terpakai',
            style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }

  Widget _statItem(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: GoogleFonts.outfit(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600]),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 💰 SALARY STATUS CARD
// ═══════════════════════════════════════════════════════════

class BotSalaryStatusCard extends StatelessWidget {
  final Map<String, dynamic> data;

  const BotSalaryStatusCard({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final status = data['status'] ?? 'pending';
    final period = data['period'] ?? '-';
    final isPaid = status == 'paid' || status == 'transferred';
    final color = isPaid ? const Color(0xFF2E7D32) : Colors.orange;

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withValues(alpha: 0.1), color.withValues(alpha: 0.05)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isPaid ? Icons.check_circle : Icons.schedule,
              color: color,
              size: 28,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Status Gaji',
                  style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                ),
                const SizedBox(height: 2),
                Text(
                  isPaid ? 'Sudah Ditransfer ✅' : 'Dalam Proses ⏳',
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                Text(
                  'Periode: $period',
                  style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 🚨 EMERGENCY K3 CARD
// ═══════════════════════════════════════════════════════════

class BotEmergencyCard extends StatelessWidget {
  const BotEmergencyCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFEBEE), Color(0xFFFFCDD2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red[300]!, width: 2),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Colors.red, size: 28),
              const SizedBox(width: 8),
              Text(
                'KONTAK DARURAT K3',
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: Colors.red[900],
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _emergencyRow(Icons.phone, 'HRD Darurat', '(021) xxx-xxxx'),
          const SizedBox(height: 8),
          _emergencyRow(Icons.local_hospital, 'Emergency Nasional', '112 / 119'),
          const SizedBox(height: 8),
          _emergencyRow(Icons.medical_services, 'Ambulans', '118 / 119'),
        ],
      ),
    );
  }

  Widget _emergencyRow(IconData icon, String label, String number) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.red[700]),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
          ),
        ),
        Text(
          number,
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w800,
            fontSize: 14,
            color: Colors.red[900],
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 🏆 STREAK BADGE CARD
// ═══════════════════════════════════════════════════════════

class BotStreakBadgeCard extends StatelessWidget {
  final int streakDays;
  final String badgeName;
  final int? leaderboardRank;

  const BotStreakBadgeCard({
    super.key,
    required this.streakDays,
    required this.badgeName,
    this.leaderboardRank,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFF8E1), Color(0xFFFFECB3)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.amber[300]!),
      ),
      child: Column(
        children: [
          Text('🏅', style: TextStyle(fontSize: 48)),
          const SizedBox(height: 8),
          Text(
            badgeName,
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Colors.amber[900],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '🔥 $streakDays hari berturut-turut tepat waktu!',
            style: GoogleFonts.inter(fontSize: 13, color: Colors.amber[800]),
          ),
          if (leaderboardRank != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.amber[100],
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '📊 Peringkat #$leaderboardRank di tim',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.amber[900],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ⭐ PERFORMANCE GAUGE CARD (KPI)
// ═══════════════════════════════════════════════════════════

class BotPerformanceGauge extends StatelessWidget {
  final double score;
  final String period;

  const BotPerformanceGauge({
    super.key,
    required this.score,
    this.period = 'Bulan ini',
  });

  @override
  Widget build(BuildContext context) {
    final color = score >= 80 ? const Color(0xFF2E7D32) : score >= 60 ? Colors.orange : Colors.red;
    
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withValues(alpha: 0.1), color.withValues(alpha: 0.05)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Text(
            'Skor KPI — $period',
            style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: 100,
            height: 100,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 100,
                  height: 100,
                  child: CircularProgressIndicator(
                    value: score / 100,
                    strokeWidth: 10,
                    backgroundColor: Colors.grey[200],
                    valueColor: AlwaysStoppedAnimation<Color>(color),
                    strokeCap: StrokeCap.round,
                  ),
                ),
                Text(
                  '${score.toInt()}',
                  style: GoogleFonts.outfit(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            score >= 80 ? 'Luar Biasa! 🌟' : score >= 60 ? 'Cukup Baik 👍' : 'Perlu Peningkatan 💪',
            style: GoogleFonts.inter(
              fontWeight: FontWeight.w600,
              color: color,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 🔘 QUICK REPLY CHIPS
// ═══════════════════════════════════════════════════════════

class BotQuickReplyChips extends StatelessWidget {
  final List<Map<String, String>> actions;
  final Function(String actionCode)? onTap;
  final Function(String actionCode, String label)? onTapWithLabel;

  const BotQuickReplyChips({
    super.key,
    required this.actions,
    this.onTap,
    this.onTapWithLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 6,
      children: actions.map((action) {
        final code = action['actionCode'] ?? '';
        final label = action['label'] ?? '';
        return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              if (onTapWithLabel != null) {
                onTapWithLabel!(code, label);
              } else if (onTap != null) {
                onTap!(code);
              }
            },
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF800000).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: const Color(0xFF800000).withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF800000),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
