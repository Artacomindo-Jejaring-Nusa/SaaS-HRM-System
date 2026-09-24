import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import '../api/api_service.dart';
import '../services/tracking_service.dart';

/// Skema Absensi Sederhana:
/// 1. Buka kamera depan
/// 2. Deteksi wajah otomatis (ML Kit lokal)
/// 3. Begitu wajah terdeteksi frontal & stabil → auto-capture
/// 4. Kirim foto ke Backend → AI Service verifikasi cosine similarity
/// 5. Cocok (≥70%) = absen berhasil, Tidak cocok = peringatan jelas
///
/// TIDAK ADA kedip, tengok, atau klik tombol manual.
/// Keamanan tetap terjamin karena pencocokan vektor 128-d dilakukan di server.
class AttendanceScreen extends StatefulWidget {
  final bool isCheckIn;
  final String attendanceType;
  final String? dinasLuarDestination;
  final String? dinasLuarNotes;

  const AttendanceScreen({
    super.key,
    required this.isCheckIn,
    this.attendanceType = 'office',
    this.dinasLuarDestination,
    this.dinasLuarNotes,
  });

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen>
    with WidgetsBindingObserver {
  CameraController? _controller;
  List<CameraDescription>? _cameras;
  bool _isCameraReady = false;
  bool _isProcessing = false;
  bool _isCapturing = false;

  // Face detection (lokal, hanya untuk memastikan ada wajah di frame)
  final FaceDetector _faceDetector = FaceDetector(
    options: FaceDetectorOptions(
      enableClassification: false, // Tidak perlu eye probability
      enableTracking: true,
      performanceMode: FaceDetectorMode.fast, // Prioritas kecepatan
    ),
  );

  bool _isStreamActive = false;
  String _statusMessage = "Arahkan Wajah ke Kamera";
  Color _statusColor = Colors.white70;
  IconData _statusIcon = Icons.face;

  // Counter agar tidak capture terlalu cepat (butuh beberapa frame stabil)
  int _stableFaceFrames = 0;
  static const int _requiredStableFrames = 8; // ~1 detik (8 × 120ms)

  // Mencegah double-capture
  bool _hasAutoCaptured = false;

  // Result state untuk tampilan sukses/gagal
  bool _showResult = false;
  bool _isSuccess = false;
  String _resultMessage = "";

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeCamera();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _faceDetector.close();
    _stopStreamSafe();
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_controller == null || !_controller!.value.isInitialized) return;
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      _stopStreamSafe();
      _controller?.dispose();
      _controller = null;
      if (mounted) setState(() => _isCameraReady = false);
    } else if (state == AppLifecycleState.resumed && !_showResult) {
      _initializeCamera();
    }
  }

  Future<void> _stopStreamSafe() async {
    try {
      if (_controller != null &&
          _controller!.value.isInitialized &&
          _controller!.value.isStreamingImages) {
        await _controller!.stopImageStream();
      }
    } catch (_) {}
    _isStreamActive = false;
  }

  Future<void> _initializeCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras != null && _cameras!.isNotEmpty) {
        final frontCamera = _cameras!.firstWhere(
          (camera) => camera.lensDirection == CameraLensDirection.front,
          orElse: () => _cameras!.first,
        );

        _controller = CameraController(
          frontCamera,
          ResolutionPreset.medium,
          enableAudio: false,
          imageFormatGroup: Platform.isAndroid
              ? ImageFormatGroup.nv21
              : ImageFormatGroup.bgra8888,
        );

        await _controller!.initialize();
        if (mounted) {
          setState(() => _isCameraReady = true);
          _startFaceDetectionStream();
        }
      }
    } catch (e) {
      debugPrint("Camera init error: $e");
    }
  }

  void _startFaceDetectionStream() {
    if (_controller == null || !_controller!.value.isInitialized) return;
    if (_controller!.value.isStreamingImages) return;

    _controller!.startImageStream((CameraImage image) {
      if (_isStreamActive || _isCapturing || _isProcessing || _hasAutoCaptured) {
        return;
      }
      _isStreamActive = true;
      _detectFaceInFrame(image);
    });
  }

  Future<void> _detectFaceInFrame(CameraImage image) async {
    try {
      final inputImage = _convertCameraImageToInputImage(image);
      final faces = await _faceDetector.processImage(inputImage);

      if (!mounted || _hasAutoCaptured) return;

      if (faces.isEmpty) {
        _stableFaceFrames = 0;
        setState(() {
          _statusMessage = "Arahkan Wajah ke Kamera";
          _statusColor = Colors.white70;
          _statusIcon = Icons.face_retouching_off;
        });
        return;
      }

      final face = faces.first;
      final eulerY = face.headEulerAngleY ?? 0.0;
      final eulerX = face.headEulerAngleX ?? 0.0;

      // Cek apakah wajah cukup frontal (tidak terlalu miring)
      if (eulerY.abs() < 15 && eulerX.abs() < 15) {
        _stableFaceFrames++;

        if (_stableFaceFrames < _requiredStableFrames) {
          // Animasi countdown visual
          setState(() {
            _statusMessage = "Wajah Terdeteksi, Tetap Diam...";
            _statusColor = Colors.lightBlueAccent;
            _statusIcon = Icons.face;
          });
        } else if (!_hasAutoCaptured) {
          // Wajah stabil cukup lama → AUTO CAPTURE!
          _hasAutoCaptured = true;
          setState(() {
            _statusMessage = "📸 Memproses Absensi...";
            _statusColor = Colors.greenAccent;
            _statusIcon = Icons.check_circle;
          });
          // Schedule capture outside stream callback
          Future.microtask(() => _autoCaptureAndSubmit());
        }
      } else {
        _stableFaceFrames = 0;
        setState(() {
          _statusMessage = "Hadap Lurus ke Depan";
          _statusColor = Colors.amberAccent;
          _statusIcon = Icons.face;
        });
      }
    } catch (e) {
      debugPrint("Face detection error: $e");
    } finally {
      await Future.delayed(const Duration(milliseconds: 120));
      _isStreamActive = false;
    }
  }

  /// Auto-capture foto, ambil GPS, kirim ke backend.
  /// Backend akan memverifikasi wajah menggunakan AI Service (YOLOv11 + 128-d cosine similarity).
  Future<void> _autoCaptureAndSubmit() async {
    if (_isProcessing) return;

    // 1. Stop stream & beri jeda stabilisasi kamera
    await _stopStreamSafe();
    await Future.delayed(const Duration(milliseconds: 500));

    if (!mounted || _controller == null || !_controller!.value.isInitialized) {
      _handleFailure("Kamera tidak tersedia. Silakan coba lagi.");
      return;
    }

    setState(() => _isProcessing = true);

    try {
      // 2. Ambil foto
      debugPrint("[Attendance] Taking picture...");
      final XFile image = await _controller!.takePicture();
      debugPrint("[Attendance] Photo saved: ${image.path}");

      // Validasi file
      final file = File(image.path);
      if (!await file.exists() || await file.length() < 1000) {
        throw Exception("Foto tidak valid, silakan coba lagi.");
      }

      // 3. Ambil lokasi GPS
      setState(() {
        _statusMessage = "Memverifikasi Lokasi GPS...";
        _statusIcon = Icons.location_on;
      });

      Position position = await _determinePosition();
      if (position.isMocked) {
        _handleFailure("Lokasi Palsu Terdeteksi! Mohon gunakan GPS asli.");
        return;
      }

      // 4. Ambil Device ID
      String deviceId = await ApiService.getDeviceId();

      // 5. Kirim ke Backend (Backend → AI Service untuk verifikasi wajah)
      setState(() {
        _statusMessage = "Memverifikasi Wajah (AI)...";
        _statusIcon = Icons.smart_toy;
        _statusColor = Colors.cyanAccent;
      });

      Map<String, dynamic>? result;
      if (widget.isCheckIn) {
        result = await ApiService.checkIn(
          position.latitude,
          position.longitude,
          imagePath: image.path,
          deviceId: deviceId,
          isMocked: position.isMocked,
          attendanceType: widget.attendanceType,
          dinasLuarDestination: widget.dinasLuarDestination,
          dinasLuarNotes: widget.dinasLuarNotes,
        );
      } else {
        result = await ApiService.checkOut(
          position.latitude,
          position.longitude,
          imagePath: image.path,
          deviceId: deviceId,
          isMocked: position.isMocked,
        );
      }

      if (!mounted) return;

      // 6. Cek hasil
      if (result != null &&
          (result['status'] == 'success' || result['status'] == true)) {
        // SUKSES — Auto-track jika check-in
        if (widget.isCheckIn) {
          try {
            await TrackingService.startTracking();
            await ApiService.updateLiveLocation(
              position.latitude,
              position.longitude,
              position.accuracy,
              recordedAt: DateTime.now(),
            );
          } catch (e) {
            debugPrint("Auto tracking on checkIn error: $e");
          }
        } else {
          try {
            await TrackingService.stopTracking();
          } catch (_) {}
        }

        // Tampilkan sukses sebentar lalu pop
        setState(() {
          _showResult = true;
          _isSuccess = true;
          _resultMessage = widget.isCheckIn
              ? "Absen Masuk Berhasil ✅"
              : "Absen Pulang Berhasil ✅";
        });

        await Future.delayed(const Duration(seconds: 2));
        if (mounted) Navigator.of(context).pop(result['data']);
      } else {
        // GAGAL — Tampilkan pesan error dari backend
        String errMsg = result?['message'] ?? "Gagal memproses absensi.";
        if (result?['errors'] != null) {
          final errs = result!['errors'];
          if (errs is Map && errs.isNotEmpty) {
            errMsg = errs.values
                .map((v) => v is List ? v.join(', ') : v.toString())
                .join('\n');
          }
        }
        _handleFailure(errMsg);
      }
    } catch (e) {
      _handleFailure("Error: ${e.toString()}");
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  /// Tampilkan pesan gagal dan beri opsi retry
  void _handleFailure(String message) {
    if (!mounted) return;
    setState(() {
      _showResult = true;
      _isSuccess = false;
      _resultMessage = message;
      _isProcessing = false;
    });
  }

  /// Reset semua state untuk retry
  void _retryAttendance() {
    setState(() {
      _showResult = false;
      _isSuccess = false;
      _resultMessage = "";
      _hasAutoCaptured = false;
      _isCapturing = false;
      _isProcessing = false;
      _stableFaceFrames = 0;
      _statusMessage = "Arahkan Wajah ke Kamera";
      _statusColor = Colors.white70;
      _statusIcon = Icons.face;
    });

    // Restart camera stream setelah delay
    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted &&
          _controller != null &&
          _controller!.value.isInitialized) {
        _startFaceDetectionStream();
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

  Future<Position> _determinePosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return Future.error('GPS belum diaktifkan.');

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return Future.error('Izin lokasi ditolak.');
      }
    }

    return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high);
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    String screenTitle = "Absen ${widget.isCheckIn ? 'Masuk' : 'Pulang'}";
    if (widget.isCheckIn && widget.attendanceType == 'dinas_luar') {
      screenTitle = "Absen Masuk (Dinas Luar)";
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(
        title: Text(screenTitle,
            style: GoogleFonts.outfit(
                color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
            icon: const Icon(Icons.close, color: Colors.white),
            onPressed: () => Navigator.pop(context)),
      ),
      body: _showResult ? _buildResultView() : _buildCameraView(size),
    );
  }

  Widget _buildCameraView(Size size) {
    final circleSize = size.width * 0.78;

    return Stack(
      children: [
        // Camera Preview
        if (_isCameraReady && _controller != null)
          Center(
            child: ClipOval(
              child: SizedBox(
                width: circleSize,
                height: circleSize,
                child: FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: _controller!.value.previewSize != null
                        ? _controller!.value.previewSize!.height
                        : size.width,
                    height: _controller!.value.previewSize != null
                        ? _controller!.value.previewSize!.width
                        : size.height,
                    child: CameraPreview(_controller!),
                  ),
                ),
              ),
            ),
          )
        else
          const Center(
              child: CircularProgressIndicator(color: Colors.white)),

        // Animated circle border
        Center(
          child: Container(
            width: circleSize,
            height: circleSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: _statusColor,
                width: _stableFaceFrames > 0 ? 5 : 3,
              ),
              boxShadow: _stableFaceFrames > 2
                  ? [
                      BoxShadow(
                        color: _statusColor.withValues(alpha: 0.4),
                        blurRadius: 20,
                        spreadRadius: 3,
                      )
                    ]
                  : null,
            ),
          ),
        ),

        // Status indicator (top)
        Positioned(
          top: size.height * 0.03,
          left: 0,
          right: 0,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 20, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(25),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(_statusIcon, color: _statusColor, size: 22),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Text(
                        _statusMessage,
                        style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              // Progress dots
              if (_stableFaceFrames > 0 && !_hasAutoCaptured)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(_requiredStableFrames, (i) {
                    return Container(
                      width: 10,
                      height: 10,
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i < _stableFaceFrames
                            ? Colors.greenAccent
                            : Colors.white24,
                      ),
                    );
                  }),
                ),
            ],
          ),
        ),

        // Bottom info text
        Positioned(
          bottom: 50,
          left: 30,
          right: 30,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.black45,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    Icon(Icons.auto_awesome,
                        color: Colors.cyanAccent, size: 28),
                    const SizedBox(height: 8),
                    Text(
                      "Foto Otomatis",
                      style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Posisikan wajah di dalam lingkaran.\nFoto diambil otomatis oleh sistem.",
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(
                          color: Colors.white60, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Processing overlay
        if (_isProcessing)
          Container(
            color: Colors.black87,
            child: Center(
              child: Card(
                color: const Color(0xFF1E293B),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20)),
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(
                          width: 50,
                          height: 50,
                          child: CircularProgressIndicator(
                              color: Colors.cyanAccent, strokeWidth: 3)),
                      const SizedBox(height: 20),
                      Text(
                        _statusMessage,
                        style: GoogleFonts.outfit(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        "Sedang memverifikasi wajah Anda\ndengan AI Machine Learning...",
                        style: GoogleFonts.outfit(
                            color: Colors.white60, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildResultView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Icon
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: (_isSuccess ? Colors.green : Colors.red)
                    .withValues(alpha: 0.15),
                border: Border.all(
                  color: _isSuccess ? Colors.greenAccent : Colors.redAccent,
                  width: 3,
                ),
              ),
              child: Icon(
                _isSuccess ? Icons.check_circle : Icons.error_outline,
                size: 64,
                color: _isSuccess ? Colors.greenAccent : Colors.redAccent,
              ),
            ),
            const SizedBox(height: 24),

            // Title
            Text(
              _isSuccess
                  ? (widget.isCheckIn
                      ? "Absen Masuk Berhasil!"
                      : "Absen Pulang Berhasil!")
                  : "Absensi Gagal",
              style: GoogleFonts.outfit(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),

            // Message
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: (_isSuccess ? Colors.green : Colors.red)
                    .withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: (_isSuccess ? Colors.greenAccent : Colors.redAccent)
                      .withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                _resultMessage,
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
            ),
            const SizedBox(height: 32),

            // Action buttons
            if (!_isSuccess) ...[
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blueAccent,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 28, vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: _retryAttendance,
                icon: const Icon(Icons.refresh, color: Colors.white),
                label: Text("Coba Lagi",
                    style: GoogleFonts.outfit(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 16)),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text("Kembali",
                    style: GoogleFonts.outfit(color: Colors.white60)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
