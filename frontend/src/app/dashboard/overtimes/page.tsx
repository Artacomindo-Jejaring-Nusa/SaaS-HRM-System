"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { Plus, Search, Eye, Clock, FileDown, Trash2, Save, Send, Printer, ArrowLeft, Check, X } from "lucide-react";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";
import SignaturePad from "@/components/SignaturePad";

interface OvertimeItem {
  id?: number;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
}

interface OvertimeRecord {
  id: number;
  title: string | null;
  status: string;
  user?: { 
    name: string; 
    role?: { name: string }; 
    office?: { name: string }; 
    company?: { name: string };
    supervisor?: { name: string };
  };
  approver?: { name: string } | null;
  remark?: string | null;
  items?: OvertimeItem[];
  created_at?: string;
  updated_at?: string;
  signature?: string | null;
  approved_at?: string | null;
  // Legacy fields
  date?: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

const emptyItem = (): OvertimeItem => ({ date: "", start_time: "", end_time: "", reason: "" });

export default function OvertimesPage() {
  const { user } = useAuth();
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  const [viewMode, setViewMode] = useState<"list" | "create" | "detail">("list");
  const [selectedItem, setSelectedItem] = useState<OvertimeRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formItems, setFormItems] = useState<OvertimeItem[]>([emptyItem()]);
  const [formSignature, setFormSignature] = useState("");

  useEffect(() => { fetchOvertimes(page); }, [page]);

  const fetchOvertimes = async (p: number) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/overtimes?page=${p}`);
      setOvertimes(res.data.data?.data || res.data.data || []);
      if (res.data.data?.current_page) {
        setPagination({ current_page: res.data.data.current_page, last_page: res.data.data.last_page, total: res.data.data.total });
      }
    } catch { console.error("Gagal fetch overtimes"); }
    finally { setLoading(false); }
  };

  const openCreatePage = () => {
    setEditingId(null);
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const today = new Date();
    setFormTitle(`${months[today.getMonth()]} ${today.getFullYear()}`);
    setFormItems([emptyItem()]);
    setFormSignature("");
    setViewMode("create");
  };

  const openEditPage = (ot: OvertimeRecord) => {
    setEditingId(ot.id);
    setFormTitle(ot.title || "");
    setFormSignature(ot.signature || "");
    if (ot.items && ot.items.length > 0) {
      setFormItems(ot.items.map(i => ({ date: i.date, start_time: i.start_time?.substring(0,5) || "", end_time: i.end_time?.substring(0,5) || "", reason: i.reason })));
    } else if (ot.date) {
      setFormItems([{ date: ot.date, start_time: ot.start_time?.substring(0,5) || "", end_time: ot.end_time?.substring(0,5) || "", reason: ot.reason || "" }]);
    } else {
      setFormItems([emptyItem()]);
    }
    setViewMode("create");
  };

  const addItem = () => setFormItems([...formItems, emptyItem()]);
  const removeItem = (idx: number) => { if (formItems.length > 1) setFormItems(formItems.filter((_, i) => i !== idx)); };
  const updateItem = (idx: number, field: keyof OvertimeItem, val: string) => {
    const updated = [...formItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setFormItems(updated);
  };

  const handleSave = async (submitStatus: "draft" | "pending") => {
    if (submitStatus === "pending") {
      if (!formSignature) {
        toast.warning("Tanda tangan digital wajib diisi!");
        return;
      }
      if (formItems.some(i => !i.date || !i.start_time || !i.end_time || !i.reason)) {
        toast.warning("Semua field item lembur wajib diisi untuk pengajuan.");
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const payload = { title: formTitle || null, status: submitStatus, items: formItems, signature: formSignature || null };
      if (editingId) {
        await axiosInstance.put(`/overtimes/${editingId}`, payload);
      } else {
        await axiosInstance.post("/overtimes", payload);
      }
      toast.success(submitStatus === "draft" ? "Draf lembur berhasil disimpan." : "Pengajuan lembur berhasil dikirim!");
      setViewMode("list");
      fetchOvertimes(page);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyimpan lembur");
    } finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus pengajuan lembur ini?")) return;
    try {
      await axiosInstance.delete(`/overtimes/${id}`);
      toast.success("Lembur berhasil dihapus.");
      fetchOvertimes(page);
    } catch (e: any) { toast.error(e.response?.data?.message || "Gagal menghapus"); }
  };

  const handleExport = async () => {
    try {
      const res = await axiosInstance.get('/overtimes/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `laporan-lembur-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { toast.error("Gagal mengekspor data lembur."); }
  };

  const handleViewDetail = async (item: OvertimeRecord) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/overtimes/${item.id}`);
      setSelectedItem(res.data.data);
      setViewMode("detail");
    } catch {
      toast.error("Gagal mengambil detail lembur.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleDownloadPdf = async (recordId: number, userName: string) => {
    try {
      const response = await axiosInstance.get(`/export/overtime/${recordId}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Lembur_${userName.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      toast.error("Gagal mendownload PDF.");
    }
  };

  const handleDownloadExcel = async (recordId: number, userName: string) => {
    try {
      const response = await axiosInstance.get(`/export/overtime/${recordId}/excel`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Lembur_${userName.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      toast.error("Gagal mendownload Excel.");
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; text: string }> = {
      draft: { cls: "dash-badge dash-badge-neutral", text: "Draf" },
      pending: { cls: "dash-badge dash-badge-warning", text: "Menunggu" },
      approved: { cls: "dash-badge dash-badge-success", text: "Disetujui" },
      rejected: { cls: "dash-badge dash-badge-danger", text: "Ditolak" },
    };
    const m = map[status] || { cls: "dash-badge dash-badge-neutral", text: status };
    return <span className={m.cls}>{m.text}</span>;
  };

  const getItemsSummary = (ot: OvertimeRecord) => {
    if (ot.items && ot.items.length > 0) return `${ot.items.length} entry`;
    if (ot.date) return ot.date;
    return "-";
  };

  const getRecordItems = (record: OvertimeRecord): OvertimeItem[] => {
    if (record.items && record.items.length > 0) return record.items;
    if (record.date) {
      return [{ date: record.date, start_time: record.start_time || "", end_time: record.end_time || "", reason: record.reason || "" }];
    }
    return [];
  };

  const getIndonesianMonthYear = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getOvertimePeriod = (record: OvertimeRecord) => {
    if (record.title) return record.title;
    const items = getRecordItems(record);
    if (items.length > 0 && items[0].date) {
      return getIndonesianMonthYear(items[0].date);
    }
    return getIndonesianMonthYear(record.created_at || new Date().toISOString());
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: portrait;
          margin: 10mm 15mm !important;
        }
        @media print {
          body, html {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          aside, .dash-sidebar, .dash-desktop-header, .dash-mobile-header, .dash-overlay,
          .print\\:hidden, .no-print, header, nav, footer, .dash-page-header, .dash-page-actions {
            display: none !important;
          }
          .dash-layout, .dash-main {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 5mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            font-size: 11px !important;
            color: black !important;
          }
          .print-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            margin-bottom: 20pt !important;
            width: 100% !important;
          }
          .print-header h1 {
            font-size: 14pt !important;
            font-weight: bold !important;
            color: #1F4E79 !important;
            text-decoration: underline !important;
          }
          .print-header p {
            margin: 0 !important;
            line-height: 1.3 !important;
            font-size: 10pt !important;
          }
          .print-greetings {
            margin-bottom: 18pt !important;
          }
          .print-greetings p {
            margin: 0 0 6pt 0 !important;
            line-height: 1.4 !important;
            font-size: 10pt !important;
          }
          .print-greetings p:last-child {
            margin-bottom: 0 !important;
          }
          .print-table-wrapper {
            margin-bottom: 18pt !important;
          }
          .excel-table {
            border-collapse: separate !important;
            border-spacing: 0 !important;
            border: 1px solid #000000 !important;
            width: 100% !important;
          }
          .excel-table th, .excel-table td {
            border: none !important;
            border-bottom: 1px solid #000000 !important;
            border-right: 1px solid #000000 !important;
            color: #000000 !important;
            background-clip: padding-box !important;
            padding: 6px 8px !important;
          }
          .excel-table th {
            background-color: #D9E1F2 !important;
            font-weight: bold !important;
          }
          .excel-table th:last-child, .excel-table td:last-child {
            border-right: none !important;
          }
          .excel-table tr:last-child td, .excel-table tr:last-child th {
            border-bottom: none !important;
          }
          .print-outro {
            margin-top: 15pt !important;
            margin-bottom: 25pt !important;
          }
          .print-outro p {
            margin: 0 0 3pt 0 !important;
            font-size: 10pt !important;
          }
          .print-outro .italic {
            font-size: 8pt !important;
            color: #555555 !important;
          }
          .print-signatures {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-end !important;
            margin-top: 30pt !important;
            width: 100% !important;
          }
          .print-signatures > div {
            width: 30% !important;
            text-align: center !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}} />

      {/* ================= LIST VIEW ================= */}
      {viewMode === "list" && (
        <div className="print:hidden">
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Lembur Karyawan</h1>
              <p className="dash-page-desc">Kelola pengajuan lembur karyawan dengan format Excel standard PT Narwastu Group.</p>
            </div>
            <div className="dash-page-actions">
              <button onClick={handleExport} className="dash-btn dash-btn-outline" title="Ekspor ke Excel">
                <FileDown size={15} /> Ekspor Excel
              </button>
              <button onClick={openCreatePage} className="dash-btn dash-btn-primary">
                <Plus size={15} /> Ajukan Lembur
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 bg-white p-3 border border-[#ebedf0] rounded-lg">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Cari pengajuan lembur..."
                className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 transition-colors"
              />
            </div>
          </div>

          <div className="dash-table-container">
            {loading ? (
              <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>
            ) : overtimes.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm font-medium">Tidak ada data pengajuan lembur.</div>
            ) : (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Info Karyawan</th>
                      <th>Judul / Periode</th>
                      <th>Entry</th>
                      <th>Status</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overtimes.map((ot) => (
                      <tr key={ot.id}>
                        <td><span className="font-bold text-gray-900">{ot.user?.name || "Karyawan"}</span></td>
                        <td><span className="text-sm text-gray-700">{ot.title || "-"}</span></td>
                        <td>
                          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                            <Clock size={14} className="text-gray-400" />
                            {getItemsSummary(ot)}
                          </div>
                        </td>
                        <td>{getStatusBadge(ot.status)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="dash-action-btn view" title="Lihat Detail" onClick={() => handleViewDetail(ot)}><Eye size={16} /></button>
                            {ot.status === 'draft' && ot.user?.name === user?.name && (
                              <button className="dash-action-btn edit" title="Edit Draf" onClick={() => openEditPage(ot)}>
                                <Save size={16} />
                              </button>
                            )}
                            {['draft','pending'].includes(ot.status) && ot.user?.name === user?.name && (
                              <button className="dash-action-btn delete" title="Hapus" onClick={() => handleDelete(ot.id)}><Trash2 size={16} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pagination.last_page > 1 && (
              <Pagination currentPage={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} onPageChange={setPage} />
            )}
          </div>
        </div>
      )}

      {/* ================= CREATE VIEW (DEDICATED PAGE) ================= */}
      {viewMode === "create" && (
        <div className="print:hidden">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between mb-6 bg-gray-50 p-4 border border-gray-200 rounded-lg">
            <button 
              onClick={() => setViewMode("list")} 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-100 rounded border border-gray-200 transition-colors"
            >
              <ArrowLeft size={16} /> Kembali ke Daftar
            </button>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSave("pending");
            }} 
            className="bg-white shadow-xl border border-gray-300 rounded-xl p-10 max-w-4xl mx-auto my-4 transition-all" 
            style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
          >
            {/* Header section identical to Excel */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-base font-bold text-[#1F4E79] underline tracking-wide">
                  Form. Lembur utk {user?.office?.name || "KP Cakung"}
                </h1>
              </div>
              <div className="text-xs text-gray-800 leading-normal text-right">
                <p className="font-semibold">Kepada Yth,</p>
                <p className="font-semibold">HRD - Personalia</p>
                <p className="font-semibold">PT. Narwastu Group</p>
                <p className="font-semibold">Di Tempat</p>
              </div>
            </div>

            {/* Greetings identical to Excel */}
            <div className="text-xs text-gray-800 space-y-2 mb-4">
              <p className="font-semibold">Dengan Hormat,</p>
              <p>
                Bersama ini diberitahukan bahwa kami menugaskan karyawan berikut untuk melakukan kerja lembur :
              </p>
              <div className="flex items-center gap-2 font-semibold">
                <span>Pada hari, Tanggal :</span>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Contoh: Mei 2026"
                  className="border-b border-gray-400 focus:border-blue-600 focus:outline-none bg-transparent px-1 py-0.5 font-bold text-xs w-48"
                  required
                />
              </div>
            </div>

            {/* Input Table - consolidated for simpler entry but designed with Excel colors/borders */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-gray-800">Rincian Jam & Pekerjaan Lembur</span>
                <button 
                  type="button" 
                  onClick={addItem} 
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Tambah Rincian
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-400 rounded">
                <table className="min-w-full divide-y divide-gray-400 text-xs excel-table">
                  <thead className="bg-[#D9E1F2]">
                    <tr>
                      <th className="border border-gray-400 px-3 py-2 text-center font-bold text-gray-800 w-12">No</th>
                      <th className="border border-gray-400 px-3 py-2 text-center font-bold text-gray-800 w-44">Tanggal</th>
                      <th className="border border-gray-400 px-3 py-2 text-center font-bold text-gray-800 w-32">Mulai</th>
                      <th className="border border-gray-400 px-3 py-2 text-center font-bold text-gray-800 w-32">Selesai</th>
                      <th className="border border-gray-400 px-3 py-2 text-left font-bold text-gray-800">Pekerjaan Yang Dilakukan</th>
                      <th className="border border-gray-400 px-3 py-2 text-center font-bold text-gray-800 w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-400">
                    {formItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-400 px-3 py-2 text-gray-500 text-center font-semibold">{idx + 1}</td>
                        <td className="border border-gray-400 px-2 py-1">
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => updateItem(idx, "date", e.target.value)}
                            className="w-full h-8 border border-gray-300 rounded px-2 text-xs focus:border-blue-500 outline-none"
                            required
                          />
                        </td>
                        <td className="border border-gray-400 px-2 py-1">
                          <input
                            type="time"
                            value={item.start_time}
                            onChange={(e) => updateItem(idx, "start_time", e.target.value)}
                            className="w-full h-8 border border-gray-300 rounded px-2 text-xs focus:border-blue-500 outline-none"
                            required
                          />
                        </td>
                        <td className="border border-gray-400 px-2 py-1">
                          <input
                            type="time"
                            value={item.end_time}
                            onChange={(e) => updateItem(idx, "end_time", e.target.value)}
                            className="w-full h-8 border border-gray-300 rounded px-2 text-xs focus:border-blue-500 outline-none"
                            required
                          />
                        </td>
                        <td className="border border-gray-400 px-2 py-1">
                          <input
                            type="text"
                            value={item.reason}
                            onChange={(e) => updateItem(idx, "reason", e.target.value)}
                            placeholder="Tulis detail pekerjaan..."
                            className="w-full h-8 border border-gray-300 rounded px-2 text-xs focus:border-blue-500 outline-none"
                            required
                          />
                        </td>
                        <td className="border border-gray-400 px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            disabled={formItems.length <= 1}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:text-gray-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Outro text identical to Excel */}
            <div className="text-xs text-gray-800 mt-6 space-y-1">
              <p>Demikian Untuk di ketahui</p>
              <p className="italic text-[10px] text-gray-500 font-bold">Catatan : Form lembur di berikan ke HRD sebelum melakukan aktifitas</p>
            </div>

            {/* Signatures identical to Excel layout */}
            <div className="flex justify-between items-end mt-8 border-t border-gray-200 pt-6">
              {/* Column 1: HRD */}
              <div className="text-center w-1/3">
                <p className="font-bold text-xs text-gray-700 mb-8">Diketahui</p>
                <div className="h-20 flex items-center justify-center">
                  <span className="text-gray-400 font-mono text-[10px]">— Placeholder —</span>
                </div>
                <p className="font-bold text-xs underline text-gray-800 mt-2">(Nazirin Nawawi)</p>
                <p className="text-[10px] text-gray-500 font-bold">HR GA</p>
              </div>

              {/* Column 2: Operasional Manager */}
              <div className="text-center w-1/3">
                <p className="font-bold text-xs text-gray-700 mb-8">Mengetahui</p>
                <div className="h-20 flex items-center justify-center">
                  <span className="text-gray-400 font-mono text-[10px]">— Placeholder —</span>
                </div>
                <p className="font-bold text-xs underline text-gray-800 mt-2">(Operasional)</p>
                <p className="text-[10px] text-gray-500 font-bold">&nbsp;</p>
              </div>

              {/* Column 3: Employee Submission with Signature Pad */}
              <div className="text-center w-1/3">
                <p className="text-xs text-gray-700 mb-1">
                  Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="font-bold text-xs text-gray-700 mb-2">Diajukan oleh:</p>
                <div className="border border-dashed border-gray-300 rounded p-1 bg-white max-w-[200px] mx-auto">
                  <SignaturePad onSign={(dataUrl) => setFormSignature(dataUrl)} />
                </div>
                <p className="font-bold text-xs underline text-gray-800 mt-2">({user?.name})</p>
                <p className="text-[10px] text-gray-500 font-bold">&nbsp;</p>
              </div>
            </div>

            {/* Bottom Buttons */}
            <div className="mt-8 flex justify-end gap-3 no-print border-t border-gray-100 pt-4">
              <button 
                type="button" 
                onClick={() => setViewMode("list")} 
                className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50" 
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button 
                type="button" 
                onClick={() => handleSave("draft")} 
                className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center gap-1.5" 
                disabled={isSubmitting}
              >
                <Save size={14} /> Simpan Draf
              </button>
              <button 
                type="submit" 
                className="px-6 py-2 text-sm font-semibold text-white bg-[#1F4E79] rounded-md hover:bg-[#153654] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 flex items-center gap-1.5" 
                disabled={isSubmitting || !formSignature}
              >
                <Send size={14} /> {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= DETAIL & PRINT VIEW ================= */}
      {viewMode === "detail" && selectedItem && (
        <div>
          {/* Header Actions - Hidden on print */}
          <div className="flex items-center justify-between mb-6 bg-gray-50 p-4 border border-gray-200 rounded-lg no-print">
            <button 
              onClick={() => setViewMode("list")} 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-100 rounded border border-gray-200 transition-colors"
            >
              <ArrowLeft size={16} /> Kembali ke Daftar
            </button>
            <div className="flex items-center gap-2">
              {getStatusBadge(selectedItem.status)}
              <button 
                onClick={handlePrint} 
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-[#1F4E79] hover:bg-[#153654] rounded transition-colors"
              >
                <Printer size={15} /> Cetak / PDF (Ctrl+P)
              </button>
              <button 
                onClick={() => handleDownloadPdf(selectedItem.id, selectedItem.user?.name || "Karyawan")}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded transition-colors shadow-sm"
              >
                <FileDown size={15} /> Unduh PDF Resmi
              </button>
              <button 
                onClick={() => handleDownloadExcel(selectedItem.id, selectedItem.user?.name || "Karyawan")}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-green-700 bg-white border border-green-200 hover:bg-green-50 rounded transition-colors shadow-sm"
              >
                <FileDown size={15} /> Unduh Excel
              </button>
            </div>
          </div>

          <div 
            className="print-container bg-white shadow-xl border border-gray-300 rounded-xl p-12 max-w-4xl mx-auto my-4 transition-all" 
            style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
          >
            {/* Header section identical to Excel */}
            <div className="flex justify-between items-start mb-6 print-header">
              <div>
                <h1 className="text-base font-bold text-[#1F4E79] underline tracking-wide">
                  Form. Lembur utk {selectedItem.user?.office?.name || "KP Cakung"}
                </h1>
              </div>
              <div className="text-xs text-gray-800 leading-normal text-right">
                <p className="font-semibold">Kepada Yth,</p>
                <p className="font-semibold">HRD - Personalia</p>
                <p className="font-semibold">PT. Narwastu Group</p>
                <p className="font-semibold">Di Tempat</p>
              </div>
            </div>

            {/* Greetings identical to Excel */}
            <div className="text-xs text-gray-800 space-y-2 mb-4 print-greetings">
              <p className="font-semibold">Dengan Hormat,</p>
              <p>
                Bersama ini diberitahukan bahwa kami menugaskan karyawan berikut untuk melakukan kerja lembur :
              </p>
              <p className="font-semibold">
                Pada hari, Tanggal : {getOvertimePeriod(selectedItem)}
              </p>
            </div>

            {/* Table 1: Waktu Lembur */}
            <div className="mb-4 print-table-wrapper">
              <table className="w-full border-collapse border border-gray-800 text-xs text-center excel-table">
                <thead className="bg-[#D9E1F2]">
                  <tr>
                    <th className="border border-gray-800 px-3 py-1 font-bold text-gray-800 w-12">No</th>
                    <th className="border border-gray-800 px-3 py-1 font-bold text-gray-800">Nama</th>
                    <th className="border border-gray-800 px-3 py-1 font-bold text-gray-800 w-48">Jam Mulai</th>
                    <th className="border border-gray-800 px-3 py-1 font-bold text-gray-800 w-48">Jam Selesai</th>
                  </tr>
                </thead>
                <tbody>
                  {getRecordItems(selectedItem).map((it, idx) => (
                    <tr key={idx} className="h-7">
                      <td className="border border-gray-800 px-3 py-1 text-gray-700 font-semibold">{idx + 1}</td>
                      <td className="border border-gray-800 px-3 py-1 text-left pl-4 font-semibold text-gray-900">{selectedItem.user?.name || '-'}</td>
                      <td className="border border-gray-800 px-3 py-1 text-gray-800">{it.start_time?.substring(0, 5)}</td>
                      <td className="border border-gray-800 px-3 py-1 text-gray-800">{it.end_time?.substring(0, 5)}</td>
                    </tr>
                  ))}
                  {/* Pad to 5 rows if there are fewer */}
                  {Array.from({ length: Math.max(0, 5 - getRecordItems(selectedItem).length) }).map((_, i) => {
                    const idx = getRecordItems(selectedItem).length + i;
                    return (
                      <tr key={`pad-${idx}`} className="h-7">
                        <td className="border border-gray-800 px-3 py-1 text-gray-400 font-semibold">{idx + 1}</td>
                        <td className="border border-gray-800 px-3 py-1"></td>
                        <td className="border border-gray-800 px-3 py-1"></td>
                        <td className="border border-gray-800 px-3 py-1"></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table 2: Pekerjaan */}
            <div className="mb-4 print-table-wrapper">
              <table className="w-full border-collapse border border-gray-800 text-xs excel-table">
                <thead className="bg-[#D9E1F2]">
                  <tr>
                    <th colSpan={2} className="border border-gray-800 px-3 py-2 font-bold text-left text-gray-800">
                      Untuk Melakukan Pekerjaan sebagaimana berikut ini :
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getRecordItems(selectedItem).map((it, idx) => {
                    const formattedDate = new Date(it.date).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });
                    return (
                      <tr key={idx} className="h-7">
                        <td className="border border-gray-800 px-3 py-1 text-center text-gray-700 font-semibold w-12">{idx + 1}</td>
                        <td className="border border-gray-800 px-3 py-1 pl-4 text-gray-800">
                          <span className="font-semibold text-gray-900">{formattedDate}</span> - {it.reason}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Pad to 5 rows if there are fewer */}
                  {Array.from({ length: Math.max(0, 5 - getRecordItems(selectedItem).length) }).map((_, i) => {
                    const idx = getRecordItems(selectedItem).length + i;
                    return (
                      <tr key={`pad2-${idx}`} className="h-7">
                        <td className="border border-gray-800 px-3 py-1 text-center text-gray-400 font-semibold w-12">{idx + 1}</td>
                        <td className="border border-gray-800 px-3 py-1"></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Outro text identical to Excel */}
            <div className="text-xs text-gray-800 mt-6 space-y-1 print-outro">
              <p>Demikian Untuk di ketahui</p>
              <p className="italic text-[10px] text-gray-500 font-bold">Catatan : Form lembur di berikan ke HRD sebelum melakukan aktifitas</p>
            </div>

            {/* Signatures identical to Excel layout */}
            <div className="flex justify-between items-end mt-12 print-signatures">
              {/* Column 1: HRD */}
              <div className="text-center w-1/3">
                <p className="font-bold text-xs text-gray-700 mb-8">Diketahui</p>
                <div className="h-16 flex items-center justify-center">
                  {selectedItem.status === 'approved' ? (
                    <div className="border-2 border-green-600 text-green-600 rounded px-2.5 py-0.5 inline-block font-bold text-xs uppercase tracking-wide rotate-[-3deg] bg-green-50/50">
                      VERIFIED
                    </div>
                  ) : (
                    <span className="text-gray-400 font-mono text-[10px]">— Belum Diverifikasi —</span>
                  )}
                </div>
                <p className="font-bold text-xs underline text-gray-800 mt-2">(Nazirin Nawawi)</p>
                <p className="text-[10px] text-gray-500 font-bold">HR GA</p>
              </div>

              {/* Column 2: Operasional Manager */}
              <div className="text-center w-1/3">
                <p className="font-bold text-xs text-gray-700 mb-8">Mengetahui</p>
                <div className="h-16 flex items-center justify-center">
                  {selectedItem.status === 'approved' ? (
                    <div className="border-2 border-blue-600 text-blue-600 rounded px-2.5 py-0.5 inline-block font-bold text-xs uppercase tracking-wide rotate-[-3deg] bg-blue-50/50">
                      APPROVED
                    </div>
                  ) : selectedItem.status === 'rejected' ? (
                    <div className="border-2 border-red-600 text-red-600 rounded px-2.5 py-0.5 inline-block font-bold text-xs uppercase tracking-wide rotate-[-3deg] bg-red-50/50">
                      REJECTED
                    </div>
                  ) : (
                    <span className="text-gray-400 font-mono text-[10px]">— Belum Disetujui —</span>
                  )}
                </div>
                <p className="font-bold text-xs underline text-gray-800 mt-2">({selectedItem.approver?.name || selectedItem.user?.supervisor?.name || 'Operasional'})</p>
                <p className="text-[10px] text-gray-500 font-bold">Operasional</p>
              </div>

              {/* Column 3: Employee Submission */}
              <div className="text-center w-1/3">
                <p className="text-xs text-gray-700 mb-1">
                  Jakarta, {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="font-bold text-xs text-gray-700 mb-2">Diajukan oleh:</p>
                <div className="h-16 flex items-center justify-center">
                  {selectedItem.signature ? (
                    <img src={selectedItem.signature} alt="Signature" className="h-16 object-contain" />
                  ) : (
                    <span className="text-gray-400 font-mono text-[10px]">— Tanpa TTD —</span>
                  )}
                </div>
                <p className="font-bold text-xs underline text-gray-800 mt-2">({selectedItem.user?.name || '-'})</p>
                <p className="text-[10px] text-gray-500 font-bold">&nbsp;</p>
              </div>
            </div>

            {/* Print timestamp */}
            <div className="mt-12 pt-3 border-t border-gray-200 text-center text-[10px] text-gray-400 print-only">
              Dokumen ini di-generate secara otomatis oleh HRMS SaaS pada {new Date().toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
