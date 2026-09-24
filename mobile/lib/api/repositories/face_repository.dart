import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../api_client.dart';

/// Repository untuk fitur Pendaftaran & Status Wajah AI (Face Recognition)
class FaceRepository {
  /// Mengambil status verifikasi wajah saat ini
  static Future<Map<String, dynamic>?> getFaceStatus() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.get(
        Uri.parse('${ApiClient.baseUrl}/mobile/face/status'),
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

  /// Mendaftarkan foto wajah selfie (Self-service)
  static Future<Map<String, dynamic>?> registerFace(String imagePath) async {
    try {
      final uri = Uri.parse('${ApiClient.baseUrl}/mobile/face/register');
      final request = http.MultipartRequest('POST', uri);

      final headers = await ApiClient.getHeaders();
      request.headers.addAll(headers);

      if (await File(imagePath).exists()) {
        request.files.add(
          await http.MultipartFile.fromPath('image', imagePath),
        );
      } else {
        return {
          'status': 'error',
          'message': 'File foto tidak ditemukan.',
        };
      }

      final streamedResponse = await ApiClient.client.send(request);
      final response = await http.Response.fromStream(streamedResponse);
      final responseData = jsonDecode(response.body);

      if (response.statusCode == 200 || response.statusCode == 201) {
        return responseData;
      } else {
        return {
          'status': 'error',
          'message': responseData['message'] ?? 'Gagal mendaftarkan wajah.',
          'errors': responseData['errors'],
        };
      }
    } catch (e) {
      return {
        'status': 'error',
        'message': 'Terjadi kesalahan koneksi: ${e.toString()}',
      };
    }
  }

  /// Reset pendaftaran wajah (jika ditolak atau ingin foto ulang)
  static Future<Map<String, dynamic>?> resetFace() async {
    try {
      final headers = await ApiClient.getHeaders();
      final response = await ApiClient.client.post(
        Uri.parse('${ApiClient.baseUrl}/mobile/face/reset'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}
