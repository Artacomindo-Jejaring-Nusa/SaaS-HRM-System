"use client";

import { useState, useEffect } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Play, CheckCircle2, AlertCircle, Calendar, 
  Users, CreditCard, ChevronRight, Loader2,
  DollarSign, Calculator, Settings as SettingsIcon,
  RefreshCw, Edit2, X, Save
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import * as XLSX from "xlsx";
import { FileDown, FileUp } from "lucide-react";
import { toast } from "sonner";

export default function PayrollProcessPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [month, setMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [year, setYear] = useState(new Date().getFullYear());
  const [step, setStep] = useState(1);
  const [stats, setStats] = useState({ total_employees: 0, unsaved_profiles: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState<any>({});
  const [importing, setImporting] = useState(false);

  const downloadPayrollTemplate = () => {
    const templateData = [
      {
        "Email (WAJIB)": "karyawan@example.com",
        "NIK (OPSIONAL)": "12345678",
        "Bank": "BCA",
        "Nomor Rekening": "1234567890",
        "Nama Rekening": "Ahmad Rizki",
        "Cost Center": "PT. Artacomindo Jejaring Nusa",
        "Gaji Pokok (OPSIONAL)": 5000000,
      },
      {},
      { "Email (WAJIB)": ">>> PANDUAN PENGISIAN DATA REKENING <<<" },
      { "Email (WAJIB)": "1. Email atau NIK digunakan sebagai kunci untuk mencari data karyawan." },
      { "Email (WAJIB)": "2. Data Bank & Rekening yang diisi di sini akan otomatis muncul setiap kali Generate Payroll." },
      { "Email (WAJIB)": "3. Cost Center bisa diisi 'PT. Artacomindo Jejaring Nusa' atau sesuai unit kerja." }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [{wch: 30}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 25}, {wch: 30}, {wch: 20}];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Rekening Payroll");
    XLSX.writeFile(workbook, "Template_Data_Rekening_Karyawan.xlsx");
  };

  const handlePayrollImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      setImporting(true);
      const res = await axiosInstance.post("/payroll/import-data", formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(res.data.message);
      fetchStats(); // refresh counts
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengimpor data payroll.");
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  useEffect(() => {
    fetchSettings();
    fetchStats();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axiosInstance.get('/payroll/settings');
      setSettings(res.data.data);
      setEditingSettings(res.data.data);
    } catch (e) {
      console.error("Failed to fetch settings", e);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await axiosInstance.post('/payroll/settings', editingSettings);
      setSettings(res.data.data);
      setIsSettingsOpen(false);
      toast.success("Pengaturan berhasil disimpan");
    } catch (e) {
      toast.error("Gagal menyimpan pengaturan");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axiosInstance.get('/employees?per_page=1000');
      const employees = res.data.data.data || [];
      const total = res.data.data.total ?? employees.length;
      const unsaved = employees.filter((e: any) => !e.basic_salary || parseInt(e.basic_salary) === 0).length;
      setStats({ total_employees: total, unsaved_profiles: unsaved });
    } catch (e) {
      console.error("Gagal mengambil statistik karyawan:", e);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await axiosInstance.post('/payroll/generate', { month, year });
      setStep(3);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">{t('payroll_process')}</h1>
          <p className="dash-page-desc">Proses kalkulasi gaji karyawan otomatis berdasarkan regulasi terbaru.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stepper / Process Flow */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= s ? 'bg-[#8B0000] text-white shadow-lg shadow-red-100' : 'bg-gray-100 text-gray-400'}`}>
                    {step > s ? <CheckCircle2 size={20} /> : s}
                  </div>
                  {s < 3 && <div className={`h-1 flex-1 mx-4 rounded-full ${step > s ? 'bg-[#8B0000]' : 'bg-gray-100'}`} />}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">Konfigurasi Periode</h3>
                  <p className="text-sm text-gray-500 font-medium">Pilih bulan dan tahun untuk pemrosesan gaji.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Bulan</label>
                    <select 
                      value={month} 
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-gray-700 focus:ring-2 focus:ring-[#8B0000]/20"
                    >
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Tahun</label>
                    <select 
                      value={year} 
                      onChange={(e) => setYear(parseInt(e.target.value))}
                      className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-gray-700 focus:ring-2 focus:ring-[#8B0000]/20"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
                  <div className="flex gap-4">
                    <AlertCircle className="text-amber-600 shrink-0" size={24} />
                    <div className="space-y-1">
                      <h4 className="font-bold text-amber-900 text-sm">Validasi Data</h4>
                      <p className="text-xs text-amber-700 leading-relaxed font-medium">
                        Terdapat {stats.unsaved_profiles} karyawan yang belum memiliki profil payroll lengkap (Gaji Pokok = 0). Disarankan untuk melengkapi data sebelum dilanjutkan.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button 
                      onClick={downloadPayrollTemplate}
                      className="h-10 px-4 bg-white border border-amber-200 text-amber-700 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-amber-100 transition-all"
                    >
                      <FileDown size={14} /> Download Template
                    </button>
                    <label className="h-10 px-4 bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-amber-700 transition-all cursor-pointer">
                      <FileUp size={14} /> 
                      {importing ? "Mengimpor..." : "Upload Data Rekening"}
                      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handlePayrollImport} disabled={importing} />
                    </label>
                  </div>
                </div>

                <button 
                  onClick={() => setStep(2)}
                  className="w-full h-14 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-gray-200"
                >
                  Lanjut ke Ringkasan
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                 <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">Konfirmasi Generate</h3>
                  <p className="text-sm text-gray-500 font-medium">Anda akan memproses gaji untuk periode {month} {year}.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <Users className="text-[#8B0000]" size={20} />
                      <span className="text-sm font-bold text-gray-700">Total Karyawan</span>
                    </div>
                    <span className="text-sm font-black text-[#8B0000]">{stats.total_employees} Orang</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <Calculator className="text-[#8B0000]" size={20} />
                      <span className="text-sm font-bold text-gray-700">Metode Pajak</span>
                    </div>
                    <span className="text-[10px] font-black bg-[#8B0000]/10 text-[#8B0000] px-3 py-1 rounded-full uppercase italic">
                      {settings?.tax_method || 'TER (PP 58/2023)'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 h-14 border-2 border-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all font-bold"
                  >
                    Kembali
                  </button>
                  <button 
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex-[2] h-14 bg-[#8B0000] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#7b0000] transition-all shadow-xl shadow-red-100"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                    Mulai Generate Sekarang
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center py-10 space-y-6 animate-in zoom-in-95 duration-500">
                 <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-50">
                    <CheckCircle2 size={48} />
                 </div>
                 <div className="space-y-2">
                    <h3 className="text-2xl font-black text-gray-900">Draft Dibuat!</h3>
                    <p className="text-sm text-gray-500 font-medium max-w-sm mx-auto">
                      Gaji untuk periode {month} {year} telah berhasil dikalkulasi sebagai Draft. Lanjutkan ke proses Approval untuk pengecekan detail.
                    </p>
                 </div>
                 <div className="pt-6">
                    <button 
                      onClick={() => window.location.href = '/dashboard/payroll/approval'}
                      className="dash-btn dash-btn-primary w-full max-w-xs h-14 text-lg"
                    >
                      Lihat Daftar Approval
                    </button>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Settings Summary */}
        <div className="space-y-6">
           <div className="bg-[#1a1a2e] text-white rounded-3xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
              <div className="relative z-10 space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="p-3 bg-white/10 rounded-2xl">
                        <SettingsIcon size={20} />
                    </div>
                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full uppercase tracking-widest">Active</span>
                 </div>
                 <div>
                    <h4 className="text-sm font-bold opacity-70">Current Config</h4>
                    <p className="text-xl font-black tracking-tight">Indonesian Standard</p>
                 </div>
                 <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex justify-between text-xs">
                       <span className="opacity-60">Cut-off Day</span>
                       <span className="font-bold">Tanggal {settings?.cutoff_day || 25}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                       <span className="opacity-60">Tarif Lembur</span>
                       <span className="font-bold">Rp {new Intl.NumberFormat('id-ID').format(settings?.overtime_rate_per_hour || 30000)}/jam</span>
                    </div>
                    <div className="flex justify-between text-xs">
                       <span className="opacity-60">Lembur Libur</span>
                       <span className="font-bold">Rp {new Intl.NumberFormat('id-ID').format(settings?.overtime_rate_holiday_per_hour || 50000)}/jam</span>
                    </div>
                    <div className="flex justify-between text-xs">
                       <span className="opacity-60">PPh 21 Method</span>
                       <span className="font-bold">Latest TER</span>
                    </div>
                 </div>
                 <button 
                   onClick={() => setIsSettingsOpen(true)}
                   className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 mt-2"
                 >
                   <Edit2 size={12} /> Edit Pengaturan
                 </button>
              </div>
           </div>

           <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Deduction Rates (Employee)</h4>
              <div className="space-y-3">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center text-[10px] font-black">JK</div>
                    <div className="flex-1">
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-gray-700">BPJS Kes</span>
                          <span className="text-xs font-black text-gray-900">{settings?.bpjs_kesehatan_emp_pct || 1}%</span>
                       </div>
                       <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 w-[1%]" />
                       </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center text-[10px] font-black">HT</div>
                    <div className="flex-1">
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-gray-700">BPJS JHT</span>
                          <span className="text-xs font-black text-gray-900">{settings?.bpjs_jht_emp_pct || 2}%</span>
                       </div>
                       <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 w-[2%]" />
                       </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center text-[10px] font-black">JP</div>
                    <div className="flex-1">
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-gray-700">BPJS JP</span>
                          <span className="text-xs font-black text-gray-900">{settings?.bpjs_jp_emp_pct || 1}%</span>
                       </div>
                       <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 w-[1%]" />
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-[#8B0000]/5 rounded-3xl p-6 border border-[#8B0000]/10 flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#8B0000]">
                 <DollarSign size={24} />
              </div>
              <div className="space-y-1">
                 <h4 className="text-sm font-bold text-[#8B0000]">Butuh Bantuan?</h4>
                 <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                    Perhitungan pajak dan BPJS didasarkan pada peraturan terbaru. Pastikan data profil karyawan valid.
                 </p>
              </div>
           </div>
        </div>
      </div>

      {/* ═══ SETTINGS MODAL ═══ */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  <SettingsIcon size={20} />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-lg">Pengaturan Payroll</h3>
                  <p className="text-xs text-gray-500 font-medium">Ubah konfigurasi dasar kalkulasi</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Cut-off Day (Tanggal)</label>
                <input 
                  type="number" 
                  min="1" max="31"
                  value={editingSettings.cutoff_day || ''}
                  onChange={(e) => setEditingSettings({...editingSettings, cutoff_day: e.target.value})}
                  className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Tarif Lembur per Jam (Rp)</label>
                <input 
                  type="number" 
                  value={editingSettings.overtime_rate_per_hour || ''}
                  onChange={(e) => setEditingSettings({...editingSettings, overtime_rate_per_hour: e.target.value})}
                  className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Tarif Lembur Libur per Jam (Rp)</label>
                <input 
                  type="number" 
                  value={editingSettings.overtime_rate_holiday_per_hour || ''}
                  onChange={(e) => setEditingSettings({...editingSettings, overtime_rate_holiday_per_hour: e.target.value})}
                  className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-6 h-12 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveSettings}
                className="px-6 h-12 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center gap-2"
              >
                <Save size={18} />
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
