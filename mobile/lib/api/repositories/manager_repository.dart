import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import '../api_client.dart';
import '../../services/secure_storage_service.dart';

/// Repository untuk fitur Manager.
/// Menangani: getManagerPendingCount, getManagerPendingRequests,
///            updateManagerRequestStatus, getTeamAttendance,
///            getSubordinates, launchPdf.
class ManagerRepository {
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
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/manager/pending-requests?type=$type'),
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
      return {'status': 'error', 'message': 'Koneksi gagal.'};
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
        return body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<List<dynamic>?> getSubordinates() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/employees?is_team=true&per_page=100'),
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
