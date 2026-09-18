import 'dart:convert';
import '../../services/secure_storage_service.dart';
import '../api_client.dart';

/// Repository untuk fitur Employee Tracking.
/// Menangani: updateLiveLocation.
class TrackingRepository {
  static Future<Map<String, dynamic>> updateLiveLocation(
    double lat,
    double lng,
    double accuracy, {
    int? batteryLevel,
    DateTime? recordedAt,
  }) async {
    final secureStorage = await SecureStorageService.getInstance();
    final token = await secureStorage.getAccessToken();
    if (token == null) throw Exception("Token tidak ditemukan");

    final Map<String, dynamic> bodyData = {
      'latitude': lat,
      'longitude': lng,
      'accuracy': accuracy,
    };

    if (batteryLevel != null) {
      bodyData['battery_level'] = batteryLevel;
    }

    if (recordedAt != null) {
      bodyData['recorded_at'] = recordedAt.toIso8601String();
    }

    final res = await ApiClient.client.post(
      Uri.parse('${ApiClient.baseUrl}/tracking/update'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      },
      body: jsonEncode(bodyData),
    );

    return jsonDecode(res.body);
  }

  static Future<bool> getMyTrackingStatus() async {
    try {
      final secureStorage = await SecureStorageService.getInstance();
      final token = await secureStorage.getAccessToken();
      if (token == null) return true; // Default to true if not authenticated

      final res = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/tracking/my-status'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        return data['is_tracking_enabled'] ?? true;
      }
    } catch (e) {
      // Fallback
    }
    return true;
  }
}
