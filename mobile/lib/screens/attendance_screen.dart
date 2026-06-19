import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import '../api/api_service.dart';

class AttendanceScreen extends StatefulWidget {
  final bool isCheckIn;

  const AttendanceScreen({super.key, required this.isCheckIn});

  @override
  _AttendanceScreenState createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  CameraController? _controller;
  List<CameraDescription>? _cameras;
  bool _isCameraReady = false;
  bool _isProcessing = false;

  // Liveness Detection variables
  final FaceDetector _faceDetector = FaceDetector(
    options: FaceDetectorOptions(
      enableClassification: true, // For eye open probability
      enableTracking: true,
    ),
  );
  
  bool _isLivenessVerified = true; // Langsung aktifkan agar tidak menyulitkan user
  String _livenessStep = "Posisikan Wajah"; 
  bool _isCameraStreaming = false;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
  }

  Future<void> _initializeCamera() async {
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
      );

      await _controller!.initialize();
      if (mounted) {
        setState(() {
          _isCameraReady = true;
        });
        _startLivenessDetection();
      }
    }
  }

  void _startLivenessDetection() {
    if (_controller == null || !_controller!.value.isInitialized) return;
    
    _controller!.startImageStream((CameraImage image) {
      if (_isProcessing || _isLivenessVerified || _isCameraStreaming) return;
      _isCameraStreaming = true;
      _processCameraImage(image);
    });
  }

  Future<void> _processCameraImage(CameraImage image) async {
    try {
      final inputImage = _convertCameraImageToInputImage(image);
      final faces = await _faceDetector.processImage(inputImage);
      
      if (faces.isNotEmpty) {
        final face = faces.first;
        
        // Update info jika wajah terdeteksi
        if (mounted && _livenessStep != "Kedipkan Mata Anda") {
             setState(() => _livenessStep = "Kedipkan Mata Anda");
        }

        // Check blink
        if (face.leftEyeOpenProbability != null && face.rightEyeOpenProbability != null) {
          // DEBUG
          // print("Face detected: L:${face.leftEyeOpenProbability}, R:${face.rightEyeOpenProbability}");
          
          if (face.leftEyeOpenProbability! < 0.2 && face.rightEyeOpenProbability! < 0.2) {
            // Blink Detected!
            if (mounted) {
              setState(() {
                _isLivenessVerified = true;
                _livenessStep = "Verifikasi Berhasil!";
              });
              _controller?.stopImageStream();
            }
          }
        }
      } else {
        // No face detected
        if (mounted && _livenessStep != "Posisikan Wajah") {
           setState(() => _livenessStep = "Posisikan Wajah");
        }
      }
    } catch (e) {
      debugPrint("Error processing image: $e");
    } finally {
      // Tunggu sebentar agar tidak overload
      await Future.delayed(Duration(milliseconds: 150));
      _isCameraStreaming = false;
    }
  }

  InputImage _convertCameraImageToInputImage(CameraImage image) {
    // Pada Android, gunakan plane ke-0 (Y) saja untuk deteksi wajah (Grayscale).
    // Ini lebih stabil dan menghindari "ImageFormat not supported" pada banyak perangkat.
    final bytes = Platform.isAndroid 
        ? image.planes[0].bytes 
        : _concatenatePlanes(image.planes);

    final InputImageMetadata metadata = InputImageMetadata(
      size: Size(image.width.toDouble(), image.height.toDouble()),
      rotation: _getRotation(),
      format: Platform.isIOS ? InputImageFormat.bgra8888 : InputImageFormat.nv21,
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

  InputImageRotation _getRotation() {
    if (Platform.isIOS) return InputImageRotation.rotation90deg;
    // Coba 270 untuk kamera depan Android. Jika wajah miring, ganti ke 90.
    return InputImageRotation.rotation270deg; 
  }

  @override
  void dispose() {
    _faceDetector.close();
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _takeAttendanceByButton() async {
    if (_isProcessing) return;

    setState(() => _isProcessing = true);

    try {
      // Stop camera stream to save resources and prevent crashes
      if (_controller != null && _controller!.value.isStreamingImages) {
        await _controller!.stopImageStream();
      }

      // 1. Dapatkan Lokasi GPS (Tetap Wajib)
      Position position = await _determinePosition();

      // Anti Fake GPS
      if (position.isMocked) {
        _showErrorDialog("Lokasi Palsu Terdeteksi! Mohon gunakan GPS asli.");
        return;
      }

      // 2. Ambil Device ID
      String deviceId = await ApiService.getDeviceId();

      // 3. Kirim ke API (Tanpa Image)
      Map<String, dynamic>? result;
      if (widget.isCheckIn) {
        result = await ApiService.checkIn(
          position.latitude, 
          position.longitude, 
          imagePath: null, // Kosongkan image
          deviceId: deviceId,
          isMocked: position.isMocked,
        );
      } else {
        result = await ApiService.checkOut(
          position.latitude, 
          position.longitude, 
          imagePath: null, // Kosongkan image
          deviceId: deviceId,
          isMocked: position.isMocked,
        );
      }

      if (result != null && (result['status'] == 'success' || result['status'] == true)) {
        if (mounted) {
          Navigator.of(context).pop(result['data']);
        }
      } else {
        _showErrorDialog(result?['message'] ?? "Gagal memproses absensi");
      }
    } catch (e) {
      _showErrorDialog("Error: ${e.toString()}");
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _takeAttendance() async {
    if (!_isCameraReady || _isProcessing) return;

    setState(() => _isProcessing = true);

    try {
      // 1. Ambil Foto
      if (_controller != null && _controller!.value.isStreamingImages) {
        await _controller!.stopImageStream();
      }
      
      final XFile image = await _controller!.takePicture();

      // 2. Dapatkan Lokasi GPS
      Position position = await _determinePosition();

      // Anti Fake GPS
      if (position.isMocked) {
        _showErrorDialog("Lokasi Palsu Terdeteksi! Mohon gunakan GPS asli.");
        return;
      }

      // 3. Ambil Device ID
      String deviceId = await ApiService.getDeviceId();

      // 4. Kirim ke API (file path, bukan Base64)
      Map<String, dynamic>? result;
      if (widget.isCheckIn) {
        result = await ApiService.checkIn(
          position.latitude, 
          position.longitude, 
          imagePath: image.path,
          deviceId: deviceId,
          isMocked: position.isMocked,
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

      if (result != null && (result['status'] == 'success' || result['status'] == true)) {
        if (mounted) {
          Navigator.of(context).pop(result['data']);
        }
      } else {
        _showErrorDialog(result?['message'] ?? "Gagal memproses absensi");
        // Reset liveness if failed so they can try again
        setState(() {
          _isLivenessVerified = false;
          _livenessStep = "Posisikan Wajah";
        });
        _startLivenessDetection();
      }
    } catch (e) {
      _showErrorDialog("Error: ${e.toString()}");
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<Position> _determinePosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return Future.error('GPS belum diaktifkan.');

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return Future.error('Izin lokasi ditolak.');
    }
    
    return await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
  }

  void _showErrorDialog(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), backgroundColor: Colors.red));
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text("Absen ${widget.isCheckIn ? 'Masuk' : 'Pulang'}", style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.close, color: Colors.white), onPressed: () => Navigator.pop(context)),
      ),
      body: Stack(
        children: [
          // Camera Preview
          if (_isCameraReady)
            Center(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(size.width * 0.5),
                child: SizedBox(
                  width: size.width * 0.8,
                  height: size.width * 0.8,
                  child: AspectRatio(
                    aspectRatio: _controller!.value.aspectRatio,
                    child: CameraPreview(_controller!),
                  ),
                ),
              ),
            )
          else 
            Center(child: CircularProgressIndicator(color: Colors.white)),
          
          // Face Frame (Visual Cue)
          Center(
            child: Container(
              width: size.width * 0.8,
              height: size.width * 0.8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: _isLivenessVerified ? Colors.greenAccent : Colors.white30,
                  width: 4,
                ),
              ),
            ),
          ),

          // Liveness Status Indicator
          Positioned(
            top: size.height * 0.1,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: _isLivenessVerified ? Colors.green.withOpacity(0.8) : Colors.black45,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!_isLivenessVerified) 
                        Padding(
                          padding: const EdgeInsets.only(right: 10),
                          child: SizedBox(height: 15, width: 15, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                        ),
                      Text(
                        _livenessStep,
                        style: GoogleFonts.outfit(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                if (!_isLivenessVerified)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(
                      "Anti-Fraud System Active",
                      style: GoogleFonts.outfit(color: Colors.white38, fontSize: 12),
                    ),
                  ),
              ],
            ),
          ),

                // Action Buttons
                Positioned(
                  bottom: 40,
                  left: 0,
                  right: 0,
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Tombol Foto (Original)
                          Column(
                            children: [
                              GestureDetector(
                                onTap: _takeAttendance,
                                child: Container(
                                  height: 70,
                                  width: 70,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: const Color(0xFF800000), width: 4),
                                    boxShadow: [
                                      BoxShadow(color: Colors.redAccent.withOpacity(0.3), blurRadius: 15, spreadRadius: 1)
                                    ]
                                  ),
                                  child: const Icon(Icons.face_retouching_natural, color: Color(0xFF800000), size: 35),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                "Foto Selfie",
                                style: GoogleFonts.outfit(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                              )
                            ],
                          ),
                          const SizedBox(width: 40),
                          // Tombol Button (Baru)
                          Column(
                            children: [
                              GestureDetector(
                                onTap: _takeAttendanceByButton,
                                child: Container(
                                  height: 70,
                                  width: 70,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF800000),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 4),
                                    boxShadow: [
                                      BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 15, spreadRadius: 1)
                                    ]
                                  ),
                                  child: const Icon(Icons.touch_app, color: Colors.white, size: 35),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                "Via Tombol",
                                style: GoogleFonts.outfit(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                              )
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Text(
                        "Pilih metode absensi Anda",
                        style: GoogleFonts.outfit(color: Colors.white70, fontSize: 14),
                      )
                    ],
                  ),
                ),

          if (_isProcessing)
            Container(color: Colors.black54, child: Center(child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircularProgressIndicator(color: Colors.white),
                SizedBox(height: 20),
                Text("Memproses Absensi...", style: GoogleFonts.outfit(color: Colors.white)),
              ],
            ))),
        ],
      ),
    );
  }
}

