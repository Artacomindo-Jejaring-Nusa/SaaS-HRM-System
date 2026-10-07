import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import '../../api/api_service.dart';
import '../../widgets/skeleton_loading.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _userData;
  bool _isLoading = true;
  bool _isSaving = false;

  final Color maroon = Color(0xFF800000);

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  void _loadProfile() async {
    final data = await ApiService.getProfile();
    if (mounted) {
      setState(() {
        _userData = data;
        _isLoading = false;
      });
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: Icon(Icons.photo_library, color: maroon),
              title: Text('Galeri'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
            ListTile(
              leading: Icon(Icons.camera_alt, color: maroon),
              title: Text('Kamera'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
          ],
        ),
      ),
    );

    if (source != null && mounted) {
      final XFile? pickedFile = await picker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );

      if (pickedFile != null && mounted) {
        setState(() => _isSaving = true);
        final result = await ApiService.uploadProfilePhoto(pickedFile.path);
        if (!mounted) return;
        setState(() => _isSaving = false);

        if (result['success']) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Foto profil berhasil diperbarui'),
              backgroundColor: Colors.green,
            ),
          );
          _loadProfile(); // Refresh for new URL
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Gagal mengunggah foto profil'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  String _fixPhotoUrl(String? url) {
    return ApiService.fixUrl(url);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const ProfileSkeleton();
    }

    final name = _userData?['name'] ?? 'Karyawan';
    final role = _userData?['role']?['name'] ?? '-';
    final email = _userData?['email'] ?? '-';
    final phone = _userData?['phone'] ?? '-';
    final nik = _userData?['nik'] ?? '-';
    final address = _userData?['address'] ?? '-';
    final joinDate = _userData?['join_date'] ?? '-';
    final photoUrl = _fixPhotoUrl(_userData?['profile_photo_url']);

    return Column(
      children: [
        // Header
        Padding(
          padding: EdgeInsets.fromLTRB(25, 20, 25, 0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Profil Saya",
                style: GoogleFonts.outfit(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: maroon.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Icon(Icons.verified_user_outlined, color: maroon, size: 14),
                    SizedBox(width: 4),
                    Text(
                      "Data Terverifikasi",
                      style: TextStyle(
                        color: maroon,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(horizontal: 25),
            child: Column(
              children: [
                SizedBox(height: 15),
                // Foto Profil dengan tombol ganti foto
                Stack(
                  children: [
                    CircleAvatar(
                      radius: 50,
                      backgroundColor: maroon,
                      backgroundImage: photoUrl.isNotEmpty
                          ? NetworkImage(photoUrl)
                          : null,
                      child: photoUrl.isEmpty
                          ? Text(
                              name.isNotEmpty ? name[0].toUpperCase() : 'U',
                              style: TextStyle(
                                fontSize: 38,
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            )
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: GestureDetector(
                        onTap: _isSaving ? null : _pickImage,
                        child: Container(
                          padding: EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: maroon,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                          child: Icon(
                            Icons.camera_alt,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                    ),
                    if (_isSaving)
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.black26,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                SizedBox(height: 12),
                Text(
                  name,
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  role,
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    color: Colors.grey[600],
                  ),
                ),
                SizedBox(height: 25),

                // Data Profile Cards (Read-Only)
                _buildInfoCard(Icons.person_outline, "Nama Lengkap", name),
                _buildInfoCard(Icons.email_outlined, "Email (Gmail Akun)", email),
                _buildInfoCard(Icons.phone_outlined, "No. Telepon / WhatsApp", phone),
                _buildInfoCard(Icons.badge_outlined, "Nomor Induk Karyawan (NIK)", nik),
                _buildInfoCard(Icons.location_on_outlined, "Alamat Tinggal", address),
                _buildInfoCard(Icons.calendar_today_outlined, "Tanggal Bergabung", joinDate),
                _buildInfoCard(Icons.shield_outlined, "Jabatan / Role", role),

                SizedBox(height: 15),

                // Informasi Kebijakan Data
                Container(
                  padding: EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Color(0xFFFFF7ED),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline_rounded, color: Colors.orange[800], size: 20),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          "Untuk menjaga validitas data kepegawaian, perubahan data pribadi (Email, NIK, Telepon, dan Alamat) hanya dapat dilakukan oleh Super Admin / HRD melalui Web Dashboard.",
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.orange[900],
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                SizedBox(height: 30),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // READ-ONLY INFO CARD
  Widget _buildInfoCard(IconData icon, String label, String value) {
    return Container(
      margin: EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(icon, color: maroon, size: 22),
          SizedBox(width: 15),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                ),
                SizedBox(height: 2),
                Text(
                  value.isNotEmpty ? value : '-',
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

