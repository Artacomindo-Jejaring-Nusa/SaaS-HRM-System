import 'dart:async';
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
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
  bool _isInitialized = false;
  bool _isEnabled = true;
  String _workStartTime = "08:30";
  String _workEndTime = "17:30";

  String? _lastCheckInAlarmDate;
  String? _lastCheckOutAlarmDate;

  bool get isEnabled => _isEnabled;
  String get workStartTime => _workStartTime;
  String get workEndTime => _workEndTime;

  Future<void> init() async {
    if (_isInitialized) return;

    final prefs = await SharedPreferences.getInstance();
    _isEnabled = prefs.getBool('attendance_alarm_enabled') ?? true;
    _workStartTime = prefs.getString('work_start_time') ?? "08:30";
    _workEndTime = prefs.getString('work_end_time') ?? "17:30";
    _lastCheckInAlarmDate = prefs.getString('last_checkin_alarm_date');
    _lastCheckOutAlarmDate = prefs.getString('last_checkout_alarm_date');

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
  }

  Future<void> setEnabled(bool value) async {
    _isEnabled = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('attendance_alarm_enabled', value);
  }

  Future<void> updateWorkHours({String? startTime, String? endTime}) async {
    final prefs = await SharedPreferences.getInstance();
    if (startTime != null && startTime.isNotEmpty) {
      _workStartTime = startTime.substring(0, 5);
      await prefs.setString('work_start_time', _workStartTime);
    }
    if (endTime != null && endTime.isNotEmpty) {
      _workEndTime = endTime.substring(0, 5);
      await prefs.setString('work_end_time', _workEndTime);
    }
  }

  void start() {
    _checkTimer?.cancel();
    // Check every 30 seconds to catch the exact minute
    _checkTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _checkAlarmTrigger();
    });
    // Run an initial check
    _checkAlarmTrigger();
  }

  void stop() {
    _checkTimer?.cancel();
  }

  Future<void> _checkAlarmTrigger() async {
    if (!_isEnabled) return;

    final now = DateTime.now();
    // Only trigger on working days (Mon-Sat, adjust if Sunday)
    final nowTimeStr = DateFormat('HH:mm').format(now);
    final todayDateStr = DateFormat('yyyy-MM-dd').format(now);

    // 1. Check-In Alarm (Jam Masuk)
    if (nowTimeStr == _workStartTime && _lastCheckInAlarmDate != todayDateStr) {
      try {
        final todayAttendance = await ApiService.getTodayAttendance();
        final bool hasCheckedIn = todayAttendance != null &&
            todayAttendance['check_in'] != null &&
            todayAttendance['check_in'].toString().isNotEmpty &&
            todayAttendance['check_in'].toString() != 'null';

        if (!hasCheckedIn) {
          _lastCheckInAlarmDate = todayDateStr;
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('last_checkin_alarm_date', todayDateStr);

          await _ringAlarm(
            id: 9001,
            title: "⏰ Waktunya Absen Masuk!",
            body:
                "Pukul $_workStartTime WIB — Jam kerja telah dimulai. Buka aplikasi dan lakukan absensi masuk sekarang!",
          );
        }
      } catch (e) {
        // Fallback: trigger alarm anyway
        _lastCheckInAlarmDate = todayDateStr;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('last_checkin_alarm_date', todayDateStr);

        await _ringAlarm(
          id: 9001,
          title: "⏰ Waktunya Absen Masuk!",
          body:
              "Pukul $_workStartTime WIB — Jam kerja telah dimulai. Buka aplikasi dan lakukan absensi masuk sekarang!",
        );
      }
    }

    // 2. Check-Out Alarm (Jam Pulang)
    if (nowTimeStr == _workEndTime && _lastCheckOutAlarmDate != todayDateStr) {
      try {
        final todayAttendance = await ApiService.getTodayAttendance();
        final bool hasCheckedIn = todayAttendance != null &&
            todayAttendance['check_in'] != null &&
            todayAttendance['check_in'].toString().isNotEmpty &&
            todayAttendance['check_in'].toString() != 'null';

        final bool hasCheckedOut = todayAttendance != null &&
            todayAttendance['check_out'] != null &&
            todayAttendance['check_out'].toString().isNotEmpty &&
            todayAttendance['check_out'].toString() != 'null';

        if (hasCheckedIn && !hasCheckedOut) {
          _lastCheckOutAlarmDate = todayDateStr;
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('last_checkout_alarm_date', todayDateStr);

          await _ringAlarm(
            id: 9002,
            title: "⏰ Waktunya Absen Pulang!",
            body:
                "Pukul $_workEndTime WIB — Jam kerja telah berakhir. Jangan lupa lakukan absensi pulang sekarang!",
          );
        }
      } catch (e) {
        // Fallback: trigger alarm
        _lastCheckOutAlarmDate = todayDateStr;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('last_checkout_alarm_date', todayDateStr);

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
      // 1. Play audio alarm sound via AudioPlayer
      try {
        await _audioPlayer.stop();
        await _audioPlayer.setVolume(1.0);
        await _audioPlayer.play(AssetSource('audio/notif.wav'));
      } catch (audioErr) {
        // Ignore audio player err if sound played through notification
      }

      // 2. Show Loud / High-Priority Notification with Vibration Pattern
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
        vibrationPattern: Int64List.fromList([0, 1000, 500, 1000, 500, 1000]),
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
      // ignore
    }
  }

  /// Helper to test alarm sound & notification manually
  Future<void> testAlarm() async {
    await _ringAlarm(
      id: 9999,
      title: "⏰ Uji Coba Alarm Absen Berdering",
      body: "Ini adalah pengujian suara alarm dan notifikasi jam absensi.",
    );
  }
}
