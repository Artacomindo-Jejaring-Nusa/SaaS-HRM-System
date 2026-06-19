import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../api_client.dart';

/// Repository untuk fitur Absensi.
/// Menangani: getAttendanceHistory, getTodayAttendance, checkIn, checkOut.
class AttendanceRepository {
  static Future<List<dynamic>?> getAttendanceHistory() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/attendance/history'),
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
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/attendance/today'),
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
    String? imagePath,
    String? deviceId,
    bool isMocked = false,
  }) async {
    return _submitAttendance(
      '${ApiClient.baseUrl}/attendance/check-in',
      lat,
      lng,
      imagePath: imagePath,
      deviceId: deviceId,
      isMocked: isMocked,
    );
  }

  static Future<Map<String, dynamic>?> checkOut(
    double lat,
    double lng, {
    String? imagePath,
    String? deviceId,
    bool isMocked = false,
  }) async {
    return _submitAttendance(
      '${ApiClient.baseUrl}/attendance/check-out',
      lat,
      lng,
      imagePath: imagePath,
      deviceId: deviceId,
      isMocked: isMocked,
    );
  }

  /// Shared method for check-in and check-out using multipart/form-data.
  static Future<Map<String, dynamic>?> _submitAttendance(
    String url,
    double lat,
    double lng, {
    String? imagePath,
    String? deviceId,
    bool isMocked = false,
  }) async {
    try {
      final headers = await ApiClient.getHeaders();
      final request = http.MultipartRequest('POST', Uri.parse(url));

      // Add auth headers
      request.headers.addAll(headers);

      // Add form fields
      request.fields['latitude'] = lat.toString();
      request.fields['longitude'] = lng.toString();
      request.fields['is_mocked'] = isMocked ? '1' : '0';
      if (deviceId != null) {
        request.fields['device_id'] = deviceId;
      }

      // Add image file if provided
      if (imagePath != null && File(imagePath).existsSync()) {
        request.files.add(
          await http.MultipartFile.fromPath('image', imagePath),
        );
      }

      final streamedResponse = await request.send();
      final responseBody = await streamedResponse.stream.bytesToString();
      return jsonDecode(responseBody);
    } catch (e) {
      return null;
    }
  }
}
