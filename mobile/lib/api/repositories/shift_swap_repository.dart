import 'dart:convert';
import '../api_client.dart';

/// Repository untuk fitur Tukar Shift (Shift Swap).
/// Menangani: getShiftSwaps, submitShiftSwap, respondShiftSwap,
///            approveShiftSwap, getSchedules, getEmployees.
class ShiftSwapRepository {
  static Future<List<dynamic>?> getShiftSwaps() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/shift-swap'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['data'] is List) {
          return body['data'];
        } else if (body['data'] is Map && body['data']['data'] is List) {
          return body['data']['data'];
        }
        return [];
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
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/shift-swap'),
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
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/shift-swap/$id/respond'),
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
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/shift-swap/$id/approve'),
        headers: headers,
        body: jsonEncode({'status': status}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<List<dynamic>?> getSchedules({int? userId, String? startDate}) async {
    try {
      final headers = await ApiClient.getHeaders();
      String url = '${ApiClient.baseUrl}/schedules?per_page=100';
      if (userId != null) url += '&user_id=$userId';
      if (startDate != null) url += '&start_date=$startDate';
      final response = await ApiClient.client.get(Uri.parse(url), headers: headers);
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['data'] is List) {
          return body['data'];
        } else if (body['data'] is Map && body['data']['data'] is List) {
          return body['data']['data'];
        }
        return [];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<List<dynamic>?> getEmployees({String? attendanceType}) async {
    try {
      final headers = await ApiClient.getHeaders();
      String url = '${ApiClient.baseUrl}/employees?per_page=100';
      if (attendanceType != null) {
        url += '&attendance_type=$attendanceType';
      }
      final response = await ApiClient.client.get(
        Uri.parse(url),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['data'] is List) {
          return body['data'];
        } else if (body['data'] is Map && body['data']['data'] is List) {
          return body['data']['data'];
        }
        return [];
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}
