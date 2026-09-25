"use client";

import { useEffect, useState, useRef } from "react";
import axiosInstance from "@/lib/axios";
import { Save, Building2, MapPin, Mail, Phone, Loader2, Camera, Target, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { CompanySkeleton } from "@/components/Skeleton";
import { toast } from "sonner";

function buildCompanyFormData(company: any, photoFile: File | null): FormData {
  const formData = new FormData();
  formData.append("name", company?.name || "");
  formData.append("email", company?.email || "");
  formData.append("phone", company?.phone || "");
  formData.append("address", company?.address || "");
  formData.append("latitude", company?.latitude || "");
  formData.append("longitude", company?.longitude || "");
  formData.append("radius_meters", String(company?.radius_meters || "50"));
  formData.append("work_start_time", company?.work_start_time || "08:30:00");
  formData.append("work_end_time", company?.work_end_time || "17:30:00");
  formData.append("late_tolerance_minutes", String(company?.late_tolerance_minutes ?? "0"));
  formData.append("watzap_api_key", company?.watzap_api_key || "");
  formData.append("watzap_number_key", company?.watzap_number_key || "");
  formData.append("watzap_base_url", company?.watzap_base_url || "https://api.watzap.id/v1/");
  
  if (photoFile) {
    formData.append("logo", photoFile);
  }
  return formData;
}

function getInputBaseClass(canEdit: boolean, isBold = false): string {
  const bgClass = canEdit ? "bg-gray-50" : "bg-gray-100 cursor-not-allowed";
  const fontClass = isBold ? " font-bold" : "";
  return `w-full h-10 pl-9 pr-4 text-sm${fontClass} ${bgClass} border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 transition-colors`;
}

function getTextAreaBaseClass(canEdit: boolean): string {
  const bgClass = canEdit ? "bg-gray-50" : "bg-gray-100 cursor-not-allowed";
  return `w-full pt-2.5 pb-2 pl-9 pr-4 text-sm ${bgClass} border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 transition-colors resize-none`;
}

function getWatzapInputClass(canEdit: boolean, isMono = false, isMuted = false): string {
  const bgClass = canEdit ? "bg-white shadow-sm" : "bg-gray-100";
  const extra = isMono ? " font-mono" : (isMuted ? " text-gray-500" : "");
  return `w-full h-11 px-4 text-sm ${bgClass} border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all${extra}`;
}

export default function CompanySettingsPage() {
  const { hasPermission } = useAuth();
  const { t } = useLanguage();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCompany();
  }, []);

  const canEdit = hasPermission('manage-company');

  const fetchCompany = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/company");
      const data = response.data.data || {};
      setCompany(data);
      if (data.logo) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';
        setPhotoPreview(`${baseUrl}/storage/${data.logo}`);
      }
    } catch (e) {
      console.error("Gagal mendapatkan informasi perusahaan", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      const formData = buildCompanyFormData(company, photoFile);

      await axiosInstance.post("/company/update", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      toast.success(t('success_save'));
      fetchCompany();
    } catch (e: any) {
      console.error("Error updating company:", e.response?.data || e);
      const errorMessage = e.response?.data?.message || t('failed_to_fetch');
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <CompanySkeleton />;
  }

  return (
    <div>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Profil Perusahaan</h1>
          <p className="dash-page-desc">Konfigurasi pengaturan utama dari perusahaan Anda.</p>
        </div>
        <div className="dash-page-actions">
          {canEdit && (
            <button 
              className="dash-btn dash-btn-primary" 
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isSubmitting ? t('submitting') : t('save')}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Detail Perusahaan */}
        <div className="lg:col-span-2 space-y-4">
          <div className="dash-table-container p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5 border-b border-[#ebedf0] pb-3">
              Informasi Umum
            </h2>
            <form className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700">Nama Perusahaan</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={company?.name || ""}
                    onChange={(e) => setCompany({...company, name: e.target.value})}
                    className={getInputBaseClass(canEdit)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700">Email Utama Perusahaan</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    disabled={!canEdit}
                    value={company?.email || ""}
                    onChange={(e) => setCompany({...company, email: e.target.value})}
                    className={getInputBaseClass(canEdit)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700">Nomor Telepon</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="tel"
                    disabled={!canEdit}
                    value={company?.phone || ""}
                    onChange={(e) => setCompany({...company, phone: e.target.value})}
                    className={getInputBaseClass(canEdit)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700">Alamat Kantor</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                  <textarea
                    rows={4}
                    disabled={!canEdit}
                    value={company?.address || ""}
                    onChange={(e) => setCompany({...company, address: e.target.value})}
                    className={getTextAreaBaseClass(canEdit)}
                  ></textarea>
                </div>
              </div>
            </form>
          </div>

          {/* Pengaturan Radius & GPS Lokasi Kantor */}
          <div className="dash-table-container p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5 border-b border-[#ebedf0] pb-3">
              Lokasi & Radius Presensi (GPS)
            </h2>
            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-gray-700">Latitude Pusat</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={company?.latitude || ""}
                      placeholder="-6.200000"
                      onChange={(e) => setCompany({...company, latitude: e.target.value})}
                      className={getInputBaseClass(canEdit)}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-gray-700">Longitude Pusat</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={company?.longitude || ""}
                      placeholder="106.816666"
                      onChange={(e) => setCompany({...company, longitude: e.target.value})}
                      className={getInputBaseClass(canEdit)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2 mt-4">
                <label className="text-sm font-medium text-gray-700">Jarak Radius Maksimal (Meter)</label>
                <div className="relative">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" size={16} />
                  <input
                    type="number"
                    disabled={!canEdit}
                    value={company?.radius_meters || "50"}
                    min="1"
                    onChange={(e) => setCompany({...company, radius_meters: e.target.value})}
                    className={`${getInputBaseClass(canEdit, true)} text-gray-900 border-l-4 border-l-red-500`}
                  />
                </div>
                <p className="text-xs text-gray-500 font-medium">Batas jangkauan kelonggaran absensi dari titik area. Disarankan minimal 50 meter untuk offset GPS ponsel karyawan.</p>
              </div>
            </form>
          </div>

          {/* Jam Kerja Standar & Aturan Keterlambatan (Office Hours) */}
          <div className="dash-table-container p-6">
            <div className="flex items-center justify-between border-b border-[#ebedf0] pb-3 mb-5">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="text-[#8B0000]" size={18} />
                Jam Kerja Standar & Aturan Keterlambatan
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider bg-red-50 text-[#8B0000] px-2.5 py-1 rounded-full">
                Khusus Super Admin
              </span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 mb-5 flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                Konfigurasi ini berlaku untuk semua karyawan bertipe <strong>Reguler (Non-Shift)</strong>. Karyawan yang absen masuk melebihi batas <strong>(Jam Masuk + Toleransi Menit)</strong> akan otomatis tercatat berstatus <strong>Terlambat (Late)</strong>, memicu notifikasi peringatan ke atasan, dan masuk ke perhitungan denda Payroll.
              </p>
            </div>

            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="work-start-time-input" className="text-sm font-medium text-gray-700">Jam Masuk Standar (WIB)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      id="work-start-time-input"
                      type="time"
                      disabled={!canEdit}
                      value={company?.work_start_time ? company.work_start_time.substring(0, 5) : "08:30"}
                      onChange={(e) => setCompany({...company, work_start_time: e.target.value ? `${e.target.value}:00` : "08:30:00"})}
                      className={getInputBaseClass(canEdit, true)}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 italic">Jam resmi karyawan mulai masuk kantor.</p>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="work-end-time-input" className="text-sm font-medium text-gray-700">Jam Pulang Standar (WIB)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      id="work-end-time-input"
                      type="time"
                      disabled={!canEdit}
                      value={company?.work_end_time ? company.work_end_time.substring(0, 5) : "17:30"}
                      onChange={(e) => setCompany({...company, work_end_time: e.target.value ? `${e.target.value}:00` : "17:30:00"})}
                      className={getInputBaseClass(canEdit, true)}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 italic">Jam resmi kepulangan kantor.</p>
                </div>
              </div>

              <div className="grid gap-2 pt-2">
                <label htmlFor="late-tolerance-input" className="text-sm font-medium text-gray-700">Toleransi Keterlambatan (Menit)</label>
                <div className="relative">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B0000]" size={16} />
                  <input
                    id="late-tolerance-input"
                    type="number"
                    min="0"
                    max="180"
                    disabled={!canEdit}
                    value={company?.late_tolerance_minutes ?? "0"}
                    onChange={(e) => setCompany({...company, late_tolerance_minutes: Number.parseInt(e.target.value, 10) || 0})}
                    placeholder="0"
                    className={`${getInputBaseClass(canEdit, true)} focus:border-[#8B0000]/30 border-l-4 border-l-[#8B0000]`}
                  />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  {(company?.late_tolerance_minutes || 0) > 0
                    ? `Karyawan yang absen hingga pukul ${company?.work_start_time?.substring(0, 5) || "08:30"} (+${company.late_tolerance_minutes} mnt) masih berstatus Hadir Tepat Waktu.`
                    : "Tanpa toleransi (absen setelah jam masuk langsung tercatat Terlambat)."}
                </p>
              </div>
            </form>
          </div>

          {/* Integrasi WhatsApp Gateway (WatZap) */}
          <div className="dash-table-container p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5 border-b border-[#ebedf0] pb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Integrasi WhatsApp Gateway (WatZap)
            </h2>
            <p className="text-xs text-gray-500 mb-6 font-medium bg-green-50 p-3 rounded-lg border border-green-100">
              Konfigurasikan API WatZap Anda di sini untuk mengaktifkan fitur notifikasi otomatis, OTP, dan broadcast pesan ke karyawan melalui WhatsApp.
            </p>
            
            <form className="space-y-5">
              <div className="grid gap-2">
                <label htmlFor="watzap-api-key-input" className="text-sm font-bold text-gray-800">WatZap API Key</label>
                <input
                  id="watzap-api-key-input"
                  type="password"
                  disabled={!canEdit}
                  placeholder="Masukkan API Key dari WatZap"
                  value={company?.watzap_api_key || ""}
                  onChange={(e) => setCompany({...company, watzap_api_key: e.target.value})}
                  className={getWatzapInputClass(canEdit)}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="watzap-number-key-input" className="text-sm font-bold text-gray-800">WatZap Phone Key (Number Key)</label>
                <input
                  id="watzap-number-key-input"
                  type="text"
                  disabled={!canEdit}
                  placeholder="Masukkan Number/Phone Key WhatsApp"
                  value={company?.watzap_number_key || ""}
                  onChange={(e) => setCompany({...company, watzap_number_key: e.target.value})}
                  className={getWatzapInputClass(canEdit, true)}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="watzap-base-url-input" className="text-sm font-bold text-gray-800">API Base URL</label>
                <input
                  id="watzap-base-url-input"
                  type="url"
                  disabled={!canEdit}
                  value={company?.watzap_base_url || "https://api.watzap.id/v1/"}
                  onChange={(e) => setCompany({...company, watzap_base_url: e.target.value})}
                  className={getWatzapInputClass(canEdit, false, true)}
                />
                <p className="text-[11px] text-gray-400">Default: https://api.watzap.id/v1/</p>
              </div>
            </form>
          </div>
        </div>

        {/* Logo / Metadata */}
        <div className="space-y-4">
          <div className="dash-table-container p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5 border-b border-[#ebedf0] pb-3">
              Logo Perusahaan
            </h2>
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 relative group">
              {photoPreview ? (
                <img src={photoPreview} alt="Company Logo" className="h-24 w-auto object-contain mb-4 rounded-lg" />
              ) : (
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center mb-4 border border-gray-200">
                   <Building2 className="text-gray-300" size={40} />
                </div>
              )}
              
              {canEdit && (
                <>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-white border border-gray-200 px-4 py-1.5 rounded-md shadow-sm transition-colors"
                  >
                    <Camera size={14} />
                    {photoPreview ? "Ganti Logo" : "Upload Logo"}
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Format yang didukung: JPG, PNG. Ukuran max. 2MB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
