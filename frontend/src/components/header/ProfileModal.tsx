"use client";

import React, { useState, useEffect } from "react";
import { X, Camera, User, Mail, Phone, MapPin, AlertCircle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/lib/axios";

interface ProfileModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly user: any;
  readonly isSuperAdmin: boolean;
  readonly onProfileUpdated: () => void;
}

export default function ProfileModal({
  isOpen,
  onClose,
  user,
  isSuperAdmin,
  onProfileUpdated,
}: ProfileModalProps) {
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
      });
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [user, isOpen]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Ukuran foto maksimal 2MB");
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSuperAdmin && !profileData.email.trim()) {
      toast.error("Email Super Admin wajib diisi untuk keamanan & pemulihan kata sandi.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSuperAdmin) {
        await axiosInstance.post("/profile/update", profileData);
      }

      if (photoFile) {
        const formData = new FormData();
        formData.append("photo", photoFile);
        await axiosInstance.post("/profile/upload-photo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      toast.success(
        isSuperAdmin
          ? "Profil & Email Super Admin berhasil diperbarui!"
          : "Foto profil berhasil diperbarui!"
      );
      onProfileUpdated();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Gagal memperbarui profil";
      toast.error(`Terjadi kesalahan: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubmitButtonLabel = () => {
    if (isSubmitting) return "Menyimpan...";
    if (isSuperAdmin) return "Simpan Perubahan & Email";
    return "Simpan Foto";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Tutup modal"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-default border-0"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[90vh] z-10">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-gray-50 to-red-50/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-100/60 text-[#8B0000] flex items-center justify-center font-bold">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                {isSuperAdmin ? "Kelola Profil & Email Super Admin" : "Profil Saya"}
              </h3>
              <p className="text-[11px] text-gray-500">
                {isSuperAdmin ? "Konfigurasi identitas & akun pemulihan sistem" : "Informasi akun karyawan"}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200/50 rounded-full transition-colors text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 overflow-y-auto">
          {/* Super Admin Notice vs Non-Superadmin Banner */}
          {isSuperAdmin ? (
            <div className="bg-red-50/70 border border-red-200/80 rounded-2xl p-3.5 flex items-start gap-3">
              <ShieldCheck size={20} className="text-[#8B0000] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-900">Akses Penuh Super Admin</p>
                <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                  Anda dapat mengubah <strong>Email</strong>, Nama, dan Kontak. Email ini akan dipakai untuk login serta pengiriman tautan <strong>Forgot Password</strong> jika Anda lupa kata sandi.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Data identitas karyawan (Nama, Email, Telepon) dikelola terpusat oleh <strong>HRD</strong>. Karyawan dapat memperbarui foto profil.
              </p>
            </div>
          )}

          {/* Photo Section */}
          <div className="flex flex-col items-center py-2">
            <button 
              type="button"
              className="relative group cursor-pointer bg-transparent border-0 p-0 rounded-full" 
              onClick={() => document.getElementById("profile-photo-file-input")?.click()}
            >
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-gray-100 flex items-center justify-center relative">
                {photoPreview || user?.profile_photo_url ? (
                  <img 
                    src={photoPreview || user?.profile_photo_url} 
                    alt="Preview" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <User size={40} className="text-gray-300" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={22} className="text-white" />
                </div>
              </div>
              <input 
                type="file" 
                id="profile-photo-file-input" 
                className="hidden" 
                accept="image/jpeg,image/png,image/jpg" 
                onChange={handlePhotoChange} 
              />
              <div className="absolute -bottom-1 -right-1 bg-[#8B0000] text-white p-2 rounded-full shadow-md hover:scale-105 transition-transform">
                <Camera size={14} />
              </div>
            </button>
            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">
              {photoFile ? photoFile.name : "Klik foto untuk mengganti (Max 2MB)"}
            </p>
          </div>

          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} className="text-gray-400" /> Nama Lengkap
            </label>
            <input 
              type="text"
              value={profileData.name}
              onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
              disabled={!isSuperAdmin}
              className={`w-full h-11 px-4 border rounded-xl text-sm transition-all ${
                isSuperAdmin
                  ? "bg-gray-50 border-gray-200 focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
                  : "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
              }`}
              placeholder="Masukkan nama lengkap..."
              required
            />
          </div>

          {/* Email Field (Super Admin Can Edit, Crucial for Forgot Password) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Mail size={13} className="text-gray-400" /> Alamat Email
              </label>
              {isSuperAdmin && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={11} /> Untuk Forgot Password
                </span>
              )}
            </div>
            <input 
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
              disabled={!isSuperAdmin}
              className={`w-full h-11 px-4 border rounded-xl text-sm transition-all font-medium ${
                isSuperAdmin
                  ? "bg-white border-red-300 focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-red-100 text-gray-900"
                  : "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
              }`}
              placeholder="admin@narwasthu.com"
              required={isSuperAdmin}
            />
            {isSuperAdmin && (
              <p className="text-[11px] text-gray-500 leading-tight">
                Masukkan email aktif Anda. Jika lupa password saat login, sistem akan mengirimkan instruksi pemulihan ke email ini.
              </p>
            )}
          </div>

          {/* Phone Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Phone size={13} className="text-gray-400" /> Nomor Telepon / WhatsApp
            </label>
            <input 
              type="text"
              value={profileData.phone}
              onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
              disabled={!isSuperAdmin}
              className={`w-full h-11 px-4 border rounded-xl text-sm transition-all ${
                isSuperAdmin
                  ? "bg-gray-50 border-gray-200 focus:outline-none focus:border-[#8B0000]"
                  : "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
              }`}
              placeholder="0812xxxxxxxx"
            />
          </div>

          {/* Address Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={13} className="text-gray-400" /> Alamat Kantor / Domisili
            </label>
            <textarea 
              value={profileData.address}
              onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
              disabled={!isSuperAdmin}
              className={`w-full p-3 border rounded-xl text-sm min-h-[70px] resize-none transition-all ${
                isSuperAdmin
                  ? "bg-gray-50 border-gray-200 focus:outline-none focus:border-[#8B0000]"
                  : "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
              }`}
              placeholder="Alamat domisili..."
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex gap-3 border-t border-gray-100">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 h-11 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button 
              type="submit"
              disabled={isSubmitting || (!isSuperAdmin && !photoFile)}
              className="flex-1 h-11 bg-[#8B0000] text-white rounded-xl text-sm font-bold hover:bg-[#660000] transition-all shadow-md shadow-red-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {getSubmitButtonLabel()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
