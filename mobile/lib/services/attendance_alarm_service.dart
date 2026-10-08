import 'dart:async';
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_service.dart';

class AttendanceAlarmService {
  static final AttendanceAlarmService _instance =
      AttendanceAlarmService._internal();
  factory AttendanceAlarmService() => _instance;
  AttendanceAlarmService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();
  final AudioPlayer _audioPlayer = AudioPlayer();

  Timer? _checkTimer;
  DateTime? _lastSyncTime;
  bool _isInitialized = false;
  bool _isEnabled = true;
  String _workStartTime = "08:30";
  String _workEndTime = "17:30";

  String? _lastCheckInAlarmKey;
  String? _lastCheckOutAlarmKey;

  bool get isEnabled => _isEnabled;
  String get workStartTime => _workStartTime;
  String get workEndTime => _workEndTime;

  /// Parse any time format ("16:24:00", "16:24", "04:24 PM", "4:24 PM", "8:30") to standard "HH:mm" (24h)
  static String formatToHHmm(String? timeStr, [String defaultTime = "08:30"]) {
    if (timeStr == null || timeStr.trim().isEmpty) return defaultTime;
    final trimmed = timeStr.trim();

    try {
      // 1. Try 12-hour format with AM/PM (e.g. "04:24 PM", "8:30 AM")
      if (trimmed.toLowerCase().contains('am') || trimmed.toLowerCase().contains('pm')) {
        final parsed = DateFormat('h:mm a').parse(trimmed);
        return DateFormat('HH:mm').format(parsed);
      }

      // 2. Try standard 24h split (e.g. "16:24:00" or "8:30" or "16:24")
      final parts = trimmed.split(':');
      if (parts.length >= 2) {
        final hour = int.tryParse(parts[0].trim());
        final min = int.tryParse(parts[1].trim());
        if (hour != null && min != null) {
          final hStr = hour.toString().padLeft(2, '0');
          final mStr = min.toString().padLeft(2, '0');
          return "$hStr:$mStr";
        }
      }
    } catch (e) {
      debugPrint("Error parsing time string '$timeStr': $e");
    }

    if (trimmed.length >= 5) {
      return trimmed.substring(0, 5);
    }
    return defaultTime;
  }

  Future<void> init() async {
    if (_isInitialized) return;

    final prefs = await SharedPreferences.getInstance();
    _isEnabled = prefs.getBool('attendance_alarm_enabled') ?? true;
    _workStartTime = formatToHHmm(prefs.getString('work_start_time'), "08:30");
    _workEndTime = formatToHHmm(prefs.getString('work_end_time'), "17:30");
    _lastCheckInAlarmKey = prefs.getString('last_checkin_alarm_key');
    _lastCheckOutAlarmKey = prefs.getString('last_checkout_alarm_key');

    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings initializationSettingsIOS =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings initializationSettings =
        InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    await _notificationsPlugin.initialize(initializationSettings);

    _isInitialized = true;

    // Asynchronously sync latest work hours from server
    unawaited(syncWorkHoursFromBackend());
  }

  Future<void> setEnabled(bool value) async {
    _isEnabled = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('attendance_alarm_enabled', value);
  }

  Future<void> updateWorkHours({String? startTime, String? endTime}) async {
    final prefs = await SharedPreferences.getInstance();
    if (startTime != null && startTime.trim().isNotEmpty) {
      _workStartTime = formatToHHmm(startTime, _workStartTime);
      await prefs.setString('work_start_time', _workStartTime);
    }
    if (endTime != null && endTime.trim().isNotEmpty) {
      _workEndTime = formatToHHmm(endTime, _workEndTime);
      await prefs.setString('work_end_time', _workEndTime);
    }
    debugPrint("AttendanceAlarmService work hours updated: Start=$_workStartTime, End=$_workEndTime");
  }

  /// Automatically fetch latest schedule/company work hours from API
  Future<void> syncWorkHoursFromBackend() async {
    try {
      final userData = await ApiService.getProfile();
      if (userData != null) {
        final start = userData['work_start_time']?.toString();
        final end = userData['work_end_time']?.toString();
        if (start != null || end != null) {
          await updateWorkHours(startTime: start, endTime: end);
        }
      }
      _lastSyncTime = DateTime.now();
    } catch (e) {
      debugPrint("AttendanceAlarmService failed to sync work hours: $e");
    }
  }

  void start() {
    _checkTimer?.cancel();
    // Run sync immediately
    syncWorkHoursFromBackend();
    // Check every 20 seconds to catch exact minute trigger reliably
    _checkTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      _checkAlarmTrigger();
    });
    // Run initial check
    _checkAlarmTrigger();
  }

  void stop() {
    _checkTimer?.cancel();
  }

  Future<void> _checkAlarmTrigger() async {
    if (!_isEnabled) return;

    final now = DateTime.now();
    final nowTimeStr = DateFormat('HH:mm').format(now);
    final todayDateStr = DateFormat('yyyy-MM-dd').format(now);

    // Periodically re-sync work hours every 5 minutes
    if (_lastSyncTime == null || now.difference(_lastSyncTime!).inMinutes >= 5) {
      unawaited(syncWorkHoursFromBackend());
    }

    final String checkInKey = "${todayDateStr}_$_workStartTime";
    final String checkOutKey = "${todayDateStr}_$_workEndTime";

    // 1. Check-In Alarm (Jam Masuk)
    if (nowTimeStr == _workStartTime && _lastCheckInAlarmKey != checkInKey) {
      try {
        final todayAttendance = await ApiService.getTodayAttendance();
        final bool hasCheckedIn = todayAttendance != null &&
            todayAttendance['check_in'] != null &&
            todayAttendance['check_in'].toString().isNotEmpty &&
            todayAttendance['check_in'].toString() != 'null';

        if (!hasCheckedIn) {
          _lastCheckInAlarmKey = checkInKey;
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('last_checkin_alarm_key', checkInKey);

          await _ringAlarm(
            id: 9001,
            title: "⏰ Waktunya Absen Masuk!",
            body:
                "Pukul $_workStartTime WIB — Jam kerja telah dimulai. Buka aplikasi dan lakukan absensi masuk sekarang!",
          );
        }
      } catch (e) {
        // Fallback: trigger alarm anyway
        _lastCheckInAlarmKey = checkInKey;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('last_checkin_alarm_key', checkInKey);

        await _ringAlarm(
          id: 9001,
          title: "⏰ Waktunya Absen Masuk!",
          body:
              "Pukul $_workStartTime WIB — Jam kerja telah dimulai. Buka aplikasi dan lakukan absensi masuk sekarang!",
        );
      }
    }

    // 2. Check-Out Alarm (Jam Pulang)
    if (nowTimeStr == _workEndTime && _lastCheckOutAlarmKey != checkOutKey) {
      try {
        final todayAttendance = await ApiService.getTodayAttendance();
        final bool hasCheckedOut = todayAttendance != null &&
            todayAttendance['check_out'] != null &&
            todayAttendance['check_out'].toString().isNotEmpty &&
            todayAttendance['check_out'].toString() != 'null';

        // Remind employee to check out if they haven't checked out yet
        if (!hasCheckedOut) {
          _lastCheckOutAlarmKey = checkOutKey;
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('last_checkout_alarm_key', checkOutKey);

          await _ringAlarm(
            id: 9002,
            title: "⏰ Waktunya Absen Pulang!",
            body:
                "Pukul $_workEndTime WIB — Jam kerja telah berakhir. Jangan lupa lakukan absensi pulang sekarang!",
          );
        }
      } catch (e) {
        // Fallback: trigger alarm
        _lastCheckOutAlarmKey = checkOutKey;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('last_checkout_alarm_key', checkOutKey);

        await _ringAlarm(
          id: 9002,
          title: "⏰ Waktunya Absen Pulang!",
          body:
              "Pukul $_workEndTime WIB — Jam kerja telah berakhir. Jangan lupa lakukan absensi pulang sekarang!",
        );
      }
    }
  }

  Future<void> _ringAlarm({
    required int id,
    required String title,
    required String body,
  }) async {
    try {
      // 1. Play audio alarm sound via AudioPlayer for 4 seconds (3-5 seconds range)
      try {
        await _audioPlayer.stop();
        await _audioPlayer.setVolume(1.0);
        await _audioPlayer.setReleaseMode(ReleaseMode.loop);
        await _audioPlayer.play(AssetSource('audio/notif.wav'));

        // Stop playing after 4 seconds
        Timer(const Duration(milliseconds: 4000), () async {
          try {
            await _audioPlayer.stop();
          } catch (_) {}
        });
      } catch (audioErr) {
        debugPrint("AudioPlayer playback notice: $audioErr");
      }

      // 2. Show Loud / High-Priority Notification with Vibration Pattern (~4s)
      final AndroidNotificationDetails androidDetails =
          AndroidNotificationDetails(
        'attendance_alarm_channel_v1',
        'Alarm Jam Absensi',
        channelDescription:
            'Alarm berdering dan bergetar saat tiba jam masuk dan jam pulang kerja',
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        enableVibration: true,
        vibrationPattern: Int64List.fromList([0, 800, 300, 800, 300, 800, 300, 700]),
        audioAttributesUsage: AudioAttributesUsage.alarm,
        category: AndroidNotificationCategory.alarm,
        fullScreenIntent: true,
      );

      const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
        presentSound: true,
        presentAlert: true,
        presentBadge: true,
        sound: 'notif_sound.wav',
      );

      final NotificationDetails platformDetails = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );

      await _notificationsPlugin.show(
        id,
        title,
        body,
        platformDetails,
      );
    } catch (e) {
      debugPrint("Error triggering alarm notification: $e");
    }
  }

  /// Helper to test alarm sound & notification manually
  Future<void> testAlarm() async {
    await _ringAlarm(
      id: 9999,
      title: "⏰ Uji Coba Alarm Absen Berdering",
      body: "Ini adalah pengujian suara alarm dan notifikasi jam absensi (Masuk: $_workStartTime | Pulang: $_workEndTime WIB).",
    );
  }
}
