import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../services/secure_storage_service.dart';

/// Core HTTP Client — handles configuration, token lifecycle, and HTTP wrapper.
///
/// All repositories should use this class to make HTTP requests.
/// This class is responsible for:
/// - Base URL configuration (dev/prod)
/// - JWT token management (auto-refresh on expiry, 401 retry)
/// - Providing authenticated headers
/// - Generic GET, POST, PUT, DELETE wrappers
class ApiClient {
  /// Global HTTP client. Can be replaced with a MockClient during unit tests.
  static http.Client client = http.Client();

  // ============ CONFIGURATION ============

  /// Toggle between Development and Production
  static const String _prodIp = 'ontime.jelantik.com';
  static const String _devIp =
      '2.2.2.42'; // Standard Android Emulator local address

  static String get serverIp => kDebugMode ? _devIp : _prodIp;

  static String get baseUrl =>
      kDebugMode ? 'http://$serverIp:8000/api' : 'https://$serverIp/api';

  static String get storageUrl => kDebugMode
      ? 'http://$serverIp:8000/storage'
      : 'https://$serverIp:8000/storage';

  /// Fixes URLs that might contain localhost or older IPs to use the current serverIp
  static String fixUrl(String? url) {
    if (url == null || url.isEmpty) return '';

    // Jika URL adalah path file lokal, jangan gunakan sebagai NetworkImage
    if (url.startsWith('file') || url.startsWith('/data/user')) return '';

    String fixedUrl = url;
    if (!fixedUrl.startsWith('http')) {
      fixedUrl = '$storageUrl/$url';
    }

    // Replace any local/old IPs with the current dynamic serverIp
    fixedUrl = fixedUrl
        .replaceAll('localhost', serverIp)
        .replaceAll('127.0.0.1', serverIp)
        .replaceAll('192.168.1.8', serverIp)
        .replaceAll('2.2.2.42', serverIp);

    // Production specific cleanup (Force HTTPS and remove dev port)
    if (!kDebugMode) {
      if (fixedUrl.startsWith('http://')) {
        fixedUrl = fixedUrl.replaceFirst('http://', 'https://');
      }
    }

    return fixedUrl;
  }

  // ============ DEVICE INFO ============

  /// Use this to mock device ID in unit tests
  static String? mockDeviceId;

  static Future<String> getDeviceId() async {
    if (mockDeviceId != null) return mockDeviceId!;

    DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
      return androidInfo.id;
    } else if (Platform.isIOS) {
      IosDeviceInfo iosInfo = await deviceInfo.iosInfo;
      return iosInfo.identifierForVendor ?? 'unknown_ios';
    }
    return 'unknown_device';
  }

  // ============ TOKEN MANAGEMENT ============

  /// Flag to prevent concurrent refresh attempts.
  static bool _isRefreshing = false;

  static Future<Map<String, String>> getHeaders() async {
    final secureStorage = await SecureStorageService.getInstance();

    // Auto-refresh if token is expired
    if (await secureStorage.isAccessTokenExpired()) {
      await _tryRefreshToken();
    }

    String? token = await secureStorage.getAccessToken();
    return {'Accept': 'application/json', 'Authorization': 'Bearer $token'};
  }

  /// Attempt to refresh the access token using the stored refresh token.
  /// Returns true if refresh was successful, false otherwise.
  static Future<bool> _tryRefreshToken() async {
    if (_isRefreshing) return false;
    _isRefreshing = true;

    try {
      final secureStorage = await SecureStorageService.getInstance();
      final refreshToken = await secureStorage.getRefreshToken();

      if (refreshToken == null || refreshToken.isEmpty) {
        _isRefreshing = false;
        return false;
      }

      final response = await http.post(
        Uri.parse('$baseUrl/refresh-token'),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'refresh_token': refreshToken}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final tokenData = data['data'];

        await secureStorage.saveTokens(
          accessToken: tokenData['access_token'],
          refreshToken: tokenData['refresh_token'],
          expiresIn: tokenData['expires_in'] ?? 3600,
        );

        _isRefreshing = false;
        return true;
      } else {
        // Refresh token is invalid/expired — user must re-login
        await secureStorage.clearTokens();
        _isRefreshing = false;
        return false;
      }
    } catch (e) {
      _isRefreshing = false;
      return false;
    }
  }

  // ============ HTTP WRAPPERS ============

  /// Make an authenticated HTTP request with auto-retry on 401.
  static Future<http.Response> authenticatedRequest(
    String method,
    String endpoint, {
    Map<String, String>? extraHeaders,
    Object? body,
  }) async {
    var headers = await getHeaders();
    if (extraHeaders != null) headers.addAll(extraHeaders);

    var uri = Uri.parse('$baseUrl$endpoint');
    http.Response response;

    switch (method.toUpperCase()) {
      case 'POST':
        response = await http.post(uri, headers: headers, body: body);
        break;
      case 'PUT':
        response = await http.put(uri, headers: headers, body: body);
        break;
      case 'DELETE':
        response = await http.delete(uri, headers: headers);
        break;
      default:
        response = await http.get(uri, headers: headers);
    }

    // Auto-retry once on 401 (token might have expired during request)
    if (response.statusCode == 401) {
      final refreshed = await _tryRefreshToken();
      if (refreshed) {
        headers = await getHeaders();
        if (extraHeaders != null) headers.addAll(extraHeaders);
        switch (method.toUpperCase()) {
          case 'POST':
            response = await http.post(uri, headers: headers, body: body);
            break;
          case 'PUT':
            response = await http.put(uri, headers: headers, body: body);
            break;
          case 'DELETE':
            response = await http.delete(uri, headers: headers);
            break;
          default:
            response = await http.get(uri, headers: headers);
        }
      }
    }

    return response;
  }
}
