"use client";

import { useEffect, useState, useRef, type RefObject } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { Camera, MapPin, ScanFace, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface OfficeTarget {
  lat: number;
  lng: number;
  radius: number;
  name: string;
}

interface AttendanceCameraScannerProps {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly streamActive: boolean;
  readonly loading: boolean;
  readonly statusMsg: string;
}

interface AttendanceGpsSectionProps {
  readonly distance: number | null;
  readonly officeConfig: OfficeTarget | null;
  readonly location: { lat: number; lng: number } | null;
  readonly attendanceType: string;
}

interface AttendanceScheduleNoticeProps {
  readonly user: any;
}

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // Return in meters
}

function findNearestCompanyOffice(lat: number, lng: number, company: any): OfficeTarget | null {
  if (!company?.offices?.length) return null;

  let minDistance = getDistanceFromLatLonInM(lat, lng, Number.parseFloat(company.latitude), Number.parseFloat(company.longitude));
  let nearest: OfficeTarget = { 
    lat: Number.parseFloat(company.latitude), 
    lng: Number.parseFloat(company.longitude), 
    radius: Number(company.default_radius) || 100, 
    name: "Kantor Pusat (HQ)" 
  };

  for (const office of company.offices) {
    if (office.is_active) {
      const d = getDistanceFromLatLonInM(lat, lng, Number.parseFloat(office.latitude), Number.parseFloat(office.longitude));
      if (d < minDistance) {
        minDistance = d;
        nearest = { 
          lat: Number.parseFloat(office.latitude), 
          lng: Number.parseFloat(office.longitude), 
          radius: Number(office.radius) || 100, 
          name: office.name 
        };
      }
    }
  }

  return nearest;
}

function getUserOfficeTarget(user: any): OfficeTarget | null {
  if (!user?.office) return null;
  return {
    lat: Number.parseFloat(user.office.latitude),
    lng: Number.parseFloat(user.office.longitude),
    radius: Number(user.office.radius) || 100,
    name: user.office.name
  };
}

async function fetchCompanyOfficeTarget(lat: number, lng: number): Promise<OfficeTarget | null> {
  try {
    const res = await axiosInstance.get('/company');
    return findNearestCompanyOffice(lat, lng, res.data?.data);
  } catch (e) {
    console.error("Error finding nearest office", e);
    return null;
  }
}

function captureWebcamFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): string {
  const context = canvas.getContext('2d');
  const maxWidth = 640;
  const scale = Math.min(maxWidth / video.videoWidth, 1);
  canvas.width = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;

  if (context) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  return canvas.toDataURL('image/jpeg', 0.7);
}

function validateAttendanceParams(
  location: { lat: number; lng: number } | null,
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
  attendanceType: 'office' | 'dinas_luar',
  distance: number | null,
  officeConfig: OfficeTarget | null,
  destination: string
): string | null {
  if (!location) return "Menunggu titik koordinat lokasi GPS...";
  if (!video || !canvas) return "Kamera tidak siap!";
  const isDinasLuar = attendanceType === 'dinas_luar';
  if (!isDinasLuar && distance !== null && officeConfig && distance > officeConfig.radius) {
    return `Akses Ditolak: Anda berada ${Math.round(distance - officeConfig.radius)}m di luar radius kantor!`;
  }
  if (isDinasLuar && !destination.trim()) {
    return "Tujuan Dinas Luar wajib diisi!";
  }
  return null;
}

function renderGpsStatusIcon(distance: number | null, officeConfig: OfficeTarget | null, isWithinRadius: boolean) {
  if (distance === null || !officeConfig) {
    return <MapPin className="text-gray-400 animate-bounce" size={24} />;
  }
  if (isWithinRadius) {
    return <CheckCircle className="text-[#107c41]" size={24} />;
  }
  return <AlertCircle className="text-[#8B0000]" size={24} />;
}

function AttendanceCameraScanner(props: AttendanceCameraScannerProps) {
  const { videoRef, canvasRef, streamActive, loading, statusMsg } = props;

  return (
    <div className="bg-black/95 rounded-3xl overflow-hidden shadow-2xl relative border-4 border-gray-900 group aspect-[4/3] flex items-center justify-center">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" 
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {streamActive && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-48 h-64 border-2 border-transparent relative">
             <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#8B0000] rounded-tl-xl transition-all duration-1000 group-hover:scale-110"></div>
             <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#8B0000] rounded-tr-xl transition-all duration-1000 group-hover:scale-110"></div>
             <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#8B0000] rounded-bl-xl transition-all duration-1000 group-hover:scale-110"></div>
             <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#8B0000] rounded-br-xl transition-all duration-1000 group-hover:scale-110"></div>
             {loading && <div className="absolute top-0 left-0 w-full h-1 bg-[#8B0000] shadow-[0_0_15px_#8B0000] animate-scan"></div>}
          </div>
          
          {loading && (
            <div className="mt-4 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full absolute bottom-8">
              <ScanFace className="text-[#8B0000] animate-pulse" size={20} />
              <span className="text-white text-xs font-bold uppercase tracking-wider">{statusMsg}</span>
            </div>
          )}
        </div>
      )}
      
      {!streamActive && (
        <div className="text-white flex flex-col items-center z-20">
          <Camera size={48} className="mb-4 text-gray-500 animate-pulse" />
          <p className="text-gray-400 font-medium">Memuat Kamera...</p>
        </div>
      )}
    </div>
  );
}

function AttendanceGpsSection(props: AttendanceGpsSectionProps) {
  const { distance, officeConfig, location, attendanceType } = props;
  const isWithinRadius = distance !== null && officeConfig !== null && distance <= officeConfig.radius;
  const isOutRadius = distance !== null && officeConfig !== null && distance > officeConfig.radius;

  return (
    <div>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Verifikasi Lokasi (GPS)</h3>
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-start gap-4">
        <div className="mt-1">
          {renderGpsStatusIcon(distance, officeConfig, Boolean(isWithinRadius))}
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="font-bold text-gray-900 text-sm">Status Radius Kantor</p>
            <span className="text-xs font-bold bg-white px-2 py-0.5 rounded border border-gray-200">Maks: {officeConfig?.radius || '-'}m</span>
          </div>
          
          {distance !== null && officeConfig ? (
            <>
              <p className={`text-sm font-bold ${isWithinRadius ? 'text-[#107c41]' : 'text-[#8B0000]'}`}>
                Jarak Anda: {distance} meter
              </p>
              <p className="text-[10px] text-gray-400 mt-1 font-bold flex items-center gap-1 uppercase tracking-tighter">
                Terdeteksi Area: <span className="text-gray-600">{officeConfig.name}</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">Menghitung jarak koordinat...</p>
          )}
          
          {location && (
            <p className="text-[10px] text-gray-400 font-medium mt-2 uppercase tracking-wide">
              Lat: {location.lat.toFixed(5)} | Lng: {location.lng.toFixed(5)}
            </p>
          )}
        </div>
      </div>
      
      {attendanceType === 'office' && isOutRadius && (
        <p className="text-xs text-[#8B0000] font-bold mt-3 bg-[#fef2f2] p-3 rounded-xl border border-red-200 animate-pulse">
          <strong>AKSES DIBLOKIR:</strong> Anda terdeteksi berada {Math.round(distance - officeConfig.radius)} meter di luar area Radius Kantor yang diizinkan. Silakan mendekat ke area kantor untuk melakukan absensi.
        </p>
      )}
    </div>
  );
}

function AttendanceScheduleNotice(props: AttendanceScheduleNoticeProps) {
  const { user } = props;
  if (user?.role?.id === 1) return null;
  const isNoShift = user?.attendance_type === 'shift' && (!user?.today_shift && (!user?.schedule_label || user?.schedule_label === 'Tidak Ada Shift'));

  return (
    <p className="text-xs text-amber-800 font-bold mt-3 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center gap-2">
      <AlertCircle size={16} className="text-amber-600 shrink-0" />
      <span>
        {isNoShift ? (
          <strong>JADWAL KERJA: Tidak Ada Shift (Libur/Tidak Terjadwal)</strong>
        ) : (
          <>
            <strong>JADWAL KERJA:</strong> {user?.schedule_label || `${user?.work_start_time || '08:30'} - ${user?.work_end_time || '17:30'}`}. Absen pulang dibuka mulai pukul {user?.work_end_time || '17:30'} WIB.
          </>
        )}
      </span>
    </p>
  );
}

export default function LiveAttendancePage() {
  const router = useRouter();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [streamActive, setStreamActive] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState("Menyiapkan Sistem...");
  const [loading, setLoading] = useState(false);
  const [officeConfig, setOfficeConfig] = useState<OfficeTarget | null>(null);
  const [attendanceType, setAttendanceType] = useState<'office' | 'dinas_luar'>('office');
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");

  const resolveTargetOffice = async (lat: number, lng: number): Promise<OfficeTarget | null> => {
    const assignedOffice = getUserOfficeTarget(user);
    if (assignedOffice) return assignedOffice;
    return fetchCompanyOfficeTarget(lat, lng);
  };

  useEffect(() => {
    if (!user) return;

    const assignedOffice = getUserOfficeTarget(user);
    if (assignedOffice) {
      setOfficeConfig(assignedOffice);
    }

    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setStreamActive(true);
            setStatusMsg("Kamera aktif. Silakan posisikan wajah Anda.");
          }
        })
        .catch((err) => {
          setStatusMsg("Akses kamera ditolak atau tidak ditemukan.");
          console.error("Camera error:", err);
        });
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });
          
          const targetOffice = await resolveTargetOffice(lat, lng);
          if (targetOffice) {
            setOfficeConfig(targetOffice);
            const dist = getDistanceFromLatLonInM(lat, lng, targetOffice.lat, targetOffice.lng);
            setDistance(Math.round(dist));
          }
        },
        (err) => {
          setStatusMsg("Akses lokasi ditolak. Aktifkan GPS Anda.");
          console.error("Geo error:", err);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setStatusMsg("Browser tidak support Geolocation.");
    }
  }, [user]);

  const handleAttendance = async (type: 'check-in' | 'check-out') => {
    const validationError = validateAttendanceParams(
      location,
      videoRef.current,
      canvasRef.current,
      attendanceType,
      distance,
      officeConfig,
      destination
    );

    if (validationError) {
      toast.error(validationError);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!location || !video || !canvas) return;

    const isDinasLuar = attendanceType === 'dinas_luar';
    setLoading(true);
    setStatusMsg("Menganalisis Wajah (Face Recognition)...");

    setTimeout(async () => {
      try {
        const selfieBase64 = captureWebcamFrame(video, canvas);
        const payload = {
          latitude: location.lat,
          longitude: location.lng,
          image: selfieBase64,
          attendance_type: attendanceType,
          dinas_luar_destination: isDinasLuar ? destination : null,
          dinas_luar_notes: isDinasLuar ? notes : null,
        };

        const res = await axiosInstance.post(`/attendance/${type}`, payload);
        setStatusMsg(`Berhasil ${type === 'check-in' ? 'Absen Masuk' : 'Absen Keluar'}!`);
        toast.success(res.data.message || `Berhasil ${type === 'check-in' ? 'Check-in' : 'Check-out'}!`);
        router.push('/dashboard');
      } catch (error: any) {
        setStatusMsg("Gagal melakukan absensi.");
        const errData = error.response?.data;
        const fieldErrors = errData?.errors ? Object.values(errData.errors).flat().join(', ') : null;
        toast.error(fieldErrors || errData?.message || "Terjadi kesalahan sistem.");
      } finally {
        setLoading(false);
      }
    }, 1500);
  };

  const isBlocked = (attendanceType === 'office' && distance !== null && officeConfig && distance > officeConfig.radius) ||
    (attendanceType === 'dinas_luar' && !destination.trim());

  return (
    <div className="w-full pb-8 px-4 md:px-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 flex-shrink-0">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Live Attendance & Face Recognition</h1>
          <p className="text-gray-500 font-medium">Validasi lokasi GPS & Wajah Anda pada mesin virtual ini.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AttendanceCameraScanner
          videoRef={videoRef}
          canvasRef={canvasRef}
          streamActive={streamActive}
          loading={loading}
          statusMsg={statusMsg}
        />

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 rounded-2xl bg-[#fef2f2] text-[#8B0000] flex items-center justify-center text-xl font-bold border border-[#fee2e2]">
                 {user?.name?.charAt(0) || "U"}
               </div>
               <div>
                 <h2 className="font-bold text-gray-900 text-lg">{user?.name || "Karyawan"}</h2>
                 <p className="text-sm font-medium text-gray-500">{user?.role?.name || "Staff"}</p>
               </div>
            </div>

            <hr className="border-gray-100" />

            <AttendanceGpsSection
              distance={distance}
              officeConfig={officeConfig}
              location={location}
              attendanceType={attendanceType}
            />

            <AttendanceScheduleNotice user={user} />

            <hr className="border-gray-100" />

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tipe Absensi</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAttendanceType('office')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs uppercase transition-all ${attendanceType === 'office' ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  🏢 Hadir di Kantor
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceType('dinas_luar')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs uppercase transition-all ${attendanceType === 'dinas_luar' ? 'bg-[#8B0000] text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  🚗 Dinas Luar
                </button>
              </div>

              {attendanceType === 'dinas_luar' && (
                <div className="space-y-3 p-4 bg-red-50/50 border border-red-100 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                  <div>
                    <label htmlFor="dinas_destination" className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tujuan Dinas Luar *</label>
                    <input
                      id="dinas_destination"
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Contoh: Kantor Cabang BRI Sudirman"
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8B0000] font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="dinas_notes" className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Keterangan / Aktivitas</label>
                    <textarea
                      id="dinas_notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Contoh: Rapat koordinasi proyek dan maintenance server"
                      rows={2}
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8B0000] font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            <hr className="border-gray-100" />

            <div className="grid grid-cols-2 gap-4 mt-auto">
               <button 
                 onClick={() => handleAttendance('check-in')}
                 disabled={loading || !streamActive || !location || isBlocked}
                 className="bg-[#107c41] hover:bg-[#0c6130] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-2 group"
               >
                 <ScanFace size={24} className="group-hover:scale-110 transition-transform" />
                 <span className="text-xs uppercase tracking-wider">Clock In (Selfie)</span>
               </button>
               
               <button 
                 onClick={() => handleAttendance('check-out')}
                 disabled={loading || !streamActive || !location || isBlocked || (user?.role?.id !== 1 && new Date().getHours() < 17)}
                 className="bg-[#8B0000] hover:bg-[#660000] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-2 group"
               >
                 <ScanFace size={24} className="group-hover:scale-110 transition-transform" />
                 <span className="text-xs uppercase tracking-wider">Clock Out (Selfie)</span>
               </button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
