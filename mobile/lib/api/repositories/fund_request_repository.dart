import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../api_client.dart';

/// Repository untuk fitur Pengajuan Dana (Fund Requests).
/// Menangani: getFundRequests, submitFundRequest, deleteFundRequest.
class FundRequestRepository {
  static Future<List<dynamic>?> getFundRequests() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/fund-requests'),
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

  static Future<Map<String, dynamic>> submitFundRequest(
    Map<String, dynamic> data, {
    String? attachmentPath,
  }) async {
    try {
      final headers = await ApiClient.getHeaders();
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiClient.baseUrl}/fund-requests'),
      );

      // Add auth headers
      request.headers.addAll(headers);

      // Add form fields
      request.fields['amount'] = data['amount'].toString();
      request.fields['reason'] = data['reason'].toString();

      // Add attachment file if provided
      if (attachmentPath != null && File(attachmentPath).existsSync()) {
        request.files.add(
          await http.MultipartFile.fromPath('attachment', attachmentPath),
        );
      }

      final streamedResponse = await request.send();
      final responseBody = await streamedResponse.stream.bytesToString();
      return jsonDecode(responseBody);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }

  static Future<Map<String, dynamic>> deleteFundRequest(int id) async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.delete(
        Uri.parse('${ApiClient.baseUrl}/fund-requests/$id'),
        headers: headers,
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal.'};
    }
  }
}
