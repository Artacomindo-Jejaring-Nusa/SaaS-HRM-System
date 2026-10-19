import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../api_client.dart';

/// Repository untuk fitur Tugas (Tasks).
/// Menangani: getTasks, createTask, deleteTask, updateTaskStatus,
///            updateTaskActivityStatus, uploadTaskEvidence.
class TaskRepository {
  static Future<List<dynamic>?> getTasks({String type = 'received'}) async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/tasks?type=$type'),
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
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final payload = Map<String, dynamic>.from(data);
      if (payload.containsKey('assigned_to') && !payload.containsKey('user_id')) {
        payload['user_id'] = [payload['assigned_to']];
      }
      if (payload.containsKey('due_date') && !payload.containsKey('deadline')) {
        payload['deadline'] = payload['due_date'];
      }
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/tasks'),
        headers: headers,
        body: jsonEncode(payload),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> deleteTask(int taskId) async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.delete(
        Uri.parse('${ApiClient.baseUrl}/tasks/$taskId'),
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
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/tasks/$taskId/status'),
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
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.put(
        Uri.parse('${ApiClient.baseUrl}/tasks/activities/$activityId/status'),
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
      final headers = await ApiClient.getHeaders();
      final uri = Uri.parse('${ApiClient.baseUrl}/tasks/activities/$activityId/evidence');

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

      final streamedResponse = await ApiClient.client.send(request);
      final response = await http.Response.fromStream(streamedResponse);

      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal: ${e.toString()}'};
    }
  }
}
