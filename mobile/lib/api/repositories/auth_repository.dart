import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../api_client.dart';
import '../../services/secure_storage_service.dart';
import '../../services/tracking_service.dart';

/// Repository untuk fitur Autentikasi.
/// Menangani: login, loginWithGoogle, searchCompanies, logout.
class AuthRepository {
  static Future<Map<String, dynamic>> login(
    String email,
    String password,
    String companyName,
  ) async {
    try {
      String deviceId = await ApiClient.getDeviceId();
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/login'),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'password': password,
          'company_name': companyName,
          'device_id': deviceId,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        final tokenData = data['data'];
        final secureStorage = await SecureStorageService.getInstance();

        // Save tokens encrypted with device key
        await secureStorage.saveTokens(
          accessToken: tokenData['access_token'],
          refreshToken: tokenData['refresh_token'],
          expiresIn: tokenData['expires_in'] ?? 3600,
        );

        return {'success': true, 'message': 'Login Berhasil!'};
      } else {
        return {
          'success': false,
          'message': data['message'] ?? 'Email atau Password salah.',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Koneksi Gagal. Pastikan Laptop & HP di Wi-Fi yang sama.',
      };
    }
  }

  static Future<Map<String, dynamic>> loginWithGoogle({
    required String idToken,
    required String companyName,
  }) async {
    try {
      String deviceId = await ApiClient.getDeviceId();
      final prefs = await SharedPreferences.getInstance();
      final fcmToken = prefs.getString('fcm_token');

      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/login-google'),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'id_token': idToken,
          'company_name': companyName,
          'device_id': deviceId,
          'fcm_token': fcmToken,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        final tokenData = data['data'];
        final secureStorage = await SecureStorageService.getInstance();

        await secureStorage.saveTokens(
          accessToken: tokenData['access_token'],
          refreshToken: tokenData['refresh_token'],
          expiresIn: tokenData['expires_in'] ?? 3600,
        );

        return {'success': true, 'message': 'Login Berhasil!'};
      } else {
        return {
          'success': false,
          'message': data['message'] ?? 'Login Google Gagal.',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Koneksi Gagal. Silakan coba lagi.',
      };
    }
  }

  static Future<List<dynamic>> searchCompanies(String query) async {
    try {
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/companies/search?q=$query'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['data'] ?? [];
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  static Future<void> logout() async {
    // Call backend logout to revoke tokens server-side
    try {
      final secureStorage = await SecureStorageService.getInstance();
      final token = await secureStorage.getAccessToken();
      if (token != null) {
        await ApiClient.client.post(
          Uri.parse('${ApiClient.baseUrl}/logout'),
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $token',
          },
        );
      }
    } catch (e) {
      // Ignore errors during server logout — still clear local tokens
    }

    // Clear all encrypted tokens locally
    final secureStorage = await SecureStorageService.getInstance();
    await secureStorage.clearTokens();

    // Also remove old legacy plaintext token if exists
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');

    try {
      await TrackingService.stopTracking();
    } catch (e) {
      print("Failed to stop tracking: $e");
    }
  }
}
