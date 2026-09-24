import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import '../api/api_service.dart';

enum LivenessStep {
  positionFace,
  blinkEyes,
  turnHead,
  holdStill,
  capturing,
  completed,
}

class FaceRegistrationScreen extends StatefulWidget {
  const FaceRegistrationScreen({super.key});

  @override
  State<FaceRegistrationScreen> createState() => _FaceRegistrationScreenState();
}

class _FaceRegistrationScreenState extends State<FaceRegistrationScreen>
    with WidgetsBindingObserver {
  CameraController? _cameraController;
  List<CameraDescription>? _cameras;
  bool _isCameraReady = false;
  bool _isLoading = true;
  bool _isSubmitting = false;

  Map<String, dynamic>? _faceData;
  String _faceStatus = 'not_registered';

  // Liveness Detection Engine
  final FaceDetector _faceDetector = FaceDetector(
    options: FaceDetectorOptions(
      enableClassification: true,
      enableTracking: true,
      performanceMode: FaceDetectorMode.accurate,
    ),
  );

  LivenessStep _currentStep = LivenessStep.positionFace;
  String _stepInstruction = "Posisikan Wajah Anda di Tengah Lingkaran";
  IconData _stepIcon = Icons.face;
  Color _stepColor = Colors.blueAccent;
  double _progressValue = 0.15;
  bool _isProcessingFrame = false;
  bool _hasBlinkedClosed = false;

  // Counters to prevent false-positive step transitions
  int _faceAlignedFrames = 0;
  int _holdStillFrames = 0;
  static const int _requiredAlignedFrames = 5;
  static const int _requiredHoldFrames = 6;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _fetchFaceStatus();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _faceDetector.close();
    _stopStreamSafe();
    _cameraController?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_cameraController == null || !_cameraController!.value.isInitialized) return;
    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      _stopStreamSafe();
      _cameraController?.dispose();
      _cameraController = null;
      if (mounted) setState(() => _isCameraReady = false);
    } else if (state == AppLifecycleState.resumed) {
      if (_faceStatus == 'not_registered' || _faceStatus == 'rejected') {
        _initCamera();
      }
    }
  }

  Future<void> _stopStreamSafe() async {
    try {
      if (_cameraController != null &&
          _cameraController!.value.isInitialized &&
          _cameraController!.value.isStreamingImages) {
        await _cameraController!.stopImageStream();
      }
    } catch (_) {}
  }

  Future<void> _fetchFaceStatus() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getFaceStatus();
      if (res != null) {
        setState(() {
          _faceData = res;
          _faceStatus = res['face_status'] ?? 'not_registered';
        });
      }
      if (_faceStatus == 'not_registered' || _faceStatus == 'rejected') {
        await _initCamera();
      }
    } catch (e) {
      debugPrint("Error fetching face status: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras != null && _cameras!.isNotEmpty) {
        final frontCam = _cameras!.firstWhere(
          (c) => c.lensDirection == CameraLensDirection.front,
          orElse: () => _cameras!.first,
        );

        _cameraController = CameraController(
          frontCam,
          ResolutionPreset.high,
          enableAudio: false,
          imageFormatGroup: Platform.isAndroid
              ? ImageFormatGroup.nv21
              : ImageFormatGroup.bgra8888,
        );

        await _cameraController!.initialize();
        if (mounted) {
          setState(() {
            _isCameraReady = true;
            _resetLivenessState();
          });
          _startLivenessStream();
        }
      }
    } catch (e) {
      debugPrint("Error initializing camera: $e");
      if (mounted) {
        _showDialog('Error Kamera', 'Gagal menginisialisasi kamera: ${e.toString()}');
      }
    }
  }

  void _resetLivenessState() {
    _currentStep = LivenessStep.positionFace;
    _stepInstruction = "Posisikan Wajah Anda di Tengah Oval";
    _stepIcon = Icons.face;
    _stepColor = Colors.blueAccent;
    _progressValue = 0.15;
    _isProcessingFrame = false;
    _hasBlinkedClosed = false;
    _faceAlignedFrames = 0;
    _holdStillFrames = 0;
  }

  void _startLivenessStream() {
    if (_cameraController == null || !_cameraController!.value.isInitialized) return;
    if (_cameraController!.value.isStreamingImages) return;

    _cameraController!.startImageStream((CameraImage image) {
      if (_isProcessingFrame ||
          _isSubmitting ||
          _currentStep == LivenessStep.completed ||
          _currentStep == LivenessStep.capturing) {
        return;
      }
      _isProcessingFrame = true;
      _processLivenessFrame(image);
    });
  }

  Future<void> _processLivenessFrame(CameraImage image) async {
    try {
      final inputImage = _convertCameraImageToInputImage(image);
      final faces = await _faceDetector.processImage(inputImage);

      if (!mounted) return;

      if (faces.isEmpty) {
        if (_currentStep != LivenessStep.completed &&
            _currentStep != LivenessStep.capturing) {
          setState(() {
            _stepInstruction = "Wajah Tidak Terdeteksi! Hadap ke Kamera";
            _stepColor = Colors.orangeAccent;
            _stepIcon = Icons.face_retouching_off;
          });
          // Reset alignment counter when face lost
          _faceAlignedFrames = 0;
        }
        return;
      }

      final face = faces.first;
      final eulerY = face.headEulerAngleY ?? 0.0;
      final eulerX = face.headEulerAngleX ?? 0.0;
      final leftEye = face.leftEyeOpenProbability ?? 1.0;
      final rightEye = face.rightEyeOpenProbability ?? 1.0;

      switch (_currentStep) {
        case LivenessStep.positionFace:
          if (eulerY.abs() < 10 && eulerX.abs() < 12) {
            _faceAlignedFrames++;
            if (_faceAlignedFrames >= _requiredAlignedFrames) {
              setState(() {
                _currentStep = LivenessStep.blinkEyes;
                _stepInstruction = "Tahap 1: Kedipkan Kedua Mata Anda";
                _stepIcon = Icons.remove_red_eye_outlined;
                _stepColor = Colors.purpleAccent;
                _progressValue = 0.35;
              });
              _faceAlignedFrames = 0;
            } else {
              setState(() {
                _stepInstruction = "Bagus! Tetap di posisi... ($_faceAlignedFrames/$_requiredAlignedFrames)";
                _stepColor = Colors.lightBlueAccent;
              });
            }
          } else {
            _faceAlignedFrames = 0;
            setState(() {
              _stepInstruction = "Tegakkan Wajah Lurus ke Depan";
              _stepColor = Colors.amberAccent;
              _stepIcon = Icons.face;
            });
          }
          break;

        case LivenessStep.blinkEyes:
          if (leftEye < 0.20 && rightEye < 0.20) {
            _hasBlinkedClosed = true;
            setState(() {
              _stepInstruction = "Mata Tertutup Terdeteksi... Buka Mata Anda";
              _stepColor = Colors.deepPurpleAccent;
            });
          } else if (_hasBlinkedClosed && leftEye > 0.55 && rightEye > 0.55) {
            _hasBlinkedClosed = false;
            setState(() {
              _currentStep = LivenessStep.turnHead;
              _stepInstruction = "Tahap 2: Tengok Sedikit ke Samping (Kanan / Kiri)";
              _stepIcon = Icons.rotate_right;
              _stepColor = Colors.cyanAccent;
              _progressValue = 0.60;
            });
          }
          break;

        case LivenessStep.turnHead:
          if (eulerY.abs() > 14) {
            setState(() {
              _currentStep = LivenessStep.holdStill;
              _stepInstruction = "Tahap 3: Hadap Lurus ke Depan & Tahan Sebentar...";
              _stepIcon = Icons.center_focus_strong;
              _stepColor = Colors.greenAccent;
              _progressValue = 0.85;
              _holdStillFrames = 0;
            });
          } else {
            setState(() {
              _stepInstruction = "Tengok ke Kanan atau Kiri sedikit (Euler: ${eulerY.toStringAsFixed(1)}°)";
            });
          }
          break;

        case LivenessStep.holdStill:
          if (eulerY.abs() < 8 && eulerX.abs() < 10) {
            _holdStillFrames++;
            if (_holdStillFrames >= _requiredHoldFrames) {
              // All liveness checks passed — trigger capture
              setState(() {
                _currentStep = LivenessStep.capturing;
                _stepInstruction = "Gerakan Terverifikasi! Merekam Foto Wajah...";
                _stepIcon = Icons.camera_alt;
                _stepColor = Colors.greenAccent;
                _progressValue = 1.0;
              });
              // Schedule capture OUTSIDE this frame callback
              Future.microtask(() => _performCaptureAndUpload());
            } else {
              setState(() {
                _stepInstruction = "Tetap diam... ($_holdStillFrames/$_requiredHoldFrames)";
              });
            }
          } else {
            _holdStillFrames = 0;
            setState(() {
              _stepInstruction = "Hadap lurus ke depan dan tahan";
              _stepColor = Colors.greenAccent;
            });
          }
          break;

        case LivenessStep.capturing:
        case LivenessStep.completed:
          break;
      }
    } catch (e) {
      debugPrint("Liveness process frame error: $e");
    } finally {
      await Future.delayed(const Duration(milliseconds: 120));
      _isProcessingFrame = false;
    }
  }

  /// The actual capture + upload logic. Called after liveness is fully verified.
  /// Stops the image stream first, waits for camera to settle, then takes picture.
  Future<void> _performCaptureAndUpload() async {
    if (_isSubmitting) return;

    // 1. Stop the image stream first
    await _stopStreamSafe();

    // 2. Let camera hardware stabilize after stopping stream
    await Future.delayed(const Duration(milliseconds: 600));

    if (!mounted || _cameraController == null || !_cameraController!.value.isInitialized) {
      _showDialog('Error', 'Kamera tidak tersedia. Silakan coba lagi.');
      _retryLiveness();
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      // 3. Take the picture
      debugPrint("[FaceRegistration] Taking picture...");
      final XFile image = await _cameraController!.takePicture();
      debugPrint("[FaceRegistration] Picture taken at: ${image.path}");

      // Verify file exists and has content
      final file = File(image.path);
      if (!await file.exists()) {
        throw Exception("File foto hasil capture tidak ditemukan di path: ${image.path}");
      }
      final fileSize = await file.length();
      debugPrint("[FaceRegistration] File size: $fileSize bytes");
      if (fileSize < 1000) {
        throw Exception("File foto terlalu kecil ($fileSize bytes), kemungkinan kamera belum siap.");
      }

      // 4. Upload to backend (which calls AI Service for 128-d extraction)
      debugPrint("[FaceRegistration] Uploading to backend...");
      final result = await ApiService.registerFace(image.path);
      debugPrint("[FaceRegistration] Upload result: $result");

      if (!mounted) return;

      if (result != null && (result['status'] == 'success' || result['status'] == true)) {
        setState(() {
          _currentStep = LivenessStep.completed;
          _stepInstruction = "Pendaftaran Wajah Berhasil!";
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Pendaftaran Wajah Berhasil Diajukan! Menunggu persetujuan Admin.'),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 4),
          ),
        );
        // Refresh status to show pending view
        _fetchFaceStatus();
      } else {
        String msg = result?['message'] ?? 'Gagal mendaftarkan wajah.';
        if (result?['errors'] != null) {
          final errs = result!['errors'];
          if (errs is Map && errs.isNotEmpty) {
            msg += '\n${errs.values.map((v) => v is List ? v.join(', ') : v.toString()).join('\n')}';
          }
        }
        _showDialog('Pendaftaran Gagal', msg);
        _retryLiveness();
      }
    } catch (e) {
      debugPrint("[FaceRegistration] Error during capture/upload: $e");
      if (mounted) {
        _showDialog('Error', 'Terjadi kesalahan saat memproses foto wajah:\n${e.toString()}');
        _retryLiveness();
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// Reset liveness state and restart the camera stream for retry
  void _retryLiveness() {
    if (!mounted) return;
    setState(() {
      _resetLivenessState();
      _isSubmitting = false;
    });
    // Small delay before restarting stream
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted && _cameraController != null && _cameraController!.value.isInitialized) {
        _startLivenessStream();
      }
    });
  }

  InputImage _convertCameraImageToInputImage(CameraImage image) {
    final bytes = Platform.isAndroid
        ? image.planes[0].bytes
        : _concatenatePlanes(image.planes);

    final InputImageMetadata metadata = InputImageMetadata(
      size: Size(image.width.toDouble(), image.height.toDouble()),
      rotation: Platform.isIOS
          ? InputImageRotation.rotation90deg
          : InputImageRotation.rotation270deg,
      format: Platform.isIOS
          ? InputImageFormat.bgra8888
          : InputImageFormat.nv21,
      bytesPerRow: image.planes[0].bytesPerRow,
    );

    return InputImage.fromBytes(bytes: bytes, metadata: metadata);
  }

  Uint8List _concatenatePlanes(List<Plane> planes) {
    final BytesBuilder bytesBuilder = BytesBuilder();
    for (final Plane plane in planes) {
      bytesBuilder.add(plane.bytes);
    }
    return bytesBuilder.takeBytes();
  }

  Future<void> _resetFace() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset Pendaftaran Wajah?'),
        content: const Text(
            'Data foto pendaftaran saat ini akan dihapus sehingga Anda dapat melakukan perekaman wajah baru.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Batal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ya, Reset',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      setState(() => _isLoading = true);
      await ApiService.resetFace();
      await _fetchFaceStatus();
    }
  }

  void _showDialog(String title, String message) {
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: SingleChildScrollView(child: Text(message)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Tutup')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: Text('Pendaftaran Wajah (AI)',
            style: GoogleFonts.inter(
                fontWeight: FontWeight.w600, color: Colors.white)),
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Colors.blueAccent))
          : Stack(
              children: [
                if (_faceStatus == 'approved') _buildApprovedView(),
                if (_faceStatus == 'pending') _buildPendingView(),
                if (_faceStatus == 'rejected') _buildRejectedView(),
                if (_faceStatus == 'not_registered')
                  _buildInteractiveLivenessView(),
                if (_isSubmitting)
                  Container(
                    color: Colors.black87,
                    child: Center(
                      child: Card(
                        color: const Color(0xFF1E293B),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20)),
                        child: Padding(
                          padding: const EdgeInsets.all(28.0),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const CircularProgressIndicator(
                                  color: Colors.greenAccent),
                              const SizedBox(height: 20),
                              Text(
                                "Mengekstrak 128-d Vektor Wajah AI...",
                                style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                "Memproses biometrik ke ML Model HRMS",
                                style: GoogleFonts.inter(
                                    color: Colors.white60, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _buildApprovedView() {
    final photoUrl = _faceData?['photo_url'];
    final approvedAt = _faceData?['face_approved_at'] ?? '-';
    final approverName = _faceData?['approver_name'] ?? 'Super Admin';

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.greenAccent, width: 4),
              ),
              child: ClipOval(
                child: photoUrl != null
                    ? Image.network(
                        photoUrl,
                        width: 140,
                        height: 140,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(Icons.face,
                                size: 100, color: Colors.white70),
                      )
                    : const Icon(Icons.face, size: 100, color: Colors.white70),
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.greenAccent),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.verified,
                      color: Colors.greenAccent, size: 20),
                  const SizedBox(width: 8),
                  Text('Wajah Terverifikasi (Aktif)',
                      style: GoogleFonts.inter(
                          color: Colors.greenAccent,
                          fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Data biometrik wajah Anda aktif digunakan untuk verifikasi absensi Masuk & Pulang.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 8),
            Text(
              'Disetujui oleh: $approverName\nTanggal: $approvedAt',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: Colors.white38, fontSize: 12),
            ),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.redAccent,
                side: const BorderSide(color: Colors.redAccent),
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _resetFace,
              icon: const Icon(Icons.refresh),
              label: const Text('Ajukan Pendaftaran Ulang'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingView() {
    final photoUrl = _faceData?['photo_url'];
    final registeredAt = _faceData?['face_registered_at'] ?? '-';

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.amberAccent, width: 4),
              ),
              child: ClipOval(
                child: photoUrl != null
                    ? Image.network(
                        photoUrl,
                        width: 140,
                        height: 140,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(Icons.face,
                                size: 100, color: Colors.white70),
                      )
                    : const Icon(Icons.face, size: 100, color: Colors.white70),
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.amberAccent),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.hourglass_top_rounded,
                      color: Colors.amberAccent, size: 20),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text('Menunggu Approval Super Admin',
                        style: GoogleFonts.inter(
                            color: Colors.amberAccent,
                            fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Foto pendaftaran wajah Anda sedang ditinjau oleh HRD / Super Admin. Anda akan menerima notifikasi setelah disetujui.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 8),
            Text('Diajukan pada: $registeredAt',
                style:
                    GoogleFonts.inter(color: Colors.white38, fontSize: 12)),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white70,
                side: const BorderSide(color: Colors.white38),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _resetFace,
              icon: const Icon(Icons.camera_alt),
              label: const Text('Ganti / Rekam Ulang Wajah'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRejectedView() {
    final reason =
        _faceData?['face_rejection_reason'] ?? 'Foto kurang jelas / tidak frontal.';

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cancel_outlined,
                color: Colors.redAccent, size: 80),
            const SizedBox(height: 16),
            Text('Pendaftaran Wajah Ditolak',
                style: GoogleFonts.inter(
                    color: Colors.redAccent,
                    fontSize: 20,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: Colors.redAccent.withValues(alpha: 0.3)),
              ),
              child: Text(
                'Alasan: $reason',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blueAccent,
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                setState(() => _faceStatus = 'not_registered');
                _initCamera();
              },
              icon: const Icon(Icons.camera_alt, color: Colors.white),
              label: const Text('Rekam Ulang Wajah Sekarang',
                  style: TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInteractiveLivenessView() {
    if (!_isCameraReady || _cameraController == null) {
      return const Center(
          child: CircularProgressIndicator(color: Colors.blueAccent));
    }

    return Column(
      children: [
        // Instruction Header Card
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          color: const Color(0xFF1E293B),
          child: Column(
            children: [
              Row(
                children: [
                  Icon(_stepIcon, color: _stepColor, size: 28),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      _stepInstruction,
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: LinearProgressIndicator(
                  value: _progressValue,
                  minHeight: 6,
                  backgroundColor: Colors.white10,
                  valueColor: AlwaysStoppedAnimation<Color>(_stepColor),
                ),
              ),
            ],
          ),
        ),

        // Camera Preview with Interactive Oval Frame
        Expanded(
          child: Stack(
            alignment: Alignment.center,
            children: [
              ClipRect(
                child: SizedBox.expand(
                  child: FittedBox(
                    fit: BoxFit.cover,
                    child: SizedBox(
                      width: _cameraController!.value.previewSize != null
                          ? _cameraController!.value.previewSize!.height
                          : 720,
                      height: _cameraController!.value.previewSize != null
                          ? _cameraController!.value.previewSize!.width
                          : 1280,
                      child: CameraPreview(_cameraController!),
                    ),
                  ),
                ),
              ),

              // Animated Oval Guide Frame
              Container(
                width: 250,
                height: 330,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(165),
                  border: Border.all(color: _stepColor, width: 4),
                  boxShadow: [
                    BoxShadow(
                      color: _stepColor.withValues(alpha: 0.3),
                      blurRadius: 25,
                      spreadRadius: 4,
                    ),
                  ],
                ),
              ),

              // Step Badge at Bottom of Camera
              Positioned(
                bottom: 30,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black87,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _stepColor),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.smart_toy_outlined,
                          color: Colors.white70, size: 16),
                      const SizedBox(width: 8),
                      Text(
                        "Perekaman Wajah AI Otomatis",
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),

              // Manual retry button (fallback if auto-capture fails)
              if (_currentStep == LivenessStep.completed ||
                  _currentStep == LivenessStep.capturing)
                Positioned(
                  bottom: 80,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30)),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 14),
                    ),
                    onPressed:
                        _isSubmitting ? null : _performCaptureAndUpload,
                    icon: const Icon(Icons.camera_alt, color: Colors.white),
                    label: Text(
                      _isSubmitting ? 'Memproses...' : 'Ambil Foto Sekarang',
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
