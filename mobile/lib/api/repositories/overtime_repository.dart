import 'dart:convert';
import 'package:http/http.dart' as http;
import '../api_client.dart';

/// Repository untuk fitur Lembur (Overtime).
/// Menangani: getOvertimes, submitOvertime.
class OvertimeRepository {
  static Future<List<dynamic>?> getOvertimes({String type = 'received'}) async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/overtimes?type=$type'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']['data'] ?? body['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> respondOvertime(
    int id,
    String action, {
    String? reason,
  }) async {
    try {
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final payload = <String, dynamic>{'action': action};
      if (reason != null && reason.isNotEmpty) {
        payload['reason'] = reason;
      }
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/overtimes/$id/respond'),
        headers: headers,
        body: jsonEncode(payload),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> submitOvertime(
    Map<String, dynamic> data,
  ) async {
    try {
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/overtimes'),
        headers: headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> updateOvertime(
    int id,
    Map<String, dynamic> data,
  ) async {
    try {
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.put(
        Uri.parse('${ApiClient.baseUrl}/overtimes/$id'),
        headers: headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> deleteOvertime(int id) async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.delete(
        Uri.parse('${ApiClient.baseUrl}/overtimes/$id'),
        headers: headers,
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<List<dynamic>?> getEmployees() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/employees?per_page=100'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']?['data'] ?? body['data'];
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static Future<List<dynamic>?> getRoles() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/roles'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']?['data'] ?? body['data'];
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
