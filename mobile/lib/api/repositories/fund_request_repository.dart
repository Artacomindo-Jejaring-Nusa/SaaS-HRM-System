import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart' as p;
import '../api_client.dart';

/// Repository untuk fitur Pengajuan Dana (Fund Requests).
/// Menangani: getFundRequests, submitFundRequest, updateFundRequest, deleteFundRequest.
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
    List<String>? filePaths,
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
      data.forEach((key, value) {
        if (value != null) {
          request.fields[key] = value.toString();
        }
      });

      // Add single attachment file if provided
      if (attachmentPath != null && File(attachmentPath).existsSync()) {
        final ext = p.extension(attachmentPath).toLowerCase();
        String mime = 'image/jpeg';
        if (ext == '.png') mime = 'image/png';
        if (ext == '.pdf') mime = 'application/pdf';
        request.files.add(
          await http.MultipartFile.fromPath(
            'attachment',
            attachmentPath,
            contentType: MediaType.parse(mime),
          ),
        );
      }

      // Add multiple attachments if provided
      if (filePaths != null && filePaths.isNotEmpty) {
        for (var filePath in filePaths) {
          if (File(filePath).existsSync()) {
            final ext = p.extension(filePath).toLowerCase();
            String mime = 'image/jpeg';
            if (ext == '.png') mime = 'image/png';
            if (ext == '.pdf') mime = 'application/pdf';

            request.files.add(
              await http.MultipartFile.fromPath(
                'attachments[]',
                filePath,
                contentType: MediaType.parse(mime),
                filename:
                    'proposal_${DateTime.now().millisecondsSinceEpoch}_${filePaths.indexOf(filePath)}$ext',
              ),
            );
          }
        }
      }

      final streamedResponse = await request.send();
      final responseBody = await streamedResponse.stream.bytesToString();
      return jsonDecode(responseBody);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal: ${e.toString()}'};
    }
  }

  static Future<Map<String, dynamic>> updateFundRequest(
    int id,
    Map<String, dynamic> data, {
    String? attachmentPath,
    List<String>? filePaths,
  }) async {
    try {
      final headers = await ApiClient.getHeaders();
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiClient.baseUrl}/fund-requests/$id'),
      );

      // Add auth headers
      request.headers.addAll(headers);

      // Add form fields
      data.forEach((key, value) {
        if (value != null) {
          request.fields[key] = value.toString();
        }
      });

      // Add single attachment file if provided
      if (attachmentPath != null && File(attachmentPath).existsSync()) {
        final ext = p.extension(attachmentPath).toLowerCase();
        String mime = 'image/jpeg';
        if (ext == '.png') mime = 'image/png';
        if (ext == '.pdf') mime = 'application/pdf';
        request.files.add(
          await http.MultipartFile.fromPath(
            'attachment',
            attachmentPath,
            contentType: MediaType.parse(mime),
          ),
        );
      }

      // Add multiple attachments if provided
      if (filePaths != null && filePaths.isNotEmpty) {
        for (var filePath in filePaths) {
          if (File(filePath).existsSync()) {
            final ext = p.extension(filePath).toLowerCase();
            String mime = 'image/jpeg';
            if (ext == '.png') mime = 'image/png';
            if (ext == '.pdf') mime = 'application/pdf';

            request.files.add(
              await http.MultipartFile.fromPath(
                'attachments[]',
                filePath,
                contentType: MediaType.parse(mime),
                filename:
                    'proposal_${DateTime.now().millisecondsSinceEpoch}_${filePaths.indexOf(filePath)}$ext',
              ),
            );
          }
        }
      }

      final streamedResponse = await request.send();
      final responseBody = await streamedResponse.stream.bytesToString();
      return jsonDecode(responseBody);
    } catch (e) {
      return {'status': 'error', 'message': 'Koneksi gagal: ${e.toString()}'};
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
