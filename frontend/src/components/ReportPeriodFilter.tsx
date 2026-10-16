"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Calendar, 
  FileSpreadsheet, 
  Download, 
  Trash2, 
  AlertTriangle, 
  RefreshCw, 
  X, 
  CheckCircle2,
  CalendarDays,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PeriodState {
  month: string; // "all" | "01" | "02" ... "12"
  year: number | "all";
  monthName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  periodLabel: string;
  periodKey: string; // e.g. "2026-10" or "2026" or "all"
  isAllMonths: boolean;
  isAllTime: boolean;
}

export const MONTH_OPTIONS = [
  { value: "all", label: "Semua Bulan (Tahunan)" },
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

export function computePeriodState(month: string, year: number | "all"): PeriodState {
  const isAllTime = year === "all";
  const isAllMonths = month === "all";

  const monthObj = MONTH_OPTIONS.find((m) => m.value === month);
  const monthName = monthObj ? monthObj.label : "Semua Bulan";

  let startDate = "";
  let endDate = "";
  let periodLabel = "";
  let periodKey = "";

  if (isAllTime) {
    periodLabel = "Semua Periode";
    periodKey = "all";
  } else if (isAllMonths) {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
    periodLabel = `Tahun ${year} (Semua Bulan)`;
    periodKey = String(year);
  } else {
    const y = Number(year);
    const m = Number(month);
    const lastDay = new Date(y, m, 0).getDate();
    startDate = `${year}-${month}-01`;
    endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
    periodLabel = `${monthName} ${year}`;
    periodKey = `${year}-${month}`;
  }

  return {
    month,
    year,
    monthName,
    startDate,
    endDate,
    periodLabel,
    periodKey,
    isAllMonths,
    isAllTime,
  };
}

interface ReportPeriodFilterProps {
  reportTitle?: string;
  onPeriodChange: (period: PeriodState) => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  isExporting?: boolean;
  // Purge / Delete per Period props
  canPurge?: boolean;
  onPurgePeriod?: (period: PeriodState) => Promise<void> | void;
  isPurging?: boolean;
  // Bulk selection props
  selectedCount?: number;
  onDeleteSelected?: () => Promise<void> | void;
  isDeletingSelected?: boolean;
  extraActions?: React.ReactNode;
}

export default function ReportPeriodFilter({
  reportTitle = "Laporan",
  onPeriodChange,
  onExportExcel,
  onExportPdf,
  isExporting = false,
  canPurge = true,
  onPurgePeriod,
  isPurging = false,
  selectedCount = 0,
  onDeleteSelected,
  isDeletingSelected = false,
  extraActions,
}: Readonly<ReportPeriodFilterProps>) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0");

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState<number | "all">(currentYear);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeConfirmation, setPurgeConfirmation] = useState("");

  const availableYears = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => currentYear - 3 + i);
  }, [currentYear]);

  const activePeriod = useMemo(() => {
    return computePeriodState(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // Notify parent on change
  useEffect(() => {
    onPeriodChange(activePeriod);
  }, [activePeriod, onPeriodChange]);

  const handlePreset = (type: "this_month" | "last_month" | "this_year" | "all") => {
    if (type === "this_month") {
      setSelectedMonth(currentMonthStr);
      setSelectedYear(currentYear);
    } else if (type === "last_month") {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setSelectedMonth(String(prevDate.getMonth() + 1).padStart(2, "0"));
      setSelectedYear(prevDate.getFullYear());
    } else if (type === "this_year") {
      setSelectedMonth("all");
      setSelectedYear(currentYear);
    } else if (type === "all") {
      setSelectedMonth("all");
      setSelectedYear("all");
    }
  };

  const handleExecutePurge = async () => {
    if (purgeConfirmation.trim().toUpperCase() !== "HAPUS" || !onPurgePeriod) return;
    try {
      await onPurgePeriod(activePeriod);
      setIsPurgeModalOpen(false);
      setPurgeConfirmation("");
    } catch {
      // error handled by parent toast
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-xs space-y-4 mb-6 transition-all">
      {/* Top Row: Period Selectors & Quick Presets */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Dropdown Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Label */}
          <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wider">
            <CalendarDays size={16} className="text-[#8B0000]" />
            <span>Periode:</span>
          </div>

          {/* Month Dropdown */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2 pr-8 focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition cursor-pointer"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              ▼
            </div>
          </div>

          {/* Year Dropdown */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedYear(val === "all" ? "all" : Number(val));
              }}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2 pr-8 focus:outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 transition cursor-pointer"
            >
              <option value="all">Semua Tahun</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              ▼
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs gap-1">
            <button
              type="button"
              onClick={() => handlePreset("this_month")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                selectedMonth === currentMonthStr && selectedYear === currentYear
                  ? "bg-[#8B0000] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => handlePreset("last_month")}
              className="px-2.5 py-1 rounded-lg font-bold text-[11px] text-slate-600 hover:text-slate-900 transition-all"
            >
              Bulan Lalu
            </button>
            <button
              type="button"
              onClick={() => handlePreset("this_year")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                selectedMonth === "all" && selectedYear === currentYear
                  ? "bg-[#8B0000] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tahun Ini ({currentYear})
            </button>
            <button
              type="button"
              onClick={() => handlePreset("all")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                selectedMonth === "all" && selectedYear === "all"
                  ? "bg-[#8B0000] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua
            </button>
          </div>
        </div>

        {/* Action Buttons: Export & Purge */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk Delete Selected Button */}
          {selectedCount > 0 && onDeleteSelected && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDeleteSelected}
              disabled={isDeletingSelected}
              className="h-9 px-3 text-xs font-bold text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded-xl shadow-xs animate-in fade-in"
            >
              <Trash2 size={13} className="mr-1.5" />
              Hapus Terpilih ({selectedCount})
            </Button>
          )}

          {/* Export Excel Button */}
          {onExportExcel && (
            <Button
              type="button"
              size="sm"
              onClick={onExportExcel}
              disabled={isExporting}
              className="h-9 px-3.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition"
              title={`Export Excel data ${activePeriod.periodLabel}`}
            >
              {isExporting ? (
                <>
                  <RefreshCw size={14} className="mr-1.5 animate-spin" />
                  Mengunduh...
                </>
              ) : (
                <>
                  <FileSpreadsheet size={14} className="mr-1.5" />
                  Export Excel ({activePeriod.isAllMonths ? `Tahun ${activePeriod.year}` : activePeriod.periodLabel})
                </>
              )}
            </Button>
          )}

          {/* Export PDF Button */}
          {onExportPdf && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportPdf}
              disabled={isExporting}
              className="h-9 px-3 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-100 rounded-xl shadow-xs"
            >
              <FileText size={14} className="mr-1.5 text-rose-600" />
              PDF
            </Button>
          )}

          {/* Purge / Delete Period Button (Super Admin / Admin) */}
          {canPurge && onPurgePeriod && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPurgeModalOpen(true)}
              className="h-9 px-3 text-xs font-bold text-rose-700 border-rose-200 bg-rose-50/70 hover:bg-rose-100 rounded-xl shadow-xs transition"
              title="Hapus data pada periode ini"
            >
              <Trash2 size={13} className="mr-1.5 text-rose-600" />
              Hapus Periode Ini
            </Button>
          )}

          {extraActions}
        </div>
      </div>

      {/* Bottom Info Bar: Active Period Range Preview */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Rentang Tanggal Aktif:</span>
          {activePeriod.isAllTime ? (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-slate-600 font-bold">
              Tanpa Batasan Waktu
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-[#8B0000] border border-rose-200 font-mono font-bold">
              {activePeriod.startDate} s/d {activePeriod.endDate}
            </span>
          )}
        </div>

        <div className="text-slate-400 font-medium">
          Data akan otomatis tersaring & siap diexport per periode bulanan / tahunan.
        </div>
      </div>

      {/* SECURE PURGE CONFIRMATION MODAL */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-130 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-rose-100 flex items-center gap-3.5 bg-rose-50/70">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-rose-900 leading-tight">
                  Konfirmasi Hapus Data Periode
                </h3>
                <p className="text-xs text-rose-700/80 font-medium mt-0.5">
                  Tindakan destruktif tidak dapat dibatalkan
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPurgeModalOpen(false);
                  setPurgeConfirmation("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Target Pembersihan:</div>
                <div className="text-sm font-black text-slate-900">{reportTitle}</div>
                <div className="text-xs font-semibold text-[#8B0000]">{activePeriod.periodLabel}</div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Semua data transaksi dan berkas lampiran yang masuk pada rentang waktu{" "}
                <span className="font-bold text-slate-900">
                  {activePeriod.isAllTime ? "Semua Waktu" : `${activePeriod.startDate} s/d ${activePeriod.endDate}`}
                </span>{" "}
                akan dihapus permanen dari server.
              </p>

              <div className="space-y-1.5 pt-2">
                <label htmlFor="purge-confirmation-input" className="text-xs font-bold text-slate-700">
                  Ketik kata <span className="text-rose-600 uppercase font-black tracking-wider">HAPUS</span> untuk konfirmasi:
                </label>
                <input
                  id="purge-confirmation-input"
                  type="text"
                  placeholder="Ketik HAPUS..."
                  value={purgeConfirmation}
                  onChange={(e) => setPurgeConfirmation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 uppercase"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2.5 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPurgeModalOpen(false);
                  setPurgeConfirmation("");
                }}
                className="text-xs font-bold px-4 h-9"
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExecutePurge}
                disabled={isPurging || purgeConfirmation.trim().toUpperCase() !== "HAPUS"}
                className="text-xs font-bold px-4 h-9 bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isPurging ? (
                  <>
                    <RefreshCw size={13} className="mr-1.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 size={13} className="mr-1.5" />
                    Hapus Permanen
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
