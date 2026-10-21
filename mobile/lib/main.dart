import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/notification_screen.dart';
import 'screens/task_screen.dart';
import 'services/notification_service.dart';
import 'services/attendance_alarm_service.dart';
import 'services/secure_storage_service.dart';
import 'services/tracking_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:firebase_core/firebase_core.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'services/fcm_service.dart';

// Global Notifiers
final ValueNotifier<ThemeMode> themeNotifier = ValueNotifier(ThemeMode.light);
final ValueNotifier<String> languageNotifier = ValueNotifier('ID');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await Firebase.initializeApp().timeout(const Duration(seconds: 3));
    FcmService.init();
  } catch (e) {
    debugPrint("Firebase initialization error: $e");
  }

  try {
    await GoogleSignIn.instance.initialize(
      serverClientId: '1015918555814-0qod31fvuc96odo10a2uqmppoqf9vegi.apps.googleusercontent.com',
    );
  } catch (e) {
    debugPrint("Google Sign In initialize note: $e");
  }

  try {
    await TrackingService.initializeService().timeout(const Duration(seconds: 3));
  } catch (e) {
    debugPrint("TrackingService initialization error: $e");
  }
  
  // 1. Load user settings
  try {
    final prefs = await SharedPreferences.getInstance();
    final isDark = prefs.getBool('dark_mode') ?? false;
    themeNotifier.value = isDark ? ThemeMode.dark : ThemeMode.light;
    languageNotifier.value = prefs.getString('language') ?? 'ID';
  } catch (e) {
    debugPrint("Failed to load settings in main: $e");
  }

  // 2. Check login session (Secure Storage)
  bool hasToken = false;
  try {
    final secureStorage = await SecureStorageService.getInstance();
    await secureStorage.migrateFromPlainPrefs();
    hasToken = await secureStorage.hasValidToken();
    debugPrint("App Startup - User hasValidToken: $hasToken");
  } catch (e) {
    debugPrint("App Startup token check error: $e");
  }

  // 3. Initialize background / notification services
  try {
    NotificationService().init();
    await AttendanceAlarmService().init();

    if (hasToken) {
      AttendanceAlarmService().start();
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        try {
          await TrackingService.startTracking();
        } catch (e) {
          debugPrint("Failed to start tracking post frame: $e");
        }
      });
    }
  } catch (e) {
    debugPrint("App Startup background services init note: $e");
  }

  runApp(MyApp(isLoggedIn: hasToken));
}

class MyApp extends StatelessWidget {
  final bool isLoggedIn;
  const MyApp({super.key, this.isLoggedIn = false});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeNotifier,
      builder: (_, ThemeMode currentMode, child) {
        return ValueListenableBuilder<String>(
          valueListenable: languageNotifier,
          builder: (context, lang, _) {
            return MaterialApp(
              title: 'HRM SaaS Mobile',
              debugShowCheckedModeBanner: false,
              themeMode: currentMode,
              theme: _buildLightTheme(context),
              darkTheme: _buildDarkTheme(context),
              home: isLoggedIn ? DashboardScreen() : LoginScreen(),
              routes: {
                '/login': (context) => LoginScreen(),
                '/dashboard': (context) => DashboardScreen(),
                '/notifications': (context) => NotificationScreen(),
                '/tasks': (context) => TaskScreen(),
              },
            );
          },
        );
      },
    );
  }

  ThemeData _buildLightTheme(BuildContext context) {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF800000), 
        primary: const Color(0xFF800000),
        surface: Colors.white,
      ),
      scaffoldBackgroundColor: const Color(0xFFFBFBFB),
      textTheme: GoogleFonts.interTextTheme(Theme.of(context).textTheme.apply(bodyColor: Colors.black87, displayColor: Colors.black87)),
    );
  }

  ThemeData _buildDarkTheme(BuildContext context) {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF800000), 
        brightness: Brightness.dark, 
        primary: const Color(0xFF800000),
      ),
      scaffoldBackgroundColor: const Color(0xFF121212),
      textTheme: GoogleFonts.interTextTheme(Theme.of(context).textTheme.apply(bodyColor: Colors.white, displayColor: Colors.white)),
    );
  }
}
