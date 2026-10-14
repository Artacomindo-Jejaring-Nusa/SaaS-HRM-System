import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import '../api/api_service.dart';
import '../services/tracking_service.dart';
import 'package:screen_brightness/screen_brightness.dart';

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
  CameraDescription? _cameraDescription;
  bool _isCameraReady = false;
  bool _isProcessing = false;
  bool _isCapturing = false;

  // Face detection (lokal, hanya untuk memastikan ada wajah di frame)
  final FaceDetector _faceDetector = FaceDetector(
    options: FaceDetectorOptions(
      enableClassification: false,
      enableTracking: true,
      performanceMode: FaceDetectorMode.accurate, // Akurat agar wajah tidak terlewat
    ),
  );

  bool _isStreamActive = false;
  String _statusMessage = "Arahkan Wajah ke Kamera";
  Color _statusColor = Colors.white70;
  IconData _statusIcon = Icons.face;

  // Snapshot freeze state
  String? _capturedImagePath;
  bool _showShutterFlash = false;

  // Progress Bar & Auto-capture timer
  double _progressValue = 0.0;
  Timer? _fallbackTimer;
  int _secondsElapsed = 0;
  InputImageRotation? _confirmedRotation;

  // Counter agar capture instan dan responsif (2 frame stabil ~0.2 detik)
  int _stableFaceFrames = 0;
  static const int _requiredStableFrames = 2;

  // Mencegah double-capture
  bool _hasAutoCaptured = false;

  // Result state untuk tampilan sukses/gagal
  bool _showResult = false;
  bool _isSuccess = false;
  String _resultMessage = "";
  bool _isBypassMode = false;
  String? _bypassReason;
  String? _earlyOutReason;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeCamera();
    _setMaxBrightness();
  }

  Future<void> _setMaxBrightness() async {
    try {
      await ScreenBrightness().setApplicationScreenBrightness(1.0);
    } catch (e) {
      debugPrint("Failed to set brightness: $e");
    }
  }

  Future<void> _resetBrightness() async {
    try {
      await ScreenBrightness().resetApplicationScreenBrightness();
    } catch (e) {
      debugPrint("Failed to reset brightness: $e");
    }
  }

  @override
  void dispose() {
    _fallbackTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _faceDetector.close();
    _stopStreamSafe();
    _controller?.dispose();
    _resetBrightness();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_controller == null || !_controller!.value.isInitialized) return;
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      _fallbackTimer?.cancel();
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
        _cameraDescription = frontCamera;

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
          _startFallbackTimer();
        }
      }
    } catch (e) {
      debugPrint("Camera init error: $e");
    }
  }

  /// Timer fail-safe: jika stream ML Kit lambat atau macet di hardware tertentu,
  /// timer ini tetap memberikan progress bar visual dan otomatis mengambil foto setelah 3.5 detik.
  void _startFallbackTimer() {
    _fallbackTimer?.cancel();
    _secondsElapsed = 0;
    _fallbackTimer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      if (!mounted || _hasAutoCaptured || _isCapturing || _isProcessing) {
        timer.cancel();
        return;
      }
      _secondsElapsed += 100;

      // Update progress bar visual agar user langsung melihat feedback aktif
      if (_secondsElapsed >= 600 && _secondsElapsed <= 3500) {
        final double p = (_secondsElapsed - 600) / 2900.0;
        if (!_hasAutoCaptured && mounted) {
          setState(() {
            _progressValue = p.clamp(0.0, 0.95);
            if (p > 0.25 && _statusMessage == "Arahkan Wajah ke Kamera") {
              _statusMessage = "Merekam Wajah... Tetap Diam";
              _statusColor = Colors.lightBlueAccent;
            }
          });
        }
      }

      // Begitu mencapai 3.5 detik berada di depan kamera, jepret otomatis!
      if (_secondsElapsed >= 3500) {
        timer.cancel();
        if (!_hasAutoCaptured && !_isCapturing && !_isProcessing && mounted) {
          _hasAutoCaptured = true;
          setState(() {
            _progressValue = 1.0;
            _statusMessage = "📸 Mengambil Foto...";
            _statusColor = Colors.greenAccent;
          });
          _autoCaptureAndSubmit();
        }
      }
    });
  }

  void _startFaceDetectionStream() {
    if (_controller == null || !_controller!.value.isInitialized) return;
    if (_controller!.value.isStreamingImages) return;

    try {
      _controller!.startImageStream((CameraImage image) {
        if (_isStreamActive || _isCapturing || _isProcessing || _hasAutoCaptured) {
          return;
        }
        _isStreamActive = true;
        _detectFaceInFrame(image);
      });
    } catch (e) {
      debugPrint("startImageStream error: $e");
    }
  }

  Future<void> _detectFaceInFrame(CameraImage image) async {
    try {
      // Rotasi dinamis: jika belum terkonfirmasi, coba candidate rotations hingga wajah terdeteksi
      final List<InputImageRotation> rotationsToTry;
      if (_confirmedRotation != null) {
        rotationsToTry = [_confirmedRotation!];
      } else {
        final defaultRot = _getImageRotation();
        rotationsToTry = {
          defaultRot,
          InputImageRotation.rotation270deg,
          InputImageRotation.rotation90deg,
          InputImageRotation.rotation0deg,
          InputImageRotation.rotation180deg,
        }.toList();
      }

      List<Face> faces = [];
      InputImageRotation? workingRot;

      for (final rot in rotationsToTry) {
        final inputImage = _convertCameraImageToInputImage(image, rot);
        if (inputImage == null) continue;
        try {
          final detected = await _faceDetector.processImage(inputImage);
          if (detected.isNotEmpty) {
            faces = detected;
            workingRot = rot;
            break;
          }
        } catch (_) {}
      }

      if (workingRot != null && _confirmedRotation == null) {
        _confirmedRotation = workingRot;
        debugPrint("[Attendance] Confirmed working rotation: $workingRot");
      }

      if (!mounted || _hasAutoCaptured) return;

      if (faces.isEmpty) {
        if (_stableFaceFrames > 0) _stableFaceFrames--;
        return;
      }

      // Wajah terdeteksi oleh ML Kit!
      _stableFaceFrames++;
      final face = faces.first;
      final eulerY = face.headEulerAngleY ?? 0.0;
      final eulerX = face.headEulerAngleX ?? 0.0;

      // Cek apakah posisi wajah wajar (toleransi 35° agar fleksibel & nyaman)
      if (eulerY.abs() < 35 && eulerX.abs() < 35) {
        setState(() {
          _progressValue = 0.5 + (_stableFaceFrames * 0.25).clamp(0.0, 0.5);
          _statusMessage = "📸 Wajah Terdeteksi! Merekam Wajah...";
          _statusColor = Colors.greenAccent;
          _statusIcon = Icons.face;
        });

        if (_stableFaceFrames >= _requiredStableFrames && !_hasAutoCaptured) {
          _hasAutoCaptured = true;
          _fallbackTimer?.cancel();
          setState(() {
            _progressValue = 1.0;
            _statusMessage = "📸 Mengambil Foto Wajah...";
          });
          Future.microtask(() => _autoCaptureAndSubmit());
        }
      } else {
        setState(() {
          _statusMessage = "Tegakkan Wajah Lurus ke Kamera";
          _statusColor = Colors.amberAccent;
          _statusIcon = Icons.face;
        });
      }
    } catch (e) {
      debugPrint("Face detection error: $e");
    } finally {
      await Future.delayed(const Duration(milliseconds: 100));
      _isStreamActive = false;
    }
  }

  /// Auto-capture foto, ambil GPS, kirim ke backend.
  /// Begitu wajah terdeteksi frontal & stabil → langsung jepret & FREEZE kamera,
  /// sehingga karyawan tidak perlu menahan wajah di depan kamera lagi saat ekstraksi/verifikasi AI berlangsung.
  Future<void> _autoCaptureAndSubmit() async {
    if (_isProcessing || _isCapturing) return;

    if (!mounted || _controller == null || !_controller!.value.isInitialized) {
      _handleFailure("Kamera tidak tersedia. Silakan coba lagi.");
      return;
    }

    setState(() {
      _isCapturing = true;
      _showShutterFlash = true;
    });

    try {
      // 1. Hentikan image stream terlebih dahulu agar resource sensor kamera bebas untuk takePicture
      await _stopStreamSafe();
      await Future.delayed(const Duration(milliseconds: 150));

      if (!mounted || _controller == null || !_controller!.value.isInitialized) {
        throw Exception("Kamera tidak tersedia saat mengambil foto.");
      }

      // 2. Ambil foto snapshot seketika saat posisi wajah valid
      debugPrint("[Attendance] Taking picture...");
      final XFile image = await _controller!.takePicture();
      debugPrint("[Attendance] Photo saved: ${image.path}");

      // Validasi file hasil jepretan
      final file = File(image.path);
      if (!await file.exists() || await file.length() < 1000) {
        throw Exception("Foto tidak valid, silakan coba lagi.");
      }

      if (!mounted) return;
      setState(() {
        _showShutterFlash = false;
        _isCapturing = false;
        _isProcessing = true;
        _capturedImagePath = image.path;
        _statusMessage = "📸 Wajah Berhasil Tertangkap!";
        _statusColor = Colors.greenAccent;
        _statusIcon = Icons.check_circle_rounded;
      });

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

      // 5. Kirim ke Backend (Verifikasi Wajah)
      setState(() {
        _statusMessage = "Memverifikasi Wajah Anda...";
        _statusIcon = Icons.face;
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
          bypassFaceRecognition: _isBypassMode,
          bypassReason: _bypassReason,
        );
      } else {
        result = await ApiService.checkOut(
          position.latitude,
          position.longitude,
          imagePath: image.path,
          deviceId: deviceId,
          isMocked: position.isMocked,
          bypassFaceRecognition: _isBypassMode,
          bypassReason: _bypassReason,
          earlyOutReason: _earlyOutReason,
        );
      }

      if (!mounted) return;

      // 6. Evaluasi hasil
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
        final dynamic rawScore = result['data']?['face_similarity_score_in'] ??
            result['data']?['face_similarity_score_out'];
        String scoreText = "";
        if (rawScore != null) {
          try {
            final double sVal = double.parse(rawScore.toString());
            scoreText = "\n(Kemiripan Wajah: ${(sVal * 100).toStringAsFixed(1)}%)";
          } catch (_) {}
        }

        setState(() {
          _showResult = true;
          _isSuccess = true;
          _resultMessage = widget.isCheckIn
              ? "Absen Masuk Berhasil ✅$scoreText"
              : "Absen Pulang Berhasil ✅$scoreText";
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

        // If backend reports early out bypass required
        if (!widget.isCheckIn && (result?['requires_early_out_reason'] == true || result?['can_bypass'] == true)) {
          _handleFailure(errMsg);
          _showEarlyOutDialog(
            initialMessage: errMsg,
            timeRemaining: result?['time_remaining']?.toString(),
          );
          return;
        }

        _handleFailure(errMsg);
      }
    } catch (e) {
      _handleFailure("Error: ${e.toString()}");
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  /// Tampilkan pesan gagal dan unfreeze untuk retry
  void _handleFailure(String message) {
    if (!mounted) return;
    setState(() {
      _showResult = true;
      _isSuccess = false;
      _resultMessage = message;
      _isProcessing = false;
      _isCapturing = false;
      _showShutterFlash = false;
    });
  }

  /// Reset semua state untuk retry & unfreeze kamera
  void _retryAttendance() {
    _fallbackTimer?.cancel();
    setState(() {
      _showResult = false;
      _isSuccess = false;
      _resultMessage = "";
      _hasAutoCaptured = false;
      _isCapturing = false;
      _isProcessing = false;
      _capturedImagePath = null;
      _showShutterFlash = false;
      _stableFaceFrames = 0;
      _progressValue = 0.0;
      _secondsElapsed = 0;
      _statusMessage = "Arahkan Wajah ke Kamera";
      _statusColor = Colors.white70;
      _statusIcon = Icons.face;
    });

    // Restart camera stream dan fallback timer setelah delay
    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted &&
          _controller != null &&
          _controller!.value.isInitialized) {
        _startFaceDetectionStream();
        _startFallbackTimer();
      }
    });
  }

  void _showEarlyOutDialog({String? initialMessage, String? timeRemaining}) {
    TextEditingController reasonController = TextEditingController(text: _earlyOutReason ?? "");
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.orangeAccent.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.timer_off_outlined, color: Colors.orangeAccent, size: 22),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  "Izin Pulang Lebih Awal",
                  style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  initialMessage ?? "Waktu kepulangan Anda belum tercapai${timeRemaining != null ? ' (Kurang $timeRemaining)' : ''}. Untuk melakukan checkout sekarang, Anda wajib mengisi alasan.",
                  style: GoogleFonts.outfit(color: Colors.white70, fontSize: 13, height: 1.4),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.info_outline, color: Colors.amberAccent, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          "Jika Validasi Otomatis aktif, absen akan langsung diverifikasi. Jika tidak, pengajuan ini akan diteruskan ke Admin / HRD untuk persetujuan.",
                          style: GoogleFonts.outfit(color: Colors.amber[100], fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  "Alasan Pulang Lebih Awal *",
                  style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: reasonController,
                  style: GoogleFonts.outfit(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: "Contoh: Ada meeting di luar kantor sampai jam pulang selesai...",
                    hintStyle: GoogleFonts.outfit(color: Colors.white38, fontSize: 12),
                    filled: true,
                    fillColor: Colors.black26,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Colors.orangeAccent),
                    ),
                  ),
                  maxLines: 3,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text("Batal", style: GoogleFonts.outfit(color: Colors.white60)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orangeAccent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              ),
              onPressed: () {
                final reason = reasonController.text.trim();
                if (reason.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Alasan pulang lebih awal wajib diisi")),
                  );
                  return;
                }
                Navigator.pop(dialogContext);
                setState(() {
                  _earlyOutReason = reason;
                });
                _retryAttendance();
              },
              child: Text("Simpan & Lanjutkan", style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _bypassAttendance() {
    TextEditingController reasonController = TextEditingController();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            "Alasan Lewati Verifikasi Wajah",
            style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                "Melewati verifikasi wajah akan menandai absen ini sebagai 'Mencurigakan' dan butuh persetujuan manual dari Admin.",
                style: GoogleFonts.outfit(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: reasonController,
                style: GoogleFonts.outfit(color: Colors.white),
                decoration: InputDecoration(
                  hintText: "Contoh: Kamera rusak, Cahaya gelap...",
                  hintStyle: GoogleFonts.outfit(color: Colors.white38),
                  filled: true,
                  fillColor: Colors.black26,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                ),
                maxLines: 2,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text("Batal", style: GoogleFonts.outfit(color: Colors.white60)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.orangeAccent),
              onPressed: () {
                final reason = reasonController.text.trim();
                if (reason.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Alasan wajib diisi")),
                  );
                  return;
                }
                Navigator.pop(dialogContext);
                setState(() {
                  _isBypassMode = true;
                  _bypassReason = reason;
                });
                _retryAttendance();
              },
              child: Text("Lanjutkan", style: GoogleFonts.outfit(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  InputImageRotation _getImageRotation() {
    if (Platform.isIOS) {
      return InputImageRotation.rotation90deg;
    }
    final sensorOrientation = _cameraDescription?.sensorOrientation ?? 270;
    switch (sensorOrientation) {
      case 0:
        return InputImageRotation.rotation0deg;
      case 90:
        return InputImageRotation.rotation90deg;
      case 180:
        return InputImageRotation.rotation180deg;
      case 270:
      default:
        return InputImageRotation.rotation270deg;
    }
  }

  InputImage? _convertCameraImageToInputImage(CameraImage image, [InputImageRotation? customRotation]) {
    if (_cameraDescription == null) return null;

    final rotation = customRotation ?? _getImageRotation();

    if (Platform.isAndroid) {
      final int width = image.width;
      final int height = image.height;

      // Kasus 1: Kamera sudah menyediakan 1 plane NV21 langsung
      if (image.planes.length == 1) {
        return InputImage.fromBytes(
          bytes: image.planes[0].bytes,
          metadata: InputImageMetadata(
            size: Size(width.toDouble(), height.toDouble()),
            rotation: rotation,
            format: InputImageFormat.nv21,
            bytesPerRow: image.planes[0].bytesPerRow,
          ),
        );
      }

      // Kasus 2: Multi-plane YUV_420_888 dari Camera2 / CameraX Android
      // Konversi presisi ke buffer NV21 (Y plane + interleaved VU bytes)
      if (image.planes.length >= 3) {
        final planeY = image.planes[0];
        final planeU = image.planes[1];
        final planeV = image.planes[2];

        final int yRowStride = planeY.bytesPerRow;
        final Uint8List yBytes = planeY.bytes;

        final int uPixelStride = planeU.bytesPerPixel ?? 1;
        final int vPixelStride = planeV.bytesPerPixel ?? 1;
        final int uRowStride = planeU.bytesPerRow;
        final int vRowStride = planeV.bytesPerRow;
        final Uint8List uBytes = planeU.bytes;
        final Uint8List vBytes = planeV.bytes;

        final int uvWidth = width ~/ 2;
        final int uvHeight = height ~/ 2;
        final int totalBytes = width * height + 2 * uvWidth * uvHeight;
        final Uint8List nv21 = Uint8List(totalBytes);

        // 1. Salin Plane Y (singkirkan padding row stride jika ada)
        final int yLen = yBytes.length;
        int dstIndex = 0;
        if (yRowStride == width && yLen >= width * height) {
          nv21.setRange(0, width * height, yBytes);
          dstIndex = width * height;
        } else {
          for (int row = 0; row < height; row++) {
            final int rowStart = row * yRowStride;
            final int copyLen = (rowStart + width <= yLen) ? width : (yLen - rowStart).clamp(0, width);
            if (copyLen > 0) {
              nv21.setRange(dstIndex, dstIndex + copyLen, yBytes, rowStart);
            }
            dstIndex += width;
          }
        }

        // 2. Interleave VU untuk format NV21 standar ML Kit dengan batas aman
        final int vLen = vBytes.length;
        final int uLen = uBytes.length;

        for (int row = 0; row < uvHeight; row++) {
          final int uRowOffset = row * uRowStride;
          final int vRowOffset = row * vRowStride;
          for (int col = 0; col < uvWidth; col++) {
            final int vIdx = vRowOffset + col * vPixelStride;
            final int uIdx = uRowOffset + col * uPixelStride;
            nv21[dstIndex++] = vIdx < vLen ? vBytes[vIdx] : 128;
            nv21[dstIndex++] = uIdx < uLen ? uBytes[uIdx] : 128;
          }
        }

        return InputImage.fromBytes(
          bytes: nv21,
          metadata: InputImageMetadata(
            size: Size(width.toDouble(), height.toDouble()),
            rotation: rotation,
            format: InputImageFormat.nv21,
            bytesPerRow: width,
          ),
        );
      }
    }

    // Fallback untuk iOS (BGRA8888) atau format lainnya
    final bytes = image.planes.length == 1
        ? image.planes[0].bytes
        : _concatenatePlanes(image.planes);

    return InputImage.fromBytes(
      bytes: bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: Platform.isIOS ? InputImageFormat.bgra8888 : InputImageFormat.nv21,
        bytesPerRow: image.planes[0].bytesPerRow,
      ),
    );
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
    final isFrozen = _capturedImagePath != null && File(_capturedImagePath!).existsSync();

    return Stack(
      children: [
        // Camera Preview (Frozen Captured Image or Live Preview)
        Center(
          child: ClipOval(
            child: SizedBox(
              width: circleSize,
              height: circleSize,
              child: isFrozen
                  ? Image.file(
                      File(_capturedImagePath!),
                      fit: BoxFit.cover,
                      width: circleSize,
                      height: circleSize,
                    )
                  : (_isCameraReady && _controller != null)
                      ? FittedBox(
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
                        )
                      : const Center(
                          child: CircularProgressIndicator(color: Colors.white)),
            ),
          ),
        ),

        // Animated circle border & Progress Ring
        Center(
          child: SizedBox(
            width: circleSize + 14,
            height: circleSize + 14,
            child: CircularProgressIndicator(
              value: isFrozen ? 1.0 : (_progressValue > 0 ? _progressValue : null),
              strokeWidth: 4,
              valueColor: AlwaysStoppedAnimation<Color>(isFrozen ? Colors.greenAccent : _statusColor),
              backgroundColor: Colors.white12,
            ),
          ),
        ),
        Center(
          child: Container(
            width: circleSize,
            height: circleSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: isFrozen ? Colors.greenAccent : _statusColor,
                width: (_stableFaceFrames > 0 || isFrozen || _progressValue > 0) ? 4 : 2.5,
              ),
              boxShadow: (_stableFaceFrames > 0 || isFrozen || _progressValue > 0.3)
                  ? [
                      BoxShadow(
                        color: (isFrozen ? Colors.greenAccent : _statusColor).withValues(alpha: 0.4),
                        blurRadius: 20,
                        spreadRadius: 3,
                      )
                    ]
                  : null,
            ),
          ),
        ),

        // Shutter Flash Animation
        if (_showShutterFlash)
          Positioned.fill(
            child: Container(
              color: Colors.white.withValues(alpha: 0.85),
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
                  color: Colors.black87,
                  borderRadius: BorderRadius.circular(25),
                  border: Border.all(
                    color: isFrozen ? Colors.greenAccent.withValues(alpha: 0.4) : Colors.white12,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isFrozen ? Icons.check_circle_rounded : _statusIcon,
                      color: isFrozen ? Colors.greenAccent : _statusColor,
                      size: 22,
                    ),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Text(
                        _statusMessage,
                        style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Progress Bar Visual
              if (_progressValue > 0 && !_hasAutoCaptured)
                Container(
                  width: circleSize * 0.75,
                  height: 6,
                  margin: const EdgeInsets.only(top: 8),
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(3),
                    color: Colors.white12,
                  ),
                  child: LinearProgressIndicator(
                    value: _progressValue,
                    backgroundColor: Colors.transparent,
                    valueColor: AlwaysStoppedAnimation<Color>(_statusColor),
                  ),
                ),
            ],
          ),
        ),

        // Bottom info / Processing Banner
        Positioned(
          bottom: 40,
          left: 24,
          right: 24,
          child: _isProcessing
              ? Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B).withValues(alpha: 0.95),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.cyanAccent.withValues(alpha: 0.5)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.4),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.cyanAccent,
                              strokeWidth: 2.5,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Flexible(
                            child: Text(
                              _statusMessage,
                              style: GoogleFonts.outfit(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.greenAccent.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.greenAccent.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 15),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                "Wajah tertangkap! Anda boleh melepas posisi wajah.",
                                style: GoogleFonts.outfit(
                                  color: Colors.greenAccent,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
              : Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.65),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Shutter manual button
                      GestureDetector(
                        onTap: (_isCapturing || _isProcessing)
                            ? null
                            : () {
                                if (!_hasAutoCaptured) {
                                  _hasAutoCaptured = true;
                                  _autoCaptureAndSubmit();
                                }
                              },
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 3),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.cyanAccent.withValues(alpha: 0.35),
                                blurRadius: 12,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                          child: Container(
                            width: 56,
                            height: 56,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white,
                            ),
                            child: const Icon(
                              Icons.camera_alt_rounded,
                              color: Color(0xFF0A0E21),
                              size: 28,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        "Auto-capture aktif atau ketuk tombol untuk jepret manual",
                        textAlign: TextAlign.center,
                        style: GoogleFonts.outfit(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
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
              if (!widget.isCheckIn) ...[
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amber[800],
                    padding: const EdgeInsets.symmetric(
                        horizontal: 28, vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () => _showEarlyOutDialog(initialMessage: _resultMessage),
                  icon: const Icon(Icons.timer_off_outlined, color: Colors.white),
                  label: Text("Izin Pulang Lebih Awal",
                      style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16)),
                ),
              ],
              const SizedBox(height: 12),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.orangeAccent,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 28, vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: _bypassAttendance,
                icon: const Icon(Icons.warning_amber_rounded, color: Colors.white),
                label: Text("Lewati Verifikasi Wajah",
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
