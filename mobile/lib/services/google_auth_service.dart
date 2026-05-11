import 'package:google_sign_in/google_sign_in.dart';
import 'package:firebase_auth/firebase_auth.dart';

class GoogleAuthService {
  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  /// Sign in with Google dan kembalikan Google ID Token (bukan Firebase ID Token).
  /// Backend membutuhkan Google ID Token untuk verifikasi via Google_Client.
  Future<String?> signInWithGoogle() async {
    try {
      // 1. Authenticate dengan Google
      final GoogleSignInAccount googleUser = await _googleSignIn.authenticate();

      // 2. Ambil Google ID Token langsung dari hasil autentikasi
      final GoogleSignInAuthentication googleAuth = googleUser.authentication;
      final String? googleIdToken = googleAuth.idToken;

      if (googleIdToken == null) {
        print("Google ID Token is null");
        return null;
      }

      // 3. (Opsional) Login ke Firebase juga agar state Firebase sinkron
      try {
        final AuthCredential credential = GoogleAuthProvider.credential(
          idToken: googleIdToken,
        );
        await _auth.signInWithCredential(credential);
      } catch (e) {
        print("Firebase sign-in optional error (ignored): $e");
        // Tidak apa-apa jika Firebase gagal, yang penting Google ID Token sudah didapat
      }

      // 4. Kembalikan Google ID Token untuk dikirim ke backend
      return googleIdToken;
    } on GoogleSignInException catch (e) {
      print("Google Sign-In Exception: ${e.code}");
      return null;
    } catch (e) {
      print("Detail Error Google Sign-In: $e");
      return null;
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
