import React, { useState } from "react";
import { 
  Printer, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  Calendar, 
  User, 
  Building2, 
  MapPin, 
  Phone, 
  AlertTriangle,
  ZoomIn,
  ShieldCheck,
  Briefcase,
  Car,
  CreditCard,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { terbilang } from "@/lib/terbilang";

export type ApprovalType = 
  | "leave" 
  | "reimbursement" 
  | "profile" 
  | "overtime" 
  | "permit" 
  | "dinas_luar" 
  | "fund_request"
  | "vehicle_log";

export interface OvertimeItemDetail {
  id?: number;
  date?: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

export interface ReimbursementItemDetail {
  id?: number;
  item_name?: string;
  description?: string;
  amount?: number | string;
  receipt?: string;
}

export interface ApprovalItem {
  id: number;
  type: ApprovalType;
  user_name: string;
  user_email?: string;
  user_role?: string;
  category: string;
  description: string;
  amount?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  attachment?: string;
  attachments?: string[];
  signature?: string;
  created_at: string;
  // Permit-specific fields
  permit_category?: string;
  permit_has_doctor_note?: boolean;
  permit_is_deducted?: boolean;
  target_supervisor_id?: number | null;
  // Leave-specific
  leave_address?: string;
  emergency_phone?: string;
  // Overtime-specific
  overtime_items?: OvertimeItemDetail[];
  // Reimbursement-specific
  reimbursement_items?: ReimbursementItemDetail[];
  reimbursement_divisi?: string;
  reimbursement_tujuan?: string;
  // Profile-specific
  profile_new_data?: Record<string, unknown>;
  // Dinas Luar-specific
  dinas_luar_status?: string;
  dinas_luar_destination?: string;
  dinas_luar_notes?: string;
  // Vehicle Log-specific
  vehicle_name?: string;
  plate_number?: string;
  odometer_start?: number;
  odometer_end?: number;
  distance?: number;
  purpose?: string;
  destination?: string;
  // Dynamic approval workflow
  current_approval_step?: number | null;
  current_step_info?: Record<string, any>;
}

interface OfficialApprovalDocumentSheetProps {
  item: ApprovalItem;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

export const formatCurrency = (amount: number | string) => {
  const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num || 0);
};

export const getStorageUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";
  return `${backendUrl}/storage/${path.replace(/^\/+/, '')}`;
};

export default function OfficialApprovalDocumentSheet({
  item,
  onApprove,
  onReject,
  onClose,
}: OfficialApprovalDocumentSheetProps) {
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const getDocumentCode = () => {
    const d = new Date(item.created_at || Date.now());
    const dateStr = d.toISOString().substring(0, 10).replaceAll("-", "");
    const idStr = String(item.id).padStart(5, "0");
    switch (item.type) {
      case "leave":
        return `HRD/F-CT/${dateStr}/${idStr}`;
      case "permit":
        return `HRD/F-IZ/${dateStr}/${idStr}`;
      case "overtime":
        return `HRD/F-SPKL/${dateStr}/${idStr}`;
      case "reimbursement":
        return `FIN/F-REIM/${dateStr}/${idStr}`;
      case "fund_request":
        return `FIN/F-FUND/${dateStr}/${idStr}`;
      case "vehicle_log":
        return `GA/F-LOG/${dateStr}/${idStr}`;
      case "dinas_luar":
        return `OPS/F-SPPD/${dateStr}/${idStr}`;
      case "profile":
        return `HRD/F-PDK/${dateStr}/${idStr}`;
      default:
        return `DOC/${dateStr}/${idStr}`;
    }
  };

  const getFormTitle = () => {
    switch (item.type) {
      case "leave":
        return "FORMULIR PERMOHONAN CUTI KARYAWAN";
      case "permit":
        return "SURAT KETERANGAN & FORMULIR IZIN KERJA";
      case "overtime":
        return "SURAT PERINTAH KERJA LEMBUR (SPKL)";
      case "reimbursement":
        return "FORMULIR KLAIM BIAYA & REIMBURSEMENT";
      case "fund_request":
        return "PENGAJUAN UANG MUKA / PERMINTAAN DANA";
      case "vehicle_log":
        return "LEMBAR PENGGUNAAN & LOGBOOK ARMADA DINAS";
      case "dinas_luar":
        return "SURAT TUGAS & LAPORAN DINAS LUAR KANTOR";
      case "profile":
        return "FORMULIR PEMBARUAN DATA INDUK KARYAWAN";
      default:
        return "FORMULIR PENGAJUAN RESMI PERUSAHAAN";
    }
  };

  const formattedDate = new Date(item.created_at || Date.now()).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const numericAmount = item.amount ? Number.parseFloat(item.amount) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-100 rounded-2xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden my-auto">
        
        {/* TOP CONTROLS / TOOLBAR (NOT PRINTED) */}
        <div className="p-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-lg">
              <FileText size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">{getFormTitle()}</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  {getDocumentCode()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Dokumen resmi untuk review & persetujuan manajemen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
              title="Cetak Formulir Ini"
            >
              <Printer size={14} /> Cetak / Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              title="Tutup Modal"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>

        {/* SCROLLABLE DOCUMENT PREVIEW AREA */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-slate-200/70">
          
          {/* THE OFFICIAL PRINTABLE PAPER SHEET */}
          <div 
            id="official-printable-form"
            className="bg-white text-slate-900 shadow-xl border border-slate-300 rounded-lg p-6 sm:p-10 max-w-3xl mx-auto text-xs font-sans print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none"
            style={{ minHeight: "900px" }}
          >
            {/* 1. CORPORATE LETTERHEAD (KOP SURAT) */}
            <div className="border-b-2 border-black pb-3 mb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img 
                    src="/artacom.png" 
                    alt="Logo Perusahaan" 
                    className="h-12 sm:h-14 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <h1 className="font-black text-sm sm:text-base tracking-wider text-black uppercase leading-tight">
                      PT ARTACOMINDO JEJARING NUSA
                    </h1>
                    <p className="text-[10px] text-slate-600 font-medium leading-tight">
                      Integrated IT Infrastructure, Fiber Optics & Enterprise Network Solutions
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      SaaS Enterprise Human Resource Management System
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 border-l border-slate-300 pl-3">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">NO. DOKUMEN</div>
                  <div className="font-mono font-bold text-[11px] text-black">{getDocumentCode()}</div>
                  <div className="text-[9px] text-slate-600 mt-1 font-medium">Tanggal: {formattedDate}</div>
                </div>
              </div>
            </div>

            {/* 2. FORM TITLE BANNER */}
            <div className="text-center my-4 py-1.5 bg-slate-100 border-y border-slate-300">
              <h2 className="font-black text-sm sm:text-base uppercase tracking-wider text-black">
                {getFormTitle()}
              </h2>
            </div>

            {/* 3. SECTION I: IDENTITAS KARYAWAN (PEMOHON) */}
            <div className="mb-5">
              <div className="bg-slate-800 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mb-2 flex justify-between items-center rounded-xs">
                <span>I. DATA IDENTITAS PEMOHON</span>
                <span className="text-[9px] text-slate-300 font-normal">Formulir Pengajuan Karyawan</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs bg-slate-50/70 p-3 rounded border border-slate-200">
                <div className="flex items-center">
                  <span className="w-28 text-slate-500 font-bold shrink-0">Nama Pemohon</span>
                  <span className="mr-2 font-bold">:</span>
                  <span className="font-bold text-slate-900 truncate">{item.user_name}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-28 text-slate-500 font-bold shrink-0">Jabatan / Role</span>
                  <span className="mr-2 font-bold">:</span>
                  <span className="font-semibold text-slate-800">{item.user_role || "Karyawan"}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-28 text-slate-500 font-bold shrink-0">Email Perusahaan</span>
                  <span className="mr-2 font-bold">:</span>
                  <span className="text-slate-700 truncate">{item.user_email || "-"}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-28 text-slate-500 font-bold shrink-0">Status Pengajuan</span>
                  <span className="mr-2 font-bold">:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <Clock size={10} className="mr-1" />
                    {item.current_approval_step ? `Menunggu Approval Tahap ${item.current_approval_step}` : "Menunggu Persetujuan"}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. SECTION II: RINCIAN FORMULIR SPESIFIK */}
            <div className="mb-5">
              <div className="bg-slate-800 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mb-2 flex justify-between items-center rounded-xs">
                <span>II. RINCIAN PERMOHONAN & SPESIFIKASI FORMULIR</span>
                <span className="text-[9px] text-slate-300 font-normal">Detail Formulir Pengajuan</span>
              </div>

              {/* A. FORMULIR CUTI */}
              {item.type === "leave" && (
                <div className="space-y-3">
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 w-40 border-r border-slate-200">Jenis Cuti</td>
                          <td className="p-2.5 font-black text-slate-900">{item.category || "Cuti Tahunan"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Periode / Tanggal Cuti</td>
                          <td className="p-2.5 font-semibold text-slate-900">
                            {item.start_date || "-"} <span className="text-slate-400 font-normal">s/d</span> {item.end_date || "-"}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Alamat Selama Cuti</td>
                          <td className="p-2.5 text-slate-800">{item.leave_address || "Tidak ada alamat khusus"}</td>
                        </tr>
                        <tr>
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Kontak Darurat</td>
                          <td className="p-2.5 font-semibold text-slate-800">{item.emergency_phone || "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <p className="font-bold text-[11px] text-slate-700 uppercase mb-1">Alasan Permohonan Cuti:</p>
                    <p className="text-xs text-slate-800 italic leading-relaxed">
                      &ldquo;{item.description || "Tidak ada rincian keterangan cuti tambahan"}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* B. FORMULIR IZIN */}
              {item.type === "permit" && (
                <div className="space-y-3">
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 w-44 border-r border-slate-200">Kategori Izin</td>
                          <td className="p-2.5 font-black text-slate-900">
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-900 font-bold rounded mr-2 border border-purple-300">
                              [{item.permit_category || "I"}]
                            </span>
                            {item.category || "Izin Kerja"}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Waktu / Periode Izin</td>
                          <td className="p-2.5 font-semibold text-slate-900">
                            {item.start_date || "-"} {item.end_date ? `s/d ${item.end_date}` : ""}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Surat Keterangan Dokter</td>
                          <td className="p-2.5">
                            {item.permit_has_doctor_note ? (
                              <span className="font-bold text-emerald-700">✓ Ada Surat Keterangan Dokter Terlampir</span>
                            ) : (
                              <span className="text-slate-600">✗ Tidak Ada Surat Dokter</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Status Pemotongan Gaji</td>
                          <td className="p-2.5 font-bold">
                            {item.permit_is_deducted ? (
                              <span className="text-red-600">Dipotong Gaji Sesuai Regulasi Absensi</span>
                            ) : (
                              <span className="text-emerald-700">Tidak Dipotong Gaji (Disetujui Resmi)</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <p className="font-bold text-[11px] text-slate-700 uppercase mb-1">Keterangan / Alasan Izin:</p>
                    <p className="text-xs text-slate-800 italic leading-relaxed">
                      &ldquo;{item.description || "Tidak ada keterangan tambahan"}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* C. FORMULIR LEMBUR (SPKL) */}
              {item.type === "overtime" && (
                <div className="space-y-3">
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs">
                    <span className="font-bold text-amber-900 uppercase">Tugas Pokok Lembur: </span>
                    <span className="font-semibold text-slate-800">{item.category}</span>
                  </div>

                  {/* Tabel Jadwal Lembur */}
                  <div className="border-2 border-black rounded-sm overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-200 font-bold text-black border-b-2 border-black text-center">
                          <th className="p-2 border-r border-black w-10">No</th>
                          <th className="p-2 border-r border-black w-32">Hari / Tanggal</th>
                          <th className="p-2 border-r border-black w-28">Jam Mulai - Selesai</th>
                          <th className="p-2 text-left px-3">Uraian Tugas / Output yang Dikerjakan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.overtime_items && item.overtime_items.length > 0 ? (
                          item.overtime_items.map((ot, idx) => (
                            <tr key={idx} className="border-b border-slate-300">
                              <td className="p-2 border-r border-black text-center font-bold">{idx + 1}</td>
                              <td className="p-2 border-r border-black font-semibold text-slate-900 text-center">
                                {ot.date || item.start_date || "-"}
                              </td>
                              <td className="p-2 border-r border-black text-center font-mono font-bold text-slate-800">
                                {ot.start_time || "-"} s/d {ot.end_time || "-"}
                              </td>
                              <td className="p-2 px-3 text-slate-800 font-medium">
                                {ot.reason || item.description || "-"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-black text-center font-bold">1</td>
                            <td className="p-2 border-r border-black font-semibold text-center">{item.start_date || "-"}</td>
                            <td className="p-2 border-r border-black text-center font-mono font-bold">-</td>
                            <td className="p-2 px-3 text-slate-800 font-medium">{item.description}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <p className="font-bold text-[11px] text-slate-700 uppercase mb-1">Catatan Urgensi Lembur:</p>
                    <p className="text-xs text-slate-800 italic leading-relaxed">
                      &ldquo;{item.description || "Dikerjakan untuk menyelesaikan target operasional perusahaan."}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* D. FORMULIR REIMBURSEMENT */}
              {item.type === "reimbursement" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
                    <div>
                      <span className="font-bold text-slate-500 block uppercase text-[10px]">Divisi Pembebanan:</span>
                      <span className="font-bold text-slate-900">{item.reimbursement_divisi || "Operasional"}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 block uppercase text-[10px]">Tujuan / Keperluan:</span>
                      <span className="font-bold text-slate-900">{item.reimbursement_tujuan || item.description || "Klaim Biaya"}</span>
                    </div>
                  </div>

                  {/* Tabel Item Klaim */}
                  <div className="border-2 border-black rounded-sm overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-200 font-bold text-black border-b-2 border-black">
                          <th className="p-2 border-r border-black w-10 text-center">No</th>
                          <th className="p-2 border-r border-black text-left px-3">Item Pengeluaran / Biaya</th>
                          <th className="p-2 border-r border-black text-left px-3">Keterangan / Kuitansi</th>
                          <th className="p-2 text-right px-3 w-36">Nominal (IDR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.reimbursement_items && item.reimbursement_items.length > 0 ? (
                          item.reimbursement_items.map((r, idx) => (
                            <tr key={idx} className="border-b border-slate-300">
                              <td className="p-2 border-r border-black text-center font-bold">{idx + 1}</td>
                              <td className="p-2 border-r border-black px-3 font-semibold text-slate-900">{r.item_name || "Item Biaya"}</td>
                              <td className="p-2 border-r border-black px-3 text-slate-600">{r.description || "-"}</td>
                              <td className="p-2 px-3 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(r.amount || 0)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-black text-center font-bold">1</td>
                            <td className="p-2 border-r border-black px-3 font-semibold">{item.category}</td>
                            <td className="p-2 border-r border-black px-3 text-slate-600">{item.description}</td>
                            <td className="p-2 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(numericAmount)}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-emerald-50 font-black text-black border-t-2 border-black">
                          <td colSpan={3} className="p-2 border-r border-black text-right pr-4 uppercase tracking-wider text-[11px]">
                            TOTAL KLAIM KESELURUHAN
                          </td>
                          <td className="p-2 px-3 text-right font-mono text-sm text-emerald-800">
                            {formatCurrency(numericAmount)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Terbilang */}
                  {numericAmount > 0 && (
                    <div className="p-2.5 bg-slate-50 border border-slate-300 rounded text-xs flex items-center gap-2">
                      <span className="font-bold text-slate-600 uppercase text-[10px]">Terbilang:</span>
                      <span className="font-bold italic text-slate-900">{terbilang(numericAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* E. FORMULIR FUND REQUEST (KASBON / DANA) */}
              {item.type === "fund_request" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
                    <div>
                      <span className="font-bold text-slate-500 block uppercase text-[10px]">Keperluan Dana:</span>
                      <span className="font-bold text-slate-900">{item.category || item.description}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 block uppercase text-[10px]">Estimasi Total Dana:</span>
                      <span className="font-black text-slate-900 text-sm font-mono">{formatCurrency(numericAmount)}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <p className="font-bold text-[11px] text-slate-700 uppercase mb-1">Rincian & Justifikasi Pengajuan:</p>
                    <p className="text-xs text-slate-800 leading-relaxed italic">
                      &ldquo;{item.description || "Pengajuan dana operasional perusahaan"}&rdquo;
                    </p>
                  </div>

                  {numericAmount > 0 && (
                    <div className="p-2.5 bg-slate-50 border border-slate-300 rounded text-xs flex items-center gap-2">
                      <span className="font-bold text-slate-600 uppercase text-[10px]">Terbilang:</span>
                      <span className="font-bold italic text-slate-900">{terbilang(numericAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* F. FORMULIR VEHICLE LOG (LOG ARMADA) */}
              {item.type === "vehicle_log" && (
                <div className="space-y-3">
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 w-44 border-r border-slate-200">Armada / Kendaraan</td>
                          <td className="p-2.5 font-black text-slate-900">
                            {item.vehicle_name || "Mobil Operasional"} 
                            {item.plate_number && <span className="ml-2 font-mono px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold">({item.plate_number})</span>}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Lokasi Tujuan</td>
                          <td className="p-2.5 font-semibold text-slate-900">{item.destination || item.category || "-"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Odometer Berangkat</td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">
                            {item.odometer_start ? `${item.odometer_start.toLocaleString()} KM` : "-"}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Odometer Kembali</td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">
                            {item.odometer_end ? `${item.odometer_end.toLocaleString()} KM` : "-"}
                          </td>
                        </tr>
                        {item.distance && (
                          <tr className="border-b border-slate-200 bg-indigo-50/50">
                            <td className="p-2.5 font-bold text-indigo-950 border-r border-slate-200">Total Jarak Tempuh</td>
                            <td className="p-2.5 font-mono font-black text-indigo-900">{item.distance} KM</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <p className="font-bold text-[11px] text-slate-700 uppercase mb-1">Keperluan Pemakaian Armada:</p>
                    <p className="text-xs text-slate-800 italic leading-relaxed">
                      &ldquo;{item.purpose || item.description || "Operasional dinas kantor"}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* G. FORMULIR DINAS LUAR */}
              {item.type === "dinas_luar" && (
                <div className="space-y-3">
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 w-44 border-r border-slate-200">Instansi / Lokasi Tujuan</td>
                          <td className="p-2.5 font-black text-slate-900">{item.dinas_luar_destination || item.category || "-"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Waktu Check-In Tugas</td>
                          <td className="p-2.5 font-semibold text-slate-900">{item.start_date || "-"}</td>
                        </tr>
                        <tr>
                          <td className="bg-slate-50 p-2.5 font-bold text-slate-700 border-r border-slate-200">Waktu Check-Out Tugas</td>
                          <td className="p-2.5 font-semibold text-slate-900">{item.end_date || "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <p className="font-bold text-[11px] text-slate-700 uppercase mb-1">Laporan / Catatan Pelaksanaan Tugas:</p>
                    <p className="text-xs text-slate-800 italic leading-relaxed">
                      &ldquo;{item.dinas_luar_notes || item.description || "Melaksanakan kunjungan dan instalasi teknis di lokasi klien."}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* H. FORMULIR PROFILE UPDATE */}
              {item.type === "profile" && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <p className="font-bold text-[11px] text-slate-700 uppercase mb-1">Alasan / Rincian Perubahan Data:</p>
                    <p className="text-xs text-slate-800 leading-relaxed">
                      {item.description || "Pembaruan informasi profil karyawan"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 5. SECTION III: BUKTI LAMPIRAN / DOKUMEN PENDUKUNG (JIKA ADA) */}
            {item.attachment && (
              <div className="mb-5">
                <div className="bg-slate-800 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mb-2 flex justify-between items-center rounded-xs">
                  <span>III. LAMPIRAN DOKUMEN & BUKTI FISIK</span>
                  <span className="text-[9px] text-slate-300 font-normal">Bukti Sah Pengajuan</span>
                </div>
                
                <div className="p-3 bg-slate-50 border border-slate-300 rounded flex flex-col sm:flex-row items-center gap-4">
                  <div 
                    onClick={() => setSelectedPreviewImage(getStorageUrl(item.attachment!))}
                    className="relative group cursor-pointer border border-slate-300 rounded bg-white overflow-hidden shrink-0 shadow-sm hover:shadow-md transition"
                  >
                    <img 
                      src={getStorageUrl(item.attachment)} 
                      alt="Lampiran Dokumen" 
                      className="w-32 h-28 object-contain bg-slate-100 p-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://placehold.co/300x200?text=Dokumen+Terlampir";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-[10px] font-bold">
                      <ZoomIn size={14} className="mr-1" /> Perbesar
                    </div>
                  </div>

                  <div className="flex-1 text-xs">
                    <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                      <FileText size={14} className="text-blue-600" /> Dokumen Lampiran Resmi
                    </p>
                    <p className="text-slate-600 text-[11px] leading-relaxed mb-2">
                      Dokumen/kuitansi/surat terlampir diunggah sebagai bukti pendukung verifikasi persetujuan formulir ini.
                    </p>
                    <a 
                      href={getStorageUrl(item.attachment)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[10px] transition"
                    >
                      <ExternalLink size={12} /> Buka di Tab Baru
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* 6. SECTION IV: LEMBAR OTORISASI & TANDA TANGAN DIGITAL (SIGNATURE SHEET) */}
            <div className="mt-6 pt-2">
              <div className="bg-slate-800 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mb-2 flex justify-between items-center rounded-xs">
                <span>IV. LEMBAR PENGESAHAN & OTORISASI PERSETUJUAN</span>
                <span className="text-[9px] text-slate-300 font-normal">Validitas Otorisasi Berlaku Sah</span>
              </div>

              <div className="border-2 border-black rounded-sm overflow-hidden bg-white">
                <div className="grid grid-cols-3 border-b-2 border-black text-center font-bold text-black bg-slate-100 text-[9px] sm:text-[10px] py-1.5 uppercase tracking-wider">
                  <div className="border-r-2 border-black">1. PEMOHON / KARYAWAN</div>
                  <div className="border-r-2 border-black">2. ATASAN LANGSUNG / SPV</div>
                  <div>3. HRD / MANAJEMEN PENYETUJU</div>
                </div>

                <div className="grid grid-cols-3 text-center">
                  {/* PEMOHON TTD */}
                  <div className="border-r-2 border-black p-3 flex flex-col justify-between min-h-[90px] items-center">
                    <div className="h-14 flex items-center justify-center w-full">
                      {item.signature ? (
                        <img 
                          src={item.signature.startsWith("data:") ? item.signature : getStorageUrl(item.signature)} 
                          alt="Tanda Tangan Pemohon" 
                          className="h-12 object-contain"
                        />
                      ) : (
                        <div className="inline-block border border-emerald-600 text-emerald-700 bg-emerald-50 rounded px-2 py-0.5 font-bold text-[9px] uppercase">
                          TERVERIFIKASI DIGITAL
                        </div>
                      )}
                    </div>
                    <div className="border-t border-dotted border-slate-500 w-full pt-1 text-slate-900 font-bold text-[10px] truncate">
                      ( {item.user_name} )
                    </div>
                    <div className="text-[8px] text-slate-500 font-medium mt-0.5">Pemohon</div>
                  </div>

                  {/* ATASAN LANGSUNG STEP 1 */}
                  <div className="border-r-2 border-black p-3 flex flex-col justify-between min-h-[90px] items-center">
                    <div className="h-14 flex items-center justify-center w-full">
                      {item.current_approval_step && item.current_approval_step > 1 ? (
                        <div className="border-2 border-blue-600 text-blue-700 bg-blue-50/80 rounded px-2.5 py-1 font-black text-[10px] uppercase tracking-wider">
                          ACC ATASAN ✓
                        </div>
                      ) : (
                        <div className="border border-dashed border-amber-400 bg-amber-50 text-amber-800 rounded px-2 py-0.5 font-bold text-[9px] uppercase">
                          MENUNGGU PERSETUJUAN
                        </div>
                      )}
                    </div>
                    <div className="border-t border-dotted border-slate-500 w-full pt-1 text-slate-700 italic text-[10px]">
                      ( Atasan Langsung )
                    </div>
                    <div className="text-[8px] text-slate-500 font-medium mt-0.5">Verifikator Tahap 1</div>
                  </div>

                  {/* FINAL APPROVAL / HRD */}
                  <div className="p-3 flex flex-col justify-between min-h-[90px] items-center">
                    <div className="h-14 flex items-center justify-center w-full">
                      {item.status === "approved" ? (
                        <div className="border-2 border-emerald-600 text-emerald-700 bg-emerald-50/80 rounded px-2.5 py-1 font-black text-[10px] uppercase tracking-wider">
                          DISETUJUI RESMI ✓
                        </div>
                      ) : item.status === "rejected" ? (
                        <div className="border-2 border-red-600 text-red-700 bg-red-50/80 rounded px-2.5 py-1 font-black text-[10px] uppercase tracking-wider">
                          DITOLAK ✗
                        </div>
                      ) : (
                        <div className="border border-dashed border-slate-300 text-slate-400 rounded px-2 py-0.5 font-semibold text-[9px] italic">
                          Menunggu Otorisasi
                        </div>
                      )}
                    </div>
                    <div className="border-t border-dotted border-slate-500 w-full pt-1 text-slate-700 italic text-[10px]">
                      ( HRD & Operations )
                    </div>
                    <div className="text-[8px] text-slate-500 font-medium mt-0.5">Penyetuju Akhir</div>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER NOTE */}
            <div className="mt-4 pt-2 border-t border-slate-300 text-[8px] text-slate-400 flex justify-between items-center">
              <span>Dicetak otomatis melalui HRMS SaaS Platform PT Artacomindo Jejaring Nusa</span>
              <span>Dokumen Elektronik Sah Berdasarkan UU ITE No. 11/2008</span>
            </div>

          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onReject}
              className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 flex items-center gap-1.5 transition active:scale-95 shadow-sm"
            >
              <XCircle size={15} /> Tolak Formulir
            </button>
            <button
              onClick={onApprove}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-emerald-900/10"
            >
              <CheckCircle2 size={15} /> Setujui Formulir Sekarang
            </button>
          </div>
        </div>

      </div>

      {/* IMAGE PREVIEW MODAL */}
      {selectedPreviewImage && (
        <div 
          onClick={() => setSelectedPreviewImage(null)}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden p-2 shadow-2xl">
            <img 
              src={selectedPreviewImage} 
              alt="Preview Lampiran" 
              className="max-h-[85vh] w-auto mx-auto object-contain"
            />
            <button 
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black text-white rounded-full transition"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
