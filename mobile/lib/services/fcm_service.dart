import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../api/api_service.dart';
import 'notification_service.dart';

class FcmService {
  static final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  static final StreamController<RemoteMessage> _messageStreamController = StreamController<RemoteMessage>.broadcast();
  static Stream<RemoteMessage> get onMessageReceived => _messageStreamController.stream;

  static Future<void> init() async {
    try {
      // Request permissions for iOS and Android 13+
      NotificationSettings settings = await _firebaseMessaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        print('User granted permission');
        
        // Get the token safely (may fail if dummy/placeholder google-services.json is used)
        try {
          String? token = await _firebaseMessaging.getToken();
          if (token != null) {
            print("FCM Token: $token");
            // Save token to server
            await ApiService.updateFcmToken(token);
          }
        } catch (e) {
          print("FCM getToken error (placeholder or invalid Firebase config): $e");
        }
      }

      // Handle token refresh safely
      _firebaseMessaging.onTokenRefresh.listen((newToken) {
        ApiService.updateFcmToken(newToken);
      }, onError: (err) {
        print("FCM onTokenRefresh error: $err");
      });

      // Listen for incoming messages when app is in foreground
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        print("Got a message whilst in the foreground!");
        if (message.notification != null) {
          // Broadcast to listeners (UI)
          _messageStreamController.add(message);

          // Use existing NotificationService to show the banner
          NotificationService().showNotification(
            message.hashCode,
            message.notification!.title ?? "Notification",
            message.notification!.body ?? "",
          );
        }
      }, onError: (err) {
        print("FCM onMessage error: $err");
      });

      // Handle background messages safely
      try {
        FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
      } catch (e) {
        print("FCM onBackgroundMessage registration error: $e");
      }
    } catch (e) {
      print("FcmService init error: $e");
    }
  }
}

// Global background handler
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  print("Handling a background message: ${message.messageId}");
}
