import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../services/secure_storage_service.dart';
import '../api_client.dart';

/// Repository untuk fitur Employee Tracking.
/// Menangani: updateLiveLocation.
class TrackingRepository {
  static Future<Map<String, dynamic>> updateLiveLocation(double lat, double lng, double accuracy) async {
    final secureStorage = await SecureStorageService.getInstance();
    final token = await secureStorage.getAccessToken();
    if (token == null) throw Exception("Token tidak ditemukan");

    final res = await ApiClient.client.post(
      Uri.parse('${ApiClient.baseUrl}/tracking/update'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      },
      body: jsonEncode({
        'latitude': lat,
        'longitude': lng,
        'accuracy': accuracy,
      }),
    );

    return jsonDecode(res.body);
  }
}
