import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// In-app Camera Capture Screen for receipts, invoices, and evidence.
/// Prevents Android activity death / restart by avoiding external camera intents.
class CameraCaptureScreen extends StatefulWidget {
  final String title;
  final String guideText;

  const CameraCaptureScreen({
    super.key,
    this.title = "Foto Bukti Nota / Kuitansi",
    this.guideText = "Posisikan nota atau kuitansi di dalam bingkai agar terbaca jelas",
  });

  @override
  State<CameraCaptureScreen> createState() => _CameraCaptureScreenState();
}

class _CameraCaptureScreenState extends State<CameraCaptureScreen>
    with WidgetsBindingObserver {
  List<CameraDescription> _cameras = [];
  CameraController? _controller;
  int _selectedCameraIndex = 0;
  bool _isCameraReady = false;
  bool _isCapturing = false;
  FlashMode _flashMode = FlashMode.auto;
  XFile? _capturedFile;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeCamera();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final CameraController? cameraController = _controller;
    if (cameraController == null || !cameraController.value.isInitialized) {
      return;
    }

    if (state == AppLifecycleState.inactive) {
      cameraController.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initCameraController(_cameras[_selectedCameraIndex]);
    }
  }

  Future<void> _initializeCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isNotEmpty) {
        // Default to back camera for receipts
        final backCamIdx = _cameras.indexWhere(
          (c) => c.lensDirection == CameraLensDirection.back,
        );
        _selectedCameraIndex = backCamIdx != -1 ? backCamIdx : 0;
        await _initCameraController(_cameras[_selectedCameraIndex]);
      } else {
        if (mounted) {
          _showErrorDialog("Kamera tidak ditemukan pada perangkat ini.");
        }
      }
    } catch (e) {
      debugPrint("Camera init error: $e");
      if (mounted) {
        _showErrorDialog("Gagal membuka kamera: ${e.toString()}");
      }
    }
  }

  Future<void> _initCameraController(CameraDescription description) async {
    await _controller?.dispose();

    final controller = CameraController(
      description,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: Platform.isAndroid
          ? ImageFormatGroup.jpeg
          : ImageFormatGroup.bgra8888,
    );

    _controller = controller;

    try {
      await controller.initialize();
      await controller.setFlashMode(_flashMode);
      if (mounted) {
        setState(() => _isCameraReady = true);
      }
    } catch (e) {
      debugPrint("Controller init error: $e");
      if (mounted) {
        _showErrorDialog("Izin akses kamera diperlukan untuk mengambil foto bukti.");
      }
    }
  }

  Future<void> _toggleFlash() async {
    if (_controller == null || !_controller!.value.isInitialized) return;
    FlashMode nextMode;
    switch (_flashMode) {
      case FlashMode.auto:
        nextMode = FlashMode.always;
        break;
      case FlashMode.always:
        nextMode = FlashMode.off;
        break;
      case FlashMode.off:
      default:
        nextMode = FlashMode.auto;
        break;
    }
    try {
      await _controller!.setFlashMode(nextMode);
      setState(() => _flashMode = nextMode);
    } catch (_) {}
  }

  Future<void> _switchCamera() async {
    if (_cameras.length <= 1) return;
    _selectedCameraIndex = (_selectedCameraIndex + 1) % _cameras.length;
    setState(() => _isCameraReady = false);
    await _initCameraController(_cameras[_selectedCameraIndex]);
  }

  Future<void> _capturePhoto() async {
    if (_controller == null ||
        !_controller!.value.isInitialized ||
        _isCapturing) {
      return;
    }

    setState(() => _isCapturing = true);
    try {
      final file = await _controller!.takePicture();
      if (mounted) {
        setState(() {
          _capturedFile = file;
          _isCapturing = false;
        });
      }
    } catch (e) {
      debugPrint("Capture photo error: $e");
      if (mounted) {
        setState(() => _isCapturing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Gagal mengambil foto: $e"),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Informasi Kamera"),
        content: Text(message),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pop(context, null);
            },
            child: const Text("Tutup"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: _capturedFile != null
            ? _buildPreviewState()
            : _buildViewfinderState(),
      ),
    );
  }

  // ── Viewfinder View ──
  Widget _buildViewfinderState() {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Camera Preview
        if (_isCameraReady && _controller != null)
          Center(
            child: CameraPreview(_controller!),
          )
        else
          const Center(
            child: CircularProgressIndicator(color: Colors.white),
          ),

        // Receipt Frame Guide Overlay
        Positioned.fill(
          child: Column(
            children: [
              // Top Bar
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                color: Colors.black54,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                      onPressed: () => Navigator.pop(context, null),
                    ),
                    Expanded(
                      child: Text(
                        widget.title,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        _flashMode == FlashMode.always
                            ? Icons.flash_on_rounded
                            : (_flashMode == FlashMode.auto
                                ? Icons.flash_auto_rounded
                                : Icons.flash_off_rounded),
                        color: _flashMode == FlashMode.off
                            ? Colors.white54
                            : Colors.amberAccent,
                      ),
                      onPressed: _toggleFlash,
                    ),
                  ],
                ),
              ),

              // Guide framing overlay
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 28, vertical: 20),
                  child: Container(
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.7),
                        width: 2,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: Container(
                        margin: const EdgeInsets.all(12),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.black45,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          widget.guideText,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // Bottom Control Bar
              Container(
                padding: const EdgeInsets.only(bottom: 24, top: 16),
                color: Colors.black54,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // Empty or Gallery placeholder
                    const SizedBox(width: 56),

                    // Shutter Button
                    GestureDetector(
                      onTap: _isCapturing ? null : _capturePhoto,
                      child: Container(
                        width: 76,
                        height: 76,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 4),
                          color: _isCapturing
                              ? Colors.grey
                              : const Color(0xFF800000),
                        ),
                        child: _isCapturing
                            ? const Center(
                                child: SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2,
                                  ),
                                ),
                              )
                            : const Icon(
                                Icons.camera_alt_rounded,
                                color: Colors.white,
                                size: 34,
                              ),
                      ),
                    ),

                    // Switch camera button
                    if (_cameras.length > 1)
                      IconButton(
                        icon: const Icon(
                          Icons.flip_camera_ios_rounded,
                          color: Colors.white,
                          size: 28,
                        ),
                        onPressed: _switchCamera,
                      )
                    else
                      const SizedBox(width: 56),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Photo Preview View ──
  Widget _buildPreviewState() {
    return Column(
      children: [
        // Top Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: Colors.black,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Periksa Hasil Foto",
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () {
                  setState(() => _capturedFile = null);
                },
              ),
            ],
          ),
        ),

        // Photo display
        Expanded(
          child: Container(
            color: Colors.black,
            alignment: Alignment.center,
            child: Image.file(
              File(_capturedFile!.path),
              fit: BoxFit.contain,
            ),
          ),
        ),

        // Bottom Actions
        Container(
          padding: const EdgeInsets.all(20),
          color: const Color(0xFF1E1E1E),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    setState(() => _capturedFile = null);
                  },
                  icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                  label: Text(
                    "Ambil Ulang",
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white54),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(context, _capturedFile);
                  },
                  icon: const Icon(Icons.check_circle_rounded,
                      color: Colors.white),
                  label: Text(
                    "Gunakan Foto",
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF800000),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
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
