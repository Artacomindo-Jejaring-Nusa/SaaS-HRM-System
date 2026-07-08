"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { Save, Loader2, MessageSquare, Key, Phone, Link as LinkIcon, Info, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function WhatsAppSettingsPage() {
  const { hasPermission } = useAuth();
  interface CompanySettings {
    watzap_api_key?: string | null;
    watzap_number_key?: string | null;
    watzap_base_url?: string | null;
  }

  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCompany();
  }, []);

  const canEdit = hasPermission('manage-company');

  const fetchCompany = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/company");
      setCompany(response.data.data || {});
    } catch (e) {
      console.error("Gagal mendapatkan informasi perusahaan", e);
      toast.error("Gagal memuat data pengaturan.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!company) return;
    try {
      setIsSubmitting(true);
      const payload = {
        watzap_api_key: company.watzap_api_key,
        watzap_number_key: company.watzap_number_key,
        watzap_base_url: company.watzap_base_url || "https://api.watzap.id/v1/"
      };

      await axiosInstance.post("/company/update", payload);
      
      toast.success("Pengaturan WhatsApp berhasil disimpan!");
      fetchCompany();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      console.error("Error updating WhatsApp settings:", err.response?.data || err);
      toast.error(err.response?.data?.message || "Gagal menyimpan pengaturan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-green-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title flex items-center gap-2">
            <MessageSquare className="text-green-600" size={24} />
            WhatsApp Gateway Configuration
          </h1>
          <p className="dash-page-desc">Kelola integrasi WatZap untuk notifikasi otomatis dan broadcast.</p>
        </div>
        <div className="dash-page-actions">
          {canEdit && (
            <button 
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-200 transition-all active:scale-95 disabled:opacity-70" 
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8">
            <div className="flex items-start gap-4 mb-8 bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Info size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-900">Petunjuk Integrasi</h3>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  Gunakan API Key dan Number Key yang didapatkan dari dashboard WatZap.id. Pastikan nomor WhatsApp Anda sudah terhubung (Connected) di dashboard WatZap agar pesan dapat terkirim dengan sukses.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid gap-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Key size={16} className="text-gray-400" />
                  WatZap API Key
                </label>
                <input
                  type="password"
                  disabled={!canEdit}
                  placeholder="Contoh: QUGMFQPK2UJP5JNX"
                  value={company?.watzap_api_key || ""}
                  onChange={(e) => setCompany({...company, watzap_api_key: e.target.value})}
                  className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all outline-none"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Phone size={16} className="text-gray-400" />
                  WatZap Number Key
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  placeholder="Contoh: Y1Z4ErFrsDSJ15NM"
                  value={company?.watzap_number_key || ""}
                  onChange={(e) => setCompany({...company, watzap_number_key: e.target.value})}
                  className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all outline-none font-mono"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <LinkIcon size={16} className="text-gray-400" />
                  API Base URL
                </label>
                <input
                  type="url"
                  disabled={!canEdit}
                  placeholder="https://api.watzap.id/v1/"
                  value={company?.watzap_base_url || "https://api.watzap.id/v1/"}
                  onChange={(e) => setCompany({...company, watzap_base_url: e.target.value})}
                  className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all outline-none text-gray-500"
                />
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <CheckCircle2 size={14} className="text-green-500" />
              Sistem akan otomatis menggunakan konfigurasi ini untuk seluruh notifikasi WhatsApp.
            </div>
          </div>
        </div>
        
        <div className="bg-green-600 rounded-3xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">Status Koneksi</h3>
            <p className="text-green-100 text-sm mb-6 max-w-md">Koneksi WhatsApp Gateway sedang menggunakan kredensial perusahaan Anda. Semua pesan broadcast dan pengingat akan dikirim melalui gateway ini.</p>
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 text-xs font-bold uppercase tracking-wider">
                Mode: Production
              </div>
              <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 text-xs font-bold uppercase tracking-wider">
                Provider: WatZap.id
              </div>
            </div>
          </div>
          <MessageSquare size={160} className="absolute -right-10 -bottom-10 text-white/10 rotate-12" />
        </div>
      </div>
    </div>
  );
}
