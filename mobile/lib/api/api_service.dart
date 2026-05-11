import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart' as p;
import 'package:url_launcher/url_launcher.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import '../services/secure_storage_service.dart';

class ApiService {
  // Toggle between Development and Production
  static const String _prodIp = 'ontime.jelantik.com';
  static const String _devIp =
      '2.2.2.3'; // Standard Android Emulator local address

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
        .replaceAll('192.168.1.9', serverIp)
        .replaceAll('2.2.2.3', serverIp);

    // Production specific cleanup (Force HTTPS and remove dev port)
    if (!kDebugMode) {
      if (fixedUrl.startsWith('http://')) {
        fixedUrl = fixedUrl.replaceFirst('http://', 'https://');
      }
    }

    return fixedUrl;
  }

  // ============ HEADERS ============

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

  static Future<String> getDeviceId() async {
    DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
      return androidInfo.id; // Unique ID on Android
    } else if (Platform.isIOS) {
      IosDeviceInfo iosInfo = await deviceInfo.iosInfo;
      return iosInfo.identifierForVendor ?? 'unknown_ios';
    }
    return 'unknown_device';
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

  // ============ AUTH ============

  static Future<Map<String, dynamic>> login(
    String email,
    String password,
    String companyName,
  ) async {
    try {
      String deviceId = await getDeviceId();
      final response = await http.post(
        Uri.parse('$baseUrl/login'),
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
      String deviceId = await getDeviceId();
      final prefs = await SharedPreferences.getInstance();
      final fcmToken = prefs.getString('fcm_token');

      final response = await http.post(
        Uri.parse('$baseUrl/login-google'),
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
      final response = await http.get(
        Uri.parse('$baseUrl/companies/search?q=$query'),
        headers: {'Accept': 'application/json'},
      );

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
        await http.post(
          Uri.parse('$baseUrl/logout'),
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
  }

  // ============ DASHBOARD ============

  static Future<Map<String, dynamic>?> getLeaderboard() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/dashboard/leaderboard'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // ============ PROFILE ============

  static Future<Map<String, dynamic>?> getProfile() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/user'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']['user'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> updateProfile(
    Map<String, String> data,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';

      final response = await http.post(
        Uri.parse('$baseUrl/profile/update'),
        headers: headers,
        body: jsonEncode(data),
      );

      final body = jsonDecode(response.body);

      if (response.statusCode == 200) {
        final needsApproval = body['data']?['needs_approval'] ?? false;
        return {
          'success': true,
          'needs_approval': needsApproval,
          'message': body['message'] ?? 'Profil berhasil diperbarui.',
        };
      } else {
        String errorMsg = body['message'] ?? 'Gagal memperbarui profil.';
        if (body['errors'] != null) {
          final errors = body['errors'] as Map;
          errorMsg = errors.values.map((v) => (v as List).first).join('\n');
        }
        return {'success': false, 'needs_approval': false, 'message': errorMsg};
      }
    } catch (e) {
      return {
        'success': false,
        'needs_approval': false,
        'message': 'Koneksi gagal.',
      };
    }
  }

  static Future<Map<String, dynamic>> uploadProfilePhoto(
    String filePath,
  ) async {
    try {
      final headers = await getHeaders();
      final uri = Uri.parse('$baseUrl/profile/upload-photo');

      var request = http.MultipartRequest('POST', uri);
      request.headers.addAll(headers);

      final extension = p.extension(filePath).toLowerCase();
      String mimeType = 'image/jpeg';
      if (extension == '.png') mimeType = 'image/png';
      if (extension == '.webp') mimeType = 'image/webp';

      request.files.add(
        await http.MultipartFile.fromPath(
          'photo',
          filePath,
          contentType: MediaType.parse(mimeType),
        ),
      );

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      final body = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': body['message'] ?? 'Foto berhasil diunggah.',
          'url': body['data']['profile_photo_url'],
        };
      } else {
        return {
          'success': false,
          'message': body['message'] ?? 'Gagal mengunggah foto.',
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Koneksi gagal: ${e.toString()}'};
    }
  }

  // ============ ATTENDANCE ============

  static Future<List<dynamic>?> getAttendanceHistory() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/attendance/history'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        final data = body['data'];
        if (data is Map && data['data'] is List) {
          return data['data'];
        } else if (data is List) {
          return data;
        }
        return [];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>?> getTodayAttendance() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/attendance/today'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>?> checkIn(
    double lat,
    double lng, {
    String? image,
    String? deviceId,
    bool isMocked = false,
  }) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/attendance/check-in'),
        headers: headers,
        body: jsonEncode({
          'latitude': lat,
          'longitude': lng,
          'image': image,
          'device_id': deviceId,
          'is_mocked': isMocked,
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>?> checkOut(
    double lat,
    double lng, {
    String? image,
    String? deviceId,
    bool isMocked = false,
  }) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/attendance/check-out'),
        headers: headers,
        body: jsonEncode({
          'latitude': lat,
          'longitude': lng,
          'image': image,
          'device_id': deviceId,
          'is_mocked': isMocked,
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return null;
    }
  }

  // ============ NOTIFICATIONS ============

  static Future<List<dynamic>?> getNotifications() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/notifications'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        // Backend now returns paginated data: body['data']['data']
        if (body['data'] is Map && body['data'].containsKey('data')) {
          return body['data']['data'];
        }
        return body['data']; // Fallback for list
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<bool> markNotificationAsRead(int id) async {
    try {
      final headers = await getHeaders();
      final response = await http.put(
        Uri.parse('$baseUrl/notifications/$id/read'),
        headers: headers,
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  static Future<Map<String, dynamic>> clearNotificationsWithStatus() async {
    try {
      final headers = await getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/notifications-clear'),
        headers: headers,
      );
      return {
        'success': response.statusCode >= 200 && response.statusCode < 300,
        'status': response.statusCode,
        'body': response.body,
      };
    } catch (e) {
      return {'success': false, 'status': 0, 'error': e.toString()};
    }
  }

  static Future<List<dynamic>?> getHolidays() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/holidays'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<List<dynamic>?> getAnnouncements() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/announcements'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        // Backend returns paginated data: body['data']['data']
        if (body['data'] is Map && body['data'].containsKey('data')) {
          return body['data']['data'];
        }
        return body['data']; // Fallback for direct list
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<bool> clearNotifications() async {
    final res = await clearNotificationsWithStatus();
    return res['success'];
  }

  static Future<Map<String, dynamic>> updateFcmToken(String token) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/notifications/fcm-token'),
        headers: headers,
        body: jsonEncode({'fcm_token': token}),
      );
      print("FCM Token update response: ${response.body}");
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': e.toString()};
    }
  }

  // ============ LEAVE (CUTI) ============

  static Future<List<dynamic>?> getLeaves() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/leave'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> submitLeave(
    Map<String, dynamic> data,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/leave'),
        headers: headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  // ============ PERMITS (PERIZINAN) ============

  static Future<List<dynamic>?> getPermits() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/permits'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> submitPermit(
    Map<String, dynamic> data,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/permits'),
        headers: headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  // ============ OVERTIME (LEMBUR) ============

  static Future<List<dynamic>?> getOvertimes() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/overtimes'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> submitOvertime(
    Map<String, dynamic> data,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/overtimes'),
        headers: headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  // ============ SALARY (GAJI) ============

  static Future<List<dynamic>?> getSalaries() async {
    try {
      final headers = await getHeaders();
      final url = Uri.parse('$baseUrl/payroll/my-history');
      print("Fetching Salaries from: $url");
      final response = await http.get(url, headers: headers);
      print("Salary Response Status: ${response.statusCode}");
      print("Salary Response Body: ${response.body}");

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        final data = body['data'];
        if (data is List) return data;
        if (data is Map && data['data'] is List) return data['data'];
        return [];
      }
      return null;
    } catch (e) {
      print("Error fetching salaries: $e");
      return null;
    }
  }

  static Future<void> downloadSalarySlip(int id) async {
    final secureStorage = await SecureStorageService.getInstance();
    String? token = await secureStorage.getAccessToken();
    final encodedToken = Uri.encodeComponent(token ?? '');
    final url = Uri.parse(
      '$baseUrl/payroll/download-slip/$id?token=$encodedToken',
    );
    try {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } catch (e) {}
  }

  static Future<void> previewSalarySlip(int id) async {
    final secureStorage = await SecureStorageService.getInstance();
    String? token = await secureStorage.getAccessToken();
    final encodedToken = Uri.encodeComponent(token ?? '');
    final url = Uri.parse(
      '$baseUrl/payroll/preview-slip/$id?token=$encodedToken',
    );
    try {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } catch (e) {}
  }

  // ============ TASKS (TUGAS) ============

  static Future<List<dynamic>?> getTasks({String type = 'received'}) async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/tasks?type=$type'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        // The API returns paginated: { "data": { "data": [...] } }
        return body['data']['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> createTask(
    Map<String, dynamic> data,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/tasks'),
        headers: headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> deleteTask(int taskId) async {
    try {
      final headers = await getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/tasks/$taskId'),
        headers: headers,
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> updateTaskStatus(
    int taskId,
    String status,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/tasks/$taskId/status'),
        headers: headers,
        body: jsonEncode({'status': status}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> updateTaskActivityStatus(
    int activityId,
    String status,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.put(
        Uri.parse('$baseUrl/tasks/activities/$activityId/status'),
        headers: headers,
        body: jsonEncode({'status': status}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> uploadTaskEvidence(
    int activityId, {
    String? photoBefore,
    String? photoAfter,
    String? notes,
  }) async {
    try {
      final headers = await getHeaders();
      final uri = Uri.parse('$baseUrl/tasks/activities/$activityId/evidence');

      var request = http.MultipartRequest('POST', uri);
      request.headers.addAll(headers);

      if (photoBefore != null && photoBefore.isNotEmpty) {
        request.files.add(
          await http.MultipartFile.fromPath(
            'photo_before',
            photoBefore,
            contentType: MediaType.parse('image/jpeg'),
          ),
        );
      }

      if (photoAfter != null && photoAfter.isNotEmpty) {
        request.files.add(
          await http.MultipartFile.fromPath(
            'photo_after',
            photoAfter,
            contentType: MediaType.parse('image/jpeg'),
          ),
        );
      }

      if (notes != null) {
        request.fields['notes'] = notes;
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal: ${e.toString()}'};
    }
  }

  // ============ REIMBURSEMENT ============

  static Future<List<dynamic>?> getReimbursements() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/reimbursements'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> submitReimbursement(
    Map<String, String> data, {
    List<String>? filePaths,
  }) async {
    try {
      final headers = await getHeaders();
      final uri = Uri.parse('$baseUrl/reimbursements');

      var request = http.MultipartRequest('POST', uri);
      request.headers.addAll(headers);
      request.fields.addAll(data);

      if (filePaths != null && filePaths.isNotEmpty) {
        for (var filePath in filePaths) {
          final extension = p.extension(filePath).toLowerCase();
          String mimeType = 'image/jpeg';
          if (extension == '.png') mimeType = 'image/png';
          if (extension == '.webp') mimeType = 'image/webp';

          request.files.add(
            await http.MultipartFile.fromPath(
              'attachments[]',
              filePath,
              contentType: MediaType.parse(mimeType),
              filename:
                  'receipt_${DateTime.now().millisecondsSinceEpoch}_${filePaths.indexOf(filePath)}$extension',
            ),
          );
        }
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal: ${e.toString()}'};
    }
  }

  // ============ SETTINGS ============

  static Future<Map<String, dynamic>> changePassword(
    String current,
    String newPwd,
    String confirm,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';

      final response = await http.post(
        Uri.parse('$baseUrl/user/change-password'),
        headers: headers,
        body: jsonEncode({
          'current_password': current,
          'new_password': newPwd,
          'new_password_confirmation': confirm,
        }),
      );

      final body = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': body['message'] ?? 'Kata sandi berhasil diubah.',
        };
      } else {
        String errorMsg = body['message'] ?? 'Gagal mengubah kata sandi.';
        if (body['errors'] != null) {
          final errors = body['errors'] as Map;
          errorMsg = errors.values.map((v) => (v as List).first).join('\n');
        }
        return {'success': false, 'message': errorMsg};
      }
    } catch (e) {
      return {'success': false, 'message': 'Koneksi gagal.'};
    }
  }

  // ============ KPI REVIEWS ============

  static Future<List<dynamic>?> getKpis() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/kpi-reviews'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // ============ MANAGER ============

  static Future<Map<String, dynamic>?> getManagerPendingCount() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/manager/pending-count'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<List<dynamic>?> getManagerPendingRequests(String type) async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/manager/pending-requests?type=$type'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> updateManagerRequestStatus(
    String type,
    int id,
    String status, {
    String? remark,
  }) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/manager/update-status'),
        headers: headers,
        body: jsonEncode({
          'type': type,
          'id': id,
          'status': status,
          'remark': remark,
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<List<dynamic>?> getTeamAttendance() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/manager/team-attendance'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<List<dynamic>?> getSubordinates() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/employees?is_team=true&per_page=100'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<void> launchPdf(String type, int id) async {
    final secureStorage = await SecureStorageService.getInstance();
    String? token = await secureStorage.getAccessToken();
    final encodedToken = Uri.encodeComponent(token ?? '');
    final url = Uri.parse('$baseUrl/export/$type/$id?token=$encodedToken');

    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      throw Exception('Could not launch $url');
    }
  }

  // ============ SHIFT SWAP ============

  static Future<List<dynamic>?> getShiftSwaps() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/shift-swap'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> submitShiftSwap(
    Map<String, dynamic> data,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/shift-swap'),
        headers: headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> respondShiftSwap(
    int id,
    String status, {
    String? remark,
  }) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/shift-swap/$id/respond'),
        headers: headers,
        body: jsonEncode({'status': status, 'remark': remark}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> approveShiftSwap(
    int id,
    String status,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/shift-swap/$id/approve'),
        headers: headers,
        body: jsonEncode({'status': status}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<List<dynamic>?> getSchedules({int? userId}) async {
    try {
      final headers = await getHeaders();
      String url = '$baseUrl/schedules';
      if (userId != null) url += '?user_id=$userId';
      final response = await http.get(Uri.parse(url), headers: headers);
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<List<dynamic>?> getEmployees() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/employees'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        // It could be directly 'data' or 'data.data' depending on API
        if (body['data'] != null && body['data']['data'] != null) {
          return body['data']['data'];
        }
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // ============ ATTENDANCE CORRECTIONS ============

  static Future<List<dynamic>?> getAttendanceCorrections() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/attendance-corrections'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['data'] is Map && body['data']['data'] is List) {
          return body['data']['data'];
        }
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> submitAttendanceCorrection(
    Map<String, dynamic> data,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/attendance-corrections'),
        headers: headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> toggleWfh(int userId) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/employees/$userId/toggle-wfh'),
        headers: headers,
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  // ============ FLEET LOGGING (KENDARAAN) ============

  static Future<List<dynamic>?> getVehicleLogs() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/vehicle-logs'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['data'] is Map && body['data']['data'] is List) {
          return body['data']['data'];
        }
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<List<dynamic>?> getAvailableVehicles() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/vehicle-logs/vehicles'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>?> getVehicleReport() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/vehicle-logs/report'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> submitDeparture(
    Map<String, String> data,
    String? photoPath,
  ) async {
    try {
      final headers = await getHeaders();
      final uri = Uri.parse('$baseUrl/vehicle-logs/departure');

      var request = http.MultipartRequest('POST', uri);
      request.headers.addAll(headers);
      request.fields.addAll(data);

      if (photoPath != null) {
        final extension = p.extension(photoPath).toLowerCase();
        String mimeType = 'image/jpeg';
        if (extension == '.png') mimeType = 'image/png';
        if (extension == '.webp') mimeType = 'image/webp';

        request.files.add(
          await http.MultipartFile.fromPath(
            'odometer_start_photo',
            photoPath,
            contentType: MediaType.parse(mimeType),
          ),
        );
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal: ${e.toString()}'};
    }
  }

  static Future<Map<String, dynamic>> submitReturn(
    int id,
    Map<String, String> data, {
    String? odometerPhotoPath,
    List<String>? expenseFiles,
  }) async {
    try {
      final headers = await getHeaders();
      final uri = Uri.parse('$baseUrl/vehicle-logs/$id/return');

      var request = http.MultipartRequest('POST', uri);
      request.headers.addAll(headers);
      request.fields.addAll(data);

      if (odometerPhotoPath != null) {
        final extension = p.extension(odometerPhotoPath).toLowerCase();
        String mimeType = 'image/jpeg';
        if (extension == '.png') mimeType = 'image/png';

        request.files.add(
          await http.MultipartFile.fromPath(
            'odometer_end_photo',
            odometerPhotoPath,
            contentType: MediaType.parse(mimeType),
          ),
        );
      }

      if (expenseFiles != null && expenseFiles.isNotEmpty) {
        for (var filePath in expenseFiles) {
          final extension = p.extension(filePath).toLowerCase();
          String mimeType = 'image/jpeg';
          if (extension == '.png') mimeType = 'image/png';

          request.files.add(
            await http.MultipartFile.fromPath(
              'expense_attachments[]',
              filePath,
              contentType: MediaType.parse(mimeType),
            ),
          );
        }
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal: ${e.toString()}'};
    }
  }

  static Future<Map<String, dynamic>> approveVehicleLog(
    int id, {
    String? remark,
  }) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/vehicle-logs/$id/approve'),
        headers: headers,
        body: jsonEncode({'remark': remark}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> rejectVehicleLog(
    int id, {
    String? remark,
  }) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/vehicle-logs/$id/reject'),
        headers: headers,
        body: jsonEncode({'remark': remark}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }
  // ============ DOCUMENTS (SK & REGULATIONS) ============

  static Future<List<dynamic>?> getDocuments({String? type}) async {
    try {
      final headers = await getHeaders();
      String url = '$baseUrl/documents';
      if (type != null) url += '?type=$type';

      print('[Documents] Fetching: $url');
      final response = await http.get(Uri.parse(url), headers: headers);
      print('[Documents] Status: ${response.statusCode}');
      print(
        '[Documents] Body: ${response.body.length > 200 ? response.body.substring(0, 200) : response.body}',
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data'];
      }
      print('[Documents] Error: HTTP ${response.statusCode}');
      return null;
    } catch (e) {
      print('[Documents] Exception: $e');
      return null;
    }
  }

  // ============ FUND REQUESTS (PENGAJUAN DANA) ============

  static Future<List<dynamic>?> getFundRequests() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/fund-requests'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['data'] is Map && body['data']['data'] is List) {
          return body['data']['data'];
        }
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> submitFundRequest(
    Map<String, dynamic> data,
  ) async {
    try {
      final headers = await getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await http.post(
        Uri.parse('$baseUrl/fund-requests'),
        headers: headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> deleteFundRequest(int id) async {
    try {
      final headers = await getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/fund-requests/$id'),
        headers: headers,
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }
}
