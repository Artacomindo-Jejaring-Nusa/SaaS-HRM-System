import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api_client.dart';
import '../../services/secure_storage_service.dart';

/// Repository untuk fitur Manager.
/// Menangani: getManagerPendingCount, getManagerPendingRequests,
///            updateManagerRequestStatus, getTeamAttendance,
///            getSubordinates, launchPdf.
class ManagerRepository {
  static String? lastErrorMessage;

  static Future<Map<String, dynamic>?> getManagerPendingCount() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/manager/pending-count'),
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
    lastErrorMessage = null;
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/manager/pending-requests?type=$type'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        final data = body['data'];
        if (data is List) {
          return data;
        } else if (data is Map && data['data'] is List) {
          return data['data'];
        }
        return [];
      } else {
        try {
          final errBody = jsonDecode(response.body);
          lastErrorMessage = errBody['message'] ?? 'Gagal mengambil data (${response.statusCode})';
        } catch (_) {
          lastErrorMessage = 'Server error (${response.statusCode})';
        }
        if (kDebugMode) {
          debugPrint('[ManagerRepo] Error fetching $type: $lastErrorMessage');
        }
        return null;
      }
    } catch (e) {
      lastErrorMessage = 'Koneksi gagal: $e';
      if (kDebugMode) {
        debugPrint('[ManagerRepo] Exception fetching $type: $e');
      }
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
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/manager/update-status'),
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
      return {'status': 'error', 'message': 'Koneksi gagal: $e'};
    }
  }

  static Future<List<dynamic>?> getTeamAttendance() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/manager/team-attendance'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        final data = body['data'];
        if (data is List) {
          return data;
        } else if (data is Map && data['data'] is List) {
          return data['data'];
        }
        return [];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<List<dynamic>?> getSubordinates() async {
    try {
      final headers = await ApiClient.getHeaders();
      // 1. Coba ambil bawahan tim langsung
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/employees?is_team=true&per_page=100'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        final data = body['data'];
        List<dynamic> list = [];
        if (data is Map && data['data'] is List) {
          list = data['data'];
        } else if (data is List) {
          list = data;
        }
        if (list.isNotEmpty) return list;
      }

      // 2. Fallback: jika is_team kosong (misal Admin, HRD, Direktur, atau relasi atasan belum diisi di database)
      final fallbackResponse = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/employees?per_page=100'),
        headers: headers,
      );
      if (fallbackResponse.statusCode == 200) {
        final body = jsonDecode(fallbackResponse.body);
        final data = body['data'];
        if (data is Map && data['data'] is List) {
          return data['data'];
        } else if (data is List) {
          return data;
        }
      }
      return null;
    } catch (e) {
      debugPrint("Error getSubordinates: $e");
      return null;
    }
  }

  static Future<void> launchPdf(String type, int id) async {
    final secureStorage = await SecureStorageService.getInstance();
    String? token = await secureStorage.getAccessToken();
    final encodedToken = Uri.encodeComponent(token ?? '');
    final url = Uri.parse('${ApiClient.baseUrl}/export/$type/$id?token=$encodedToken');

    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      throw Exception('Could not launch $url');
    }
  }

  static Future<void> launchExcel(String type, int id) async {
    final secureStorage = await SecureStorageService.getInstance();
    String? token = await secureStorage.getAccessToken();
    final encodedToken = Uri.encodeComponent(token ?? '');
    final url = Uri.parse('${ApiClient.baseUrl}/export/$type/$id/excel?token=$encodedToken');

    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      throw Exception('Could not launch $url');
    }
  }
}
