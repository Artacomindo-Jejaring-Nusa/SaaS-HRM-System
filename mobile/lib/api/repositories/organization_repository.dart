import 'dart:convert';
import '../api_client.dart';

/// Repository untuk fitur Bagan Organisasi (Organization Chart).
/// Menangani pembacaan data struktur organisasi perusahaan (Read-Only).
class OrganizationRepository {
  static Future<Map<String, dynamic>?> getOrganizationChart({int? companyId}) async {
    try {
      final headers = await ApiClient.getHeaders();
      String url = '${ApiClient.baseUrl}/organization-chart';
      if (companyId != null) {
        url += '?company_id=$companyId';
      }

      final response = await ApiClient.client.get(
        Uri.parse(url),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['data'] != null && body['data'] is Map<String, dynamic>) {
          return Map<String, dynamic>.from(body['data']);
        }
        return null;
      } else {
        print('[OrgChart] Failed: HTTP ${response.statusCode}, Body: ${response.body}');
        return null;
      }
    } catch (e) {
      print('[OrgChart] Exception: $e');
      return null;
    }
  }
}
