"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Camera, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  MapPin, 
  RefreshCw, 
  X, 
  ShieldCheck, 
  Laptop, 
  ArrowRight,
  Info
} from "lucide-react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";

interface WebAttendanceModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSuccess: (record?: any) => void;
  readonly defaultType?: "in" | "out";
  readonly isAutoValidated?: boolean;
}

export default function WebAttendanceModal({
  isOpen,
  onClose,
  onSuccess,
  defaultType = "in",
  isAutoValidated = false,
}: WebAttendanceModalProps) {
  const [type, setType] = useState<"in" | "out">(defaultType);
  const [useCamera, setUseCamera] = useState<boolean>(true);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"loading" | "success" | "error">("loading");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setType(defaultType);
  }, [defaultType]);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WIB"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Geolocation detection - Strictly necessary for employee attendance geofencing validation
  useEffect(() => {
    if (!isOpen) return;

    if (typeof globalThis.window !== "undefined" && "geolocation" in navigator) {
      setLocationStatus("loading");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setLocationStatus("success");
        },
        (err) => {
          console.warn("Geolocation warning:", err.message);
          setLocationStatus("error");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationStatus("error");
    }
  }, [isOpen]);

  // Start webcam
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      setCameraError("Kamera tidak dapat diakses atau izin ditolak. Silakan gunakan opsi unggah foto.");
      setUseCamera(false);
    }
  }, [cameraStream]);

  // Stop webcam
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  useEffect(() => {
    if (isOpen && useCamera && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, useCamera, capturedImage]);

  // Capture snapshot from webcam
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setCapturedImage(dataUrl);

      // Convert dataURL to File
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `web_selfie_${Date.now()}.jpg`, { type: "image/jpeg" });
            setCapturedFile(file);
          }
        },
        "image/jpeg",
        0.85
      );

      stopCamera();
    }
  };

  // Handle file picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCapturedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedFile(null);
    if (useCamera) {
      startCamera();
    }
  };

  const handleSubmit = async () => {
    if (!capturedFile && !capturedImage) {
      toast.error("Foto selfie wajib diambil atau diunggah.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (capturedFile) {
        formData.append("image", capturedFile);
      } else if (capturedImage) {
        formData.append("image_base64", capturedImage);
      }

      if (location) {
        formData.append("latitude", location.lat.toString());
        formData.append("longitude", location.lng.toString());
      }

      const endpoint = type === "in" ? "/attendance/web-check-in" : "/attendance/web-check-out";
      const response = await axiosInstance.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = response.data;
      const status = data.data?.web_approval_status || data.data?.status;

      if (status === "valid" || status === "present" || status === "late") {
        toast.success(data.message || "Absen via Web berhasil disahkan!", {
          description: `Tercatat pada ${currentTime}. Status: Tervalidasi Otomatis (Valid).`,
        });
      } else {
        toast.info(data.message || "Absen via Web berhasil dikirim!", {
          description: "Status absensi Anda saat ini: Pending (Menunggu Persetujuan Superadmin / HRD).",
        });
      }

      onSuccess(data.data);
      handleClose();
    } catch (err: any) {
      console.error("Web attendance error:", err);
      const msg = err.response?.data?.message || err.message || "Gagal melakukan absensi via web.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMediaContent = () => {
    if (capturedImage) {
      return (
        <div className="relative w-full h-full">
          <img
            src={capturedImage}
            alt="Selfie Preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium text-white flex items-center gap-1.5 border border-white/20">
            <CheckCircle2 size={12} className="text-emerald-400" />
            Foto Siap Dikirim
          </div>
          <button
            type="button"
            onClick={handleRetake}
            className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={13} />
            Ambil Ulang
          </button>
        </div>
      );
    }

    if (useCamera) {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center text-slate-300 text-xs max-w-xs space-y-2">
              <AlertCircle size={28} className="mx-auto text-rose-400" />
              <p>{cameraError}</p>
              <button
                type="button"
                onClick={() => setUseCamera(false)}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md text-white font-semibold mt-2"
              >
                Beralih ke Unggah File
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-36 h-48 border-2 border-dashed border-white/50 rounded-full shadow-sm" />
              </div>
              <button
                type="button"
                onClick={handleCapture}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#8B0000] hover:bg-[#a10000] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 transition-all transform active:scale-95 border-2 border-white/40"
              >
                <Camera size={15} />
                Ambil Foto Selfie
              </button>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-3">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white">
          <Upload size={22} />
        </div>
        <div>
          <p className="text-xs font-bold text-white">Pilih Foto Diri / Selfie</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Mendukung format JPG, JPEG, PNG (Maks 5MB)</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors shadow-md"
        >
          Pilih dari Komputer / HP
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setCapturedFile(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#8B0000] to-[#5c0000] text-white px-6 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Laptop size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Absensi via Web (Browser)
              </h2>
              <p className="text-xs text-white/80">
                Jalur Fallback Karyawan OnTime HRMS v2.1
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-700 text-sm">
          {/* Action Type Toggle & Whitelist Badge */}
          <div className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex rounded-lg bg-slate-200/80 p-1">
              <button
                type="button"
                onClick={() => setType("in")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  type === "in"
                    ? "bg-[#8B0000] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Absen Masuk
              </button>
              <button
                type="button"
                onClick={() => setType("out")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  type === "out"
                    ? "bg-[#8B0000] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Absen Pulang
              </button>
            </div>

            {/* Auto Validation Status Badge */}
            {isAutoValidated ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <ShieldCheck size={13} className="text-emerald-600" />
                Validasi Otomatis (Aktif)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                <Clock size={13} className="text-amber-600" />
                Persetujuan Manual (Pending)
              </span>
            )}
          </div>

          {/* Info Card according to Spec v2.1 */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2.5">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Alur Absensi Web Disederhanakan:</p>
              <p className="text-blue-800 leading-relaxed">
                Cukup ambil satu foto diri. Tanpa perlu pengenalan wajah ML. Waktu server ({currentTime}) dan IP Address otomatis tersimpan sebagai metadata kehadiran.
              </p>
            </div>
          </div>

          {/* Source Toggle: Webcam vs File Upload */}
          <div className="flex items-center justify-between text-xs font-medium border-b border-slate-200 pb-2">
            <span className="text-slate-600">Metode Pengambilan Foto:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUseCamera(true);
                  setCapturedImage(null);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                  useCamera
                    ? "bg-slate-900 text-white font-semibold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Camera size={13} />
                Kamera Laptop/HP
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseCamera(false);
                  stopCamera();
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                  useCamera
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    : "bg-slate-900 text-white font-semibold"
                }`}
              >
                <Upload size={13} />
                Unggah File
              </button>
            </div>
          </div>

          {/* Camera / Preview Box */}
          <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-300 shadow-inner flex items-center justify-center">
            {renderMediaContent()}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Metadata summary (Live Time & Geolocation) */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="text-slate-500 flex items-center gap-1 font-medium mb-1">
                <Clock size={12} />
                Waktu Absen:
              </div>
              <div className="font-bold text-slate-800 text-sm">{currentTime}</div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="text-slate-500 flex items-center gap-1 font-medium mb-1">
                <MapPin size={12} />
                Lokasi GPS:
              </div>
              <div className="font-bold text-slate-800 truncate">
                {locationStatus === "loading" && <span className="text-slate-400 font-normal">Mendeteksi...</span>}
                {locationStatus === "success" && (
                  <span className="text-emerald-700">
                    {location?.lat.toFixed(4)}, {location?.lng.toFixed(4)}
                  </span>
                )}
                {locationStatus === "error" && <span className="text-slate-500 font-normal">Sistem Browser</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!capturedImage || isSubmitting}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all ${
              !capturedImage || isSubmitting
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-[#8B0000] to-[#6a0000] hover:from-[#a10000] hover:to-[#7a0000] text-white shadow-rose-900/20 active:scale-95"
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Menyimpan Kehadiran...
              </>
            ) : (
              <>
                <span>Kirim {type === "in" ? "Absen Masuk" : "Absen Pulang"}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
