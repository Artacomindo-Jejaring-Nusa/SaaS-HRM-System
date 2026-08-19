import 'dart:convert';
import 'package:http/http.dart' as http;
import '../api_client.dart';

/// Repository untuk fitur Dashboard.
/// Menangani: getLeaderboard, getMobileDashboard, getBirthdays.
class DashboardRepository {
  static Future<Map<String, dynamic>?> getLeaderboard() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/dashboard/leaderboard'),
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

  static Future<Map<String, dynamic>?> getMobileDashboard() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/mobile/dashboard'),
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

  static Future<Map<String, dynamic>?> getBirthdays({int? month}) async {
    try {
      final headers = await ApiClient.getHeaders();
      final uri = month != null
          ? Uri.parse('${ApiClient.baseUrl}/dashboard/birthdays?month=$month')
          : Uri.parse('${ApiClient.baseUrl}/dashboard/birthdays');
      final response = await ApiClient.client.get(
        uri,
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
}
