import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart' as p;
import '../api_client.dart';

/// Repository untuk fitur Kendaraan (Fleet/Vehicle Logging).
/// Menangani: getVehicleLogs, getAvailableVehicles, getVehicleReport,
///            submitDeparture, submitReturn, approveVehicleLog, rejectVehicleLog.
class VehicleRepository {
  static Future<List<dynamic>?> getVehicleLogs() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/vehicle-logs'),
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
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/vehicle-logs/vehicles'),
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
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/vehicle-logs/report'),
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

  static Future<Map<String, dynamic>> submitLoanRequest(
    Map<String, dynamic> data,
  ) async {
    try {
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/vehicle-logs/request'),
        headers: headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal: ${e.toString()}'};
    }
  }

  static Future<Map<String, dynamic>> submitDeparture(
    Map<String, String> data,
    String? photoPath, {
    int? id,
  }) async {
    try {
      final headers = await ApiClient.getHeaders();
      final uri = id != null
          ? Uri.parse('${ApiClient.baseUrl}/vehicle-logs/$id/departure')
          : Uri.parse('${ApiClient.baseUrl}/vehicle-logs/departure');

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

      final streamedResponse = await ApiClient.client.send(request);
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
      final headers = await ApiClient.getHeaders();
      final uri = Uri.parse('${ApiClient.baseUrl}/vehicle-logs/$id/return');

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

      final streamedResponse = await ApiClient.client.send(request);
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
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/vehicle-logs/$id/approve'),
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
      final headers = await ApiClient.getHeaders();
      headers['Content-Type'] = 'application/json';
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/vehicle-logs/$id/reject'),
        headers: headers,
        body: jsonEncode({'remark': remark}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }
}
