library;

/// ArtacomBotEngine — Conversation Tree Engine (Chip-Based).
///
/// Semua interaksi melalui tombol/chip — user tidak perlu mengetik.
/// Engine menggunakan pola "conversation node tree" dimana setiap
/// node punya pesan bot + daftar chip yang mengarah ke node lain.
/// Percakapan bercabang dan tidak pernah mati.

import 'dart:math';
import 'bot_response.dart';
import 'artacom_bot_tree.dart';

// ═══════════════════════════════════════════════════════════
// CONVERSATION NODE MODEL
// ═══════════════════════════════════════════════════════════

class ConversationNode {
  final String id;
  final String mood;
  final List<String> messages; // Bot picks one randomly
  final String? uiComponent;
  final String? dataAction; // 'fetch_leave', 'fetch_salary', etc.
  final Map<String, dynamic>? staticPayload;
  final String? navigationTarget; // Screen navigation
  final List<ChipOption> chips;

  const ConversationNode({
    required this.id,
    required this.mood,
    required this.messages,
    this.uiComponent,
    this.dataAction,
    this.staticPayload,
    this.navigationTarget,
    required this.chips,
  });
}

class ChipOption {
  final String emoji;
  final String label;
  final String targetNodeId;

  const ChipOption({
    required this.emoji,
    required this.label,
    required this.targetNodeId,
  });

  String get displayLabel => '$emoji $label';
}

// ═══════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════

class ArtacomBotEngine {
  final Random _rng = Random();

  /// Resolve a node ID to a BotResponse.
  BotResponse resolveNode(String nodeId, {Map<String, dynamic>? userData}) {
    final node = _findNode(nodeId);
    if (node == null) return _fallbackResponse();

    // Pick random message
    final message = node.messages[_rng.nextInt(node.messages.length)];

    // Build data payload
    Map<String, dynamic>? payload = node.staticPayload;
    if (node.dataAction != null && userData != null) {
      payload = _resolveDataPayload(node.dataAction!, userData);
    }

    // Determine mood (may override based on data)
    String mood = node.mood;
    if (node.dataAction == 'fetch_leave' && payload != null) {
      final remaining = payload['remaining'] ?? 12;
      mood = remaining > 3
          ? 'happy'
          : remaining > 0
          ? 'concerned'
          : 'concerned';
    }

    return BotResponse(
      mood: mood,
      message: _enrichMessage(message, payload, userData),
      uiComponent: node.uiComponent,
      dataPayload: payload,
      intentName: node.id,
      navigationTarget: node.navigationTarget,
      actionButtons: node.chips
          .map(
            (c) => BotAction(label: c.displayLabel, actionCode: c.targetNodeId),
          )
          .toList(),
    );
  }

  /// Generate proactive greeting.
  BotResponse getGreeting(
    String userName, {
    Map<String, dynamic>? attendanceData,
  }) {
    final hour = DateTime.now().hour;
    String greeting;
    String mood;

    if (hour >= 0 && hour < 5) {
      greeting =
          'Eh, $userName masih terjaga jam segini? 😴\nIstirahat yang cukup ya biar besok tetap semangat!';
      mood = 'sleepy';
    } else if (hour >= 5 && hour < 10) {
      greeting =
          'Selamat pagi, $userName! ☀️\nSemangat menjalani hari ini! Ada yang bisa aku bantu?';
      mood = 'happy';
      if (attendanceData != null && attendanceData['check_in'] == null) {
        greeting += '\n\n💡 Kamu belum absen masuk hari ini lho!';
      }
    } else if (hour >= 10 && hour < 12) {
      greeting =
          'Hai $userName! 👋\nSudah produktif hari ini? Aku siap bantu apapun!';
      mood = 'happy';
    } else if (hour >= 12 && hour < 14) {
      greeting =
          'Siang, $userName! 🍽️\nJangan lupa makan siang ya! Kalau sudah, aku bisa bantu apa nih?';
      mood = 'happy';
    } else if (hour >= 14 && hour < 17) {
      greeting = 'Halo $userName! ☕\nSore yang produktif! Butuh bantuan apa?';
      mood = 'neutral';
    } else if (hour >= 17 && hour < 19) {
      greeting = 'Selamat sore, $userName! 🌅\nWaktunya hampir pulang nih!';
      mood = 'happy';
      if (attendanceData != null &&
          attendanceData['check_in'] != null &&
          attendanceData['check_out'] == null) {
        greeting += '\n\n💡 Jangan lupa absen pulang sebelum cabut ya!';
      }
    } else {
      greeting =
          'Malam, $userName! 🌙\nMasih semangat kerja? Aku tetap standby kok!';
      mood = 'neutral';
    }

    final mainChips = conversationTree['root']!.chips;
    return BotResponse(
      mood: mood,
      message: greeting,
      intentName: 'greeting',
      actionButtons: mainChips
          .map(
            (c) => BotAction(label: c.displayLabel, actionCode: c.targetNodeId),
          )
          .toList(),
    );
  }

  /// Proactive greeting alias.
  BotResponse getProactiveGreeting(
    String userName, {
    Map<String, dynamic>? attendanceData,
  }) {
    return getGreeting(userName, attendanceData: attendanceData);
  }

  // ── Helpers ──

  ConversationNode? _findNode(String id) => conversationTree[id];

  String _enrichMessage(
    String msg,
    Map<String, dynamic>? payload,
    Map<String, dynamic>? userData,
  ) {
    if (payload == null) return msg;

    // Replace placeholders
    String result = msg;
    payload.forEach((key, value) {
      result = result.replaceAll('{$key}', value.toString());
    });
    return result;
  }

  Map<String, dynamic>? _resolveDataPayload(
    String action,
    Map<String, dynamic> userData,
  ) {
    switch (action) {
      case 'fetch_leave':
        return userData['leave'] as Map<String, dynamic>? ??
            {'total': 12, 'used': 0, 'remaining': 12, 'pending': 0};
      case 'fetch_salary':
        return userData['salary'] as Map<String, dynamic>? ??
            {'status': 'Normal', 'period': 'Bulan ini', 'amount': '-'};
      case 'fetch_attendance':
        return userData['attendance'] as Map<String, dynamic>? ??
            {
              'check_in': 'Belum ada',
              'check_out': 'Belum ada',
              'status': 'Belum Absen',
            };
      case 'fetch_task':
        return userData['task'] as Map<String, dynamic>? ??
            {'total': 0, 'pending': 0, 'completed': 0};
      case 'fetch_overtime':
        return userData['overtime'] as Map<String, dynamic>? ??
            {'total': 0, 'pending': 0, 'approved': 0};
      case 'fetch_all_summary':
        final att = userData['attendance'] as Map<String, dynamic>? ?? {};
        final lv = userData['leave'] as Map<String, dynamic>? ?? {};
        final sal = userData['salary'] as Map<String, dynamic>? ?? {};
        final tsk = userData['task'] as Map<String, dynamic>? ?? {};
        final ot = userData['overtime'] as Map<String, dynamic>? ?? {};
        return {
          'check_in': att['check_in'] ?? 'Belum ada',
          'check_out': att['check_out'] ?? 'Belum ada',
          'leave_remaining': lv['remaining'] ?? 12,
          'leave_used': lv['used'] ?? 0,
          'salary_status': sal['status'] ?? 'Normal',
          'salary_period': sal['period'] ?? 'Bulan ini',
          'tasks_pending': tsk['pending'] ?? 0,
          'tasks_total': tsk['total'] ?? 0,
          'overtime_count': ot['total'] ?? 0,
        };
      default:
        return null;
    }
  }

  BotResponse _fallbackResponse() {
    final mainChips = conversationTree['root']!.chips;
    return BotResponse(
      mood: 'neutral',
      message:
          'Hmm, aku agak bingung nih. 🤔 Coba pilih dari menu di bawah ya!',
      intentName: 'fallback',
      actionButtons: mainChips
          .map(
            (c) => BotAction(label: c.displayLabel, actionCode: c.targetNodeId),
          )
          .toList(),
    );
  }
}
