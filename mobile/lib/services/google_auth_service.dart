import 'package:google_sign_in/google_sign_in.dart';
import 'package:firebase_auth/firebase_auth.dart';

class GoogleAuthResult {
  final bool success;
  final String? idToken;
  final String? errorMessage;
  final bool isCanceled;

  GoogleAuthResult({
    required this.success,
    this.idToken,
    this.errorMessage,
    this.isCanceled = false,
  });
}

class GoogleAuthService {
  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  static const String webClientId =
      '1015918555814-0qod31fvuc96odo10a2uqmppoqf9vegi.apps.googleusercontent.com';

  /// Sign in with Google dan kembalikan Google ID Token (bukan Firebase ID Token).
  /// Backend membutuhkan Google ID Token untuk verifikasi via Google_Client.
  Future<GoogleAuthResult> signInWithGoogle() async {
    try {
      // Pastikan GoogleSignIn telah terinisialisasi dengan serverClientId
      try {
        await _googleSignIn.initialize(serverClientId: webClientId);
      } catch (e) {
        // Abaikan jika sudah diinisialisasi sebelumnya
      }

      // 1. Authenticate dengan Google
      final GoogleSignInAccount googleUser = await _googleSignIn.authenticate();

      // 2. Ambil Google ID Token langsung dari hasil autentikasi
      final GoogleSignInAuthentication googleAuth = googleUser.authentication;
      final String? googleIdToken = googleAuth.idToken;

      if (googleIdToken == null) {
        return GoogleAuthResult(
          success: false,
          errorMessage:
              'Gagal mendapatkan Google ID Token. Pastikan akun Google Anda aktif dan terhubung.',
        );
      }

      // 3. (Opsional) Login ke Firebase juga agar state Firebase sinkron
      try {
        final AuthCredential credential = GoogleAuthProvider.credential(
          idToken: googleIdToken,
        );
        await _auth.signInWithCredential(credential);
      } catch (e) {
        print("Firebase sign-in optional error (ignored): $e");
      }

      // 4. Kembalikan Google ID Token untuk dikirim ke backend
      return GoogleAuthResult(
        success: true,
        idToken: googleIdToken,
      );
    } on GoogleSignInException catch (e) {
      print("Google Sign-In Exception: ${e.code} - ${e.description}");
      if (e.code == GoogleSignInExceptionCode.canceled) {
        return GoogleAuthResult(success: false, isCanceled: true);
      }
      if (e.code == GoogleSignInExceptionCode.clientConfigurationError) {
        return GoogleAuthResult(
          success: false,
          errorMessage:
              'Konfigurasi SHA-1 / Google OAuth belum terdaftar di Firebase Console.',
        );
      }
      return GoogleAuthResult(
        success: false,
        errorMessage: 'Gagal login Google (${e.code.name}): ${e.description ?? "Terjadi kesalahan"}',
      );
    } catch (e) {
      print("Detail Error Google Sign-In: $e");
      return GoogleAuthResult(
        success: false,
        errorMessage: 'Detail Error Google Sign-In: $e',
      );
    }
  }

  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
      await _auth.signOut();
    } catch (e) {
      print("Error Sign Out: $e");
    }
  }
}
