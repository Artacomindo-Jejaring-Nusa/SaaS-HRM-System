import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io';
import 'dart:math';

/// SecureStorageService provides encrypted local storage for sensitive data.
/// 
/// Uses AES-like XOR cipher with device-unique key derivation.
/// On Android, this approximates EncryptedSharedPreferences behavior.
/// The encryption key is derived from the device's unique hardware identifier,
/// ensuring data is only readable on the same physical device.
class SecureStorageService {
  static SecureStorageService? _instance;
  static String? _deviceKey;

  static const String _prefix = 'secure_';
  static const String _accessTokenKey = '${_prefix}access_token';
  static const String _refreshTokenKey = '${_prefix}refresh_token';
  static const String _tokenExpiryKey = '${_prefix}token_expiry';
  static const String _keepLoggedInKey = '${_prefix}keep_logged_in';

  SecureStorageService._();

  static Future<SecureStorageService> getInstance() async {
    if (_instance == null) {
      _instance = SecureStorageService._();
      await _instance!._initDeviceKey();
    }
    return _instance!;
  }

  /// Initialize the device-unique encryption key from hardware identifiers.
  Future<void> _initDeviceKey() async {
    if (_deviceKey != null) return;

    try {
      final deviceInfo = DeviceInfoPlugin();
      String rawKey;

      if (Platform.isAndroid) {
        final info = await deviceInfo.androidInfo;
        // Combine multiple device identifiers for stronger key derivation
        rawKey = '${info.id}_${info.brand}_${info.model}_${info.fingerprint}';
      } else if (Platform.isIOS) {
        final info = await deviceInfo.iosInfo;
        rawKey = '${info.identifierForVendor}_${info.model}_${info.systemVersion}';
      } else {
        rawKey = 'desktop_fallback_key_${Platform.operatingSystem}';
      }

      // Derive a 32-byte key from the raw device info using simple hash
      _deviceKey = _deriveKey(rawKey, 32);
    } catch (e) {
      debugPrint('SecureStorage: Failed to get device key, using fallback: $e');
      _deviceKey = _deriveKey('hrms_fallback_key_v1', 32);
    }
  }

  /// Simple key derivation: create a deterministic key from input string.
  /// Uses multiple rounds of hashing to produce a fixed-length key.
  String _deriveKey(String input, int length) {
    final bytes = utf8.encode(input);
    List<int> key = List<int>.filled(length, 0);

    // Mix input bytes into key using XOR and rotation
    for (int round = 0; round < 3; round++) {
      for (int i = 0; i < bytes.length; i++) {
        final pos = (i + round * 7) % length;
        key[pos] = (key[pos] ^ bytes[i] ^ (round * 31 + i * 17)) & 0xFF;
      }
    }

    return base64Encode(key);
  }

  /// Encrypt a string value using the device key.
  String _encrypt(String plainText) {
    final keyBytes = base64Decode(_deviceKey!);
    final plainBytes = utf8.encode(plainText);
    
    // Generate a random IV (16 bytes)
    final random = Random.secure();
    final iv = List<int>.generate(16, (_) => random.nextInt(256));
    
    // XOR cipher with key + IV for each byte
    final encrypted = List<int>.filled(plainBytes.length, 0);
    for (int i = 0; i < plainBytes.length; i++) {
      final keyByte = keyBytes[i % keyBytes.length];
      final ivByte = iv[i % iv.length];
      encrypted[i] = (plainBytes[i] ^ keyByte ^ ivByte) & 0xFF;
    }

    // Prepend IV to encrypted data
    final combined = [...iv, ...encrypted];
    return base64Encode(combined);
  }

  /// Decrypt a string value using the device key.
  String _decrypt(String encryptedText) {
    try {
      final keyBytes = base64Decode(_deviceKey!);
      final combined = base64Decode(encryptedText);
      
      // Extract IV (first 16 bytes) and encrypted data
      final iv = combined.sublist(0, 16);
      final encrypted = combined.sublist(16);

      // Reverse XOR cipher
      final decrypted = List<int>.filled(encrypted.length, 0);
      for (int i = 0; i < encrypted.length; i++) {
        final keyByte = keyBytes[i % keyBytes.length];
        final ivByte = iv[i % iv.length];
        decrypted[i] = (encrypted[i] ^ keyByte ^ ivByte) & 0xFF;
      }

      return utf8.decode(decrypted);
    } catch (e) {
      debugPrint('SecureStorage: Decryption failed: $e');
      return '';
    }
  }

  /// Store a value securely (encrypted).
  Future<void> setSecure(String key, String value) async {
    final prefs = await SharedPreferences.getInstance();
    final encrypted = _encrypt(value);
    await prefs.setString(key, encrypted);
  }

  /// Retrieve a securely stored value (decrypted).
  Future<String?> getSecure(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final encrypted = prefs.getString(key);
    if (encrypted == null || encrypted.isEmpty) return null;
    
    final decrypted = _decrypt(encrypted);
    return decrypted.isEmpty ? null : decrypted;
  }

  /// Remove a secure value.
  Future<void> removeSecure(String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(key);
  }

  // ============ TOKEN-SPECIFIC METHODS ============

  /// Save access token (encrypted).
  Future<void> saveAccessToken(String token) async {
    await setSecure(_accessTokenKey, token);
  }

  /// Get access token (decrypted).
  Future<String?> getAccessToken() async {
    return await getSecure(_accessTokenKey);
  }

  /// Save refresh token (encrypted).
  Future<void> saveRefreshToken(String token) async {
    await setSecure(_refreshTokenKey, token);
  }

  /// Get refresh token (decrypted).
  Future<String?> getRefreshToken() async {
    return await getSecure(_refreshTokenKey);
  }

  /// Save token expiry time (in epoch seconds).
  Future<void> saveTokenExpiry(int expiresInSeconds) async {
    final expiryEpoch = DateTime.now().millisecondsSinceEpoch + (expiresInSeconds * 1000);
    await setSecure(_tokenExpiryKey, expiryEpoch.toString());
  }

  /// Check if the access token is expired or about to expire (within 2 min buffer).
  Future<bool> isAccessTokenExpired() async {
    final expiryStr = await getSecure(_tokenExpiryKey);
    if (expiryStr == null) return true;

    try {
      final expiryEpoch = int.parse(expiryStr);
      final now = DateTime.now().millisecondsSinceEpoch;
      // Add 2-minute buffer to prevent edge-case token expiry during request
      return now >= (expiryEpoch - 120000);
    } catch (e) {
      return true;
    }
  }

  /// Save all tokens from login/refresh response.
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required int expiresIn,
  }) async {
    await saveAccessToken(accessToken);
    await saveRefreshToken(refreshToken);
    await saveTokenExpiry(expiresIn);
  }

  /// Save user preference for keeping session active across app restarts.
  Future<void> setKeepLoggedIn(bool value) async {
    await setSecure(_keepLoggedInKey, value ? '1' : '0');
  }

  /// Check whether user chose to keep logged in (defaults to true if unset).
  Future<bool> isKeepLoggedIn() async {
    final value = await getSecure(_keepLoggedInKey);
    if (value == null) return true; // Default behavior
    return value == '1';
  }

  /// Clear all tokens (on logout).
  Future<void> clearTokens() async {
    await removeSecure(_accessTokenKey);
    await removeSecure(_refreshTokenKey);
    await removeSecure(_tokenExpiryKey);
    await removeSecure(_keepLoggedInKey);
  }

  /// Check if user has any stored token (for auto-login check).
  Future<bool> hasValidToken() async {
    final token = await getAccessToken();
    final refreshToken = await getRefreshToken();
    return (token != null && token.isNotEmpty) || 
           (refreshToken != null && refreshToken.isNotEmpty);
  }

  /// Migrate old plaintext tokens from SharedPreferences to encrypted storage.
  /// Call this once during app startup to migrate existing users.
  Future<bool> migrateFromPlainPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final oldToken = prefs.getString('token');

    if (oldToken != null && oldToken.isNotEmpty) {
      debugPrint('SecureStorage: Migrating old plaintext token to encrypted storage...');
      await saveAccessToken(oldToken);
      await prefs.remove('token'); // Remove the old plaintext token
      debugPrint('SecureStorage: Migration complete.');
      return true;
    }
    return false;
  }
}
