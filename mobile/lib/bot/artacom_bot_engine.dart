library;

/// ArtacomBotEngine — Conversation Tree Engine (Chip-Based).
///
/// Semua interaksi melalui tombol/chip — user tidak perlu mengetik.
/// Engine menggunakan pola "conversation node tree" dimana setiap
/// node punya pesan bot + daftar chip yang mengarah ke node lain.
/// Percakapan bercabang dan tidak pernah mati.

import 'dart:math';
import 'bot_response.dart';

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
      mood = remaining > 3 ? 'happy' : remaining > 0 ? 'concerned' : 'concerned';
    }

    return BotResponse(
      mood: mood,
      message: _enrichMessage(message, payload, userData),
      uiComponent: node.uiComponent,
      dataPayload: payload,
      intentName: node.id,
      navigationTarget: node.navigationTarget,
      actionButtons: node.chips
          .map((c) => BotAction(label: c.displayLabel, actionCode: c.targetNodeId))
          .toList(),
    );
  }

  /// Generate proactive greeting.
  BotResponse getGreeting(String userName, {Map<String, dynamic>? attendanceData}) {
    final hour = DateTime.now().hour;
    String greeting;
    String mood;

    if (hour >= 0 && hour < 5) {
      greeting = 'Eh, $userName masih terjaga jam segini? 😴\nIstirahat yang cukup ya biar besok tetap semangat!';
      mood = 'sleepy';
    } else if (hour >= 5 && hour < 10) {
      greeting = 'Selamat pagi, $userName! ☀️\nSemangat menjalani hari ini! Ada yang bisa aku bantu?';
      mood = 'happy';
      if (attendanceData != null && attendanceData['check_in'] == null) {
        greeting += '\n\n💡 Kamu belum absen masuk hari ini lho!';
      }
    } else if (hour >= 10 && hour < 12) {
      greeting = 'Hai $userName! 👋\nSudah produktif hari ini? Aku siap bantu apapun!';
      mood = 'happy';
    } else if (hour >= 12 && hour < 14) {
      greeting = 'Siang, $userName! 🍽️\nJangan lupa makan siang ya! Kalau sudah, aku bisa bantu apa nih?';
      mood = 'happy';
    } else if (hour >= 14 && hour < 17) {
      greeting = 'Halo $userName! ☕\nSore yang produktif! Butuh bantuan apa?';
      mood = 'neutral';
    } else if (hour >= 17 && hour < 19) {
      greeting = 'Selamat sore, $userName! 🌅\nWaktunya hampir pulang nih!';
      mood = 'happy';
      if (attendanceData != null && attendanceData['check_in'] != null && attendanceData['check_out'] == null) {
        greeting += '\n\n💡 Jangan lupa absen pulang sebelum cabut ya!';
      }
    } else {
      greeting = 'Malam, $userName! 🌙\nMasih semangat kerja? Aku tetap standby kok!';
      mood = 'neutral';
    }

    final mainChips = conversationTree['root']!.chips;
    return BotResponse(
      mood: mood,
      message: greeting,
      intentName: 'greeting',
      actionButtons: mainChips
          .map((c) => BotAction(label: c.displayLabel, actionCode: c.targetNodeId))
          .toList(),
    );
  }

  /// Proactive greeting alias.
  BotResponse getProactiveGreeting(String userName, {Map<String, dynamic>? attendanceData}) {
    return getGreeting(userName, attendanceData: attendanceData);
  }



  // ── Helpers ──

  ConversationNode? _findNode(String id) => conversationTree[id];

  String _enrichMessage(String msg, Map<String, dynamic>? payload, Map<String, dynamic>? userData) {
    if (payload == null) return msg;

    // Replace placeholders
    String result = msg;
    payload.forEach((key, value) {
      result = result.replaceAll('{$key}', value.toString());
    });
    return result;
  }

  Map<String, dynamic>? _resolveDataPayload(String action, Map<String, dynamic> userData) {
    switch (action) {
      case 'fetch_leave':
        return userData['leave'] as Map<String, dynamic>? ?? {
          'total': 12,
          'used': 0,
          'remaining': 12,
          'pending': 0,
        };
      case 'fetch_salary':
        return userData['salary'] as Map<String, dynamic>? ?? {
          'status': 'Normal',
          'period': 'Bulan ini',
          'amount': '-',
        };
      case 'fetch_attendance':
        return userData['attendance'] as Map<String, dynamic>? ?? {
          'check_in': 'Belum ada',
          'check_out': 'Belum ada',
          'status': 'Belum Absen',
        };
      case 'fetch_task':
        return userData['task'] as Map<String, dynamic>? ?? {
          'total': 0,
          'pending': 0,
          'completed': 0,
        };
      case 'fetch_overtime':
        return userData['overtime'] as Map<String, dynamic>? ?? {
          'total': 0,
          'pending': 0,
          'approved': 0,
        };
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
      message: 'Hmm, aku agak bingung nih. 🤔 Coba pilih dari menu di bawah ya!',
      intentName: 'fallback',
      actionButtons: mainChips
          .map((c) => BotAction(label: c.displayLabel, actionCode: c.targetNodeId))
          .toList(),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// CONVERSATION TREE — All nodes defined here
// ═══════════════════════════════════════════════════════════

final Map<String, ConversationNode> conversationTree = {

  // ┌─────────────────────────────────────────────┐
  // │  ROOT — Main Menu                           │
  // └─────────────────────────────────────────────┘
  'root': ConversationNode(
    id: 'root',
    mood: 'happy',
    messages: [
      'Ada yang bisa aku bantu? Pilih salah satu opsi di bawah ya! 😊',
      'Halo! Mau ngapain hari ini? Aku siap membantu! 🤗',
      'Hai! Pilih menu di bawah sesuai kebutuhanmu ya! ✨',
      'Yo! Artacom Bot ready to help! Mau ke mana nih? 🚀',
      'Selamat datang kembali! Mari selesaikan target hari ini bersamaku! 🎯',
      'Beep boop! 🤖 Bot HR kesayanganmu siap melayani. Ada yang bisa dibantu?',
      'Hari yang cerah untuk produktif! Butuh info absen atau mau main game bentar? ☀️',
      'Wah, senang ketemu kamu lagi! Ada pertanyaan seputar HR atau mau cari hiburan? 🙋‍♀️',
      'Halo pekerja keras! Jangan lupa tarik napas. Mau cek status cuti atau sekadar curhat? 🌴',
    ],
    chips: [
      ChipOption(emoji: '📋', label: 'Operasional HRMS', targetNodeId: 'menu_operational'),
      ChipOption(emoji: '🎮', label: 'Hiburan & Relax', targetNodeId: 'menu_fun'),
      ChipOption(emoji: '☕', label: 'Kopi & Kuliner', targetNodeId: 'menu_food_coffee'),
      ChipOption(emoji: '💡', label: 'Tips Lapangan', targetNodeId: 'menu_field_tips'),
      ChipOption(emoji: '🥠', label: 'Ramalan Harian', targetNodeId: 'daily_fortune'),
      ChipOption(emoji: '📊', label: 'Info & Statistik', targetNodeId: 'menu_info'),
      ChipOption(emoji: '🚨', label: 'Darurat K3', targetNodeId: 'emergency'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  OPERATIONAL MENU                           │
  // └─────────────────────────────────────────────┘
  'menu_operational': ConversationNode(
    id: 'menu_operational',
    mood: 'neutral',
    messages: [
      'Mau ngurusin apa nih? Pilih fitur HRMS yang kamu butuhkan! 📋',
      'Siap bantu urusan kantor! Mau akses yang mana? 💼',
    ],
    chips: [
      ChipOption(emoji: '🌴', label: 'Cuti & Izin', targetNodeId: 'menu_leave'),
      ChipOption(emoji: '💰', label: 'Gaji & Slip', targetNodeId: 'menu_salary'),
      ChipOption(emoji: '⏰', label: 'Lembur', targetNodeId: 'menu_overtime'),
      ChipOption(emoji: '📸', label: 'Absensi', targetNodeId: 'menu_attendance'),
      ChipOption(emoji: '🧾', label: 'Klaim & Reimburse', targetNodeId: 'menu_reimburse'),
      ChipOption(emoji: '📋', label: 'Tugas', targetNodeId: 'menu_task'),
      ChipOption(emoji: '📄', label: 'Lainnya...', targetNodeId: 'menu_operational_more'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'menu_operational_more': ConversationNode(
    id: 'menu_operational_more',
    mood: 'neutral',
    messages: ['Ini dia fitur lainnya! 👇'],
    chips: [
      ChipOption(emoji: '⭐', label: 'Review KPI', targetNodeId: 'menu_kpi'),
      ChipOption(emoji: '📄', label: 'Dokumen & SOP', targetNodeId: 'menu_document'),
      ChipOption(emoji: '🚗', label: 'Fleet Log', targetNodeId: 'menu_fleet'),
      ChipOption(emoji: '📝', label: 'Izin Khusus', targetNodeId: 'menu_permit'),
      ChipOption(emoji: '🔄', label: 'Tukar Shift', targetNodeId: 'menu_shift'),
      ChipOption(emoji: '💳', label: 'Pengajuan Dana', targetNodeId: 'menu_fund'),
      ChipOption(emoji: '🏆', label: 'Leaderboard', targetNodeId: 'leaderboard_view'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational'),
    ],
  ),

  // ── CUTI ──────────────────────────────────────

  'menu_leave': ConversationNode(
    id: 'menu_leave',
    mood: 'happy',
    messages: [
      'Urusan cuti nih! 🌴 Mau ngapain dulu?',
      'Cuti ya? Siapa sih yang ga suka cuti! 😆 Mau apa nih?',
    ],
    chips: [
      ChipOption(emoji: '📊', label: 'Cek Sisa Cuti', targetNodeId: 'leave_balance'),
      ChipOption(emoji: '📝', label: 'Ajukan Cuti', targetNodeId: 'leave_apply'),
      ChipOption(emoji: '📜', label: 'Riwayat Cuti', targetNodeId: 'leave_history'),
      ChipOption(emoji: '💡', label: 'Tips Cuti Efektif', targetNodeId: 'leave_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational'),
    ],
  ),

  'leave_balance': ConversationNode(
    id: 'leave_balance',
    mood: 'happy',
    messages: ['Ini dia info sisa cuti kamu! 🌴'],
    uiComponent: 'BotLeaveBalanceCard',
    dataAction: 'fetch_leave',
    chips: [
      ChipOption(emoji: '📝', label: 'Ajukan Cuti', targetNodeId: 'leave_apply'),
      ChipOption(emoji: '💡', label: 'Tips Cuti Efektif', targetNodeId: 'leave_tips'),
      ChipOption(emoji: '📜', label: 'Riwayat Cuti', targetNodeId: 'leave_history'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_leave'),
    ],
  ),

  'leave_apply': ConversationNode(
    id: 'leave_apply',
    mood: 'happy',
    messages: [
      'Oke, aku buka form pengajuan cuti ya! 📝\nIsi data cuti kamu di halaman berikut.',
      'Siap! Langsung ke form cuti ya! ✈️',
    ],
    navigationTarget: 'NAV_LEAVE',
    chips: [
      ChipOption(emoji: '📊', label: 'Cek Sisa Cuti', targetNodeId: 'leave_balance'),
      ChipOption(emoji: '📜', label: 'Riwayat Cuti', targetNodeId: 'leave_history'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'leave_history': ConversationNode(
    id: 'leave_history',
    mood: 'neutral',
    messages: [
      'Aku buka riwayat cuti kamu ya! 📜',
      'Mau lihat jejak cuti yang sudah diambil? Nih! 👇',
    ],
    navigationTarget: 'NAV_LEAVE',
    chips: [
      ChipOption(emoji: '📊', label: 'Cek Sisa Cuti', targetNodeId: 'leave_balance'),
      ChipOption(emoji: '📝', label: 'Ajukan Cuti Baru', targetNodeId: 'leave_apply'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_leave'),
    ],
  ),

  'leave_tips': ConversationNode(
    id: 'leave_tips',
    mood: 'excited',
    messages: [
      '💡 Tips Cuti Efektif:\n\n'
        '1️⃣ Kombinasikan cuti dengan hari libur nasional biar lebih panjang!\n'
        '2️⃣ Ajukan minimal 1 minggu sebelumnya agar atasan bisa atur jadwal.\n'
        '3️⃣ Sisakan 2-3 hari untuk keadaan darurat di akhir tahun.\n'
        '4️⃣ Komunikasikan ke tim sebelum cuti biar handover lancar.\n\n'
        'Semoga liburannya menyenangkan! 🏖️',
      '💡 Tau gak sih?\n\n'
        '• Studi menunjukkan karyawan yang rutin cuti 30% lebih produktif!\n'
        '• Long weekend = cuti 1 hari tapi dapat libur 3 hari 🧠\n'
        '• Cuti gak harus liburan — istirahat di rumah juga termasuk self-care.\n\n'
        'Jangan ragu ambil cuti kalau memang butuh ya! ✨',
    ],
    chips: [
      ChipOption(emoji: '📊', label: 'Cek Sisa Cuti', targetNodeId: 'leave_balance'),
      ChipOption(emoji: '📝', label: 'Ajukan Cuti', targetNodeId: 'leave_apply'),
      ChipOption(emoji: '🎲', label: 'Hiburan', targetNodeId: 'menu_fun'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_leave'),
    ],
  ),

  // ── GAJI ──────────────────────────────────────

  'menu_salary': ConversationNode(
    id: 'menu_salary',
    mood: 'happy',
    messages: [
      'Urusan gaji ya! 💰 Yang paling ditunggu-tunggu nih!',
      'Duit, duit, duit! 💸 Mau cek apa nih soal gaji?',
    ],
    chips: [
      ChipOption(emoji: '📄', label: 'Lihat Slip Gaji', targetNodeId: 'salary_view'),
      ChipOption(emoji: '🔍', label: 'Status Pencairan', targetNodeId: 'salary_status'),
      ChipOption(emoji: '💡', label: 'Tips Kelola Gaji', targetNodeId: 'salary_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational'),
    ],
  ),

  'salary_view': ConversationNode(
    id: 'salary_view',
    mood: 'happy',
    messages: [
      'Slip gaji kamu bulan ini sudah siap! 📄💰 Rincian lengkapnya bisa dicek ya.',
      'Ini dia ringkasan slip gajimu! Semoga angkanya bikin senyum lebar! 😆💸',
      'Gajian sudah tiba! 💵 Pastikan kelola dengan bijak ya!',
    ],
    uiComponent: 'BotSalaryStatusCard',
    dataAction: 'fetch_salary',
    chips: [
      ChipOption(emoji: '🔍', label: 'Cek Status Transfer', targetNodeId: 'salary_status'),
      ChipOption(emoji: '💡', label: 'Tips Kelola Gaji', targetNodeId: 'salary_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_salary'),
    ],
  ),

  'salary_status': ConversationNode(
    id: 'salary_status',
    mood: 'neutral',
    messages: ['Ini dia status pencairan gaji terakhir kamu! 💰'],
    uiComponent: 'BotSalaryStatusCard',
    dataAction: 'fetch_salary',
    chips: [
      ChipOption(emoji: '📄', label: 'Lihat Slip Gaji', targetNodeId: 'salary_view'),
      ChipOption(emoji: '💡', label: 'Tips Keuangan', targetNodeId: 'salary_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_salary'),
    ],
  ),

  'salary_tips': ConversationNode(
    id: 'salary_tips',
    mood: 'excited',
    messages: [
      '💡 Tips Kelola Gaji Ala Artacom Bot:\n\n'
        '1️⃣ Terapkan aturan 50/30/20:\n'
        '   • 50% kebutuhan pokok\n'
        '   • 30% keinginan\n'
        '   • 20% tabungan/investasi\n\n'
        '2️⃣ Siapkan dana darurat minimal 3x pengeluaran bulanan.\n'
        '3️⃣ Catat pengeluaran harian — kecil-kecil kalau dikumpulin gede juga!\n\n'
        'Semangat nabung! 🐷💰',
      '💡 Fun Fact Soal Gaji:\n\n'
        '• 78% orang Indonesia tidak punya budget bulanan tertulis.\n'
        '• Menabung Rp50.000/hari = Rp18 juta/tahun! 🤯\n'
        '• Latte factor: kopi Rp30.000/hari = Rp10.8 juta/tahun ☕\n\n'
        'Gimana, mau mulai tracking pengeluaran? 💪',
    ],
    chips: [
      ChipOption(emoji: '📄', label: 'Lihat Slip Gaji', targetNodeId: 'salary_view'),
      ChipOption(emoji: '🔍', label: 'Status Transfer', targetNodeId: 'salary_status'),
      ChipOption(emoji: '💡', label: 'Fakta Menarik', targetNodeId: 'fun_fact'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_salary'),
    ],
  ),

  // ── LEMBUR ────────────────────────────────────

  'menu_overtime': ConversationNode(
    id: 'menu_overtime',
    mood: 'neutral',
    messages: [
      'Urusan lembur nih! ⏰ Mau ngapain?',
      'Lembur ya? Kerja keras itu bagus, tapi jangan lupa istirahat juga! 💪',
    ],
    chips: [
      ChipOption(emoji: '📝', label: 'Ajukan Lembur', targetNodeId: 'overtime_apply'),
      ChipOption(emoji: '🔍', label: 'Cek Status Pengajuan', targetNodeId: 'overtime_status'),
      ChipOption(emoji: '📊', label: 'Riwayat Lembur', targetNodeId: 'overtime_history'),
      ChipOption(emoji: '💡', label: 'Tips Lembur Sehat', targetNodeId: 'overtime_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational'),
    ],
  ),

  'overtime_apply': ConversationNode(
    id: 'overtime_apply',
    mood: 'neutral',
    messages: [
      'Oke, aku buka form pengajuan lembur ya! ⏰',
      'Semangat lemburnya! Tapi jangan lupa istirahat juga 💪',
    ],
    navigationTarget: 'NAV_OVERTIME',
    chips: [
      ChipOption(emoji: '🔍', label: 'Cek Status', targetNodeId: 'overtime_status'),
      ChipOption(emoji: '💡', label: 'Tips Lembur Sehat', targetNodeId: 'overtime_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_overtime'),
    ],
  ),

  'overtime_status': ConversationNode(
    id: 'overtime_status',
    mood: 'neutral',
    messages: [
      'Langsung ke halaman lembur ya buat cek status pengajuan! 🔍',
      'Aku buka daftar pengajuan lembur kamu ya! ⏳',
    ],
    navigationTarget: 'NAV_OVERTIME',
    chips: [
      ChipOption(emoji: '📝', label: 'Ajukan Lembur Baru', targetNodeId: 'overtime_apply'),
      ChipOption(emoji: '💡', label: 'Tips Lembur', targetNodeId: 'overtime_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_overtime'),
    ],
  ),

  'overtime_history': ConversationNode(
    id: 'overtime_history',
    mood: 'neutral',
    messages: ['Aku buka riwayat lembur kamu ya! 📊'],
    navigationTarget: 'NAV_OVERTIME',
    chips: [
      ChipOption(emoji: '📝', label: 'Ajukan Lembur', targetNodeId: 'overtime_apply'),
      ChipOption(emoji: '🔍', label: 'Cek Status', targetNodeId: 'overtime_status'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_overtime'),
    ],
  ),

  'overtime_tips': ConversationNode(
    id: 'overtime_tips',
    mood: 'concerned',
    messages: [
      '💡 Tips Lembur Sehat:\n\n'
        '1️⃣ Makan dulu sebelum lembur — jangan kerja perut kosong!\n'
        '2️⃣ Setiap 90 menit, istirahat 10 menit. Otak butuh reset.\n'
        '3️⃣ Hindari lembur lebih dari 3 jam — produktivitas turun drastis.\n'
        '4️⃣ Minum air putih, bukan cuma kopi! ☕ → 💧\n'
        '5️⃣ Setelah lembur, usahakan tidur cukup malam itu.\n\n'
        'Tubuh yang sehat = kerja yang lebih efisien! 🏃‍♂️',
      '🧠 Tahukah kamu?\n\n'
        '• Riset menunjukkan produktivitas turun 25% setelah 8 jam kerja berturut-turut.\n'
        '• Power nap 20 menit bisa mengembalikan fokus yang hilang! 😴\n'
        '• Stretching 5 menit tiap jam mencegah sakit punggung kronis.\n\n'
        'Jaga kesehatanmu ya, kamu aset berharga perusahaan! 💎',
    ],
    chips: [
      ChipOption(emoji: '😫', label: 'Aku Capek...', targetNodeId: 'tired'),
      ChipOption(emoji: '📝', label: 'Ajukan Lembur', targetNodeId: 'overtime_apply'),
      ChipOption(emoji: '🎲', label: 'Hiburan', targetNodeId: 'menu_fun'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_overtime'),
    ],
  ),

  // ── ABSENSI ───────────────────────────────────

  'menu_attendance': ConversationNode(
    id: 'menu_attendance',
    mood: 'neutral',
    messages: [
      'Urusan absensi! 📸 Mau apa nih?',
      'Absensi ya? Ayo tetap rajin dan on-time! 🎯',
    ],
    chips: [
      ChipOption(emoji: '📸', label: 'Absen Sekarang', targetNodeId: 'attendance_checkin'),
      ChipOption(emoji: '📊', label: 'Status Hari Ini', targetNodeId: 'attendance_today'),
      ChipOption(emoji: '✏️', label: 'Koreksi Absen', targetNodeId: 'attendance_correction'),
      ChipOption(emoji: '📜', label: 'Riwayat Absensi', targetNodeId: 'attendance_history'),
      ChipOption(emoji: '🏆', label: 'Leaderboard', targetNodeId: 'leaderboard_view'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational'),
    ],
  ),

  'attendance_checkin': ConversationNode(
    id: 'attendance_checkin',
    mood: 'happy',
    messages: [
      'Oke, aku balikin ke Beranda ya untuk absen! 📸\nTekan tombol "ABSEN SEKARANG" di sana.',
      'Siap! Kembali ke Beranda untuk proses absensi! 🎯',
    ],
    navigationTarget: 'NAV_HOME',
    chips: [
      ChipOption(emoji: '📊', label: 'Cek Status Absen', targetNodeId: 'attendance_today'),
      ChipOption(emoji: '🏆', label: 'Leaderboard', targetNodeId: 'leaderboard_view'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_attendance'),
    ],
  ),

  'attendance_today': ConversationNode(
    id: 'attendance_today',
    mood: 'neutral',
    messages: ['Aku cek status absensi kamu hari ini ya! 🔍'],
    dataAction: 'fetch_attendance',
    chips: [
      ChipOption(emoji: '📸', label: 'Absen Sekarang', targetNodeId: 'attendance_checkin'),
      ChipOption(emoji: '✏️', label: 'Koreksi Absen', targetNodeId: 'attendance_correction'),
      ChipOption(emoji: '🏆', label: 'Leaderboard', targetNodeId: 'leaderboard_view'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_attendance'),
    ],
  ),

  'attendance_correction': ConversationNode(
    id: 'attendance_correction',
    mood: 'neutral',
    messages: [
      'Mau koreksi absen? Aku buka halamannya ya! ✏️',
      'Oke, langsung ke halaman koreksi absensi! 📝',
    ],
    navigationTarget: 'NAV_CORRECTION',
    chips: [
      ChipOption(emoji: '📊', label: 'Status Hari Ini', targetNodeId: 'attendance_today'),
      ChipOption(emoji: '📸', label: 'Absen Sekarang', targetNodeId: 'attendance_checkin'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_attendance'),
    ],
  ),

  'attendance_history': ConversationNode(
    id: 'attendance_history',
    mood: 'neutral',
    messages: ['Aku buka riwayat absensi kamu ya! 📜'],
    navigationTarget: 'NAV_HISTORY',
    chips: [
      ChipOption(emoji: '📸', label: 'Absen Sekarang', targetNodeId: 'attendance_checkin'),
      ChipOption(emoji: '✏️', label: 'Koreksi Absen', targetNodeId: 'attendance_correction'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_attendance'),
    ],
  ),

  // ── KLAIM / REIMBURSE ─────────────────────────

  'menu_reimburse': ConversationNode(
    id: 'menu_reimburse',
    mood: 'neutral',
    messages: [
      'Klaim & reimbursement! 🧾 Mau apa nih?',
      'Urusan nota dan kwitansi ya? 🧾 Aku bantu!',
    ],
    chips: [
      ChipOption(emoji: '📝', label: 'Ajukan Klaim Baru', targetNodeId: 'reimburse_apply'),
      ChipOption(emoji: '🔍', label: 'Cek Status Klaim', targetNodeId: 'reimburse_status'),
      ChipOption(emoji: '💡', label: 'Tips Klaim Cepat ACC', targetNodeId: 'reimburse_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational'),
    ],
  ),

  'reimburse_apply': ConversationNode(
    id: 'reimburse_apply',
    mood: 'neutral',
    messages: ['Oke, aku buka form pengajuan klaim ya! 🧾'],
    navigationTarget: 'NAV_REIMBURSEMENT',
    chips: [
      ChipOption(emoji: '🔍', label: 'Cek Status', targetNodeId: 'reimburse_status'),
      ChipOption(emoji: '💡', label: 'Tips Cepat ACC', targetNodeId: 'reimburse_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_reimburse'),
    ],
  ),

  'reimburse_status': ConversationNode(
    id: 'reimburse_status',
    mood: 'neutral',
    messages: ['Langsung ke halaman klaim untuk cek status! 🔍'],
    navigationTarget: 'NAV_REIMBURSEMENT',
    chips: [
      ChipOption(emoji: '📝', label: 'Ajukan Klaim Baru', targetNodeId: 'reimburse_apply'),
      ChipOption(emoji: '💡', label: 'Tips Klaim', targetNodeId: 'reimburse_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_reimburse'),
    ],
  ),

  'reimburse_tips': ConversationNode(
    id: 'reimburse_tips',
    mood: 'excited',
    messages: [
      '💡 Tips Klaim Cepat Disetujui:\n\n'
        '1️⃣ Foto struk/nota dengan jelas — pastikan nominal dan tanggal terbaca.\n'
        '2️⃣ Ajukan maksimal 3 hari setelah transaksi.\n'
        '3️⃣ Sertakan keterangan yang detail (tujuan, relasi dengan kerja).\n'
        '4️⃣ Pastikan sesuai kebijakan perusahaan (cek SOP dulu!).\n\n'
        'Klaim rapi = approval cepat! ✅',
    ],
    chips: [
      ChipOption(emoji: '📝', label: 'Ajukan Klaim', targetNodeId: 'reimburse_apply'),
      ChipOption(emoji: '📄', label: 'Lihat SOP', targetNodeId: 'document_view'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_reimburse'),
    ],
  ),

  // ── TUGAS ─────────────────────────────────────

  'menu_task': ConversationNode(
    id: 'menu_task',
    mood: 'neutral',
    messages: [
      'Urusan tugas! 📋 Mau cek apa?',
      'To-do list nih! Yuk tetap produktif 💪',
    ],
    chips: [
      ChipOption(emoji: '📋', label: 'Lihat Tugas Saya', targetNodeId: 'task_view'),
      ChipOption(emoji: '💡', label: 'Tips Produktivitas', targetNodeId: 'task_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational'),
    ],
  ),

  'task_view': ConversationNode(
    id: 'task_view',
    mood: 'neutral',
    messages: ['Aku buka daftar tugas kamu ya! 📋'],
    navigationTarget: 'NAV_TASK',
    chips: [
      ChipOption(emoji: '💡', label: 'Tips Produktivitas', targetNodeId: 'task_tips'),
      ChipOption(emoji: '😫', label: 'Capek nih...', targetNodeId: 'tired'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_task'),
    ],
  ),

  'task_tips': ConversationNode(
    id: 'task_tips',
    mood: 'excited',
    messages: [
      '💡 Tips Produktivitas ala Artacom Bot:\n\n'
        '1️⃣ Teknik Pomodoro: Kerja fokus 25 menit → istirahat 5 menit 🍅\n'
        '2️⃣ Kerjakan tugas terberat di pagi hari (eat the frog! 🐸)\n'
        '3️⃣ Matikan notifikasi HP saat fokus kerja.\n'
        '4️⃣ Pecah tugas besar jadi tugas kecil-kecil — progress terasa lebih cepat!\n'
        '5️⃣ Jangan multitasking — otak manusia bukan CPU! 🧠\n\n'
        'Semangat! Satu tugas selesai = satu langkah lebih dekat ke sukses! 🚀',
      '🧠 Tahukah kamu?\n\n'
        '• Rata-rata orang butuh 23 menit untuk fokus kembali setelah terdistraksi.\n'
        '• 2 menit rule: Kalau tugas bisa diselesaikan dalam 2 menit, langsung kerjakan!\n'
        '• Menulis to-do list malam sebelumnya meningkatkan produktivitas 25% keesokan hari.\n\n'
        'Gimana, mau coba tekniknya? 💪',
    ],
    chips: [
      ChipOption(emoji: '📋', label: 'Lihat Tugas', targetNodeId: 'task_view'),
      ChipOption(emoji: '🎲', label: 'Istirahat Dulu', targetNodeId: 'menu_fun'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_task'),
    ],
  ),

  // ── KPI ───────────────────────────────────────

  'menu_kpi': ConversationNode(
    id: 'menu_kpi',
    mood: 'neutral',
    messages: [
      'Review KPI! ⭐ Mau cek performa kamu?',
      'KPI nih! Yuk lihat seberapa keren performa kamu! 📊',
    ],
    chips: [
      ChipOption(emoji: '📊', label: 'Lihat Nilai KPI', targetNodeId: 'kpi_view'),
      ChipOption(emoji: '💡', label: 'Tips Tingkatkan KPI', targetNodeId: 'kpi_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational_more'),
    ],
  ),

  'kpi_view': ConversationNode(
    id: 'kpi_view',
    mood: 'excited',
    messages: [
      'Ini dia skor KPI kamu saat ini! ⭐ Pertahankan ya!',
      'Review KPI kamu sudah keluar! 📈 Yuk lihat detailnya.',
    ],
    uiComponent: 'BotPerformanceGauge',
    staticPayload: {'score': 85.5, 'period': 'Q3 2026'},
    chips: [
      ChipOption(emoji: '💡', label: 'Tips KPI Tinggi', targetNodeId: 'kpi_tips'),
      ChipOption(emoji: '🏆', label: 'Leaderboard', targetNodeId: 'leaderboard_view'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_kpi'),
    ],
  ),

  'kpi_tips': ConversationNode(
    id: 'kpi_tips',
    mood: 'excited',
    messages: [
      '💡 Tips Tingkatkan KPI:\n\n'
        '1️⃣ Pahami target KPI kamu — jangan kerja tanpa arah!\n'
        '2️⃣ Dokumentasikan setiap pencapaian sekecil apapun.\n'
        '3️⃣ Minta feedback rutin ke atasan, jangan tunggu review akhir.\n'
        '4️⃣ Fokus ke 3 KPI utama yang punya bobot terbesar.\n'
        '5️⃣ Kolaborasi = kunci! Jangan takut minta bantuan tim.\n\n'
        'Performa tinggi = promosi makin dekat! 🚀',
    ],
    chips: [
      ChipOption(emoji: '📊', label: 'Lihat KPI Saya', targetNodeId: 'kpi_view'),
      ChipOption(emoji: '🏆', label: 'Leaderboard', targetNodeId: 'leaderboard_view'),
      ChipOption(emoji: '🎲', label: 'Hiburan', targetNodeId: 'menu_fun'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_kpi'),
    ],
  ),

  // ── DOKUMEN & SOP ─────────────────────────────

  'menu_document': ConversationNode(
    id: 'menu_document',
    mood: 'neutral',
    messages: ['Dokumen & SOP! 📄 Cari yang mana nih?'],
    chips: [
      ChipOption(emoji: '📄', label: 'Lihat Dokumen', targetNodeId: 'document_view'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational_more'),
    ],
  ),

  'document_view': ConversationNode(
    id: 'document_view',
    mood: 'neutral',
    messages: ['Aku buka halaman dokumen ya! 📄'],
    navigationTarget: 'NAV_DOCUMENT',
    chips: [
      ChipOption(emoji: '🧾', label: 'Ajukan Klaim', targetNodeId: 'reimburse_apply'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ── FLEET ─────────────────────────────────────

  'menu_fleet': ConversationNode(
    id: 'menu_fleet',
    mood: 'neutral',
    messages: ['Fleet Log! 🚗 Mau catat perjalanan?'],
    chips: [
      ChipOption(emoji: '🚗', label: 'Buka Fleet Log', targetNodeId: 'fleet_view'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational_more'),
    ],
  ),

  'fleet_view': ConversationNode(
    id: 'fleet_view',
    mood: 'neutral',
    messages: ['Aku buka Fleet Log ya! 🚗'],
    navigationTarget: 'NAV_FLEET',
    chips: [
      ChipOption(emoji: '🧾', label: 'Klaim BBM', targetNodeId: 'reimburse_apply'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_fleet'),
    ],
  ),

  // ── IZIN ──────────────────────────────────────

  'menu_permit': ConversationNode(
    id: 'menu_permit',
    mood: 'neutral',
    messages: ['Izin khusus! 📝 Mau ajukan apa?'],
    chips: [
      ChipOption(emoji: '📝', label: 'Ajukan Izin', targetNodeId: 'permit_apply'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational_more'),
    ],
  ),

  'permit_apply': ConversationNode(
    id: 'permit_apply',
    mood: 'neutral',
    messages: ['Oke, aku buka form izin ya! 📝'],
    navigationTarget: 'NAV_PERMIT',
    chips: [
      ChipOption(emoji: '🌴', label: 'Ajukan Cuti', targetNodeId: 'leave_apply'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_permit'),
    ],
  ),

  // ── TUKAR SHIFT ───────────────────────────────

  'menu_shift': ConversationNode(
    id: 'menu_shift',
    mood: 'neutral',
    messages: ['Tukar shift! 🔄 Mau atur jadwal?'],
    chips: [
      ChipOption(emoji: '🔄', label: 'Ajukan Tukar Shift', targetNodeId: 'shift_apply'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational_more'),
    ],
  ),

  'shift_apply': ConversationNode(
    id: 'shift_apply',
    mood: 'neutral',
    messages: ['Aku buka halaman tukar shift ya! 🔄'],
    navigationTarget: 'NAV_SHIFT_SWAP',
    chips: [
      ChipOption(emoji: '📊', label: 'Cek Jadwal', targetNodeId: 'shift_apply'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_shift'),
    ],
  ),

  // ── PENGAJUAN DANA ────────────────────────────

  'menu_fund': ConversationNode(
    id: 'menu_fund',
    mood: 'neutral',
    messages: ['Pengajuan dana! 💳 Mau apa nih?'],
    chips: [
      ChipOption(emoji: '📝', label: 'Ajukan Dana', targetNodeId: 'fund_apply'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_operational_more'),
    ],
  ),

  'fund_apply': ConversationNode(
    id: 'fund_apply',
    mood: 'neutral',
    messages: ['Aku buka form pengajuan dana ya! 💳'],
    navigationTarget: 'NAV_FUND_REQUEST',
    chips: [
      ChipOption(emoji: '🧾', label: 'Klaim Reimburse', targetNodeId: 'reimburse_apply'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_fund'),
    ],
  ),

  // ── LEADERBOARD ───────────────────────────────

  'leaderboard_view': ConversationNode(
    id: 'leaderboard_view',
    mood: 'excited',
    messages: [
      'Peringkat kamu di Leaderboard! 🏆 Terus semangat absen tepat waktu!',
      'Wah, prestasimu keren bulan ini! ⭐ Pertahankan streak-nya ya!',
    ],
    uiComponent: 'BotStreakBadgeCard',
    staticPayload: {'streak_days': 12, 'badge_name': 'Karyawan Teladan', 'leaderboard_rank': 5},
    chips: [
      ChipOption(emoji: '📸', label: 'Absen Sekarang', targetNodeId: 'attendance_checkin'),
      ChipOption(emoji: '⭐', label: 'KPI Saya', targetNodeId: 'kpi_view'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  INFO & STATISTIK                           │
  // └─────────────────────────────────────────────┘

  'menu_info': ConversationNode(
    id: 'menu_info',
    mood: 'neutral',
    messages: ['Mau lihat info & statistik apa? 📊'],
    chips: [
      ChipOption(emoji: '📊', label: 'Sisa Cuti', targetNodeId: 'leave_balance'),
      ChipOption(emoji: '💰', label: 'Status Gaji', targetNodeId: 'salary_status'),
      ChipOption(emoji: '📸', label: 'Absen Hari Ini', targetNodeId: 'attendance_today'),
      ChipOption(emoji: '🏆', label: 'Leaderboard', targetNodeId: 'leaderboard_view'),
      ChipOption(emoji: '⭐', label: 'KPI Saya', targetNodeId: 'kpi_view'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  FUN & HIBURAN MENU                         │
  // └─────────────────────────────────────────────┘

  'menu_fun': ConversationNode(
    id: 'menu_fun',
    mood: 'excited',
    messages: [
      'Waktunya relax! 🎮 Mau hiburan apa nih?',
      'Istirahat sejenak itu penting! Pilih yang bikin kamu senyum 😄',
      'Mode santai ON! 🎧 Pilih hiburanmu!',
      'Break time! 🎉 Otak butuh refresh — pilih yang seru!',
      'Hiburan sudah siap! Mau main, ketawa, atau sekadar chill? 🍿',
    ],
    chips: [
      ChipOption(emoji: '😂', label: 'Jokes & Tebakan', targetNodeId: 'jokes_menu'),
      ChipOption(emoji: '🏆', label: 'Teka-Teki Level 1', targetNodeId: 'riddle_lvl1'),
      ChipOption(emoji: '🧩', label: 'Teka-Teki Level 2', targetNodeId: 'riddle2_lvl1'),
      ChipOption(emoji: '🎮', label: 'Tebak Angka', targetNodeId: 'guess_number_start'),
      ChipOption(emoji: '✊', label: 'Suit (Batu Gunting Kertas)', targetNodeId: 'mini_game_rps'),
      ChipOption(emoji: '🪙', label: 'Lempar Koin', targetNodeId: 'mini_game_coin'),
      ChipOption(emoji: '🎯', label: 'Tantangan Harian', targetNodeId: 'challenge_daily'),
      ChipOption(emoji: '▶️', label: 'Lainnya...', targetNodeId: 'menu_fun_more'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'menu_fun_more': ConversationNode(
    id: 'menu_fun_more',
    mood: 'happy',
    messages: [
      'Masih banyak pilihan seru lho! Mau yang mana?',
      'Lanjut eksplorasi hiburannya! 🎡',
    ],
    chips: [
      ChipOption(emoji: '🎵', label: 'Playlist Mood', targetNodeId: 'playlist_menu'),
      ChipOption(emoji: '🎤', label: 'Karaoke Siang', targetNodeId: 'karaoke_menu'),
      ChipOption(emoji: '🧘', label: 'Relaksasi Napas', targetNodeId: 'relax_breath_start'),
      ChipOption(emoji: '💆', label: 'Stretching Meja', targetNodeId: 'stretch_menu'),
      ChipOption(emoji: '🎪', label: 'Random Dare', targetNodeId: 'dare_menu'),
      ChipOption(emoji: '🏥', label: 'Tips Kesehatan', targetNodeId: 'health_tips_menu'),
      ChipOption(emoji: '🌙', label: 'Wind Down (Pulang)', targetNodeId: 'wind_down_menu'),
      ChipOption(emoji: '💻', label: 'Tech Support', targetNodeId: 'tech_support_menu'),
      ChipOption(emoji: '🧠', label: 'Quiz Trivia', targetNodeId: 'quiz_menu'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_fun'),
    ],
  ),

  // ── JOKES ─────────────────────────────────────

  'jokes_menu': ConversationNode(
    id: 'jokes_menu',
    mood: 'excited',
    messages: ['Genre humor apa nih yang kamu mau? 😆'],
    chips: [
      ChipOption(emoji: '💼', label: 'Jokes Kantor', targetNodeId: 'joke_office'),
      ChipOption(emoji: '💻', label: 'Jokes IT/Tech', targetNodeId: 'joke_tech'),
      ChipOption(emoji: '🤓', label: 'Tebak-Tebakan', targetNodeId: 'joke_riddle'),
      ChipOption(emoji: '😂', label: 'Jokes Garing', targetNodeId: 'joke_garing'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_fun'),
    ],
  ),

  'joke_office': ConversationNode(
    id: 'joke_office',
    mood: 'excited',
    messages: [
      'Apa bedanya karyawan rajin sama WiFi kantor?\nDua-duanya sama-sama sering disconnect waktu dibutuhkan! 😂',
      'Kenapa meeting selalu dimulai telat?\nKarena agendanya selalu "menunggu yang lain dulu". 🕐😂',
      'Apa persamaan deadline sama mantan?\nDua-duanya bikin kamu kerja keras tapi tetap kecewa di akhir! 😭😂',
      'Boss: "Kamu punya skill apa?"\nKaryawan: "Bisa convert meeting 1 jam jadi email 2 baris, Pak."\nBoss: "Kamu diterima." 😂',
      'Kenapa AC kantor selalu dingin banget?\nKarena management-nya sendiri emang udah dingin ke karyawan. 🥶😂',
      'Apa motto karyawan setiap Senin pagi?\n"Ini bukan hidup yang saya pesan." 💀😂',
    ],
    chips: [
      ChipOption(emoji: '😂', label: 'Lagi Dong!', targetNodeId: 'joke_office'),
      ChipOption(emoji: '💻', label: 'Jokes Tech', targetNodeId: 'joke_tech'),
      ChipOption(emoji: '🤓', label: 'Tebak-Tebakan', targetNodeId: 'joke_riddle'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'jokes_menu'),
    ],
  ),

  'joke_tech': ConversationNode(
    id: 'joke_tech',
    mood: 'excited',
    messages: [
      'Kenapa programmer gak suka pantai? 🏖️\nKarena takut overflow! 😂',
      'Berapa programmer yang dibutuhkan untuk mengganti lampu?\nGak ada. Itu masalah hardware. 💡😂',
      'Kenapa programmer selalu bingung antara Halloween dan Christmas?\nKarena OCT 31 == DEC 25! 🤓😂',
      '"Bug" pertama di dunia IT itu beneran serangga 🐛 yang nyangkut di komputer Mark II tahun 1947!',
      'QA tester masuk bar, pesan 1 bir. Pesan 0 bir. Pesan -1 bir. Pesan 999999 bir. Pesan "asdfjkl" bir. Pesan NULL bir. Semuanya oke.\nCustomer pertama masuk, pesan toilet, bar terbakar. 🔥😂',
      'Kenapa developer selalu pakai kacamata?\nKarena mereka gak bisa C#! 👓😂',
    ],
    chips: [
      ChipOption(emoji: '😂', label: 'Lagi Dong!', targetNodeId: 'joke_tech'),
      ChipOption(emoji: '💼', label: 'Jokes Kantor', targetNodeId: 'joke_office'),
      ChipOption(emoji: '😂', label: 'Jokes Garing', targetNodeId: 'joke_garing'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'jokes_menu'),
    ],
  ),

  'joke_riddle': ConversationNode(
    id: 'joke_riddle',
    mood: 'excited',
    messages: [
      '🤓 Tebak-tebakan!\n\nSiapa yang selalu lembur tapi gak pernah dapat gaji?\n\n...\n\nJawab: Burung hantu! 🦉 Soalnya dia cuma melek malam!',
      '🤓 Tebak-tebakan!\n\nApa yang punya kaki tapi gak bisa jalan?\n\n...\n\nJawab: Meja! Dan meja kantor kamu butuh dibersihin tuh! 😆',
      '🤓 Tebak-tebakan!\n\nKenapa teknisi selalu bawa obeng?\n\n...\n\nJawab: Karena hidup ini penuh dengan hal yang perlu dibenerin! 🔧',
      '🤓 Tebak-tebakan!\n\nApa bahasa pemrograman favorit ikan?\n\n...\n\nJawab: C! (Sea/Laut 🐟)',
      '🤓 Tebak-tebakan!\n\nApa beda kucing sama karyawan?\n\n...\n\nJawab: Kucing punya 9 nyawa, karyawan cuma punya 1 gaji! 😂',
    ],
    chips: [
      ChipOption(emoji: '🤓', label: 'Tebakan Lagi!', targetNodeId: 'joke_riddle'),
      ChipOption(emoji: '💼', label: 'Jokes Kantor', targetNodeId: 'joke_office'),
      ChipOption(emoji: '🧠', label: 'Quiz Seru', targetNodeId: 'quiz_menu'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'jokes_menu'),
    ],
  ),

  'joke_garing': ConversationNode(
    id: 'joke_garing',
    mood: 'excited',
    messages: [
      'Apa beda kerupuk sama karyawan?\nKerupuk makin digoreng makin besar.\nKaryawan makin digoreng (deadline) makin kurus. 😂🤣',
      'Kenapa kura-kura bisa sampai duluan?\nKarena kelincinya lagi meeting! 🐢😂',
      'Apa yang lebih berat dari 100 kg besi?\nBeban pikiran hari Senin pagi. 😩😂',
      'Bapak-bapak bapak-bapak...\nKenapa wifi kantor kayak cinta?\nKarena kadang connected, kadang nggak, dan selalu butuh password! 📶😂',
      'Apa persamaan lemari sama karyawan?\nDua-duanya punya banyak laci (rahasia) yang gak boleh dibuka atasan! 😂',
    ],
    chips: [
      ChipOption(emoji: '😂', label: 'Lagi Dong!', targetNodeId: 'joke_garing'),
      ChipOption(emoji: '💻', label: 'Jokes Tech', targetNodeId: 'joke_tech'),
      ChipOption(emoji: '💡', label: 'Fakta Menarik', targetNodeId: 'facts_menu'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'jokes_menu'),
    ],
  ),

  // ── FAKTA MENARIK ─────────────────────────────

  'facts_menu': ConversationNode(
    id: 'facts_menu',
    mood: 'excited',
    messages: ['Mau tau fakta menarik tentang apa nih? 💡'],
    chips: [
      ChipOption(emoji: '💼', label: 'Fakta Dunia Kerja', targetNodeId: 'fact_work'),
      ChipOption(emoji: '💻', label: 'Fakta Teknologi', targetNodeId: 'fact_tech'),
      ChipOption(emoji: '🌍', label: 'Fakta Unik Dunia', targetNodeId: 'fact_world'),
      ChipOption(emoji: '🧠', label: 'Fakta Otak & Tubuh', targetNodeId: 'fact_body'),
      ChipOption(emoji: '🇮🇩', label: 'Trivia Indonesia', targetNodeId: 'trivia_indonesia'),
      ChipOption(emoji: '📜', label: 'Peribahasa Hari Ini', targetNodeId: 'wisdom_daily'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_fun'),
    ],
  ),

  'fact_work': ConversationNode(
    id: 'fact_work',
    mood: 'excited',
    messages: [
      '💡 Tahukah kamu?\n\nRata-rata orang menghabiskan 90.000 jam bekerja selama hidupnya. Itu setara 10 tahun non-stop!\n\nPastikan jam-jam itu bermakna ya! 💪',
      '💡 Fun Fact!\n\nDi Finlandia 🇫🇮, karyawan yang sudah bekerja 30 tahun berhak atas cuti 8 minggu per tahun! Di Jepang, ada istilah "inemuri" — tidur siang di kantor dianggap tanda kerja keras.',
      '💡 Tahukah kamu?\n\nKaryawan yang makan siang TIDAK di meja kerja 33% lebih produktif di sore hari. Jadi, ayo makan di luar meja kerja! 🍽️',
      '💡 Fakta Kerja!\n\n78% karyawan mengatakan fleksibilitas waktu kerja lebih penting dari gaji besar. Work-life balance is real! ⚖️',
      '💡 Fakta Menarik!\n\nPekerja yang punya tanaman di meja kerja 15% lebih produktif. 🌿 Sudah punya tanaman di meja belum?',
    ],
    chips: [
      ChipOption(emoji: '💡', label: 'Fakta Lain!', targetNodeId: 'fact_work'),
      ChipOption(emoji: '💻', label: 'Fakta Teknologi', targetNodeId: 'fact_tech'),
      ChipOption(emoji: '🧠', label: 'Fakta Otak', targetNodeId: 'fact_body'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'facts_menu'),
    ],
  ),

  'fact_tech': ConversationNode(
    id: 'fact_tech',
    mood: 'excited',
    messages: [
      '💡 Fun Fact Teknologi!\n\nKabel serat optik bisa mentransmisikan data sejauh 100km tanpa penguat sinyal. Cahaya di dalamnya bergerak mendekati kecepatan cahaya! ⚡',
      '💡 Tahukah kamu?\n\nTeknisi telekomunikasi pertama di dunia adalah operator telegraf di tahun 1840-an! Mereka mengirim pesan pakai kode Morse. 📡',
      '💡 Fun Fact!\n\nMenara BTS rata-rata bisa melayani hingga 200 panggilan telepon secara bersamaan. Satu tower = 200 orang ngobrol! 📱',
      '💡 Fakta Tech!\n\nData yang dihasilkan manusia setiap hari setara 2.5 quintillion bytes. Itu kalau dicetak butuh kertas yang bisa bungkus bumi 100x! 🌍',
      '💡 Tahukah kamu?\n\nEmail pertama di dunia dikirim tahun 1971 oleh Ray Tomlinson. Dia bahkan lupa isi emailnya apa! 📧😂',
    ],
    chips: [
      ChipOption(emoji: '💡', label: 'Fakta Lain!', targetNodeId: 'fact_tech'),
      ChipOption(emoji: '💼', label: 'Fakta Kerja', targetNodeId: 'fact_work'),
      ChipOption(emoji: '🌍', label: 'Fakta Dunia', targetNodeId: 'fact_world'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'facts_menu'),
    ],
  ),

  'fact_world': ConversationNode(
    id: 'fact_world',
    mood: 'excited',
    messages: [
      '🌍 Fakta Unik Dunia!\n\nDi Swedia ada hotel yang seluruhnya terbuat dari es. Suhu kamar -5°C dan kamu tidur di kasur es! 🧊 AC kantor kita mah kalah.',
      '🌍 Tahukah kamu?\n\nHoney (madu) tidak pernah basi! Arkeolog menemukan madu berusia 3.000 tahun di makam Mesir kuno yang masih bisa dimakan. 🍯',
      '🌍 Fun Fact!\n\nGurita punya 3 jantung dan darahnya berwarna biru! 🐙 Kalau kamu punya 3 jantung, mungkin Senin pagi gak se-berat ini 😂',
      '🌍 Fakta Unik!\n\nDi Jepang, ada pulau yang populasi kucingnya lebih banyak dari manusia! 🐱 Namanya Aoshima Island — surga pecinta kucing.',
      '🌍 Tahukah kamu?\n\nPetir bisa mencapai suhu 30.000°C — lima kali lebih panas dari permukaan matahari! ⚡🌞',
    ],
    chips: [
      ChipOption(emoji: '🌍', label: 'Fakta Lain!', targetNodeId: 'fact_world'),
      ChipOption(emoji: '🧠', label: 'Fakta Otak', targetNodeId: 'fact_body'),
      ChipOption(emoji: '😂', label: 'Jokes', targetNodeId: 'jokes_menu'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'facts_menu'),
    ],
  ),

  'fact_body': ConversationNode(
    id: 'fact_body',
    mood: 'excited',
    messages: [
      '🧠 Fakta Otak & Tubuh!\n\nOtak manusia menghasilkan listrik yang cukup untuk menyalakan lampu kecil! Ayo charge otak kamu dengan istirahat cukup ⚡💡',
      '🧠 Tahukah kamu?\n\nTubuh manusia punya lebih dari 600 otot. Tersenyum cuma butuh 17 otot, cemberut butuh 43. Hemat energi, senyum aja! 😊',
      '🧠 Fun Fact!\n\nMata manusia bisa membedakan sekitar 10 juta warna berbeda. Tapi kenapa milestone project cuma merah, kuning, hijau? 🚦😂',
      '🧠 Fakta Tubuh!\n\nBersin bisa mencapai kecepatan 160 km/jam! Lebih cepat dari mobil di jalan tol. Makanya tutup mulut saat bersin ya! 🤧',
      '🧠 Tahukah kamu?\n\nOtak kita mengonsumsi 20% energi tubuh meskipun beratnya cuma 2% dari berat badan. Pantas aja mikir berat bikin lapar! 🍔🧠',
    ],
    chips: [
      ChipOption(emoji: '🧠', label: 'Fakta Lain!', targetNodeId: 'fact_body'),
      ChipOption(emoji: '💼', label: 'Fakta Kerja', targetNodeId: 'fact_work'),
      ChipOption(emoji: '💡', label: 'Tips Produktivitas', targetNodeId: 'task_tips'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'facts_menu'),
    ],
  ),

  // ── QUIZ ──────────────────────────────────────

  'quiz_menu': ConversationNode(
    id: 'quiz_menu',
    mood: 'excited',
    messages: [
      'Quiz time! 🧠 Pilih kategori quiz yang mau kamu coba!',
      'Ayo uji pengetahuanmu! 🎯 Kategori mana?',
    ],
    chips: [
      ChipOption(emoji: '💼', label: 'Quiz HR & Kantor', targetNodeId: 'quiz_hr'),
      ChipOption(emoji: '💻', label: 'Quiz Teknologi', targetNodeId: 'quiz_tech'),
      ChipOption(emoji: '🌍', label: 'Quiz Umum', targetNodeId: 'quiz_general'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_fun'),
    ],
  ),

  'quiz_hr': ConversationNode(
    id: 'quiz_hr',
    mood: 'excited',
    messages: [
      '🧠 Quiz HR!\n\nBerapa lama masa percobaan (probation) standar di Indonesia menurut UU Ketenagakerjaan?',
    ],
    chips: [
      ChipOption(emoji: '1️⃣', label: '1 bulan', targetNodeId: 'quiz_hr_wrong1'),
      ChipOption(emoji: '2️⃣', label: '3 bulan', targetNodeId: 'quiz_hr_correct'),
      ChipOption(emoji: '3️⃣', label: '6 bulan', targetNodeId: 'quiz_hr_wrong2'),
      ChipOption(emoji: '🏠', label: 'Skip, Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'quiz_hr_correct': ConversationNode(
    id: 'quiz_hr_correct',
    mood: 'excited',
    messages: [
      '✅ BENAR! 🎉\n\nMasa percobaan menurut UU Ketenagakerjaan No. 13/2003 Pasal 60 adalah maksimal 3 bulan. Karyawan dalam masa percobaan tidak boleh dibayar di bawah upah minimum!\n\nKamu memang karyawan yang melek hukum! 💪',
    ],
    chips: [
      ChipOption(emoji: '🧠', label: 'Quiz Lagi!', targetNodeId: 'quiz_tech'),
      ChipOption(emoji: '💡', label: 'Fakta Kerja', targetNodeId: 'fact_work'),
      ChipOption(emoji: '😂', label: 'Jokes', targetNodeId: 'jokes_menu'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'quiz_menu'),
    ],
  ),

  'quiz_hr_wrong1': ConversationNode(
    id: 'quiz_hr_wrong1',
    mood: 'concerned',
    messages: [
      '❌ Kurang tepat!\n\nJawaban yang benar: 3 bulan (bukan 1 bulan).\n\nMenurut UU Ketenagakerjaan, masa percobaan maksimal 3 bulan. Terlalu singkat 1 bulan mah! 😅',
    ],
    chips: [
      ChipOption(emoji: '🧠', label: 'Coba Quiz Lain', targetNodeId: 'quiz_tech'),
      ChipOption(emoji: '💡', label: 'Fakta Kerja', targetNodeId: 'fact_work'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'quiz_menu'),
    ],
  ),

  'quiz_hr_wrong2': ConversationNode(
    id: 'quiz_hr_wrong2',
    mood: 'concerned',
    messages: [
      '❌ Hampir!\n\nJawaban yang benar: 3 bulan (bukan 6 bulan).\n\nMenurut UU Ketenagakerjaan, masa percobaan maksimal 3 bulan. 6 bulan itu terlalu lama — kasian karyawannya! 😅',
    ],
    chips: [
      ChipOption(emoji: '🧠', label: 'Coba Quiz Lain', targetNodeId: 'quiz_tech'),
      ChipOption(emoji: '💡', label: 'Fakta Kerja', targetNodeId: 'fact_work'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'quiz_menu'),
    ],
  ),

  'quiz_tech': ConversationNode(
    id: 'quiz_tech',
    mood: 'excited',
    messages: [
      '🧠 Quiz Tech!\n\nApa kepanjangan dari HTML?',
    ],
    chips: [
      ChipOption(emoji: '1️⃣', label: 'Hyper Text Markup Language', targetNodeId: 'quiz_tech_correct'),
      ChipOption(emoji: '2️⃣', label: 'High Tech Modern Language', targetNodeId: 'quiz_tech_wrong'),
      ChipOption(emoji: '3️⃣', label: 'Hyper Transfer Multi Language', targetNodeId: 'quiz_tech_wrong'),
      ChipOption(emoji: '🏠', label: 'Skip', targetNodeId: 'root'),
    ],
  ),

  'quiz_tech_correct': ConversationNode(
    id: 'quiz_tech_correct',
    mood: 'excited',
    messages: [
      '✅ BENAR! 🎉\n\nHTML = Hyper Text Markup Language.\n\nDiciptakan tahun 1993 oleh Tim Berners-Lee. Tanpa HTML, gak ada web, gak ada Instagram, gak ada TikTok! 🌐',
    ],
    chips: [
      ChipOption(emoji: '🧠', label: 'Quiz Lagi!', targetNodeId: 'quiz_general'),
      ChipOption(emoji: '💻', label: 'Fakta Tech', targetNodeId: 'fact_tech'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'quiz_menu'),
    ],
  ),

  'quiz_tech_wrong': ConversationNode(
    id: 'quiz_tech_wrong',
    mood: 'concerned',
    messages: [
      '❌ Salah nih!\n\nJawaban yang benar: Hyper Text Markup Language.\n\nHTML bukan bahasa pemrograman, tapi bahasa markup yang jadi fondasi setiap halaman web di dunia! 🌐',
    ],
    chips: [
      ChipOption(emoji: '🧠', label: 'Quiz Lagi!', targetNodeId: 'quiz_general'),
      ChipOption(emoji: '💡', label: 'Fakta Tech', targetNodeId: 'fact_tech'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'quiz_menu'),
    ],
  ),

  'quiz_general': ConversationNode(
    id: 'quiz_general',
    mood: 'excited',
    messages: [
      '🧠 Quiz Umum!\n\nNegara mana yang punya bendera tanpa warna merah, biru, atau putih?',
    ],
    chips: [
      ChipOption(emoji: '1️⃣', label: 'Jamaika 🇯🇲', targetNodeId: 'quiz_general_correct'),
      ChipOption(emoji: '2️⃣', label: 'Brazil 🇧🇷', targetNodeId: 'quiz_general_wrong'),
      ChipOption(emoji: '3️⃣', label: 'Jerman 🇩🇪', targetNodeId: 'quiz_general_wrong'),
      ChipOption(emoji: '🏠', label: 'Skip', targetNodeId: 'root'),
    ],
  ),

  'quiz_general_correct': ConversationNode(
    id: 'quiz_general_correct',
    mood: 'excited',
    messages: [
      '✅ BENAR! 🎉\n\nBendera Jamaika 🇯🇲 terdiri dari warna hitam, hijau, dan kuning (gold). Satu-satunya bendera nasional tanpa merah, biru, atau putih!\n\nWawasanmu luas juga ya! 🌍',
    ],
    chips: [
      ChipOption(emoji: '🧠', label: 'Quiz Lagi!', targetNodeId: 'quiz_hr'),
      ChipOption(emoji: '🌍', label: 'Fakta Dunia', targetNodeId: 'fact_world'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'quiz_menu'),
    ],
  ),

  'quiz_general_wrong': ConversationNode(
    id: 'quiz_general_wrong',
    mood: 'concerned',
    messages: [
      '❌ Bukan!\n\nJawaban yang benar: Jamaika 🇯🇲!\n\nBendera Jamaika terdiri dari hitam, hijau, dan kuning — satu-satunya bendera nasional tanpa merah, biru, atau putih!',
    ],
    chips: [
      ChipOption(emoji: '🧠', label: 'Quiz Lagi!', targetNodeId: 'quiz_hr'),
      ChipOption(emoji: '🌍', label: 'Fakta Dunia', targetNodeId: 'fact_world'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'quiz_menu'),
    ],
  ),

  // ── MOTIVASI ──────────────────────────────────

  'motivation': ConversationNode(
    id: 'motivation',
    mood: 'excited',
    messages: [
      '💪 Quotes Semangat Hari Ini:\n\n'
        '"Sukses bukanlah kunci kebahagiaan. Kebahagiaan adalah kunci sukses. Jika kamu mencintai apa yang kamu lakukan, kamu akan sukses."\n'
        '— Albert Schweitzer\n\n'
        'Tetap semangat ya! Hari ini lebih baik dari kemarin! 🔥',
      '💪 Motivasi Hari Ini:\n\n'
        '"Jangan bandingkan dirimu dengan orang lain. Bandingkan dirimu hari ini dengan dirimu kemarin."\n\n'
        'Progress sekecil apapun tetap progress. Kamu sudah hebat sampai di titik ini! 🌟',
      '💪 Semangat!\n\n'
        '"Hard work beats talent when talent doesn\'t work hard."\n'
        '— Tim Notke\n\n'
        'Kerja keras mengalahkan bakat, jika bakat tidak bekerja keras. Terus semangat! 🚀',
      '💪 Quote of the Day:\n\n'
        '"Setiap master dulu pernah jadi pemula. Setiap profesional dulu pernah amatir."\n\n'
        'Gak ada yang instan — nikmati prosesnya! 🌱➡️🌳',
      '💪 Semangat Kerja!\n\n'
        '"Orang sukses melakukan apa yang orang biasa tidak mau lakukan."\n\n'
        'Kamu bukan karyawan biasa. Kamu luar biasa! ⭐',
    ],
    chips: [
      ChipOption(emoji: '💪', label: 'Motivasi Lagi!', targetNodeId: 'motivation'),
      ChipOption(emoji: '😂', label: 'Jokes Aja', targetNodeId: 'jokes_menu'),
      ChipOption(emoji: '💡', label: 'Fakta Menarik', targetNodeId: 'facts_menu'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ── CURHAT CORNER ─────────────────────────────

  'curhat_menu': ConversationNode(
    id: 'curhat_menu',
    mood: 'concerned',
    messages: [
      'Curhat Corner 😌\nKadang kita butuh didengar. Gimana perasaanmu hari ini?',
      'Hey, aku di sini buat dengerin. 💙 Lagi ngerasa gimana nih?',
    ],
    chips: [
      ChipOption(emoji: '😫', label: 'Capek Banget', targetNodeId: 'tired'),
      ChipOption(emoji: '😤', label: 'Lagi Kesel', targetNodeId: 'angry'),
      ChipOption(emoji: '😰', label: 'Cemas / Overthinking', targetNodeId: 'anxious'),
      ChipOption(emoji: '😐', label: 'Bosen & Gabut', targetNodeId: 'bored'),
      ChipOption(emoji: '😊', label: 'Seneng Sih!', targetNodeId: 'happy_mood'),
      ChipOption(emoji: '🔋', label: 'Cek Level Energi', targetNodeId: 'energy_check'),
      ChipOption(emoji: '🌈', label: 'Mood Booster', targetNodeId: 'mood_booster'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_fun'),
    ],
  ),

  'tired': ConversationNode(
    id: 'tired',
    mood: 'concerned',
    messages: [
      '😮‍💨 Capek ya? Itu wajar kok, kamu sudah kerja keras hari ini.\n\n'
        'Tips quick recovery:\n'
        '☕ Minum air putih (bukan cuma kopi!)\n'
        '🧘 Tarik napas dalam 5 detik, tahan 5 detik, keluarkan 5 detik\n'
        '🚶 Berdiri dan stretching 2 menit\n\n'
        'Ingat, istirahat itu bukan kelemahan — itu strategi! 💪',
      '😮‍💨 Hey, tubuh capek itu tanda butuh recharge.\n\n'
        'Coba teknik ini:\n'
        '1️⃣ Cuci muka pakai air dingin 🧊\n'
        '2️⃣ Dengarkan 1 lagu favorit 🎵\n'
        '3️⃣ Lihat keluar jendela 30 detik 🌤️\n\n'
        'Reset kecil bisa bikin beda besar! Sudah lebih baik? 😊',
    ],
    chips: [
      ChipOption(emoji: '🌴', label: 'Cek Sisa Cuti', targetNodeId: 'leave_balance'),
      ChipOption(emoji: '😂', label: 'Hibur Aku Dong', targetNodeId: 'joke_garing'),
      ChipOption(emoji: '💪', label: 'Motivasi', targetNodeId: 'motivation'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'curhat_menu'),
    ],
  ),

  'angry': ConversationNode(
    id: 'angry',
    mood: 'concerned',
    messages: [
      '😤 Lagi kesel ya? Aku paham kok, kadang memang ada yang bikin emosi.\n\n'
        'Sebelum meledak, coba ini:\n'
        '1️⃣ Jangan langsung respon — delay 10 detik\n'
        '2️⃣ Tulis apa yang bikin kesel di notes HP (jangan kirim!)\n'
        '3️⃣ Jalan kaki 5 menit ke luar ruangan\n\n'
        'Emosi itu valid, tapi jangan sampai merusak hubungan kerja ya! 🤝',
      '😤 Aku ngerti, kadang emang ada hal yang bikin darah naik.\n\n'
        'Tips mendinginkan kepala:\n'
        '🧊 Pegang sesuatu yang dingin (botol minum, AC)\n'
        '🎵 Pasang headset, dengarkan musik 3 menit\n'
        '📝 Tulis 3 hal yang kamu syukuri hari ini\n\n'
        'Ini pasti berlalu. Kamu lebih kuat dari yang kamu kira! 💎',
    ],
    chips: [
      ChipOption(emoji: '😂', label: 'Butuh Ketawa', targetNodeId: 'joke_garing'),
      ChipOption(emoji: '💪', label: 'Motivasi', targetNodeId: 'motivation'),
      ChipOption(emoji: '😌', label: 'Tips Relax', targetNodeId: 'tired'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'curhat_menu'),
    ],
  ),

  'anxious': ConversationNode(
    id: 'anxious',
    mood: 'concerned',
    messages: [
      '😰 Cemas atau overthinking ya? Itu lebih umum dari yang kamu kira — kamu tidak sendiri.\n\n'
        'Grounding technique 5-4-3-2-1:\n'
        '👀 Sebutkan 5 hal yang bisa kamu LIHAT\n'
        '✋ 4 hal yang bisa kamu SENTUH\n'
        '👂 3 hal yang bisa kamu DENGAR\n'
        '👃 2 hal yang bisa kamu CIUM\n'
        '👅 1 hal yang bisa kamu RASAKAN\n\n'
        'Teknik ini membawa pikiran kembali ke "sekarang". Coba ya! 🌿',
      '😰 Overthinking itu kayak rocking chair — banyak gerakan tapi gak ke mana-mana.\n\n'
        'Tips dari aku:\n'
        '📝 Tulis semua kekhawatiran di kertas, lalu tanya: "Yang mana yang bisa aku kontrol?"\n'
        '⏰ Beri batas waktu khawatir: 10 menit. Setelah itu, take action.\n'
        '🗣️ Ceritakan ke seseorang yang kamu percaya.\n\n'
        'Kamu lebih kuat dari pikiran negatifmu! 💙',
    ],
    chips: [
      ChipOption(emoji: '💪', label: 'Motivasi', targetNodeId: 'motivation'),
      ChipOption(emoji: '🧠', label: 'Fakta Otak', targetNodeId: 'fact_body'),
      ChipOption(emoji: '🎲', label: 'Distraksi Seru', targetNodeId: 'quiz_menu'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'curhat_menu'),
    ],
  ),

  'bored': ConversationNode(
    id: 'bored',
    mood: 'neutral',
    messages: [
      '😐 Gabut ya? Tenang, aku punya obatnya! 💊\n\n'
        'Pilih salah satu buat mengusir bosan:',
      '😐 Bosen itu tandanya otak butuh stimulasi baru. 🧠\n\n'
        'Nih, aku punya banyak pilihan buat kamu!',
    ],
    chips: [
      ChipOption(emoji: '😂', label: 'Jokes Dong', targetNodeId: 'jokes_menu'),
      ChipOption(emoji: '🧠', label: 'Quiz Seru', targetNodeId: 'quiz_menu'),
      ChipOption(emoji: '💡', label: 'Fakta Menarik', targetNodeId: 'facts_menu'),
      ChipOption(emoji: '🏆', label: 'Cek Leaderboard', targetNodeId: 'leaderboard_view'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'curhat_menu'),
    ],
  ),

  'happy_mood': ConversationNode(
    id: 'happy_mood',
    mood: 'happy',
    messages: [
      '😊 Seneng dengernya! 🎉\n\n'
        'Hari yang baik itu menular — coba sebarkan vibes positif ke rekan kerja juga!\n\n'
        'Fun idea: Kirim pesan "terima kasih" ke satu orang yang sudah membantumu hari ini. Dijamin bikin hari mereka juga cerah! ☀️',
      '😊 YEAY! Senang banget dengar itu! 🥳\n\n'
        'Tau gak, riset menunjukkan bahwa menulis 3 hal yang disyukuri setiap hari bisa meningkatkan kebahagiaan 25%!\n\n'
        'Apa 3 hal yang kamu syukuri hari ini? 💛',
    ],
    chips: [
      ChipOption(emoji: '🏆', label: 'Lihat Pencapaian', targetNodeId: 'leaderboard_view'),
      ChipOption(emoji: '😂', label: 'Tambah Ketawa', targetNodeId: 'jokes_menu'),
      ChipOption(emoji: '💡', label: 'Fakta Positif', targetNodeId: 'fact_work'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ── FUN FACT (legacy shortcut) ────────────────

  'fun_fact': ConversationNode(
    id: 'fun_fact',
    mood: 'excited',
    messages: ['Mau tau fakta apa nih? 💡'],
    chips: [
      ChipOption(emoji: '💼', label: 'Fakta Kerja', targetNodeId: 'fact_work'),
      ChipOption(emoji: '💻', label: 'Fakta Tech', targetNodeId: 'fact_tech'),
      ChipOption(emoji: '🌍', label: 'Fakta Dunia', targetNodeId: 'fact_world'),
      ChipOption(emoji: '🧠', label: 'Fakta Otak', targetNodeId: 'fact_body'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_fun'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  DARURAT K3                                 │
  // └─────────────────────────────────────────────┘

  'emergency': ConversationNode(
    id: 'emergency',
    mood: 'urgent',
    messages: [
      '🚨 MODE DARURAT K3 🚨\n\n'
        'Jika terjadi kecelakaan kerja atau cedera:\n\n'
        '1️⃣ Amankan lokasi dan korban\n'
        '2️⃣ Hubungi kontak darurat segera\n'
        '3️⃣ Berikan pertolongan pertama jika memungkinkan\n'
        '4️⃣ Jangan pindahkan korban jika cedera punggung/leher\n\n'
        'Keselamatan adalah PRIORITAS UTAMA!',
    ],
    uiComponent: 'BotEmergencyCard',
    chips: [
      ChipOption(emoji: '🏥', label: 'Prosedur P3K', targetNodeId: 'emergency_p3k'),
      ChipOption(emoji: '📋', label: 'Lapor Insiden', targetNodeId: 'emergency_report'),
      ChipOption(emoji: '🏠', label: 'Kembali ke Menu', targetNodeId: 'root'),
    ],
  ),

  'emergency_p3k': ConversationNode(
    id: 'emergency_p3k',
    mood: 'urgent',
    messages: [
      '🏥 Prosedur P3K Dasar:\n\n'
        '🩸 Luka terbuka:\n'
        '• Tekan luka dengan kain bersih\n'
        '• Angkat bagian yang terluka lebih tinggi dari jantung\n\n'
        '🔥 Luka bakar:\n'
        '• Siram air mengalir 10-20 menit\n'
        '• JANGAN oleskan pasta gigi atau mentega\n\n'
        '💀 Pingsan:\n'
        '• Baringkan korban, angkat kaki\n'
        '• Longgarkan pakaian ketat\n\n'
        '⚠️ Ini bukan pengganti pelatihan medis profesional!',
    ],
    chips: [
      ChipOption(emoji: '🚨', label: 'Kontak Darurat', targetNodeId: 'emergency'),
      ChipOption(emoji: '📋', label: 'Lapor Insiden', targetNodeId: 'emergency_report'),
      ChipOption(emoji: '🏠', label: 'Kembali', targetNodeId: 'root'),
    ],
  ),

  'emergency_report': ConversationNode(
    id: 'emergency_report',
    mood: 'urgent',
    messages: [
      '📋 Untuk melaporkan insiden K3:\n\n'
        '1️⃣ Catat waktu dan lokasi kejadian\n'
        '2️⃣ Dokumentasikan dengan foto (jika aman)\n'
        '3️⃣ Hubungi HRD untuk form laporan insiden\n'
        '4️⃣ Jangan menghilangkan barang bukti di lokasi\n\n'
        'Setiap laporan membantu mencegah insiden serupa di masa depan! 🙏',
    ],
    chips: [
      ChipOption(emoji: '🚨', label: 'Kontak Darurat', targetNodeId: 'emergency'),
      ChipOption(emoji: '🏥', label: 'Prosedur P3K', targetNodeId: 'emergency_p3k'),
      ChipOption(emoji: '🏠', label: 'Kembali', targetNodeId: 'root'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  KOPI & KULINER (FOOD & BEVERAGE)           │
  // └─────────────────────────────────────────────┘
  'menu_food_coffee': ConversationNode(
    id: 'menu_food_coffee',
    mood: 'happy',
    messages: [
      'Wah, urusan perut & kafein emang ga boleh ditunda! ☕🍱 Mau cari apa nih?',
      'Biar kerja makin fokus dan berenergi, mau asupan apa sekarang? 😋',
    ],
    chips: [
      ChipOption(emoji: '☕', label: 'Rekomendasi Kopi', targetNodeId: 'food_coffee_pick'),
      ChipOption(emoji: '🍱', label: 'Makan Siang Enak', targetNodeId: 'food_lunch_pick'),
      ChipOption(emoji: '🍩', label: 'Camilan Sore', targetNodeId: 'food_snack_pick'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'food_coffee_pick': ConversationNode(
    id: 'food_coffee_pick',
    mood: 'excited',
    messages: ['Tipe penikmat kopi yang mana nih kamu? ☕✨'],
    chips: [
      ChipOption(emoji: '🧋', label: 'Creamy & Manis', targetNodeId: 'coffee_creamy'),
      ChipOption(emoji: '⚡', label: 'Strong & Pahit (Hitam)', targetNodeId: 'coffee_strong'),
      ChipOption(emoji: '🍵', label: 'Non-Coffee / Matcha', targetNodeId: 'coffee_non'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_food_coffee'),
    ],
  ),

  'coffee_creamy': ConversationNode(
    id: 'coffee_creamy',
    mood: 'happy',
    messages: [
      '🥤 Pilihan Mantap: Kopi Susu Gula Aren / Vanilla Latte!\n\n'
        '💡 Tips dari Bot:\n'
        '• Cocok dinikmati pas briefing pagi atau jam 10:00.\n'
        '• Kurangi gula jika sudah minum lebih dari 1 gelas sehari.\n'
        '• Bikin mood naik seketika tanpa bikin kembung!',
    ],
    chips: [
      ChipOption(emoji: '🍱', label: 'Cari Makan Siang', targetNodeId: 'food_lunch_pick'),
      ChipOption(emoji: '☕', label: 'Lihat Kopi Lain', targetNodeId: 'food_coffee_pick'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'coffee_strong': ConversationNode(
    id: 'coffee_strong',
    mood: 'excited',
    messages: [
      '☕ Jiwa Teknisi Sejati: Americano / Double Shot Espresso!\n\n'
        '⚡ Efek:\n'
        '• Nol kalori, fokus instan 100%!\n'
        '• Sangat pas diminum sebelum konfigurasi server atau maintenance site.\n'
        '• Jangan lupa barengi dengan 1 gelas air putih biar tidak dehidrasi ya!',
    ],
    chips: [
      ChipOption(emoji: '🍱', label: 'Cari Makan Siang', targetNodeId: 'food_lunch_pick'),
      ChipOption(emoji: '💡', label: 'Tips Lapangan', targetNodeId: 'menu_field_tips'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'coffee_non': ConversationNode(
    id: 'coffee_non',
    mood: 'happy',
    messages: [
      '🍵 Rekomendasi Sehat: Matcha Latte atau Hot Dark Chocolate!\n\n'
        '✨ Manfaat:\n'
        '• Mengandung L-theanine yang menenangkan pikiran.\n'
        '• Aman untuk lambung dan tidak bikin jantung berdebar.\n'
        '• Teman pas buat ngobrol santai sore hari.',
    ],
    chips: [
      ChipOption(emoji: '🍩', label: 'Cari Camilan', targetNodeId: 'food_snack_pick'),
      ChipOption(emoji: '😌', label: 'Curhat Corner', targetNodeId: 'curhat_menu'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'food_lunch_pick': ConversationNode(
    id: 'food_lunch_pick',
    mood: 'happy',
    messages: ['Makan siang hari ini pengen vibe yang kayak apa? 🍽️'],
    chips: [
      ChipOption(emoji: '🌶️', label: 'Pedes Nampol (Ayam/Padang)', targetNodeId: 'lunch_spicy'),
      ChipOption(emoji: '🥗', label: 'Sehat & Segar (Soto/Gado)', targetNodeId: 'lunch_healthy'),
      ChipOption(emoji: '🍳', label: 'Praktis Cepat (Nasgor/Mie)', targetNodeId: 'lunch_quick'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_food_coffee'),
    ],
  ),

  'lunch_spicy': ConversationNode(
    id: 'lunch_spicy',
    mood: 'excited',
    messages: [
      '🌶️ Juara Lapangan: Nasi Padang Lauk Rendang / Ayam Geprek Level 5!\n\n'
        '🔥 Dijamin kantuk hilang seketika! Tapi awas jangan terlalu pedas ya biar pas meeting sore perut tetap aman.',
    ],
    chips: [
      ChipOption(emoji: '☕', label: 'Cari Minum Dingin', targetNodeId: 'food_coffee_pick'),
      ChipOption(emoji: '🍩', label: 'Camilan Pencuci Mulut', targetNodeId: 'food_snack_pick'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'lunch_healthy': ConversationNode(
    id: 'lunch_healthy',
    mood: 'happy',
    messages: [
      '🥗 Pilihan Bijak: Gado-gado Lontong / Soto Ayam Bening!\n\n'
        '🌿 Ringan di lambung, nutrisi lengkap, dan ga bikin "food coma" alias ngantuk berat jam 14:00!',
    ],
    chips: [
      ChipOption(emoji: '☕', label: 'Minum Kopi', targetNodeId: 'food_coffee_pick'),
      ChipOption(emoji: '💡', label: 'Tips Produktif', targetNodeId: 'task_tips'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'lunch_quick': ConversationNode(
    id: 'lunch_quick',
    mood: 'neutral',
    messages: [
      '🍳 Pas Buat Kejar Jadwal: Nasi Goreng Spesial / Kwetiau Siram!\n\n'
        '⚡ Enak, porsi pas, dan langsung ready tanpa nunggu lama pas lagi padat tugas tiket.',
    ],
    chips: [
      ChipOption(emoji: '📋', label: 'Cek Tugas Saya', targetNodeId: 'task_view'),
      ChipOption(emoji: '🍩', label: 'Camilan Nanti Sore', targetNodeId: 'food_snack_pick'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'food_snack_pick': ConversationNode(
    id: 'food_snack_pick',
    mood: 'happy',
    messages: ['Camilan sore pengganjal lapar sebelum jam pulang! 🍩 Pilih yang mana?'],
    chips: [
      ChipOption(emoji: '🥟', label: 'Gorengan Gurih', targetNodeId: 'snack_gorengan'),
      ChipOption(emoji: '🍉', label: 'Buah Segar Dingin', targetNodeId: 'snack_fruit'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_food_coffee'),
    ],
  ),

  'snack_gorengan': ConversationNode(
    id: 'snack_gorengan',
    mood: 'excited',
    messages: [
      '🥟 Bakwan anget, tahu isi, pisang goreng + cabai rawit! Teman sejati sambil rekap pekerjaan harian.',
    ],
    chips: [
      ChipOption(emoji: '☕', label: 'Kopi Pendamping', targetNodeId: 'food_coffee_pick'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'snack_fruit': ConversationNode(
    id: 'snack_fruit',
    mood: 'happy',
    messages: [
      '🍉 Potongan semangka atau melon dingin! Menghidrasi tubuh setelah seharian di jalan atau ruangan ber-AC.',
    ],
    chips: [
      ChipOption(emoji: '💪', label: 'Motivasi Kerja', targetNodeId: 'motivation'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  TIPS LAPANGAN & TEKNISI ONTIME             │
  // └─────────────────────────────────────────────┘
  'menu_field_tips': ConversationNode(
    id: 'menu_field_tips',
    mood: 'neutral',
    messages: [
      'Kumpulan trik & tips praktis untuk rekan teknisi dan operasional lapangan! 💡 Pilih topik:',
    ],
    chips: [
      ChipOption(emoji: '🔋', label: 'Hemat Baterai HP', targetNodeId: 'tips_battery'),
      ChipOption(emoji: '🦺', label: 'SOP Keselamatan Site', targetNodeId: 'tips_safety'),
      ChipOption(emoji: '🌧️', label: 'Hadapi Hujan Badai', targetNodeId: 'tips_rain'),
      ChipOption(emoji: '🤝', label: 'Hadapi Klien Kritis', targetNodeId: 'tips_customer'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'tips_battery': ConversationNode(
    id: 'tips_battery',
    mood: 'neutral',
    messages: [
      '🔋 Tips Baterai Awet Seharian Saat Tracing & GPS:\n\n'
        '1️⃣ Aktifkan Mode Gelap (Dark Mode).\n'
        '2️⃣ Turunkan brightness ke 40-50% saat tidak terik.\n'
        '3️⃣ Matikan auto-scan Wi-Fi jika sedang di jalan.\n'
        '4️⃣ Selalu sedia Powerbank fast charging terisi penuh.\n'
        '5️⃣ Hindari meletakkan HP langsung di dashboard motor/mobil yang kena matahari!',
    ],
    chips: [
      ChipOption(emoji: '🦺', label: 'Tips Keselamatan', targetNodeId: 'tips_safety'),
      ChipOption(emoji: '🚗', label: 'Fleet Log Kendaraan', targetNodeId: 'fleet_view'),
      ChipOption(emoji: '◀️', label: 'Tips Lain', targetNodeId: 'menu_field_tips'),
    ],
  ),

  'tips_safety': ConversationNode(
    id: 'tips_safety',
    mood: 'concerned',
    messages: [
      '🦺 Standar Keselamatan Kerja Lapangan:\n\n'
        '• Wajib helm safety & sepatu sol karet anti slip.\n'
        '• Pasang Full-Body Harness saat berada di ketinggian > 1.8 meter.\n'
        '• Cek tegangan dengan testpen sebelum menyentuh kabel terbuka.\n'
        '• Selalu beri tahu rekan satu tim posisi kerjamu.',
    ],
    chips: [
      ChipOption(emoji: '🚨', label: 'Prosedur Darurat K3', targetNodeId: 'emergency'),
      ChipOption(emoji: '🌧️', label: 'Tips Hadapi Cuaca Buruk', targetNodeId: 'tips_rain'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'tips_rain': ConversationNode(
    id: 'tips_rain',
    mood: 'concerned',
    messages: [
      '🌧️ Antisipasi Hujan Badai di Lapangan:\n\n'
        '• Amankan toolset dan gadget ke dalam dry-bag waterproof.\n'
        '• JANGAN berteduh di bawah tiang pemancar, pohon tinggi, atau tiang listrik.\n'
        '• Utamakan keselamatan nyawa daripada memaksakan instalasi saat petir aktif.\n'
        '• Dokumentasikan kondisi cuaca sebagai justifikasi di log tugas OnTime.',
    ],
    chips: [
      ChipOption(emoji: '📋', label: 'Update Status Tugas', targetNodeId: 'task_view'),
      ChipOption(emoji: '🤝', label: 'Tips Komunikasi Klien', targetNodeId: 'tips_customer'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'tips_customer': ConversationNode(
    id: 'tips_customer',
    mood: 'happy',
    messages: [
      '🤝 Menghadapi Klien Kritis di Lokasi:\n\n'
        '1️⃣ Dengarkan keluhan tanpa memotong (tunjukkan empati).\n'
        '2️⃣ Jangan menyalahkan rekan tim atau divisi lain di depan klien.\n'
        '3️⃣ Berikan perkiraan waktu perbaikan yang realistis.\n'
        '4️⃣ Lakukan demo pengecekan bersama klien setelah pekerjaan selesai.\n\n'
        'Klien yang puas adalah kunci skor KPI tinggi! ⭐',
    ],
    chips: [
      ChipOption(emoji: '⭐', label: 'Lihat KPI Saya', targetNodeId: 'kpi_view'),
      ChipOption(emoji: '💡', label: 'Tips Lain', targetNodeId: 'menu_field_tips'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  RAMALAN KEBERUNTUNGAN HARIAN (FORTUNE)     │
  // └─────────────────────────────────────────────┘
  'daily_fortune': ConversationNode(
    id: 'daily_fortune',
    mood: 'excited',
    messages: [
      '🥠 Selamat datang di Fortune Cookie Artacom!\nPilih elemen energi kamu hari ini untuk melihat ramalan keberuntungan kerjamu! ✨',
    ],
    chips: [
      ChipOption(emoji: '🔥', label: 'Elemen Api (Semangat)', targetNodeId: 'fortune_fire'),
      ChipOption(emoji: '💧', label: 'Elemen Air (Tenang)', targetNodeId: 'fortune_water'),
      ChipOption(emoji: '🌱', label: 'Elemen Tanah (Teliti)', targetNodeId: 'fortune_earth'),
      ChipOption(emoji: '🌪️', label: 'Elemen Udara (Cepat)', targetNodeId: 'fortune_air'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'fortune_fire': ConversationNode(
    id: 'fortune_fire',
    mood: 'excited',
    messages: [
      '🔥 RAMALAN ELEMEN API 🔥\n\n'
        'Hari ini energimu meluap-luap! Sangat cocok untuk menyelesaikan tugas-tugas berat yang lama tertunda.\n\n'
        '🎯 Angka Hoki: 8 & 19\n'
        '🎨 Warna Keberuntungan: Merah Maroon OnTime\n'
        '⚠️ Hindari: Berdebat sengit di grup WhatsApp kantor!',
    ],
    chips: [
      ChipOption(emoji: '🥠', label: 'Pilih Elemen Lain', targetNodeId: 'daily_fortune'),
      ChipOption(emoji: '💪', label: 'Ambil Motivasi', targetNodeId: 'motivation'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'fortune_water': ConversationNode(
    id: 'fortune_water',
    mood: 'happy',
    messages: [
      '💧 RAMALAN ELEMEN AIR 💧\n\n'
        'Pikiranmu jernih dan tenang. Komunikasi dengan atasan atau rekan kerja akan berjalan sangat mulus hari ini.\n\n'
        '🎯 Angka Hoki: 3 & 27\n'
        '🎨 Warna Keberuntungan: Biru Cerah\n'
        '💡 Saran: Ajak ngobrol santai rekan kerja yang terlihat murung!',
    ],
    chips: [
      ChipOption(emoji: '🥠', label: 'Pilih Elemen Lain', targetNodeId: 'daily_fortune'),
      ChipOption(emoji: '☕', label: 'Ngopi Dulu', targetNodeId: 'menu_food_coffee'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'fortune_earth': ConversationNode(
    id: 'fortune_earth',
    mood: 'happy',
    messages: [
      '🌱 RAMALAN ELEMEN TANAH 🌱\n\n'
        'Ketelitianmu berada di level maksimal. Hari yang sempurna untuk cek dokumen, klaim reimburse, atau audit inventaris.\n\n'
        '🎯 Angka Hoki: 7 & 44\n'
        '🎨 Warna Keberuntungan: Hijau Zamrud\n'
        '💡 Saran: Struk pengeluaran jangan sampai lecek atau hilang ya!',
    ],
    chips: [
      ChipOption(emoji: '🧾', label: 'Menu Reimburse', targetNodeId: 'menu_reimburse'),
      ChipOption(emoji: '🥠', label: 'Pilih Elemen Lain', targetNodeId: 'daily_fortune'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'fortune_air': ConversationNode(
    id: 'fortune_air',
    mood: 'excited',
    messages: [
      '🌪️ RAMALAN ELEMEN UDARA 🌪️\n\n'
        'Kecepatan berpikirmu luar biasa! Masalah tak terduga bisa langsung terpecahkan dengan ide brilian out-of-the-box.\n\n'
        '🎯 Angka Hoki: 5 & 12\n'
        '🎨 Warna Keberuntungan: Putih Perak\n'
        '💡 Saran: Tulis ide-ide mendadakmu di memo sebelum lupa!',
    ],
    chips: [
      ChipOption(emoji: '🥠', label: 'Pilih Elemen Lain', targetNodeId: 'daily_fortune'),
      ChipOption(emoji: '🏆', label: 'Teka-Teki Game', targetNodeId: 'riddle_lvl1'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  RELAKSASI PERNAPASAN 4-7-8 BERTAHAP        │
  // └─────────────────────────────────────────────┘
  'relax_breath_start': ConversationNode(
    id: 'relax_breath_start',
    mood: 'concerned',
    messages: [
      '🧘 Latihan Pernapasan 4-7-8 (Step 1/3)\n\n'
        'Duduk tegak, rilekskan bahu.\n\n'
        '🌬️ Tarik napas perlahan melalui hidung selama 4 detik...\n\n'
        '1... 2... 3... 4...',
    ],
    chips: [
      ChipOption(emoji: '✅', label: 'Sudah Tarik Napas (Lanjut Tahan)', targetNodeId: 'relax_breath_hold'),
      ChipOption(emoji: '🏠', label: 'Batal, Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'relax_breath_hold': ConversationNode(
    id: 'relax_breath_hold',
    mood: 'neutral',
    messages: [
      '🧘 Latihan Pernapasan 4-7-8 (Step 2/3)\n\n'
        '⏱️ Tahan napasmu selama 7 detik...\n\n'
        'Rasakan ketenangan menjalar ke seluruh tubuh.\n'
        '1... 2... 3... 4... 5... 6... 7...',
    ],
    chips: [
      ChipOption(emoji: '✅', label: 'Sudah Tahan (Lanjut Hembuskan)', targetNodeId: 'relax_breath_exhale'),
      ChipOption(emoji: '🔄', label: 'Ulangi Tarik Napas', targetNodeId: 'relax_breath_start'),
    ],
  ),

  'relax_breath_exhale': ConversationNode(
    id: 'relax_breath_exhale',
    mood: 'happy',
    messages: [
      '🧘 Latihan Pernapasan 4-7-8 (Step 3/3)\n\n'
        '💨 Hembuskan perlahan lewat mulut dengan suara desah lembut selama 8 detik...\n\n'
        'Lepaskan semua beban dan ketegangan pikiranmu...\n'
        '1... 2... 3... 4... 5... 6... 7... 8...',
    ],
    chips: [
      ChipOption(emoji: '✨', label: 'Selesai! Terasa Lebih Segar', targetNodeId: 'relax_breath_done'),
      ChipOption(emoji: '🔄', label: 'Lakukan 1 Putaran Lagi', targetNodeId: 'relax_breath_start'),
    ],
  ),

  'relax_breath_done': ConversationNode(
    id: 'relax_breath_done',
    mood: 'happy',
    messages: [
      '🎉 Luar biasa! Detak jantungmu lebih stabil dan pikiranmu sekarang jauh lebih fokus.\n\n'
        'Kamu siap melanjutkan hari dengan energi baru! Mau lanjut ke mana nih?',
    ],
    chips: [
      ChipOption(emoji: '☕', label: 'Cari Kopi / Camilan', targetNodeId: 'menu_food_coffee'),
      ChipOption(emoji: '📋', label: 'Kembali Kerja (Tugas)', targetNodeId: 'task_view'),
      ChipOption(emoji: '😂', label: 'Mau Humor Santai', targetNodeId: 'jokes_menu'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  TEKA-TEKI BERTINGKAT (MULTI-LEVEL RIDDLE)   │
  // └─────────────────────────────────────────────┘
  'riddle_lvl1': ConversationNode(
    id: 'riddle_lvl1',
    mood: 'excited',
    messages: [
      '🧩 Tantangan Teka-Teki Level 1 (Mudah):\n\n'
        '"Aku selalu di depan matamu setiap hari, tapi kamu tidak bisa melihatku tanpa aku membantumu melihat hal lain. Siapakah aku?"',
    ],
    chips: [
      ChipOption(emoji: '👓', label: 'Kacamata', targetNodeId: 'riddle_lvl2'),
      ChipOption(emoji: '📱', label: 'Layar HP', targetNodeId: 'riddle_lvl1_wrong'),
      ChipOption(emoji: '💡', label: 'Lampu Bohlam', targetNodeId: 'riddle_lvl1_wrong'),
      ChipOption(emoji: '🏠', label: 'Menyerah, Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'riddle_lvl1_wrong': ConversationNode(
    id: 'riddle_lvl1_wrong',
    mood: 'concerned',
    messages: [
      '❌ Kurang tepat! Coba ingat benda yang nangkring di hidung dan telinga. Mau coba lagi?',
    ],
    chips: [
      ChipOption(emoji: '🔄', label: 'Coba Lagi Level 1', targetNodeId: 'riddle_lvl1'),
      ChipOption(emoji: '😂', label: 'Jokes Biasa Aja', targetNodeId: 'jokes_menu'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'riddle_lvl2': ConversationNode(
    id: 'riddle_lvl2',
    mood: 'excited',
    messages: [
      '✅ BENAR! Kacamata! 🎉\n\n'
        '🧩 Tantangan Teka-Teki Level 2 (Sedang):\n\n'
        '"Makin banyak diambil, makin besar jadinya. Benda apakah aku?"',
    ],
    chips: [
      ChipOption(emoji: '🕳️', label: 'Lubang / Galian', targetNodeId: 'riddle_lvl3'),
      ChipOption(emoji: '💰', label: 'Uang Tabungan', targetNodeId: 'riddle_lvl2_wrong'),
      ChipOption(emoji: '📸', label: 'Foto Selfie', targetNodeId: 'riddle_lvl2_wrong'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'riddle_lvl2_wrong': ConversationNode(
    id: 'riddle_lvl2_wrong',
    mood: 'concerned',
    messages: [
      '❌ Salah! Petunjuk: Bayangkan kamu lagi mencangkul tanah... tanahnya diambil, lalu apa yang terbentuk?',
    ],
    chips: [
      ChipOption(emoji: '🔄', label: 'Coba Lagi Level 2', targetNodeId: 'riddle_lvl2'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'riddle_lvl3': ConversationNode(
    id: 'riddle_lvl3',
    mood: 'excited',
    messages: [
      '✅ TEPAT SEKALI! Lubang! 🕳️👏\n\n'
        '🧩 Tantangan Terakhir Level 3 (Master):\n\n'
        '"Aku punya kota tanpa rumah, punya hutan tanpa pohon, dan punya laut tanpa ikan. Siapakah aku?"',
    ],
    chips: [
      ChipOption(emoji: '🗺️', label: 'Peta (Map)', targetNodeId: 'riddle_win'),
      ChipOption(emoji: '🌐', label: 'Internet', targetNodeId: 'riddle_lvl3_wrong'),
      ChipOption(emoji: '🌌', label: 'Mimpi', targetNodeId: 'riddle_lvl3_wrong'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'riddle_lvl3_wrong': ConversationNode(
    id: 'riddle_lvl3_wrong',
    mood: 'concerned',
    messages: [
      '❌ Masih salah nih! Petunjuk: Digunakan pelaut zaman dulu atau dibuka di Google Maps versi kertas!',
    ],
    chips: [
      ChipOption(emoji: '🔄', label: 'Coba Lagi Level 3', targetNodeId: 'riddle_lvl3'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'riddle_win': ConversationNode(
    id: 'riddle_win',
    mood: 'excited',
    messages: [
      '🏆 LUAR BIASA! KAMU MENANG! 🏆\n\n'
        'Jawabannya adalah PETA (Map)!\n\n'
        'Kamu berhasil menamatkan ketiga level teka-teki Artacom Bot! Daya logika dan intuisimu sungguh tajam! 🌟👏',
    ],
    chips: [
      ChipOption(emoji: '🧠', label: 'Coba Quiz Lain', targetNodeId: 'quiz_menu'),
      ChipOption(emoji: '🥠', label: 'Cek Ramalan Harian', targetNodeId: 'daily_fortune'),
      ChipOption(emoji: '☕', label: 'Traktir Diri Ngopi', targetNodeId: 'menu_food_coffee'),
      ChipOption(emoji: '🏠', label: 'Kembali ke Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  📊 RINGKASAN DATA APLIKASI (SUMMARIES)     │
  // └─────────────────────────────────────────────┘

  'summary_all': ConversationNode(
    id: 'summary_all',
    mood: 'happy',
    dataAction: 'fetch_all_summary',
    messages: [
      '📊 RINGKASAN DATA HRMS KAMU 📊\n\n'
        '🕒 Absensi Hari Ini: Masuk {check_in} | Pulang {check_out}\n'
        '🏖️ Sisa Cuti: {leave_remaining} hari (Terpakai {leave_used} hari)\n'
        '💰 Status Gaji: {salary_status} ({salary_period})\n'
        '📋 Tugas Aktif: {tasks_pending} tugas menunggu (Total {tasks_total})\n'
        '⏳ Lembur: {overtime_count} pengajuan tercatat\n\n'
        'Semua data tersinkronisasi! Pilih detail di bawah jika ingin info lebih lengkap 😊',
      '📈 KILAS DATA PRIBADI KAMU 📈\n\n'
        '• Kehadiran: Masuk {check_in} / Keluar {check_out}\n'
        '• Kuota Cuti: Masih aman {leave_remaining} hari tersisa\n'
        '• Slip & Gaji: {salary_status}\n'
        '• Progress Tugas: {tasks_pending} tugas belum selesai\n'
        '• Lembur: {overtime_count} data tersimpan\n\n'
        'Tetap semangat dan jaga produktivitas ya! Butuh info spesifik? 🚀',
    ],
    chips: [
      ChipOption(emoji: '⏱️', label: 'Detail Absensi', targetNodeId: 'summary_attendance'),
      ChipOption(emoji: '🏖️', label: 'Detail Cuti', targetNodeId: 'summary_leave'),
      ChipOption(emoji: '💰', label: 'Detail Gaji', targetNodeId: 'summary_salary'),
      ChipOption(emoji: '📋', label: 'Detail Tugas', targetNodeId: 'summary_task'),
      ChipOption(emoji: '⏳', label: 'Detail Lembur', targetNodeId: 'summary_overtime'),
      ChipOption(emoji: '📈', label: 'Review KPI', targetNodeId: 'summary_kpi'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'summary_attendance': ConversationNode(
    id: 'summary_attendance',
    mood: 'neutral',
    dataAction: 'fetch_attendance',
    messages: [
      '🕒 RINGKASAN ABSENSI HARI INI 🕒\n\n'
        '📌 Status: {status}\n'
        '⏰ Jam Masuk: {check_in}\n'
        '🚪 Jam Pulang: {check_out}\n\n'
        '💡 Tips: Pastikan GPS aktif dan sinyal stabil saat melakukan absensi ya! Semangat menjalani hari! 🎯',
      '📸 STATUS KEHADIRANMU HARI INI 📸\n\n'
        '• Status Kehadiran: {status}\n'
        '• Waktu Check-In: {check_in}\n'
        '• Waktu Check-Out: {check_out}\n\n'
        'Kerja bagus! Selalu patuhi jam kerja agar catatan kedisiplinanmu tetap berkilau ⭐',
    ],
    chips: [
      ChipOption(emoji: '📊', label: 'Semua Ringkasan', targetNodeId: 'summary_all'),
      ChipOption(emoji: '🏖️', label: 'Cek Sisa Cuti', targetNodeId: 'summary_leave'),
      ChipOption(emoji: '⏳', label: 'Cek Lembur', targetNodeId: 'summary_overtime'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'summary_leave': ConversationNode(
    id: 'summary_leave',
    mood: 'happy',
    dataAction: 'fetch_leave',
    messages: [
      '🏖️ RINGKASAN KUOTA CUTI 🏖️\n\n'
        '🎯 Total Hak Cuti: {total} hari\n'
        '✅ Sudah Digunakan: {used} hari\n'
        '✨ Sisa Cuti Aktif: {remaining} hari\n'
        '⏳ Menunggu Persetujuan: {pending} pengajuan\n\n'
        'Ingat, istirahat dan liburan penting untuk menjaga stamina kerja tetap prima! Rencanakan liburanmu dengan cermat 🌴',
      '🌴 STATUS CUTI & IZIN 🌴\n\n'
        'Kamu masih memiliki {remaining} hari cuti tahunan yang bisa diambil kapan saja! Dari kuota {total} hari, baru terpakai {used} hari.\n\n'
        'Kapan mau rehat sejenak dari rutinitas kantor? 😊✈️',
    ],
    chips: [
      ChipOption(emoji: '📊', label: 'Semua Ringkasan', targetNodeId: 'summary_all'),
      ChipOption(emoji: '💰', label: 'Cek Status Gaji', targetNodeId: 'summary_salary'),
      ChipOption(emoji: '📋', label: 'Cek Tugas Aktif', targetNodeId: 'summary_task'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'summary_salary': ConversationNode(
    id: 'summary_salary',
    mood: 'happy',
    dataAction: 'fetch_salary',
    messages: [
      '💰 RINGKASAN GAJI & SLIP 💰\n\n'
        '📅 Periode: {period}\n'
        '📊 Status Pembayaran: {status}\n\n'
        'Slip gaji sudah terintegrasi dan bisa diakses secara aman di aplikasi. Gajian aman, hati tenang 🌟',
      '💵 INFORMASI PENGGAJIAN 💵\n\n'
        'Status gaji periode {period} adalah {status}.\n\n'
        'Pastikan selalu memeriksa rincian slip untuk rincian tunjangan, insentif, dan potongan BPJS secara berkala 🧾',
    ],
    chips: [
      ChipOption(emoji: '📊', label: 'Semua Ringkasan', targetNodeId: 'summary_all'),
      ChipOption(emoji: '🏖️', label: 'Cek Sisa Cuti', targetNodeId: 'summary_leave'),
      ChipOption(emoji: '⏳', label: 'Cek Jam Lembur', targetNodeId: 'summary_overtime'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'summary_task': ConversationNode(
    id: 'summary_task',
    mood: 'neutral',
    dataAction: 'fetch_task',
    messages: [
      '📋 RINGKASAN TUGAS & PROJEK 📋\n\n'
        '📌 Total Tugas: {total}\n'
        '⏳ Menunggu / Sedang Jalan: {pending} tugas\n'
        '✅ Selesai: {completed} tugas\n\n'
        'Selesaikan tugas prioritas terlebih dahulu! Fokus pada satu hal bikin pekerjaan lebih cepat tuntas 🎯',
      '📌 STATUS TUGAS KERJA 📌\n\n'
        'Ada {pending} tugas aktif yang menunggu sentuhan hebatmu dari total {total} tugas tercatat.\n\n'
        'Semangat menuntaskan hari ini! Jangan lupa update status tugas ya setelah dikerjakan! 💪',
    ],
    chips: [
      ChipOption(emoji: '📊', label: 'Semua Ringkasan', targetNodeId: 'summary_all'),
      ChipOption(emoji: '📈', label: 'Review KPI', targetNodeId: 'summary_kpi'),
      ChipOption(emoji: '⏱️', label: 'Cek Absensi', targetNodeId: 'summary_attendance'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'summary_overtime': ConversationNode(
    id: 'summary_overtime',
    mood: 'happy',
    dataAction: 'fetch_overtime',
    messages: [
      '⏳ RINGKASAN LEMBUR (OVERTIME) ⏳\n\n'
        '📊 Total Pengajuan: {total}\n'
        '✅ Disetujui: {approved}\n'
        '⏳ Menunggu Review: {pending}\n\n'
        'Lembur yang produktif selalu dihargai perusahaan! Tetap jaga pola makan dan tidur agar tidak drop ya! 🥛',
      '⏰ STATUS PENGAJUAN LEMBUR ⏰\n\n'
        'Tercatat {total} pengajuan lembur di sistem ({approved} disetujui, {pending} pending).\n\n'
        'Terima kasih atas dedikasi dan kontribusi kerja kerasmu untuk tim dan perusahaan! 👏',
    ],
    chips: [
      ChipOption(emoji: '📊', label: 'Semua Ringkasan', targetNodeId: 'summary_all'),
      ChipOption(emoji: '💰', label: 'Cek Gaji & Slip', targetNodeId: 'summary_salary'),
      ChipOption(emoji: '🏖️', label: 'Cek Sisa Cuti', targetNodeId: 'summary_leave'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'summary_kpi': ConversationNode(
    id: 'summary_kpi',
    mood: 'excited',
    messages: [
      '📈 RINGKASAN KINERJA & KPI 📈\n\n'
        'Evaluasi KPI mengukur capaian target, ketepatan waktu, dan kontribusi kerja tim kamu.\n\n'
        '💡 3 Kiat Mendongkrak Nilai KPI:\n'
        '1. Absensi tepat waktu tanpa alpa/terlambat\n'
        '2. Tuntaskan tugas tepat waktu sesuai spesifikasi\n'
        '3. Proaktif berkomunikasi dan berkolaborasi\n\n'
        'Kamu sudah berproses luar biasa, yuk pertahankan ritme terbaikmu! 🌟',
      '⭐ KILAS KPI & PERFORMA ⭐\n\n'
        'Performa kerjamu selalu dinilai secara objektif dan berkala.\n\n'
        'Terus tunjukkan inisiatif positif dan integritas kerja tinggi di setiap amanah yang diemban! Sukses selalu! 🚀',
    ],
    chips: [
      ChipOption(emoji: '📊', label: 'Semua Ringkasan', targetNodeId: 'summary_all'),
      ChipOption(emoji: '📋', label: 'Cek Tugas Kerja', targetNodeId: 'summary_task'),
      ChipOption(emoji: '⏱️', label: 'Cek Absensi', targetNodeId: 'summary_attendance'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ┌─────────────────────────────────────────────┐
  // │  🎮 INTERAKTIF & MINI GAMES                 │
  // └─────────────────────────────────────────────┘

  // ── SUIT (BATU GUNTING KERTAS) ────────────────
  'mini_game_rps': ConversationNode(
    id: 'mini_game_rps',
    mood: 'excited',
    messages: [
      '✊✌️✋ SUIT MELAWAN ARTACOM BOT!\n\n'
        'Ayo tes siapa yang lebih hoki hari ini! Aku sudah menentukan pilihanku dalam memori rahasia... 🤫\n\n'
        'Sekarang giliranmu, pilih senjatamu di bawah:',
      '🎮 GAME BATU GUNTING KERTAS 🎮\n\n'
        'Suit time! Bot vs Kamu!\n\n'
        'Siapakah yang bakal menang ronde ini? Tentukan pilihanmu sekarang:',
    ],
    chips: [
      ChipOption(emoji: '🪨', label: 'Batu', targetNodeId: 'rps_rock'),
      ChipOption(emoji: '✂️', label: 'Gunting', targetNodeId: 'rps_scissors'),
      ChipOption(emoji: '📄', label: 'Kertas', targetNodeId: 'rps_paper'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'menu_fun'),
    ],
  ),

  'rps_rock': ConversationNode(
    id: 'rps_rock',
    mood: 'excited',
    messages: [
      '🤖 Aku pilih: GUNTING ✂️!\n\n'
        '🪨 Batu kamu berhasil menghancurkan guntingku!\n\n'
        '🎉 KAMU MENANG! Hoki kamu lagi gacor banget hari ini! Mau tantang aku lagi? 👏',
      '🤖 Aku pilih: KERTAS 📄!\n\n'
        '📄 Kertasku membungkus batumu rapat-rapat!\n\n'
        '😏 YEEEY AKU MENANG! Jangan berkecil hati, ayo balas dendam di ronde berikutnya! 😜',
      '🤖 Aku pilih: BATU 🪨!\n\n'
        '🪨 vs 🪨\n\n'
        '🤝 HASIL SERI (DRAW)! Pikiran kita sefrekuensi banget nih! Ayo suit ulang! 😆',
    ],
    chips: [
      ChipOption(emoji: '🔄', label: 'Main Lagi!', targetNodeId: 'mini_game_rps'),
      ChipOption(emoji: '🪙', label: 'Coba Lempar Koin', targetNodeId: 'mini_game_coin'),
      ChipOption(emoji: '🎯', label: 'Tantangan Harian', targetNodeId: 'challenge_daily'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'rps_scissors': ConversationNode(
    id: 'rps_scissors',
    mood: 'excited',
    messages: [
      '🤖 Aku pilih: KERTAS 📄!\n\n'
        '✂️ Guntingmu memotong kertasku berkeping-keping!\n\n'
        '🔥 KAMU MENANG! Mantap betul insting dan refleksmu! 💯',
      '🤖 Aku pilih: BATU 🪨!\n\n'
        '🪨 Batuku meremukkan guntingmu!\n\n'
        '😎 AKU MENANG! Poin untuk Artacom Bot! Mau adu sekali lagi? 🤖✨',
      '🤖 Aku pilih: GUNTING ✂️!\n\n'
        '✂️ vs ✂️\n\n'
        '🤝 HASIL SERI! Sama-sama gunting! Gregetan kan? Ayo lempar pilihan lagi! 😆',
    ],
    chips: [
      ChipOption(emoji: '🔄', label: 'Main Lagi!', targetNodeId: 'mini_game_rps'),
      ChipOption(emoji: '🪙', label: 'Coba Lempar Koin', targetNodeId: 'mini_game_coin'),
      ChipOption(emoji: '🎯', label: 'Tantangan Harian', targetNodeId: 'challenge_daily'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'rps_paper': ConversationNode(
    id: 'rps_paper',
    mood: 'excited',
    messages: [
      '🤖 Aku pilih: BATU 🪨!\n\n'
        '📄 Kertasmu membungkus batuku!\n\n'
        '🏆 KAMU MENANG! Prediksi jitumu luar biasa! 🌟',
      '🤖 Aku pilih: GUNTING ✂️!\n\n'
        '✂️ Guntingku memotong kertasmu!\n\n'
        '😜 AKU MENANG! AI lebih cerdik kali ini hehe! Coba balas kalau bisa! 🤖🔥',
      '🤖 Aku pilih: KERTAS 📄!\n\n'
        '📄 vs 📄\n\n'
        '🤝 HASIL SERI! Wah sama-sama kertas! Ayo tanding lagi! 😂',
    ],
    chips: [
      ChipOption(emoji: '🔄', label: 'Main Lagi!', targetNodeId: 'mini_game_rps'),
      ChipOption(emoji: '🪙', label: 'Coba Lempar Koin', targetNodeId: 'mini_game_coin'),
      ChipOption(emoji: '🎯', label: 'Tantangan Harian', targetNodeId: 'challenge_daily'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ── LEMPAR KOIN ───────────────────────────────
  'mini_game_coin': ConversationNode(
    id: 'mini_game_coin',
    mood: 'excited',
    messages: [
      '🪙 LEMPAR KOIN KEPUTUSAN 🪙\n\n'
        'Lagi bimbang milih menu makan siang, urutan tugas, atau sekadar tes hoki?\n\n'
        'Koin dilempar ke udara... TING! 💫\n\n'
        '🎉 Hasilnya: ANGKA (10)! 🔟\n\n'
        'Semesta sudah memberi petunjuk! Siap ambil tindakan?',
      '🪙 LEMPAR KOIN KEPUTUSAN 🪙\n\n'
        'Koin berputar kencang di udara... WUUUSH! 🌀\n\n'
        '🎉 Hasilnya: GAMBAR (GARUDA)! 🦅\n\n'
        'Keputusan sudah bulat dan mantap! Gas terus pantang mundur! 🚀',
      '🪙 LEMPAR KOIN KEPUTUSAN 🪙\n\n'
        'Koin melayang tinggi dan ditangkap di punggung tangan! ✋\n\n'
        '🎉 Hasilnya: ANGKA! 🔟\n\n'
        'Kalau koin ini mewakili opsi pertamamu, eksekusi sekarang juga! ✨',
      '🪙 LEMPAR KOIN KEPUTUSAN 🪙\n\n'
        'Koin jatuh memantul di meja... KLIK KLIK KLIK! 🎯\n\n'
        '🎉 Hasilnya: GAMBAR! 🦅\n\n'
        'Insting keberuntungan berpihak padamu! Semoga lancar jaya ya!',
    ],
    chips: [
      ChipOption(emoji: '🔄', label: 'Lempar Lagi!', targetNodeId: 'mini_game_coin'),
      ChipOption(emoji: '✊', label: 'Main Suit', targetNodeId: 'mini_game_rps'),
      ChipOption(emoji: '🎯', label: 'Tantangan Harian', targetNodeId: 'challenge_daily'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ── TANTANGAN HARIAN ──────────────────────────
  'challenge_daily': ConversationNode(
    id: 'challenge_daily',
    mood: 'excited',
    messages: [
      '🎯 TANTANGAN HARIAN KAMU 🎯\n\n'
        '"Katakan terima kasih atau beri pujian tulus ke setidaknya 2 rekan kerja hari ini!"\n\n'
        'Hal sederhana tapi efeknya bisa bikin suasana kerja satu divisi jadi hangat dan penuh energi positif! Berani coba? 😊',
      '🎯 TANTANGAN PRODUKTIVITAS 🎯\n\n'
        '"Rapikan meja kerjamu dan buang kertas atau bungkus yang sudah tidak terpakai!"\n\n'
        'Meja kerja yang rapi terbukti meningkatkan konsentrasi dan mood kerja hingga 25%. Luangkan 3 menit sekarang! 🧹✨',
      '🎯 TANTANGAN HIDRASI SEHAT 🎯\n\n'
        '"Habiskan 1 botol air mineral ukuran sedang sebelum jam istirahat siang nanti!"\n\n'
        'Otak kita butuh cairan yang cukup agar tidak mudah mengantuk dan sakit kepala. Ayo teguk airmu sekarang! 💧',
      '🎯 TANTANGAN DIGITAL DETOX 🎯\n\n'
        '"Saat makan siang nanti, simpan HP selama 15 menit penuh dan nikmati makananmu sambil mengobrol santai!"\n\n'
        'Refresh mata dan otak dari paparan layar kaca sejenak 📵🍲',
      '🎯 TANTANGAN SOLIDARITAS TIM 🎯\n\n'
        '"Tawarkan bantuan kecil ke rekan tim yang kelihatannya sedang repot atau dikejar deadline hari ini."\n\n'
        'Solidaritas tim terbaik dibangun dari kepedulian-kepedulian kecil seperti ini! 🤝🌟',
    ],
    chips: [
      ChipOption(emoji: '🎯', label: 'Tantangan Lain!', targetNodeId: 'challenge_daily'),
      ChipOption(emoji: '🤝', label: 'Icebreaker Seru', targetNodeId: 'colleague_icebreaker'),
      ChipOption(emoji: '💪', label: 'Butuh Motivasi', targetNodeId: 'motivation'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ── TRIVIA INDONESIA ──────────────────────────
  'trivia_indonesia': ConversationNode(
    id: 'trivia_indonesia',
    mood: 'excited',
    messages: [
      '🇮🇩 TRIVIA INDONESIA 🇮🇩\n\n'
        'Tahukah kamu? Indonesia adalah negara kepulauan terbesar di dunia dengan lebih dari 17.500 pulau!\n\n'
        'Kalau kamu menjelajahi 1 pulau per hari, butuh waktu hampir 48 tahun untuk mendatangi semuanya! 🏝️⛵',
      '🇮🇩 TRIVIA INDONESIA 🇮🇩\n\n'
        'Danau Toba di Sumatera Utara adalah danau vulkanik terbesar di dunia!\n\n'
        'Letusan Gunung Toba purba sekitar 74.000 tahun lalu tercatat sebagai salah satu letusan gunung terdahsyat dalam sejarah bumi. 🌋🌊',
      '🇮🇩 TRIVIA INDONESIA 🇮🇩\n\n'
        'Indonesia memiliki keanekaragaman bahasa daerah kedua terbanyak di dunia dengan lebih dari 718 bahasa daerah yang unik!\n\n'
        'Kaya budaya, kaya kearifan lokal! Bangga berbangsa Indonesia! 🗣️🇲🇨',
      '🇮🇩 TRIVIA INDONESIA 🇮🇩\n\n'
        'Bunga raksasa terbesar di dunia, Rafflesia arnoldii, berasal dari hutan tropis Indonesia!\n\n'
        'Diameternya bisa mencapai lebih dari 1 meter tanpa daun, akar, maupun batang sejati! 🌸',
      '🇮🇩 TRIVIA INDONESIA 🇮🇩\n\n'
        'Komodo adalah kadal purba terbesar di dunia yang masih hidup dan HANYA ada di Indonesia (Taman Nasional Komodo)!\n\n'
        'Panjangnya bisa mencapai 3 meter dengan berat lebih dari 70 kg! 🦎',
    ],
    chips: [
      ChipOption(emoji: '🇮🇩', label: 'Trivia Lain!', targetNodeId: 'trivia_indonesia'),
      ChipOption(emoji: '📜', label: 'Peribahasa Hari Ini', targetNodeId: 'wisdom_daily'),
      ChipOption(emoji: '💡', label: 'Fakta Menarik', targetNodeId: 'facts_menu'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ── PERIBAHASA NUSANTARA HARI INI ─────────────
  'wisdom_daily': ConversationNode(
    id: 'wisdom_daily',
    mood: 'excited',
    messages: [
      '📜 PERIBAHASA HARI INI 📜\n\n'
        '"Sedikit-sedikit, lama-lama menjadi bukit."\n\n'
        '💡 Makna di Dunia Kerja:\n'
        'Jangan remehkan tugas kecil atau progress harian. Kumpulan usaha konsisten setiap hari adalah fondasi kesuksesan project besar! 🏔️✨',
      '📜 PERIBAHASA HARI INI 📜\n\n'
        '"Di mana bumi dipijak, di situ langit dijunjung."\n\n'
        '💡 Makna di Dunia Kerja:\n'
        'Pentingnya adaptasi dan menghormati budaya kerja serta rekan tim di manapun kita bertugas. Fleksibilitas adalah kunci profesionalisme! 🤝🌐',
      '📜 PERIBAHASA HARI INI 📜\n\n'
        '"Berat sama dipikul, ringan sama dijinjing."\n\n'
        '💡 Makna di Dunia Kerja:\n'
        'Kekuatan utama tim ada pada solidaritas. Jangan ragu berbagi beban dan saling menopang saat deadline mendekat! 👥💪',
      '📜 PERIBAHASA HARI INI 📜\n\n'
        '"Air beriak tanda tak dalam, air tenang menghanyutkan."\n\n'
        '💡 Makna di Dunia Kerja:\n'
        'Orang yang benar-benar berkompeten biasanya tenang, tidak banyak sesumbar, namun hasil kerjanya selalu memukau. Kualitas berbicara lebih keras dari kata-kata! 🌊💎',
    ],
    chips: [
      ChipOption(emoji: '📜', label: 'Peribahasa Lain!', targetNodeId: 'wisdom_daily'),
      ChipOption(emoji: '🇮🇩', label: 'Trivia Indonesia', targetNodeId: 'trivia_indonesia'),
      ChipOption(emoji: '💪', label: 'Motivasi Semangat', targetNodeId: 'motivation'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ── ENERGY LEVEL TRACKER ──────────────────────
  'energy_check': ConversationNode(
    id: 'energy_check',
    mood: 'neutral',
    messages: [
      '🔋 PENGUKUR LEVEL ENERGI KAMU 🔋\n\n'
        'Jujur ya, berapa persen sisa baterai tubuh & pikiranmu saat ini? Aku siapkan resep pemulihan yang paling pas buatmu!',
      '⚡ CEK STATUS BATERAI DIRI ⚡\n\n'
        'Sebelum tancap gas kerja lagi, yuk cek level energi kamu saat ini:',
    ],
    chips: [
      ChipOption(emoji: '🟢', label: '100% On Fire!', targetNodeId: 'energy_100'),
      ChipOption(emoji: '🟡', label: '60% Masih Kuat', targetNodeId: 'energy_60'),
      ChipOption(emoji: '🟠', label: '20% Low Batt', targetNodeId: 'energy_20'),
      ChipOption(emoji: '🔴', label: '0% Butuh Kasur!', targetNodeId: 'energy_0'),
      ChipOption(emoji: '◀️', label: 'Kembali', targetNodeId: 'curhat_menu'),
    ],
  ),

  'energy_100': ConversationNode(
    id: 'energy_100',
    mood: 'excited',
    messages: [
      '🟢 ENERGI 100%: MODE BEAST ON! 🔥\n\n'
        'Mantap jiwa! Manfaatkan momentum energi puncak ini untuk babat tugas paling rumit dan prioritas tinggi. Waktu terbaik untuk fokus total! Gas terus! 🚀',
    ],
    chips: [
      ChipOption(emoji: '📋', label: 'Cek Tugas Kerja', targetNodeId: 'summary_task'),
      ChipOption(emoji: '☕', label: 'Jaga Fokus', targetNodeId: 'menu_food_coffee'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'energy_60': ConversationNode(
    id: 'energy_60',
    mood: 'happy',
    messages: [
      '🟡 ENERGI 60%: STABIL TAPI BUTUH MAINTENANCE! ⚖️\n\n'
        'Baterai masih cukup, tapi jangan dipaksa berlebihan. Minum segelas air putih, regangkan punggung, dan kerjakan tugas bertahap. Kamu aman terkendali! 😊',
    ],
    chips: [
      ChipOption(emoji: '🧘', label: 'Relaksasi Napas', targetNodeId: 'relax_breath_start'),
      ChipOption(emoji: '☕', label: 'Cari Camilan/Kopi', targetNodeId: 'menu_food_coffee'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'energy_20': ConversationNode(
    id: 'energy_20',
    mood: 'concerned',
    messages: [
      '🟠 ENERGI 20%: LOW BATTERY WARNING! ⚠️\n\n'
        'Jangan forsir otakmu! Tinggalkan layar sebentar, jalan santai 2 menit, cuci muka dengan air segar, atau seduh teh hangat. Recharge sejenak agar terhindar dari burnout! 🪫⚡',
    ],
    chips: [
      ChipOption(emoji: '🌈', label: 'Mood Booster', targetNodeId: 'mood_booster'),
      ChipOption(emoji: '😂', label: 'Jokes Lucu', targetNodeId: 'jokes_menu'),
      ChipOption(emoji: '🌴', label: 'Cek Sisa Cuti', targetNodeId: 'summary_leave'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  'energy_0': ConversationNode(
    id: 'energy_0',
    mood: 'sleepy',
    messages: [
      '🔴 ENERGI 0%: CRITICAL SLEEP NEEDED! 💤\n\n'
        'Kamu sudah berjuang luar biasa hari ini. Jangan paksakan multitasking. Tuntaskan hal wajib dan begitu jam pulang tiba, langsung istirahat total ya. Kesehatanmu yang utama! 💙🛌',
    ],
    chips: [
      ChipOption(emoji: '🌴', label: 'Rencanakan Cuti', targetNodeId: 'summary_leave'),
      ChipOption(emoji: '😌', label: 'Curhat Corner', targetNodeId: 'curhat_menu'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ── MOOD BOOSTER ──────────────────────────────
  'mood_booster': ConversationNode(
    id: 'mood_booster',
    mood: 'excited',
    messages: [
      '🌈 MOOD BOOSTER KILAT! 🌈\n\n'
        'Ingat rumus ini:\n'
        '"Masalah kerjaan itu seperti sinyal HP — kadang hilang, kadang kencang, tapi yang penting paket data kesabaran jangan sampai habis!" 😂📱\n\n'
        'Tersenyumlah, harimu sangat berharga! ✨',
      '🌈 BOOSTER POSITIF! 🌈\n\n'
        'Kamu tidak harus menyelesaikan semua hal sekaligus hari ini. Cukup tuntaskan satu hal kecil dengan baik, lalu rayakan keberhasilan itu! You are doing great! 🌟👏',
      '🌈 FUN FACT PENGHIBUR! 🌈\n\n'
        'Penelitian membuktikan bahwa tertawa 15 menit setara dengan sit-up 50 kali! Jadi kalau lagi mager olahraga, ketawa aja bareng teman kantor! 😆🍿',
    ],
    chips: [
      ChipOption(emoji: '😂', label: 'Jokes Lagi', targetNodeId: 'jokes_menu'),
      ChipOption(emoji: '✊', label: 'Main Suit', targetNodeId: 'mini_game_rps'),
      ChipOption(emoji: '💪', label: 'Motivasi', targetNodeId: 'motivation'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),

  // ── ICEBREAKER DENGAN REKAN KERJA ─────────────
  'colleague_icebreaker': ConversationNode(
    id: 'colleague_icebreaker',
    mood: 'excited',
    messages: [
      '🤝 ICEBREAKER SERU UNTUK TEMAN KANTOR 🤝\n\n'
        'Coba tanyakan ini ke teman sebelah mejamu:\n'
        '"Kalau kamu bisa teleportasi sekarang juga ke mana saja untuk makan siang, kamu mau ke mana?"\n\n'
        'Dijamin bikin obrolan makan siang jadi seru dan penuh tawa! 🍕✈️',
      '🤝 ICEBREAKER SERU UNTUK TEMAN KANTOR 🤝\n\n'
        'Bahan obrolan santai waktu rehat:\n'
        '"Apa lagu andalan yang paling sering kamu putar saat lagi dikejar deadline kerjaan?"\n\n'
        'Bisa nambah playlist Spotify baru bareng rekan kantor nih! 🎧🎵',
      '🤝 ICEBREAKER SERU UNTUK TEMAN KANTOR 🤝\n\n'
        'Tanyakan ini waktu ngopi:\n'
        '"Kalau kantor kita punya budget unlimited untuk fasilitas hiburan, kamu mau request apa? Ruang tidur siang atau barista pribadi?" ☕🛋️',
    ],
    chips: [
      ChipOption(emoji: '🤝', label: 'Pertanyaan Lain', targetNodeId: 'colleague_icebreaker'),
      ChipOption(emoji: '☕', label: 'Rekomendasi Ngopi', targetNodeId: 'menu_food_coffee'),
      ChipOption(emoji: '😂', label: 'Jokes Kantor', targetNodeId: 'joke_office'),
      ChipOption(emoji: '🏠', label: 'Menu Utama', targetNodeId: 'root'),
    ],
  ),
};
