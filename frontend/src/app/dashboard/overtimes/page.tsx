"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { Plus, Search, Eye, Clock, FileDown, Trash2, Save, Send, Printer, ArrowLeft } from "lucide-react";
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
  user_id: number;
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
    } catch (err) { 
      console.error("Gagal fetch overtimes", err); 
    }
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
    if (!globalThis.confirm("Hapus pengajuan lembur ini?")) return;
    try {
      await axiosInstance.delete(`/overtimes/${id}`);
      toast.success("Lembur berhasil dihapus.");
      fetchOvertimes(page);
    } catch (e: any) { toast.error(e.response?.data?.message || "Gagal menghapus"); }
  };

  const handleExport = async () => {
    try {
      const res = await axiosInstance.get('/overtimes/export', { responseType: 'blob' });
      const url = globalThis.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Data_Lembur.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { 
      console.error(err);
      toast.error("Gagal export excel."); 
    }
  };

  const handlePrint = () => {
    setTimeout(() => {
      globalThis.print();
    }, 500);
  };

  const handleDownloadPdf = async (recordId: number, userName: string) => {
    try {
      const response = await axiosInstance.get(`/export/overtime/${recordId}`, {
        responseType: 'blob'
      });
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Lembur_${userName.replaceAll(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      toast.error("Gagal mendownload PDF.");
    }
  };

  const handleDownloadExcel = async (recordId: number, userName: string) => {
    try {
      const response = await axiosInstance.get(`/export/overtime/${recordId}/excel`, {
        responseType: 'blob'
      });
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Lembur_${userName.replaceAll(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      toast.error("Gagal mendownload Excel.");
    }
  };

  const getStatusBadge = (s: string) => {
    switch(s) {
      case 'approved': return <span className="dash-badge dash-badge-success">Disetujui</span>;
      case 'rejected': return <span className="dash-badge dash-badge-danger">Ditolak</span>;
      case 'draft': return <span className="dash-badge dash-badge-neutral">Draft</span>;
      default: return <span className="dash-badge dash-badge-warning">Menunggu</span>;
    }
  };

  const getRecordItems = (ot: OvertimeRecord): OvertimeItem[] => {
    if (ot.items && ot.items.length > 0) return ot.items;
    if (ot.date) return [{ date: ot.date, start_time: ot.start_time || "", end_time: ot.end_time || "", reason: ot.reason || "" }];
    return [];
  };

  const getOvertimePeriod = (ot: OvertimeRecord) => {
    const items = getRecordItems(ot);
    if (items.length === 0) return '-';
    const sorted = items.map(i => i.date).sort((a, b) => a.localeCompare(b));
    const first = new Date(sorted[0]).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    if (sorted.length === 1) return first;
    const last = new Date(sorted.at(-1) || '').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${first} s/d ${last}`;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'approved') return 'APPROVED';
    if (status === 'rejected') return 'REJECTED';
    return '— Belum Disetujui —';
  };

  const getStatusClass = (status: string) => {
    if (status === 'approved') return 'border-blue-600 text-blue-600 bg-blue-50/50';
    if (status === 'rejected') return 'border-red-600 text-red-600 bg-red-50/50';
    return '';
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: String.raw`
        @page { size: portrait; margin: 10mm 12mm !important; }
        @media print {
          aside, header, nav, footer, .no-print, .dash-sidebar, .dash-desktop-header, .dash-mobile-header { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .dash-main { display: block !important; padding: 0 !important; margin: 0 !important; border: none !important; }
          .print-container { width: 100% !important; max-width: 100% !important; border: none !important; box-shadow: none !important; padding: 0 !important; font-size: 11px !important; }
          .print\:hidden { display: none !important; }
          .excel-table { border: 1.5px solid #000 !important; }
          .excel-table th, .excel-table td { border: 1px solid #000 !important; padding: 4px 8px !important; }
          .bg-\[\#D9E1F2\] { background-color: #D9E1F2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .underline { text-decoration: underline !important; }
        }
      `}} />

      {viewMode === "list" && (
        <div className="print:hidden">
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Lembur Karyawan</h1>
              <p className="dash-page-desc">Ajukan dan kelola pengajuan lembur Anda.</p>
            </div>
            <div className="dash-page-actions">
              <button onClick={handleExport} className="dash-btn dash-btn-neutral">
                <FileDown size={15} /> Export Excel
              </button>
              <button onClick={openCreatePage} className="dash-btn dash-btn-primary">
                <Plus size={15} /> Ajukan Lembur
              </button>
            </div>
          </div>

          <div className="dash-table-container">
            <div className="flex items-center justify-between mb-4 bg-white p-3 border border-[#ebedf0] rounded-lg">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder="Cari lembur..." className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none" />
              </div>
            </div>

            {loading ? <div className="p-6"><TableSkeleton rows={6} cols={6} /></div> : (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Karyawan</th>
                      <th>Judul/Periode</th>
                      <th>Item</th>
                      <th>Status</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overtimes.map((ot) => (
                      <tr key={ot.id}>
                        <td><span className="font-semibold">{ot.user?.name || "Karyawan"}</span></td>
                        <td><span className="text-sm">{ot.title || getOvertimePeriod(ot)}</span></td>
                        <td><span className="text-xs text-gray-500">{getRecordItems(ot).length} item</span></td>
                        <td>{getStatusBadge(ot.status)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="dash-action-btn view" title="Detail" onClick={() => { setSelectedItem(ot); setViewMode("detail"); }}>
                              <Eye size={16} />
                            </button>
                            {ot.status === 'draft' && ot.user_id === user?.id && (
                              <button className="dash-action-btn edit" title="Edit" onClick={() => openEditPage(ot)}>
                                <Save size={16} className="w-4 h-4" />
                              </button>
                            )}
                            {(ot.status === 'draft' || ot.status === 'pending') && ot.user_id === user?.id && (
                              <button className="dash-action-btn delete" title="Hapus" onClick={() => handleDelete(ot.id)}>
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pagination.last_page > 1 && <Pagination currentPage={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} onPageChange={setPage} />}
          </div>
        </div>
      )}

      {viewMode === "create" && (
        <div className="max-w-4xl mx-auto py-8 px-4 no-print">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setViewMode("list")} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-bold">{editingId ? 'Edit Draf Lembur' : 'Pengajuan Lembur Baru'}</h2>
          </div>

          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-gray-50/50">
              <label htmlFor="form_title" className="block text-sm font-semibold text-gray-700 mb-1.5">Judul Pengajuan (Contoh: Lembur Maret 2026)</label>
              <input id="form_title" type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-blue-500" placeholder="Judul lembur..." />
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Clock size={18} /> Rincian Item Lembur</h3><button onClick={addItem} className="text-sm font-bold text-blue-600 hover:text-blue-700">+ Tambah Baris</button></div>
              <div className="space-y-3">
                {formItems.map((it, idx) => (
                  <div key={`${it.id || idx}`} className="grid grid-cols-1 md:grid-cols-[140px_100px_100px_1fr_40px] gap-3 items-end p-3 border rounded-lg bg-gray-50/30">
                    <div>
                      <label htmlFor={`date-${idx}`} className="text-[10px] font-bold text-gray-500 uppercase">Tanggal</label>
                      <input id={`date-${idx}`} type="date" value={it.date} onChange={(e) => updateItem(idx, 'date', e.target.value)} className="w-full text-sm border-0 border-b bg-transparent focus:ring-0" />
                    </div>
                    <div>
                      <label htmlFor={`start-${idx}`} className="text-[10px] font-bold text-gray-500 uppercase">Mulai</label>
                      <input id={`start-${idx}`} type="time" value={it.start_time} onChange={(e) => updateItem(idx, 'start_time', e.target.value)} className="w-full text-sm border-0 border-b bg-transparent focus:ring-0" />
                    </div>
                    <div>
                      <label htmlFor={`end-${idx}`} className="text-[10px] font-bold text-gray-500 uppercase">Selesai</label>
                      <input id={`end-${idx}`} type="time" value={it.end_time} onChange={(e) => updateItem(idx, 'end_time', e.target.value)} className="w-full text-sm border-0 border-b bg-transparent focus:ring-0" />
                    </div>
                    <div>
                      <label htmlFor={`reason-${idx}`} className="text-[10px] font-bold text-gray-500 uppercase">Alasan/Pekerjaan</label>
                      <input id={`reason-${idx}`} type="text" value={it.reason} onChange={(e) => updateItem(idx, 'reason', e.target.value)} className="w-full text-sm border-0 border-b bg-transparent focus:ring-0" placeholder="Input pekerjaan..." />
                    </div>
                    <button onClick={() => removeItem(idx)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50/30">
              <p id="signature-label" className="text-sm font-semibold text-gray-700 mb-2">Tanda Tangan Digital</p>
              <div className="max-w-xs border border-dashed rounded-lg bg-white p-2" aria-labelledby="signature-label">
                <SignaturePad onSign={setFormSignature} />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => handleSave("draft")} disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"><Save size={16} /> Simpan Draf</button>
              <button onClick={() => handleSave("pending")} disabled={isSubmitting} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-lg shadow-blue-200 flex items-center gap-2"><Send size={16} /> {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}</button>
            </div>
          </div>
        </div>
      )}

      {viewMode === "detail" && selectedItem && (
        <div className="py-8 px-4">
          <div className="flex items-center justify-between mb-6 bg-gray-50 p-4 border border-gray-200 rounded-lg no-print">
            <button onClick={() => setViewMode("list")} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-100 rounded border border-gray-200 transition-colors"><ArrowLeft size={16} /> Kembali ke Daftar</button>
            <div className="flex items-center gap-2">
              {getStatusBadge(selectedItem.status)}
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"><Printer size={15} /> Cetak / PDF</button>
              <button onClick={() => handleDownloadPdf(selectedItem.id, selectedItem.user?.name || "Karyawan")} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded transition-colors shadow-sm"><FileDown size={15} /> Unduh PDF</button>
              <button onClick={() => handleDownloadExcel(selectedItem.id, selectedItem.user?.name || "Karyawan")} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-green-700 bg-white border border-green-200 hover:bg-green-50 rounded transition-colors shadow-sm"><FileDown size={15} /> Unduh Excel</button>
            </div>
          </div>

          <div className="print-container bg-white shadow-xl border border-gray-300 rounded-xl p-12 max-w-4xl mx-auto my-4 transition-all" style={{ fontFamily: 'Calibri, Arial, sans-serif' }}>
            <div className="flex justify-between items-start mb-6 print-header">
              <div><h1 className="text-base font-bold text-[#1F4E79] underline tracking-wide">Form. Lembur utk {selectedItem.user?.office?.name || "KP Cakung"}</h1></div>
              <div className="text-xs text-gray-800 leading-normal text-right"><p className="font-semibold">Kepada Yth,</p><p className="font-semibold">HRD - Personalia</p><p className="font-semibold">PT. Narwastu Group</p><p className="font-semibold">Di Tempat</p></div>
            </div>
            <div className="text-xs text-gray-800 space-y-2 mb-4 print-greetings">
              <p className="font-semibold">Dengan Hormat,</p>
              <p>Bersama ini diberitahukan bahwa kami menugaskan karyawan berikut untuk melakukan kerja lembur :</p>
              <p className="font-semibold">Pada hari, Tanggal : {getOvertimePeriod(selectedItem)}</p>
            </div>
            <div className="mb-4 print-table-wrapper">
              <table className="w-full border-collapse border border-gray-800 text-xs text-center excel-table">
                <thead className="bg-[#D9E1F2]">
                  <tr><th className="border border-gray-800 px-3 py-1 font-bold text-gray-800 w-12">No</th><th className="border border-gray-800 px-3 py-1 font-bold text-gray-800">Nama</th><th className="border border-gray-800 px-3 py-1 font-bold text-gray-800 w-48">Jam Mulai</th><th className="border border-gray-800 px-3 py-1 font-bold text-gray-800 w-48">Jam Selesai</th></tr>
                </thead>
                <tbody>
                  {getRecordItems(selectedItem).map((it, idx) => (
                    <tr key={`${it.id || idx}`} className="h-7">
                      <td className="border border-gray-800 px-3 py-1 text-gray-700 font-semibold">{idx + 1}</td>
                      <td className="border border-gray-800 px-3 py-1 text-left pl-4 font-semibold text-gray-900">{selectedItem.user?.name || '-'}</td>
                      <td className="border border-gray-800 px-3 py-1 text-gray-800">{it.start_time?.substring(0, 5)}</td>
                      <td className="border border-gray-800 px-3 py-1 text-gray-800">{it.end_time?.substring(0, 5)}</td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 5 - getRecordItems(selectedItem).length) }).map((_, i) => {
                    const idx = getRecordItems(selectedItem).length + i;
                    return <tr key={`pad-${idx}`} className="h-7"><td className="border border-gray-800 px-3 py-1 text-gray-400 font-semibold">{idx + 1}</td><td className="border border-gray-800 px-3 py-1"></td><td className="border border-gray-800 px-3 py-1"></td><td className="border border-gray-800 px-3 py-1"></td></tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="mb-4 print-table-wrapper">
              <table className="w-full border-collapse border border-gray-800 text-xs excel-table">
                <thead className="bg-[#D9E1F2]"><tr><th colSpan={2} className="border border-gray-800 px-3 py-2 font-bold text-left text-gray-800">Untuk Melakukan Pekerjaan sebagaimana berikut ini :</th></tr></thead>
                <tbody>
                  {getRecordItems(selectedItem).map((it, idx) => {
                    const formattedDate = new Date(it.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    return <tr key={`${it.id || idx}`} className="h-7"><td className="border border-gray-800 px-3 py-1 text-center text-gray-700 font-semibold w-12">{idx + 1}</td><td className="border border-gray-800 px-3 py-1 pl-4 text-gray-800"><span className="font-semibold text-gray-900">{formattedDate}</span> - {it.reason}</td></tr>;
                  })}
                  {Array.from({ length: Math.max(0, 5 - getRecordItems(selectedItem).length) }).map((_, i) => {
                    const idx = getRecordItems(selectedItem).length + i;
                    return <tr key={`pad2-${idx}`} className="h-7"><td className="border border-gray-800 px-3 py-1 text-center text-gray-400 font-semibold w-12">{idx + 1}</td><td className="border border-gray-800 px-3 py-1"></td></tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-gray-800 mt-6 space-y-1 print-outro"><p>Demikian Untuk di ketahui</p><p className="italic text-[10px] text-gray-500 font-bold">Catatan : Form lembur di berikan ke HRD sebelum melakukan aktifitas</p></div>
            <div className="flex justify-between items-end mt-12 print-signatures">
              <div className="text-center w-1/3">
                <p className="font-bold text-xs text-gray-700 mb-8">Diketahui</p>
                <div className="h-16 flex items-center justify-center">
                  {selectedItem.status === 'approved' ? <div className="border-2 border-green-600 text-green-600 rounded px-2.5 py-0.5 inline-block font-bold text-xs uppercase tracking-wide rotate-[-3deg] bg-green-50/50">VERIFIED</div> : <span className="text-gray-400 font-mono text-[10px]">— Belum Diverifikasi —</span>}
                </div>
                <p className="font-bold text-xs underline text-gray-800 mt-2">(Nazirin Nawawi)</p><p className="text-[10px] text-gray-500 font-bold">HR GA</p>
              </div>
              <div className="text-center w-1/3">
                <p className="font-bold text-xs text-gray-700 mb-8">Mengetahui</p>
                <div className="h-16 flex items-center justify-center">
                  <div className={`border-2 rounded px-2.5 py-0.5 inline-block font-bold text-xs uppercase tracking-wide rotate-[-3deg] ${getStatusClass(selectedItem.status)}`}>
                    {getStatusLabel(selectedItem.status)}
                  </div>
                </div>
                <p className="font-bold text-xs underline text-gray-800 mt-2">({selectedItem.approver?.name || selectedItem.user?.supervisor?.name || 'Operasional'})</p><p className="text-[10px] text-gray-500 font-bold">Operasional</p>
              </div>
              <div className="text-center w-1/3">
                <p className="text-xs text-gray-700 mb-1">Jakarta, {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="font-bold text-xs text-gray-700 mb-2">Diajukan oleh:</p>
                <div className="h-16 flex items-center justify-center">{selectedItem.signature ? <img src={selectedItem.signature} alt="Signature" className="h-16 object-contain" /> : <span className="text-gray-400 font-mono text-[10px]">— Tanpa TTD —</span>}</div>
                <p className="font-bold text-xs underline text-gray-800 mt-2">({selectedItem.user?.name || '-'})</p><p className="text-[10px] text-gray-500 font-bold">&nbsp;</p>
              </div>
            </div>
            <div className="mt-12 pt-3 border-t border-gray-200 text-center text-[10px] text-gray-400 print-only">Dokumen ini di-generate secara otomatis oleh HRMS SaaS pada {new Date().toLocaleString('id-ID')}</div>
          </div>
        </div>
      )}
    </>
  );
}
