import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart' as p;
import '../api_client.dart';

/// Repository untuk fitur Reimbursement.
/// Menangani: getReimbursements, submitReimbursement, updateReimbursement, deleteReimbursement.
class ReimbursementRepository {
  static Future<List<dynamic>?> getReimbursements() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/reimbursements'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body['data']['data'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> submitReimbursement(
    Map<String, String> data, {
    List<String>? filePaths,
  }) async {
    try {
      final headers = await ApiClient.getHeaders();
      final uri = Uri.parse('${ApiClient.baseUrl}/reimbursements');

      var request = http.MultipartRequest('POST', uri);
      request.headers.addAll(headers);
      request.fields.addAll(data);

      if (filePaths != null && filePaths.isNotEmpty) {
        for (var filePath in filePaths) {
          final extension = p.extension(filePath).toLowerCase();
          String mimeType = 'image/jpeg';
          if (extension == '.png') mimeType = 'image/png';
          if (extension == '.webp') mimeType = 'image/webp';

          request.files.add(
            await http.MultipartFile.fromPath(
              'attachments[]',
              filePath,
              contentType: MediaType.parse(mimeType),
              filename:
                  'receipt_${DateTime.now().millisecondsSinceEpoch}_${filePaths.indexOf(filePath)}$extension',
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

  static Future<Map<String, dynamic>> updateReimbursement(
    int id,
    Map<String, String> data, {
    List<String>? filePaths,
  }) async {
    try {
      final headers = await ApiClient.getHeaders();
      final uri = Uri.parse('${ApiClient.baseUrl}/reimbursements/$id');

      var request = http.MultipartRequest('POST', uri);
      request.headers.addAll(headers);
      request.fields.addAll(data);

      if (filePaths != null && filePaths.isNotEmpty) {
        for (var filePath in filePaths) {
          final extension = p.extension(filePath).toLowerCase();
          String mimeType = 'image/jpeg';
          if (extension == '.png') mimeType = 'image/png';
          if (extension == '.webp') mimeType = 'image/webp';

          request.files.add(
            await http.MultipartFile.fromPath(
              'attachments[]',
              filePath,
              contentType: MediaType.parse(mimeType),
              filename:
                  'receipt_${DateTime.now().millisecondsSinceEpoch}_${filePaths.indexOf(filePath)}$extension',
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

  static Future<Map<String, dynamic>> deleteReimbursement(int id) async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.delete(
        Uri.parse('${ApiClient.baseUrl}/reimbursements/$id'),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal: ${e.toString()}'};
    }
  }
}
