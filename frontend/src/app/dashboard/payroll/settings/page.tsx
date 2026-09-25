"use client";

import { useState, useEffect } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Save, ShieldCheck, Calendar, 
  Loader2, Settings as SettingIcon, Coins, Landmark,
  Wallet, HelpCircle, Plus, Trash2,
  Clock, UserX, Calculator
} from "lucide-react";
import { toast } from "sonner";

interface LateTier {
  min_minutes: number;
  max_minutes: number;
  penalty_type: 'percentage' | 'fixed';
  penalty_value: number;
}

const DEFAULT_SETTINGS = {
  cutoff_day: 25,
  bpjs_kesehatan_coy_pct: 4,
  bpjs_kesehatan_emp_pct: 1,
  bpjs_jht_coy_pct: 3.7,
  bpjs_jht_emp_pct: 2,
  bpjs_jp_coy_pct: 2,
  bpjs_jp_emp_pct: 1,
  bpjs_jkm_pct: 0.3,
  bpjs_jkk_pct: 0.24,
  tax_method: 'TER',
  overtime_rate_per_hour: 30000,
  overtime_rate_holiday_per_hour: 50000,
  late_deduction_enabled: true,
  late_deduction_base: 'daily_salary',
  late_grace_period_minutes: 0,
  late_deduction_tiers: [
    { min_minutes: 1, max_minutes: 15, penalty_type: 'percentage' as const, penalty_value: 0.5 },
    { min_minutes: 16, max_minutes: 30, penalty_type: 'percentage' as const, penalty_value: 1 },
    { min_minutes: 31, max_minutes: 60, penalty_type: 'percentage' as const, penalty_value: 2.5 },
    { min_minutes: 61, max_minutes: 9999, penalty_type: 'percentage' as const, penalty_value: 5 },
  ],
  absence_deduction_enabled: true,
  absence_deduction_base: 'daily_salary',
  absence_deduction_pct: 100,
  absence_forfeit_allowance: true,
};

function calculateSimulation(
  settings: any,
  simSalary: number,
  simWorkDays: number,
  simLateMin: number,
  simAbsentDays: number
) {
  const simDailySalary = simWorkDays > 0 ? (simSalary / simWorkDays) : 0;
  let simLatePenalty = 0;
  let simMatchedTier: LateTier | null = null;
  if (settings.late_deduction_enabled && simLateMin > (settings.late_grace_period_minutes || 0)) {
    const tiers: LateTier[] = settings.late_deduction_tiers || [];
    for (const tier of tiers) {
      if (simLateMin >= tier.min_minutes && simLateMin <= tier.max_minutes) {
        simMatchedTier = tier;
        break;
      }
    }
    if (!simMatchedTier && tiers.length > 0) {
      simMatchedTier = tiers.at(-1) || null;
    }
    if (simMatchedTier) {
      if (simMatchedTier.penalty_type === 'percentage') {
        const base = settings.late_deduction_base === 'basic_salary' ? simSalary : simDailySalary;
        simLatePenalty = Math.round(base * (simMatchedTier.penalty_value / 100));
      } else {
        simLatePenalty = simMatchedTier.penalty_value;
      }
    }
  }

  const simAbsencePenalty = settings.absence_deduction_enabled 
    ? Math.round(simAbsentDays * (simDailySalary * ((settings.absence_deduction_pct || 100) / 100))) 
    : 0;

  return { simDailySalary, simLatePenalty, simAbsencePenalty };
}

export default function PayrollSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(DEFAULT_SETTINGS);

  // Simulation state
  const [simSalary, setSimSalary] = useState(6000000);
  const [simWorkDays, setSimWorkDays] = useState(22);
  const [simLateMin, setSimLateMin] = useState(25);
  const [simAbsentDays, setSimAbsentDays] = useState(1);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axiosInstance.get('/payroll/settings');
      if (res.data.data) {
        const d = res.data.data;
        setSettings({
          ...d,
          late_deduction_enabled: d.late_deduction_enabled ?? true,
          late_deduction_base: d.late_deduction_base ?? 'daily_salary',
          late_grace_period_minutes: d.late_grace_period_minutes ?? 0,
          late_deduction_tiers: Array.isArray(d.late_deduction_tiers) && d.late_deduction_tiers.length > 0 
            ? d.late_deduction_tiers 
            : [
                { min_minutes: 1, max_minutes: 15, penalty_type: 'percentage', penalty_value: 0.5 },
                { min_minutes: 16, max_minutes: 30, penalty_type: 'percentage', penalty_value: 1 },
                { min_minutes: 31, max_minutes: 60, penalty_type: 'percentage', penalty_value: 2.5 },
                { min_minutes: 61, max_minutes: 9999, penalty_type: 'percentage', penalty_value: 5 },
              ],
          absence_deduction_enabled: d.absence_deduction_enabled ?? true,
          absence_deduction_base: d.absence_deduction_base ?? 'daily_salary',
          absence_deduction_pct: d.absence_deduction_pct ?? 100,
          absence_forfeit_allowance: d.absence_forfeit_allowance ?? true,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat pengaturan payroll");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTier = () => {
    const currentTiers: LateTier[] = [...(settings.late_deduction_tiers || [])];
    const lastTier = currentTiers.at(-1);
    const newMin = lastTier ? Number(lastTier.max_minutes) + 1 : 1;
    const newMax = newMin + 30;

    setSettings({
      ...settings,
      late_deduction_tiers: [
        ...currentTiers,
        { min_minutes: newMin, max_minutes: newMax, penalty_type: 'percentage', penalty_value: 1 }
      ]
    });
  };

  const handleRemoveTier = (index: number) => {
    const updated = settings.late_deduction_tiers.filter((_: any, i: number) => i !== index);
    setSettings({ ...settings, late_deduction_tiers: updated });
  };

  const handleTierChange = (index: number, field: keyof LateTier, value: any) => {
    const updated = [...settings.late_deduction_tiers];
    updated[index] = { ...updated[index], [field]: value };
    setSettings({ ...settings, late_deduction_tiers: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axiosInstance.post('/payroll/settings', settings);
      toast.success("Konfigurasi payroll dan pemotongan disiplin berhasil disimpan!");
    } catch (e) {
      console.error(e);
      toast.error("Gagal menyimpan konfigurasi");
    } finally {
      setSaving(false);
    }
  };

  // Simulation calculation
  const { simDailySalary, simLatePenalty, simAbsencePenalty } = calculateSimulation(
    settings,
    simSalary,
    simWorkDays,
    simLateMin,
    simAbsentDays
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[600px]">
      <Loader2 className="animate-spin text-[#8B0000]" size={48} />
    </div>
  );

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-24">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-white border border-gray-100 rounded-[2.5rem] p-10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-4 py-1.5 bg-[#8B0000]/10 text-[#8B0000] text-[10px] font-black uppercase tracking-widest rounded-full">Payroll & Discipline Policy</span>
            <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full">Super Admin Config</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Configuration <span className="text-[#8B0000]">Payroll</span></h1>
          <p className="text-gray-500 font-medium max-w-2xl">
            Kelola kebijakan pengupahan, potongan disiplin (keterlambatan & alfa berbasis skala persentase/nominal), tarif BPJS, dan sistem pajak TER secara fleksibel.
          </p>
        </div>
        
        <div className="relative z-10 flex gap-3">
          <button 
            type="submit"
            form="settings-form"
            disabled={saving}
            className="px-10 h-16 bg-[#8B0000] text-white rounded-3xl font-black flex items-center gap-4 hover:bg-[#7b0000] transition-all shadow-2xl shadow-red-200 active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Simpan Konfigurasi
          </button>
        </div>

        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8B0000]/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
      </div>

      <form id="settings-form" onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: PEMOTONGAN DISIPLIN (KETERLAMBATAN & ALFA) */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 md:p-10 shadow-sm space-y-8 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-50 text-[#8B0000] rounded-2xl flex items-center justify-center shadow-sm">
                <Clock size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900">Kebijakan Pemotongan Disiplin</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Late & Absence Deduction Matrix</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
              <span className="text-xs font-bold text-gray-600 pl-3">Otomasi Potongan:</span>
              <label htmlFor="late-deduction-enabled-toggle" className="relative inline-flex items-center cursor-pointer">
                <span className="sr-only">Aktifkan Otomasi Potongan Keterlambatan</span>
                <input 
                  id="late-deduction-enabled-toggle"
                  type="checkbox" 
                  checked={settings.late_deduction_enabled} 
                  onChange={(e) => setSettings({ ...settings, late_deduction_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B0000]"></div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Controls: Late Basis & Grace Period */}
            <div className="lg:col-span-4 space-y-6">
              <div className="space-y-2">
                <label htmlFor="late-deduction-base-select" className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  Basis Perhitungan Keterlambatan
                  <HelpCircle size={12} className="text-gray-400" />
                </label>
                <select 
                  id="late-deduction-base-select"
                  className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl px-4 font-bold text-sm text-gray-800 focus:bg-white focus:border-[#8B0000]/10 focus:ring-4 focus:ring-[#8B0000]/5 transition-all outline-none"
                  value={settings.late_deduction_base}
                  onChange={(e) => setSettings({ ...settings, late_deduction_base: e.target.value })}
                >
                  <option value="daily_salary">Persentase dari Gaji Harian (Direkomendasikan)</option>
                  <option value="basic_salary">Persentase dari Gaji Pokok Bulanan</option>
                  <option value="attendance_allowance">Persentase dari Tunjangan Kehadiran Harian</option>
                  <option value="fixed_amount">Nominal Tetap (Rp)</option>
                </select>
                <p className="text-[11px] text-gray-400 italic px-1">
                  *Gaji harian dihitung otomatis: <code>Gaji Pokok / Total Hari Kerja Efektif</code>.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="late-grace-period-input" className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Grace Period / Toleransi Awal (Menit)
                </label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    id="late-grace-period-input"
                    type="number"
                    min="0"
                    max="60"
                    placeholder="0"
                    className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl pl-12 pr-4 font-black text-gray-800 focus:bg-white focus:border-[#8B0000]/10 focus:ring-4 focus:ring-[#8B0000]/5 transition-all outline-none"
                    value={settings.late_grace_period_minutes}
                    onChange={(e) => setSettings({ ...settings, late_grace_period_minutes: Number.parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <p className="text-[11px] text-gray-400 px-1">
                  Karyawan yang telat $\le$ {settings.late_grace_period_minutes || 0} menit tidak dikenakan denda.
                </p>
              </div>

              {/* Absence / Alfa Configuration */}
              <div className="p-6 bg-red-50/40 rounded-3xl border border-red-100/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#8B0000]">
                    <UserX size={20} />
                    <span className="font-black text-sm">Potongan Alfa / Mangkir</span>
                  </div>
                  <label htmlFor="absence-deduction-enabled-toggle" className="relative inline-flex items-center cursor-pointer">
                    <span className="sr-only">Aktifkan Potongan Alfa atau Mangkir</span>
                    <input 
                      id="absence-deduction-enabled-toggle"
                      type="checkbox" 
                      checked={settings.absence_deduction_enabled} 
                      onChange={(e) => setSettings({ ...settings, absence_deduction_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8B0000]"></div>
                  </label>
                </div>

                <div className="space-y-2">
                  <label htmlFor="absence-deduction-pct-input" className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Persentase Denda per Hari Alfa (%)
                  </label>
                  <div className="relative">
                    <input 
                      id="absence-deduction-pct-input"
                      type="number"
                      step="1"
                      min="0"
                      max="200"
                      className="w-full h-12 bg-white border border-red-200 rounded-xl px-4 font-black text-gray-800 outline-none focus:ring-2 focus:ring-[#8B0000]/20"
                      value={settings.absence_deduction_pct}
                      onChange={(e) => setSettings({ ...settings, absence_deduction_pct: Number.parseFloat(e.target.value) || 0 })}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">% Gaji Harian</span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Default 100% = Memotong 1 hari gaji penuh per hari ketidakhadiran tanpa izin.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Dynamic Tier Builder */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-gray-900 text-lg">Skala Tingkatan Keterlambatan (Tiers)</h4>
                  <p className="text-xs text-gray-400 font-medium">Tentukan rentang menit dan besaran pengurang gaji secara berjenjang.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddTier}
                  className="px-4 py-2.5 bg-red-50 text-[#8B0000] hover:bg-[#8B0000] hover:text-white rounded-2xl font-black text-xs flex items-center gap-2 transition-all active:scale-95 shadow-sm"
                >
                  <Plus size={16} />
                  Tambah Tingkatan
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-3xl bg-gray-50/50 p-3">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200/60">
                      <th className="py-3 px-3">Tingkat</th>
                      <th className="py-3 px-3">Dari (Menit)</th>
                      <th className="py-3 px-3">Sampai (Menit)</th>
                      <th className="py-3 px-3">Tipe Denda</th>
                      <th className="py-3 px-3">Besaran</th>
                      <th className="py-3 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40">
                    {(settings.late_deduction_tiers || []).map((tier: LateTier, idx: number) => (
                      <tr key={`tier-${tier.min_minutes}-${tier.max_minutes}-${tier.penalty_type}`} className="group hover:bg-white/80 transition-colors">
                        <td className="py-3 px-3">
                          <span className="w-7 h-7 rounded-xl bg-gray-200/70 text-gray-700 font-black text-xs flex items-center justify-center">
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <input 
                            aria-label={`Menit minimum tingkat ${idx + 1}`}
                            type="number"
                            min="1"
                            className="w-24 h-11 bg-white border border-gray-200 rounded-xl px-3 font-bold text-sm text-gray-800 outline-none focus:border-[#8B0000]"
                            value={tier.min_minutes}
                            onChange={(e) => handleTierChange(idx, 'min_minutes', Number.parseInt(e.target.value, 10) || 0)}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input 
                            aria-label={`Menit maksimum tingkat ${idx + 1}`}
                            type="number"
                            min="1"
                            className="w-24 h-11 bg-white border border-gray-200 rounded-xl px-3 font-bold text-sm text-gray-800 outline-none focus:border-[#8B0000]"
                            value={tier.max_minutes}
                            onChange={(e) => handleTierChange(idx, 'max_minutes', Number.parseInt(e.target.value, 10) || 0)}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <select
                            aria-label={`Tipe denda tingkat ${idx + 1}`}
                            className="h-11 bg-white border border-gray-200 rounded-xl px-3 font-bold text-xs text-gray-800 outline-none focus:border-[#8B0000]"
                            value={tier.penalty_type}
                            onChange={(e) => handleTierChange(idx, 'penalty_type', e.target.value)}
                          >
                            <option value="percentage">Persentase (%)</option>
                            <option value="fixed">Nominal (Rp)</option>
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <div className="relative">
                            <input 
                              aria-label={`Besaran denda tingkat ${idx + 1}`}
                              type="number"
                              step="0.1"
                              min="0"
                              className="w-28 h-11 bg-white border border-gray-200 rounded-xl px-3 font-black text-sm text-gray-800 outline-none focus:border-[#8B0000]"
                              value={tier.penalty_value}
                              onChange={(e) => handleTierChange(idx, 'penalty_value', Number.parseFloat(e.target.value) || 0)}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                              {tier.penalty_type === 'percentage' ? '%' : 'Rp'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveTier(idx)}
                            disabled={(settings.late_deduction_tiers || []).length <= 1}
                            className="w-9 h-9 rounded-xl text-red-400 hover:text-red-700 hover:bg-red-50 flex items-center justify-center transition-all disabled:opacity-20"
                            aria-label={`Hapus tingkat ${idx + 1}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Live Interactive Simulator */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 rounded-3xl shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-300">
                    <Calculator size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">Simulasi Live Kalkulasi Pemotongan</span>
                  </div>
                  <span className="text-[10px] bg-white/10 px-3 py-1 rounded-full text-gray-300">
                    Shift-Aware & Auto-Deduction Engine
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label htmlFor="sim-salary-input" className="text-gray-400 block mb-1">Gaji Pokok Karyawan</label>
                    <input 
                      id="sim-salary-input"
                      type="number"
                      step="500000"
                      className="w-full bg-white/10 border border-white/20 rounded-xl p-2 text-white font-bold"
                      value={simSalary}
                      onChange={(e) => setSimSalary(Number.parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label htmlFor="sim-workdays-input" className="text-gray-400 block mb-1">Hari Kerja Efektif</label>
                    <input 
                      id="sim-workdays-input"
                      type="number"
                      className="w-full bg-white/10 border border-white/20 rounded-xl p-2 text-white font-bold"
                      value={simWorkDays}
                      onChange={(e) => setSimWorkDays(Number.parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                  <div>
                    <label htmlFor="sim-latemin-input" className="text-gray-400 block mb-1">Menit Terlambat</label>
                    <input 
                      id="sim-latemin-input"
                      type="number"
                      className="w-full bg-white/10 border border-white/20 rounded-xl p-2 text-white font-bold"
                      value={simLateMin}
                      onChange={(e) => setSimLateMin(Number.parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                  <div>
                    <label htmlFor="sim-absentdays-input" className="text-gray-400 block mb-1">Hari Alfa (Mangkir)</label>
                    <input 
                      id="sim-absentdays-input"
                      type="number"
                      className="w-full bg-white/10 border border-white/20 rounded-xl p-2 text-white font-bold"
                      value={simAbsentDays}
                      onChange={(e) => setSimAbsentDays(Number.parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs">Gaji Harian:</span>{' '}
                    <span className="font-bold">Rp {Math.round(simDailySalary).toLocaleString('id-ID')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Denda Telat ({simLateMin} mnt):</span>{' '}
                    <span className="font-black text-amber-400">Rp {simLatePenalty.toLocaleString('id-ID')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Denda Alfa ({simAbsentDays} hari):</span>{' '}
                    <span className="font-black text-rose-400">Rp {simAbsencePenalty.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="bg-red-500/20 px-4 py-2 rounded-xl border border-red-500/30">
                    <span className="text-gray-300 text-xs font-bold">Total Potongan Disiplin: </span>
                    <span className="font-black text-red-300">Rp {(simLatePenalty + simAbsencePenalty).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: KEBIJAKAN UMUM & BPJS */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* Left Side: General Policy & Overtime Rates */}
          <div className="xl:col-span-5 space-y-8">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm space-y-8 relative overflow-hidden">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-sm">
                    <SettingIcon size={28} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-gray-900">Kebijakan Umum & Lembur</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Global Pay & Overtime</p>
                 </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2 group">
                  <label htmlFor="cutoff-day-input" className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                    Tanggal Cut-off Operasional
                    <HelpCircle size={12} className="text-blue-300 group-hover:text-blue-500 transition-colors" />
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#8B0000] transition-colors" size={20} />
                    <input 
                      id="cutoff-day-input"
                      type="number"
                      min="1" max="31"
                      className="w-full h-16 bg-gray-50 border-2 border-transparent rounded-[1.25rem] pl-14 pr-6 font-black text-lg text-gray-700 focus:bg-white focus:border-[#8B0000]/10 focus:ring-4 focus:ring-[#8B0000]/5 transition-all outline-none"
                      value={settings.cutoff_day}
                      onChange={(e) => setSettings({...settings, cutoff_day: e.target.value})}
                    />
                  </div>
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                     <p className="text-[11px] text-blue-700 font-bold leading-relaxed">
                        Data absensi, lembur, dan potongan dihitung hingga tanggal {settings.cutoff_day} setiap bulannya.
                     </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="tax-method-select" className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Metode Pajak Penghasilan</label>
                  <div className="relative group">
                    <Landmark className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#8B0000] transition-colors" size={20} />
                    <select 
                      id="tax-method-select"
                      className="w-full h-16 bg-gray-50 border-2 border-transparent rounded-[1.25rem] pl-14 pr-6 font-black text-gray-700 focus:bg-white focus:border-[#8B0000]/10 focus:ring-4 focus:ring-[#8B0000]/5 transition-all outline-none appearance-none"
                      value={settings.tax_method}
                      onChange={(e) => setSettings({...settings, tax_method: e.target.value})}
                    >
                      <option value="TER">Tarif Efektif Rata-rata (TER PP 58/2023)</option>
                      <option value="GROSS">Tarif Progresif Pasal 17 (Gross)</option>
                      <option value="GROSS_UP">Gross-Up (Pajak Ditanggung Perusahaan)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label htmlFor="overtime-rate-per-hour-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lembur Hari Kerja (Rp/Jam)</label>
                    <input 
                      id="overtime-rate-per-hour-input"
                      type="number"
                      step="5000"
                      className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl px-4 font-black text-gray-700 focus:bg-white focus:border-[#8B0000]/10 outline-none"
                      value={settings.overtime_rate_per_hour}
                      onChange={(e) => setSettings({...settings, overtime_rate_per_hour: Number.parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="overtime-rate-holiday-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lembur Libur (Rp/Jam)</label>
                    <input 
                      id="overtime-rate-holiday-input"
                      type="number"
                      step="5000"
                      className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl px-4 font-black text-gray-700 focus:bg-white focus:border-[#8B0000]/10 outline-none"
                      value={settings.overtime_rate_holiday_per_hour}
                      onChange={(e) => setSettings({...settings, overtime_rate_holiday_per_hour: Number.parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: BPJS Matrix */}
          <div className="xl:col-span-7 space-y-8">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-sm space-y-10 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-50 pb-8">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-sm">
                      <ShieldCheck size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900">Health & Pension Matrix</h3>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Global BPJS Config</p>
                    </div>
                 </div>
                 <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs font-black text-gray-300 uppercase italic">Safe Protocol</span>
                    <div className="flex gap-1 mt-1">
                       {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />)}
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 
                 {/* Health Matrix */}
                 <div className="space-y-4 p-5 bg-blue-50/30 rounded-3xl border border-blue-100/50">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center">
                          <Coins size={16} />
                       </div>
                       <span className="text-[11px] font-black text-gray-900 uppercase italic">BPJS Kesehatan</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label htmlFor="bpjs-kesehatan-coy-pct-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Porsi Coy (%)</label>
                          <input 
                             id="bpjs-kesehatan-coy-pct-input"
                             type="number" step="0.1"
                             className="w-full h-12 bg-white border border-gray-200 rounded-xl px-3 font-black text-gray-700 outline-none"
                             value={settings.bpjs_kesehatan_coy_pct}
                             onChange={(e) => setSettings({...settings, bpjs_kesehatan_coy_pct: e.target.value})}
                          />
                       </div>
                       <div className="space-y-1.5">
                          <label htmlFor="bpjs-kesehatan-emp-pct-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Porsi Emp (%)</label>
                          <input 
                             id="bpjs-kesehatan-emp-pct-input"
                             type="number" step="0.1"
                             className="w-full h-12 bg-white border border-gray-200 rounded-xl px-3 font-black text-gray-700 outline-none"
                             value={settings.bpjs_kesehatan_emp_pct}
                             onChange={(e) => setSettings({...settings, bpjs_kesehatan_emp_pct: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>

                 {/* Pension Matrix (JHT) */}
                 <div className="space-y-4 p-5 bg-orange-50/30 rounded-3xl border border-orange-100/50">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded-lg flex items-center justify-center">
                          <Landmark size={16} />
                       </div>
                       <span className="text-[11px] font-black text-gray-900 uppercase italic">BPJS JHT</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label htmlFor="bpjs-jht-coy-pct-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Porsi Coy (%)</label>
                          <input 
                             id="bpjs-jht-coy-pct-input"
                             type="number" step="0.1"
                             className="w-full h-12 bg-white border border-gray-200 rounded-xl px-3 font-black text-gray-700 outline-none"
                             value={settings.bpjs_jht_coy_pct}
                             onChange={(e) => setSettings({...settings, bpjs_jht_coy_pct: e.target.value})}
                          />
                       </div>
                       <div className="space-y-1.5">
                          <label htmlFor="bpjs-jht-emp-pct-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Porsi Emp (%)</label>
                          <input 
                             id="bpjs-jht-emp-pct-input"
                             type="number" step="0.1"
                             className="w-full h-12 bg-white border border-gray-200 rounded-xl px-3 font-black text-gray-700 outline-none"
                             value={settings.bpjs_jht_emp_pct}
                             onChange={(e) => setSettings({...settings, bpjs_jht_emp_pct: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>

                 {/* JP Matrix */}
                 <div className="space-y-4 p-5 bg-purple-50/30 rounded-3xl border border-purple-100/50">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 bg-purple-50 text-purple-500 rounded-lg flex items-center justify-center">
                          <Wallet size={16} />
                       </div>
                       <span className="text-[11px] font-black text-gray-900 uppercase italic">Jaminan Pensiun (JP)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label htmlFor="bpjs-jp-coy-pct-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Porsi Coy (%)</label>
                          <input 
                             id="bpjs-jp-coy-pct-input"
                             type="number" step="0.1"
                             className="w-full h-12 bg-white border border-gray-200 rounded-xl px-3 font-black text-gray-700 outline-none"
                             value={settings.bpjs_jp_coy_pct}
                             onChange={(e) => setSettings({...settings, bpjs_jp_coy_pct: e.target.value})}
                          />
                       </div>
                       <div className="space-y-1.5">
                          <label htmlFor="bpjs-jp-emp-pct-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Porsi Emp (%)</label>
                          <input 
                             id="bpjs-jp-emp-pct-input"
                             type="number" step="0.1"
                             className="w-full h-12 bg-white border border-gray-200 rounded-xl px-3 font-black text-gray-700 outline-none"
                             value={settings.bpjs_jp_emp_pct}
                             onChange={(e) => setSettings({...settings, bpjs_jp_emp_pct: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>

                 {/* JKM JKK Matrix */}
                 <div className="space-y-4 p-5 bg-emerald-50/30 rounded-3xl border border-emerald-100/50">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center">
                          <ShieldCheck size={16} />
                       </div>
                       <span className="text-[11px] font-black text-gray-900 uppercase italic">JKM & JKK (Company Only)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label htmlFor="bpjs-jkm-pct-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">JKM (%)</label>
                          <input 
                             id="bpjs-jkm-pct-input"
                             type="number" step="0.01"
                             className="w-full h-12 bg-white border border-gray-200 rounded-xl px-3 font-black text-gray-700 outline-none"
                             value={settings.bpjs_jkm_pct}
                             onChange={(e) => setSettings({...settings, bpjs_jkm_pct: e.target.value})}
                          />
                       </div>
                       <div className="space-y-1.5">
                          <label htmlFor="bpjs-jkk-pct-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">JKK (%)</label>
                          <input 
                             id="bpjs-jkk-pct-input"
                             type="number" step="0.01"
                             className="w-full h-12 bg-white border border-gray-200 rounded-xl px-3 font-black text-gray-700 outline-none"
                             value={settings.bpjs_jkk_pct}
                             onChange={(e) => setSettings({...settings, bpjs_jkk_pct: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>

              </div>
            </div>
          </div>

        </div>

      </form>
    </div>
  );
}

