import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_service.dart';

class TrackingService {
  static Future<void> initializeService() async {
    final service = FlutterBackgroundService();

    // Setup Local Notifications for Foreground Service
    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'hrm_tracking_channel',
      'Live Tracking Service',
      description: 'Digunakan untuk pelacakan lokasi teknisi di latar belakang.',
      importance: Importance.low,
    );

    final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

    await flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(channel);

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: 'hrm_tracking_channel',
        initialNotificationTitle: 'Live Tracking Aktif',
        initialNotificationContent: 'Merekam lokasi di latar belakang...',
        foregroundServiceNotificationId: 888,
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );
  }

  static Future<void> startTracking() async {
    final service = FlutterBackgroundService();
    bool isRunning = await service.isRunning();
    if (!isRunning) {
      // Pastikan permission diberikan
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
        service.startService();
      }
    }
  }

  static Future<void> stopTracking() async {
    final service = FlutterBackgroundService();
    bool isRunning = await service.isRunning();
    if (isRunning) {
      service.invoke("stopService");
    }
  }
}

@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  return true;
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  if (service is AndroidServiceInstance) {
    service.on('setAsForeground').listen((event) {
      service.setAsForegroundService();
    });
    service.on('setAsBackground').listen((event) {
      service.setAsBackgroundService();
    });
  }

  service.on('stopService').listen((event) {
    service.stopSelf();
  });

  // Init Geolocator Settings
  const LocationSettings locationSettings = LocationSettings(
    accuracy: LocationAccuracy.high,
    distanceFilter: 10, // Send update when device moves 10 meters
  );

  // Send periodic updates or stream listen
  Geolocator.getPositionStream(locationSettings: locationSettings).listen((Position position) async {
    // Save to backend
    try {
      await ApiService.updateLiveLocation(position.latitude, position.longitude, position.accuracy);
    } catch (e) {
      debugPrint("Gagal kirim live tracking: $e");
    }

    if (service is AndroidServiceInstance) {
      final now = DateTime.now();
      final timeStr = "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";
      service.setForegroundNotificationInfo(
        title: "Live Tracking Aktif",
        content: "Lokasi diperbarui pada $timeStr",
      );
    }
  });
}
