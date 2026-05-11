import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import '../api/api_service.dart';
import '../services/fcm_service.dart';
import '../services/google_auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _companyController = TextEditingController();
  bool _isLoading = false;
  bool _obscureText = true;
  List<dynamic> _companySuggestions = [];
  bool _showCompanySuggestions = false;
  bool _isSearching = false;
  Timer? _searchTimer;

  // Warna Tema Maroon
  final Color maroon = const Color(0xFF800000);
  final Color maroonLight = const Color(0xFFAD2831);
  final Color naturalGrey = const Color(0xFFF9FAFB); // Changed from reddish maroonSoft

  // PageController untuk swipe antara Onboarding & Login
  final PageController _pageController = PageController();

  void _goToLogin() {
    _pageController.animateToPage(
      1,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeInOut,
    );
  }

  void _goToOnboarding() {
    _pageController.animateToPage(
      0,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeInOut,
    );
  }

  void _onCompanyChanged(String value) {
    if (_searchTimer?.isActive ?? false) _searchTimer!.cancel();

    if (value.trim().length < 2) {
      setState(() {
        _companySuggestions = [];
        _showCompanySuggestions = false;
        _isSearching = false;
      });
      return;
    }

    setState(() {
      _showCompanySuggestions = true;
      _isSearching = true;
    });

    _searchTimer = Timer(const Duration(milliseconds: 500), () async {
      final results = await ApiService.searchCompanies(value);
      if (mounted) {
        setState(() {
          _companySuggestions = results;
          _isSearching = false;
        });
      }
    });
  }

  void _selectCompany(String name) {
    setState(() {
      _companyController.text = name;
      _companySuggestions = [];
      _showCompanySuggestions = false;
    });
    FocusScope.of(context).unfocus();
  }

  void _handleLogin() async {
    if (_emailController.text.isEmpty ||
        _passwordController.text.isEmpty ||
        _companyController.text.isEmpty) {
      _showSnackBar("Email, Password dan Perusahaan wajib diisi!");
      return;
    }

    setState(() => _isLoading = true);

    final result = await ApiService.login(
      _emailController.text,
      _passwordController.text,
      _companyController.text,
    );

    if (!mounted) {
      setState(() => _isLoading = false);
      return;
    }

    setState(() => _isLoading = false);

    if (result['success']) {
      await FcmService.init();
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/dashboard');
      }
    } else {
      _showSnackBar(result['message']);
    }
  }

  void _handleGoogleLogin() async {
    if (_companyController.text.isEmpty) {
      _showSnackBar("Pilih Perusahaan terlebih dahulu!");
      return;
    }

    setState(() => _isLoading = true);

    final googleAuth = GoogleAuthService();

    try {
      // signInWithGoogle() sekarang mengembalikan Google ID Token langsung
      final String? idToken = await googleAuth.signInWithGoogle();

      if (idToken == null) {
        // User membatalkan login
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      // Kirim Google ID Token ke backend Laravel
      final result = await ApiService.loginWithGoogle(
        idToken: idToken,
        companyName: _companyController.text,
      );

      if (!mounted) return;
      setState(() => _isLoading = false);

      if (result['success']) {
        await FcmService.init();
        if (mounted) {
          Navigator.pushReplacementNamed(context, '/dashboard');
        }
      } else {
        _showSnackBar(result['message']);
        await googleAuth.signOut();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showSnackBar("Gagal login dengan Google. Silakan coba lagi.");
      }
    }
  }

  void _showSnackBar(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.redAccent : Colors.green,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: Colors.white,
        body: PageView(
          controller: _pageController,
          onPageChanged: (index) => setState(() {}),
          children: [_buildOnboardingPage(), _buildLoginPage()],
        ),
      ),
    );
  }

  Widget _buildOnboardingPage() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 30),
        child: Column(
          children: [
            SizedBox(height: 30),
            Row(
              children: [
                Icon(Icons.business, color: maroon, size: 28),
                SizedBox(width: 8),
                Flexible(
                  child: Text(
                    "HRMS - SaaS Solution",
                    style: GoogleFonts.outfit(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: maroon,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            SizedBox(height: 30),
            Expanded(
              flex: 5,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.asset(
                  'assets/images/workers_illustration.jpg',
                  fit: BoxFit.contain,
                ),
              ),
            ),
            SizedBox(height: 30),
            RichText(
              textAlign: TextAlign.center,
              text: TextSpan(
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.black,
                ),
                children: [
                  TextSpan(text: "Optimize "),
                  TextSpan(
                    text: "Workers",
                    style: TextStyle(color: maroon),
                  ),
                ],
              ),
            ),
            SizedBox(height: 12),
            Text(
              "Management SDM menjadi lebih mudah,\natur rurinitas harian dengan efisien.",
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                color: Colors.grey[600],
                fontSize: 14,
                height: 1.5,
              ),
            ),
            Spacer(flex: 1),
            SizedBox(
              width: double.infinity,
              height: 55,
              child: ElevatedButton(
                onPressed: _goToLogin,
                style: ElevatedButton.styleFrom(
                  backgroundColor: maroon,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30),
                  ),
                  elevation: 3,
                ),
                child: Text(
                  "Sign in",
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            SizedBox(height: 25),
          ],
        ),
      ),
    );
  }

  Widget _buildLoginPage() {
    return SafeArea(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 30),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(height: 30),
              Row(
                children: [
                  IconButton(
                    icon: Icon(Icons.arrow_back_ios, color: maroon),
                    onPressed: _goToOnboarding,
                  ),
                  Icon(Icons.business, color: maroon, size: 24),
                  SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      "Login Portal",
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: maroon,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 40),
              Text(
                "Sign in",
                style: GoogleFonts.outfit(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.black,
                ),
              ),
              SizedBox(height: 8),
              Text(
                "Masukan kredensial akun Anda",
                style: GoogleFonts.outfit(
                  color: Colors.grey[500],
                  fontSize: 14,
                ),
              ),
              SizedBox(height: 40),

              // Input Company
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    decoration: BoxDecoration(
                    color: naturalGrey,
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: TextField(
                      controller: _companyController,
                      onChanged: _onCompanyChanged,
                      style: TextStyle(color: Colors.black),
                      decoration: InputDecoration(
                        hintText: "Nama Perusahaan (Misal: Narwasthu)",
                        hintStyle: TextStyle(color: Colors.grey[400]),
                        prefixIcon: Icon(
                          Icons.business_outlined,
                          color: maroon,
                        ),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 18,
                        ),
                      ),
                    ),
                  ),
                  if (_showCompanySuggestions)
                    Container(
                      margin: EdgeInsets.only(top: 5),
                      padding: EdgeInsets.symmetric(vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(15),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black12,
                            blurRadius: 10,
                            offset: Offset(0, 5),
                          ),
                        ],
                      ),
                      constraints: BoxConstraints(maxHeight: 200),
                      child: _isSearching
                          ? Center(
                              child: Padding(
                                padding: const EdgeInsets.all(15.0),
                                child: SpinKitThreeBounce(
                                  color: maroon,
                                  size: 20,
                                ),
                              ),
                            )
                          : _companySuggestions.isEmpty
                          ? Padding(
                              padding: const EdgeInsets.all(15.0),
                              child: Text(
                                "Tidak Ada Perusahaan tersebut",
                                textAlign: TextAlign.center,
                                style: GoogleFonts.outfit(
                                  color: Colors.grey[500],
                                  fontSize: 13,
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            )
                          : ListView.builder(
                              shrinkWrap: true,
                              itemCount: _companySuggestions.length,
                              itemBuilder: (context, index) {
                                final company = _companySuggestions[index];
                                return ListTile(
                                  leading: Icon(
                                    Icons.location_city,
                                    color: maroon,
                                    size: 20,
                                  ),
                                  title: Text(
                                    company['name'],
                                    style: GoogleFonts.outfit(fontSize: 14),
                                  ),
                                  onTap: () => _selectCompany(company['name']),
                                );
                              },
                            ),
                    ),
                ],
              ),
              SizedBox(height: 18),

              // Input Email
              Container(
                decoration: BoxDecoration(
                  color: naturalGrey,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  style: TextStyle(color: Colors.black),
                  decoration: InputDecoration(
                    hintText: "Email",
                    hintStyle: TextStyle(color: Colors.grey[400]),
                    prefixIcon: Icon(Icons.mail_outline, color: maroon),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 18,
                    ),
                  ),
                ),
              ),
              SizedBox(height: 18),

              // Input Password
              Container(
                decoration: BoxDecoration(
                  color: naturalGrey,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: TextField(
                  controller: _passwordController,
                  obscureText: _obscureText,
                  style: TextStyle(color: Colors.black),
                  decoration: InputDecoration(
                    hintText: "Password",
                    hintStyle: TextStyle(color: Colors.grey[400]),
                    prefixIcon: Icon(Icons.lock_outline, color: maroon),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureText
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: Colors.grey[400],
                      ),
                      onPressed: () =>
                          setState(() => _obscureText = !_obscureText),
                    ),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 18,
                    ),
                  ),
                ),
              ),
              SizedBox(height: 35),
              SizedBox(
                width: double.infinity,
                height: 55,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: maroon,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                    elevation: 3,
                    disabledBackgroundColor: maroon.withAlpha(153),
                  ),
                  child: _isLoading
                      ? SpinKitThreeBounce(color: Colors.white, size: 20)
                      : Text(
                          "Sign in",
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
              SizedBox(height: 25),
              Row(
                children: [
                  Expanded(child: Divider(color: Colors.grey[300])),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 15),
                    child: Text(
                      "Atau masuk dengan",
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        color: Colors.grey[400],
                      ),
                    ),
                  ),
                  Expanded(child: Divider(color: Colors.grey[300])),
                ],
              ),
              SizedBox(height: 25),
              SizedBox(
                width: double.infinity,
                height: 55,
                child: OutlinedButton(
                  onPressed: _isLoading ? null : _handleGoogleLogin,
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: Colors.grey[300]!),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        width: 22,
                        height: 22,
                        child: CustomPaint(
                          painter: _GoogleLogoPainter(),
                        ),
                      ),
                      SizedBox(width: 12),
                      Text(
                        "Login with Google",
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(height: 40),
              Center(
                child: Text(
                  "Lupa password atau kendala login?\nHubungi Admin Perusahaan Anda.",
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: Colors.grey[500],
                  ),
                ),
              ),
              SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}

/// Custom painter for the official Google "G" logo with 4 brand colors
class _GoogleLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;
    final double cx = w / 2;
    final double cy = h / 2;
    final double r = w / 2;
    final double strokeW = w * 0.2;

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeW
      ..strokeCap = StrokeCap.butt;

    // Blue (right arc: -45° to 45°, i.e. 315° to 45°)
    paint.color = const Color(0xFF4285F4);
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: r - strokeW / 2),
      -0.785, // -45 degrees
      1.57,   // 90 degrees sweep
      false,
      paint,
    );

    // Green (bottom arc: 45° to 135°)
    paint.color = const Color(0xFF34A853);
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: r - strokeW / 2),
      0.785,  // 45 degrees
      1.57,   // 90 degrees sweep
      false,
      paint,
    );

    // Yellow (left arc: 135° to 200°)
    paint.color = const Color(0xFFFBBC05);
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: r - strokeW / 2),
      2.356,  // 135 degrees
      1.13,   // ~65 degrees sweep
      false,
      paint,
    );

    // Red (top-left arc: 200° to 315°)
    paint.color = const Color(0xFFEA4335);
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: r - strokeW / 2),
      3.49,   // 200 degrees
      1.93,   // ~115 degrees sweep
      false,
      paint,
    );

    // Horizontal bar (blue)
    final barPaint = Paint()
      ..color = const Color(0xFF4285F4)
      ..style = PaintingStyle.fill;
    canvas.drawRect(
      Rect.fromLTWH(cx - 1, cy - strokeW / 2, r, strokeW),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
