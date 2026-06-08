"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Plus, Search, Eye, ReceiptCent, Upload, 
  ArrowLeft, Printer, Trash2, Send, FileDown 
} from "lucide-react";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";
import SignaturePad from "@/components/SignaturePad";

interface ReimbursementItem {
  spesifikasi: string;
  unit: string;
  qty: number;
  estimasi_harga: number;
  keterangan: string;
}

interface ReimbursementRecord {
  id: number;
  user_id: number;
  title: string;
  amount: number;
  status: string;
  divisi?: string;
  employee_name?: string;
  tujuan?: string;
  priority?: string;
  items?: any;
  description?: string;
  signature?: string;
  attachments?: any;
  created_at?: string;
  updated_at?: string;
  user?: { name: string };
  hrApprover?: { name: string };
  supervisorApprover?: { name: string };
  supervisor_approved_at?: string;
  approved_at?: string;
  supervisor_approved_by?: number;
  supervisor_remark?: string;
  remark?: string;
}

const emptyItem = (): ReimbursementItem => ({ 
  spesifikasi: "", unit: "", qty: 1, estimasi_harga: 0, keterangan: "" 
});

export default function ReimbursementsPage() {
  const { hasPermission, user } = useAuth();
  const [reimbursements, setReimbursements] = useState<ReimbursementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  const [viewMode, setViewMode] = useState<"list" | "create" | "detail">("list");
  const [selectedItem, setSelectedItem] = useState<ReimbursementRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    employee_name: "",
    is_custom_employee_name: false,
    title: "",
    divisi: "",
    tujuan: "Pengadaan Baru",
    tujuanLainnya: "",
    priority: "Normal",
    items: [emptyItem()],
    signature: "",
    attachments: [] as File[],
  });

  const fetchReimbursements = useCallback(async (pageNumber: number) => {
    try {
      setLoading(true);
      const query = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
      const response = await axiosInstance.get(`/reimbursements?page=${pageNumber}${query}`);
      setReimbursements(response.data.data?.data || response.data.data || []);
      if (response.data.data?.current_page) {
        setPagination({
          current_page: response.data.data.current_page,
          last_page: response.data.data.last_page,
          total: response.data.data.total
        });
      }
    } catch (err) {
      console.error("Gagal mendapatkan data klaim", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (user && !formData.employee_name) {
      setFormData((prev) => ({
        ...prev,
        employee_name: user.name || "",
        divisi: prev.divisi || (user as any).department || "Operasional"
      }));
    }
  }, [user, formData.employee_name]);

  useEffect(() => {
    fetchReimbursements(page);
    const interval = setInterval(() => fetchReimbursements(page), 30000);
    return () => clearInterval(interval);
  }, [page, fetchReimbursements]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleViewDetail = (item: ReimbursementRecord) => {
    setSelectedItem(item);
    setViewMode("detail");
  };

  const handleDelete = async (id: number) => {
    if (!globalThis.confirm("Apakah Anda yakin ingin menghapus pengajuan ini?")) return;
    try {
      await axiosInstance.delete(`/reimbursements/${id}`);
      toast.success("Pengajuan berhasil dihapus.");
      fetchReimbursements(page);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menghapus pengajuan.");
    }
  };

  const handleItemChange = (index: number, field: keyof ReimbursementItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculatedTotal = useMemo(() => {
    return formData.items.reduce((sum, item) => {
      const qty = Number.parseFloat(String(item.qty)) || 0;
      const price = Number.parseFloat(String(item.estimasi_harga)) || 0;
      return sum + (qty * price);
    }, 0);
  }, [formData.items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.signature) {
      toast.warning("Judul dan tanda tangan wajib diisi!");
      return;
    }
    if (formData.items.some((i) => !i.spesifikasi || !i.unit || i.qty <= 0 || i.estimasi_harga <= 0)) {
      toast.warning("Tolong isi rincian item dengan lengkap.");
      return;
    }

    setIsSubmitting(true);
    const data = new FormData();
    data.append("title", formData.title);
    data.append("amount", calculatedTotal.toString());
    data.append("divisi", formData.divisi || "Operasional");
    if (formData.employee_name) data.append("employee_name", formData.employee_name);
    
    data.append("tujuan", formData.tujuan === "Lainnya" ? formData.tujuanLainnya : formData.tujuan);
    data.append("priority", formData.priority || "Normal");
    data.append("items", JSON.stringify(formData.items));
    data.append("description", formData.title); 
    data.append("signature", formData.signature);

    if (formData.attachments) {
      formData.attachments.forEach((file) => data.append("attachments[]", file));
    }

    try {
      await axiosInstance.post("/reimbursements", data, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Klaim berhasil diajukan!");
      setViewMode("list");
      setFormData({
        employee_name: user?.name || "",
        is_custom_employee_name: false,
        title: "",
        divisi: (user as any)?.department || "Operasional",
        tujuan: "Pengadaan Baru",
        tujuanLainnya: "",
        priority: "Normal",
        items: [emptyItem()],
        signature: "",
        attachments: [],
      });
      fetchReimbursements(page);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengajukan klaim.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    let classes = 'dash-badge-neutral';
    let label = status;
    if (status === 'pending') { classes = 'dash-badge-warning'; label = 'Menunggu'; }
    else if (status === 'approved') { classes = 'dash-badge-success'; label = 'Disetujui'; }
    else if (status === 'rejected') { classes = 'dash-badge-danger'; label = 'Ditolak'; }
    
    return <span className={`dash-badge ${classes} font-semibold`}>{label}</span>;
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const terbilang = (nominal: number): string => {
    if (nominal === 0) return "Nol Rupiah";
    const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    const konversi = (n: number): string => {
      if (n < 12) return angka[n];
      if (n < 20) return konversi(n - 10) + " Belas";
      if (n < 100) return konversi(Math.floor(n / 10)) + " Puluh " + konversi(n % 10);
      if (n < 200) return "Seratus " + konversi(n - 100);
      if (n < 1000) return konversi(Math.floor(n / 100)) + " Ratus " + konversi(n % 100);
      if (n < 2000) return "Seribu " + konversi(n - 1000);
      if (n < 1000000) return konversi(Math.floor(n / 1000)) + " Ribu " + konversi(n % 1000);
      if (n < 1000000000) return konversi(Math.floor(n / 1000000)) + " Juta " + konversi(n % 1000000);
      if (n < 1000000000000) return konversi(Math.floor(n / 1000000000)) + " Milyar " + konversi(n % 1000000000);
      return "";
    };
    let hasil = konversi(Math.floor(nominal)).replaceAll(/\s+/g, ' ').trim();
    hasil = hasil.replace("Satu Ratus", "Seratus").replace("Satu Puluh", "Sepuluh").replace("Satu Ribu", "Seribu");
    return hasil + " Rupiah";
  };

  const handlePrint = () => globalThis.print();

  const handleDownloadPdf = async (recordId: number, userName: string) => {
    try {
      const response = await axiosInstance.get(`/export/reimbursement/${recordId}`, { responseType: 'blob' });
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reimbursement_${userName.replaceAll(/\s+/g, '_')}.pdf`);
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
      const response = await axiosInstance.get(`/export/reimbursement/${recordId}/excel`, { responseType: 'blob' });
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reimbursement_${userName.replaceAll(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      toast.error("Gagal mendownload Excel.");
    }
  };

  const getRecordItems = (record: ReimbursementRecord | null) => {
    if (!record) return [];
    if (record.items) {
      const itms = typeof record.items === 'string' ? JSON.parse(record.items) : record.items;
      if (Array.isArray(itms)) return itms;
    }
    return [{ spesifikasi: record.title || "Klaim", unit: "Lbr", qty: 1, estimasi_harga: record.amount || 0, keterangan: record.description || "" }];
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: String.raw`
        .excel-table { border-collapse: collapse !important; border: 1.5px solid #000000 !important; }
        .excel-table th, .excel-table td { border: 1.5px solid #000000 !important; padding: 4px 8px !important; }
        .bg-\[#D9E1F2\] { background-color: #D9E1F2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @media print {
          aside, header, nav, footer, .no-print, .dash-sidebar, .dash-desktop-header, .dash-mobile-header { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .dash-main { display: block !important; padding: 0 !important; border: none !important; }
          .print-container { width: 100% !important; max-width: 100% !important; border: none !important; box-shadow: none !important; padding: 0 !important; font-size: 11px !important; }
        }
      `}} />

      {viewMode === "list" && (
        <div className="print:hidden">
          <div className="dash-page-header">
            <div><h1 className="dash-page-title">Reimbursement & Claim</h1><p className="dash-page-desc">Kelola pengajuan klaim dana dan biaya operasional.</p></div>
            <div className="dash-page-actions">{hasPermission('apply-reimbursements') && <button onClick={() => setViewMode("create")} className="dash-btn dash-btn-primary"><Plus size={15} /> Ajukan Klaim Baru</button>}</div>
          </div>
          <div className="dash-table-container">
            <div className="flex items-center justify-between mb-4 bg-white p-3 border rounded-lg">
              <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="Cari pengajuan..." value={searchQuery} onChange={handleSearch} className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50 border rounded-md focus:outline-none" /></div>
            </div>
            {loading ? <div className="p-6"><TableSkeleton rows={6} cols={6} /></div> : reimbursements.length === 0 ? <div className="p-8 text-center text-gray-500 text-sm">Tidak ada data pengajuan.</div> : (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead><tr><th>Info Pengaju</th><th>Judul / Keperluan</th><th>Total Dana</th><th>Tanggal</th><th>Status</th><th className="text-right">Aksi</th></tr></thead>
                  <tbody>
                    {reimbursements.map((r) => (
                      <tr key={r.id}>
                        <td><div className="flex flex-col"><span className="font-semibold text-gray-900">{r.employee_name || r.user?.name}</span><span className="text-[10px] text-gray-500 uppercase font-bold">{r.divisi}</span></div></td>
                        <td><span className="text-sm font-medium text-gray-700">{r.title}</span></td>
                        <td><span className="text-sm font-bold text-gray-900">{formatCurrency(r.amount)}</span></td>
                        <td><span className="text-xs text-gray-500">{new Date(r.created_at || '').toLocaleDateString('id-ID')}</span></td>
                        <td>{getStatusBadge(r.status)}</td>
                        <td className="text-right"><div className="flex items-center justify-end gap-1"><button className="dash-action-btn view" title="Detail" onClick={() => handleViewDetail(r)}><Eye size={16} /></button>{(r.status === 'pending' || r.status === 'draft') && r.user_id === user?.id && <button className="dash-action-btn delete" title="Hapus" onClick={() => handleDelete(r.id)}><Trash2 size={16} /></button>}</div></td>
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
        <div className="max-w-5xl mx-auto py-8 px-4 no-print">
          <div className="flex items-center gap-3 mb-6">
            <button type="button" onClick={() => setViewMode("list")} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-bold">Form Pengajuan Reimbursement / Dana</h2>
          </div>
          <form onSubmit={handleSubmit} className="bg-white border rounded-xl shadow-sm overflow-hidden p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700" htmlFor="employee_name">Nama Pengaju (Karyawan)</label>
                <div className="flex gap-2">
                  <input id="employee_name" type="text" value={formData.employee_name} onChange={(e) => setFormData({...formData, employee_name: e.target.value})} className="flex-1 h-10 px-3 border rounded-lg" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700" htmlFor="divisi">Divisi / Departemen</label>
                <input id="divisi" type="text" value={formData.divisi} onChange={(e) => setFormData({...formData, divisi: e.target.value})} className="w-full h-10 px-3 border rounded-lg" required />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-bold text-gray-700" htmlFor="title">Judul / Keperluan Pengajuan</label>
                <input id="title" type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full h-10 px-3 border rounded-lg" placeholder="Contoh: Pengadaan Alat Tulis Kantor Cabang..." required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700" htmlFor="tujuan">Tujuan Penggunaan Dana</label>
                <select id="tujuan" value={formData.tujuan} onChange={(e) => setFormData({...formData, tujuan: e.target.value})} className="w-full h-10 px-3 border rounded-lg">
                  <option value="Pengadaan Baru">Pengadaan Baru</option>
                  <option value="Perbaikan / Maintenance">Perbaikan / Maintenance</option>
                  <option value="Klaim Biaya Operasional">Klaim Biaya Operasional</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700" htmlFor="priority">Prioritas</label>
                <select id="priority" value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})} className="w-full h-10 px-3 border rounded-lg">
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Very Urgent">Very Urgent</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-800">Daftar Item / Rincian Biaya</h3><button type="button" onClick={() => setFormData({...formData, items: [...formData.items, emptyItem()]})} className="text-sm font-bold text-blue-600">+ Tambah Baris</button></div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr className="bg-gray-50 border-b"><th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Spesifikasi/Barang</th><th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Unit</th><th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Qty</th><th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Harga Satuan</th><th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase w-10"></th></tr></thead>
                  <tbody>
                    {formData.items.map((it, idx) => {
                      const rowId = `item-${idx}`;
                      return (
                        <tr key={rowId} className="border-b">
                          <td className="p-2"><input aria-label="Spesifikasi" type="text" value={it.spesifikasi} onChange={(e) => handleItemChange(idx, 'spesifikasi', e.target.value)} className="w-full border-0 focus:ring-0 text-sm" placeholder="Nama barang..." /></td>
                          <td className="p-2"><input aria-label="Unit" type="text" value={it.unit} onChange={(e) => handleItemChange(idx, 'unit', e.target.value)} className="w-full border-0 focus:ring-0 text-sm w-16" placeholder="Pcs/Kg" /></td>
                          <td className="p-2"><input aria-label="Qty" type="number" value={it.qty} onChange={(e) => handleItemChange(idx, 'qty', e.target.value)} className="w-full border-0 focus:ring-0 text-sm w-16" /></td>
                          <td className="p-2"><input aria-label="Harga" type="number" value={it.estimasi_harga} onChange={(e) => handleItemChange(idx, 'estimasi_harga', e.target.value)} className="w-full border-0 focus:ring-0 text-sm" /></td>
                          <td className="p-2">{formData.items.length > 1 && <button type="button" onClick={() => setFormData({...formData, items: formData.items.filter((_, i) => i !== idx)})} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end"><p className="text-lg font-bold">Total Estimasi: {formatCurrency(calculatedTotal)}</p></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700" htmlFor="attachments">Lampiran Bukti (Opsional)</label>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50">
                  <Upload className="text-gray-400 mb-2" size={24} />
                  <input id="attachments" type="file" multiple onChange={(e) => setFormData({...formData, attachments: e.target.files ? Array.from(e.target.files) : []})} className="text-xs" />
                </div>
              </div>
              <div className="space-y-3">
                <p id="signature-pad-label" className="text-sm font-bold text-gray-700">Tanda Tangan Digital</p>
                <div className="border border-dashed rounded-lg p-2 bg-white" aria-labelledby="signature-pad-label"><SignaturePad onSign={(val) => setFormData({...formData, signature: val})} /></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6"><button type="button" onClick={() => setViewMode("list")} className="px-6 py-2 border rounded-lg font-bold text-gray-600">Batal</button><button type="submit" disabled={isSubmitting} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg">{isSubmitting ? "Mengirim..." : <><Send size={18} /> Kirim Pengajuan</>}</button></div>
          </form>
        </div>
      )}

      {viewMode === "detail" && selectedItem && (
        <div className="py-8 px-4">
          <div className="flex items-center justify-between mb-6 bg-gray-50 p-4 border rounded-lg no-print">
            <button onClick={() => setViewMode("list")} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border rounded transition-colors"><ArrowLeft size={16} /> Kembali ke Daftar</button>
            <div className="flex items-center gap-2">
              {getStatusBadge(selectedItem.status)}
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded transition-colors"><Printer size={15} /> Cetak / PDF</button>
              <button onClick={() => handleDownloadPdf(selectedItem.id, selectedItem.employee_name || selectedItem.user?.name || "Karyawan")} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-gray-700 bg-white border rounded transition-colors shadow-sm"><FileDown size={15} /> Unduh PDF</button>
              <button onClick={() => handleDownloadExcel(selectedItem.id, selectedItem.employee_name || selectedItem.user?.name || "Karyawan")} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-green-700 bg-white border border-green-200 rounded transition-colors shadow-sm"><FileDown size={15} /> Unduh Excel</button>
            </div>
          </div>

          <div className="print-container bg-white shadow-xl border rounded-xl p-12 max-w-5xl mx-auto my-4 transition-all" style={{ fontFamily: 'Tahoma, Arial, sans-serif', fontSize: '11px' }}>
            <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-4">
              <div className="flex items-center gap-4"><img src="/artacom.png" alt="Logo" className="h-14 object-contain" /><div className="border-l border-gray-300 pl-4 h-12 flex flex-col justify-center"><h1 className="text-xl font-black text-gray-900 leading-none">ART ACOM</h1><p className="text-[9px] font-bold text-gray-500 tracking-widest mt-1">HRMS SaaS Integrated</p></div></div>
              <div className="text-right"><h2 className="text-lg font-black text-gray-900 underline tracking-tighter italic">REIMBURSEMENT / FUND REQUEST</h2><p className="text-[10px] font-mono font-bold text-gray-500 mt-1 uppercase">No : {String(selectedItem.id).padStart(4, '0')}/FR/{(new Date(selectedItem.created_at || '')).getMonth()+1}/{(new Date(selectedItem.created_at || '')).getFullYear()}</p></div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-6 bg-gray-50/50 p-4 border-2 border-black rounded-lg">
              <div className="space-y-2">
                <div className="flex border-b border-black/10 pb-1"><span className="w-28 font-bold text-gray-500 uppercase tracking-tighter">Nama Karyawan</span><span className="mr-2">:</span><span className="font-black text-gray-900">{selectedItem.employee_name || selectedItem.user?.name}</span></div>
                <div className="flex border-b border-black/10 pb-1"><span className="w-28 font-bold text-gray-500 uppercase tracking-tighter">Divisi</span><span className="mr-2">:</span><span className="font-bold text-gray-800">{selectedItem.divisi || "Operasional"}</span></div>
              </div>
              <div className="space-y-2">
                <div className="flex border-b border-black/10 pb-1"><span className="w-28 font-bold text-gray-500 uppercase tracking-tighter">Tujuan Dana</span><span className="mr-2">:</span><span className="font-bold text-gray-800">{selectedItem.tujuan || "-"}</span></div>
                <div className="flex border-b border-black/10 pb-1"><span className="w-28 font-bold text-gray-500 uppercase tracking-tighter">Prioritas</span><span className="mr-2">:</span><span className={`font-black ${selectedItem.priority === 'Urgent' ? 'text-red-600' : 'text-gray-800'}`}>{selectedItem.priority || "Normal"}</span></div>
              </div>
            </div>

            <div className="mb-6"><p className="text-[10px] font-black uppercase text-gray-400 mb-2 flex items-center gap-2"><ReceiptCent size={12} /> Detail Rincian Biaya / Barang</p>
              <table className="w-full excel-table text-center uppercase">
                <thead className="bg-[#D9E1F2]"><tr><th className="w-10">No</th><th>Spesifikasi / Barang</th><th>Unit</th><th>Qty</th><th>Estimasi Harga</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {getRecordItems(selectedItem).map((it: any, idx: number) => {
                    const itemId = `detail-item-${idx}`;
                    return (
                      <tr key={itemId}><td>{idx + 1}</td><td className="text-left font-bold">{it.spesifikasi}</td><td>{it.unit}</td><td>{it.qty}</td><td>{formatCurrency(it.estimasi_harga)}</td><td>{it.keterangan || "-"}</td></tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 5 - getRecordItems(selectedItem).length) }).map((_, i) => {
                    const padId = `pad-${i}`;
                    return (
                      <tr key={padId} className="h-6"><td>{getRecordItems(selectedItem).length + i + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>
                    );
                  })}
                </tbody>
                <tfoot><tr className="bg-gray-100"><td colSpan={4} className="text-right font-black text-gray-700">Total Keseluruhan</td><td className="font-black text-gray-900 bg-amber-50">{formatCurrency(selectedItem.amount)}</td><td className="bg-gray-100"></td></tr></tfoot>
              </table>
              <div className="mt-2 p-2 border-2 border-black border-t-0 bg-white"><p className="text-[10px] font-bold text-gray-500 italic">Terbilang : <span className="text-gray-900 font-black not-italic ml-1">{terbilang(selectedItem.amount)}</span></p></div>
            </div>

            <div className="flex justify-between items-start mt-10">
              <div className="text-center w-1/4">
                <p className="font-bold mb-8 uppercase tracking-widest text-gray-500">Pemohon</p>
                <div className="h-20 flex items-center justify-center mb-2">{selectedItem.signature ? <img src={selectedItem.signature} alt="TTD" className="h-16 object-contain" /> : <div className="border-b border-black w-full h-16"></div>}</div>
                <p className="font-black border-t-2 border-black pt-1">({selectedItem.employee_name || selectedItem.user?.name})</p>
              </div>
              <div className="text-center w-1/4">
                <p className="font-bold mb-8 uppercase tracking-widest text-gray-500">Menyetujui</p>
                <div className="h-20 flex items-center justify-center mb-2">{(selectedItem.status === 'approved' || selectedItem.supervisor_approved_by) ? <div className="border-2 border-blue-600 text-blue-600 rounded px-2 py-1 font-black rotate-[-12deg] opacity-60">APPROVED</div> : <div className="border-b border-black w-full h-16"></div>}</div>
                <p className="font-black border-t-2 border-black pt-1">({selectedItem.supervisorApprover?.name || "Manager"})</p>
              </div>
              <div className="text-center w-1/4">
                <p className="font-bold mb-8 uppercase tracking-widest text-gray-500">Diperiksa</p>
                <div className="h-20 flex items-center justify-center mb-2">{selectedItem.status === 'approved' ? <div className="border-2 border-green-600 text-green-600 rounded px-2 py-1 font-black rotate-[-12deg] opacity-60">VERIFIED</div> : <div className="border-b border-black w-full h-16"></div>}</div>
                <p className="font-black border-t-2 border-black pt-1">({selectedItem.hrApprover?.name || "Finance/HR"})</p>
              </div>
            </div>
            <div className="mt-12 pt-3 border-t-2 border-dashed border-gray-300 text-center text-[9px] font-bold text-gray-400 no-print">Dokumen ini di-generate secara otomatis oleh HRMS SaaS pada {new Date().toLocaleString('id-ID')}</div>
          </div>
        </div>
      )}
    </>
  );
}
